import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import api from '../../api';
import {
    extractFaceDescriptor,
    getFaceCameraErrorMessage,
    loadFaceModels,
    startFaceCamera,
    stopFaceCamera,
} from '../../utils/faceRecognition';
import './Login.css';

export default function Login() {
    const navigate = useNavigate();
    const location = useLocation();
    const emailInputRef = useRef(null);
    const faceVideoRef = useRef(null);
    const faceStreamRef = useRef(null);
    const [form, setForm] = useState({ email: '', password: '' });
    const [message, setMessage] = useState('');
    const [errors, setErrors] = useState({});
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [faceLoading, setFaceLoading] = useState(false);
    const [faceCameraOpen, setFaceCameraOpen] = useState(false);
    const [faceCameraReady, setFaceCameraReady] = useState(false);
    const [faceMessage, setFaceMessage] = useState('');
    const [faceMessageType, setFaceMessageType] = useState('info');
    const [loginMode, setLoginMode] = useState('normal');

    useEffect(() => {
        // Show OAuth2 error passed from backend redirect.
        const params = new URLSearchParams(location.search);
        const oauthError = params.get('oauthError');
        if (oauthError) {
            setMessage(oauthError);
            return;
        }
        setMessage('');
    }, [location.search]);

    useEffect(() => {
        // Preload face models once.
        loadFaceModels().catch(() => {
            // Capture flow reports concrete errors.
        });
    }, []);

    useEffect(() => {
        if (!faceCameraOpen) {
            return;
        }

        let cancelled = false;
        const videoElement = faceVideoRef.current;

        const connectCamera = async () => {
            setFaceLoading(true);
            setFaceCameraReady(false);
            setFaceMessage('Opening camera...');
            setFaceMessageType('info');
            try {
                const stream = await startFaceCamera(videoElement);
                if (cancelled) {
                    stopFaceCamera(videoElement, stream);
                    return;
                }
                faceStreamRef.current = stream;
                setFaceCameraReady(true);
                setFaceMessage('Camera ready. Center your face and scan.');
                setFaceMessageType('info');
            } catch (cameraError) {
                if (cancelled) {
                    return;
                }
                setFaceCameraOpen(false);
                setFaceCameraReady(false);
                setFaceMessage('');
                setMessage(getFaceCameraErrorMessage(cameraError));
            } finally {
                if (!cancelled) {
                    setFaceLoading(false);
                }
            }
        };

        connectCamera();

        return () => {
            cancelled = true;
            if (faceStreamRef.current) {
                stopFaceCamera(videoElement, faceStreamRef.current);
                faceStreamRef.current = null;
            }
        };
    }, [faceCameraOpen]);

    const handleGoogleLogin = () => {
        // Start OAuth2 login on backend.
        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8081';
        const origin = window.location.origin;
        const redirectUri = `${origin}/oauth-success`;
        const loginUri = `${origin}/login`;
        window.location.href = `${apiBaseUrl}/oauth2/authorization/google?prompt=select_account&redirect_uri=${encodeURIComponent(redirectUri)}&login_uri=${encodeURIComponent(loginUri)}`;
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
        if (name === 'email' && faceMessageType === 'error') {
            setFaceMessage('');
            setFaceMessageType('info');
        }
    };

    const validate = () => {
        const newErrors = {};
        if (!form.email.trim()) newErrors.email = 'Email is required';
        else if (!/\S+@\S+\.\S+/.test(form.email)) newErrors.email = 'Invalid email address';
        if (!form.password.trim()) newErrors.password = 'Password is required';
        return newErrors;
    };

    const routeByRole = (roleValue) => {
        const role = String(roleValue || '').toUpperCase();
        if (role.includes('ADMIN')) {
            navigate('/dashboard', { replace: true });
            return;
        }
        if (role.includes('TECHNICIAN')) {
            navigate('/techhome', { replace: true });
            return;
        }
        navigate('/home', { replace: true });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const validationErrors = validate();
        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            return;
        }

        setLoading(true);
        setMessage('');

        try {
            // Clear old auth cookies before fresh login.
            try {
                await api.post('/auth/logout', {}, { withCredentials: true });
            } catch {
                // Ignore if there is no active session.
            }

            const res = await api.post('/auth/login', form, {
                withCredentials: true,
                headers: { 'Content-Type': 'application/json' },
            });

            if (res.data.success) {
                setMessage('Login successful! Redirecting...');
                routeByRole(res.data.role);
            } else {
                setMessage(res.data.message || 'Login failed. Check credentials.');
            }
        } catch (err) {
            setMessage(err.response?.data?.message || 'Unable to connect to server.');
        } finally {
            setLoading(false);
        }
    };

    const openFaceCamera = () => {
        if (loading || faceLoading) {
            return;
        }

        setFaceMessage('');
        setFaceMessageType('info');
        setMessage('');
        setFaceCameraOpen(true);
    };

    const closeFaceCamera = () => {
        stopFaceCamera(faceVideoRef.current, faceStreamRef.current);
        faceStreamRef.current = null;
        setFaceCameraReady(false);
        setFaceCameraOpen(false);
    };

    const handleFaceLogin = async () => {
        if (!form.email.trim()) {
            setErrors((prev) => ({ ...prev, email: 'Email is required for face login' }));
            setFaceMessage('Enter your university email before scanning.');
            setFaceMessageType('error');
            emailInputRef.current?.focus();
            return;
        }
        if (faceCameraOpen && !faceCameraReady) {
            setFaceMessage('Camera is still opening. Please wait a moment.');
            setFaceMessageType('info');
            return;
        }
        if (!faceCameraOpen || faceLoading) {
            return;
        }

        setFaceLoading(true);
        setMessage('');
        setFaceMessage('Scanning face...');
        setFaceMessageType('info');

        try {
            const descriptor = await extractFaceDescriptor(faceVideoRef.current);

            // Clear old auth cookies before fresh login.
            try {
                await api.post('/auth/logout', {}, { withCredentials: true });
            } catch {
                // Ignore if there is no active session.
            }

            const res = await api.post(
                '/auth/face/login',
                {
                    email: form.email.trim(),
                    faceDescriptor: descriptor,
                },
                {
                    withCredentials: true,
                    headers: { 'Content-Type': 'application/json' },
                }
            );

            if (res.data?.success) {
                setFaceMessage('Face recognized. Redirecting...');
                setFaceMessageType('success');
                closeFaceCamera();
                routeByRole(res.data.role);
                return;
            }

            setFaceMessage(res.data?.message || 'Face login failed.');
            setFaceMessageType('error');
        } catch (err) {
            const apiMessage = err.response?.data?.message;
            const localMessage = err?.message;
            setFaceMessage(apiMessage || localMessage || 'Face login failed.');
            setFaceMessageType('error');
        } finally {
            setFaceLoading(false);
        }
    };

    const handleFormSubmit = (e) => {
        if (loginMode !== 'normal') {
            e.preventDefault();
            return;
        }
        handleSubmit(e);
    };

    return (
        <div className='login-page'>
            <div className='login-page__canvas' />

            <div className='login-layout'>
                <section className='login-showcase' aria-hidden='true'>
                    <div className='login-showcase__photo'>
                        <div className='login-showcase__top'>
                            <strong>UniSphere Spaces</strong>
                            <div className='login-showcase__actions'>
                                <span>Sign Up</span>
                                <span className='join-pill'>Join Us</span>
                            </div>
                        </div>

                        <div className='login-showcase__bottom'>
                            <div className='login-showcase__profile'>
                                <span className='login-showcase__avatar'>U</span>
                                <div>
                                    <p>UniSphere</p>
                                    <small>Resources & Requests</small>
                                </div>
                            </div>

                            <div className='login-showcase__arrows'>
                                <span>&larr;</span>
                                <span>&rarr;</span>
                            </div>
                        </div>
                    </div>
                </section>

                <section className='login-card-wrap'>
                    <div className='login-card'>
                        <div className='login-card__topbar'>
                            <strong className='login-brand'>UniSphere</strong>
                            <span className='lang-pill'>EN</span>
                        </div>

                        <div className='login-card__header'>
                            <h2>Hi UniSphere Community</h2>
                            <p>Welcome to UniSphere Resource Exchange</p>
                        </div>

                        <form onSubmit={handleFormSubmit} noValidate>
                            {message && (
                                <div className='message'>
                                    {message}
                                </div>
                            )}

                            <div className='form-group'>
                                <label>University Email</label>
                                <input
                                    ref={emailInputRef}
                                    type='email'
                                    name='email'
                                    value={form.email}
                                    onChange={handleChange}
                                    placeholder='IT23687882@my.sliit.lk'
                                />
                                {errors.email && <span className='error'>{errors.email}</span>}
                            </div>

                            <div className='login-mode-switch' role='tablist' aria-label='Login mode'>
                                <button
                                    type='button'
                                    role='tab'
                                    aria-selected={loginMode === 'normal'}
                                    className={`mode-chip${loginMode === 'normal' ? ' active' : ''}`}
                                    onClick={() => {
                                        if (faceCameraOpen) {
                                            closeFaceCamera();
                                        }
                                        setLoginMode('normal');
                                    }}
                                >
                                    Email & Password
                                </button>
                                <button
                                    type='button'
                                    role='tab'
                                    aria-selected={loginMode === 'face'}
                                    className={`mode-chip${loginMode === 'face' ? ' active' : ''}`}
                                    onClick={() => setLoginMode('face')}
                                >
                                    Face Login
                                </button>
                            </div>

                            <div className='login-mode-area'>
                                {loginMode === 'normal' && (
                                    <section className='login-mode-card' aria-label='Email and password login'>
                                        <div className='login-mode-head'>
                                            <h3>Email & Password</h3>
                                            <p>Use password or Google account.</p>
                                        </div>

                                        <div className='form-group'>
                                            <label>Password</label>
                                            <div className='password-wrapper'>
                                                <input
                                                    type={showPassword ? 'text' : 'password'}
                                                    name='password'
                                                    value={form.password}
                                                    onChange={handleChange}
                                                    placeholder='Password'
                                                />
                                                <button
                                                    type='button'
                                                    className='show-btn'
                                                    onClick={() => setShowPassword(!showPassword)}
                                                >
                                                    {showPassword ? 'Hide' : 'Show'}
                                                </button>
                                            </div>
                                            {errors.password && <span className='error'>{errors.password}</span>}
                                        </div>

                                        <div className='login-form-meta'>
                                            <Link className='auth-link auth-link-soft' to='/forgot-password'>
                                                Forgot password?
                                            </Link>
                                        </div>

                                        <button
                                            type='submit'
                                            disabled={loading}
                                            className='login-btn'
                                        >
                                            {loading ? 'Loading...' : 'Login'}
                                        </button>
                                        <button
                                            type='button'
                                            onClick={handleGoogleLogin}
                                            className='google-login-btn'
                                            disabled={loading}
                                        >
                                            <svg className='google-icon' viewBox='0 0 24 24'>
                                                <path fill='#4285F4' d='M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z'/>
                                                <path fill='#34A853' d='M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z'/>
                                                <path fill='#FBBC05' d='M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z'/>
                                                <path fill='#EA4335' d='M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z'/>
                                            </svg>
                                            Login with Google
                                        </button>
                                    </section>
                                )}

                                {loginMode === 'face' && (
                                    <section className='login-mode-card login-mode-card--face' aria-label='Face login'>
                                        <div className='login-mode-head'>
                                            <h3>Face Login</h3>
                                            <p>Scan your face for quick login.</p>
                                        </div>

                                        {!faceCameraOpen && (
                                            <button
                                                type='button'
                                                onClick={openFaceCamera}
                                                className='face-open-btn'
                                                disabled={loading || faceLoading}
                                            >
                                                {faceLoading ? 'Opening camera...' : 'Open Face Camera'}
                                            </button>
                                        )}

                                        {faceCameraOpen && (
                                            <div className='face-login-panel'>
                                                <div className='face-video-wrap'>
                                                    <video
                                                        ref={faceVideoRef}
                                                        autoPlay
                                                        muted
                                                        playsInline
                                                        className='face-video'
                                                    />
                                                    {!faceCameraReady && (
                                                        <span className='face-video-status'>
                                                            {faceLoading ? 'Opening camera...' : 'Waiting for camera...'}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className='face-login-actions'>
                                                    <button
                                                        type='button'
                                                        onClick={handleFaceLogin}
                                                        className='login-btn'
                                                        disabled={loading || faceLoading || !faceCameraReady}
                                                    >
                                                        {faceLoading
                                                            ? (faceCameraReady ? 'Scanning...' : 'Opening...')
                                                            : 'Scan & Login'}
                                                    </button>
                                                    <button
                                                        type='button'
                                                        onClick={closeFaceCamera}
                                                        className='face-cancel-btn'
                                                        disabled={loading || faceLoading}
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                                {faceMessage && (
                                                    <p className={`face-message face-message--${faceMessageType}`}>
                                                        {faceMessage}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </section>
                                )}
                            </div>

                            <div className='auth-links-row auth-links-row--single'>
                                <span>Need an account?</span>
                                <Link className='auth-link' to='/signup'>
                                    Create account
                                </Link>
                            </div>
                        </form>

                        <div className='login-card__footer'>
                            <p>Use email/password, Google, or face login.</p>
                        </div>
                    </div>
                </section>
            </div>

            <footer className='login-page__footer'>
                {new Date().getFullYear()} UniSphere. All rights reserved.
            </footer>
        </div>
    );
}

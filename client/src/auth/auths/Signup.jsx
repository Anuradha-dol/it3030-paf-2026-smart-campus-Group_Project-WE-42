import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api';
import {
    extractFaceDescriptor,
    getFaceCameraErrorMessage,
    loadFaceModels,
    startFaceCamera,
    stopFaceCamera,
} from '../../utils/faceRecognition';
import './Signup.css';

const yearOptions = ['FIRST', 'SECOND', 'THIRD', 'FOURTH'];
const semesterOptions = ['SEM1', 'SEM2'];

export default function Signup() {
    const navigate = useNavigate();
    const faceVideoRef = useRef(null);
    const faceStreamRef = useRef(null);
    const totalSteps = 3;

    const [form, setForm] = useState({
        firstName: '',
        lastName: '',
        email: '',
        tempEmail: '',
        phoneNumber: '',
        year: '',
        semester: '',
        password: '',
        confirmPassword: '',
    });
    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [faceLoading, setFaceLoading] = useState(false);
    const [faceDescriptor, setFaceDescriptor] = useState(null);
    const [faceMessage, setFaceMessage] = useState('');
    const [faceCameraOpen, setFaceCameraOpen] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleChange = (event) => {
        const { name, value } = event.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const validateStepOne = () => {
        if (!form.firstName.trim()) {
            setError('First name is required.');
            return false;
        }

        if (!form.lastName.trim()) {
            setError('Last name is required.');
            return false;
        }

        if (!form.email.trim()) {
            setError('University email is required.');
            return false;
        }

        if (!form.tempEmail.trim()) {
            setError('Recovery email is required.');
            return false;
        }

        return true;
    };

    const validateStepTwo = () => {
        if (!form.password) {
            setError('Password is required.');
            return false;
        }

        if (!form.confirmPassword) {
            setError('Confirm password is required.');
            return false;
        }

        if (form.password.length < 6) {
            setError('Password must be at least 6 characters.');
            return false;
        }

        if (form.password !== form.confirmPassword) {
            setError('Passwords do not match.');
            return false;
        }

        return true;
    };

    const goToNextStep = () => {
        // Validate current step before moving forward.
        setError('');
        setSuccess('');

        if (currentStep === 1 && !validateStepOne()) {
            return;
        }

        if (currentStep === 2 && !validateStepTwo()) {
            return;
        }

        setCurrentStep((prev) => Math.min(totalSteps, prev + 1));
    };

    const goToPreviousStep = () => {
        if (loading) {
            return;
        }

        setError('');
        setSuccess('');
        setCurrentStep((prev) => Math.max(1, prev - 1));
    };

    useEffect(() => {
        // Preload models once to reduce first capture delay.
        loadFaceModels().catch(() => {
            // Ignore preload failures; capture flow reports concrete errors.
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
            try {
                const stream = await startFaceCamera(videoElement);
                if (cancelled) {
                    stopFaceCamera(videoElement, stream);
                    return;
                }
                faceStreamRef.current = stream;
            } catch (cameraError) {
                if (cancelled) {
                    return;
                }
                setFaceCameraOpen(false);
                setError(getFaceCameraErrorMessage(cameraError));
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

    const openFaceCamera = () => {
        if (faceLoading) {
            return;
        }

        setError('');
        setFaceMessage('');
        setFaceCameraOpen(true);
    };

    const closeFaceCamera = () => {
        stopFaceCamera(faceVideoRef.current, faceStreamRef.current);
        faceStreamRef.current = null;
        setFaceCameraOpen(false);
    };

    const handleCaptureFace = async () => {
        if (!faceCameraOpen || faceLoading) {
            return;
        }

        setError('');
        setFaceMessage('');
        setFaceLoading(true);

        try {
            const descriptor = await extractFaceDescriptor(faceVideoRef.current);
            setFaceDescriptor(descriptor);
            setFaceMessage('Face captured successfully.');
            closeFaceCamera();
        } catch (captureError) {
            setError(captureError?.message || 'Face capture failed. Please try again.');
        } finally {
            setFaceLoading(false);
        }
    };

    const handleFormKeyDown = (event) => {
        if (event.key !== 'Enter') {
            return;
        }

        event.preventDefault();

        if (loading) {
            return;
        }

        if (currentStep < totalSteps) {
            goToNextStep();
        }
    };

    const handleSubmit = async () => {
        if (loading) {
            return;
        }

        setError('');
        setSuccess('');

        if (currentStep < totalSteps) {
            goToNextStep();
            return;
        }

        if (!validateStepOne()) {
            setCurrentStep(1);
            return;
        }

        if (!validateStepTwo()) {
            setCurrentStep(2);
            return;
        }

        if (!faceDescriptor) {
            setCurrentStep(3);
            setError('Please capture your face to enable face login.');
            return;
        }

        setLoading(true);

        try {
            // Normalize optional fields before API call.
            const trimmedPhone = form.phoneNumber.trim();
            const trimmedYear = form.year.trim();
            const trimmedSemester = form.semester.trim();

            if (trimmedPhone) {
                // Block duplicate phone numbers early.
                const phoneCheck = await api.post('/auth/check-phone', {
                    phoneNumber: trimmedPhone,
                });

                if (!phoneCheck.data?.available) {
                    setError('Phone number already exists.');
                    return;
                }
            }

            const response = await api.post('/auth/register', {
                firstname: form.firstName.trim(),
                lastName: form.lastName.trim(),
                email: form.email.trim(),
                tempEmail: form.tempEmail.trim(),
                phoneNumber: trimmedPhone || null,
                role: 'USER',
                year: trimmedYear || null,
                semester: trimmedSemester || null,
                faceDescriptor,
                password: form.password,
            });

            if (!response.data?.success) {
                setError(response.data?.message || 'Signup failed.');
                return;
            }

            // Backend stores email in cookie for OTP verification.
            setSuccess('Registration successful. Enter OTP to verify your account.');
            navigate('/verify', { state: { email: form.email.trim() } });
        } catch (err) {
            const apiMessage = err.response?.data?.message;
            const apiDetail = err.response?.data?.detail;
            setError(apiMessage || apiDetail || 'Signup failed.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className='signup-page'>
            <div className='signup-page__canvas' />

            <div className='signup-layout'>
                <section className='signup-showcase' aria-hidden='true'>
                    <div className='signup-showcase__photo'>
                        <div className='signup-showcase__top'>
                            <strong>UniSphere Spaces</strong>
                            <div className='signup-showcase__actions'>
                                <span>Create Access</span>
                                <span className='join-pill'>Get Started</span>
                            </div>
                        </div>

                        <div className='signup-showcase__bottom'>
                            <div className='signup-showcase__profile'>
                                <span className='signup-showcase__avatar'>U</span>
                                <div>
                                    <p>UniSphere</p>
                                    <small>Secure Student Registration</small>
                                </div>
                            </div>

                            <div className='signup-showcase__arrows'>
                                <span>&larr;</span>
                                <span>&rarr;</span>
                            </div>
                        </div>
                    </div>
                </section>

                <section className='signup-card-wrap'>
                    <div className='signup-card'>
                        <div className='signup-card__topbar'>
                            <strong className='signup-brand'>UniSphere</strong>
                            <span className='lang-pill'>EN</span>
                        </div>

                        <div className='signup-card__header'>
                            <h2>Create your account</h2>
                            <p>Register to access UniSphere resources and services</p>
                        </div>

                        <div className='signup-steps' aria-label='Signup steps'>
                            <div className={`signup-step${currentStep >= 1 ? ' active' : ''}`}>
                                <span>1</span>
                                <small>Basic Info</small>
                            </div>
                            <div className='signup-step-connector' />
                            <div className={`signup-step${currentStep >= 2 ? ' active' : ''}`}>
                                <span>2</span>
                                <small>Security</small>
                            </div>
                            <div className='signup-step-connector' />
                            <div className={`signup-step${currentStep >= 3 ? ' active' : ''}`}>
                                <span>3</span>
                                <small>Optional Details</small>
                            </div>
                        </div>

                        <form
                            className='signup-form'
                            onSubmit={(event) => event.preventDefault()}
                            onKeyDown={handleFormKeyDown}
                            noValidate
                        >
                            {error && <div className='message error'>{error}</div>}
                            {success && <div className='message success'>{success}</div>}

                            {currentStep === 1 && (
                                <div className='step-panel'>
                                    <p className='step-panel__hint'>
                                        Step 1 of 3: Fill your required account details.
                                    </p>
                                    <div className='signup-grid'>
                                        <label className='form-group'>
                                            <span>First Name (Required)</span>
                                            <input
                                                name='firstName'
                                                value={form.firstName}
                                                onChange={handleChange}
                                                required
                                            />
                                        </label>

                                        <label className='form-group'>
                                            <span>Last Name (Required)</span>
                                            <input
                                                name='lastName'
                                                value={form.lastName}
                                                onChange={handleChange}
                                                required
                                            />
                                        </label>

                                        <label className='form-group'>
                                            <span>University Email (Required)</span>
                                            <input
                                                name='email'
                                                type='email'
                                                placeholder='IT23687882@my.sliit.lk'
                                                value={form.email}
                                                onChange={handleChange}
                                                required
                                            />
                                        </label>

                                        <label className='form-group'>
                                            <span>Recovery Email (Required)</span>
                                            <input
                                                name='tempEmail'
                                                type='email'
                                                placeholder='your-backup-email@example.com'
                                                value={form.tempEmail}
                                                onChange={handleChange}
                                                required
                                            />
                                        </label>

                                    </div>
                                </div>
                            )}

                            {currentStep === 2 && (
                                <div className='step-panel'>
                                    <p className='step-panel__hint'>
                                        Step 2 of 3: Set a secure password.
                                    </p>
                                    <div className='signup-grid'>
                                        <label className='form-group'>
                                            <span>Password (Required)</span>
                                            <input
                                                name='password'
                                                type='password'
                                                value={form.password}
                                                onChange={handleChange}
                                                required
                                            />
                                        </label>

                                        <label className='form-group'>
                                            <span>Confirm Password (Required)</span>
                                            <input
                                                name='confirmPassword'
                                                type='password'
                                                value={form.confirmPassword}
                                                onChange={handleChange}
                                                required
                                            />
                                        </label>
                                    </div>
                                </div>
                            )}

                            {currentStep === 3 && (
                                <div className='step-panel'>
                                    <p className='step-panel__hint'>
                                        Step 3 of 3: Add optional details and capture your face.
                                    </p>
                                    <div className='signup-grid'>
                                        <label className='form-group'>
                                            <span>Phone Number (Optional)</span>
                                            <input
                                                name='phoneNumber'
                                                placeholder='07XXXXXXXX'
                                                value={form.phoneNumber}
                                                onChange={handleChange}
                                            />
                                        </label>

                                        <label className='form-group'>
                                            <span>Year (Optional)</span>
                                            <select name='year' value={form.year} onChange={handleChange}>
                                                <option value=''>Select later</option>
                                                {yearOptions.map((year) => (
                                                    <option key={year} value={year}>
                                                        {year}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>

                                        <label className='form-group'>
                                            <span>Semester (Optional)</span>
                                            <select name='semester' value={form.semester} onChange={handleChange}>
                                                <option value=''>Select later</option>
                                                {semesterOptions.map((semester) => (
                                                    <option key={semester} value={semester}>
                                                        {semester}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                    </div>

                                    <div className='form-group' style={{ marginTop: '1rem' }}>
                                        <span>Face Capture (Required for face login)</span>
                                        {!faceCameraOpen && (
                                            <button
                                                className='signup-btn signup-btn-secondary'
                                                type='button'
                                                onClick={openFaceCamera}
                                                disabled={faceLoading}
                                                style={{ marginTop: '.5rem' }}
                                            >
                                                {faceDescriptor ? 'Retake Face' : 'Open Camera'}
                                            </button>
                                        )}

                                        {faceCameraOpen && (
                                            <div style={{ marginTop: '.75rem' }}>
                                                <video
                                                    ref={faceVideoRef}
                                                    autoPlay
                                                    muted
                                                    playsInline
                                                    style={{
                                                        width: '100%',
                                                        maxWidth: '360px',
                                                        borderRadius: '10px',
                                                        border: '1px solid rgba(0,0,0,.12)',
                                                    }}
                                                />
                                                <div style={{ display: 'flex', gap: '.5rem', marginTop: '.5rem' }}>
                                                    <button
                                                        className='signup-btn'
                                                        type='button'
                                                        onClick={handleCaptureFace}
                                                        disabled={faceLoading}
                                                    >
                                                        {faceLoading ? 'Scanning...' : 'Capture Face'}
                                                    </button>
                                                    <button
                                                        className='signup-btn signup-btn-secondary'
                                                        type='button'
                                                        onClick={closeFaceCamera}
                                                        disabled={faceLoading}
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {faceMessage && (
                                            <p style={{ marginTop: '.5rem', color: '#1e7a4d', fontSize: '.92rem' }}>
                                                {faceMessage}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className='signup-actions'>
                                {currentStep > 1 && (
                                    <button
                                        className='signup-btn signup-btn-secondary'
                                        type='button'
                                        onClick={goToPreviousStep}
                                        disabled={loading}
                                    >
                                        Back
                                    </button>
                                )}

                                {currentStep < totalSteps ? (
                                    <button
                                        className='signup-btn'
                                        type='button'
                                        onClick={goToNextStep}
                                        disabled={loading}
                                    >
                                        Next Step
                                    </button>
                                ) : (
                                    <button className='signup-btn' type='button' onClick={handleSubmit} disabled={loading}>
                                        {loading ? 'Creating account...' : 'Create Account'}
                                    </button>
                                )}
                            </div>
                        </form>

                        <div className='signup-card__footer'>
                            <p>
                                Already registered? <Link to='/login'>Go to login</Link>
                            </p>
                        </div>
                    </div>
                </section>
            </div>

            <footer className='signup-page__footer'>
                {new Date().getFullYear()} UniSphere. All rights reserved.
            </footer>
        </div>
    );
}

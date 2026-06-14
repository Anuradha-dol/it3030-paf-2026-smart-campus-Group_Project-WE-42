import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import './OAuth2Success.css';

export default function OAuth2Success() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('Processing OAuth2 login...');

    useEffect(() => {
        const handleOAuth2Success = async () => {
            try {
                // Read authenticated user from backend cookie session.
                const response = await api.get('/auth/me', {
                    withCredentials: true
                });

                if (response.data.authenticated) {
                    const user = response.data.user;
                    const role = String(user.role || '').toUpperCase();

                    setMessage('Login successful! Redirecting...');

                    // Route user by role after OAuth2 login.
                    setTimeout(() => {
                        if (role.includes('ADMIN')) {
                            navigate('/dashboard', { replace: true });
                        } else if (role.includes('TECHNICIAN')) {
                            navigate('/techhome', { replace: true });
                        } else {
                            navigate('/home', { replace: true });
                        }
                    }, 1000);
                } else {
                    setMessage('Authentication failed. Redirecting to login...');
                    setTimeout(() => {
                        navigate('/login', { replace: true });
                    }, 2000);
                }
            } catch (error) {
                console.error('OAuth2 success error:', error);
                setMessage('Authentication failed. Redirecting to login...');
                setTimeout(() => {
                    navigate('/login', { replace: true });
                }, 2000);
            } finally {
                setLoading(false);
            }
        };

        handleOAuth2Success();
    }, [navigate]);

    const normalizedMessage = message.toLowerCase();
    const isFailure = normalizedMessage.includes('failed');
    const isSuccess = normalizedMessage.includes('successful');
    const phase = isFailure ? 2 : isSuccess ? 3 : 2;
    const title = isFailure ? 'Authentication Failed' : isSuccess ? 'Login Confirmed' : 'Signing You In';
    const subMessage = isFailure
        ? 'We will safely redirect you to login.'
        : 'Please wait while we complete your secure redirect.';

    return (
        <div className='oauth2-flow'>
            <div className='oauth2-flow__bg' />

            <main className={`oauth2-shell ${isFailure ? 'is-error' : isSuccess ? 'is-success' : 'is-progress'}`}>
                <header className='oauth2-shell__head'>
                    <div className='brand-lockup'>
                        <span className='brand-badge'>U</span>
                        <div>
                            <strong>UniSphere</strong>
                            <p>OAuth2 Sign-In</p>
                        </div>
                    </div>
                    <span className='oauth2-chip'>Google</span>
                </header>

                <section className='oauth2-hero'>
                    <div className={`status-emblem ${loading ? 'is-loading' : isFailure ? 'is-error' : 'is-success'}`}>
                        {!loading && (isFailure ? '!' : 'OK')}
                    </div>
                    <div className='oauth2-copy'>
                        <h1>{title}</h1>
                        <p className='oauth2-copy__message'>{message}</p>
                        <p className='oauth2-copy__sub'>{subMessage}</p>
                    </div>
                </section>

                <section className='oauth2-progress' aria-label='Authentication progress'>
                    <div className='progress-track'>
                        <div className={`progress-fill step-${phase}`} />
                    </div>
                    <div className='progress-steps'>
                        <span className={phase >= 1 ? 'active' : ''}>Provider Auth</span>
                        <span className={phase >= 2 ? 'active' : ''}>Profile Check</span>
                        <span className={phase >= 3 ? 'active' : ''}>Redirect</span>
                    </div>
                </section>
            </main>

            <footer className='oauth2-flow__footer'>
                {new Date().getFullYear()} UniSphere. All rights reserved.
            </footer>
        </div>
    );
}

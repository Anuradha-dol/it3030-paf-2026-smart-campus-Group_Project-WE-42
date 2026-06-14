import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api';
import './ForgotPassword.css';

export default function ForgotPassword() {
    const navigate = useNavigate();

    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [timer, setTimer] = useState(0);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const [form, setForm] = useState({
        email: '',
        otp: '',
        password: '',
        repeatPassword: '',
    });

    useEffect(() => {
        if (timer <= 0) {
            return undefined;
        }

        // Simple resend countdown timer.
        const timeout = setTimeout(() => setTimer((prev) => prev - 1), 1000);
        return () => clearTimeout(timeout);
    }, [timer]);

    const handleChange = (event) => {
        const { name, value } = event.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const sendOtp = async () => {
        setError('');
        setMessage('');

        if (!form.email.trim()) {
            setError('Email is required.');
            return;
        }

        setLoading(true);

        try {
            // Start forgot-password flow by email.
            const response = await api.post('/forgotpass/send-otp', {
                email: form.email.trim(),
            });

            setMessage(response.data || 'OTP sent.');
            setStep(2);
            setTimer(60);
        } catch (err) {
            setError(err.response?.data || 'Failed to send OTP.');
        } finally {
            setLoading(false);
        }
    };

    const verifyOtp = async () => {
        setError('');
        setMessage('');

        if (!form.otp.trim()) {
            setError('OTP is required.');
            return;
        }

        setLoading(true);

        try {
            // Verify OTP and let backend issue verify JWT cookie.
            const response = await api.post('/forgotpass/verify-otp', {
                otp: form.otp.trim(),
            });

            setMessage(response.data || 'OTP verified.');
            setStep(3);
        } catch (err) {
            setError(err.response?.data || 'OTP verification failed.');
        } finally {
            setLoading(false);
        }
    };

    const resendOtp = async () => {
        setError('');
        setMessage('');
        setLoading(true);

        try {
            // Resend OTP while server tracks resend limits.
            const response = await api.post('/forgotpass/resend-otp');
            setMessage(response.data || 'OTP resent.');
            setTimer(60);
        } catch (err) {
            setError(err.response?.data || 'Failed to resend OTP.');
        } finally {
            setLoading(false);
        }
    };

    const resetPassword = async () => {
        setError('');
        setMessage('');

        if (!form.password || form.password.length < 6) {
            setError('Password must be at least 6 characters.');
            return;
        }

        if (form.password !== form.repeatPassword) {
            setError('Passwords do not match.');
            return;
        }

        setLoading(true);

        try {
            // Change password using verify token cookie.
            const response = await api.post('/forgotpass/change-password', {
                password: form.password,
                repeatPassword: form.repeatPassword,
            });

            setMessage(response.data || 'Password changed successfully.');
            setTimeout(() => navigate('/login'), 900);
        } catch (err) {
            setError(err.response?.data || 'Failed to change password.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className='forgot-page'>
            <div className='forgot-page__canvas' />

            <div className='forgot-layout'>
                <section className='forgot-showcase' aria-hidden='true'>
                    <div className='forgot-showcase__photo'>
                        <div className='forgot-showcase__top'>
                            <strong>Account Recovery</strong>
                            <div className='forgot-showcase__actions'>
                                <span>Secure</span>
                                <span className='join-pill'>3 Steps</span>
                            </div>
                        </div>

                        <div className='forgot-showcase__bottom'>
                            <div className='forgot-showcase__profile'>
                                <span className='forgot-showcase__avatar'>U</span>
                                <div>
                                    <p>UniSphere</p>
                                    <small>Password Reset Portal</small>
                                </div>
                            </div>

                            <div className='forgot-showcase__arrows'>
                                <span>&larr;</span>
                                <span>&rarr;</span>
                            </div>
                        </div>
                    </div>
                </section>

                <section className='forgot-card-wrap'>
                    <div className='forgot-card'>
                        <div className='forgot-card__topbar'>
                            <strong className='forgot-brand'>UniSphere</strong>
                            <span className='lang-pill'>EN</span>
                        </div>

                        <div className='forgot-card__header'>
                            <h2>Forgot Password</h2>
                            <p>Recover your account in three quick steps</p>
                        </div>

                        <div className='forgot-steps' aria-label='Recovery progress'>
                            <span className={step >= 1 ? 'active' : ''}>1. Email</span>
                            <span className={step >= 2 ? 'active' : ''}>2. OTP</span>
                            <span className={step >= 3 ? 'active' : ''}>3. Reset</span>
                        </div>

                        {error && <div className='message error'>{error}</div>}
                        {message && <div className='message success'>{message}</div>}

                        {step === 1 && (
                            <div className='forgot-form'>
                                <label className='form-group'>
                                    <span>Email</span>
                                    <input
                                        name='email'
                                        type='email'
                                        placeholder='your-email@my.sliit.lk'
                                        value={form.email}
                                        onChange={handleChange}
                                    />
                                </label>

                                <button className='forgot-btn forgot-btn--primary' type='button' onClick={sendOtp} disabled={loading}>
                                    {loading ? 'Sending...' : 'Send OTP'}
                                </button>
                            </div>
                        )}

                        {step === 2 && (
                            <div className='forgot-form'>
                                <label className='form-group'>
                                    <span>OTP</span>
                                    <input
                                        name='otp'
                                        placeholder='Enter OTP'
                                        value={form.otp}
                                        onChange={handleChange}
                                    />
                                </label>

                                <button className='forgot-btn forgot-btn--primary' type='button' onClick={verifyOtp} disabled={loading}>
                                    {loading ? 'Verifying...' : 'Verify OTP'}
                                </button>

                                <button
                                    className='forgot-btn forgot-btn--secondary'
                                    type='button'
                                    onClick={resendOtp}
                                    disabled={loading || timer > 0}
                                >
                                    {timer > 0 ? `Resend in ${timer}s` : 'Resend OTP'}
                                </button>
                            </div>
                        )}

                        {step === 3 && (
                            <div className='forgot-form'>
                                <label className='form-group'>
                                    <span>New Password</span>
                                    <input
                                        name='password'
                                        type='password'
                                        value={form.password}
                                        onChange={handleChange}
                                    />
                                </label>

                                <label className='form-group'>
                                    <span>Repeat Password</span>
                                    <input
                                        name='repeatPassword'
                                        type='password'
                                        value={form.repeatPassword}
                                        onChange={handleChange}
                                    />
                                </label>

                                <button className='forgot-btn forgot-btn--primary' type='button' onClick={resetPassword} disabled={loading}>
                                    {loading ? 'Saving...' : 'Change Password'}
                                </button>
                            </div>
                        )}

                        <div className='forgot-card__footer'>
                            <p>
                                Back to <Link to='/login'>login</Link>
                            </p>
                        </div>
                    </div>
                </section>
            </div>

            <footer className='forgot-page__footer'>
                {new Date().getFullYear()} UniSphere. All rights reserved.
            </footer>
        </div>
    );
}

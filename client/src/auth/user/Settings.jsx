import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../../api';
import './Settings.css';

function getRoleHomePath(role) {
    const normalized = normalizeRole(role);

    if (normalized.includes('ADMIN')) {
        return '/dashboard';
    }

    if (normalized.includes('TECHNICIAN')) {
        return '/techome';
    }

    return '/home';
}

function normalizeRole(role) {
    return String(role || '').replace('ROLE_', '').toUpperCase();
}

function getRoleNavigationLinks(role) {
    const normalized = normalizeRole(role);

    if (normalized.includes('ADMIN')) {
        return [
            { label: 'All Tickets', description: 'View every ticket', to: '/admin/tickets', icon: 'ticket' },
            { label: 'All Bookings', description: 'View every booking', to: '/admin/bookings', icon: 'history' },
        ];
    }

    if (normalized.includes('TECHNICIAN')) {
        return [
            { label: 'Work Appointments', description: 'Assigned appointments', to: '/technician/appointments', icon: 'appointment' },
            { label: 'Completed Works', description: 'Finished work list', to: '/technician/completed-works', icon: 'completed' },
        ];
    }

    return [
        { label: 'Tickets', description: 'Your ticket requests', to: '/tickets', icon: 'ticket' },
        { label: 'Bookings', description: 'Create new booking', to: '/bookings', icon: 'booking' },
        { label: 'View Bookings', description: 'Your booking history', to: '/bookings/my', icon: 'history' },
    ];
}

function renderRoleNavIcon(icon) {
    if (icon === 'booking') {
        return (
            <svg viewBox='0 0 24 24' role='img' aria-hidden='true' focusable='false'>
                <path d='M7 3v2M17 3v2M4 9h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z' />
                <path d='M12 12v5M9.5 14.5h5' />
            </svg>
        );
    }

    if (icon === 'history') {
        return (
            <svg viewBox='0 0 24 24' role='img' aria-hidden='true' focusable='false'>
                <path d='M3 12a9 9 0 1 0 3-6.7' />
                <path d='M3 4v4h4M12 7v5l3 2' />
            </svg>
        );
    }

    if (icon === 'appointment') {
        return (
            <svg viewBox='0 0 24 24' role='img' aria-hidden='true' focusable='false'>
                <path d='M7 3v2M17 3v2M4 9h16M6 5h12a2 2 0 0 1 2 2v4.5M4 12V7a2 2 0 0 1 2-2' />
                <path d='m14.5 16.5 2 2 4-4' />
                <circle cx='17.5' cy='17.5' r='4.5' />
            </svg>
        );
    }

    if (icon === 'completed') {
        return (
            <svg viewBox='0 0 24 24' role='img' aria-hidden='true' focusable='false'>
                <circle cx='12' cy='12' r='9' />
                <path d='m8.5 12.5 2.3 2.3 4.8-4.8' />
            </svg>
        );
    }

    return (
        <svg viewBox='0 0 24 24' role='img' aria-hidden='true' focusable='false'>
            <path d='M4 7.5h16v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z' />
            <path d='M9 7.5V6a3 3 0 0 1 6 0v1.5M10 12h4' />
        </svg>
    );
}

function buildAssetUrl(path) {
    if (!path) {
        return '';
    }

    if (path.startsWith('http://') || path.startsWith('https://')) {
        return path;
    }

    return `${api.defaults.baseURL}${path}`;
}

const toast = {
    success: (message) => {
        if (message) {
            console.log(message);
        }
    },
    error: (message) => {
        const text = typeof message === 'string' ? message : 'Operation failed.';
        console.error(text);
    },
};

export default function Settings() {
    const navigate = useNavigate();
    const location = useLocation();

    const [initialLoading, setInitialLoading] = useState(true);
    const [working, setWorking] = useState(false);
    const [now, setNow] = useState(() => new Date());
    const [showPassword, setShowPassword] = useState({
        current: false,
        next: false,
        confirm: false,
    });
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deletePassword, setDeletePassword] = useState('');
    const [showDeletePassword, setShowDeletePassword] = useState(false);

    const [user, setUser] = useState({
        firstName: '',
        lastName: '',
        email: '',
        role: '',
        provider: '',
        profileImageUrl: '',
        coverImageUrl: '',
    });

    const [nameForm, setNameForm] = useState({ firstName: '', lastName: '' });
    const [emailForm, setEmailForm] = useState({ newEmail: '', otp: '' });
    const [passwordForm, setPasswordForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });
    const [profileFile, setProfileFile] = useState(null);
    const [coverFile, setCoverFile] = useState(null);

    const calendarYear = now.getFullYear();
    const calendarMonth = now.getMonth();
    const calendarLabel = now.toLocaleString('default', { month: 'long', year: 'numeric' });
    const clockLabel = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const calendarFirstDay = new Date(calendarYear, calendarMonth, 1).getDay();
    const calendarDaysCount = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const calendarCells = [
        ...Array.from({ length: calendarFirstDay }, () => null),
        ...Array.from({ length: calendarDaysCount }, (_, index) => index + 1),
    ];
    const roleNavigationLinks = getRoleNavigationLinks(user.role);

    const loadProfile = async () => {
        try {
            let response;

            try {
                response = await api.get('/user/me');
            } catch (err) {
                if (err.response?.status === 403) {
                    response = await api.get('/user/Admin/me');
                } else {
                    throw err;
                }
            }

            const data = response.data;
            const firstName = data.name || data.firstname || '';
            const lastName = data.lastName || '';
            let provider = '';

            try {
                const authMeResponse = await api.get('/auth/me');
                provider = String(
                    authMeResponse?.data?.provider || authMeResponse?.data?.user?.provider || ''
                ).toUpperCase();
            } catch (providerErr) {
                console.log('Provider fetch skipped:', providerErr?.message);
            }

            setUser({
                firstName,
                lastName,
                email: data.email || '',
                role: normalizeRole(data.role),
                provider,
                profileImageUrl: data.profileImageUrl || '',
                coverImageUrl: data.coverImageUrl || '',
            });

            setNameForm({
                firstName,
                lastName,
            });
        } catch (err) {
            const status = err.response?.status;
            if (status === 401 || status === 403) {
                navigate('/login');
                return;
            }

            toast.error(err.response?.data?.message || 'Failed to load settings.');
        } finally {
            setInitialLoading(false);
        }
    };

    useEffect(() => {
        loadProfile();
    }, []);

    useEffect(() => {
        const timer = setInterval(() => {
            setNow(new Date());
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    const updateName = async () => {
        if (!nameForm.firstName.trim() || !nameForm.lastName.trim()) {
            toast.error('First name and last name are required.');
            return;
        }

        setWorking(true);
        try {
            await api.put('/user/update-name', {
                name: nameForm.firstName.trim(),
                lastName: nameForm.lastName.trim(),
            });

            toast.success('Name updated successfully.');
            setUser((prev) => ({
                ...prev,
                firstName: nameForm.firstName.trim(),
                lastName: nameForm.lastName.trim(),
            }));
        } catch (err) {
            toast.error(err.response?.data?.message || err.response?.data || 'Failed to update name.');
        } finally {
            setWorking(false);
        }
    };

    const requestEmailChange = async () => {
        if (!emailForm.newEmail.trim()) {
            toast.error('New email is required.');
            return;
        }

        setWorking(true);
        try {
            const response = await api.put('/user/update-email', {
                newEmail: emailForm.newEmail.trim(),
            });
            toast.success(response.data || 'OTP sent to your new email.');
        } catch (err) {
            toast.error(err.response?.data?.message || err.response?.data || 'Failed to send OTP.');
        } finally {
            setWorking(false);
        }
    };

    const verifyEmailChange = async () => {
        if (!emailForm.otp.trim()) {
            toast.error('OTP is required.');
            return;
        }

        setWorking(true);
        try {
            const response = await api.post('/user/verify-new-email', null, {
                params: { otp: emailForm.otp.trim() },
            });

            toast.success(response.data || 'Email updated. Please login again.');

            try {
                await api.post('/auth/logout', {}, { withCredentials: true });
            } catch (err) {
                console.log('Logout error:', err.message);
            }
            navigate('/login', { replace: true });
        } catch (err) {
            toast.error(err.response?.data?.message || err.response?.data || 'Failed to verify OTP.');
        } finally {
            setWorking(false);
        }
    };

    const updatePassword = async () => {
        if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
            toast.error('All password fields are required.');
            return;
        }

        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            toast.error('New password and confirm password must match.');
            return;
        }

        setWorking(true);
        try {
            const response = await api.put('/user/update-password', passwordForm);
            toast.success(response.data || 'Password updated successfully.');
            setPasswordForm({
                currentPassword: '',
                newPassword: '',
                confirmPassword: '',
            });
        } catch (err) {
            toast.error(err.response?.data?.message || err.response?.data || 'Failed to update password.');
        } finally {
            setWorking(false);
        }
    };

    const deleteAccount = async () => {
        const isOAuthUser = Boolean(user.provider) && user.provider !== 'LOCAL';
        const currentPassword = deletePassword.trim();

        if (!isOAuthUser && !currentPassword) {
            toast.error('Current password is required to delete account.');
            return;
        }

        setWorking(true);
        try {
            const response = isOAuthUser
                ? await api.delete('/user/delete-oauth')
                : await api.delete('/user/delete', {
                    data: { currentPassword },
                });

            toast.success(response.data || 'Account deleted.');
            setDeleteModalOpen(false);
            setDeletePassword('');
            setShowDeletePassword(false);

            navigate('/login', { replace: true });
        } catch (err) {
            toast.error(err.response?.data?.message || err.response?.data || 'Failed to delete account.');
        } finally {
            setWorking(false);
        }
    };

    const openDeleteModal = () => {
        setDeletePassword('');
        setShowDeletePassword(false);
        setDeleteModalOpen(true);
    };

    const closeDeleteModal = () => {
        if (working) {
            return;
        }

        setDeleteModalOpen(false);
        setDeletePassword('');
        setShowDeletePassword(false);
    };

    const uploadImage = async (type) => {
        const file = type === 'profile' ? profileFile : coverFile;

        if (!file) {
            toast.error('Choose an image first.');
            return;
        }

        setWorking(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const endpoint =
                type === 'profile' ? '/user/upload-profile-image' : '/user/upload-cover-image';

            const response = await api.post(endpoint, formData);
            const imagePath = typeof response.data === 'string' ? response.data : '';

            if (type === 'profile') {
                setUser((prev) => ({ ...prev, profileImageUrl: imagePath }));
                setProfileFile(null);
            } else {
                setUser((prev) => ({ ...prev, coverImageUrl: imagePath }));
                setCoverFile(null);
            }

            toast.success('Image uploaded successfully.');
        } catch (err) {
            toast.error(err.response?.data?.message || err.response?.data || 'Image upload failed.');
        } finally {
            setWorking(false);
        }
    };

    if (initialLoading) {
        return (
            <div className='settings-page settings-loading'>
                <div className='spinner' />
                <p>Loading settings...</p>
            </div>
        );
    }

    return (
        <div className='settings-page'>
            <div className='settings-page__canvas' />

            <div className='settings-workbench'>
                <aside className='settings-sidebar-enhanced'>
                    <div className='sidebar-header-enhanced'>
                        <div className='sidebar-brand-enhanced'>
                            <span className='brand-avatar-enhanced'>
                                {user.profileImageUrl ? (
                                    <img
                                        src={buildAssetUrl(user.profileImageUrl)}
                                        alt='Profile avatar'
                                    />
                                ) : (
                                    (user.firstName?.[0] || 'U').toUpperCase()
                                )}
                            </span>
                            <div className='brand-info-enhanced'>
                                <strong>{user.firstName || 'User'} {user.lastName || ''}</strong>
                                <small>{user.email || 'No email'}</small>
                            </div>
                        </div>
                    </div>

                    <nav className='sidebar-nav-enhanced'>
                        <p className='nav-label'>Quick Navigation</p>
                        <Link className='nav-item-enhanced' to={getRoleHomePath(user.role)}>
                            Home
                        </Link>
                        <Link className='nav-item-enhanced' to='/profile'>
                            Profile
                        </Link>
                        <Link className='nav-item-enhanced active' to='/settings'>
                            Settings
                        </Link>
                    </nav>

                    <div className='sidebar-divider-enhanced' />

                    <div className='sidebar-info-enhanced'>
                        <p className='info-label'>Account Info</p>
                        <div className='info-item'>
                            <span className='item-label'>Role</span>
                            <strong className='item-value'>{user.role || 'USER'}</strong>
                        </div>
                        <div className='info-item'>
                            <span className='item-label'>Login Type</span>
                            <strong className='item-value'>{user.provider || 'LOCAL'}</strong>
                        </div>
                        <div className='info-item'>
                            <span className='item-label'>Email</span>
                            <strong className='item-value email-value'>{user.email || '-'}</strong>
                        </div>
                    </div>

                    <div className='sidebar-calendar-enhanced'>
                        <p className='calendar-label'>Calendar</p>
                        <div className='calendar-header-enhanced'>
                            <strong>{calendarLabel}</strong>
                            <span className='today-badge'>Today {now.getDate()}</span>
                        </div>
                        <div className='sidebar-clock'>{clockLabel}</div>
                        <div className='calendar-grid-enhanced'>
                            <div className='calendar-weekdays-enhanced'>
                                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                                    <span key={day} className='weekday'>{day}</span>
                                ))}
                            </div>
                            <div className='calendar-days-enhanced'>
                                {calendarCells.map((day, index) => (
                                    <span
                                        key={`day-${index}`}
                                        className={`day${day === null ? ' empty' : ''}${day === now.getDate() ? ' today' : ''}`}
                                        aria-hidden={day === null}
                                    >
                                        {day ?? ''}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </aside>

                <main className='settings-main'>
                    <header className='settings-main__header'>
                        <div className='settings-header__title'>
                            <h1>Preferences</h1>
                            <p>Manage profile, credentials, image uploads, and account security.</p>

                            <div className='settings-role-nav-inline'>
                                {roleNavigationLinks.map((item) => (
                                    <Link
                                        key={item.to}
                                        className={`settings-role-nav-link${location.pathname === item.to ? ' active' : ''}`}
                                        to={item.to}
                                    >
                                        <span className='settings-role-nav-icon'>
                                            {renderRoleNavIcon(item.icon)}
                                        </span>
                                        <span className='settings-role-nav-text'>
                                            <strong>{item.label}</strong>
                                            <small>{item.description}</small>
                                        </span>
                                    </Link>
                                ))}
                            </div>
                        </div>
                        <span className={`status-chip${working ? ' active' : ''}`}>
                            {working ? 'Processing...' : 'Ready'}
                        </span>
                    </header>

                    <section className='settings-section password-zone'>
                        <div className='section-header'>
                            <h3>Basic Profile</h3>
                            <p>Update your first and last name</p>
                        </div>
                        <div className='section-grid two-col name-grid'>
                            <label className='field'>
                                <span>First Name</span>
                                <input
                                    value={nameForm.firstName}
                                    onChange={(event) =>
                                        setNameForm((prev) => ({ ...prev, firstName: event.target.value }))
                                    }
                                />
                            </label>
                            <label className='field'>
                                <span>Last Name</span>
                                <input
                                    value={nameForm.lastName}
                                    onChange={(event) =>
                                        setNameForm((prev) => ({ ...prev, lastName: event.target.value }))
                                    }
                                />
                            </label>
                            <button className='btn btn-primary full' type='button' onClick={updateName} disabled={working}>
                                Save Name
                            </button>
                        </div>
                    </section>

                    <section className='settings-section'>
                        <div className='section-header'>
                            <h3>Email Update</h3>
                            <p>Current email: {user.email || '-'}</p>
                        </div>
                        <div className='section-grid two-col email-grid'>
                            <label className='field'>
                                <span>New Email</span>
                                <input
                                    type='email'
                                    value={emailForm.newEmail}
                                    onChange={(event) =>
                                        setEmailForm((prev) => ({ ...prev, newEmail: event.target.value }))
                                    }
                                />
                            </label>
                            <button
                                className='btn btn-secondary'
                                type='button'
                                onClick={requestEmailChange}
                                disabled={working}
                            >
                                Send OTP
                            </button>
                            <label className='field'>
                                <span>Email OTP</span>
                                <input
                                    value={emailForm.otp}
                                    onChange={(event) =>
                                        setEmailForm((prev) => ({ ...prev, otp: event.target.value }))
                                    }
                                />
                            </label>
                            <button
                                className='btn btn-primary'
                                type='button'
                                onClick={verifyEmailChange}
                                disabled={working}
                            >
                                Verify Email
                            </button>
                        </div>
                    </section>

                    <section className='settings-section'>
                        <div className='section-header'>
                            <h3>Password</h3>
                            <p>Keep your account protected with a strong password</p>
                        </div>
                        <div className='section-grid password-grid'>
                            <label className='field'>
                                <span>Current Password</span>
                                <div className='password-wrap'>
                                    <input
                                        type={showPassword.current ? 'text' : 'password'}
                                        value={passwordForm.currentPassword}
                                        onChange={(event) =>
                                            setPasswordForm((prev) => ({
                                                ...prev,
                                                currentPassword: event.target.value,
                                            }))
                                        }
                                    />
                                    <button
                                        type='button'
                                        className='show-btn'
                                        onClick={() =>
                                            setShowPassword((prev) => ({ ...prev, current: !prev.current }))
                                        }
                                    >
                                        {showPassword.current ? 'Hide' : 'Show'}
                                    </button>
                                </div>
                            </label>
                            <label className='field'>
                                <span>New Password</span>
                                <div className='password-wrap'>
                                    <input
                                        type={showPassword.next ? 'text' : 'password'}
                                        value={passwordForm.newPassword}
                                        onChange={(event) =>
                                            setPasswordForm((prev) => ({
                                                ...prev,
                                                newPassword: event.target.value,
                                            }))
                                        }
                                    />
                                    <button
                                        type='button'
                                        className='show-btn'
                                        onClick={() =>
                                            setShowPassword((prev) => ({ ...prev, next: !prev.next }))
                                        }
                                    >
                                        {showPassword.next ? 'Hide' : 'Show'}
                                    </button>
                                </div>
                            </label>
                            <label className='field'>
                                <span>Confirm Password</span>
                                <div className='password-wrap'>
                                    <input
                                        type={showPassword.confirm ? 'text' : 'password'}
                                        value={passwordForm.confirmPassword}
                                        onChange={(event) =>
                                            setPasswordForm((prev) => ({
                                                ...prev,
                                                confirmPassword: event.target.value,
                                            }))
                                        }
                                    />
                                    <button
                                        type='button'
                                        className='show-btn'
                                        onClick={() =>
                                            setShowPassword((prev) => ({ ...prev, confirm: !prev.confirm }))
                                        }
                                    >
                                        {showPassword.confirm ? 'Hide' : 'Show'}
                                    </button>
                                </div>
                            </label>
                            <button
                                className='btn btn-primary'
                                type='button'
                                onClick={updatePassword}
                                disabled={working}
                            >
                                Save Password
                            </button>
                        </div>
                    </section>

                    <section className='settings-section'>
                        <div className='section-header'>
                            <h3>Profile Images</h3>
                            <p>Upload profile and cover visuals</p>
                        </div>
                        <div className='media-grid'>
                            <article className='media-card profile-card'>
                                <div className='image-shell'>
                                    <p className='image-label'>Profile Preview</p>
                                    <div className='image-preview profile'>
                                        {user.profileImageUrl ? (
                                            <img src={buildAssetUrl(user.profileImageUrl)} alt='Profile preview' />
                                        ) : (
                                            <span>No profile image</span>
                                        )}
                                    </div>
                                </div>
                                <input
                                    className='file-input'
                                    type='file'
                                    accept='image/*'
                                    onChange={(event) => setProfileFile(event.target.files?.[0] || null)}
                                />
                                <small className='file-note'>
                                    {profileFile ? profileFile.name : 'Select JPG or PNG image'}
                                </small>
                                <button
                                    className='btn btn-secondary'
                                    type='button'
                                    onClick={() => uploadImage('profile')}
                                    disabled={working}
                                >
                                    Upload Profile
                                </button>
                            </article>

                            <article className='media-card cover-card'>
                                <div className='image-shell'>
                                    <p className='image-label'>Cover Preview</p>
                                    <div className='image-preview cover'>
                                        {user.coverImageUrl ? (
                                            <img src={buildAssetUrl(user.coverImageUrl)} alt='Cover preview' />
                                        ) : (
                                            <span>No cover image</span>
                                        )}
                                    </div>
                                </div>
                                <input
                                    className='file-input'
                                    type='file'
                                    accept='image/*'
                                    onChange={(event) => setCoverFile(event.target.files?.[0] || null)}
                                />
                                <small className='file-note'>
                                    {coverFile ? coverFile.name : 'Recommended wide image for best result'}
                                </small>
                                <button
                                    className='btn btn-secondary'
                                    type='button'
                                    onClick={() => uploadImage('cover')}
                                    disabled={working}
                                >
                                    Upload Cover
                                </button>
                            </article>
                        </div>
                    </section>

                    <section className='settings-section danger-zone'>
                        <div className='section-header'>
                            <h3>Delete Account</h3>
                            <p>This action cannot be undone</p>
                        </div>
                        <button className='btn btn-danger' type='button' onClick={openDeleteModal} disabled={working}>
                            Delete Account
                        </button>
                    </section>
                </main>
            </div>

            {deleteModalOpen && (
                <div className='settings-modal-backdrop' onClick={closeDeleteModal}>
                    <div
                        className='settings-modal-card'
                        role='dialog'
                        aria-modal='true'
                        aria-label='Delete account confirmation'
                        onClick={(event) => event.stopPropagation()}
                    >
                        <h3>Confirm Account Deletion</h3>
                        {Boolean(user.provider) && user.provider !== 'LOCAL' ? (
                            <p>
                                OAuth account detected ({user.provider}). Password not required for delete.
                            </p>
                        ) : (
                            <>
                                <p>Enter your current password to continue.</p>
                                <label className='field'>
                                    <span>Current Password</span>
                                    <div className='delete-password-wrap'>
                                        <input
                                            type={showDeletePassword ? 'text' : 'password'}
                                            value={deletePassword}
                                            onChange={(event) => setDeletePassword(event.target.value)}
                                            autoFocus
                                        />
                                        <button
                                            type='button'
                                            className='show-btn'
                                            onClick={() => setShowDeletePassword((prev) => !prev)}
                                        >
                                            {showDeletePassword ? 'Hide' : 'Show'}
                                        </button>
                                    </div>
                                </label>
                            </>
                        )}

                        <div className='settings-modal-actions'>
                            <button className='btn btn-soft' type='button' onClick={closeDeleteModal} disabled={working}>
                                Cancel
                            </button>
                            <button className='btn btn-danger' type='button' onClick={deleteAccount} disabled={working}>
                                {working ? 'Deleting...' : 'Delete Account'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

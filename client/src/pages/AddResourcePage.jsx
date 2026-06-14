import React, { useEffect, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import ResourceForm from '../components/ResourceForm';
import { createResource } from '../services/resourceService';
import api from '../api';
import '../auth/user/Dashboard.css';
import './ResourceTheme.css';

const AddResourcePage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const listPath = location.pathname.startsWith('/dashboard/resources') ? '/dashboard' : '/resources';
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [homeData, setHomeData] = useState(null);
    const [profile, setProfile] = useState(null);
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const loadSidebarData = async () => {
            try {
                const [dashboardResponse, profileResponse] = await Promise.all([
                    api.get('/user/Admin/dashboard'),
                    api.get('/user/Admin/me')
                ]);
                setHomeData(dashboardResponse.data);
                setProfile(profileResponse.data);
                return;
            } catch (adminErr) {
                if (adminErr.response?.status !== 401 && adminErr.response?.status !== 403) {
                    console.error(adminErr);
                }
            }

            try {
                const [homeResponse, profileResponse] = await Promise.all([
                    api.get('/user/home'),
                    api.get('/user/me')
                ]);
                setHomeData(homeResponse.data);
                setProfile(profileResponse.data);
            } catch (userErr) {
                if (userErr.response?.status !== 401 && userErr.response?.status !== 403) {
                    console.error(userErr);
                }
            }
        };

        loadSidebarData();
    }, []);
    //handle create resource
    const handleCreate = async (resourceData) => {
        try {
            setIsLoading(true);
            setError(null);

            await createResource(resourceData);
            alert('Resource created successfully!');
            navigate(listPath);
        } catch (err) {
            console.error(err);
            const backendMessage = err?.response?.data?.message || err?.response?.data;
            setError(backendMessage || 'Failed to create resource. Please check your data.');
        } finally {
            setIsLoading(false);
        }
    };

    const pageFrameStyle = {
        maxWidth: '960px',
        width: '100%',
        display: 'grid',
        gap: '18px'
    };

    const topPanelStyle = {
        background: 'rgba(255, 255, 255, 0.96)',
        border: '1px solid rgba(241, 220, 205, 0.92)',
        borderRadius: '22px',
        boxShadow: '0 18px 38px rgba(217, 106, 50, 0.16)',
        padding: 'clamp(20px, 2.6vw, 32px)'
    };

    const panelHeaderStyle = {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px',
        flexWrap: 'wrap',
        marginBottom: '8px'
    };

    const formPanelStyle = {
        background: 'rgba(255, 255, 255, 0.94)',
        border: '1px solid rgba(241, 220, 205, 0.9)',
        borderRadius: '22px',
        boxShadow: '0 14px 30px rgba(217, 106, 50, 0.12)',
        padding: 'clamp(18px, 2.3vw, 30px)'
    };

    const errorStyle = {
        background: 'rgba(220, 38, 38, 0.1)',
        border: '1px solid rgba(220, 38, 38, 0.25)',
        borderLeft: '4px solid #dc2626',
        color: '#7f1d1d',
        borderRadius: '14px',
        margin: 0
    };

    const roleLabel = String(profile?.role || '').replace('ROLE_', '') || 'USER';
    const isAdmin = String(profile?.role || '').toUpperCase().includes('ADMIN');
    const homePath = isAdmin ? '/dashboard' : '/home';
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const currentMonth = monthNames[time.getMonth()];
    const currentYear = time.getFullYear();
    const currentDay = time.getDate();
    const daysInMonth = new Date(currentYear, time.getMonth() + 1, 0).getDate();
    const firstDayIndex = new Date(currentYear, time.getMonth(), 1).getDay();
    const calCells = Array.from({ length: 42 });

    return (
        <div className="md-screen resource-theme-root" style={{ background: 'linear-gradient(145deg, #fffdf9 0%, #fff8ee 100%)' }}>
            <div className="md-layout" style={{ gap: '40px', padding: '32px 32px 40px' }}>
                <aside className="md-sidebar">
                    <div className="md-sidebar-profile">
                        <div className="md-avatar">
                            {profile?.name ? profile.name[0].toUpperCase() : 'U'}
                        </div>
                        <div className="md-user-info">
                            <h5>{profile?.name || 'User'} {profile?.lastName || ''}</h5>
                            <span>{profile?.email || 'user@example.com'}</span>
                        </div>
                    </div>

                    <div className="md-nav-group">
                        <p className="md-nav-label">QUICK NAVIGATION</p>
                        <nav className="md-nav">
                            <Link to={homePath} className="md-nav-item">Dashboard</Link>
                            <Link to="/profile" className="md-nav-item">Profile</Link>
                            <Link to="/settings" className="md-nav-item">Settings</Link>
                        </nav>
                    </div>

                    <div className="md-nav-group">
                        <p className="md-nav-label">PROFILE STATUS</p>
                        <div className="md-status-grid">
                            <span>Completion</span> <strong>44%</strong>
                            <span>Role</span> <strong>{roleLabel}</strong>
                            <span>Recovery</span> <strong className="md-status-missing">Missing</strong>
                        </div>
                    </div>

                    <div className="md-nav-group">
                        <p className="md-nav-label">DASHBOARD STATS</p>
                        <div className="md-sidebar-stats">
                            <div className="md-stat-card-slim">
                                <div className="md-stat-icon-slim">🔔</div>
                                <div className="details">
                                    <p>Notifications</p>
                                    <h3>{homeData?.notifications ?? 0}</h3>
                                </div>
                            </div>
                            <div className="md-stat-card-slim">
                                <div className="md-stat-icon-slim">🗂️</div>
                                <div className="details">
                                    <p>Tasks</p>
                                    <h3>{homeData?.tasks ?? 0}</h3>
                                </div>
                            </div>
                            <div className="md-stat-card-slim">
                                <div className="md-stat-icon-slim">{isAdmin ? '🛡️' : '👤'}</div>
                                <div className="details">
                                    <p>Current Role</p>
                                    <h3>{roleLabel}</h3>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="md-nav-group md-calendar-widget">
                        <p className="md-nav-label">CALENDAR</p>
                        <div className="md-cal-header">
                            <strong>{currentMonth} {currentYear}</strong>
                            <span className="md-today-badge">Today {currentDay}</span>
                        </div>
                        <p className="md-cal-time">{time.toLocaleTimeString()}</p>
                        <div className="md-cal-grid">
                            <div className="cal-day-label">Su</div>
                            <div className="cal-day-label">Mo</div>
                            <div className="cal-day-label">Tu</div>
                            <div className="cal-day-label">We</div>
                            <div className="cal-day-label">Th</div>
                            <div className="cal-day-label">Fr</div>
                            <div className="cal-day-label">Sa</div>
                            {calCells.map((_, i) => {
                                const dayNum = i - firstDayIndex + 1;
                                const isCurrentMonth = dayNum > 0 && dayNum <= daysInMonth;
                                const isToday = isCurrentMonth && dayNum === currentDay;
                                return (
                                    <div key={i} className={`cal-cell ${isToday ? 'active' : ''} ${!isCurrentMonth ? 'dim' : ''}`}>
                                        {dayNum > 0 && dayNum <= daysInMonth ? dayNum : (dayNum <= 0 ? 30 + dayNum : dayNum - daysInMonth)}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </aside>

                <main className="md-main" style={{ alignItems: 'stretch' }}>
                    <div style={pageFrameStyle}>
                        <section style={topPanelStyle}>
                            <div style={panelHeaderStyle}>
                                <h1 style={{ margin: 0, fontSize: 'clamp(2rem, 4vw, 2.8rem)' }}>Add New Resource</h1>
                                <Link to={listPath} className="btn btn-clear" style={{ whiteSpace: 'nowrap' }}>Back to List</Link>
                            </div>
                            <p style={{ margin: 0, color: '#7d6656', fontSize: '0.95rem' }}>
                                Create a new campus facility asset with full details, availability window, and image.
                            </p>
                        </section>

                        {error && <div className="alert error" style={errorStyle}>{error}</div>}

                        <section style={formPanelStyle}>
                            <ResourceForm onSubmit={handleCreate} isLoading={isLoading} />
                        </section>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default AddResourcePage;
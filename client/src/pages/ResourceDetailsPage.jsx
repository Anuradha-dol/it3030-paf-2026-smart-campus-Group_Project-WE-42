import React, { useState, useEffect } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { getResourceById } from '../services/resourceService';
import api from '../api';
import '../auth/user/Dashboard.css';
import './ResourceTheme.css';

import { useNavigate } from 'react-router-dom';




const resolveResourceImage = (resource) => {
    const rawImage = resource?.imageUrl || resource?.image || resource?.imageBase64 || resource?.resourceImage;
    if (!rawImage || typeof rawImage !== 'string') {
        return '';
    }

    if (rawImage.startsWith('data:image/')) {
        return rawImage;
    }

    return `data:image/jpeg;base64,${rawImage}`;
};

const ResourceDetailsPage = () => {
    const { id } = useParams();
    const location = useLocation();
    const basePath = location.pathname.startsWith('/dashboard/resources') ? '/dashboard/resources' : '/resources';
    const listPath = location.pathname.startsWith('/dashboard/resources') ? '/dashboard' : '/resources';
    const [resource, setResource] = useState(null);
    const [error, setError] = useState('');
    const [homeData, setHomeData] = useState(null);
    const [profile, setProfile] = useState(null);
    const [time, setTime] = useState(new Date());

    const navigate = useNavigate();

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const fetchResource = async () => {
            try {
                const data = await getResourceById(id);
                setResource(data);
            } catch (err) {
                console.error(err);
                setError('Failed to load resource details.');
            }
        };
        fetchResource();
    }, [id]);

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

    const pageFrameStyle = {
        maxWidth: '1020px',
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

    const detailsCardStyle = {
        background: 'rgba(255, 255, 255, 0.95)',
        border: '1px solid rgba(241, 220, 205, 0.9)',
        borderRadius: '22px',
        boxShadow: '0 14px 30px rgba(217, 106, 50, 0.12)',
        padding: 'clamp(18px, 2.3vw, 30px)'
    };

    const infoGridStyle = {
        display: 'grid',
        gap: '12px',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        marginTop: '16px'
    };

    const infoItemStyle = {
        background: '#fff7ef',
        border: '1px solid rgba(241, 220, 205, 0.95)',
        borderRadius: '14px',
        padding: '12px 14px',
        display: 'grid',
        gap: '5px'
    };

    const infoLabelStyle = {
        fontSize: '0.73rem',
        fontWeight: 700,
        letterSpacing: '0.04em',
        color: '#7d6656',
        textTransform: 'uppercase'
    };

    const infoValueStyle = {
        fontSize: '0.96rem',
        fontWeight: 600,
        color: '#3b2c21',
        lineHeight: 1.4,
        wordBreak: 'break-word'
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

    const imageSource = resolveResourceImage(resource);
    const statusClassName = `status-${String(resource?.status || '').toLowerCase()}`;
    const detailsItems = resource
        ? [
            { label: 'Resource ID', value: resource.id },
            { label: 'Type', value: resource.type },
            { label: 'Capacity', value: resource.capacity },
            { label: 'Location', value: resource.location },
            { label: 'Available From', value: resource.availableFrom || 'N/A' },
            { label: 'Available To', value: resource.availableTo || 'N/A' }
        ]
        : [];

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
                                <h1 style={{ margin: 0, fontSize: 'clamp(2rem, 4vw, 2.8rem)' }}>Resource Details</h1>
                                <Link to={listPath} className="btn btn-clear" style={{ whiteSpace: 'nowrap' }}>Back to List</Link>
                            </div>
                            <p style={{ margin: 0, color: '#7d6656', fontSize: '0.95rem' }}>
                                View complete resource information, image, availability, and operational status.
                            </p>
                        </section>

                        {error && <div className="alert error" style={errorStyle}>{error}</div>}

                        {!resource ? (
                            <section style={detailsCardStyle}>
                                <p style={{ margin: 0, color: '#7d6656' }}>Loading details...</p>
                            </section>
                        ) : (
                            <section style={detailsCardStyle}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                                    <h3 style={{ margin: 0, fontSize: '1.3rem' }}>{resource.name}</h3>
                                    <span className={statusClassName} style={{ borderRadius: '999px', padding: '6px 12px' }}>{resource.status}</span>
                                </div>

                                {imageSource && (
                                    <div className="resource-detail-image-wrapper" style={{ marginTop: '16px' }}>
                                        <img src={imageSource} alt={`${resource.name} preview`} className="resource-detail-image" />
                                    </div>
                                )}

                                <div style={infoGridStyle}>
                                    {detailsItems.map((item) => (
                                        <div key={item.label} style={infoItemStyle}>
                                            <span style={infoLabelStyle}>{item.label}</span>
                                            <span style={infoValueStyle}>{item.value}</span>
                                        </div>
                                    ))}
                                </div>

                                <div style={{ ...infoItemStyle, marginTop: '12px' }}>
                                    <span style={infoLabelStyle}>Description</span>
                                    <span style={infoValueStyle}>{resource.description || 'No description provided.'}</span>
                                </div>

                                <div style={{ marginTop: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                    {isAdmin ? (
                                        <Link to={`${basePath}/edit/${resource.id}`} className="btn btn-primary">
                                            Edit Resource
                                        </Link>
                                    ) : (
                                       <button
                                           type="button"
                                           className="btn btn-primary"
                                           onClick={() =>
                                               navigate('/bookings', {
                                                  state: {
                                                     resourceId: resource.id,
                                                     facilityName: resource.name,
                                                     location: resource.location,
                                                     capacity: resource.capacity,
                                                     availableFrom: resource.availableFrom,
                                                     availableTo: resource.availableTo,
                                         },
                                     })
                            }
                        >
                             Book Now
                        </button>
                                    )}
                                    <Link to={listPath} className="btn btn-clear">
                                        Back to List
                                    </Link>
                                </div>
                            </section>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default ResourceDetailsPage;
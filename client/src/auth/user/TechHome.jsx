import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api from "../../api";
import NotificationBell from "../../components/NotificationBell";
import "./Dashboard.css";
import "./Profile.css";
import ResourceListPage from "../../pages/ResourceListPage";

function extractProfileImagePath(profileLike) {
    if (!profileLike || typeof profileLike !== "object") {
        return "";
    }

    return (
        profileLike.profileImageUrl ||
        profileLike.imageUrl ||
        profileLike.image ||
        profileLike.profileImage ||
        profileLike.avatarUrl ||
        ""
    );
}

function buildAssetUrl(path) {
    if (!path) {
        return "";
    }

    const normalizedPath = String(path).trim().replace(/\\/g, "/");

    if (!normalizedPath) {
        return "";
    }

    if (
        normalizedPath.startsWith("http://") ||
        normalizedPath.startsWith("https://") ||
        normalizedPath.startsWith("data:image/")
    ) {
        return normalizedPath;
    }

    return normalizedPath.startsWith("/")
        ? `${api.defaults.baseURL}${normalizedPath}`
        : `${api.defaults.baseURL}/${normalizedPath}`;
}

function renderHeaderNavIcon(icon) {
    if (icon === "completed") {
        return (
            <svg viewBox="0 0 24 24" role="img" aria-hidden="true" focusable="false">
                <circle cx="12" cy="12" r="9" />
                <path d="m8.5 12.5 2.3 2.3 4.8-4.8" />
            </svg>
        );
    }

    return (
        <svg viewBox="0 0 24 24" role="img" aria-hidden="true" focusable="false">
            <path d="M7 3v2M17 3v2M4 9h16M6 5h12a2 2 0 0 1 2 2v4.5M4 12V7a2 2 0 0 1 2-2" />
            <path d="m14.5 16.5 2 2 4-4" />
            <circle cx="17.5" cy="17.5" r="4.5" />
        </svg>
    );
}

export default function TechHome() {
    const navigate = useNavigate();
    const location = useLocation();

    const [homeData, setHomeData] = useState(null);
    const [profile, setProfile] = useState(null);
    const [error, setError] = useState("");
    const [time, setTime] = useState(new Date());
    const [avatarFailed, setAvatarFailed] = useState(false);

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        let cancelled = false;

        const enrichProfileWithAuthImage = async (profileData) => {
            const safeProfile = profileData || {};

            if (extractProfileImagePath(safeProfile)) {
                return safeProfile;
            }

            try {
                const authResponse = await api.get("/auth/me");
                const authUser = authResponse?.data?.user;
                const authImagePath = extractProfileImagePath(authUser);

                if (!authImagePath) {
                    return safeProfile;
                }

                return {
                    ...safeProfile,
                    profileImageUrl: authImagePath,
                };
            } catch {
                return safeProfile;
            }
        };

        const loadData = async () => {
            try {
                const [homeResponse, profileResponse] = await Promise.all([
                    api.get("/user/home"),
                    api.get("/user/me"),
                ]);
                const enrichedProfile = await enrichProfileWithAuthImage(profileResponse.data);

                if (cancelled) {
                    return;
                }

                setHomeData(homeResponse.data);
                setProfile(enrichedProfile);
            } catch (err) {
                if (cancelled) {
                    return;
                }

                if (err.response?.status === 400 || err.response?.status === 401 || err.response?.status === 403) {
                    try {
                        const authResponse = await api.get("/auth/me");
                        const role = String(authResponse?.data?.user?.role || "").toUpperCase();

                        if (role.includes("ADMIN")) {
                            navigate("/dashboard", { replace: true });
                            return;
                        }

                        if (role.includes("TECHNICIAN")) {
                            navigate("/techhome", { replace: true });
                            return;
                        }

                        navigate("/home", { replace: true });
                        return;
                    } catch (authErr) {
                        if (authErr.response?.status === 401 || authErr.response?.status === 403) {
                            navigate("/login", { replace: true });
                            return;
                        }

                        setError("Unable to verify your session right now. Please refresh and try again.");
                        return;
                    }
                }

                setError(err.response?.data?.message || "Failed to load technician home page.");
            }
        };

        loadData();

        return () => {
            cancelled = true;
        };
    }, [navigate]);

    useEffect(() => {
        setAvatarFailed(false);
    }, [profile?.profileImageUrl, profile?.imageUrl, profile?.image, profile?.avatarUrl]);

    useEffect(() => {
        const normalizedRole = String(profile?.role || "").toUpperCase();

        if (!normalizedRole) {
            return;
        }

        if (normalizedRole.includes("ADMIN")) {
            if (location.pathname !== "/dashboard") {
                navigate("/dashboard", { replace: true });
            }
            return;
        }

        if (!normalizedRole.includes("TECHNICIAN")) {
            if (location.pathname !== "/home") {
                navigate("/home", { replace: true });
            }
            return;
        }

        if (location.pathname !== "/techhome") {
            navigate("/techhome", { replace: true });
        }
    }, [profile?.role, location.pathname, navigate]);

    const handleLogout = async () => {
        try {
            await api.post("/auth/logout", {}, { withCredentials: true });
        } catch (err) {
            console.log("Logout error:", err.message);
        } finally {
            navigate("/login", { replace: true });
        }
    };

    if (!homeData && !error) {
        return (
            <div className="md-screen loading">
                <div className="md-spinner" />
                <p>Loading TechHome...</p>
            </div>
        );
    }

    const roleLabel = String(profile?.role || "").replace("ROLE_", "") || "TECHNICIAN";
    const roleNavigationLinks = [
        {
            label: "My Tickets",
            description: "View & update assigned tickets",
            to: "/technician/my-tickets",
            icon: "ticket",
        },
        {
            label: "Work Appointments",
            description: "Assigned appointments",
            to: "/technician/appointments",
            icon: "appointment",
        },
        {
            label: "Completed Works",
            description: "Finished work list",
            to: "/technician/my-tickets",
            icon: "completed",
        },
    ];
    const firstName = profile?.name || profile?.firstname || "";
    const lastName = profile?.lastName || profile?.lastname || "";
    const fullName = `${firstName} ${lastName}`.trim();
    const initials = (firstName[0] || "T").toUpperCase();
    const profileImage = buildAssetUrl(extractProfileImagePath(profile));
    const showAvatarImage = Boolean(profileImage) && !avatarFailed;
    const currentDay = time.getDate();
    const calendarLabel = time.toLocaleString("default", { month: "long", year: "numeric" });
    const clockLabel = time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const calendarYear = time.getFullYear();
    const calendarMonth = time.getMonth();
    const calendarFirstDay = new Date(calendarYear, calendarMonth, 1).getDay();
    const calendarDaysCount = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const calendarCells = [
        ...Array.from({ length: calendarFirstDay }, () => null),
        ...Array.from({ length: calendarDaysCount }, (_, index) => index + 1),
    ];
    const completionFields = [
        firstName,
        lastName,
        profile?.email,
        profile?.phoneNumber,
        profile?.tempEmail,
        profile?.year,
        profile?.semester,
        profile?.profileImageUrl || profile?.imageUrl,
        profile?.coverImageUrl,
    ];
    const filledFieldsCount = completionFields.filter((field) => field && String(field).trim()).length;
    const completionPercentage = Math.round((filledFieldsCount / completionFields.length) * 100);

    return (
        <div className="md-screen">
            <div className="md-layout">
                <aside className="md-sidebar profile-sidebar">
                    <div className="sidebar-brand">
                        <span
                            className="brand-avatar"
                            style={
                                showAvatarImage
                                    ? undefined
                                    : { background: "linear-gradient(130deg, #ed7b3f, #ffc292)", color: "#fff" }
                            }
                        >
                            {showAvatarImage ? (
                                <img
                                    src={profileImage}
                                    alt="Profile avatar"
                                    onError={() => setAvatarFailed(true)}
                                />
                            ) : (
                                initials
                            )}
                        </span>
                        <div className="brand-info">
                            <strong>{fullName || "Technician"}</strong>
                            <small>{profile?.email || "No email"}</small>
                        </div>
                    </div>

                    <nav className="sidebar-nav">
                        <p className="sidebar-label">Quick Navigation</p>
                        <Link className="sidebar-link active" to="/techhome">
                            TechHome
                        </Link>
                        <Link className="sidebar-link" to="/technician/my-tickets">
                            My Tickets
                        </Link>
                        <Link className="sidebar-link" to="/profile">
                            Profile
                        </Link>
                        <Link className="sidebar-link" to="/settings">
                            Settings
                        </Link>
                    </nav>

                    <div className="sidebar-card">
                        <p className="sidebar-label">Profile Status</p>
                        <div className="sidebar-item">
                            <span>Completion</span>
                            <strong>{completionPercentage}%</strong>
                        </div>
                        <div className="sidebar-item">
                            <span>Role</span>
                            <strong>{roleLabel}</strong>
                        </div>
                        <div className="sidebar-item">
                            <span>Recovery</span>
                            <strong>{profile?.tempEmail ? "Added" : "Missing"}</strong>
                        </div>
                    </div>

                    <div className="sidebar-calendar-card">
                        <p className="sidebar-label">Calendar</p>
                        <div className="sidebar-calendar-header">
                            <strong>{calendarLabel}</strong>
                            <span className="sidebar-today-badge">Today {currentDay}</span>
                        </div>
                        <div className="sidebar-clock">{clockLabel}</div>
                        <div className="sidebar-calendar-grid">
                            <div className="sidebar-calendar-weekdays">
                                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                                    <span key={day} className="weekday">{day}</span>
                                ))}
                            </div>
                            <div className="sidebar-calendar-days">
                                {calendarCells.map((day, index) => (
                                    <span
                                        key={`day-${index}`}
                                        className={`day${day === null ? " empty" : ""}${day === currentDay ? " today" : ""}`}
                                        aria-hidden={day === null}
                                    >
                                        {day ?? ""}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </aside>

                <main className="md-main">
                    <header className="md-topbar">
                        <div className="md-topbar-left">
                            <h1 className="md-title">Technician Dashboard</h1>
                            <p className="md-subtitle">Track assigned work and manage technician operations.</p>
                            <div className="profile-role-nav-inline">
                                {roleNavigationLinks.map((item) => (
                                    <Link
                                        key={item.to}
                                        className={`profile-role-nav-link${location.pathname === item.to ? " active" : ""}`}
                                        to={item.to}
                                    >
                                        <span className="profile-role-nav-icon">
                                            {renderHeaderNavIcon(item.icon)}
                                        </span>
                                        <span className="profile-role-nav-text">
                                            <strong>{item.label}</strong>
                                            <small>{item.description}</small>
                                        </span>
                                    </Link>
                                ))}
                            </div>
                        </div>
                        <div className="md-topbar-actions">
                            <NotificationBell />
                            <button className="md-btn-logout" onClick={handleLogout}>Logout</button>
                        </div>
                    </header>

                    {error && <div className="md-alert error">{error}</div>}

                    {!error && (
                        <div className="md-content-scroll">
                            <div className="md-panel md-resource-wrapper">
                                <div className="md-panel-header" style={{ display: "none" }}>
                                    <h2>Resources</h2>
                                </div>
                                <div className="md-panel-body p-0">
                                    <ResourceListPage
                                        embedded
                                        basePath="/dashboard/resources"
                                        canManage={false}
                                        showBook
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}

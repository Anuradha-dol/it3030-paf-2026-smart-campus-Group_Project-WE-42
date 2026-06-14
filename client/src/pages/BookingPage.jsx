import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api from "../api";
import NotificationBell from "../components/NotificationBell";
import BookingForm from "../components/BookingForm";
import { createBooking } from "../services/bookingService";
import "../auth/user/profile.css";
import "../auth/user/Dashboard.css";

function extractProfileImagePath(profileLike) {
  if (!profileLike || typeof profileLike !== "object") return "";
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
  if (!path) return "";
  const normalizedPath = String(path).trim().replace(/\\/g, "/");
  if (!normalizedPath) return "";
  if (
    normalizedPath.startsWith("http://") ||
    normalizedPath.startsWith("https://") ||
    normalizedPath.startsWith("data:image/")
  )
    return normalizedPath;
  return normalizedPath.startsWith("/")
    ? `${api.defaults.baseURL}${normalizedPath}`
    : `${api.defaults.baseURL}/${normalizedPath}`;
}

function renderHeaderNavIcon(icon) {
  if (icon === "booking") {
    return (
      <svg viewBox="0 0 24 24" role="img" aria-hidden="true" focusable="false">
        <path d="M7 3v2M17 3v2M4 9h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
        <path d="M12 12v5M9.5 14.5h5" />
      </svg>
    );
  }
  if (icon === "history") {
    return (
      <svg viewBox="0 0 24 24" role="img" aria-hidden="true" focusable="false">
        <path d="M3 12a9 9 0 1 0 3-6.7" />
        <path d="M3 4v4h4M12 7v5l3 2" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" role="img" aria-hidden="true" focusable="false">
      <path d="M4 7.5h16v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <path d="M9 7.5V6a3 3 0 0 1 6 0v1.5M10 12h4" />
    </svg>
  );
}

function BookingPageView() {
  const location = useLocation();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  const [time, setTime] = useState(new Date());
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [bookingMessage, setBookingMessage] = useState("");
  const [bookingMessageType, setBookingMessageType] = useState("");

  // Resource data passed from resource list (when clicking "Book Now")
  const resourceData = location.state || {};

  // Real-time clock
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Load user profile
  useEffect(() => {
    let cancelled = false;

    const enrichProfileWithAuthImage = async (profileData) => {
      const safeProfile = profileData || {};
      if (extractProfileImagePath(safeProfile)) return safeProfile;
      try {
        const authResponse = await api.get("/auth/me");
        const authUser = authResponse?.data?.user;
        const authImagePath = extractProfileImagePath(authUser);
        if (!authImagePath) return safeProfile;
        return { ...safeProfile, profileImageUrl: authImagePath };
      } catch {
        return safeProfile;
      }
    };

    const loadData = async () => {
      try {
        const profileResponse = await api.get("/user/me");
        const enrichedProfile = await enrichProfileWithAuthImage(profileResponse.data);
        if (cancelled) return;
        setProfile(enrichedProfile);
      } catch (err) {
        if (cancelled) return;
        if (err.response?.status === 401 || err.response?.status === 403) {
          try {
            const authResponse = await api.get("/auth/me");
            const role = String(authResponse?.data?.user?.role || "").toUpperCase();
            if (role.includes("ADMIN")) navigate("/dashboard", { replace: true });
            else if (role.includes("TECHNICIAN")) navigate("/techhome", { replace: true });
            else navigate("/home", { replace: true });
          } catch {
            navigate("/login", { replace: true });
          }
          return;
        }
        setError(err.response?.data?.message || "Failed to load profile.");
      }
    };

    loadData();
    return () => { cancelled = true; };
  }, [navigate]);

  useEffect(() => {
    setAvatarFailed(false);
  }, [profile?.profileImageUrl, profile?.imageUrl, profile?.image, profile?.avatarUrl]);

  useEffect(() => {
    const normalizedRole = String(profile?.role || "").toUpperCase();
    if (!normalizedRole) return;
    if (normalizedRole.includes("ADMIN")) {
      navigate("/dashboard", { replace: true });
    } else if (normalizedRole.includes("TECHNICIAN")) {
      navigate("/techhome", { replace: true });
    }
  }, [profile?.role, navigate]);

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout", {}, { withCredentials: true });
    } catch (err) {
      console.log("Logout error:", err.message);
    } finally {
      navigate("/login", { replace: true });
    }
  };

  // Booking creation handler
  const handleCreateBooking = async (formData) => {
    try {
      setBookingMessage("");
      setBookingMessageType("");
      const response = await createBooking(formData);
      setBookingMessage("✅ Booking created successfully.");
      setBookingMessageType("success");
      return response.data;
    } catch (error) {
      console.error("Booking error:", error);
      const backendErrors = error.response?.data?.errors || {};
      const msg =
        backendErrors.booking ||
        Object.values(backendErrors).join(", ") ||
        error.response?.data?.message ||
        "Failed to create booking";
      setBookingMessage(msg);
      setBookingMessageType("error");
      return { errors: backendErrors };
    }
  };

  if (!profile && !error) {
    return (
      <div className="md-screen loading">
        <div className="md-spinner" />
        <p>Loading Dashboard...</p>
      </div>
    );
  }

  const roleLabel = String(profile?.role || "").replace("ROLE_", "") || "USER";
  const firstName = profile?.name || profile?.firstname || "";
  const lastName = profile?.lastName || profile?.lastname || "";
  const fullName = `${firstName} ${lastName}`.trim();
  const initials = (firstName[0] || "U").toUpperCase();
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
    ...Array.from({ length: calendarDaysCount }, (_, i) => i + 1),
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
  const filledFieldsCount = completionFields.filter((f) => f && String(f).trim()).length;
  const completionPercentage = Math.round((filledFieldsCount / completionFields.length) * 100);

  const roleNavigationLinks = [
    { label: "Tickets", description: "Your ticket requests", to: "/tickets", icon: "ticket" },
    { label: "Bookings", description: "Create new booking", to: "/bookings", icon: "booking" },
    { label: "View Bookings", description: "Your booking history", to: "/my-bookings", icon: "history" },
  ];

  // Prepare initial data for the booking form (pre‑filled from selected resource)
  const bookingInitialData = {
    facilityName: resourceData.facilityName || "",
    bookingDate: resourceData.bookingDate || "",
    startTime: resourceData.availableFrom || "",
    endTime: resourceData.availableTo || "",
    attendees: resourceData.capacity || 1,
    purpose: "",
    bookedBy: profile?.name || profile?.firstname || "",
  };

  return (
    <div className="md-screen">
      <div className="md-layout">
        {/* LEFT SIDEBAR – unchanged */}
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
                <img src={profileImage} alt="Profile avatar" onError={() => setAvatarFailed(true)} />
              ) : (
                initials
              )}
            </span>
            <div className="brand-info">
              <strong>{fullName || "User"}</strong>
              <small>{profile?.email || "No email"}</small>
            </div>
          </div>

          <nav className="sidebar-nav">
            <p className="sidebar-label">Quick Navigation</p>
            <Link className="sidebar-link active" to="/home">
              Home
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

        {/* MAIN CONTENT – header unchanged, body replaced with booking form */}
        <main className="md-main">
          <header className="md-topbar">
            <div className="md-topbar-left">
              <h1 className="md-title">User Dashboard</h1>
              <p className="md-subtitle">Welcome back to your portal.</p>
              <div className="profile-role-nav-inline">
                {roleNavigationLinks.map((item) => (
                  <Link
                    key={item.to}
                    className={`profile-role-nav-link${item.label === "Bookings" ? " active" : ""}`}
                    to={item.to}
                  >
                    <span className="profile-role-nav-icon">{renderHeaderNavIcon(item.icon)}</span>
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

          <div className="md-content-scroll">
            <div className="md-panel">
              <div className="md-panel-header">
                <h2>📅 Create a New Booking</h2>
                <p>Fill in the details below to reserve a facility or resource.</p>
              </div>

              {/* Show pre‑filled resource card if data came from resource list */}
              {resourceData?.facilityName && (
                <div className="booking-resource-card" style={{
                  background: "#fff7ef",
                  borderRadius: "16px",
                  padding: "16px",
                  marginBottom: "24px",
                  border: "1px solid #efd6c2"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <h3 style={{ margin: 0, fontSize: "1rem", color: "#5f4839" }}>Selected Resource</h3>
                    <span style={{ background: "#ff9763", padding: "4px 10px", borderRadius: "20px", fontSize: "0.7rem", fontWeight: 700, color: "white" }}>
                      Pre‑filled
                    </span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px,1fr))", gap: "12px" }}>
                    <div><span style={{ color: "#8c7865" }}>Facility</span><br/><strong>{resourceData.facilityName}</strong></div>
                    <div><span style={{ color: "#8c7865" }}>Location</span><br/><strong>{resourceData.location || "N/A"}</strong></div>
                    <div><span style={{ color: "#8c7865" }}>Capacity</span><br/><strong>{resourceData.capacity || "N/A"}</strong></div>
                    <div><span style={{ color: "#8c7865" }}>Available</span><br/><strong>{resourceData.availableFrom || "N/A"} – {resourceData.availableTo || "N/A"}</strong></div>
                  </div>
                </div>
              )}

              {bookingMessage && (
                <div className={`booking-message ${bookingMessageType}`} style={{
                  padding: "12px 16px",
                  borderRadius: "12px",
                  marginBottom: "20px",
                  fontWeight: 500,
                  backgroundColor: bookingMessageType === "success" ? "#e6f7e6" : "#fee8e8",
                  color: bookingMessageType === "success" ? "#2e6b2e" : "#b33a2e",
                  borderLeft: `4px solid ${bookingMessageType === "success" ? "#2e6b2e" : "#b33a2e"}`
                }}>
                  {bookingMessage}
                </div>
              )}

              {/* Pass pre‑filled data to BookingForm */}
              <BookingForm onCreate={handleCreateBooking} initialData={bookingInitialData} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default BookingPageView;

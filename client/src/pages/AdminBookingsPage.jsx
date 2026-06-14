// src/pages/AdminBookingsPage.js
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";
import NotificationBell from "../components/NotificationBell";
import { getAllBookings, updateBookingStatus } from "../services/bookingService";
import "../auth/user/profile.css";
import "../auth/user/Dashboard.css";

// ---------- Helper functions ----------
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

export default function AdminBookingsPage() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  const [time, setTime] = useState(new Date());
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [filteredBookings, setFilteredBookings] = useState([]);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  // Status counts
  const [pendingCount, setPendingCount] = useState(0);
  const [approvedCount, setApprovedCount] = useState(0);
  const [rejectedCount, setRejectedCount] = useState(0);

  // Filter states
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [facilityFilter, setFacilityFilter] = useState("");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");
  const [uniqueFacilities, setUniqueFacilities] = useState([]);

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

  // Role redirection (must be admin)
  useEffect(() => {
    const normalizedRole = String(profile?.role || "").toUpperCase();
    if (!normalizedRole) return;
    if (!normalizedRole.includes("ADMIN")) {
      navigate("/home", { replace: true });
    }
  }, [profile?.role, navigate]);

  // Load bookings and compute counts
  const loadBookings = async () => {
    try {
      const response = await getAllBookings();
      const allBookings = response.data.data || [];
      setBookings(allBookings);

      // Update counts
      const pending = allBookings.filter(b => b.status === "PENDING").length;
      const approved = allBookings.filter(b => b.status === "APPROVED").length;
      const rejected = allBookings.filter(b => b.status === "REJECTED").length;
      setPendingCount(pending);
      setApprovedCount(approved);
      setRejectedCount(rejected);

      // Extract unique facilities
      const facilities = [...new Set(allBookings.map(b => b.facilityName).filter(Boolean))];
      setUniqueFacilities(facilities);

      applyFilters(allBookings, statusFilter, facilityFilter, startDateFilter, endDateFilter);
    } catch (error) {
      console.error("Failed to load bookings", error);
      setMessage("Failed to load bookings");
      setMessageType("error");
    }
  };

  useEffect(() => {
    loadBookings();
  }, []);

  const applyFilters = (bookingList, status, facility, startDate, endDate) => {
    let filtered = [...bookingList];

    if (status !== "ALL") {
      filtered = filtered.filter(b => b.status === status);
    }
    if (facility) {
      filtered = filtered.filter(b => b.facilityName === facility);
    }
    if (startDate) {
      filtered = filtered.filter(b => b.bookingDate >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter(b => b.bookingDate <= endDate);
    }

    setFilteredBookings(filtered);
  };

  const handleStatusFilterChange = (e) => {
    const newStatus = e.target.value;
    setStatusFilter(newStatus);
    applyFilters(bookings, newStatus, facilityFilter, startDateFilter, endDateFilter);
  };

  const handleFacilityFilterChange = (e) => {
    const newFacility = e.target.value;
    setFacilityFilter(newFacility);
    applyFilters(bookings, statusFilter, newFacility, startDateFilter, endDateFilter);
  };

  const handleStartDateChange = (e) => {
    const newStart = e.target.value;
    setStartDateFilter(newStart);
    applyFilters(bookings, statusFilter, facilityFilter, newStart, endDateFilter);
  };

  const handleEndDateChange = (e) => {
    const newEnd = e.target.value;
    setEndDateFilter(newEnd);
    applyFilters(bookings, statusFilter, facilityFilter, startDateFilter, newEnd);
  };

  const clearFilters = () => {
    setStatusFilter("ALL");
    setFacilityFilter("");
    setStartDateFilter("");
    setEndDateFilter("");
    setFilteredBookings(bookings);
  };

  const handleStatusChange = async (id, status) => {
    try {
      await updateBookingStatus(id, status);
      setMessage(`Booking ${status.toLowerCase()} successfully`);
      setMessageType("success");
      await loadBookings(); // reload everything and refresh counts
    } catch (error) {
      const errMsg = error.response?.data?.errors?.error || "Failed to update booking status";
      setMessage(errMsg);
      setMessageType("error");
    }
  };

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout", {}, { withCredentials: true });
    } catch (err) {
      console.log("Logout error:", err.message);
    } finally {
      navigate("/login", { replace: true });
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

  const roleLabel = String(profile?.role || "").replace("ROLE_", "") || "ADMIN";
  const firstName = profile?.name || profile?.firstname || "";
  const lastName = profile?.lastName || profile?.lastname || "";
  const fullName = `${firstName} ${lastName}`.trim();
  const initials = (firstName[0] || "A").toUpperCase();
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

  const adminNavigationLinks = [
    { label: "All Tickets", description: "View every ticket", to: "/admin/tickets", icon: "ticket" },
    { label: "All Bookings", description: "View every booking", to: "/admin/bookings", icon: "history" },
  ];

  return (
    <div className="md-screen">
      <div className="md-layout">
        {/* LEFT SIDEBAR */}
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
              <strong>{fullName || "Admin"}</strong>
              <small>{profile?.email || "No email"}</small>
            </div>
          </div>

          <nav className="sidebar-nav">
            <p className="sidebar-label">Quick Navigation</p>
            <Link className="sidebar-link" to="/dashboard">Dashboard</Link>
            <Link className="sidebar-link" to="/profile">Profile</Link>
            <Link className="sidebar-link" to="/settings">Settings</Link>
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

        {/* MAIN CONTENT */}
        <main className="md-main">
          <header className="md-topbar">
            <div className="md-topbar-left">
              <h1 className="md-title">Admin Dashboard</h1>
              <p className="md-subtitle">Manage all bookings from one place</p>
              <div className="profile-role-nav-inline">
                {adminNavigationLinks.map((item) => (
                  <Link
                    key={item.to}
                    className={`profile-role-nav-link${item.label === "All Bookings" ? " active" : ""}`}
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
                <h2>📋 All Bookings</h2>
                <p>View, filter, and manage all booking requests.</p>
              </div>

              {message && (
                <div
                  className={`booking-message ${messageType}`}
                  style={{
                    padding: "12px 16px",
                    borderRadius: "12px",
                    marginBottom: "20px",
                    fontWeight: 500,
                    backgroundColor: messageType === "success" ? "#e6f7e6" : "#fee8e8",
                    color: messageType === "success" ? "#2e6b2e" : "#b33a2e",
                    borderLeft: `4px solid ${messageType === "success" ? "#2e6b2e" : "#b33a2e"}`,
                  }}
                >
                  {message}
                </div>
              )}

              {/* ATTRACTIVE COUNT CARDS */}
              <div className="booking-stats-cards">
                <div className="stat-card pending-card">
                  <div className="stat-icon">⏳</div>
                  <div className="stat-details">
                    <span className="stat-label">Pending</span>
                    <span className="stat-number">{pendingCount}</span>
                  </div>
                </div>
                <div className="stat-card approved-card">
                  <div className="stat-icon">✅</div>
                  <div className="stat-details">
                    <span className="stat-label">Approved</span>
                    <span className="stat-number">{approvedCount}</span>
                  </div>
                </div>
                <div className="stat-card rejected-card">
                  <div className="stat-icon">❌</div>
                  <div className="stat-details">
                    <span className="stat-label">Rejected</span>
                    <span className="stat-number">{rejectedCount}</span>
                  </div>
                </div>
              </div>

              {/* Filter Bar */}
              <div className="admin-filters">
                <div className="filter-group">
                  <label>Status</label>
                  <select value={statusFilter} onChange={handleStatusFilterChange}>
                    <option value="ALL">All</option>
                    <option value="PENDING">Pending</option>
                    <option value="APPROVED">Approved</option>
                    <option value="REJECTED">Rejected</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>

                <div className="filter-group">
                  <label>Facility</label>
                  <select value={facilityFilter} onChange={handleFacilityFilterChange}>
                    <option value="">All facilities</option>
                    {uniqueFacilities.map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>

                <div className="filter-group">
                  <label>From Date</label>
                  <input type="date" value={startDateFilter} onChange={handleStartDateChange} />
                </div>

                <div className="filter-group">
                  <label>To Date</label>
                  <input type="date" value={endDateFilter} onChange={handleEndDateChange} />
                </div>

                <button className="clear-filters-btn" onClick={clearFilters}>
                  Clear Filters
                </button>
              </div>

              <div className="table-responsive">
                <table className="md-bookings-table admin-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Facility</th>
                      <th>Booked By</th>
                      <th>Date</th>
                      <th>Start</th>
                      <th>End</th>
                      <th>Attendees</th>
                      <th>Purpose</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBookings.length === 0 ? (
                      <tr>
                        <td colSpan="10" style={{ textAlign: "center", padding: "40px" }}>
                          📭 No bookings match your filters.
                        </td>
                      </tr>
                    ) : (
                      filteredBookings.map((booking) => (
                        <tr key={booking.id}>
                          <td>{booking.id}</td>
                          <td>{booking.facilityName}</td>
                          <td>{booking.bookedBy}</td>
                          <td>{booking.bookingDate}</td>
                          <td>{booking.startTime}</td>
                          <td>{booking.endTime}</td>
                          <td>{booking.attendees}</td>
                          <td className="purpose-cell">{booking.purpose}</td>
                          <td>
                            <span className={`booking-status ${booking.status?.toLowerCase()}`}>
                              {booking.status}
                            </span>
                          </td>
                          <td>
                            <div className="action-buttons">
                              <button
                                onClick={() => handleStatusChange(booking.id, "APPROVED")}
                                className="md-btn-approve"
                                disabled={booking.status === "APPROVED" || booking.status === "REJECTED" || booking.status === "CANCELLED"}
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleStatusChange(booking.id, "REJECTED")}
                                className="md-btn-reject"
                                disabled={booking.status === "APPROVED" || booking.status === "REJECTED" || booking.status === "CANCELLED"}
                              >
                                Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";

const SIDEBAR_CONFIG = {
  user: {
    title: "User Workspace",
    subtitle: "Ticket & Booking Access",
    badge: "U",
    roleLabel: "USER",
    links: [
      { to: "/home", label: "Home", end: true },
      { to: "/tickets", label: "Tickets", end: false },
      { to: "/tickets/create", label: "Create Ticket", end: true },
      { to: "/my-bookings", label: "My Bookings", end: true },
    ],
  },
  admin: {
    title: "Admin Workspace",
    subtitle: "Ticket Control Center",
    badge: "A",
    roleLabel: "ADMIN",
    links: [
      { to: "/dashboard", label: "Dashboard", end: true },
      { to: "/admin/tickets", label: "All Tickets", end: false },
      { to: "/admin/tickets/create", label: "Create Ticket", end: true },
      { to: "/admin/bookings", label: "All Bookings", end: true },
    ],
  },
  technician: {
    title: "Technician Workspace",
    subtitle: "Assigned Work Tracker",
    badge: "T",
    roleLabel: "TECHNICIAN",
    links: [
      { to: "/techhome", label: "TechHome", end: true },
      { to: "/technician/my-tickets", label: "My Tickets", end: false },
      { to: "/technician/appointments", label: "Appointments", end: true },
      { to: "/tickets", label: "Ticket Board", end: false },
    ],
  },
};

const WEEK_DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function safeMode(mode) {
  if (mode === "admin" || mode === "technician") {
    return mode;
  }
  return "user";
}

export default function TicketWorkspaceSidebar({ mode = "user" }) {
  const activeMode = safeMode(mode);
  const config = SIDEBAR_CONFIG[activeMode];
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const calendarCells = useMemo(() => {
    const year = time.getFullYear();
    const month = time.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysCount = new Date(year, month + 1, 0).getDate();

    return [
      ...Array.from({ length: firstDay }, () => null),
      ...Array.from({ length: daysCount }, (_, index) => index + 1),
    ];
  }, [time]);

  const currentDay = time.getDate();
  const calendarLabel = time.toLocaleString("default", { month: "long", year: "numeric" });
  const clockLabel = time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <aside className="md-sidebar profile-sidebar ticket-shell-sidebar">
      <div className="sidebar-brand">
        <span className="brand-avatar">{config.badge}</span>
        <div className="brand-info">
          <strong>{config.title}</strong>
          <small>{config.subtitle}</small>
        </div>
      </div>

      <nav className="sidebar-nav">
        <p className="sidebar-label">Quick Navigation</p>
        {config.links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={Boolean(link.end)}
            className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}
          >
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-card">
        <p className="sidebar-label">Workspace Status</p>
        <div className="sidebar-item">
          <span>Role</span>
          <strong>{config.roleLabel}</strong>
        </div>
        <div className="sidebar-item">
          <span>Realtime</span>
          <strong>Enabled</strong>
        </div>
        <div className="sidebar-item">
          <span>Module</span>
          <strong>Tickets</strong>
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
            {WEEK_DAYS.map((day) => (
              <span key={day} className="weekday">{day}</span>
            ))}
          </div>
          <div className="sidebar-calendar-days">
            {calendarCells.map((day, index) => (
              <span
                key={`ticket-day-${index}`}
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
  );
}

import { useState, useEffect, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api from "../../api";
import NotificationBell from "../../components/NotificationBell";
import TicketWorkspaceSidebar from "../../components/TicketWorkspaceSidebar";
import "./Dashboard.css";
import "../../pages/TicketTheme.css";
import "./TechnicianTickets.css";

const Toast = ({ message, type, onClose }) => (
  <div className={`tt-toast tt-toast-${type}`}>
    <span>{message}</span>
    <button onClick={onClose} className="tt-toast-close">x</button>
  </div>
);

const STATUS_CLASS = {
  OPEN: "tt-badge-open",
  IN_PROGRESS: "tt-badge-progress",
  RESOLVED: "tt-badge-resolved",
  CLOSED: "tt-badge-closed",
  REJECTED: "tt-badge-rejected",
};

const PRIORITY_CLASS = {
  HIGH: "tt-pri-high",
  MEDIUM: "tt-pri-medium",
  LOW: "tt-pri-low",
};

const normalizeUserPayload = (payload) => payload?.user ?? payload ?? null;

const normalizeRole = (roleValue) => {
  const role = String(roleValue || "").toUpperCase();
  if (role.includes("ADMIN")) return "ADMIN";
  if (role.includes("TECHNICIAN")) return "TECHNICIAN";
  return "USER";
};

const formatDate = (value) => {
  if (!value) return "N/A";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "N/A" : date.toLocaleDateString();
};

const QuickUpdate = ({ ticket, onUpdated, onCancel, showToast }) => {
  const [status, setStatus] = useState(ticket.status || "IN_PROGRESS");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!status) return;
    setSaving(true);
    try {
      const params = { status };
      if (notes.trim()) params.notes = notes.trim();
      await api.put(`/api/tickets/${ticket.id}/status`, null, { params });
      showToast(`Ticket #${ticket.id} updated to ${String(status).replace("_", " ")}`, "success");
      onUpdated();
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data || "Update failed.";
      showToast(typeof msg === "string" ? msg : "Update failed.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="tt-quick-update">
      <h4>Quick Update - #{ticket.id}: {ticket.title}</h4>
      <div className="tt-qu-row">
        <div className="tt-qu-field">
          <label>New Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
        <div className="tt-qu-field tt-qu-notes">
          <label>
            {status === "RESOLVED" ? "Resolution Notes" : "Progress Notes"}{" "}
            {status === "RESOLVED" && <span className="tt-required">(recommended)</span>}
          </label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={
              status === "RESOLVED"
                ? "Describe what was done to resolve the issue..."
                : "Add a progress note (optional)..."
            }
          />
        </div>
      </div>
      <div className="tt-qu-actions">
        <button onClick={submit} disabled={saving} className="tt-btn tt-btn-primary">
          {saving ? "Saving..." : "Save Update"}
        </button>
        <button onClick={onCancel} className="tt-btn tt-btn-ghost">Cancel</button>
        <Link to={`/tickets/${ticket.id}`} className="tt-btn tt-btn-outline">
          Open Full Detail -&gt;
        </Link>
      </div>
    </div>
  );
};

const TechnicianTickets = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isAppointmentsView = location.pathname.startsWith("/technician/appointments");
  const [tickets, setTickets] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [activeUpdate, setActiveUpdate] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const fetchCurrentUser = useCallback(async () => {
    try {
      const userRes = await api.get("/user/me");
      return normalizeUserPayload(userRes?.data);
    } catch {
      try {
        const authRes = await api.get("/auth/me");
        return normalizeUserPayload(authRes?.data);
      } catch {
        return null;
      }
    }
  }, []);

  const fetchTickets = useCallback(async () => {
    try {
      const ticketsRes = await api.get("/api/tickets/my-assigned");
      const ticketsPayload = ticketsRes?.data;
      const normalizedTickets = Array.isArray(ticketsPayload)
        ? ticketsPayload
        : Array.isArray(ticketsPayload?.data)
          ? ticketsPayload.data
          : [];
      setTickets(normalizedTickets);

      const currentUser = await fetchCurrentUser();
      setUser(currentUser);

      if (currentUser && normalizeRole(currentUser.role) !== "TECHNICIAN") {
        showToast("This page is for technicians.", "error");
      }
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        navigate("/login", { replace: true });
      } else {
        showToast("Failed to load your tickets.", "error");
      }
    } finally {
      setLoading(false);
    }
  }, [fetchCurrentUser, navigate, showToast]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const stats = {
    total: tickets.length,
    inProgress: tickets.filter((t) => t.status === "IN_PROGRESS").length,
    resolved: tickets.filter((t) => t.status === "RESOLVED").length,
    open: tickets.filter((t) => t.status === "OPEN").length,
  };

  const filtered = filter === "ALL"
    ? tickets
    : tickets.filter((t) => t.status === filter);

  if (loading) {
    return (
      <div className="md-screen loading">
        <div className="md-spinner" />
        <p>Loading your assignments...</p>
      </div>
    );
  }

  return (
    <div className="md-screen ticket-page-shell">
      <div className="md-layout ticket-layout-shell">
        <TicketWorkspaceSidebar mode="technician" />
        <main className="md-main">
          {toast && (
            <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
          )}

          <header className="md-topbar ticket-topbar">
            <div className="md-topbar-left">
              <h1 className="md-title">{isAppointmentsView ? "Work Appointments" : "My Assigned Tickets"}</h1>
              <p className="md-subtitle">
                Welcome, <strong>{user?.firstname || "Technician"} {user?.lastName || user?.lastname || ""}</strong> -{" "}
                {isAppointmentsView ? "review your assigned work appointments." : "manage your assigned tasks."}
              </p>
            </div>
            <div className="ticket-topbar-actions">
              <NotificationBell />
              <button onClick={() => navigate("/techhome")} className="ticket-back-btn">
                Back to Dashboard
              </button>
            </div>
          </header>

          <div className="md-content-scroll">
            <div className="md-panel ticket-panel">
              <div className="tt-page">
                <div className="tt-stats">
                  {[
                    { label: "Total Assigned", value: stats.total, color: "#6366f1" },
                    { label: "In Progress", value: stats.inProgress, color: "#f59e0b" },
                    { label: "Open", value: stats.open, color: "#3b82f6" },
                    { label: "Resolved", value: stats.resolved, color: "#22c55e" },
                  ].map((s) => (
                    <div key={s.label} className="tt-stat-card" style={{ borderTopColor: s.color }}>
                      <span className="tt-stat-value" style={{ color: s.color }}>{s.value}</span>
                      <span className="tt-stat-label">{s.label}</span>
                    </div>
                  ))}
                </div>

                <div className="tt-filter-bar">
                  {["ALL", "OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"].map((s) => (
                    <button
                      key={s}
                      className={`tt-filter-btn ${filter === s ? "tt-filter-active" : ""}`}
                      onClick={() => setFilter(s)}
                    >
                      {s.replace("_", " ")}
                      <span className="tt-filter-count">
                        {s === "ALL" ? tickets.length : tickets.filter((t) => t.status === s).length}
                      </span>
                    </button>
                  ))}
                </div>

                {filtered.length === 0 ? (
                  <div className="tt-empty">
                    <div className="tt-empty-icon">No Tickets</div>
                    <h3>No tickets here</h3>
                    <p>
                      {filter === "ALL"
                        ? "No tickets have been assigned to you yet."
                        : `No tickets with status "${filter.replace("_", " ")}".`}
                    </p>
                  </div>
                ) : (
                  <div className="tt-list">
                    {filtered.map((ticket) => (
                      <div key={ticket.id} className="tt-card">
                        <div className="tt-card-top">
                          <div className="tt-card-id-block">
                            <span className="tt-card-id">#{ticket.id}</span>
                            <span className={`tt-badge ${STATUS_CLASS[ticket.status] || ""}`}>
                              {String(ticket.status || "OPEN").replace("_", " ")}
                            </span>
                          </div>
                          <span className={`tt-priority ${PRIORITY_CLASS[ticket.priority] || ""}`}>
                            {ticket.priority || "MEDIUM"}
                          </span>
                        </div>

                        <div className="tt-card-body">
                          <h3 className="tt-card-title">{ticket.title || "Untitled Ticket"}</h3>
                          <p className="tt-card-desc">
                            {ticket.description?.length > 120
                              ? `${ticket.description.slice(0, 120)}...`
                              : (ticket.description || "No description")}
                          </p>
                          <div className="tt-card-meta">
                            <span>Location: {ticket.location || "N/A"}</span>
                            <span>Category: {ticket.category || "N/A"}</span>
                            <span>Reported by: {ticket.createdBy || "Unknown User"}</span>
                            <span>Date: {formatDate(ticket.createdAt)}</span>
                          </div>

                          {ticket.resolutionNotes && (
                            <div className="tt-resolution-note">
                              <strong>Resolution:</strong> {ticket.resolutionNotes}
                            </div>
                          )}
                        </div>

                        <div className="tt-card-actions">
                          {ticket.status !== "RESOLVED" && ticket.status !== "CLOSED" && ticket.status !== "REJECTED" ? (
                            <button
                              className="tt-btn tt-btn-primary"
                              onClick={() => setActiveUpdate(activeUpdate === ticket.id ? null : ticket.id)}
                            >
                              {activeUpdate === ticket.id ? "Cancel Update" : "Update Status"}
                            </button>
                          ) : (
                            <span className="tt-done-label">
                              {ticket.status === "RESOLVED" ? "Resolved" : "Closed"}
                            </span>
                          )}
                          <Link to={`/tickets/${ticket.id}`} className="tt-btn tt-btn-outline">
                            View Full Detail &gt;
                          </Link>
                        </div>

                        {activeUpdate === ticket.id && (
                          <QuickUpdate
                            ticket={ticket}
                            onUpdated={() => {
                              setActiveUpdate(null);
                              fetchTickets();
                            }}
                            onCancel={() => setActiveUpdate(null)}
                            showToast={showToast}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default TechnicianTickets;

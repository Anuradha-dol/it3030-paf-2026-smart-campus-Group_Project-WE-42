import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import api from "../api";
import NotificationBell from "../components/NotificationBell";
import TicketWorkspaceSidebar from "../components/TicketWorkspaceSidebar";
import "../auth/user/Dashboard.css";
import "./TicketTheme.css";
import "./TicketDashboard.css";

const normalizeStatus = (status) => {
  const allowed = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED", "REJECTED"];
  const value = typeof status === "string" ? status.toUpperCase() : "OPEN";
  return allowed.includes(value) ? value : "OPEN";
};

const normalizePriority = (priority) => {
  const allowed = ["HIGH", "MEDIUM", "LOW"];
  const value = typeof priority === "string" ? priority.toUpperCase() : "MEDIUM";
  return allowed.includes(value) ? value : "MEDIUM";
};

const TicketDashboard = () => {
  const location = useLocation();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("ALL");
  const isAdminView = location.pathname.startsWith("/admin/tickets");
  const ticketBasePath = isAdminView ? "/admin/tickets" : "/tickets";

  useEffect(() => {
    const fetchData = async () => {
      try {
        const ticketsRes = await api.get("/api/tickets");
        const ticketsPayload = ticketsRes?.data;
        const normalizedTickets = Array.isArray(ticketsPayload)
          ? ticketsPayload
          : Array.isArray(ticketsPayload?.data)
            ? ticketsPayload.data
            : [];

        setTickets(normalizedTickets);
      } catch (err) {
        if (err.response?.status === 401 || err.response?.status === 403) {
          setError("Your session expired. Please log in again.");
        } else {
          setError("Failed to load tickets. Please try again.");
        }
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredTickets = tickets.filter(
    (t) => filter === "ALL" || normalizeStatus(t?.status) === filter
  );

  const getStatusColor = (status) => {
    switch (normalizeStatus(status)) {
      case "OPEN": return "status-open";
      case "IN_PROGRESS": return "status-progress";
      case "RESOLVED": return "status-resolved";
      case "CLOSED": return "status-closed";
      case "REJECTED": return "status-rejected";
      default: return "";
    }
  };

  const getPriorityColor = (priority) => {
    switch (normalizePriority(priority)) {
      case "HIGH": return "priority-high";
      case "MEDIUM": return "priority-medium";
      case "LOW": return "priority-low";
      default: return "";
    }
  };

  if (loading) {
    return (
      <div className="md-screen loading">
        <div className="md-spinner" />
        <p>Loading tickets...</p>
      </div>
    );
  }

  return (
    <div className="md-screen ticket-page-shell">
      <div className="md-layout ticket-layout-shell">
        <TicketWorkspaceSidebar mode={isAdminView ? "admin" : "user"} />
        <main className="md-main">
          <header className="md-topbar ticket-topbar">
            <div className="md-topbar-left">
              <h1 className="md-title">{isAdminView ? "Admin Ticket Desk" : "Incident Ticketing"}</h1>
              <p className="md-subtitle">
                {isAdminView
                  ? "Review, assign, and monitor maintenance tickets."
                  : "Create and track campus maintenance requests."}
              </p>
            </div>
            <div className="ticket-topbar-actions">
              <NotificationBell />
              <Link to={`${ticketBasePath}/create`} className="create-btn">
                <span>+</span> Create New Ticket
              </Link>
            </div>
          </header>

          {error && <div className="md-alert error">{error}</div>}

          <div className="md-content-scroll">
            <div className="md-panel ticket-panel">
              <div className="top-bar">
                <div className="filter-group">
                  <label>Filter by Status:</label>
                  <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                    <option value="ALL">All Tickets</option>
                    <option value="OPEN">Open</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="RESOLVED">Resolved</option>
                    <option value="REJECTED">Rejected</option>
                    <option value="CLOSED">Closed</option>
                  </select>
                </div>
                <div className="stats-group">
                  <div className="stat-item">
                    <span className="stat-label">Total</span>
                    <span className="stat-value">{tickets.length}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Open</span>
                    <span className="stat-value">
                      {tickets.filter((t) => normalizeStatus(t?.status) === "OPEN").length}
                    </span>
                  </div>
                </div>
              </div>

              <div className="ticket-grid">
                {filteredTickets.map((ticket) => {
                  const status = normalizeStatus(ticket?.status);
                  const priority = normalizePriority(ticket?.priority);

                  return (
                    <Link to={`${ticketBasePath}/${ticket.id}`} key={ticket.id} className="ticket-card">
                      <div className="ticket-card-header">
                        <span className={`status-badge ${getStatusColor(status)}`}>
                          {status.replace("_", " ")}
                        </span>
                        <span className={`priority-badge ${getPriorityColor(priority)}`}>
                          {priority}
                        </span>
                      </div>
                      <div className="ticket-card-body">
                        <h3>{ticket.title || "Untitled Ticket"}</h3>
                        <p className="ticket-category">{ticket.category || "Uncategorized"}</p>
                        <div className="ticket-meta">
                          <div className="meta-item">
                            <span className="meta-label">Location:</span>
                            <span className="meta-value">{ticket.location || "N/A"}</span>
                          </div>
                          <div className="meta-item">
                            <span className="meta-label">Date:</span>
                            <span className="meta-value">
                              {ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString() : "N/A"}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="ticket-card-footer">
                        <div className="technician-info">
                          <span className="tech-label">Assigned to:</span>
                          <span className="tech-name">{ticket.assignedTechnician || "Unassigned"}</span>
                        </div>
                        <span className="view-link">View Details &gt;</span>
                      </div>
                    </Link>
                  );
                })}
              </div>

              {filteredTickets.length === 0 && (
                <div className="empty-state">
                  <p>No tickets found matching the filter.</p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default TicketDashboard;

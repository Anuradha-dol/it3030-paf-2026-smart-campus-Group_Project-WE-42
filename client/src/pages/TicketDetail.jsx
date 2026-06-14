import { useState, useEffect, useCallback } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import api from "../api";
import NotificationBell from "../components/NotificationBell";
import TicketWorkspaceSidebar from "../components/TicketWorkspaceSidebar";
import "../auth/user/Dashboard.css";
import "./TicketTheme.css";
import "./TicketDetail.css";

const Toast = ({ message, type, onClose }) => (
  <div className={`toast toast-${type}`}>
    <span>{message}</span>
    <button onClick={onClose} className="toast-close">x</button>
  </div>
);

const normalizeRole = (roleValue) => {
  const role = String(roleValue || "").toUpperCase();
  if (role.includes("ADMIN")) return "ADMIN";
  if (role.includes("TECHNICIAN")) return "TECHNICIAN";
  return "USER";
};

const normalizeTicketPayload = (payload) => payload?.data ?? payload ?? null;
const normalizeUserPayload = (payload) => payload?.user ?? payload ?? null;

const formatDateTime = (value) => {
  if (!value) return "N/A";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "N/A" : date.toLocaleString();
};

const buildAttachmentUrl = (filePath) => {
  if (!filePath) return "#";
  const path = String(filePath);
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${api.defaults.baseURL}${normalized}`;
};

const TicketDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdminView = location.pathname.startsWith("/admin/tickets/");
  const ticketBasePath = isAdminView ? "/admin/tickets" : "/tickets";

  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [technicians, setTechnicians] = useState([]);

  const [comment, setComment] = useState("");
  const [statusUpdate, setStatusUpdate] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedTech, setSelectedTech] = useState("");

  const [assigning, setAssigning] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [postingComment, setPostingComment] = useState(false);

  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const fetchCurrentUser = useCallback(async () => {
    try {
      const userRes = await api.get("/user/me");
      return normalizeUserPayload(userRes?.data);
    } catch (primaryError) {
      try {
        const authRes = await api.get("/auth/me");
        return normalizeUserPayload(authRes?.data);
      } catch {
        if (primaryError?.response?.status === 401 || primaryError?.response?.status === 403) {
          return null;
        }
        return null;
      }
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const ticketRes = await api.get(`/api/tickets/${id}`);
      const normalizedTicket = normalizeTicketPayload(ticketRes?.data);
      setTicket(normalizedTicket);
      setStatusUpdate(normalizedTicket?.status || "OPEN");

      const currentUser = await fetchCurrentUser();
      setUser(currentUser);

      if (normalizeRole(currentUser?.role) === "ADMIN") {
        try {
          const usersRes = await api.get("/api/tickets/assignable-users");
          const usersPayload = usersRes?.data;
          const normalizedUsers = Array.isArray(usersPayload)
            ? usersPayload
            : Array.isArray(usersPayload?.data)
              ? usersPayload.data
              : [];
          setTechnicians(normalizedUsers);
        } catch (err) {
          console.warn("Could not load assignable users:", err.message);
          setTechnicians([]);
        }
      } else {
        setTechnicians([]);
      }
    } catch (err) {
      console.error("Failed to load ticket:", err);
      if (err.response?.status === 401 || err.response?.status === 403) {
        showToast("Your session expired. Please log in again.", "error");
      } else {
        showToast("Failed to load ticket details.", "error");
      }
      setTicket(null);
    } finally {
      setLoading(false);
    }
  }, [fetchCurrentUser, id, showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddComment = async (e) => {
    e.preventDefault();
    const message = comment.trim();
    if (!message) return;

    setPostingComment(true);
    try {
      await api.post(`/api/tickets/${id}/comments`, null, { params: { message } });
      setComment("");
      await fetchData();
      showToast("Comment posted successfully.");
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data || "Failed to post comment.";
      showToast(typeof msg === "string" ? msg : "Failed to post comment.", "error");
      console.error("Comment error:", err.response?.data);
    } finally {
      setPostingComment(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!statusUpdate) return;
    if (statusUpdate === "REJECTED" && !notes.trim()) {
      showToast("Rejection reason is required.", "error");
      return;
    }

    setUpdatingStatus(true);
    try {
      const params = { status: statusUpdate };
      if (notes.trim()) params.notes = notes.trim();
      await api.put(`/api/tickets/${id}/status`, null, { params });
      setNotes("");
      await fetchData();
      showToast("Status updated successfully.");
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data || "Failed to update status.";
      showToast(typeof msg === "string" ? msg : "Failed to update status.", "error");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleAssignTech = async () => {
    if (!selectedTech) {
      showToast("Please select a user to assign.", "error");
      return;
    }
    setAssigning(true);
    try {
      await api.put(`/api/tickets/${id}/assign`, null, { params: { technicianId: selectedTech } });
      await fetchData();
      setSelectedTech("");
      showToast("Technician assigned successfully.");
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data || "Failed to assign technician.";
      showToast(typeof msg === "string" ? msg : "Failed to assign technician.", "error");
      console.error("Assignment error:", err.response?.data);
    } finally {
      setAssigning(false);
    }
  };

  if (loading) {
    return (
      <div className="md-screen loading">
        <div className="md-spinner" />
        <p>Loading ticket details...</p>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="md-screen ticket-page-shell">
        <div className="md-layout ticket-layout-shell">
          <TicketWorkspaceSidebar mode={isAdminView ? "admin" : "user"} />
          <main className="md-main">
            <div className="md-alert error">Ticket not found</div>
          </main>
        </div>
      </div>
    );
  }

  const role = normalizeRole(user?.role);
  const isAdmin = role === "ADMIN";
  const isAssignedTech =
    ticket.assignedTechnicianId != null &&
    user?.userId != null &&
    String(ticket.assignedTechnicianId) === String(user.userId);
  const canUpdateStatus = isAdmin || isAssignedTech;
  const sidebarMode = isAdmin ? "admin" : role === "TECHNICIAN" ? "technician" : "user";

  const statusValue = String(ticket.status || "OPEN").toUpperCase();
  const statusClass = statusValue.toLowerCase();
  const statusLabel = statusValue.replace(/_/g, " ");

  return (
    <div className="md-screen ticket-page-shell">
      <div className="md-layout ticket-layout-shell">
        <TicketWorkspaceSidebar mode={sidebarMode} />
        <main className="md-main">
          {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

          <header className="md-topbar ticket-topbar">
            <div className="md-topbar-left">
              <h1 className="md-title">Ticket #{ticket.id}</h1>
              <p className="md-subtitle">Track status, assignment, and discussion in one place.</p>
            </div>
            <div className="ticket-topbar-actions">
              <NotificationBell />
              <button onClick={() => navigate(ticketBasePath)} className="ticket-back-btn">
                Back to Tickets
              </button>
            </div>
          </header>

          <div className="md-content-scroll">
            <div className="md-panel ticket-panel">
              <div className="detail-container">
                <aside className="detail-sidebar">
                  <div className="detail-status-card">
                    <h3>Status Control</h3>
                    <div className={`status-banner ${statusClass}`}>{statusLabel}</div>

                    {canUpdateStatus && (
                      <div className="status-actions">
                        <label>Update Status</label>
                        <select value={statusUpdate} onChange={(e) => setStatusUpdate(e.target.value)}>
                          <option value="OPEN">Open</option>
                          <option value="IN_PROGRESS">In Progress</option>
                          <option value="RESOLVED">Resolved</option>
                          {isAdmin && <option value="REJECTED">Rejected</option>}
                          <option value="CLOSED">Closed</option>
                        </select>
                        <textarea
                          placeholder={
                            statusUpdate === "REJECTED"
                              ? "Rejection reason (required)..."
                              : "Add resolution notes (optional)..."
                          }
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                        />
                        <button onClick={handleStatusUpdate} className="submit-btn" disabled={updatingStatus}>
                          {updatingStatus ? "Updating..." : "Update Status"}
                        </button>
                      </div>
                    )}

                    {isAdmin && (
                      <div className="assignment-actions">
                        <label>
                          Assign Technician
                          {ticket.assignedTechnician && ticket.assignedTechnician !== "Unassigned" && (
                            <span className="currently-assigned"> (Currently: {ticket.assignedTechnician})</span>
                          )}
                        </label>
                        <select value={selectedTech} onChange={(e) => setSelectedTech(e.target.value)}>
                          <option value="">
                            {technicians.length === 0 ? "No users available" : "Select a technician..."}
                          </option>
                          {technicians.map((tech) => (
                            <option key={tech.userId} value={tech.userId}>
                              {(tech.firstname || "")} {(tech.lastName || tech.lastname || "")} (
                              {tech.role || "USER"})
                            </option>
                          ))}
                        </select>
                        {technicians.length === 0 && (
                          <p className="no-tech-warning">No assignable technicians found.</p>
                        )}
                        <button
                          onClick={handleAssignTech}
                          className="ticket-back-btn"
                          disabled={assigning || technicians.length === 0}
                        >
                          {assigning ? "Assigning..." : "Assign"}
                        </button>
                      </div>
                    )}
                  </div>
                </aside>

                <section className="detail-main">
                  <article className="ticket-info">
                    <div className="ticket-info-header">
                      <span className="ticket-id">#{ticket.id}</span>
                      <span className={`priority-tag ${String(ticket.priority || "medium").toLowerCase()}`}>
                        {ticket.priority || "MEDIUM"} Priority
                      </span>
                    </div>
                    <h1>{ticket.title || "Untitled Ticket"}</h1>
                    <div className="ticket-details-grid">
                      <div className="detail-item">
                        <label>Category</label>
                        <p>{ticket.category || "N/A"}</p>
                      </div>
                      <div className="detail-item">
                        <label>Location</label>
                        <p>{ticket.location || "N/A"}</p>
                      </div>
                      <div className="detail-item">
                        <label>Created By</label>
                        <p>{ticket.createdBy || "Unknown User"}</p>
                      </div>
                      <div className="detail-item">
                        <label>Assigned To</label>
                        <p>
                          {ticket.assignedTechnician && ticket.assignedTechnician !== "Unassigned" ? (
                            ticket.assignedTechnician
                          ) : (
                            <em style={{ color: "var(--text-muted, #999)" }}>Unassigned</em>
                          )}
                        </p>
                      </div>
                      <div className="detail-item">
                        <label>Contact</label>
                        <p>{ticket.contactNumber || "N/A"}</p>
                      </div>
                      <div className="detail-item">
                        <label>Created</label>
                        <p>{formatDateTime(ticket.createdAt)}</p>
                      </div>
                    </div>

                    <div className="ticket-description">
                      <label>Description</label>
                      <p>{ticket.description || "No description provided."}</p>
                    </div>

                    {ticket.resolutionNotes && (
                      <div className="resolution-info success-box">
                        <label>Resolution Notes</label>
                        <p>{ticket.resolutionNotes}</p>
                      </div>
                    )}

                    {ticket.rejectionReason && (
                      <div className="resolution-info danger-box">
                        <label>Rejection Reason</label>
                        <p>{ticket.rejectionReason}</p>
                      </div>
                    )}

                    {ticket.attachments?.length > 0 && (
                      <div className="attachments-section">
                        <label>Attachments ({ticket.attachments.length})</label>
                        <div className="attachments-grid">
                          {ticket.attachments.map((att) => (
                            <a
                              key={att.id}
                              href={buildAttachmentUrl(att.filePath)}
                              target="_blank"
                              rel="noreferrer"
                              className="attachment-preview"
                            >
                              <div className="img-placeholder">Attachment</div>
                              <span>{att.fileName || "File"}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </article>

                  <section className="comments-section">
                    <h3>Discussion ({ticket.comments?.length || 0})</h3>
                    <div className="comments-list">
                      {ticket.comments?.length === 0 && (
                        <p className="no-comments">No comments yet. Be the first!</p>
                      )}
                      {ticket.comments?.map((c) => (
                        <div key={c.id} className="comment-item">
                          <div className="comment-header">
                            <strong>{c.username || "Unknown User"}</strong>
                            <span>{formatDateTime(c.createdAt)}</span>
                          </div>
                          <p>{c.message || ""}</p>
                        </div>
                      ))}
                    </div>

                    <form onSubmit={handleAddComment} className="comment-form">
                      <textarea
                        placeholder="Add a comment..."
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        required
                      />
                      <button type="submit" className="submit-btn" disabled={postingComment}>
                        {postingComment ? "Posting..." : "Post Comment"}
                      </button>
                    </form>
                  </section>
                </section>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default TicketDetail;

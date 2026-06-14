import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../api";
import NotificationBell from "../components/NotificationBell";
import TicketWorkspaceSidebar from "../components/TicketWorkspaceSidebar";
import "../auth/user/Dashboard.css";
import "./TicketTheme.css";
import "./CreateTicket.css";

const CreateTicket = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isAdminView = location.pathname.startsWith("/admin/tickets");
  const ticketBasePath = isAdminView ? "/admin/tickets" : "/tickets";

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    priority: "MEDIUM",
    location: "",
    contactNumber: ""
  });
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length > 3) {
      setError("You can only upload a maximum of 3 images.");
      return;
    }
    setFiles(selectedFiles);
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const data = new FormData();
    data.append("ticket", new Blob([JSON.stringify(formData)], { type: "application/json" }));
    files.forEach((file) => {
      data.append("files", file);
    });

    try {
      await api.post("/api/tickets", data, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      navigate(ticketBasePath);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        navigate("/login", { replace: true });
        return;
      }

      const payload = err.response?.data;
      const message =
        typeof payload === "string"
          ? payload
          : payload?.message || "Failed to create ticket. Please try again.";

      setError(message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="md-screen ticket-page-shell">
      <div className="md-layout ticket-layout-shell">
        <TicketWorkspaceSidebar mode={isAdminView ? "admin" : "user"} />
        <main className="md-main">
          <header className="md-topbar ticket-topbar">
            <div className="md-topbar-left">
              <h1 className="md-title">{isAdminView ? "Create Admin Ticket" : "Report an Incident"}</h1>
              <p className="md-subtitle">
                Provide clear details so the maintenance team can resolve this quickly.
              </p>
            </div>
            <div className="ticket-topbar-actions">
              <NotificationBell />
              <button type="button" onClick={() => navigate(ticketBasePath)} className="ticket-back-btn">
                Back to Tickets
              </button>
            </div>
          </header>

          {error && <div className="md-alert error">{error}</div>}

          <div className="md-content-scroll">
            <div className="md-panel ticket-panel create-ticket-panel">
              <header className="form-header">
                <h2>Create Ticket Request</h2>
                <p>Fill all required fields and attach up to 3 images.</p>
              </header>

              <form onSubmit={handleSubmit} className="ticket-form">
                <div className="form-grid">
                  <div className="form-group full-width">
                    <label>Issue Title</label>
                    <input
                      type="text"
                      name="title"
                      value={formData.title}
                      onChange={handleChange}
                      placeholder="Briefly describe the problem"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Category</label>
                    <select name="category" value={formData.category} onChange={handleChange} required>
                      <option value="">Select Category</option>
                      <option value="Electrical">Electrical</option>
                      <option value="Plumbing">Plumbing</option>
                      <option value="Network/IT">Network / IT</option>
                      <option value="Hardware">Hardware</option>
                      <option value="Furniture">Furniture</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Priority</label>
                    <select name="priority" value={formData.priority} onChange={handleChange} required>
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Location / Resource</label>
                    <input
                      type="text"
                      name="location"
                      value={formData.location}
                      onChange={handleChange}
                      placeholder="e.g. Lab 01, Room 204"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Contact Number</label>
                    <input
                      type="text"
                      name="contactNumber"
                      value={formData.contactNumber}
                      onChange={handleChange}
                      placeholder="Your phone number"
                    />
                  </div>

                  <div className="form-group full-width">
                    <label>Detailed Description</label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      placeholder="Describe exactly what happened..."
                      rows="5"
                      required
                    />
                  </div>

                  <div className="form-group full-width">
                    <label>Attachments (Max 3 images)</label>
                    <div className="file-upload-wrapper">
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleFileChange}
                        id="file-input"
                      />
                      <label htmlFor="file-input" className="file-input-label">
                        <span className="upload-icon">Upload</span>
                        {files.length > 0 ? `${files.length} files selected` : "Choose Images"}
                      </label>
                    </div>
                    <div className="file-previews">
                      {files.map((file, idx) => (
                        <div key={idx} className="file-preview-item">
                          {file.name}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="form-actions">
                  <button type="button" onClick={() => navigate(ticketBasePath)} className="ticket-back-btn">
                    Cancel
                  </button>
                  <button type="submit" className="submit-btn" disabled={loading}>
                    {loading ? "Submitting..." : "Submit Ticket"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default CreateTicket;

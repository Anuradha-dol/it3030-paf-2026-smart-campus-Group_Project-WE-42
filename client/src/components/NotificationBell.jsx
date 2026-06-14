import { useEffect, useRef, useState } from "react";
import api from "../api";
import {
  deleteNotificationById,
  getNotifications,
  getUnreadCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "../services/notificationService";
import "./NotificationBell.css";

const MAX_NOTIFICATIONS = 20;
const WS_RECONNECT_DELAY_MS = 3000;

function formatTimestamp(value) {
  if (!value) return "Just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";
  return date.toLocaleString();
}

function normalizeNotification(notificationLike) {
  // Keep a stable shape for UI rendering.
  const notification = notificationLike || {};
  return {
    id: notification.id,
    type: notification.type || "",
    targetType: notification.targetType || "",
    targetId: notification.targetId || null,
    message: notification.message || "You have a new notification.",
    read: Boolean(notification.read),
    createdAt: notification.createdAt || null,
  };
}

function buildWebSocketUrl() {
  // Convert API base URL to websocket URL.
  const baseUrl = String(api?.defaults?.baseURL || "http://localhost:8081").replace(/\/+$/, "");
  if (baseUrl.startsWith("https://")) {
    return `wss://${baseUrl.slice("https://".length)}/ws/notifications`;
  }
  if (baseUrl.startsWith("http://")) {
    return `ws://${baseUrl.slice("http://".length)}/ws/notifications`;
  }
  return `${baseUrl}/ws/notifications`;
}

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const panelRef = useRef(null);
  // Track ids already shown to avoid badge over-counting.
  const knownIdsRef = useRef(new Set());

  const refreshUnreadCount = async () => {
    try {
      const count = await getUnreadCount();
      setUnreadCount(count);
    } catch {
      // Ignore transient count failures to avoid noisy UI.
    }
  };

  const loadNotifications = async () => {
    setLoading(true);
    setError("");
    try {
      // Load latest notifications when panel opens.
      const rows = await getNotifications(MAX_NOTIFICATIONS);
      setNotifications(rows.map(normalizeNotification));
      await refreshUnreadCount();
    } catch {
      setError("Failed to load notifications.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Keep unread badge fresh in background.
    refreshUnreadCount();
    const timer = setInterval(refreshUnreadCount, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Rebuild quick lookup set when list changes.
    knownIdsRef.current = new Set(
      notifications
        .map((item) => item.id)
        .filter((id) => id !== null && id !== undefined)
    );
  }, [notifications]);

  useEffect(() => {
    let socket = null;
    let reconnectTimer = null;
    let shouldReconnect = true;

    const connect = () => {
      // Open notification websocket channel.
      socket = new WebSocket(buildWebSocketUrl());

      socket.onmessage = (event) => {
        if (!event?.data) return;

        let parsed;
        try {
          parsed = JSON.parse(event.data);
        } catch {
          return;
        }

        const incoming = normalizeNotification(parsed);
        if (!incoming.id) {
          return;
        }

        // Track whether this is a brand-new notification.
        const wasKnown = knownIdsRef.current.has(incoming.id);

        setNotifications((prev) => {
          const existingIndex = prev.findIndex((item) => item.id === incoming.id);
          if (existingIndex >= 0) {
            const next = [...prev];
            next[existingIndex] = incoming;
            return next;
          }
          return [incoming, ...prev].slice(0, MAX_NOTIFICATIONS);
        });

        if (!wasKnown && !incoming.read) {
          setUnreadCount((prev) => prev + 1);
        }
      };

      socket.onclose = () => {
        if (!shouldReconnect) return;
        // Retry websocket connection after short delay.
        reconnectTimer = setTimeout(connect, WS_RECONNECT_DELAY_MS);
      };

      socket.onerror = () => {
        try {
          socket?.close();
        } catch {
          // Ignore close errors.
        }
      };
    };

    connect();

    return () => {
      shouldReconnect = false;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        socket.close();
      }
    };
  }, []);

  useEffect(() => {
    // Fetch list only when panel becomes visible.
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleOutsideClick = (event) => {
      // Close panel when clicking outside.
      if (!panelRef.current || panelRef.current.contains(event.target)) {
        return;
      }
      setIsOpen(false);
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isOpen]);

  const handleMarkOneRead = async (id) => {
    try {
      // Update one notification and badge count.
      const updated = normalizeNotification(await markNotificationAsRead(id));
      setNotifications((prev) => prev.map((item) => (item.id === id ? updated : item)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      setError("Unable to mark notification as read.");
    }
  };

  const handleMarkAllRead = async () => {
    try {
      // Mark all notifications as read in one call.
      const updatedCount = await markAllNotificationsAsRead();
      if (updatedCount > 0) {
        setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
      }
      setUnreadCount(0);
    } catch {
      setError("Unable to mark all notifications as read.");
    }
  };

  const handleDelete = async (id) => {
    try {
      // Delete one notification and sync local state.
      const target = notifications.find((item) => item.id === id);
      await deleteNotificationById(id);
      setNotifications((prev) => prev.filter((item) => item.id !== id));
      if (target && !target.read) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch {
      setError("Unable to delete notification.");
    }
  };

  return (
    <div className="notify-bell-wrap" ref={panelRef}>
      <button
        type="button"
        className="notify-bell-btn"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Open notifications"
        aria-expanded={isOpen}
      >
        <svg viewBox="0 0 24 24" role="img" aria-hidden="true" focusable="false">
          <path d="M12 3a5 5 0 0 0-5 5v3.7c0 .8-.3 1.5-.8 2.1l-1.1 1.2a1 1 0 0 0 .7 1.7h12.4a1 1 0 0 0 .7-1.7l-1.1-1.2a3 3 0 0 1-.8-2.1V8a5 5 0 0 0-5-5z" />
          <path d="M9.8 18.5a2.3 2.3 0 0 0 4.4 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="notify-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="notify-panel" role="dialog" aria-label="Notification panel">
          <div className="notify-panel-head">
            <h3>Notifications</h3>
            <button
              type="button"
              className="notify-link-btn"
              onClick={handleMarkAllRead}
              disabled={unreadCount === 0}
            >
              Mark all read
            </button>
          </div>

          {loading && <p className="notify-state">Loading...</p>}
          {!loading && error && <p className="notify-state notify-error">{error}</p>}
          {!loading && !error && notifications.length === 0 && (
            <p className="notify-state">No notifications yet.</p>
          )}

          {!loading && notifications.length > 0 && (
            <ul className="notify-list">
              {notifications.map((item) => (
                <li
                  key={item.id}
                  className={`notify-item${item.read ? " read" : " unread"}`}
                >
                  <div className="notify-body">
                    <p>{item.message}</p>
                    <span>{formatTimestamp(item.createdAt)}</span>
                  </div>
                  <div className="notify-actions">
                    {!item.read && (
                      <button
                        type="button"
                        className="notify-link-btn"
                        onClick={() => handleMarkOneRead(item.id)}
                      >
                        Read
                      </button>
                    )}
                    <button
                      type="button"
                      className="notify-link-btn danger"
                      onClick={() => handleDelete(item.id)}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

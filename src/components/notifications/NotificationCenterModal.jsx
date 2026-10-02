import React, { useState, useEffect } from "react";
import {
  fetchNotificationsLive,
  markNotificationReadLive,
  markAllNotificationsReadLive,
  onRealtimeEvent,
} from "../../services/realtime";
import "../../styles/notifications.css";

export default function NotificationCenterModal({ isOpen, onClose, userId = 1, onOpenAction }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("all"); // 'all' | 'unread' | 'payment' | 'chat' | 'attendance' | 'trainer_change'
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const res = await fetchNotificationsLive(userId, { limit: 50 });
      if (res && res.success) {
        setNotifications(res.notifications || []);
        setUnreadCount(res.unreadCount || 0);
      }
    } catch (err) {
      console.warn("Failed to load notifications:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen, userId]);

  useEffect(() => {
    const unsubNotif = onRealtimeEvent("notification:new", (notif) => {
      if (!notif.recipient_user_id || Number(notif.recipient_user_id) === Number(userId)) {
        setNotifications((prev) => [notif, ...prev]);
        setUnreadCount((prev) => prev + 1);
      }
    });

    const unsubReq = onRealtimeEvent("request:updated", () => {
      loadNotifications();
    });

    const unsubChat = onRealtimeEvent("chat:message", (msg) => {
      if (Number(msg.receiver_id || msg.receiverId) === Number(userId)) {
        loadNotifications();
      }
    });

    return () => {
      if (unsubNotif) unsubNotif();
      if (unsubReq) unsubReq();
      if (unsubChat) unsubChat();
    };
  }, [userId]);

  if (!isOpen) return null;

  const handleMarkAsRead = async (notifId, e) => {
    e?.stopPropagation();
    try {
      await markNotificationReadLive(notifId, userId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, read_status: 1 } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsReadLive(userId);
      setNotifications((prev) => prev.map((n) => ({ ...n, read_status: 1 })));
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === "unread") return n.read_status === 0;
    if (activeTab === "payment") return n.category === "payment" || n.type === "payment";
    if (activeTab === "chat") return n.category === "chat" || n.type === "chat";
    if (activeTab === "attendance") return n.category === "attendance" || n.type === "turnstile";
    if (activeTab === "trainer_change") return n.category === "trainer_change" || n.type === "coach";
    return true;
  });

  const getCategoryIcon = (category, type) => {
    if (category === "payment" || type === "payment") return "💳";
    if (category === "chat" || type === "chat") return "💬";
    if (category === "attendance" || type === "turnstile") return "🏃";
    if (category === "trainer_change" || type === "coach") return "🏋️";
    return "🔔";
  };

  const formatTimestamp = (dateStr) => {
    if (!dateStr) return "Recently";
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now - d;
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="notif-modal-overlay">
      <div className="notif-modal-card">
        {/* Header */}
        <div className="notif-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "rgba(0, 242, 254, 0.12)",
                border: "1px solid rgba(0, 242, 254, 0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#00f2fe",
              }}
            >
              🔔
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h2 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#ffffff", margin: 0 }}>
                  Notification Center
                </h2>
                {unreadCount > 0 && (
                  <span
                    style={{
                      background: "rgba(0, 242, 254, 0.15)",
                      color: "#00f2fe",
                      padding: "2px 8px",
                      borderRadius: 999,
                      fontSize: "0.68rem",
                      fontWeight: 800,
                    }}
                  >
                    {unreadCount} Unread
                  </span>
                )}
              </div>
              <p style={{ fontSize: "0.72rem", color: "#94a3b8", margin: "2px 0 0 0" }}>
                Real-time alerts, payment confirmations, direct messages, and facility arrivals.
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                style={{
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  color: "#e2e8f0",
                  padding: "6px 12px",
                  borderRadius: 8,
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                ✓ Mark all as read
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                color: "#94a3b8",
                width: 32,
                height: 32,
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="notif-modal-tabs">
          {[
            { id: "all", label: "All Alerts" },
            { id: "unread", label: `Unread (${unreadCount})` },
            { id: "payment", label: "Payments 💳" },
            { id: "chat", label: "Direct Chats 💬" },
            { id: "attendance", label: "Gym Access 🏃" },
            { id: "trainer_change", label: "Trainer Requests 🏋️" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`notif-tab-btn ${activeTab === tab.id ? "active" : ""}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="notif-modal-body">
          {loading ? (
            <div style={{ textAlign: "center", padding: "3rem", color: "#94a3b8" }}>
              Loading notification telemetry...
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div style={{ textAlign: "center", padding: "4rem 1rem", color: "#64748b" }}>
              <div style={{ fontSize: "2rem", marginBottom: 8 }}>📭</div>
              <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#cbd5e1" }}>
                No notifications in this view
              </div>
              <p style={{ fontSize: "0.74rem", margin: "4px 0 0 0" }}>
                All updates, transactions, and alerts will appear here in real-time.
              </p>
            </div>
          ) : (
            filteredNotifications.map((n) => {
              const isUnread = n.read_status === 0;

              return (
                <div
                  key={n.id}
                  className={`notif-center-item ${isUnread ? "unread" : ""}`}
                  onClick={() => {
                    if (isUnread) handleMarkAsRead(n.id);
                    if (onOpenAction) onOpenAction(n);
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <div
                    className={`notif-item-icon ${
                      n.category === "payment"
                        ? "notif-icon-payment"
                        : n.category === "chat"
                        ? "notif-icon-chat"
                        : n.category === "attendance"
                        ? "notif-icon-attendance"
                        : "notif-icon-trainer"
                    }`}
                  >
                    {getCategoryIcon(n.category, n.type)}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: "0.82rem", color: "#ffffff" }}>
                          {n.title}
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "#64748b", marginTop: 2 }}>
                          {n.category?.toUpperCase() || "SYSTEM"} • {formatTimestamp(n.created_at)}
                        </div>
                      </div>

                      {isUnread && (
                        <button
                          onClick={(e) => handleMarkAsRead(n.id, e)}
                          style={{
                            background: "rgba(0, 242, 254, 0.1)",
                            border: "1px solid rgba(0, 242, 254, 0.3)",
                            color: "#00f2fe",
                            fontSize: "0.68rem",
                            fontWeight: 700,
                            padding: "3px 8px",
                            borderRadius: 6,
                            cursor: "pointer",
                          }}
                        >
                          Mark read
                        </button>
                      )}
                    </div>

                    <p style={{ margin: "6px 0 0 0", fontSize: "0.78rem", color: "#cbd5e1", lineHeight: 1.45 }}>
                      {n.message}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

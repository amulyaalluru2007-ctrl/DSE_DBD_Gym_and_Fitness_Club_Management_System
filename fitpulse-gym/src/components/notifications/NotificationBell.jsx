import React, { useState, useEffect, useRef } from "react";
import {
  fetchNotificationsLive,
  fetchUnreadNotificationCountLive,
  markNotificationReadLive,
  onRealtimeEvent,
} from "../../services/realtime";
import NotificationCenterModal from "./NotificationCenterModal";
import "../../styles/notifications.css";

export default function NotificationBell({ userId = 1, onNavigateAction }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentNotifications, setRecentNotifications] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const dropdownRef = useRef(null);

  const loadUnreadAndRecent = async () => {
    try {
      const countRes = await fetchUnreadNotificationCountLive(userId);
      if (countRes && typeof countRes.unreadCount === "number") {
        setUnreadCount(countRes.unreadCount);
      }

      const notifsRes = await fetchNotificationsLive(userId, { limit: 6 });
      if (notifsRes && notifsRes.success) {
        setRecentNotifications(notifsRes.notifications || []);
      }
    } catch (err) {
      console.warn("Notification bell sync error:", err);
    }
  };

  useEffect(() => {
    loadUnreadAndRecent();

    const unsubNotif = onRealtimeEvent("notification:new", (notif) => {
      if (!notif.recipient_user_id || Number(notif.recipient_user_id) === Number(userId)) {
        setUnreadCount((c) => c + 1);
        setRecentNotifications((prev) => [notif, ...prev.slice(0, 5)]);
      }
    });

    const unsubReq = onRealtimeEvent("request:updated", () => {
      loadUnreadAndRecent();
    });

    const unsubChat = onRealtimeEvent("chat:message", (msg) => {
      if (Number(msg.receiver_id || msg.receiverId) === Number(userId)) {
        loadUnreadAndRecent();
      }
    });

    const unsubPay = onRealtimeEvent("payment:success", (pay) => {
      if (Number(pay.userId || pay.memberId || pay.trainerId) === Number(userId)) {
        loadUnreadAndRecent();
      }
    });

    return () => {
      if (unsubNotif) unsubNotif();
      if (unsubReq) unsubReq();
      if (unsubChat) unsubChat();
      if (unsubPay) unsubPay();
    };
  }, [userId]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNotificationClick = async (notif) => {
    if (notif.read_status === 0) {
      try {
        await markNotificationReadLive(notif.id, userId);
        setUnreadCount((c) => Math.max(0, c - 1));
        setRecentNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, read_status: 1 } : n))
        );
      } catch (e) {
        console.error(e);
      }
    }
    setIsDropdownOpen(false);

    if (onNavigateAction) {
      onNavigateAction(notif);
    } else {
      setIsModalOpen(true);
    }
  };

  const getCategoryIcon = (category, type) => {
    if (category === "payment" || type === "payment") return "💳";
    if (category === "chat" || type === "chat") return "💬";
    if (category === "attendance" || type === "turnstile") return "🏃";
    if (category === "trainer_change" || type === "coach") return "🏋️";
    return "🔔";
  };

  const getCategoryTag = (category, type) => {
    if (category === "payment" || type === "payment") return { label: "Payment", cls: "notif-tag-payment" };
    if (category === "chat" || type === "chat") return { label: "Direct Chat", cls: "notif-tag-chat" };
    if (category === "attendance" || type === "turnstile") return { label: "Turnstile / Gym", cls: "notif-tag-attendance" };
    if (category === "trainer_change" || type === "coach") return { label: "Trainer", cls: "notif-tag-trainer" };
    return { label: "System", cls: "" };
  };

  return (
    <div style={{ position: "relative", display: "inline-block" }} ref={dropdownRef}>
      {/* Serious Dark Glass Bell Trigger */}
      <button
        onClick={() => setIsDropdownOpen((prev) => !prev)}
        className="notif-bell-btn"
        title="System Notifications & Alerts"
        type="button"
      >
        <svg
          className="notif-bell-icon"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {unreadCount > 0 && (
          <span className="notif-badge-counter">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Serious Dark Glass Dropdown */}
      {isDropdownOpen && (
        <div className="notif-dropdown-box">
          <div className="notif-dropdown-header">
            <div className="notif-header-title">
              <span>🔔 Notifications</span>
              {unreadCount > 0 && (
                <span
                  style={{
                    background: "rgba(0, 242, 254, 0.15)",
                    color: "#00f2fe",
                    padding: "2px 7px",
                    borderRadius: 999,
                    fontSize: "0.68rem",
                    fontWeight: 800,
                  }}
                >
                  {unreadCount} Unread
                </span>
              )}
            </div>

            <button
              onClick={() => {
                setIsDropdownOpen(false);
                setIsModalOpen(true);
              }}
              className="notif-view-all-link"
              type="button"
            >
              Open Center →
            </button>
          </div>

          {/* Notifications List */}
          <div className="notif-dropdown-list">
            {recentNotifications.length === 0 ? (
              <div style={{ textAlign: "center", padding: "2.5rem 1rem", color: "#64748b", fontSize: "0.78rem" }}>
                No notifications logged. All clear!
              </div>
            ) : (
              recentNotifications.map((notif) => {
                const tagInfo = getCategoryTag(notif.category, notif.type);
                const isUnread = notif.read_status === 0;

                return (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`notif-item ${isUnread ? "unread" : ""}`}
                  >
                    <div
                      className={`notif-item-icon ${
                        notif.category === "payment"
                          ? "notif-icon-payment"
                          : notif.category === "chat"
                          ? "notif-icon-chat"
                          : notif.category === "attendance"
                          ? "notif-icon-attendance"
                          : "notif-icon-trainer"
                      }`}
                    >
                      {getCategoryIcon(notif.category, notif.type)}
                    </div>

                    <div className="notif-item-content">
                      <div className="notif-item-head">
                        <span className="notif-item-title">{notif.title}</span>
                        {tagInfo.label && (
                          <span className={`notif-category-tag ${tagInfo.cls}`}>
                            {tagInfo.label}
                          </span>
                        )}
                      </div>
                      <p className="notif-item-msg">{notif.message}</p>
                      <div className="notif-item-time">
                        {notif.created_at
                          ? new Date(notif.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "Just now"}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer CTA */}
          <div className="notif-dropdown-footer">
            <button
              onClick={() => {
                setIsDropdownOpen(false);
                setIsModalOpen(true);
              }}
              className="notif-open-center-btn"
              type="button"
            >
              View All History & Alerts
            </button>
          </div>
        </div>
      )}

      {/* Full Center Modal */}
      <NotificationCenterModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          loadUnreadAndRecent();
        }}
        userId={userId}
        onOpenAction={(notif) => {
          setIsModalOpen(false);
          if (onNavigateAction) onNavigateAction(notif);
        }}
      />
    </div>
  );
}

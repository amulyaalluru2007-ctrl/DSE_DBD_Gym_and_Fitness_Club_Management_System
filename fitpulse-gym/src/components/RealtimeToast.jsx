import { useState, useEffect } from "react";
import { subscribeToToasts } from "../services/realtime";

export default function RealtimeToast() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const unsubscribe = subscribeToToasts((toast) => {
      setToasts((prev) => [...prev, toast]);

      // Auto dismiss
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, toast.duration || 4000);
    });

    return unsubscribe;
  }, []);

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "24px",
        right: "24px",
        zIndex: 99999,
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        maxWidth: "400px",
        pointerEvents: "none",
      }}
    >
      {toasts.map((t) => {
        let badgeColor = "#22c55e"; // default green
        let icon = "⚡";

        if (t.type === "turnstile") {
          badgeColor = "#06b6d4";
          icon = "🎫";
        } else if (t.type === "coach") {
          badgeColor = "#ec4899";
          icon = "🏋️";
        } else if (t.type === "workout") {
          badgeColor = "#eab308";
          icon = "🔥";
        } else if (t.type === "session") {
          badgeColor = "#8b5cf6";
          icon = "📅";
        } else if (t.type === "payment") {
          badgeColor = "#10b981";
          icon = "💳";
        } else if (t.type === "settings") {
          badgeColor = "#3b82f6";
          icon = "⚙️";
        }

        return (
          <div
            key={t.id}
            style={{
              pointerEvents: "auto",
              background: "rgba(13, 15, 20, 0.94)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              border: `1px solid ${badgeColor}40`,
              boxShadow: `0 12px 36px rgba(0, 0, 0, 0.7), 0 0 20px ${badgeColor}25`,
              borderRadius: "14px",
              padding: "14px 18px",
              display: "flex",
              alignItems: "flex-start",
              gap: "14px",
              animation: "toastSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards",
              color: "#ffffff",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Top glowing line */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "2px",
                background: `linear-gradient(90deg, transparent, ${badgeColor}, transparent)`,
              }}
            />

            {/* Icon Bubble */}
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: `${badgeColor}20`,
                border: `1px solid ${badgeColor}50`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.1rem",
                flexShrink: 0,
              }}
            >
              {icon}
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                <span
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    letterSpacing: "0.02em",
                    color: "#f8fafc",
                  }}
                >
                  {t.title}
                </span>
                <span
                  style={{
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    background: `${badgeColor}25`,
                    color: badgeColor,
                  }}
                >
                  Live Sync
                </span>
              </div>
              <p
                style={{
                  margin: "4px 0 0 0",
                  fontSize: "0.78rem",
                  color: "rgba(255, 255, 255, 0.72)",
                  lineHeight: 1.4,
                }}
              >
                {t.message}
              </p>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={() => removeToast(t.id)}
              style={{
                background: "transparent",
                border: "none",
                color: "rgba(255, 255, 255, 0.4)",
                cursor: "pointer",
                fontSize: "1.1rem",
                padding: "0 2px",
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        );
      })}
      <style>{`
        @keyframes toastSlideIn {
          0% {
            opacity: 0;
            transform: translateX(30px) scale(0.96);
          }
          100% {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}

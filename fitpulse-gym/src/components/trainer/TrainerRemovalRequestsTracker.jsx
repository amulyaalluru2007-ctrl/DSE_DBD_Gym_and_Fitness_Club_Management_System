import React, { useState, useEffect } from "react";
import { fetchTrainerChangeRequestsLive, onRealtimeEvent } from "../../services/realtime";
import "../../styles/member-change-trainer.css";

export default function TrainerRemovalRequestsTracker({ trainerId = 4 }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const res = await fetchTrainerChangeRequestsLive(trainerId);
      if (res && res.success) {
        setRequests(res.requests || []);
      }
    } catch (err) {
      console.warn("Error loading trainer requests:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();

    const unsubUpdated = onRealtimeEvent("request:updated", () => {
      loadRequests();
    });
    const unsubCreated = onRealtimeEvent("request:created", () => {
      loadRequests();
    });

    return () => {
      if (unsubUpdated) unsubUpdated();
      if (unsubCreated) unsubCreated();
    };
  }, [trainerId]);

  const getStatusBadge = (status) => {
    switch (status) {
      case "Submitted":
      case "Under Review":
        return "mct-badge-submitted";
      case "Completed":
      case "Approved":
        return "mct-badge-approved";
      case "Rejected":
        return "mct-badge-rejected";
      default:
        return "mct-badge-withdrawn";
    }
  };

  if (requests.length === 0 && !loading) {
    return null; // Keep dashboard compact when no requests exist
  }

  return (
    <div className="trainer-card" style={{ marginTop: 24, padding: "20px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: "1.2rem" }}>📋</span>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "#fff" }}>
              Roster Reassignment & Removal Tracker
            </h3>
            <span style={{ fontSize: "0.75rem", color: "var(--tp-text-muted)" }}>
              Administrative decisions and active status updates
            </span>
          </div>
        </div>
        <button
          onClick={loadRequests}
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#94a3b8",
            borderRadius: 8,
            padding: "4px 10px",
            fontSize: "0.75rem",
            cursor: "pointer",
          }}
        >
          ↻ Refresh
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {loading && requests.length === 0 ? (
          <div style={{ textAlign: "center", padding: "16px 0", color: "#64748b", fontSize: "0.8rem" }}>
            Loading roster request telemetry...
          </div>
        ) : (
          requests.map((r) => (
            <div
              key={r.id}
              style={{
                background: "rgba(0,0,0,0.35)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 12,
                padding: "12px 16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: "0.82rem", color: "#38bdf8" }}>
                    {r.request_number}
                  </span>
                  <span className={`mct-badge ${getStatusBadge(r.status)}`}>
                    {r.status}
                  </span>
                  {r.is_confidential === 1 && (
                    <span style={{ fontSize: "0.68rem", color: "#c084fc", background: "rgba(192, 132, 252, 0.15)", padding: "1px 6px", borderRadius: 4 }}>
                      🔒 Confidential
                    </span>
                  )}
                </div>
                <div style={{ fontSize: "0.85rem", color: "#f8fafc", fontWeight: 600 }}>
                  {r.request_type === "trainer_remove_member" ? "Requested Removal: " : "Member Reassignment: "}
                  <strong style={{ color: "#fff" }}>{r.member_name}</strong>
                </div>
                <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: 2 }}>
                  Reason: {r.reason_code}
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                  {new Date(r.created_at).toLocaleDateString("en-IN", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
                {r.rejection_reason && (
                  <div style={{ fontSize: "0.72rem", color: "#f87171", marginTop: 4, maxWidth: 260 }}>
                    Admin Note: {r.rejection_reason}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

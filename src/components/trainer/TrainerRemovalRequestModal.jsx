import React, { useState } from "react";
import { submitTrainerRemovalRequestLive } from "../../services/realtime";
import "../../styles/member-change-trainer.css";

export default function TrainerRemovalRequestModal({
  isOpen,
  onClose,
  trainerId = 4,
  client,
  onSuccess,
}) {
  const [reasonCode, setReasonCode] = useState("scheduling_conflict");
  const [description, setDescription] = useState("");
  const [isConfidential, setIsConfidential] = useState(true); // default to confidential to protect both parties
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen || !client) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg("");

    try {
      const payload = {
        trainerId,
        memberId: client.id,
        reasonCode,
        description,
        isConfidential,
      };

      const res = await submitTrainerRemovalRequestLive(payload);
      if (res && res.success) {
        if (onSuccess) onSuccess(res.request);
        onClose();
      } else {
        setErrorMsg(res?.message || "Failed to submit removal request.");
      }
    } catch (err) {
      setErrorMsg("Server error submitting removal request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mct-modal-overlay">
      <div className="mct-modal-card">
        {/* Header */}
        <div className="mct-modal-header">
          <div className="mct-header-left">
            <div className="mct-header-icon" style={{ background: "rgba(168, 85, 247, 0.15)", borderColor: "rgba(168, 85, 247, 0.4)", color: "#c084fc" }}>
              👥
            </div>
            <div>
              <h2 className="mct-header-title">Request Member Removal</h2>
              <p className="mct-header-subtitle">
                Official Roster Adjustment & Administrative Reassignment
              </p>
            </div>
          </div>

          <button onClick={onClose} className="mct-close-btn" type="button">
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="mct-modal-body">
          {errorMsg && <div className="mct-error-banner">{errorMsg}</div>}

          {/* Member Card */}
          <div className="mct-assigned-card">
            <div className="mct-assigned-left">
              <img
                src={client.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100"}
                alt={client.name}
                style={{ width: "42px", height: "42px", borderRadius: "50%", objectFit: "cover", border: "1px solid rgba(255,255,255,0.2)" }}
              />
              <div>
                <span className="mct-assigned-label">Athlete Client</span>
                <span className="mct-assigned-name">{client.name}</span>
                <span style={{ fontSize: "0.7rem", color: "#94a3b8", display: "block", marginTop: "2px" }}>
                  Focus: <strong style={{ color: "#00f2fe" }}>{client.goal || "Hypertrophy & Conditioning"}</strong>
                </span>
              </div>
            </div>
            <span className="mct-status-chip" style={{ background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.12)", color: "#94a3b8" }}>
              ID #{client.id}
            </span>
          </div>

          {/* Reason Code Dropdown */}
          <div className="mct-field-group">
            <label className="mct-field-label">Reason for Removal / Reassignment</label>
            <select
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value)}
              className="mct-select"
            >
              <option value="scheduling_conflict">Scheduling / Recurring Time Slot Conflict</option>
              <option value="specialization_mismatch">Specialization & Programming Mismatch</option>
              <option value="attendance_inconsistency">Attendance Inconsistency / Frequent No-Shows</option>
              <option value="athlete_conduct">Athlete Conduct / Protocol Disregard</option>
              <option value="roster_capacity">Roster Capacity Rebalancing / Floor Load Limit</option>
              <option value="other">Other Professional Roster Reallocation</option>
            </select>
          </div>

          {/* Description Textarea */}
          <div className="mct-field-group">
            <label className="mct-field-label">Details & Context for Gym Administration</label>
            <textarea
              rows="3"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide relevant scheduling, biometric or protocol context for the Admin team..."
              className="mct-textarea"
            />
          </div>

          {/* Confidentiality Toggle */}
          <label className="mct-checkbox-row" style={{ background: "rgba(168, 85, 247, 0.08)", borderColor: "rgba(168, 85, 247, 0.25)" }}>
            <input
              type="checkbox"
              id="trainerConfidentialCheck"
              checked={isConfidential}
              onChange={(e) => setIsConfidential(e.target.checked)}
              className="mct-checkbox"
            />
            <div className="mct-checkbox-label">
              <span style={{ fontWeight: 800, color: "#d8b4fe" }}>Confidential Administration Flag</span>
              <span className="mct-checkbox-sub">
                Your stated notes and rationale will be shared exclusively with Gym Leadership. If approved, the member will receive a professional, courteous roster transition notice without sensitive coaching notes.
              </span>
            </div>
          </label>

          <div style={{ padding: "10px 14px", borderRadius: "10px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)", fontSize: "0.72rem", color: "#94a3b8", lineHeight: 1.4 }}>
            💡 <strong style={{ color: "#e2e8f0" }}>Autonomous Workflow:</strong> Upon Admin approval, FitPulse automatically concludes the assignment, frees your booked calendar slots, and allows the member to select a replacement coach.
          </div>

          {/* Action Buttons */}
          <div className="mct-modal-footer">
            <button type="button" onClick={onClose} className="mct-btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="mct-btn-primary"
              style={{ background: "linear-gradient(135deg, #9333ea 0%, #6366f1 100%)", boxShadow: "0 4px 14px rgba(147, 51, 234, 0.35)", color: "#ffffff" }}
            >
              {submitting ? "Submitting..." : "Submit Removal Request →"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


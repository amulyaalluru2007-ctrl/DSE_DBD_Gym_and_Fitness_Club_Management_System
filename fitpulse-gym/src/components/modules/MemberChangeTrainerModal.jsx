import React, { useState, useEffect } from "react";
import {
  calculateBillingPreviewLive,
  submitMemberChangeRequestLive,
  fetchEligibleTrainersLive,
} from "../../services/realtime";
import "../../styles/member-change-trainer.css";

export default function MemberChangeTrainerModal({
  isOpen,
  onClose,
  memberId = 1,
  assignedCoach,
  targetCoach,
  onSuccess,
}) {
  const [trainers, setTrainers] = useState([]);
  const [selectedCoachId, setSelectedCoachId] = useState(targetCoach?.dbId || targetCoach?.id || "");
  const [reasonCode, setReasonCode] = useState("scheduling_conflict");
  const [description, setDescription] = useState("");
  const [isConfidential, setIsConfidential] = useState(false);
  const [agreePolicy, setAgreePolicy] = useState(false);

  // Billing Preview State
  const [billingPreview, setBillingPreview] = useState(null);
  const [loadingBilling, setLoadingBilling] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Load eligible trainers when modal opens
  useEffect(() => {
    if (isOpen) {
      setErrorMsg("");
      fetchEligibleTrainersLive(memberId).then((res) => {
        if (res && res.success && res.trainers) {
          setTrainers(res.trainers);
          // Auto-select target coach or first eligible coach
          if (targetCoach && (targetCoach.dbId || targetCoach.id)) {
            setSelectedCoachId(targetCoach.dbId || targetCoach.id);
          } else if (res.trainers.length > 0) {
            setSelectedCoachId(res.trainers[0].id);
          }
        }
      });
    }
  }, [isOpen, memberId, targetCoach]);

  // Recalculate Prorated Adjustment whenever selectedCoachId changes
  useEffect(() => {
    if (!isOpen || !selectedCoachId) return;

    setLoadingBilling(true);
    setBillingPreview(null);
    setErrorMsg("");

    calculateBillingPreviewLive(memberId, selectedCoachId)
      .then((res) => {
        if (res && res.success && res.calculation) {
          setBillingPreview(res.calculation);
        } else {
          setErrorMsg(res?.message || "Could not calculate billing adjustment.");
        }
      })
      .catch((err) => {
        setErrorMsg("Network error connecting to billing engine.");
      })
      .finally(() => {
        setLoadingBilling(false);
      });
  }, [selectedCoachId, memberId, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCoachId) {
      setErrorMsg("Please select a replacement coach.");
      return;
    }
    if (!agreePolicy) {
      setErrorMsg("Please acknowledge the gym transfer policy.");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");

    try {
      const payload = {
        memberId,
        newTrainerId: Number(selectedCoachId),
        reasonCode,
        description,
        isConfidential,
      };

      const res = await submitMemberChangeRequestLive(payload);
      if (res && res.success) {
        if (onSuccess) onSuccess(res.request);
        onClose();
      } else {
        setErrorMsg(res?.message || "Failed to submit change request.");
      }
    } catch (err) {
      setErrorMsg("Server error submitting request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedTrainerObj = trainers.find((t) => Number(t.id) === Number(selectedCoachId));

  return (
    <div className="mct-modal-overlay">
      <div className="mct-modal-card">
        {/* Header */}
        <div className="mct-modal-header">
          <div className="mct-header-left">
            <div className="mct-header-icon">🔄</div>
            <div>
              <h2 className="mct-header-title">Request Master Coach Transfer</h2>
              <p className="mct-header-subtitle">
                Automated Prorated Billing & Administrative Alignment
              </p>
            </div>
          </div>

          <button onClick={onClose} className="mct-close-btn" type="button">
            ✕
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="mct-modal-body">
          {errorMsg && <div className="mct-error-banner">{errorMsg}</div>}

          {/* Currently Assigned Coach Card */}
          <div className="mct-assigned-card">
            <div className="mct-assigned-left">
              <div className="mct-assigned-avatar">👤</div>
              <div>
                <span className="mct-assigned-label">Currently Assigned Coach</span>
                <span className="mct-assigned-name">
                  Coach {assignedCoach?.name || assignedCoach?.full_name || "Sai Sathwik"}
                </span>
              </div>
            </div>
            <span className="mct-status-chip">Active Assignment</span>
          </div>

          {/* Select Preferred New Coach */}
          <div className="mct-field-group">
            <label className="mct-field-label">Select Preferred New Coach</label>
            <select
              value={selectedCoachId || ""}
              onChange={(e) => setSelectedCoachId(e.target.value)}
              className="mct-select"
            >
              {trainers.map((t) => (
                <option key={t.id} value={t.id} style={{ background: "#0d1424", color: "#ffffff" }}>
                  Coach {t.full_name} • ₹{t.monthly_fee}/mo • ({t.specialty})
                </option>
              ))}
            </select>
          </div>

          {/* LIVE PRORATED BILLING PREVIEW CARD */}
          <div className="mct-prorated-card">
            <div className="mct-prorated-header">
              <div className="mct-engine-title">
                <span>⚡</span>
                <span>Automated Prorated Engine</span>
              </div>
              <span className="mct-arithmetic-tag">Exact INR Arithmetic</span>
            </div>

            {loadingBilling ? (
              <div style={{ textAlign: "center", padding: "1.5rem 0", color: "#94a3b8", fontSize: "0.78rem" }}>
                Calculating live billing adjustment...
              </div>
            ) : billingPreview ? (
              <div>
                <div className="mct-prorated-grid">
                  <div className="mct-kpi-box">
                    <span className="mct-kpi-title">Current Fee</span>
                    <span className="mct-kpi-number">₹{billingPreview.currentFeeINR}/mo</span>
                  </div>
                  <div className="mct-kpi-box">
                    <span className="mct-kpi-title">New Coach Fee</span>
                    <span className="mct-kpi-number" style={{ color: "#00f2fe" }}>
                      ₹{billingPreview.newFeeINR}/mo
                    </span>
                  </div>
                  <div className="mct-kpi-box">
                    <span className="mct-kpi-title">Remaining Cycle</span>
                    <span className="mct-kpi-number">
                      {billingPreview.remainingDays} / {billingPreview.totalDays} d
                    </span>
                  </div>
                </div>

                {/* Outcome Display */}
                <div
                  className={`mct-outcome-banner ${
                    billingPreview.isCharge
                      ? "mct-outcome-charge"
                      : "mct-outcome-neutral"
                  }`}
                >
                  <div>
                    <span className="mct-outcome-label">
                      {billingPreview.isCharge
                        ? "Prorated Upgrade Due (Upon Approval)"
                        : "No Fee Adjustment (Non-Refundable Downgrades)"}
                    </span>
                    <p className="mct-outcome-desc">{billingPreview.snapshot?.explanation}</p>
                  </div>
                  <span className="mct-outcome-amount">
                    {billingPreview.isCharge
                      ? `+₹${billingPreview.snapshot?.proratedAdjustmentINR}`
                      : "₹0.00"}
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          {/* Reason Code Dropdown */}
          <div className="mct-field-group">
            <label className="mct-field-label">Reason for Coach Transfer</label>
            <select
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value)}
              className="mct-select"
            >
              <option value="scheduling_conflict">Scheduling / Available Hours Conflict</option>
              <option value="goal_alignment">Training Goal Alignment (Powerlifting / Hypertrophy / Conditioning)</option>
              <option value="coaching_style">Coaching Methodology & Communication Preference</option>
              <option value="injury_rehab">Injury Rehabilitation / Specialized Biomechanics</option>
              <option value="personal_preference">Personal Athlete Preference / Other</option>
            </select>
          </div>

          {/* Details Textarea */}
          <div className="mct-field-group">
            <label className="mct-field-label">Additional Context / Feedback (Optional)</label>
            <textarea
              rows="3"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide any specific goals, target days, or notes for gym administration..."
              className="mct-textarea"
            />
          </div>

          {/* Confidentiality Toggle */}
          <label className="mct-checkbox-row" style={{ background: "rgba(168, 85, 247, 0.08)", borderColor: "rgba(168, 85, 247, 0.25)" }}>
            <input
              type="checkbox"
              id="confidentialCheck"
              checked={isConfidential}
              onChange={(e) => setIsConfidential(e.target.checked)}
              className="mct-checkbox"
            />
            <div className="mct-checkbox-label">
              <span style={{ fontWeight: 800, color: "#d8b4fe" }}>Keep request confidential from current coach</span>
              <span className="mct-checkbox-sub">
                Your stated reason and feedback will remain completely private to Gym Administration. The current coach will only receive a generic roster update notice upon reassignment.
              </span>
            </div>
          </label>

          {/* Policy Agreement */}
          <label className="mct-checkbox-row">
            <input
              type="checkbox"
              id="policyAgree"
              checked={agreePolicy}
              onChange={(e) => setAgreePolicy(e.target.checked)}
              className="mct-checkbox"
            />
            <div className="mct-checkbox-label">
              <span>
                I understand that coach transfers are reviewed by FitPulse administration. Any prorated difference will be settled securely via Cashfree or credited to my account automatically.
              </span>
            </div>
          </label>

          {/* Action Buttons Footer */}
          <div className="mct-modal-footer">
            <button type="button" onClick={onClose} className="mct-btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !selectedCoachId || !agreePolicy}
              className="mct-btn-primary"
            >
              {submitting ? "Submitting Request..." : "Submit Change Request →"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

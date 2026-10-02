import React, { useState, useEffect } from "react";
import {
  calculatePlanChangePreviewLive,
  submitPlanChangeRequestLive,
} from "../../services/realtime";
import "../../styles/member-change-trainer.css";

const AVAILABLE_PLANS = [
  { id: "1_month", name: "1 Month Gym Membership", price: 1499, days: 30 },
  { id: "3_months", name: "3 Months Gym Membership", price: 3999, days: 90 },
  { id: "6_months", name: "6 Months Gym Membership", price: 6999, days: 180 },
  { id: "1_year", name: "1 Year Gym Membership", price: 11999, days: 365 },
];

export default function MemberChangePlanModal({
  isOpen,
  onClose,
  memberId = 1,
  currentMembership,
  onSuccess,
}) {
  const currentKey = currentMembership?.durationKey || "1_month";
  // Select first eligible plan different from current
  const otherPlans = AVAILABLE_PLANS.filter((p) => p.id !== currentKey);
  const defaultTarget = otherPlans.length > 0 ? otherPlans[0].id : "3_months";

  const [requestedDuration, setRequestedDuration] = useState(defaultTarget);
  const [reason, setReason] = useState("Athletic progression / goal upgrade");
  const [description, setDescription] = useState("");
  const [agreePolicy, setAgreePolicy] = useState(false);

  // Billing Preview State
  const [preview, setPreview] = useState(null);
  const [loadingCalc, setLoadingCalc] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (isOpen) {
      setErrorMsg("");
      // Pick first non-matching plan
      const nextTarget = otherPlans.length > 0 ? otherPlans[0].id : "3_months";
      setRequestedDuration(nextTarget);
    }
  }, [isOpen, currentKey]);

  useEffect(() => {
    if (!isOpen || !requestedDuration) return;

    setLoadingCalc(true);
    setPreview(null);
    setErrorMsg("");

    calculatePlanChangePreviewLive(memberId, requestedDuration)
      .then((res) => {
        if (res && res.success && res.calculation) {
          setPreview(res.calculation);
        } else {
          setErrorMsg(res?.message || "Could not calculate prorated plan difference.");
        }
      })
      .catch(() => {
        setErrorMsg("Network error connecting to plan calculation engine.");
      })
      .finally(() => {
        setLoadingCalc(false);
      });
  }, [requestedDuration, memberId, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!agreePolicy) {
      setErrorMsg("Please acknowledge the gym membership change and non-refundable policy.");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");

    try {
      const payload = {
        memberId,
        requestedDuration,
        reason: `${reason}${description ? ` — ${description}` : ""}`,
      };

      const res = await submitPlanChangeRequestLive(payload);
      if (res && res.success) {
        if (onSuccess) onSuccess(res.request);
        onClose();
      } else {
        setErrorMsg(res?.message || "Failed to submit plan change request.");
      }
    } catch {
      setErrorMsg("Server error submitting plan change request.");
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
            <div className="mct-header-icon" style={{ background: "rgba(16, 185, 129, 0.15)", borderColor: "rgba(16, 185, 129, 0.4)", color: "#10b981" }}>
              💳
            </div>
            <div>
              <h2 className="mct-header-title">Request Membership Plan Change</h2>
              <p className="mct-header-subtitle">
                Automated Prorated Calculation & Administrative Review
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

          {/* Current Membership Card */}
          <div className="mct-assigned-card">
            <div className="mct-assigned-left">
              <div className="mct-assigned-avatar" style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}>
                🛡️
              </div>
              <div>
                <span className="mct-assigned-label">Current Active Plan</span>
                <span className="mct-assigned-name">
                  {currentMembership?.planName || "1 Month Gym Membership"}
                </span>
                <span style={{ fontSize: "0.7rem", color: "#94a3b8", display: "block", marginTop: "2px" }}>
                  Remaining Days: <strong style={{ color: "#00f2fe" }}>{preview ? `${preview.remainingDays} / ${preview.totalDays} Days` : "Active"}</strong>
                </span>
              </div>
            </div>
            <span className="mct-status-chip" style={{ background: "rgba(16, 185, 129, 0.15)", borderColor: "rgba(16, 185, 129, 0.4)", color: "#34d399" }}>
              Active Pass
            </span>
          </div>

          {/* Select Target Membership Plan */}
          <div className="mct-field-group">
            <label className="mct-field-label">Select Requested New Plan</label>
            <select
              value={requestedDuration}
              onChange={(e) => setRequestedDuration(e.target.value)}
              className="mct-select"
            >
              {otherPlans.map((p) => (
                <option key={p.id} value={p.id} style={{ background: "#0d1424", color: "#ffffff" }}>
                  {p.name} • ₹{p.price.toLocaleString("en-IN")} ({p.days} Days Pass)
                </option>
              ))}
            </select>
          </div>

          {/* LIVE PRORATED PLAN CALCULATION CARD */}
          <div className="mct-prorated-card">
            <div className="mct-prorated-header">
              <div className="mct-engine-title">
                <span>⚡</span>
                <span>Mid-Cycle Plan Proration Engine</span>
              </div>
              <span className="mct-arithmetic-tag">Exact INR Arithmetic</span>
            </div>

            {loadingCalc ? (
              <div style={{ textAlign: "center", padding: "1.2rem 0", color: "#94a3b8", fontSize: "0.78rem" }}>
                Calculating live cycle breakdown...
              </div>
            ) : preview ? (
              <div>
                <div className="mct-prorated-grid">
                  <div className="mct-kpi-box">
                    <span className="mct-kpi-title">Current Plan</span>
                    <span className="mct-kpi-number">₹{preview.currentPlan?.price}</span>
                  </div>
                  <div className="mct-kpi-box">
                    <span className="mct-kpi-title">Unused Credit</span>
                    <span className="mct-kpi-number" style={{ color: "#34d399" }}>
                      ₹{preview.unusedValue}
                    </span>
                  </div>
                  <div className="mct-kpi-box">
                    <span className="mct-kpi-title">Target Plan</span>
                    <span className="mct-kpi-number" style={{ color: "#00f2fe" }}>
                      ₹{preview.newPlan?.price}
                    </span>
                  </div>
                </div>

                {/* Outcome Display */}
                <div
                  className={`mct-outcome-banner ${
                    preview.isUpgrade && preview.proratedAdjustmentINR > 0
                      ? "mct-outcome-charge"
                      : "mct-outcome-neutral"
                  }`}
                >
                  <div>
                    <span className="mct-outcome-label">
                      {preview.isUpgrade
                        ? "Prorated Upgrade Due (Upon Admin Approval)"
                        : "Gym Policy: Non-Refundable Downgrades"}
                    </span>
                    <p className="mct-outcome-desc">{preview.explanation}</p>
                  </div>
                  <span className="mct-outcome-amount">
                    {preview.isUpgrade
                      ? `+₹${preview.proratedAdjustmentINR}`
                      : "₹0.00"}
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          {/* Reason Code Dropdown */}
          <div className="mct-field-group">
            <label className="mct-field-label">Reason for Plan Transition</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mct-select"
            >
              <option value="Athletic progression / goal upgrade">Athletic Progression & Extended Periodization</option>
              <option value="Long-term discount lock">Commitment to Quarterly / Semi-Annual Rate Lock</option>
              <option value="Shift in training frequency">Change in Training Schedule & Availability</option>
              <option value="Facility preference">Campus Access & Turnstile Clearance Preference</option>
              <option value="Other">Other Personal Preference</option>
            </select>
          </div>

          {/* Details Textarea */}
          <div className="mct-field-group">
            <label className="mct-field-label">Additional Context (Optional)</label>
            <textarea
              rows="2"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Any details or notes for Gym Administration..."
              className="mct-textarea"
            />
          </div>

          {/* Policy Agreement Checkbox */}
          <label className="mct-checkbox-row">
            <input
              type="checkbox"
              id="planPolicyAgree"
              checked={agreePolicy}
              onChange={(e) => setAgreePolicy(e.target.checked)}
              className="mct-checkbox"
            />
            <div className="mct-checkbox-label">
              <span>
                I understand that mid-cycle plan changes are subject to Admin approval. When upgrading, the prorated difference is payable upon approval; downgrading to a shorter plan is strictly non-refundable and non-creditable per gym policy.
              </span>
            </div>
          </label>

          {/* Actions */}
          <div className="mct-modal-footer">
            <button type="button" onClick={onClose} className="mct-btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !agreePolicy}
              className="mct-btn-primary"
              style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", boxShadow: "0 4px 14px rgba(16, 185, 129, 0.35)", color: "#ffffff" }}
            >
              {submitting ? "Submitting..." : "Submit Plan Change Request →"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

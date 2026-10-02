import React, { useState, useEffect } from "react";
import {
  fetchMemberChangeRequestsLive,
  withdrawMemberRequestLive,
  createAdjustmentPaymentOrderLive,
  verifyAdjustmentPaymentLive,
  onRealtimeEvent,
} from "../../services/realtime";
import "../../styles/member-change-trainer.css";

export default function MemberRequestHistoryModal({
  isOpen,
  onClose,
  memberId = 1,
  onPaymentSuccess,
}) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [withdrawingId, setWithdrawingId] = useState(null);
  const [payingId, setPayingId] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const res = await fetchMemberChangeRequestsLive(memberId);
      if (res && res.success) {
        setRequests(res.requests || []);
      }
    } catch (err) {
      console.warn("Failed to load member requests:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadRequests();
    }
  }, [isOpen, memberId]);

  useEffect(() => {
    const unsub = onRealtimeEvent("request:updated", () => {
      loadRequests();
    });
    return () => {
      if (unsub) unsub();
    };
  }, []);

  if (!isOpen) return null;

  const handleWithdraw = async (requestId) => {
    if (!window.confirm("Are you sure you want to withdraw this change request?")) return;
    setWithdrawingId(requestId);
    try {
      const res = await withdrawMemberRequestLive(requestId, memberId, "Cancelled by athlete");
      if (res && res.success) {
        setToastMsg("Request withdrawn successfully.");
        loadRequests();
      } else {
        alert(res?.message || "Failed to withdraw request.");
      }
    } catch (err) {
      alert("Error withdrawing request.");
    } finally {
      setWithdrawingId(null);
    }
  };

  const handlePayAdjustment = async (reqItem) => {
    setPayingId(reqItem.id);
    try {
      // Step 1: Create Cashfree PG Order for prorated difference
      const orderRes = await createAdjustmentPaymentOrderLive(reqItem.id, memberId);
      if (!orderRes || !orderRes.success) {
        alert(orderRes?.message || "Error generating Cashfree payment session.");
        setPayingId(null);
        return;
      }

      // Step 2: In Cashfree sandbox/environment, simulate or verify checkout
      const verifyRes = await verifyAdjustmentPaymentLive(orderRes.orderId, true);
      if (verifyRes && verifyRes.success) {
        setToastMsg(`Payment verified! Coach ${verifyRes.newTrainerName} is now actively assigned.`);
        loadRequests();
        if (onPaymentSuccess) onPaymentSuccess(verifyRes);
      } else {
        alert(verifyRes?.message || "Payment verification failed.");
      }
    } catch (err) {
      alert("Error processing payment.");
    } finally {
      setPayingId(null);
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case "Submitted":
        return "mct-badge-submitted";
      case "Under Review":
        return "mct-badge-review";
      case "Awaiting Payment":
        return "mct-badge-awaiting";
      case "Completed":
        return "mct-badge-completed";
      case "Approved":
        return "mct-badge-approved";
      case "Rejected":
        return "mct-badge-rejected";
      case "Withdrawn":
        return "mct-badge-withdrawn";
      default:
        return "mct-badge-submitted";
    }
  };

  return (
    <div className="mct-modal-overlay">
      <div className="mct-modal-card mct-modal-card-lg">
        {/* Header */}
        <div className="mct-modal-header">
          <div className="mct-header-left">
            <div className="mct-header-icon">📜</div>
            <div>
              <h2 className="mct-header-title">Coach Change Request History</h2>
              <p className="mct-header-subtitle">
                Track status, administrative review, and prorated payment records
              </p>
            </div>
          </div>

          <button onClick={onClose} className="mct-close-btn" type="button">
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="mct-modal-body">
          {toastMsg && (
            <div className="mct-toast-banner">
              <span>✓</span>
              <span>{toastMsg}</span>
            </div>
          )}

          {loading ? (
            <div className="mct-spinner-wrap">
              <div className="mct-spinner"></div>
              <span>Loading request telemetry & billing history...</span>
            </div>
          ) : requests.length === 0 ? (
            <div className="mct-empty-state">
              <div style={{ fontSize: "2rem", marginBottom: "8px" }}>📭</div>
              <div className="mct-empty-state-title">No Change Requests Submitted Yet</div>
              <div className="mct-empty-state-desc">
                When you request a trainer transfer, the review records, prorated settlement invoices, and admin status will appear here.
              </div>
            </div>
          ) : (
            <div className="mct-history-list">
              {requests.map((r) => {
                const adjustmentINR = r.final_adjustment_minor ? r.final_adjustment_minor / 100 : 0;
                const isCharge = adjustmentINR > 0;
                const isCredit = adjustmentINR < 0;

                return (
                  <div key={r.id} className="mct-history-card">
                    <div className="mct-history-header">
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span className="mct-req-num">{r.request_number}</span>
                        <span className={`mct-badge ${getStatusBadgeClass(r.status)}`}>
                          {r.status}
                        </span>
                      </div>
                      <span className="mct-req-date">
                        {new Date(r.created_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>

                    <div className="mct-history-coaches">
                      <div className="mct-coach-col">
                        <span className="mct-coach-col-label">From Assigned Coach</span>
                        <span className="mct-coach-col-name">{r.current_trainer_name || "Assigned Coach"}</span>
                      </div>
                      <div className="mct-coach-col">
                        <span className="mct-coach-col-label">To Requested Coach</span>
                        <span className="mct-coach-col-name" style={{ color: "#00f2fe" }}>
                          {r.preferred_trainer_name || "Gym Allocation Pool"}
                        </span>
                      </div>
                    </div>

                    <div className="mct-history-footer">
                      <div className="mct-settlement-text">
                        <span>Prorated Settlement: </span>
                        <span
                          className={`mct-settlement-val ${
                            isCharge
                              ? "mct-settlement-charge"
                              : isCredit
                              ? "mct-settlement-credit"
                              : "mct-settlement-zero"
                          }`}
                        >
                          {isCharge
                            ? `+₹${adjustmentINR} (Due)`
                            : isCredit
                            ? `-₹${Math.abs(adjustmentINR)} (Account Credit)`
                            : "₹0.00 (Neutral)"}
                        </span>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {/* If Awaiting Payment, show Pay button */}
                        {r.status === "Awaiting Payment" && (
                          <button
                            onClick={() => handlePayAdjustment(r)}
                            disabled={payingId === r.id}
                            className="mct-pay-btn"
                          >
                            {payingId === r.id ? "Verifying..." : `💳 Pay ₹${adjustmentINR}`}
                          </button>
                        )}

                        {/* If Submitted or Under Review, show Withdraw */}
                        {["Submitted", "Under Review", "Awaiting Payment"].includes(r.status) && (
                          <button
                            onClick={() => handleWithdraw(r.id)}
                            disabled={withdrawingId === r.id}
                            className="mct-withdraw-btn"
                          >
                            {withdrawingId === r.id ? "Cancelling..." : "Withdraw"}
                          </button>
                        )}
                      </div>
                    </div>

                    {r.rejection_reason && (
                      <div className="mct-feedback-box">
                        <strong>Administration Feedback: </strong>
                        <span>{r.rejection_reason}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


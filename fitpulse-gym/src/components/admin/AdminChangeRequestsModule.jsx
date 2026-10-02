import React, { useState, useEffect } from "react";
import {
  fetchAdminChangeRequestsLive,
  fetchAdminChangeSummaryLive,
  fetchAdminChangeRequestDetailsLive,
  approveChangeRequestLive,
  rejectChangeRequestLive,
  onRealtimeEvent,
} from "../../services/realtime";
import "../../styles/admin-change-requests.css";

export default function AdminChangeRequestsModule() {
  const [summary, setSummary] = useState({
    totalRequests: 0,
    pendingRequests: 0,
    memberChangeRequests: 0,
    trainerRemovalRequests: 0,
    awaitingPaymentRequests: 0,
    approvedRequests: 0,
    rejectedRequests: 0,
    completedRequests: 0,
    urgentRequests: 0,
  });

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  // Review Dossier Modal
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [dossierDetails, setDossierDetails] = useState(null);
  const [loadingDossier, setLoadingDossier] = useState(false);

  // Approval / Rejection Actions
  const [actionLoading, setActionLoading] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionFeedback, setActionFeedback] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sumRes, reqRes] = await Promise.all([
        fetchAdminChangeSummaryLive(),
        fetchAdminChangeRequestsLive({ status: statusFilter, type: typeFilter, search: searchTerm }),
      ]);

      if (sumRes && sumRes.success && sumRes.summary) {
        setSummary(sumRes.summary);
      }
      if (reqRes && reqRes.success) {
        setRequests(reqRes.requests || []);
      }
    } catch (err) {
      console.warn("Error loading admin change requests:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, typeFilter]);

  // Handle Search Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Real-time Event Subscription
  useEffect(() => {
    const unsubCreated = onRealtimeEvent("request:created", () => {
      loadData();
    });
    const unsubUpdated = onRealtimeEvent("request:updated", () => {
      loadData();
      if (selectedRequest) {
        openDossier(selectedRequest.id);
      }
    });

    return () => {
      if (unsubCreated) unsubCreated();
      if (unsubUpdated) unsubUpdated();
    };
  }, [selectedRequest]);

  const openDossier = async (requestId) => {
    setLoadingDossier(true);
    try {
      const res = await fetchAdminChangeRequestDetailsLive(requestId);
      if (res && res.success) {
        setSelectedRequest(res.request);
        setDossierDetails(res);
      }
    } catch (err) {
      console.warn("Error opening dossier:", err);
    } finally {
      setLoadingDossier(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;

    const confirmMsg =
      selectedRequest.request_type === "member_change_plan"
        ? `Approve plan change request for ${selectedRequest.member_name} to ${selectedRequest.requested_plan_duration ? selectedRequest.requested_plan_duration.replace(/_/g, ' ').toUpperCase() : 'requested plan'}? Prorated settlement will be automatically handled.`
        : selectedRequest.request_type === "member_change_trainer"
        ? `Approve change request for ${selectedRequest.member_name} to Coach ${selectedRequest.preferred_trainer_name}? Backend will automatically update billing, roster, and schedule.`
        : `Approve trainer removal request for ${selectedRequest.member_name}? Member will be unassigned until reassigned.`;

    if (!window.confirm(confirmMsg)) return;

    setActionLoading(true);
    setActionFeedback(null);
    try {
      const res = await approveChangeRequestLive(selectedRequest.id, {
        adminUserId: 1,
        adminNotes: "Approved via Admin Governance Engine.",
      });

      if (res && res.success) {
        setActionFeedback({
          type: "success",
          message: res.message || "Change request approved and processed successfully!",
        });
        loadData();
        openDossier(selectedRequest.id);
      } else {
        setActionFeedback({
          type: "error",
          message: res?.message || "Failed to approve request.",
        });
      }
    } catch (err) {
      setActionFeedback({
        type: "error",
        message: "Network or server error during approval execution.",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest || !rejectionReason.trim()) {
      alert("Please provide a rejection reason.");
      return;
    }

    setActionLoading(true);
    try {
      const res = await rejectChangeRequestLive(selectedRequest.id, {
        adminUserId: 1,
        rejectionReason: rejectionReason.trim(),
      });

      if (res && res.success) {
        setShowRejectModal(false);
        setRejectionReason("");
        setActionFeedback({
          type: "success",
          message: "Request has been rejected and initiator notified.",
        });
        loadData();
        openDossier(selectedRequest.id);
      } else {
        alert(res?.message || "Failed to reject request.");
      }
    } catch (err) {
      alert("Error rejecting request.");
    } finally {
      setActionLoading(false);
    }
  };

  const renderStatusBadge = (status) => {
    let cssClass = "acr-status-submitted";
    if (status === "Awaiting Payment") cssClass = "acr-status-awaiting";
    else if (status === "Completed" || status === "Approved") cssClass = "acr-status-approved";
    else if (status === "Rejected") cssClass = "acr-status-rejected";
    else if (status === "Withdrawn") cssClass = "acr-status-withdrawn";

    return <span className={`acr-status-badge ${cssClass}`}>{status}</span>;
  };

  return (
    <div className="acr-container">
      {/* Module Title Header Banner */}
      <div className="acr-header-banner">
        <div>
          <div className="acr-header-tag">
            <span className="acr-live-dot"></span>
            <span>Admin Governance Engine • Real-time Telemetry</span>
          </div>
          <h1 className="acr-header-title">Trainer & Member Change Requests</h1>
          <p className="acr-header-desc">
            Automated prorated billing reconciliation, single-click approvals, roster reassignments,
            and confidential conflict resolutions.
          </p>
        </div>

        <button onClick={loadData} className="acr-refresh-btn">
          <span>↻</span>
          <span>Refresh Data</span>
        </button>
      </div>

      {/* 9 KPI SUMMARY CARDS */}
      <div className="acr-kpi-grid">
        {[
          { label: "Total Requests", value: summary.totalRequests, color: "#ffffff" },
          { label: "Pending Review", value: summary.pendingRequests, color: "#00f2fe" },
          { label: "Member Changes", value: summary.memberChangeRequests, color: "#60a5fa" },
          { label: "Trainer Removals", value: summary.trainerRemovalRequests, color: "#a78bfa" },
          { label: "Awaiting Pay", value: summary.awaitingPaymentRequests, color: "#fbbf24" },
          { label: "Approved", value: summary.approvedRequests, color: "#34d399" },
          { label: "Rejected", value: summary.rejectedRequests, color: "#f87171" },
          { label: "Completed", value: summary.completedRequests, color: "#2dd4bf" },
          { label: "Urgent/Priv.", value: summary.urgentRequests, color: "#c084fc" },
        ].map((card, i) => (
          <div key={i} className="acr-kpi-card">
            <span className="acr-kpi-label">{card.label}</span>
            <span className="acr-kpi-val" style={{ color: card.color }}>
              {card.value}
            </span>
          </div>
        ))}
      </div>

      {/* FILTERS & SEARCH BAR */}
      <div className="acr-toolbar">
        <div className="acr-search-wrap">
          <span style={{ color: "#64748b" }}>🔍</span>
          <input
            type="text"
            placeholder="Search by ID, member, coach..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="acr-search-input"
          />
        </div>

        <div className="acr-filter-pills">
          {["ALL", "Submitted", "Awaiting Payment", "Completed", "Rejected"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`acr-pill-btn ${statusFilter === st ? "active" : ""}`}
            >
              {st === "ALL" ? "All Status" : st}
            </button>
          ))}

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="acr-pill-btn"
            style={{ background: "rgba(18, 26, 44, 0.7)", outline: "none", cursor: "pointer" }}
          >
            <option value="ALL">All Types</option>
            <option value="member_change_trainer">Member Transfers</option>
            <option value="trainer_remove_member">Trainer Removals</option>
            <option value="member_change_plan">Plan Changes / Upgrades</option>
          </select>
        </div>
      </div>

      {/* REQUESTS TABLE */}
      <div className="acr-table-card">
        <div className="acr-table-wrapper">
          <table className="acr-table">
            <thead>
              <tr>
                <th>Request #</th>
                <th>Type</th>
                <th>Member</th>
                <th>Current Coach</th>
                <th>Target Coach / Action</th>
                <th>Prorated Adj.</th>
                <th>Confidential</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: "center", padding: "3rem", color: "#94a3b8" }}>
                    Loading change requests telemetry...
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: "center", padding: "3rem", color: "#64748b" }}>
                    No change requests matching active filters.
                  </td>
                </tr>
              ) : (
                requests.map((r) => {
                  const adjustmentINR = r.final_adjustment_minor ? r.final_adjustment_minor / 100 : 0;
                  const isCharge = adjustmentINR > 0;
                  const isCredit = adjustmentINR < 0;

                  return (
                    <tr key={r.id} onClick={() => openDossier(r.id)} style={{ cursor: "pointer" }}>
                      <td>
                        <div className="acr-req-id">{r.request_number}</div>
                        <div style={{ fontSize: "0.7rem", color: "#64748b", marginTop: 2 }}>
                          {new Date(r.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                        </div>
                      </td>
                      <td>
                        <span
                          className="acr-type-badge"
                          style={{
                            background:
                              r.request_type === "member_change_plan"
                                ? "rgba(16, 185, 129, 0.15)"
                                : r.request_type === "member_change_trainer"
                                ? "rgba(59, 130, 246, 0.15)"
                                : "rgba(168, 85, 247, 0.15)",
                            color:
                              r.request_type === "member_change_plan"
                                ? "#34d399"
                                : r.request_type === "member_change_trainer"
                                ? "#93c5fd"
                                : "#d8b4fe",
                            border: `1px solid ${
                              r.request_type === "member_change_plan"
                                ? "rgba(16, 185, 129, 0.35)"
                                : r.request_type === "member_change_trainer"
                                ? "rgba(59, 130, 246, 0.3)"
                                : "rgba(168, 85, 247, 0.3)"
                            }`,
                          }}
                        >
                          {r.request_type === "member_change_plan"
                            ? "Plan Upgrade"
                            : r.request_type === "member_change_trainer"
                            ? "Member Transfer"
                            : "Trainer Removal"}
                        </span>
                      </td>
                      <td>
                        <div className="acr-user-chip">
                          <div className="acr-user-avatar">
                            {r.member_name ? r.member_name.charAt(0) : "M"}
                          </div>
                          <div>
                            <div className="acr-user-name">{r.member_name}</div>
                            <div className="acr-user-sub">{r.member_email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{ color: "#e2e8f0", fontWeight: 600 }}>
                          {r.request_type === "member_change_plan"
                            ? (r.current_plan_duration ? r.current_plan_duration.replace(/_/g, " ").toUpperCase() : "Active Plan")
                            : r.current_trainer_name || "None"}
                        </span>
                      </td>
                      <td>
                        {r.request_type === "member_change_plan" ? (
                          <span style={{ color: "#34d399", fontWeight: 700 }}>
                            {r.requested_plan_duration ? r.requested_plan_duration.replace(/_/g, " ").toUpperCase() : "Target Plan"}
                          </span>
                        ) : r.preferred_trainer_name ? (
                          <span style={{ color: "#00f2fe", fontWeight: 700 }}>
                            Coach {r.preferred_trainer_name}
                          </span>
                        ) : (
                          <span style={{ color: "#64748b", fontStyle: "italic" }}>
                            Unassigned (Free Floor)
                          </span>
                        )}
                      </td>
                      <td>
                        {r.request_type === "member_change_plan" ? (
                          <span
                            className={`acr-cost-chip ${
                              Number(r.plan_adjustment_inr) > 0 ? "acr-cost-due" : "acr-cost-neutral"
                            }`}
                          >
                            {Number(r.plan_adjustment_inr) > 0
                              ? `+₹${r.plan_adjustment_inr} (Due)`
                              : "₹0 (Even)"}
                          </span>
                        ) : r.request_type === "member_change_trainer" ? (
                          <span
                            className={`acr-cost-chip ${
                              isCharge ? "acr-cost-due" : "acr-cost-neutral"
                            }`}
                          >
                            {isCharge
                              ? `+₹${adjustmentINR} (Due)`
                              : "₹0 (Even)"}
                          </span>
                        ) : (
                          <span style={{ color: "#64748b" }}>N/A</span>
                        )}
                      </td>
                      <td>
                        {r.is_confidential === 1 ? (
                          <span
                            style={{
                              padding: "2px 8px",
                              borderRadius: 999,
                              fontSize: "0.68rem",
                              fontWeight: 800,
                              background: "rgba(168, 85, 247, 0.15)",
                              color: "#d8b4fe",
                              border: "1px solid rgba(168, 85, 247, 0.3)",
                            }}
                          >
                            🔒 Confidential
                          </span>
                        ) : (
                          <span style={{ color: "#64748b", fontSize: "0.72rem" }}>Standard</span>
                        )}
                      </td>
                      <td>{renderStatusBadge(r.status)}</td>
                      <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => openDossier(r.id)} className="acr-dossier-btn">
                          Review Dossier →
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* REVIEW DOSSIER MODAL */}
      {selectedRequest && (
        <div className="acr-modal-overlay">
          <div className="acr-modal-content">
            {/* Modal Header */}
            <div className="acr-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: "rgba(0, 242, 254, 0.12)",
                    border: "1px solid rgba(0, 242, 254, 0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1.1rem",
                  }}
                >
                  {selectedRequest.request_type === "member_change_trainer" ? "🔄" : "⚠️"}
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <h2 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#ffffff", margin: 0 }}>
                      Review Dossier: {selectedRequest.request_number}
                    </h2>
                    {renderStatusBadge(selectedRequest.status)}
                  </div>
                  <p style={{ fontSize: "0.72rem", color: "#94a3b8", margin: "2px 0 0 0" }}>
                    Initiated on {new Date(selectedRequest.created_at).toLocaleString("en-IN")}
                  </p>
                </div>
              </div>

              <button onClick={() => setSelectedRequest(null)} className="acr-btn-close">
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="acr-modal-body">
              {actionFeedback && (
                <div
                  style={{
                    padding: "0.8rem 1rem",
                    borderRadius: 10,
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    background:
                      actionFeedback.type === "success"
                        ? "rgba(16, 185, 129, 0.15)"
                        : "rgba(239, 68, 68, 0.15)",
                    border: `1px solid ${
                      actionFeedback.type === "success"
                        ? "rgba(16, 185, 129, 0.35)"
                        : "rgba(239, 68, 68, 0.35)"
                    }`,
                    color: actionFeedback.type === "success" ? "#34d399" : "#f87171",
                  }}
                >
                  {actionFeedback.message}
                </div>
              )}

              {loadingDossier ? (
                <div style={{ textAlign: "center", padding: "4rem", color: "#94a3b8" }}>
                  Loading complete dossier audit and financial telemetry...
                </div>
              ) : (
                <>
                  <div className="acr-dossier-grid">
                    {/* CARD 1: REQUEST PROFILE & REASON */}
                    <div className="acr-section-box">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span className="acr-section-title">Card 01 • Request Profile & Reason</span>
                        {selectedRequest.is_confidential === 1 && (
                          <span
                            style={{
                              padding: "2px 8px",
                              borderRadius: 999,
                              fontSize: "0.68rem",
                              fontWeight: 800,
                              background: "rgba(168, 85, 247, 0.15)",
                              color: "#d8b4fe",
                              border: "1px solid rgba(168, 85, 247, 0.3)",
                            }}
                          >
                            🔒 Confidential
                          </span>
                        )}
                      </div>

                      <div className="acr-detail-row">
                        <span className="acr-detail-label">Member:</span>
                        <span className="acr-detail-val">{selectedRequest.member_name}</span>
                      </div>

                      <div className="acr-detail-row">
                        <span className="acr-detail-label">Request Type:</span>
                        <span className="acr-detail-val">
                          {selectedRequest.request_type === "member_change_trainer"
                            ? "Member Transfer Request"
                            : selectedRequest.request_type === "member_change_plan"
                            ? "Membership Plan Change"
                            : "Trainer Member Removal"}
                        </span>
                      </div>

                      <div className="acr-detail-row">
                        <span className="acr-detail-label">Reason Code:</span>
                        <span className="acr-detail-val" style={{ color: "#00f2fe" }}>
                          {selectedRequest.reason_code?.replace(/_/g, " ").toUpperCase()}
                        </span>
                      </div>

                      <div style={{ marginTop: 8 }}>
                        <span className="acr-detail-label" style={{ display: "block", marginBottom: 4 }}>
                          Description / Member Notes:
                        </span>
                        <div
                          style={{
                            padding: 10,
                            borderRadius: 8,
                            background: "rgba(0, 0, 0, 0.35)",
                            border: "1px solid rgba(255, 255, 255, 0.05)",
                            fontSize: "0.78rem",
                            color: "#cbd5e1",
                            lineHeight: 1.5,
                          }}
                        >
                          {selectedRequest.description || "No additional explanation provided."}
                        </div>
                      </div>
                    </div>

                    {/* CARD 2: ROSTER ALIGNMENT / PLAN DETAILS */}
                    <div className="acr-section-box">
                      <span className="acr-section-title">
                        {selectedRequest.request_type === "member_change_plan"
                          ? "Card 02 • Membership Plan Migration"
                          : "Card 02 • Roster Alignment"}
                      </span>

                      {selectedRequest.request_type === "member_change_plan" ? (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                          <div
                            style={{
                              padding: 10,
                              borderRadius: 8,
                              background: "rgba(0, 0, 0, 0.35)",
                              border: "1px solid rgba(255, 255, 255, 0.06)",
                            }}
                          >
                            <div style={{ fontSize: "0.68rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>
                              Current Tier
                            </div>
                            <div style={{ fontWeight: 800, color: "#ffffff", marginTop: 2 }}>
                              {selectedRequest.current_plan_duration ? selectedRequest.current_plan_duration.replace(/_/g, " ").toUpperCase() : "Active Member Tier"}
                            </div>
                            <div style={{ fontSize: "0.74rem", color: "#94a3b8", marginTop: 2 }}>
                              Gym Membership
                            </div>
                          </div>

                          <div
                            style={{
                              padding: 10,
                              borderRadius: 8,
                              background: "rgba(0, 0, 0, 0.35)",
                              border: "1px solid rgba(255, 255, 255, 0.06)",
                            }}
                          >
                            <div style={{ fontSize: "0.68rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>
                              Requested Tier
                            </div>
                            <div style={{ fontWeight: 800, color: "#34d399", marginTop: 2 }}>
                              {selectedRequest.requested_plan_duration ? selectedRequest.requested_plan_duration.replace(/_/g, " ").toUpperCase() : "Target Tier"}
                            </div>
                            <div style={{ fontSize: "0.74rem", color: "#00f2fe", marginTop: 2 }}>
                              Adjustment: ₹{Number(selectedRequest.plan_adjustment_inr || 0)}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                          <div
                            style={{
                              padding: 10,
                              borderRadius: 8,
                              background: "rgba(0, 0, 0, 0.35)",
                              border: "1px solid rgba(255, 255, 255, 0.06)",
                            }}
                          >
                            <div style={{ fontSize: "0.68rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>
                              Current Coach
                            </div>
                            <div style={{ fontWeight: 800, color: "#ffffff", marginTop: 2 }}>
                              {selectedRequest.current_trainer_name || "None"}
                            </div>
                            <div style={{ fontSize: "0.74rem", color: "#00f2fe", fontFamily: "JetBrains Mono" }}>
                              ₹{selectedRequest.current_trainer_fee || 2500}/mo
                            </div>
                          </div>

                          <div
                            style={{
                              padding: 10,
                              borderRadius: 8,
                              background: "rgba(0, 0, 0, 0.35)",
                              border: "1px solid rgba(255, 255, 255, 0.06)",
                            }}
                          >
                            <div style={{ fontSize: "0.68rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>
                              Preferred Coach
                            </div>
                            <div style={{ fontWeight: 800, color: "#ffffff", marginTop: 2 }}>
                              {selectedRequest.preferred_trainer_name || "Unassigned Floor Access"}
                            </div>
                            {selectedRequest.preferred_trainer_fee && (
                              <div style={{ fontSize: "0.74rem", color: "#00f2fe", fontFamily: "JetBrains Mono" }}>
                                ₹{selectedRequest.preferred_trainer_fee}/mo
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div style={{ marginTop: 8 }}>
                        <span className="acr-detail-label" style={{ fontSize: "0.7rem", textTransform: "uppercase", fontWeight: 700 }}>
                          {selectedRequest.request_type === "member_change_plan" ? "Access Privilege Status" : "Assignment History"}
                        </span>
                        {selectedRequest.request_type === "member_change_plan" ? (
                          <div style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.06)", fontSize: "0.74rem", color: "#cbd5e1" }}>
                            {Number(selectedRequest.plan_adjustment_inr || 0) > 0
                              ? "Upon admin approval, an automated Cashfree payment gateway order will be created for the prorated upgrade difference."
                              : "Plan downgrade or equal exchange: Non-refundable zero adjustment (₹0.00). New plan cycle will immediately activate upon admin approval."}
                          </div>
                        ) : (
                          <div
                            style={{
                              maxHeight: 90,
                              overflowY: "auto",
                              marginTop: 4,
                              border: "1px solid rgba(255, 255, 255, 0.06)",
                              borderRadius: 8,
                              padding: "6px 10px",
                              background: "rgba(0,0,0,0.2)",
                            }}
                          >
                            {!dossierDetails?.assignmentHistory?.length ? (
                              <div style={{ fontSize: "0.72rem", color: "#64748b" }}>No prior assignment records.</div>
                            ) : (
                              dossierDetails.assignmentHistory.map((ta) => (
                                <div
                                  key={ta.id}
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    fontSize: "0.72rem",
                                    padding: "3px 0",
                                  }}
                                >
                                  <span style={{ color: "#cbd5e1" }}>{ta.trainer_name}</span>
                                  <span style={{ color: "#64748b" }}>
                                    {ta.status} • {new Date(ta.start_at).toLocaleDateString()}
                                  </span>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* CARD 3: PRORATED BILLING ENGINE */}
                    <div className="acr-section-box">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span className="acr-section-title">Card 03 • Prorated Billing Engine Breakdown</span>
                        <span style={{ fontSize: "0.68rem", color: "#94a3b8", fontFamily: "JetBrains Mono" }}>
                          100% INR Arithmetic
                        </span>
                      </div>

                      {selectedRequest.request_type === "member_change_plan" ? (
                        <>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, textAlign: "center" }}>
                            <div style={{ padding: 8, borderRadius: 8, background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.06)" }}>
                              <div style={{ fontSize: "0.65rem", color: "#64748b", textTransform: "uppercase" }}>Target Plan Adjustment</div>
                              <div style={{ fontWeight: 800, color: "#34d399", marginTop: 2, fontFamily: "JetBrains Mono", fontSize: "1rem" }}>
                                ₹{Number(selectedRequest.plan_adjustment_inr || 0)}
                              </div>
                            </div>

                            <div style={{ padding: 8, borderRadius: 8, background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.06)" }}>
                              <div style={{ fontSize: "0.65rem", color: "#64748b", textTransform: "uppercase" }}>Policy Enforced</div>
                              <div style={{ fontWeight: 800, color: Number(selectedRequest.plan_adjustment_inr || 0) > 0 ? "#fbbf24" : "#00f2fe", marginTop: 2, fontSize: "0.78rem" }}>
                                {Number(selectedRequest.plan_adjustment_inr || 0) > 0 ? "Upgrade Charge Due" : "Strict Zero-Refund"}
                              </div>
                            </div>
                          </div>

                          <div
                            style={{
                              marginTop: 10,
                              padding: 10,
                              borderRadius: 8,
                              background: "rgba(0, 242, 254, 0.08)",
                              border: "1px solid rgba(0, 242, 254, 0.2)",
                              fontSize: "0.75rem",
                              color: "#cbd5e1",
                              lineHeight: 1.5,
                            }}
                          >
                            <span style={{ fontWeight: 700, color: "#00f2fe" }}>Proration Audit Breakdown: </span>
                            {selectedRequest.description || "Unused value credited towards upgrade duration. Strict no-refund policy applied on downgrades."}
                          </div>
                        </>
                      ) : selectedRequest.request_type === "member_change_trainer" ? (
                        <>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, textAlign: "center" }}>
                            <div style={{ padding: 8, borderRadius: 8, background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.06)" }}>
                              <div style={{ fontSize: "0.65rem", color: "#64748b", textTransform: "uppercase" }}>Rate Delta</div>
                              <div style={{ fontWeight: 800, color: "#ffffff", marginTop: 2 }}>
                                ₹{(Number(selectedRequest.preferred_trainer_fee || 0) - Number(selectedRequest.current_trainer_fee || 0))}
                              </div>
                            </div>

                            <div style={{ padding: 8, borderRadius: 8, background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.06)" }}>
                              <div style={{ fontSize: "0.65rem", color: "#64748b", textTransform: "uppercase" }}>Remaining Days</div>
                              <div style={{ fontWeight: 800, color: "#00f2fe", marginTop: 2 }}>
                                {selectedRequest.calculation_snapshot
                                  ? JSON.parse(selectedRequest.calculation_snapshot)?.billingCycle?.remainingDays
                                  : "16"} / 30 d
                              </div>
                            </div>

                            <div style={{ padding: 8, borderRadius: 8, background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.06)" }}>
                              <div style={{ fontSize: "0.65rem", color: "#64748b", textTransform: "uppercase" }}>Final Adjustment</div>
                              <div
                                style={{
                                  fontWeight: 800,
                                  fontFamily: "JetBrains Mono",
                                  marginTop: 2,
                                  color:
                                    selectedRequest.final_adjustment_minor > 0
                                      ? "#fbbf24"
                                      : selectedRequest.final_adjustment_minor < 0
                                      ? "#34d399"
                                      : "#cbd5e1",
                                }}
                              >
                                ₹{Math.abs(selectedRequest.final_adjustment_minor / 100)}
                              </div>
                            </div>
                          </div>

                          <div
                            style={{
                              padding: 10,
                              borderRadius: 8,
                              background: "rgba(0, 242, 254, 0.08)",
                              border: "1px solid rgba(0, 242, 254, 0.2)",
                              fontSize: "0.75rem",
                              color: "#cbd5e1",
                              lineHeight: 1.5,
                            }}
                          >
                            <span style={{ fontWeight: 700, color: "#00f2fe" }}>Billing Logic: </span>
                            {selectedRequest.calculation_snapshot
                              ? JSON.parse(selectedRequest.calculation_snapshot)?.explanation
                              : "Calculated dynamically based on remaining days in billing cycle."}
                          </div>
                        </>
                      ) : (
                        <div style={{ padding: 12, borderRadius: 8, background: "rgba(0,0,0,0.35)", color: "#94a3b8", fontSize: "0.75rem" }}>
                          Trainer removal requests do not alter gym base access. Member will be placed in an unassigned coaching tier until a replacement is chosen.
                        </div>
                      )}
                    </div>

                    {/* CARD 4: CALENDAR & SESSIONS */}
                    <div className="acr-section-box">
                      <span className="acr-section-title">Card 04 • Calendar & Session Impact</span>

                      {selectedRequest.request_type === "member_change_plan" ? (
                        <div style={{ padding: 10, borderRadius: 8, background: "rgba(0,0,0,0.3)", color: "#94a3b8", fontSize: "0.74rem", lineHeight: 1.5 }}>
                          Membership plan modification alters facility duration & privileges. Personal trainer allocations and scheduled coaching sessions remain untouched.
                        </div>
                      ) : (
                        <>
                          <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                            Upcoming 1-on-1 sessions requiring automated reconciliation:
                          </div>

                          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 110, overflowY: "auto", marginTop: 6 }}>
                            {!dossierDetails?.upcomingSessions?.length ? (
                              <div style={{ padding: 8, borderRadius: 8, background: "rgba(0,0,0,0.3)", color: "#64748b", fontSize: "0.72rem" }}>
                                No conflicting scheduled 1-on-1 sessions detected.
                              </div>
                            ) : (
                              dossierDetails.upcomingSessions.map((s) => (
                                <div
                                  key={s.id}
                                  style={{
                                    padding: "6px 10px",
                                    borderRadius: 8,
                                    background: "rgba(0,0,0,0.35)",
                                    border: "1px solid rgba(255,255,255,0.06)",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    fontSize: "0.72rem",
                                  }}
                                >
                                  <div>
                                    <div style={{ fontWeight: 700, color: "#ffffff" }}>{s.title}</div>
                                    <div style={{ color: "#64748b", fontSize: "0.68rem" }}>{s.session_time}</div>
                                  </div>
                                  <span
                                    style={{
                                      fontSize: "0.65rem",
                                      fontWeight: 800,
                                      padding: "2px 6px",
                                      borderRadius: 4,
                                      background: "rgba(245, 158, 11, 0.15)",
                                      color: "#fbbf24",
                                      border: "1px solid rgba(245, 158, 11, 0.3)",
                                    }}
                                  >
                                    Auto-Reassign
                                  </span>
                                </div>
                              ))
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* AUDIT LOG TIMELINE */}
                  <div className="acr-section-box">
                    <span className="acr-section-title">Durable Audit Trail</span>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {dossierDetails?.auditTrail?.map((log) => (
                        <div
                          key={log.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: "0.72rem",
                            padding: "4px 0",
                            borderBottom: "1px solid rgba(255,255,255,0.04)",
                          }}
                        >
                          <span style={{ color: "#cbd5e1" }}>
                            <strong style={{ color: "#ffffff" }}>{log.actor_name || log.actor_role}</strong>: {log.action}
                          </span>
                          <span style={{ color: "#64748b", fontFamily: "JetBrains Mono" }}>
                            {new Date(log.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer: ONE-CLICK ACTIONS */}
            <div className="acr-modal-footer">
              <div style={{ flex: 1, fontSize: "0.75rem", color: "#94a3b8" }}>
                {selectedRequest.status === "Submitted" || selectedRequest.status === "Under Review" ? (
                  <span>Admin action will automatically execute assignments, reconciliations, and notifications.</span>
                ) : (
                  <span>Request has already been finalized (Status: {selectedRequest.status}).</span>
                )}
              </div>

              {(selectedRequest.status === "Submitted" || selectedRequest.status === "Under Review") && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    onClick={() => setShowRejectModal(true)}
                    disabled={actionLoading}
                    className="acr-btn-reject"
                  >
                    Reject Request
                  </button>

                  <button
                    onClick={handleApprove}
                    disabled={actionLoading}
                    className="acr-btn-approve"
                  >
                    {actionLoading ? "Processing Automation..." : "✓ Approve Request"}
                  </button>
                </div>
              )}

              <button onClick={() => setSelectedRequest(null)} className="acr-btn-close">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECTION REASON MODAL */}
      {showRejectModal && (
        <div className="acr-modal-overlay">
          <div
            className="acr-modal-content"
            style={{ maxWidth: 480, padding: "1.4rem", gap: "1rem" }}
          >
            <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#ffffff", margin: 0 }}>
              Reject Change Request
            </h3>
            <p style={{ fontSize: "0.75rem", color: "#94a3b8", margin: 0 }}>
              Choose a standard rejection note or enter specific feedback. The initiator will receive an instant notification explaining this outcome.
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {[
                "Preferred coach at maximum roster capacity",
                "Scheduling conflict on peak hours",
                "Policy limit: transfer requested within 14 days",
                "Administrative hold for member account",
              ].map((reason) => (
                <button
                  key={reason}
                  onClick={() => setRejectionReason(reason)}
                  className="acr-pill-btn"
                  style={{ fontSize: "0.7rem", padding: "4px 8px" }}
                >
                  {reason}
                </button>
              ))}
            </div>

            <textarea
              rows="3"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter rejection reason..."
              style={{
                width: "100%",
                background: "rgba(0,0,0,0.4)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 10,
                padding: 10,
                color: "#ffffff",
                fontSize: "0.78rem",
                outline: "none",
                resize: "none",
              }}
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => setShowRejectModal(false)} className="acr-btn-close">
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading || !rejectionReason.trim()}
                className="acr-btn-reject"
                style={{ background: "#ef4444", color: "#ffffff" }}
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

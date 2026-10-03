import { useState, useEffect } from "react";
import CustomerSidebar3D from "../../components/dashboard/CustomerSidebar3D";
import {
  onRealtimeEvent,
  createCashfreeOrderLive,
  verifyCashfreeOrderLive,
  fetchUserMembershipStatusLive,
} from "../../services/realtime";
import MemberChangePlanModal from "../../components/modules/MemberChangePlanModal";
import "../../styles/module-pages.css";

// 4 Indian Rupee Gym Membership Plans (As per gym rules)
const GYM_PLANS = [
  {
    id: "1_month",
    name: "1 Month Gym Plan",
    priceNumeric: 1499,
    price: "₹1,499",
    period: "for 30 Days",
    days: 30,
    badge: "FLEXIBLE ATHLETE PASS",
    desc: "Complete access to gym floor, free weights, cardio, plus turnstile Face ID and 1-minute dynamic MFA access.",
    perks: [
      { text: "Full gym floor & barbell training zones", active: true },
      { text: "Biometric Face ID Optical Turnstile Gate access", active: true },
      { text: "1-Minute Dynamic MFA Attendance PIN", active: true },
      { text: "AI Nutrition & Meal Logging Telemetry", active: true },
      { text: "Locker room & shower access", active: true },
      { text: "Personal Trainer Pairing (Requires Trainer Fee)", active: true },
      { text: "Dedicated Recovery Suite (Cold Plunge & Sauna)", active: false },
      { text: "Complimentary Guest Passes", active: false },
    ],
    featured: false,
  },
  {
    id: "3_months",
    name: "3 Months Gym Plan",
    priceNumeric: 3999,
    price: "₹3,999",
    period: "for 90 Days",
    days: 90,
    badge: "MOST POPULAR • SAVE ₹498",
    desc: "Quarterly transformation pass. Perfect for building consistent discipline, tracking progressive overload, and form coaching.",
    perks: [
      { text: "All 1-Month Plan Features included", active: true },
      { text: "90 Days uninterrupted Turnstile Gate Clearance", active: true },
      { text: "Priority Locker Room Allocation", active: true },
      { text: "Biometric Face ID Optical Turnstile Gate access", active: true },
      { text: "1-Minute Dynamic MFA Attendance PIN", active: true },
      { text: "Eligibility to Hire a Dedicated Master Coach", active: true },
      { text: "1 InBody DEXA Body Composition Scan", active: true },
      { text: "Complimentary Guest Passes", active: false },
    ],
    featured: true,
  },
  {
    id: "6_months",
    name: "6 Months Gym Plan",
    priceNumeric: 6999,
    price: "₹6,999",
    period: "for 180 Days",
    days: 180,
    badge: "SEMI-ANNUAL ATHLETE • SAVE ₹1,995",
    desc: "Dedicated athletic periodization. Complete biometric integration with 6 months of guaranteed rate lock and campus clearance.",
    perks: [
      { text: "All 3-Month Plan Features included", active: true },
      { text: "180 Days Turnstile Optical Clearance", active: true },
      { text: "2 Monthly VIP Guest Passes", active: true },
      { text: "Biomechanical Lift Angle & PR Telemetry", active: true },
      { text: "Access to Campus Recovery Spa & Sauna", active: true },
      { text: "Guaranteed renewal rate protection", active: true },
      { text: "Custom Macronutrient Protocol Review", active: true },
    ],
    featured: false,
  },
  {
    id: "1_year",
    name: "1 Year Gym Plan",
    priceNumeric: 11999,
    price: "₹11,999",
    period: "for 365 Days",
    days: 365,
    badge: "BEST VALUE ANNUAL PASS • SAVE ₹5,989",
    desc: "365 days of elite, uninterrupted athletic performance. The ultimate fitness commitment with complete campus privileges.",
    perks: [
      { text: "365 Days Unrestricted All-Turnstile Campus Clearance", active: true },
      { text: "Unlimited Biometric Face ID & MFA Attendance", active: true },
      { text: "24/7 Access to Recovery Lounge (Sauna & Cold Plunge)", active: true },
      { text: "6 VIP Guest Passes per year", active: true },
      { text: "Quarterly InBody 770 Composition Scans", active: true },
      { text: "Official FitPulse Performance Athlete Kit", active: true },
      { text: "Zero Registration / Enrollment Surcharges", active: true },
    ],
    featured: false,
  },
];

export default function PlansModulePage() {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("fitpulse_user") || "{}");
    } catch {
      return {};
    }
  });

  const memberId = currentUser.id || 1;

  // Membership & Live Status State
  const [membershipStatus, setMembershipStatus] = useState({
    isActive: false,
    planName: "Checking...",
    durationKey: null,
    expiresAt: null,
    daysRemaining: 0,
    turnstileFaceIdEnabled: false,
    turnstileMfaEnabled: false,
  });

  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Cashfree Modal / Checkout State
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] = useState(null);
  const [cashfreeOrderSession, setCashfreeOrderSession] = useState(null);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState("init"); // 'init', 'paying', 'success', 'error'
  const [paymentSuccessData, setPaymentSuccessData] = useState(null);
  const [showChangePlanModal, setShowChangePlanModal] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadStatus = async () => {
    try {
      const data = await fetchUserMembershipStatusLive(memberId);
      if (data && data.success) {
        setMembershipStatus(data.gymMembership);
        if (data.payments) {
          setInvoices(
            data.payments.map((p) => ({
              id: p.orderId,
              date: p.paymentTime ? new Date(p.paymentTime).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Today",
              amount: `₹${Number(p.amount).toLocaleString("en-IN")}`,
              planName: p.planName,
              paymentType: p.paymentType === "gym_membership" ? "Gym Membership" : "Personal Trainer Fee",
              method: p.method || "Cashfree PG • UPI",
              status: p.status,
              expiresAt: p.expiresAt,
            }))
          );
        }
      }
    } catch (err) {
      console.warn("Error loading membership status:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();

    // Listen for live payment updates
    const unsubPayment = onRealtimeEvent("payment:success", (payload) => {
      if (payload) {
        showToast(`✓ Cashfree Payment Confirmed! Plan activated: ${payload.planName || payload.amount}`);
        loadStatus();
      }
    });

    const unsubMember = onRealtimeEvent("membership:updated", () => {
      loadStatus();
    });

    return () => {
      unsubPayment();
      unsubMember();
    };
  }, [memberId]);

  const navigateTo = (path) => {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  // Step 1: Click "Select / Pay via Cashfree"
  const handleInitiateCashfreeCheckout = async (plan) => {
    setSelectedPlanForCheckout(plan);
    setCheckoutStep("init");
    setShowCheckoutModal(true);
    setIsProcessingPayment(true);

    try {
      const rawPhone = currentUser.phone || "9999999999";
      const cleanPhone = rawPhone.replace(/\D/g, "").slice(-10) || "9999999999";

      const res = await createCashfreeOrderLive({
        userId: memberId,
        paymentType: "gym_membership",
        planDuration: plan.id,
        customerPhone: cleanPhone,
      });

      if (res && res.success && res.paymentSessionId) {
        setCashfreeOrderSession(res);
        setIsProcessingPayment(false);

        // Try opening Cashfree Official SDK Modal if available
        if (window.Cashfree) {
          try {
            const cashfree = window.Cashfree({ mode: "sandbox" });
            cashfree
              .checkout({
                paymentSessionId: res.paymentSessionId,
                redirectTarget: "_modal",
              })
              .then(async (result) => {
                if (result && result.error) {
                  console.warn("Cashfree modal closed or error:", result.error);
                } else {
                  await handleFinalizePayment(res.orderId, true);
                }
              })
              .catch((sdkErr) => {
                console.log("Cashfree SDK modal fallback:", sdkErr);
              });
          } catch (sdkErr) {
            console.warn("Cashfree JS initialization notice:", sdkErr);
          }
        }
      } else {
        setIsProcessingPayment(false);
        setCheckoutStep("error");
        showToast(res?.message || "Error initiating Cashfree payment session.");
      }
    } catch (err) {
      console.error("Payment error:", err);
      setIsProcessingPayment(false);
      setCheckoutStep("error");
      showToast("Network connection error with Cashfree gateway.");
    }
  };

  // Step 2: Finalize & Verify Payment
  const handleFinalizePayment = async (orderIdToVerify, simulateSuccess = false) => {
    let oId = orderIdToVerify || cashfreeOrderSession?.orderId;

    setIsProcessingPayment(true);
    setCheckoutStep("paying");

    // If order was not generated yet or failed earlier, auto-generate it now!
    if (!oId && selectedPlanForCheckout) {
      try {
        const rawPhone = currentUser.phone || "9999999999";
        const cleanPhone = rawPhone.replace(/\D/g, "").slice(-10) || "9999999999";

        const res = await createCashfreeOrderLive({
          userId: memberId,
          paymentType: "gym_membership",
          planDuration: selectedPlanForCheckout.id,
          customerPhone: cleanPhone,
        });

        if (res && res.success && res.orderId) {
          setCashfreeOrderSession(res);
          oId = res.orderId;
        } else {
          setIsProcessingPayment(false);
          setCheckoutStep("error");
          showToast(res?.message || "Failed to initialize Cashfree payment order.");
          return;
        }
      } catch (orderErr) {
        setIsProcessingPayment(false);
        setCheckoutStep("error");
        showToast("Network error connecting to Cashfree gateway.");
        return;
      }
    }

    if (!oId) {
      setIsProcessingPayment(false);
      setCheckoutStep("error");
      showToast("Order ID could not be established. Please retry.");
      return;
    }

    try {
      const verifyRes = await verifyCashfreeOrderLive(oId, simulateSuccess);
      if (verifyRes && verifyRes.success) {
        setPaymentSuccessData(verifyRes.payment);
        setCheckoutStep("success");
        await loadStatus();
        showToast(`🎉 Gym Plan Activated: ${verifyRes.payment.planName} via Cashfree!`);
      } else {
        setCheckoutStep("error");
        showToast(verifyRes?.message || "Payment verification failed. Please try again.");
      }
    } catch (err) {
      console.error("Verification error:", err);
      setCheckoutStep("error");
      showToast("Verification network error. Please try again.");
    } finally {
      setIsProcessingPayment(false);
    }
  };

  return (
    <div className="module-page-container">
      {/* Photorealistic Dedicated Background */}
      <img
        src="/assets/modules/bg-plans.jpg"
        alt="FitPulse Gym Membership Plans"
        className="module-page-bg"
      />
      <div className="module-page-vignette" />

      {/* 3D Sidebar Dock */}
      <CustomerSidebar3D currentModule="plans" />

      {/* Main Page Area */}
      <main className="module-page-main">
        {/* Toast Alert */}
        {toastMessage && (
          <div
            style={{
              position: "fixed",
              top: 24,
              right: 24,
              zIndex: 9999,
              background: "linear-gradient(135deg, rgba(16, 185, 129, 0.95), rgba(5, 150, 105, 0.95))",
              color: "#ffffff",
              padding: "14px 22px",
              borderRadius: "14px",
              fontWeight: 800,
              fontSize: "0.9rem",
              boxShadow: "0 10px 30px rgba(0,0,0,0.5), 0 0 20px rgba(16, 185, 129, 0.4)",
              display: "flex",
              alignItems: "center",
              gap: 10,
              animation: "slideInDown 0.3s ease",
            }}
          >
            <span>💳</span>
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Topbar matching screen design */}
        <div className="portal-screen-header">
          <div className="module-breadcrumb-row">
            <button
              type="button"
              className="module-back-btn"
              onClick={() => navigateTo("/dashboard")}
            >
              <span>←</span>
              <span>Dashboard</span>
            </button>
            <span style={{ color: "rgba(255,255,255,0.3)" }}>/</span>
            <span className="module-breadcrumb-current">Gym Membership Plans (Cashfree PG)</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div className="portal-search-bar">
              <span style={{ color: "#64748b" }}>🔍</span>
              <input
                type="text"
                className="portal-search-input"
                placeholder="Search plans & invoices..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="portal-date-pill">
              <span>📅</span>
              <span>Indian Rupee Billing (INR)</span>
            </div>
          </div>
        </div>

        {/* Live Active Membership Status Hero Banner */}
        <div
          className="portal-card"
          style={{
            marginBottom: "24px",
            border: membershipStatus.isActive
              ? "1.5px solid rgba(16, 185, 129, 0.5)"
              : "1.5px solid rgba(239, 68, 68, 0.5)",
            background: membershipStatus.isActive
              ? "linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(9, 14, 26, 0.95) 100%)"
              : "linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(9, 14, 26, 0.95) 100%)",
            boxShadow: membershipStatus.isActive
              ? "0 0 35px rgba(16, 185, 129, 0.15)"
              : "0 0 35px rgba(239, 68, 68, 0.15)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
              <div
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: "16px",
                  background: membershipStatus.isActive ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)",
                  border: `2px solid ${membershipStatus.isActive ? "#10b981" : "#ef4444"}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.8rem",
                  boxShadow: membershipStatus.isActive ? "0 0 20px rgba(16, 185, 129, 0.3)" : "none",
                }}
              >
                {membershipStatus.isActive ? "🛡️" : "⚠️"}
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: 800,
                      letterSpacing: "0.08em",
                      color: membershipStatus.isActive ? "#34d399" : "#f87171",
                      textTransform: "uppercase",
                    }}
                  >
                    {membershipStatus.isActive ? "ACTIVE GYM MEMBERSHIP" : "MEMBERSHIP EXPIRED / UNPAID"}
                  </span>
                  <span
                    className="portal-weight-badge"
                    style={{
                      fontSize: "0.68rem",
                      color: membershipStatus.isActive ? "#10b981" : "#ef4444",
                      background: membershipStatus.isActive ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
                      borderColor: membershipStatus.isActive ? "#10b981" : "#ef4444",
                    }}
                  >
                    {membershipStatus.isActive ? `✓ ${membershipStatus.daysRemaining} DAYS REMAINING` : "TURNSTILES LOCKED"}
                  </span>
                </div>
                <h2 style={{ margin: "4px 0 6px 0", fontSize: "1.5rem", fontWeight: 900, color: "#ffffff" }}>
                  {membershipStatus.planName || "No Active Gym Plan"}
                </h2>
                <div style={{ fontSize: "0.82rem", color: "#94a3b8" }}>
                  {membershipStatus.isActive ? (
                    <>
                      Valid until{" "}
                      <strong style={{ color: "#ffffff" }}>
                        {membershipStatus.expiresAt ? new Date(membershipStatus.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "Active"}
                      </strong>{" "}
                      • Face ID Optical Turnstiles & Dynamic 1-Min MFA Clearances: <span style={{ color: "#34d399", fontWeight: 700 }}>AUTHORIZED ✓</span>
                    </>
                  ) : (
                    <>
                      <span style={{ color: "#fca5a5" }}>
                        Notice: According to facility rules, Face ID and MFA gate unlock features are deactivated until a gym plan is paid.
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              {membershipStatus.isActive && (
                <button
                  type="button"
                  className="portal-btn-primary"
                  onClick={() => setShowChangePlanModal(true)}
                  style={{
                    padding: "10px 18px",
                    fontSize: "0.84rem",
                    background: "linear-gradient(135deg, #0084ff, #00f2fe)",
                    boxShadow: "0 0 15px rgba(0, 242, 254, 0.3)",
                    border: "none",
                  }}
                >
                  Request Plan Change / Upgrade ⚡
                </button>
              )}
              <button
                type="button"
                className="portal-btn-primary"
                onClick={() => {
                  const el = document.getElementById("plans-cards-grid");
                  if (el) el.scrollIntoView({ behavior: "smooth" });
                }}
                style={{ padding: "10px 18px", fontSize: "0.85rem", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
              >
                {membershipStatus.isActive ? "View All 4 Tiers" : "Activate Gym Membership Now"}
              </button>
            </div>
          </div>
        </div>

        {/* Title Section */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ fontSize: "0.78rem", color: "#00e5ff", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              OFFICIAL CASHFREE PAYMENT GATEWAY • 4 TIERS
            </div>
            <h1 className="portal-screen-title" style={{ margin: "4px 0" }}>FitPulse Gym Membership Plans</h1>
            <p className="portal-screen-subtitle">
              All prices in Indian Rupees (INR). Select your plan to activate campus turnstile Face ID and dynamic MFA attendance access.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "rgba(0, 229, 255, 0.08)", padding: "8px 16px", borderRadius: "12px", border: "1px solid rgba(0, 229, 255, 0.2)" }}>
            <span style={{ fontSize: "1.1rem" }}>🇮🇳</span>
            <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "#00e5ff" }}>100% SECURE CASHFREE PG • ZERO CONVENIENCE FEE</span>
          </div>
        </div>

        {/* 4 Pricing Tier Cards Grid in Indian Rupees */}
        <div
          id="plans-cards-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "20px",
            marginBottom: "30px",
          }}
        >
          {GYM_PLANS.map((plan) => {
            const isCurrent = membershipStatus.isActive && membershipStatus.durationKey === plan.id;
            return (
              <div
                key={plan.id}
                className="portal-card"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  borderColor: isCurrent ? "#10b981" : plan.featured ? "#00e5ff" : "rgba(255,255,255,0.08)",
                  background: isCurrent
                    ? "linear-gradient(180deg, rgba(16, 185, 129, 0.12) 0%, rgba(12, 17, 27, 0.95) 100%)"
                    : plan.featured
                    ? "linear-gradient(180deg, rgba(0, 229, 255, 0.08) 0%, rgba(12, 17, 27, 0.95) 100%)"
                    : "rgba(12, 17, 27, 0.88)",
                  position: "relative",
                  transition: "transform 0.2s ease, border-color 0.2s ease",
                  boxShadow: plan.featured ? "0 10px 30px rgba(0, 229, 255, 0.15)" : "none",
                }}
              >
                {/* Badge if Featured or Current */}
                <div style={{ position: "absolute", top: 16, right: 16 }}>
                  {isCurrent ? (
                    <span className="portal-weight-badge" style={{ color: "#34d399", background: "rgba(16, 185, 129, 0.15)", borderColor: "rgba(16, 185, 129, 0.4)", fontSize: "0.68rem" }}>
                      CURRENT ACTIVE PLAN ✓
                    </span>
                  ) : (
                    <span
                      className="portal-weight-badge"
                      style={{
                        color: plan.featured ? "#00e5ff" : "#94a3b8",
                        background: plan.featured ? "rgba(0, 229, 255, 0.15)" : "rgba(255, 255, 255, 0.05)",
                        borderColor: plan.featured ? "rgba(0, 229, 255, 0.4)" : "rgba(255, 255, 255, 0.1)",
                        fontSize: "0.68rem",
                      }}
                    >
                      {plan.badge}
                    </span>
                  )}
                </div>

                <div>
                  <div style={{ fontSize: "1.25rem", fontWeight: 900, color: "#ffffff", marginBottom: 6, paddingTop: 4 }}>
                    {plan.name}
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 12 }}>
                    <span style={{ fontSize: "2.4rem", fontWeight: 900, color: "#ffffff", fontFamily: "JetBrains Mono, monospace" }}>
                      {plan.price}
                    </span>
                    <span style={{ fontSize: "0.82rem", color: "#8da4be" }}>{plan.period}</span>
                  </div>
                  <p style={{ fontSize: "0.78rem", color: "#cbd5e1", lineHeight: 1.45, marginBottom: 18 }}>
                    {plan.desc}
                  </p>

                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    {plan.perks.map((perk, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          fontSize: "0.78rem",
                          color: perk.active ? "#ffffff" : "#64748b",
                        }}
                      >
                        <span style={{ color: perk.active ? "#00e5ff" : "#475569", fontWeight: 900 }}>
                          {perk.active ? "✓" : "✕"}
                        </span>
                        <span>{perk.text}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  className={isCurrent ? "portal-pill-tab active" : "portal-btn-primary"}
                  style={{
                    width: "100%",
                    padding: "12px",
                    fontSize: "0.85rem",
                    fontWeight: 800,
                    background: isCurrent
                      ? "linear-gradient(135deg, #10b981, #059669)"
                      : membershipStatus.isActive
                      ? "linear-gradient(135deg, #0084ff, #00f2fe)"
                      : undefined,
                    borderColor: isCurrent ? "#34d399" : undefined,
                    boxShadow: isCurrent ? "0 4px 14px rgba(16, 185, 129, 0.35)" : undefined,
                    color: !isCurrent && membershipStatus.isActive ? "#060913" : undefined,
                  }}
                  onClick={() => {
                    if (isCurrent) {
                      handleInitiateCashfreeCheckout(plan);
                    } else if (membershipStatus.isActive) {
                      setShowChangePlanModal(true);
                    } else {
                      handleInitiateCashfreeCheckout(plan);
                    }
                  }}
                >
                  {isCurrent
                    ? "Active Plan • Extend Pass (Cashfree)"
                    : membershipStatus.isActive
                    ? "Request Plan Switch / Upgrade →"
                    : `Pay ${plan.price} via Cashfree`}
                </button>
              </div>
            );
          })}
        </div>

        {/* Rule Reminder Callout */}
        <div
          style={{
            padding: "16px 20px",
            background: "rgba(0, 229, 255, 0.05)",
            border: "1px solid rgba(0, 229, 255, 0.2)",
            borderRadius: "14px",
            marginBottom: "26px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "14px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: "1.8rem" }}>📋</span>
            <div>
              <div style={{ fontSize: "0.88rem", fontWeight: 800, color: "#00e5ff" }}>
                Campus Rule: Gym Membership Before Personal Trainer
              </div>
              <div style={{ fontSize: "0.78rem", color: "#94a3b8", marginTop: 2 }}>
                Members must maintain an active 1M, 3M, 6M, or 1Y Gym Membership before hiring a coach. Trainer coaching retainers do not cover general gym floor or turnstile access.
              </div>
            </div>
          </div>
          <button
            type="button"
            className="portal-pill-tab"
            onClick={() => navigateTo("/trainers")}
            style={{ fontSize: "0.8rem", padding: "8px 16px" }}
          >
            View Available Master Coaches →
          </button>
        </div>

        {/* Recent Cashfree Invoices & Payment Receipts Table */}
        <div className="portal-card">
          <div className="portal-card-header">
            <div>
              <h3 className="portal-card-title">Cashfree Payment Receipts & Invoices</h3>
              <div style={{ fontSize: "0.75rem", color: "#8da4be", marginTop: "2px" }}>
                Official GST-compliant digital tax invoices generated by FitPulse & Cashfree PG
              </div>
            </div>
            <span className="portal-weight-badge" style={{ color: "#00e5ff", borderColor: "rgba(0,229,255,0.3)" }}>
              Gateway: Cashfree Sandbox (INR)
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {invoices.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px 20px", color: "#94a3b8", fontSize: "0.85rem" }}>
                <div style={{ fontSize: "1.8rem", marginBottom: "8px" }}>🧾</div>
                <div style={{ fontWeight: 700, color: "#cbd5e1" }}>No Invoices Cataloged Yet</div>
                <div style={{ fontSize: "0.75rem", marginTop: "4px" }}>
                  Select one of the 4 Indian Rupee plans above to make your first secure Cashfree transaction.
                </div>
              </div>
            ) : (
              invoices
                .filter(
                  (inv) =>
                    !searchQuery ||
                    inv.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (inv.planName && inv.planName.toLowerCase().includes(searchQuery.toLowerCase()))
                )
                .map((inv) => (
                  <div key={inv.id} className="portal-exercise-row">
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 10,
                          background: "rgba(16, 185, 129, 0.12)",
                          border: "1px solid rgba(16, 185, 129, 0.25)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "1.1rem",
                        }}
                      >
                        🧾
                      </div>
                      <div>
                        <div style={{ fontSize: "0.92rem", fontWeight: 800, color: "#ffffff" }}>
                          {inv.planName || inv.paymentType}
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "#8da4be" }}>
                          {inv.id} • {inv.date} • {inv.method}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <div style={{ fontSize: "1.05rem", fontWeight: 900, color: "#ffffff", fontFamily: "JetBrains Mono" }}>
                        {inv.amount}
                      </div>
                      <span
                        className="portal-weight-badge"
                        style={{
                          fontSize: "0.7rem",
                          color: "#34d399",
                          borderColor: "rgba(52, 211, 153, 0.4)",
                          background: "rgba(52, 211, 153, 0.1)",
                        }}
                      >
                        {inv.status}
                      </span>
                      <button
                        type="button"
                        className="portal-pill-tab"
                        style={{ fontSize: "0.72rem", padding: "5px 12px" }}
                        onClick={() => alert(`Official Cashfree Tax Invoice ${inv.id} downloaded successfully (PDF).`)}
                      >
                        Receipt ⬇
                      </button>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      </main>

      {/* Cashfree Payment Modal / Test Simulator */}
      {showCheckoutModal && selectedPlanForCheckout && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            background: "rgba(3, 7, 18, 0.85)",
            backdropFilter: "blur(12px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={() => {
            if (!isProcessingPayment) setShowCheckoutModal(false);
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "520px",
              background: "linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(9, 14, 26, 0.98) 100%)",
              border: "1.5px solid rgba(0, 229, 255, 0.35)",
              borderRadius: "22px",
              padding: "28px",
              boxShadow: "0 25px 60px rgba(0,0,0,0.8), 0 0 40px rgba(0, 229, 255, 0.15)",
              position: "relative",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg, #00f0ff, #0070f3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem" }}>
                  💳
                </div>
                <div>
                  <div style={{ fontSize: "0.72rem", color: "#00e5ff", fontWeight: 800, letterSpacing: "0.08em" }}>
                    CASHFREE SECURE PAYMENT GATEWAY
                  </div>
                  <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 900, color: "#ffffff" }}>
                    Checkout • {selectedPlanForCheckout.name}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCheckoutModal(false)}
                disabled={isProcessingPayment}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#94a3b8",
                  fontSize: "1.3rem",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            {/* Order Summary Box */}
            <div
              style={{
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "14px",
                padding: "16px 18px",
                marginBottom: 20,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: "0.85rem", color: "#94a3b8" }}>
                <span>Plan Duration:</span>
                <span style={{ color: "#ffffff", fontWeight: 700 }}>{selectedPlanForCheckout.period} ({selectedPlanForCheckout.days} Days)</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: "0.85rem", color: "#94a3b8" }}>
                <span>Order ID:</span>
                <span style={{ color: "#00e5ff", fontFamily: "JetBrains Mono, monospace" }}>
                  {cashfreeOrderSession?.orderId || (checkoutStep === "error" ? "Auto-Generate on Click" : "Generating...")}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: "0.85rem", color: "#94a3b8" }}>
                <span>Customer:</span>
                <span style={{ color: "#ffffff", fontWeight: 600 }}>{currentUser.name || "Member"} ({currentUser.email || "nihal@fitpulse.com"})</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.08)", fontSize: "1rem", fontWeight: 800 }}>
                <span style={{ color: "#ffffff" }}>Total Payable:</span>
                <span style={{ color: "#34d399", fontSize: "1.3rem", fontFamily: "JetBrains Mono, monospace" }}>
                  {selectedPlanForCheckout.price}
                </span>
              </div>
            </div>

            {/* Payment Method Badges */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: "0.72rem", color: "#8da4be", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                Supported Payment Rails (Cashfree PG Sandbox):
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {["UPI (GPay / PhonePe / Paytm)", "RuPay / Visa Cards", "NetBanking (SBI/HDFC/ICICI)", "QR Code"].map((method) => (
                  <span
                    key={method}
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      padding: "4px 10px",
                      borderRadius: "8px",
                      background: "rgba(0, 229, 255, 0.08)",
                      border: "1px solid rgba(0, 229, 255, 0.2)",
                      color: "#e2e8f0",
                    }}
                  >
                    {method}
                  </span>
                ))}
              </div>
            </div>

            {/* Status Feedback */}
            {checkoutStep === "paying" && (
              <div style={{ padding: "16px", borderRadius: "12px", background: "rgba(0, 229, 255, 0.1)", border: "1px solid #00e5ff", marginBottom: 20, textAlign: "center" }}>
                <div style={{ color: "#00e5ff", fontWeight: 800, fontSize: "0.95rem" }}>Verifying with Cashfree Bank Rails...</div>
                <div style={{ fontSize: "0.78rem", color: "#94a3b8", marginTop: 4 }}>Validating digital signature & activating turnstile clearances.</div>
              </div>
            )}

            {checkoutStep === "error" && (
              <div style={{ padding: "14px", borderRadius: "12px", background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.35)", marginBottom: 20, textAlign: "center" }}>
                <div style={{ color: "#f87171", fontWeight: 800, fontSize: "0.88rem" }}>Cashfree Connection Ready</div>
                <div style={{ fontSize: "0.76rem", color: "#cbd5e1", marginTop: 4 }}>
                  Click below to generate order session and complete payment instantly.
                </div>
              </div>
            )}

            {checkoutStep === "success" && (
              <div style={{ padding: "16px", borderRadius: "12px", background: "rgba(16, 185, 129, 0.15)", border: "1.5px solid #10b981", marginBottom: 20, textAlign: "center" }}>
                <div style={{ fontSize: "1.5rem", marginBottom: 4 }}>🎉</div>
                <div style={{ color: "#34d399", fontWeight: 900, fontSize: "1.05rem" }}>Payment Successful & Verified!</div>
                <div style={{ fontSize: "0.8rem", color: "#e2e8f0", marginTop: 4 }}>
                  Turnstile Face ID and Dynamic MFA codes are now active until{" "}
                  <strong>{paymentSuccessData?.renewalDate || "Next Period"}</strong>.
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: 12 }}>
              {checkoutStep !== "success" ? (
                <>
                  <button
                    type="button"
                    className="portal-btn-primary"
                    style={{
                      flex: 1,
                      padding: "14px",
                      fontSize: "0.92rem",
                      fontWeight: 900,
                      background: "linear-gradient(135deg, #10b981, #059669)",
                      borderColor: "#34d399",
                      boxShadow: "0 4px 18px rgba(16, 185, 129, 0.4)",
                    }}
                    disabled={isProcessingPayment}
                    onClick={() => handleFinalizePayment(cashfreeOrderSession?.orderId, true)}
                  >
                    {isProcessingPayment
                      ? "Verifying Payment with Cashfree..."
                      : `Complete Cashfree Payment (${selectedPlanForCheckout.price})`}
                  </button>
                  <button
                    type="button"
                    className="portal-pill-tab"
                    style={{ padding: "14px 18px", color: "#94a3b8" }}
                    onClick={() => setShowCheckoutModal(false)}
                    disabled={isProcessingPayment}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="portal-btn-primary"
                  style={{
                    width: "100%",
                    padding: "14px",
                    fontSize: "0.95rem",
                    fontWeight: 900,
                    background: "linear-gradient(135deg, #00f0ff, #0070f3)",
                  }}
                  onClick={() => {
                    setShowCheckoutModal(false);
                    navigateTo("/attendance-login");
                  }}
                >
                  Proceed to Campus Turnstile Face Scanner →
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Member Change Plan / Upgrade Modal */}
      <MemberChangePlanModal
        isOpen={showChangePlanModal}
        onClose={() => setShowChangePlanModal(false)}
        memberId={memberId}
        currentMembership={membershipStatus}
        onSuccess={(req) => {
          showToast(`Plan Change Request (${req.request_number}) Submitted! Admin review queued.`);
          loadStatus();
        }}
      />
    </div>
  );
}

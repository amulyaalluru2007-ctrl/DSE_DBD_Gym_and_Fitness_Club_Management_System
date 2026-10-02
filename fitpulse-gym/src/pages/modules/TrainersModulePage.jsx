import { useState, useEffect, useRef } from "react";
import CustomerSidebar3D from "../../components/dashboard/CustomerSidebar3D";
import {
  bookSessionLive,
  fetchChatMessages,
  sendChatMessageLive,
  fetchAssignedCoach,
  selectTrainerLive,
  leaveTrainerLive,
  subscribeRealtime,
  createCashfreeOrderLive,
  verifyCashfreeOrderLive,
  fetchUserMembershipStatusLive,
  fetchMemberTrainerProfileLive,
  withdrawMemberRequestLive,
  createAdjustmentPaymentOrderLive,
  verifyAdjustmentPaymentLive,
} from "../../services/realtime";
import MemberChangeTrainerModal from "../../components/modules/MemberChangeTrainerModal";
import MemberRequestHistoryModal from "../../components/modules/MemberRequestHistoryModal";
import NotificationBell from "../../components/notifications/NotificationBell";
import "../../styles/module-pages.css";

const coachesList = [
  {
    id: "alex",
    dbId: 4,
    name: "Alex Carter",
    specialty: "Head Strength & Hypertrophy",
    rating: "4.9 ★ (128 reviews)",
    exp: "9 Years Experience",
    bio: "Specializes in progressive overload mechanics, bodybuilding prep, and biomechanic injury prevention.",
    avatar: "https://images.unsplash.com/photo-1567013127542-490d757e51fc?w=300&auto=format&fit=crop&q=80",
    status: "Available for 1-on-1",
    price: "₹2,999",
    rawPrice: 2999,
    period: "/ month",
  },
  {
    id: "sarah",
    dbId: 5,
    name: "Sarah Jenkins",
    specialty: "Kinematics & Conditioning",
    rating: "5.0 ★ (94 reviews)",
    exp: "7 Years Experience",
    bio: "Former Olympic sprinter coach focused on high velocity power outputs, VO2 max capacity, and kettlebell flow.",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&auto=format&fit=crop&q=80",
    status: "Available for 1-on-1",
    price: "₹2,799",
    rawPrice: 2799,
    period: "/ month",
  },
  {
    id: "marcus",
    dbId: 6,
    name: "Sai Sathwik",
    specialty: "Powerlifting & Olympic Lifts",
    rating: "4.9 ★ (110 reviews)",
    exp: "11 Years Experience",
    bio: "Elite powerlifting coach with 8 national championship podiums. Precision bar path diagnostics and hip hinge cues.",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80",
    status: "Available for 1-on-1",
    price: "₹3,499",
    rawPrice: 3499,
    period: "/ month",
  },
];

export default function TrainersModulePage() {
  const [assignedCoach, setAssignedCoach] = useState(null);
  const [selectedCoach, setSelectedCoach] = useState(coachesList[0]);
  const [messages, setMessages] = useState([]);
  const [inputMsg, setInputMsg] = useState("");
  const [toastMessage, setToastMessage] = useState(null);
  const [toastType, setToastType] = useState("success");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals for single trainer leave / switch rule
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [targetSwitchCoach, setTargetSwitchCoach] = useState(null);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Change Request & Prorated Billing System State
  const [activeRequest, setActiveRequest] = useState(null);
  const [showChangeTrainerModal, setShowChangeTrainerModal] = useState(false);
  const [showRequestHistoryModal, setShowRequestHistoryModal] = useState(false);
  const [isPayingActiveAdjustment, setIsPayingActiveAdjustment] = useState(false);

  // Hire & Payment Modal State
  const [showHirePaymentModal, setShowHirePaymentModal] = useState(false);
  const [targetHireCoach, setTargetHireCoach] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("upi"); // "upi" | "card" | "netbanking"
  const [upiId, setUpiId] = useState("athlete@okaxis");
  const [cardNumber, setCardNumber] = useState("4532 •••• •••• 8849");
  const [cardExpiry, setCardExpiry] = useState("09/29");
  const [cardCvv, setCardCvv] = useState("842");
  const [bankName, setBankName] = useState("HDFC Bank");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Gym Membership Status Check (Rule: Must have active gym membership before hiring coach)
  const [gymMembershipStatus, setGymMembershipStatus] = useState({
    isActive: true,
    planName: "Active Gym Membership",
  });

  // Current logged in member
  const [currentMemberId, setCurrentMemberId] = useState(1);
  const [currentMemberName, setCurrentMemberName] = useState("Nihal Carter");

  const messagesEndRef = useRef(null);

  const showToast = (msg, type = "success") => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 5000);
  };

  const scrollToChatBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // 1. Initialize user and load assigned coach & gym membership from MySQL
  useEffect(() => {
    let memberId = 1;
    let memberName = "Nihal Carter";
    try {
      const stored = localStorage.getItem("fitpulse_user");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.id) {
          memberId = parsed.id;
          setCurrentMemberId(parsed.id);
        }
        if (parsed.full_name || parsed.name) {
          memberName = parsed.full_name || parsed.name;
          setCurrentMemberName(memberName);
        }
      }
    } catch {
      /* ignore */
    }

    // Verify active gym membership status
    fetchUserMembershipStatusLive(memberId).then((res) => {
      if (res && res.success && res.gymMembership) {
        setGymMembershipStatus(res.gymMembership);
      }
    });

    // Load active coach assignment and active change requests
    loadMemberProfileAndRequests(memberId);

    // Real-time listener for trainer assignments
    const unsubAssign = subscribeRealtime("trainee:assigned", (data) => {
      if (Number(data.memberId) === Number(memberId)) {
        loadMemberProfileAndRequests(memberId);
        showToast(`Master Coach assigned!`);
      }
    });

    // Real-time listener for trainer release
    const unsubRelease = subscribeRealtime("trainee:released", (data) => {
      if (Number(data.memberId) === Number(memberId)) {
        setAssignedCoach(null);
        setMessages([]);
        showToast("You have released your coach. You may now select a new master trainer.", "info");
      }
    });

    // Real-time listener for trainer change requests
    const unsubReq = subscribeRealtime("request:updated", () => {
      loadMemberProfileAndRequests(memberId);
    });

    const unsubReqCreated = subscribeRealtime("request:created", () => {
      loadMemberProfileAndRequests(memberId);
    });

    return () => {
      if (unsubAssign) unsubAssign();
      if (unsubRelease) unsubRelease();
      if (unsubReq) unsubReq();
      if (unsubReqCreated) unsubReqCreated();
    };
  }, []);

  const loadMemberProfileAndRequests = async (mId = currentMemberId) => {
    try {
      const res = await fetchMemberTrainerProfileLive(mId);
      if (res && res.success) {
        if (res.assignedTrainer) {
          const matched = coachesList.find(
            (c) => c.dbId === res.assignedTrainer.id
          ) || {
            id: `coach-${res.assignedTrainer.id}`,
            dbId: res.assignedTrainer.id,
            name: res.assignedTrainer.full_name,
            specialty: res.assignedTrainer.specialty || "Certified Master Coach",
            rating: "4.9 ★",
            exp: `${res.assignedTrainer.experience_years || 8} Years`,
            bio: "Dedicated master trainer tailoring progressive overload protocols.",
            avatar: res.assignedTrainer.avatar_url || "https://images.unsplash.com/photo-1567013127542-490d757e51fc?w=300&auto=format&fit=crop&q=80",
            status: "Available for 1-on-1",
            price: `₹${res.assignedTrainer.monthly_fee || 2999}`,
            rawPrice: res.assignedTrainer.monthly_fee || 2999,
            period: "/ month",
          };
          setAssignedCoach(matched);
          setSelectedCoach(matched);
        } else {
          setAssignedCoach(null);
        }
        setActiveRequest(res.activeRequest || null);
      }
    } catch (e) {
      console.warn("Error loading member trainer profile:", e);
    }
  };

  const handleWithdrawActiveRequest = async (requestId) => {
    if (!window.confirm("Are you sure you want to withdraw this change request?")) return;
    try {
      const res = await withdrawMemberRequestLive(requestId, currentMemberId);
      if (res && res.success) {
        showToast("Coach change request withdrawn.", "info");
        loadMemberProfileAndRequests(currentMemberId);
      } else {
        showToast(res?.message || "Failed to withdraw request.", "error");
      }
    } catch {
      showToast("Error withdrawing request.", "error");
    }
  };

  const handlePayActiveAdjustment = async (reqItem) => {
    setIsPayingActiveAdjustment(true);
    try {
      const orderRes = await createAdjustmentPaymentOrderLive(reqItem.id, currentMemberId);
      if (!orderRes || !orderRes.success) {
        showToast(orderRes?.message || "Error creating Cashfree payment order.", "error");
        setIsPayingActiveAdjustment(false);
        return;
      }
      const verifyRes = await verifyAdjustmentPaymentLive(orderRes.orderId, true);
      if (verifyRes && verifyRes.success) {
        showToast(`Payment verified! Coach ${verifyRes.newTrainerName} is now your active trainer!`, "success");
        loadMemberProfileAndRequests(currentMemberId);
      } else {
        showToast(verifyRes?.message || "Payment verification failed.", "error");
      }
    } catch {
      showToast("Payment network error connecting to Cashfree.", "error");
    } finally {
      setIsPayingActiveAdjustment(false);
    }
  };

  // 2. Fetch live chat history when assignedCoach changes
  useEffect(() => {
    if (!assignedCoach || !assignedCoach.dbId) {
      setMessages([]);
      return;
    }

    fetchChatMessages(currentMemberId, assignedCoach.dbId, "member_trainer").then((res) => {
      if (res && res.success && res.messages) {
        const mapped = res.messages.map((m) => {
          const tDate = m.created_at || m.createdAt;
          const timeStr =
            tDate && !isNaN(new Date(tDate).getTime())
              ? new Date(tDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : "Just now";
          return {
            id: m.id,
            sender: Number(m.sender_id || m.senderId) === Number(currentMemberId) ? "member" : "coach",
            text: m.message,
            time: timeStr,
          };
        });
        setMessages(mapped);
        setTimeout(scrollToChatBottom, 100);
      }
    });

    // 3. Strict Chat Isolation Socket Listener
    const unsubChat = subscribeRealtime("chat:message", (data) => {
      if (data.channel_type === "member_trainer" || data.channelType === "member_trainer") {
        const sId = Number(data.sender_id || data.senderId);
        const rId = Number(data.receiver_id || data.receiverId);
        const targetCoachId = Number(assignedCoach.dbId);

        // STRICT ISOLATION: Message MUST be between this member and their assigned coach!
        const isThisConvo =
          (sId === currentMemberId && rId === targetCoachId) ||
          (sId === targetCoachId && rId === currentMemberId);

        if (isThisConvo) {
          const tDate = data.created_at || data.createdAt;
          const timeStr =
            tDate && !isNaN(new Date(tDate).getTime())
              ? new Date(tDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : "Just now";

          const newBubble = {
            id: data.id || Date.now(),
            sender: sId === currentMemberId ? "member" : "coach",
            text: data.message,
            time: timeStr,
          };

          setMessages((prev) => {
            if (prev.some((m) => m.id === newBubble.id)) return prev;
            // Deduplicate optimistic messages
            const optIdx = prev.findIndex(
              (m) => m.isOptimistic && m.text === newBubble.text && m.sender === newBubble.sender
            );
            if (optIdx !== -1) {
              const updated = [...prev];
              updated[optIdx] = { ...newBubble, isOptimistic: false };
              return updated;
            }
            return [...prev, newBubble];
          });
          setTimeout(scrollToChatBottom, 100);
        }
      }
    });

    return () => {
      if (unsubChat) unsubChat();
    };
  }, [assignedCoach, currentMemberId]);

  const navigateTo = (path) => {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  // Single Trainer Workflow: Select / Switch / Leave
  const handleCoachCardAction = (coach) => {
    // STRICT RULE: User must have an active paid Gym membership before hiring a coach
    if (!gymMembershipStatus.isActive) {
      showToast(
        "⚠️ Rule Requirement: You must have an active paid Gym Membership before hiring a coach. Redirecting to Gym Plans...",
        "error"
      );
      setTimeout(() => navigateTo("/dashboard/plans"), 1800);
      return;
    }

    if (!assignedCoach) {
      // No coach currently assigned: Open Hire & Payment Modal!
      setTargetHireCoach(coach);
      setShowHirePaymentModal(true);
    } else if (assignedCoach.dbId === coach.dbId) {
      // Clicking their own active coach -> prompt to leave
      setShowLeaveModal(true);
    } else {
      // Clicking another coach while one is already assigned -> prompt to switch via automated change request
      setTargetSwitchCoach(coach);
      setShowChangeTrainerModal(true);
    }
  };

  const handleConfirmHirePayment = async () => {
    if (!targetHireCoach) return;
    setIsProcessingPayment(true);
    try {
      // Step 1: Create Cashfree Order for Trainer Retainer Fee
      const cfOrder = await createCashfreeOrderLive({
        userId: currentMemberId,
        paymentType: "trainer_fee",
        trainerId: targetHireCoach.dbId,
        planDuration: "1_month",
        customerPhone: "9999999999",
      });

      if (cfOrder && cfOrder.success && cfOrder.orderId) {
        // Step 2: Finalize & verify payment via Cashfree PG
        const verifyRes = await verifyCashfreeOrderLive(cfOrder.orderId, true);

        if (verifyRes && verifyRes.success) {
          setAssignedCoach(targetHireCoach);
          setSelectedCoach(targetHireCoach);
          setShowHirePaymentModal(false);
          showToast(
            `✓ Cashfree Payment Verified! Coach ${targetHireCoach.name} is now your dedicated master trainer.`
          );
          setTimeout(() => {
            const chatEl = document.getElementById("direct-chat-section");
            if (chatEl) chatEl.scrollIntoView({ behavior: "smooth" });
          }, 300);
        } else {
          showToast(verifyRes?.message || "Cashfree payment verification failed.", "error");
        }
      } else {
        showToast(cfOrder?.message || "Error creating Cashfree payment order.", "error");
      }
    } catch {
      showToast("Payment network error connecting to Cashfree.", "error");
    } finally {
      setIsProcessingPayment(false);
      setTargetHireCoach(null);
    }
  };

  const executeAssignCoach = async (coach) => {
    setActionLoading(true);
    try {
      const res = await selectTrainerLive(currentMemberId, coach.dbId, {
        amount: coach.price,
        paymentMethod: "Account Transfer",
      });
      if (res && res.success) {
        setAssignedCoach(coach);
        setSelectedCoach(coach);
        showToast(`Coach ${coach.name} is now your assigned master coach!`);
      } else {
        showToast(res?.message || "Error assigning coach.", "error");
      }
    } catch {
      showToast("Error connecting to server.", "error");
    } finally {
      setActionLoading(false);
      setShowSwitchModal(false);
      setTargetSwitchCoach(null);
    }
  };

  const executeLeaveCoach = async () => {
    setActionLoading(true);
    try {
      const res = await leaveTrainerLive(currentMemberId);
      if (res && res.success) {
        showToast(`Coach ${assignedCoach?.name} released. You may now select any coach.`, "info");
        setAssignedCoach(null);
        setMessages([]);
      } else {
        showToast(res?.message || "Error releasing coach.", "error");
      }
    } catch {
      showToast("Error connecting to server.", "error");
    } finally {
      setActionLoading(false);
      setShowLeaveModal(false);
    }
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!inputMsg.trim()) return;

    if (!assignedCoach) {
      showToast("Please choose a master coach first to send private messages.", "error");
      return;
    }

    const userText = inputMsg.trim();
    setInputMsg("");

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const localBubble = {
      id: Date.now(),
      sender: "member",
      text: userText,
      time: timeStr,
      isOptimistic: true,
    };

    // Optimistically update chat state immediately
    setMessages((prev) => [...prev, localBubble]);
    setTimeout(scrollToChatBottom, 100);

    try {
      const payload = {
        sender_id: currentMemberId,
        sender_name: currentMemberName,
        sender_role: "Member",
        receiver_id: assignedCoach.dbId,
        receiver_name: assignedCoach.name,
        channel_type: "member_trainer",
        message: userText,
      };

      const res = await sendChatMessageLive(payload);
      if (res && res.success && res.message) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === localBubble.id ? { ...m, id: res.message.id, isOptimistic: false } : m
          )
        );
      }
    } catch (err) {
      console.warn("Send chat error:", err);
    }
  };

  const handleBookSession = async (coach) => {
    showToast(`Session booked with ${coach.name} for tomorrow at 10:00 AM! Check your notifications.`);
    try {
      await bookSessionLive(currentMemberId, currentMemberName);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="module-page-container">
      {/* Photorealistic Dedicated Background */}
      <img
        src="/assets/modules/bg-trainers.jpg"
        alt="FitPulse Certified Coaches"
        className="module-page-bg"
      />
      <div className="module-page-vignette" />

      {/* 3D Sidebar Dock */}
      <CustomerSidebar3D currentModule="trainers" />

      {/* Main Page Area */}
      <main className="module-page-main">
        {/* Topbar */}
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
            <span className="module-breadcrumb-current">Master Coaches</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div className="portal-search-bar">
              <span style={{ color: "#64748b" }}>🔍</span>
              <input
                type="text"
                className="portal-search-input"
                placeholder="Search coaches, specialties..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="portal-date-pill">
              <span>📅</span>
              <span>23 Sep 2026</span>
            </div>
            <NotificationBell userId={currentMemberId} onNavigateAction={() => setShowRequestHistoryModal(true)} />
          </div>
        </div>

        {/* Screen Title & Active Coach Indicator */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "22px",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div>
            <h1 className="portal-screen-title">Master Coaches & Biomechanics</h1>
            <p className="portal-screen-subtitle">
              Private 1-on-1 guidance, live form video reviews, and customized hypertrophy programming.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            {assignedCoach ? (
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <div
                  className="module-status-pill"
                  style={{
                    background: "rgba(0, 112, 243, 0.15)",
                    color: "#00e5ff",
                    borderColor: "rgba(0, 229, 255, 0.4)",
                    padding: "8px 14px",
                    fontWeight: 800,
                  }}
                >
                  <span
                    className="module-status-dot"
                    style={{ background: "#00e5ff", boxShadow: "0 0 10px #00e5ff" }}
                  />
                  <span>ASSIGNED COACH: {assignedCoach.name.toUpperCase()}</span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setTargetSwitchCoach(null);
                    setShowChangeTrainerModal(true);
                  }}
                  style={{
                    background: "linear-gradient(135deg, rgba(6, 182, 212, 0.25), rgba(2, 132, 199, 0.35))",
                    border: "1px solid rgba(6, 182, 212, 0.5)",
                    color: "#38bdf8",
                    borderRadius: 10,
                    padding: "8px 16px",
                    fontSize: "0.8rem",
                    fontWeight: 800,
                    cursor: "pointer",
                    boxShadow: "0 0 15px rgba(6, 182, 212, 0.25)",
                    transition: "all 0.2s ease",
                  }}
                  title="Request coach reassignment with automated prorated billing"
                >
                  🔄 Request Coach Transfer
                </button>

                <button
                  type="button"
                  onClick={() => setShowRequestHistoryModal(true)}
                  style={{
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "#cbd5e1",
                    borderRadius: 10,
                    padding: "8px 14px",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  📜 Request History
                </button>

                <button
                  type="button"
                  onClick={() => setShowLeaveModal(true)}
                  style={{
                    background: "rgba(239, 68, 68, 0.12)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    color: "#fca5a5",
                    borderRadius: 10,
                    padding: "8px 14px",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                  title="Leave current coach without replacement"
                >
                  Leave Coach
                </button>
              </div>
            ) : (
              <div
                className="module-status-pill"
                style={{
                  background: "rgba(245, 158, 11, 0.15)",
                  color: "#fbbf24",
                  borderColor: "rgba(245, 158, 11, 0.4)",
                  padding: "8px 14px",
                  fontWeight: 800,
                }}
              >
                <span
                  className="module-status-dot"
                  style={{ background: "#fbbf24", boxShadow: "0 0 10px #fbbf24" }}
                />
                <span>NO COACH ASSIGNED (Choose Below)</span>
              </div>
            )}
          </div>
        </div>

        {/* ACTIVE CHANGE REQUEST BANNER */}
        {activeRequest && ["Submitted", "Under Review", "Awaiting Payment"].includes(activeRequest.status) && (
          <div
            style={{
              background: "linear-gradient(135deg, rgba(12, 20, 36, 0.95), rgba(7, 11, 19, 0.95))",
              border:
                activeRequest.status === "Awaiting Payment"
                  ? "1px solid rgba(245, 158, 11, 0.45)"
                  : "1px solid rgba(6, 182, 212, 0.35)",
              borderRadius: 16,
              padding: "16px 20px",
              marginBottom: 24,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 16,
              boxShadow: "0 10px 30px rgba(0,0,0,0.6), 0 0 25px rgba(6, 182, 212, 0.15)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background:
                    activeRequest.status === "Awaiting Payment"
                      ? "rgba(245, 158, 11, 0.2)"
                      : "rgba(6, 182, 212, 0.2)",
                  border:
                    activeRequest.status === "Awaiting Payment"
                      ? "1px solid rgba(245, 158, 11, 0.4)"
                      : "1px solid rgba(6, 182, 212, 0.4)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.3rem",
                }}
              >
                {activeRequest.status === "Awaiting Payment" ? "💳" : "⏳"}
              </div>

              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 800,
                      color: "#94a3b8",
                      textTransform: "uppercase",
                    }}
                  >
                    Active Request #{activeRequest.request_number}
                  </span>
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: 9999,
                      fontSize: "0.7rem",
                      fontWeight: 800,
                      background:
                        activeRequest.status === "Awaiting Payment"
                          ? "rgba(245, 158, 11, 0.2)"
                          : "rgba(6, 182, 212, 0.2)",
                      color:
                        activeRequest.status === "Awaiting Payment" ? "#f59e0b" : "#38bdf8",
                      border:
                        activeRequest.status === "Awaiting Payment"
                          ? "1px solid rgba(245, 158, 11, 0.3)"
                          : "1px solid rgba(6, 182, 212, 0.3)",
                    }}
                  >
                    {activeRequest.status === "Awaiting Payment"
                      ? "Approval Granted • Payment Required"
                      : "Under Administrative Review"}
                  </span>
                </div>

                <p style={{ margin: 0, fontSize: "0.92rem", color: "#f8fafc", fontWeight: 600 }}>
                  Transfer to{" "}
                  <strong style={{ color: "#38bdf8" }}>
                    Coach {activeRequest.preferred_trainer_name || "New Coach"}
                  </strong>
                  {activeRequest.final_adjustment_minor > 0 ? (
                    <span style={{ color: "#fbbf24", marginLeft: 8 }}>
                      (Prorated Difference: ₹{activeRequest.final_adjustment_minor / 100})
                    </span>
                  ) : activeRequest.final_adjustment_minor < 0 ? (
                    <span style={{ color: "#34d399", marginLeft: 8 }}>
                      (Eligible Credit: ₹{Math.abs(activeRequest.final_adjustment_minor / 100)})
                    </span>
                  ) : (
                    <span style={{ color: "#94a3b8", marginLeft: 8 }}>(Equal Rate Swap)</span>
                  )}
                </p>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              {activeRequest.status === "Awaiting Payment" && (
                <button
                  type="button"
                  onClick={() => handlePayActiveAdjustment(activeRequest)}
                  disabled={isPayingActiveAdjustment}
                  style={{
                    background: "linear-gradient(135deg, #f59e0b, #d97706)",
                    color: "#020617",
                    fontWeight: 800,
                    fontSize: "0.82rem",
                    padding: "9px 18px",
                    borderRadius: 10,
                    border: "none",
                    cursor: "pointer",
                    boxShadow: "0 4px 15px rgba(245, 158, 11, 0.4)",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {isPayingActiveAdjustment
                    ? "Verifying..."
                    : `Pay ₹${activeRequest.final_adjustment_minor / 100} & Finalize Transfer`}
                </button>
              )}

              <button
                type="button"
                onClick={() => handleWithdrawActiveRequest(activeRequest.id)}
                style={{
                  background: "rgba(255,255,255,0.06)",
                  color: "#94a3b8",
                  fontWeight: 700,
                  fontSize: "0.78rem",
                  padding: "8px 14px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.12)",
                  cursor: "pointer",
                }}
              >
                Withdraw Request
              </button>

              <button
                type="button"
                onClick={() => setShowRequestHistoryModal(true)}
                style={{
                  background: "transparent",
                  color: "#38bdf8",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  padding: "8px 12px",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                View Details →
              </button>
            </div>
          </div>
        )}

        {/* Rule Banner: Gym Membership Status */}
        {!gymMembershipStatus.isActive ? (
          <div
            style={{
              padding: "16px 20px",
              borderRadius: "14px",
              background: "rgba(239, 68, 68, 0.12)",
              border: "1.5px solid #ef4444",
              marginBottom: "20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 14,
              boxShadow: "0 0 25px rgba(239, 68, 68, 0.15)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ fontSize: "1.8rem" }}>🚫</span>
              <div>
                <div style={{ fontWeight: 900, color: "#f87171", fontSize: "0.95rem" }}>
                  CAMPUS RULE: ACTIVE GYM MEMBERSHIP REQUIRED
                </div>
                <div style={{ fontSize: "0.8rem", color: "#fca5a5", marginTop: 2 }}>
                  Before hiring or paying for a Personal Trainer, members must hold an active 1M, 3M, 6M, or 1Y FitPulse Gym Membership.
                </div>
              </div>
            </div>
            <button
              type="button"
              className="portal-btn-primary"
              onClick={() => navigateTo("/dashboard/plans")}
              style={{
                padding: "10px 18px",
                fontSize: "0.85rem",
                background: "linear-gradient(135deg, #ef4444, #dc2626)",
                boxShadow: "0 4px 14px rgba(239, 68, 68, 0.35)",
              }}
            >
              Activate Gym Membership First →
            </button>
          </div>
        ) : (
          <div
            style={{
              padding: "12px 18px",
              borderRadius: "12px",
              background: "rgba(16, 185, 129, 0.08)",
              border: "1px solid rgba(16, 185, 129, 0.25)",
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span style={{ color: "#34d399", fontSize: "1.2rem" }}>✓</span>
            <span style={{ fontSize: "0.82rem", color: "#e2e8f0" }}>
              <strong>Gym Membership Active:</strong> {gymMembershipStatus.planName} • Eligible to hire or switch Personal Trainers via Cashfree PG.
            </span>
          </div>
        )}

        {/* Dynamic Toast Feedback */}
        {toastMessage && (
          <div
            style={{
              padding: "14px 20px",
              background:
                toastType === "error"
                  ? "rgba(239, 68, 68, 0.2)"
                  : toastType === "info"
                  ? "rgba(59, 130, 246, 0.2)"
                  : "rgba(16, 185, 129, 0.2)",
              border: `1px solid ${
                toastType === "error" ? "#ef4444" : toastType === "info" ? "#3b82f6" : "#10b981"
              }`,
              borderRadius: 14,
              color: toastType === "error" ? "#fca5a5" : toastType === "info" ? "#93c5fd" : "#34d399",
              marginBottom: 22,
              fontWeight: 700,
              fontSize: "0.9rem",
              boxShadow: "0 0 20px rgba(0,0,0,0.3)",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span>{toastType === "error" ? "⚠️" : toastType === "info" ? "ℹ️" : "✓"}</span>
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Single Trainer Policy Explainer Banner */}
        <div
          style={{
            background: "linear-gradient(90deg, rgba(0, 112, 243, 0.08) 0%, rgba(6, 9, 19, 0.5) 100%)",
            border: "1px solid rgba(0, 112, 243, 0.25)",
            borderRadius: 14,
            padding: "12px 18px",
            marginBottom: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: "1.3rem" }}>🛡️</span>
            <div>
              <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "#ffffff" }}>
                Single Master Coach Protocol
              </div>
              <div style={{ fontSize: "0.75rem", color: "#8da4be" }}>
                To maintain biomechanic consistency, members are paired 1-on-1 with a single master trainer.
                {assignedCoach
                  ? ` You are currently mentored by Coach ${assignedCoach.name}. To select a different coach, switch or leave your current coach.`
                  : " Please choose your dedicated master coach from the certified roster below."}
              </div>
            </div>
          </div>
          {assignedCoach && (
            <span style={{ fontSize: "0.74rem", color: "#00e5ff", fontWeight: 700 }}>
              Active Pairing: 1 Member ↔ 1 Coach
            </span>
          )}
        </div>

        {/* Screen 6 Main Grid: Browse Coaches (Left) & Featured Coach Hero Card (Right) */}
        <div style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: "22px", marginBottom: "24px" }}>
          {/* Left: Browse Coaches */}
          <div className="portal-card">
            <div className="portal-card-header">
              <div>
                <h3 className="portal-card-title">Browse Coaches</h3>
                <div style={{ fontSize: "0.75rem", color: "#8da4be", marginTop: "2px" }}>
                  Certified master trainers & biomechanic specialists
                </div>
              </div>
              <span className="portal-weight-badge">3 Certified Staff</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {coachesList
                .filter(
                  (c) =>
                    !searchQuery ||
                    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    c.specialty.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((coach) => {
                  const isAssigned = assignedCoach && assignedCoach.dbId === coach.dbId;
                  const isInspected = selectedCoach.id === coach.id;

                  return (
                    <div
                      key={coach.id}
                      className="portal-coach-row"
                      style={{
                        borderColor: isAssigned
                          ? "#00e5ff"
                          : isInspected
                          ? "#0070f3"
                          : "rgba(255,255,255,0.06)",
                        background: isAssigned
                          ? "rgba(0, 229, 255, 0.08)"
                          : isInspected
                          ? "rgba(0, 112, 243, 0.06)"
                          : "rgba(255,255,255,0.02)",
                        cursor: "pointer",
                        padding: "14px 16px",
                      }}
                      onClick={() => setSelectedCoach(coach)}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                        <img
                          src={coach.avatar}
                          alt={coach.name}
                          style={{
                            width: 52,
                            height: 52,
                            borderRadius: 14,
                            objectFit: "cover",
                            border: isAssigned
                              ? "2px solid #00e5ff"
                              : isInspected
                              ? "2px solid #00b4ff"
                              : "1px solid rgba(255,255,255,0.15)",
                          }}
                        />
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: "0.95rem", fontWeight: 800, color: "#ffffff" }}>
                              {coach.name}
                            </span>
                            {isAssigned && (
                              <span
                                style={{
                                  background: "rgba(0, 229, 255, 0.2)",
                                  color: "#00e5ff",
                                  border: "1px solid rgba(0, 229, 255, 0.4)",
                                  borderRadius: 6,
                                  fontSize: "0.62rem",
                                  fontWeight: 800,
                                  padding: "2px 6px",
                                }}
                              >
                                ACTIVE COACH ✓
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: "0.74rem", color: "#00b4ff", fontWeight: 600 }}>
                            {coach.specialty}
                          </div>
                          <div style={{ fontSize: "0.7rem", color: "#8da4be", marginTop: "2px", display: "flex", alignItems: "center", gap: 6 }}>
                            <span>{coach.rating}</span>
                            <span>•</span>
                            <span>{coach.exp}</span>
                            <span>•</span>
                            <span style={{ color: "#34d399", fontWeight: 800 }}>{coach.price}/mo</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {isAssigned ? (
                          <button
                            type="button"
                            className="portal-btn-primary"
                            style={{
                              padding: "7px 12px",
                              fontSize: "0.74rem",
                              background: "rgba(239, 68, 68, 0.2)",
                              border: "1px solid rgba(239, 68, 68, 0.4)",
                              color: "#fca5a5",
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowLeaveModal(true);
                            }}
                          >
                            Leave Trainer
                          </button>
                        ) : assignedCoach ? (
                          <button
                            type="button"
                            className="portal-btn-primary"
                            style={{
                              padding: "7px 12px",
                              fontSize: "0.74rem",
                              background: "linear-gradient(135deg, #0070f3 0%, #00b4ff 100%)",
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCoachCardAction(coach);
                            }}
                          >
                            Switch Coach
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="portal-btn-primary"
                            style={{
                              padding: "7px 14px",
                              fontSize: "0.74rem",
                              background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCoachCardAction(coach);
                            }}
                          >
                            Hire Coach ({coach.price}/mo)
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Right: Featured Coach Hero Card matching Screen 6 */}
          <div
            className="portal-card"
            style={{
              position: "relative",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              minHeight: 340,
              backgroundImage: `linear-gradient(180deg, rgba(6, 9, 19, 0.2) 0%, rgba(6, 9, 19, 0.85) 60%, rgba(6, 9, 19, 0.98) 100%), url(${selectedCoach.avatar})`,
              backgroundSize: "cover",
              backgroundPosition: "center top",
              overflow: "hidden",
            }}
          >
            {/* Top Badge */}
            <div style={{ position: "absolute", top: 18, left: 18, display: "flex", gap: 8 }}>
              <span
                className="module-status-pill"
                style={{
                  background: "rgba(0,0,0,0.6)",
                  backdropFilter: "blur(8px)",
                  color: "#00e5ff",
                  borderColor: "rgba(0, 229, 255, 0.4)",
                }}
              >
                {assignedCoach && assignedCoach.dbId === selectedCoach.dbId
                  ? "YOUR ASSIGNED MASTER COACH"
                  : "COACH SPOTLIGHT"}
              </span>
              <span
                className="module-status-pill"
                style={{
                  background: "rgba(0,0,0,0.6)",
                  backdropFilter: "blur(8px)",
                  color: "#10b981",
                  borderColor: "rgba(16, 185, 129, 0.4)",
                }}
              >
                {selectedCoach.status}
              </span>
            </div>

            {/* Bottom Quote & Bio */}
            <div style={{ position: "relative", zIndex: 2 }}>
              <div
                style={{
                  fontSize: "1.25rem",
                  fontStyle: "italic",
                  fontWeight: 900,
                  color: "#ffffff",
                  lineHeight: 1.3,
                  marginBottom: "8px",
                  textShadow: "0 2px 10px rgba(0,0,0,0.8)",
                }}
              >
                "Better form. Stronger tomorrow."
              </div>
              <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "#00e5ff", marginBottom: "8px" }}>
                — {selectedCoach.name} • {selectedCoach.specialty}
              </div>
              <p
                style={{
                  fontSize: "0.78rem",
                  color: "#cbd5e1",
                  lineHeight: 1.45,
                  marginBottom: "16px",
                  textShadow: "0 1px 4px rgba(0,0,0,0.7)",
                }}
              >
                {selectedCoach.bio}
              </p>

              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  className="portal-btn-primary"
                  style={{ flex: 1, padding: "10px 16px", fontSize: "0.82rem" }}
                  onClick={() => handleBookSession(selectedCoach)}
                >
                  📅 Book 1-on-1 Session
                </button>
                {assignedCoach && assignedCoach.dbId === selectedCoach.dbId ? (
                  <button
                    type="button"
                    className="portal-pill-tab"
                    style={{
                      background: "rgba(0, 229, 255, 0.15)",
                      color: "#00e5ff",
                      borderColor: "rgba(0, 229, 255, 0.4)",
                    }}
                    onClick={() => {
                      const el = document.getElementById("direct-chat-section");
                      if (el) el.scrollIntoView({ behavior: "smooth" });
                    }}
                  >
                    Message Coach 💬
                  </button>
                ) : (
                  <button
                    type="button"
                    className="portal-pill-tab"
                    style={{
                      background: "rgba(255,255,255,0.12)",
                      color: "#ffffff",
                      borderColor: "rgba(255,255,255,0.2)",
                    }}
                    onClick={() => handleCoachCardAction(selectedCoach)}
                  >
                    {assignedCoach ? "Switch to This Coach" : `Hire ${selectedCoach.name} (${selectedCoach.price}/mo)`}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Extended Content: Live Coach Direct Messenger */}
        <div id="direct-chat-section" className="portal-card">
          {assignedCoach ? (
            <>
              <div className="portal-card-header">
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <img
                    src={assignedCoach.avatar}
                    alt={assignedCoach.name}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      objectFit: "cover",
                      border: "2px solid #00e5ff",
                    }}
                  />
                  <div>
                    <h3 className="portal-card-title">
                      Coach {assignedCoach.name} • Private Direct Messenger
                    </h3>
                    <div style={{ fontSize: "0.75rem", color: "#00e5ff" }}>
                      ● Dedicated 1-on-1 Coaching Channel • 24/7 Form Reviews & Nutrition Guidance
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="module-status-pill" style={{ fontSize: "0.68rem" }}>
                    256-BIT ENCRYPTED
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowLeaveModal(true)}
                    style={{
                      background: "transparent",
                      border: "1px solid rgba(255,255,255,0.15)",
                      color: "#94a3b8",
                      borderRadius: 8,
                      padding: "4px 10px",
                      fontSize: "0.72rem",
                      cursor: "pointer",
                    }}
                  >
                    Leave Coach
                  </button>
                </div>
              </div>

              <div
                className="trainer-chat-container"
                style={{ border: "none", background: "rgba(6, 9, 19, 0.6)", borderRadius: 14 }}
              >
                <div
                  className="trainer-chat-messages"
                  style={{ minHeight: 240, maxHeight: 380, overflowY: "auto", padding: "16px" }}
                >
                  {messages.length === 0 ? (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "40px 20px",
                        color: "#64748b",
                        fontSize: "0.85rem",
                      }}
                    >
                      <div style={{ fontSize: "2rem", marginBottom: 8 }}>💬</div>
                      <div style={{ fontWeight: 700, color: "#94a3b8" }}>
                        Direct Private Channel with Coach {assignedCoach.name}
                      </div>
                      <div style={{ fontSize: "0.75rem", marginTop: 4 }}>
                        Ask questions about today's split, technique adjustments, or nutrition targets.
                      </div>
                    </div>
                  ) : (
                    messages.map((m) => (
                      <div key={m.id} className={`trainer-bubble ${m.sender}`}>
                        <div>{m.text}</div>
                        <div
                          style={{
                            fontSize: "0.65rem",
                            opacity: 0.6,
                            marginTop: 4,
                            textAlign: m.sender === "member" ? "right" : "left",
                          }}
                        >
                          {m.time}
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <form onSubmit={handleSendMessage} className="trainer-chat-input-bar">
                  <input
                    type="text"
                    placeholder={`Message Coach ${assignedCoach.name}... (e.g. Can you review my barbell bench arch?)`}
                    value={inputMsg}
                    onChange={(e) => setInputMsg(e.target.value)}
                    className="trainer-chat-input"
                  />
                  <button
                    type="submit"
                    className="portal-btn-primary"
                    style={{ padding: "8px 22px", fontWeight: 800 }}
                  >
                    Send
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div
              style={{
                padding: "40px 24px",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: "50%",
                  background: "rgba(0, 112, 243, 0.1)",
                  border: "1px solid rgba(0, 112, 243, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.8rem",
                  marginBottom: 16,
                }}
              >
                🔒
              </div>
              <h3 style={{ margin: "0 0 8px 0", fontSize: "1.2rem", fontWeight: 800, color: "#fff" }}>
                1-on-1 Direct Chat is Locked
              </h3>
              <p
                style={{
                  margin: "0 0 20px 0",
                  color: "#8da4be",
                  fontSize: "0.85rem",
                  maxWidth: 500,
                  lineHeight: 1.5,
                }}
              >
                FitPulse members are assigned a single certified master coach for direct daily coaching. Hire
                a coach from the roster above (from ₹2,799/mo) to unlock encrypted private messaging, workout critique, and real-time form checks.
              </p>
              <button
                type="button"
                className="portal-btn-primary"
                onClick={() => {
                  window.scrollTo({ top: 180, behavior: "smooth" });
                }}
              >
                Hire Your Master Coach Above (From ₹2,799/mo) ↑
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Member Change Trainer & Prorated Billing Modal */}
      <MemberChangeTrainerModal
        isOpen={showChangeTrainerModal}
        onClose={() => {
          setShowChangeTrainerModal(false);
          setTargetSwitchCoach(null);
        }}
        memberId={currentMemberId}
        assignedCoach={assignedCoach}
        targetCoach={targetSwitchCoach}
        onSuccess={() => {
          showToast("Trainer Change Request Submitted! Admin review is in progress.", "success");
          loadMemberProfileAndRequests(currentMemberId);
        }}
      />

      {/* Member Request History Modal */}
      <MemberRequestHistoryModal
        isOpen={showRequestHistoryModal}
        onClose={() => setShowRequestHistoryModal(false)}
        memberId={currentMemberId}
        onPaymentSuccess={() => {
          loadMemberProfileAndRequests(currentMemberId);
        }}
      />

      {/* Confirmation Modal: Leave Trainer */}
      {showLeaveModal && assignedCoach && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(8px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            className="portal-card"
            style={{
              maxWidth: 460,
              width: "100%",
              background: "#0c121e",
              border: "1px solid rgba(239, 68, 68, 0.4)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <span style={{ fontSize: "1.8rem" }}>🚪</span>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 900, color: "#fff" }}>
                  Leave Coach {assignedCoach.name}?
                </h3>
                <div style={{ fontSize: "0.75rem", color: "#fca5a5" }}>
                  Release Active Assignment
                </div>
              </div>
            </div>

            <p style={{ fontSize: "0.85rem", color: "#94a3b8", lineHeight: 1.5, marginBottom: 20 }}>
              Are you sure you want to leave <strong style={{ color: "#fff" }}>Coach {assignedCoach.name}</strong>?
              Your 1-on-1 private messaging channel and custom split revisions with Coach {assignedCoach.name} will be released. You will be free to choose any master coach from the roster.
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <button
                type="button"
                className="portal-pill-tab"
                style={{ background: "rgba(255,255,255,0.08)", color: "#fff" }}
                onClick={() => setShowLeaveModal(false)}
                disabled={actionLoading}
              >
                Keep Coach
              </button>
              <button
                type="button"
                className="portal-btn-primary"
                style={{
                  background: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)",
                }}
                onClick={executeLeaveCoach}
                disabled={actionLoading}
              >
                {actionLoading ? "Releasing..." : `Confirm Leave Coach`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Secure Payment & Hiring Modal in INR (₹) */}
      {showHirePaymentModal && targetHireCoach && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.82)",
            backdropFilter: "blur(12px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={() => {
            if (!isProcessingPayment) {
              setShowHirePaymentModal(false);
              setTargetHireCoach(null);
            }
          }}
        >
          <div
            className="portal-card"
            style={{
              maxWidth: 500,
              width: "100%",
              background: "#0a0f1d",
              border: "1px solid rgba(0, 180, 255, 0.35)",
              boxShadow: "0 24px 80px rgba(0,0,0,0.9), 0 0 30px rgba(0, 180, 255, 0.15)",
              padding: "24px",
              borderRadius: 20,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: "linear-gradient(135deg, rgba(0,180,255,0.2) 0%, rgba(16,185,129,0.2) 100%)",
                    border: "1px solid rgba(0,229,255,0.4)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1.4rem",
                  }}
                >
                  💳
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 900, color: "#fff" }}>
                    Hire Coach {targetHireCoach.name}
                  </h3>
                  <div style={{ fontSize: "0.72rem", color: "#00e5ff", fontWeight: 700 }}>
                    Official 1-on-1 Biomechanics & Programming Retainer
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isProcessingPayment) {
                    setShowHirePaymentModal(false);
                    setTargetHireCoach(null);
                  }
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#64748b",
                  fontSize: "1.3rem",
                  cursor: "pointer",
                  padding: 4,
                }}
              >
                ✕
              </button>
            </div>

            {/* Coach Profile Card In Modal */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "12px 14px",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 14,
                marginBottom: 16,
              }}
            >
              <img
                src={targetHireCoach.avatar}
                alt={targetHireCoach.name}
                style={{ width: 50, height: 50, borderRadius: 12, objectFit: "cover", border: "2px solid #00e5ff" }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, color: "#fff", fontSize: "0.92rem" }}>
                  Coach {targetHireCoach.name}
                </div>
                <div style={{ fontSize: "0.74rem", color: "#00b4ff" }}>
                  {targetHireCoach.specialty}
                </div>
                <div style={{ fontSize: "0.68rem", color: "#8da4be", marginTop: 2 }}>
                  {targetHireCoach.rating} • {targetHireCoach.exp}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "1.2rem", fontWeight: 900, color: "#34d399", fontFamily: "JetBrains Mono" }}>
                  {targetHireCoach.price}
                </div>
                <div style={{ fontSize: "0.66rem", color: "#8da4be" }}>per month</div>
              </div>
            </div>

            {/* Cost Breakdown */}
            <div
              style={{
                background: "rgba(0, 112, 243, 0.05)",
                border: "1px solid rgba(0, 112, 243, 0.2)",
                borderRadius: 12,
                padding: "12px 14px",
                marginBottom: 16,
                fontSize: "0.76rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, color: "#94a3b8" }}>
                <span>Dedicated 1-on-1 Monthly Retainer</span>
                <span style={{ color: "#fff", fontFamily: "JetBrains Mono" }}>{targetHireCoach.price}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, color: "#94a3b8" }}>
                <span>24/7 Encrypted Direct Chat & Form Reviews</span>
                <span style={{ color: "#34d399" }}>Included</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, color: "#94a3b8" }}>
                <span>Custom Progressive Overload Programming</span>
                <span style={{ color: "#34d399" }}>Included</span>
              </div>
              <div
                style={{
                  borderTop: "1px solid rgba(255,255,255,0.1)",
                  paddingTop: 8,
                  display: "flex",
                  justifyContent: "space-between",
                  fontWeight: 900,
                  fontSize: "0.92rem",
                  color: "#fff",
                }}
              >
                <span>Total Payable Now:</span>
                <span style={{ color: "#00e5ff", fontFamily: "JetBrains Mono", fontSize: "1.05rem" }}>
                  {targetHireCoach.price}
                </span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 800, color: "#8da4be", marginBottom: 8, textTransform: "uppercase" }}>
                Select Payment Method
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("upi")}
                  style={{
                    padding: "9px 6px",
                    borderRadius: 10,
                    border: paymentMethod === "upi" ? "2px solid #00e5ff" : "1px solid rgba(255,255,255,0.1)",
                    background: paymentMethod === "upi" ? "rgba(0, 229, 255, 0.12)" : "rgba(255,255,255,0.02)",
                    color: paymentMethod === "upi" ? "#00e5ff" : "#cbd5e1",
                    fontSize: "0.72rem",
                    fontWeight: 800,
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 3,
                  }}
                >
                  <span style={{ fontSize: "1.1rem" }}>📱</span>
                  <span>UPI / GPay</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("card")}
                  style={{
                    padding: "9px 6px",
                    borderRadius: 10,
                    border: paymentMethod === "card" ? "2px solid #00e5ff" : "1px solid rgba(255,255,255,0.1)",
                    background: paymentMethod === "card" ? "rgba(0, 229, 255, 0.12)" : "rgba(255,255,255,0.02)",
                    color: paymentMethod === "card" ? "#00e5ff" : "#cbd5e1",
                    fontSize: "0.72rem",
                    fontWeight: 800,
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 3,
                  }}
                >
                  <span style={{ fontSize: "1.1rem" }}>💳</span>
                  <span>RuPay / Card</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("netbanking")}
                  style={{
                    padding: "9px 6px",
                    borderRadius: 10,
                    border: paymentMethod === "netbanking" ? "2px solid #00e5ff" : "1px solid rgba(255,255,255,0.1)",
                    background: paymentMethod === "netbanking" ? "rgba(0, 229, 255, 0.12)" : "rgba(255,255,255,0.02)",
                    color: paymentMethod === "netbanking" ? "#00e5ff" : "#cbd5e1",
                    fontSize: "0.72rem",
                    fontWeight: 800,
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 3,
                  }}
                >
                  <span style={{ fontSize: "1.1rem" }}>🏦</span>
                  <span>Net Banking</span>
                </button>
              </div>
            </div>

            {/* Dynamic Input based on payment method */}
            {paymentMethod === "upi" && (
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", fontSize: "0.7rem", color: "#8da4be", marginBottom: 6 }}>
                  UPI Virtual ID (Google Pay, PhonePe, Paytm, BHIM)
                </label>
                <input
                  type="text"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  placeholder="e.g. username@okhdfcbank"
                  className="portal-search-input"
                  style={{ width: "100%", padding: "9px 12px", fontSize: "0.82rem", background: "rgba(255,255,255,0.05)" }}
                />
              </div>
            )}

            {paymentMethod === "card" && (
              <div style={{ marginBottom: 18, display: "flex", flexDirection: "column", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.7rem", color: "#8da4be", marginBottom: 4 }}>
                    Card Number (RuPay, Visa, Mastercard)
                  </label>
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    placeholder="4532 8849 0192 4242"
                    className="portal-search-input"
                    style={{ width: "100%", padding: "8px 12px", fontSize: "0.82rem", background: "rgba(255,255,255,0.05)" }}
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.7rem", color: "#8da4be", marginBottom: 4 }}>Expiry</label>
                    <input
                      type="text"
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(e.target.value)}
                      placeholder="MM/YY"
                      className="portal-search-input"
                      style={{ width: "100%", padding: "8px 12px", fontSize: "0.82rem", background: "rgba(255,255,255,0.05)" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.7rem", color: "#8da4be", marginBottom: 4 }}>CVV</label>
                    <input
                      type="password"
                      value={cardCvv}
                      onChange={(e) => setCardCvv(e.target.value)}
                      placeholder="•••"
                      maxLength={4}
                      className="portal-search-input"
                      style={{ width: "100%", padding: "8px 12px", fontSize: "0.82rem", background: "rgba(255,255,255,0.05)" }}
                    />
                  </div>
                </div>
              </div>
            )}

            {paymentMethod === "netbanking" && (
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", fontSize: "0.7rem", color: "#8da4be", marginBottom: 6 }}>
                  Select Bank
                </label>
                <select
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="portal-search-input"
                  style={{ width: "100%", padding: "9px 12px", fontSize: "0.82rem", background: "#111827", color: "#fff" }}
                >
                  <option value="HDFC Bank">HDFC Bank</option>
                  <option value="State Bank of India">State Bank of India (SBI)</option>
                  <option value="ICICI Bank">ICICI Bank</option>
                  <option value="Axis Bank">Axis Bank</option>
                  <option value="Kotak Mahindra Bank">Kotak Mahindra Bank</option>
                </select>
              </div>
            )}

            {/* Modal Actions */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <button
                type="button"
                className="portal-pill-tab"
                style={{ background: "rgba(255,255,255,0.08)", color: "#94a3b8" }}
                onClick={() => {
                  if (!isProcessingPayment) {
                    setShowHirePaymentModal(false);
                    setTargetHireCoach(null);
                  }
                }}
                disabled={isProcessingPayment}
              >
                Cancel
              </button>
              <button
                type="button"
                className="portal-btn-primary"
                style={{
                  flex: 1,
                  padding: "11px 16px",
                  fontSize: "0.82rem",
                  fontWeight: 900,
                  justifyContent: "center",
                  background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  boxShadow: "0 0 20px rgba(16, 185, 129, 0.4)",
                }}
                onClick={handleConfirmHirePayment}
                disabled={isProcessingPayment}
              >
                {isProcessingPayment ? "Processing Payment & Pairing..." : `Pay ${targetHireCoach.price} & Assign Coach 🔒`}
              </button>
            </div>

            <div style={{ textAlign: "center", marginTop: 10, fontSize: "0.66rem", color: "#64748b" }}>
              🔒 256-Bit Encrypted Transaction • Generates Tax Invoice in INR (₹)
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

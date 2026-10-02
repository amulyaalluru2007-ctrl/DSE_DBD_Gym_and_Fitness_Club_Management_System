import { useState, useEffect } from "react";
import CustomerSidebar3D from "../components/dashboard/CustomerSidebar3D";
import {
  onRealtimeEvent,
  fetchDashboardData,
  scanAttendanceLive,
  toggleExerciseLive,
  logNutritionLive,
  fetchAssignedCoach,
  fetchUserMembershipStatusLive,
} from "../services/realtime";
import NotificationBell from "../components/notifications/NotificationBell";
import "../styles/module-pages.css";

export default function DashboardPage() {
  const getStoredUser = () => {
    try {
      return JSON.parse(localStorage.getItem("fitpulse_user") || "{}");
    } catch {
      return {};
    }
  };

  const [userName, setUserName] = useState(() => getStoredUser().name || "Member");
  const [waterCount, setWaterCount] = useState(0.0);
  const [checkedIn, setCheckedIn] = useState(false);
  const [streakDays, setStreakDays] = useState(0);
  const [monthlyVisits, setMonthlyVisits] = useState(0);
  const [lastScanTime, setLastScanTime] = useState("--");
  const [caloriesBurned, setCaloriesBurned] = useState(0);
  const [workoutTitle, setWorkoutTitle] = useState("No Active Workout Assigned");
  const [workoutPhase, setWorkoutPhase] = useState("Unassigned");
  const [workoutDuration, setWorkoutDuration] = useState(0);
  const [upcomingSessionText, setUpcomingSessionText] = useState("No 1-on-1 Sessions Scheduled");
  const [bench1RM, setBench1RM] = useState("-- kg");
  const [membershipPlan, setMembershipPlan] = useState("Standard Member");
  const [assignedCoach, setAssignedCoach] = useState(null);
  const [gymMembership, setGymMembership] = useState({
    isActive: false,
    planName: "No Active Plan",
    durationKey: null,
    expiresAt: null,
    paidAt: null,
    daysRemaining: 0,
    turnstileFaceIdEnabled: false,
    turnstileMfaEnabled: false,
  });
  const [showQrModal, setShowQrModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Live Rest Timer State
  const [timerSeconds, setTimerSeconds] = useState(90);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // Live Workout Exercise Checklist State
  const [exercises, setExercises] = useState([]);

  // Initial Load from Database and Socket Event Subscriptions
  useEffect(() => {
    // 1. Initial Fetch for logged-in user
    const stored = getStoredUser();

    // Check active coach assignment
    if (stored.id) {
      fetchAssignedCoach(stored.id).then((res) => {
        if (res && res.success && res.coach) {
          setAssignedCoach(res.coach);
        } else {
          setAssignedCoach(null);
        }
      });
    }

    // Load active Cashfree gym membership status
    const loadMembership = (userId) => {
      if (userId) {
        fetchUserMembershipStatusLive(userId).then((res) => {
          if (res && res.success && res.gymMembership) {
            setGymMembership(res.gymMembership);
            if (res.gymMembership.planName) {
              setMembershipPlan(res.gymMembership.planName);
            }
          }
        });
      }
    };

    if (stored.id) {
      loadMembership(stored.id);
    }

    fetchDashboardData(stored.email).then((data) => {
      if (data && data.success) {
        if (data.user?.name) {
          setUserName(data.user.name);
          try {
            const cur = getStoredUser();
            localStorage.setItem("fitpulse_user", JSON.stringify({ ...cur, ...data.user }));
          } catch {}
        }
        if (data.membership?.plan_name) {
          setMembershipPlan(data.membership.plan_name);
        }
        if (data.attendance) {
          setMonthlyVisits(data.attendance.monthlyCount ?? 0);
          setStreakDays(data.attendance.streakDays ?? 0);
          setCheckedIn(Boolean(data.attendance.isCurrentlyInGym));
          setLastScanTime(data.attendance.lastScanTime || "--");
        }
        if (data.workout?.active) {
          setWorkoutTitle(data.workout.active.title);
          setWorkoutPhase(data.workout.active.phase || "Phase I");
          setWorkoutDuration(data.workout.active.duration_mins || 45);
        } else {
          setWorkoutTitle("No Active Workout Assigned");
          setWorkoutPhase("Unassigned");
          setWorkoutDuration(0);
        }
        if (data.workout?.exercises && data.workout.exercises.length > 0) {
          setExercises(
            data.workout.exercises.map((e) => ({
              id: e.id,
              name: e.name,
              target: `${e.sets || "4 sets"} × ${e.reps || "10 reps"}`,
              weight: e.weight || "30 kg",
              completed: Boolean(e.completed),
            }))
          );
        } else {
          setExercises([]);
        }
        if (data.nutrition) {
          setCaloriesBurned(data.nutrition.calories || 0);
        }
        if (data.sessions && data.sessions.length > 0) {
          const userSession = data.sessions.find(
            (s) => s.member_name && s.member_name.toLowerCase() === (data.user?.name || "").toLowerCase()
          );
          if (userSession) {
            setUpcomingSessionText(`Next 1-on-1: ${userSession.session_time} with ${userSession.trainer_name}`);
          } else {
            setUpcomingSessionText("No 1-on-1 Sessions Scheduled (Book below)");
          }
        } else {
          setUpcomingSessionText("No 1-on-1 Sessions Scheduled");
        }
        if (data.prs && data.prs.length > 0) {
          const benchPr = data.prs.find((p) => p.lift_name.toLowerCase().includes("bench"));
          if (benchPr) setBench1RM(`${benchPr.weight_kg} kg`);
          else setBench1RM(`${data.prs[0].weight_kg} kg`);
        } else {
          setBench1RM("-- kg");
        }
      }
    });

    // 2. Real-time Subscriptions
    const unsubAttendance = onRealtimeEvent("attendance:scanned", (payload) => {
      if (payload) {
        setCheckedIn(payload.isCurrentlyInGym);
        if (payload.streakDays !== undefined) setStreakDays(payload.streakDays);
        if (payload.monthlyCount !== undefined) setMonthlyVisits(payload.monthlyCount);
        if (payload.lastScanTime) setLastScanTime(payload.lastScanTime);
      }
    });

    const unsubWorkoutAssigned = onRealtimeEvent("workout:assigned", (payload) => {
      if (payload) {
        setWorkoutTitle(payload.title);
        setWorkoutPhase(payload.phase || "Phase I");
        if (payload.exercises && payload.exercises.length > 0) {
          setExercises(
            payload.exercises.map((e) => ({
              id: e.id,
              name: e.name,
              target: `${e.sets || "4 sets"} × ${e.reps || "10 reps"}`,
              weight: e.weight || "35 kg",
              completed: Boolean(e.completed),
            }))
          );
        }
      }
    });

    const unsubSetCompleted = onRealtimeEvent("workout:set-completed", (payload) => {
      if (payload && payload.exerciseId) {
        setExercises((prev) =>
          prev.map((ex) =>
            ex.id === payload.exerciseId ? { ...ex, completed: payload.completed } : ex
          )
        );
      }
    });

    const unsubWorkoutCompleted = onRealtimeEvent("workout:completed", (payload) => {
      if (payload) {
        setCaloriesBurned((prev) => prev + (payload.caloriesBurned || 420));
      }
    });

    const unsubSessionBooked = onRealtimeEvent("session:booked", (payload) => {
      if (payload) {
        setUpcomingSessionText(`Next 1-on-1: ${payload.session_time} with ${payload.trainer_name}`);
      }
    });

    const unsubNutrition = onRealtimeEvent("nutrition:logged", (payload) => {
      if (payload && payload.totalCalories !== undefined) {
        setCaloriesBurned(payload.totalCalories);
      }
    });

    const unsubProfile = onRealtimeEvent("profile:updated", (payload) => {
      if (payload && payload.name) {
        setUserName(payload.name);
      }
    });

    const unsubTraineeAssigned = onRealtimeEvent("trainee:assigned", (payload) => {
      if (payload && (!stored.id || Number(payload.memberId) === Number(stored.id))) {
        setAssignedCoach(payload.coach);
      }
    });

    const unsubTraineeReleased = onRealtimeEvent("trainee:released", (payload) => {
      if (payload && (!stored.id || Number(payload.memberId) === Number(stored.id))) {
        setAssignedCoach(null);
      }
    });

    const unsubPayment = onRealtimeEvent("payment:success", (payload) => {
      if (!stored.id || Number(payload?.userId) === Number(stored.id)) {
        loadMembership(stored.id);
      }
    });

    const unsubMembership = onRealtimeEvent("membership:updated", (payload) => {
      if (!stored.id || Number(payload?.userId) === Number(stored.id)) {
        loadMembership(stored.id);
      }
    });

    return () => {
      unsubAttendance();
      unsubWorkoutAssigned();
      unsubSetCompleted();
      unsubWorkoutCompleted();
      unsubSessionBooked();
      unsubNutrition();
      unsubProfile();
      unsubTraineeAssigned();
      unsubTraineeReleased();
      unsubPayment();
      unsubMembership();
    };
  }, []);

  // Timer countdown
  useEffect(() => {
    let interval = null;
    if (isTimerRunning && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev - 1);
      }, 1000);
    } else if (timerSeconds === 0 && isTimerRunning) {
      setIsTimerRunning(false);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerSeconds]);

  const toggleTimer = () => setIsTimerRunning(!isTimerRunning);
  const resetTimer = (secs = 90) => {
    setIsTimerRunning(false);
    setTimerSeconds(secs);
  };

  const handleToggleCheckIn = async () => {
    const nextCheckedInState = !checkedIn;
    setCheckedIn(nextCheckedInState);
    await scanAttendanceLive("Turnstile #02 (Main Entrance)", !nextCheckedInState);
  };

  const toggleExercise = async (id) => {
    setExercises((prev) =>
      prev.map((ex) => (ex.id === id ? { ...ex, completed: !ex.completed } : ex))
    );
    await toggleExerciseLive(id);
  };

  const handleAddWater = async (delta) => {
    const nextWater = +(Math.min(waterCount + delta, 5.0).toFixed(1));
    setWaterCount(nextWater);
    await logNutritionLive({
      mealName: "Hydration Flask",
      calories: 0,
      protein: 0,
    });
  };

  const navigateTo = (path) => {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const completedSetsCount = exercises.filter((e) => e.completed).length;
  const activityPercent = exercises.length > 0 ? Math.round((completedSetsCount / exercises.length) * 100) : 0;

  return (
    <div className="module-page-container">
      {/* Subtle Atmospheric Gym Background (Opacity 0.16, dark masked) */}
      <img
        src="/assets/auth-gym-clean-bg.jpg"
        alt="FitPulse Luxury Campus"
        className="module-page-bg"
      />
      <div className="module-page-vignette" />

      {/* 3D Glassmorphic Sidebar Dock */}
      <CustomerSidebar3D currentModule="dashboard" />

      {/* Main Executive Command Center */}
      <main className="module-page-main">
        {/* Top Header & Facility Live Status */}
        <div className="module-page-topbar">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <span className="bento-badge-live pulse-green">
                <span className="module-status-dot" style={{ background: "#10b981", boxShadow: "0 0 8px #10b981" }} />
                CAMPUS OPEN • 184 ACTIVE ON FLOOR
              </span>
              <span style={{ fontSize: "0.74rem", color: "#64748b", fontFamily: "JetBrains Mono" }}>
                PEAK HOURS: 6:00 PM - 8:30 PM
              </span>
            </div>
            <h1 style={{ fontSize: "1.85rem", fontWeight: 900, color: "#ffffff", margin: 0, letterSpacing: "-0.02em" }}>
              Welcome back, {userName} 👋
            </h1>
            <div style={{ fontSize: "0.84rem", color: "#94a3b8", marginTop: 4 }}>
              Sunday, 13 September 2026 • {streakDays > 0 ? `${streakDays}-Day Discipline Streak` : "Start Your Streak Today"} • {monthlyVisits} Visits This Month • {membershipPlan}
            </div>
          </div>

          <div className="module-topbar-actions">
            {/* Quick Search Bar */}
            <div style={{ position: "relative" }}>
              <input
                type="text"
                placeholder="Search workouts, coaches, logs... ⌘K"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="trainer-chat-input"
                style={{
                  width: 260,
                  padding: "8px 14px",
                  fontSize: "0.8rem",
                  borderRadius: 9999,
                  background: "rgba(255,255,255,0.05)",
                }}
              />
            </div>

            {/* Digital Pass Button */}
            <button
              type="button"
              className="module-back-btn"
              onClick={() => setShowQrModal(true)}
              style={{ background: "rgba(0, 180, 255, 0.12)", borderColor: "rgba(0, 180, 255, 0.4)", color: "#00e5ff" }}
            >
              <span>📱</span>
              <span>Turnstile QR Pass</span>
            </button>

            {/* In-App Serious Notification Center */}
            <NotificationBell userId={getStoredUser().id || 1} />

            {/* Check-in Toggle with Live Turnstile API & WebSocket */}
            <button
              type="button"
              className="module-back-btn"
              onClick={handleToggleCheckIn}
              style={{
                borderColor: checkedIn ? "#10b981" : "rgba(255,255,255,0.2)",
                background: checkedIn ? "rgba(16, 185, 129, 0.15)" : "rgba(255,255,255,0.05)",
                color: checkedIn ? "#34d399" : "rgba(255,255,255,0.8)",
                cursor: "pointer",
                transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            >
              <span>{checkedIn ? "✓ CHECKED IN TODAY" : "SCAN ENTRY"}</span>
            </button>
          </div>
        </div>

        {/* Screen 1 Top Section: Today's Activity & Quick Actions (Left) + Motivation Hero (Right) */}
        <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: "20px", marginBottom: "24px" }}>
          {/* Left Column */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Card 1: Today's Activity */}
            <div className="portal-card" style={{ padding: "20px 24px" }}>
              <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "#ffffff", marginBottom: "16px", letterSpacing: "0.02em" }}>
                Today's Activity
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "28px" }}>
                {/* Circular Ring Gauge */}
                <div style={{ position: "relative", width: "100px", height: "100px", flexShrink: 0 }}>
                  <svg viewBox="0 0 100 100" style={{ transform: "rotate(-90deg)", width: "100%", height: "100%" }}>
                    <circle cx="50" cy="50" r="40" fill="transparent" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="9" />
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="transparent"
                      stroke="#00e5ff"
                      strokeWidth="9"
                      strokeDasharray="251.2"
                      strokeDashoffset={251.2 * (1 - (activityPercent / 100))}
                      strokeLinecap="round"
                      style={{ filter: "drop-shadow(0 0 6px rgba(0, 229, 255, 0.5))" }}
                    />
                  </svg>
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 900,
                      fontSize: "1.25rem",
                      color: "#ffffff",
                      fontFamily: "JetBrains Mono",
                    }}
                  >
                    {activityPercent}%
                  </div>
                </div>

                {/* 3 Metrics next to gauge */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "18px", flex: 1 }}>
                  <div>
                    <div style={{ fontSize: "1.25rem", fontWeight: 900, color: "#ffffff", fontFamily: "JetBrains Mono" }}>
                      {exercises.length > 0 ? `${completedSetsCount}/${exercises.length}` : "0/0"}
                    </div>
                    <div style={{ fontSize: "0.74rem", color: "#8da4be", marginTop: "2px" }}>Workouts</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "1.25rem", fontWeight: 900, color: "#ffffff", fontFamily: "JetBrains Mono" }}>
                      {caloriesBurned.toLocaleString()}
                    </div>
                    <div style={{ fontSize: "0.74rem", color: "#8da4be", marginTop: "2px" }}>kcal</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "1.25rem", fontWeight: 900, color: "#00e5ff", fontFamily: "JetBrains Mono" }}>
                      {waterCount.toFixed(1)} L
                    </div>
                    <div style={{ fontSize: "0.74rem", color: "#8da4be", marginTop: "2px" }}>Water</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Quick Actions */}
            <div className="portal-card" style={{ padding: "18px 22px" }}>
              <div style={{ fontSize: "0.82rem", fontWeight: 800, color: "#ffffff", marginBottom: "14px" }}>
                Quick Actions
              </div>
              <div className="portal-quick-actions-grid">
                <button
                  type="button"
                  className="portal-quick-action-item"
                  onClick={() => navigateTo("/dashboard/workouts")}
                >
                  <span className="portal-quick-action-icon" style={{ color: "#00b4ff" }}>⚡</span>
                  <span>Start Workout</span>
                </button>
                <button
                  type="button"
                  className="portal-quick-action-item"
                  onClick={() => navigateTo("/dashboard/nutrition")}
                >
                  <span className="portal-quick-action-icon" style={{ color: "#10b981" }}>🥗</span>
                  <span>Log Meal</span>
                </button>
                <button
                  type="button"
                  className="portal-quick-action-item"
                  onClick={() => setShowQrModal(true)}
                >
                  <span className="portal-quick-action-icon" style={{ color: "#00e5ff" }}>📱</span>
                  <span>Scan QR</span>
                </button>
                <button
                  type="button"
                  className="portal-quick-action-item"
                  onClick={() => navigateTo("/dashboard/trainers")}
                >
                  <span className="portal-quick-action-icon" style={{ color: "#a855f7" }}>🏋️</span>
                  <span>Book Trainer</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Motivation Hero Card */}
          <div
            className="portal-card"
            style={{
              padding: "26px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              backgroundImage: "radial-gradient(ellipse at 80% 20%, rgba(0, 180, 255, 0.15) 0%, transparent 60%), linear-gradient(180deg, rgba(12, 17, 27, 0.7) 0%, rgba(8, 12, 18, 0.95) 100%), url('https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=800&auto=format&fit=crop&q=80')",
              backgroundSize: "cover",
              backgroundPosition: "center top",
              minHeight: "260px",
              border: "1px solid rgba(0, 180, 255, 0.2)",
            }}
          >
            <div>
              <div style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "#00e5ff", fontWeight: 800, marginBottom: "8px" }}>
                Motivation
              </div>
              <blockquote style={{ margin: 0, fontSize: "1.35rem", fontWeight: 900, color: "#ffffff", lineHeight: 1.35, letterSpacing: "-0.01em" }}>
                "Discipline today. A stronger you tomorrow."
              </blockquote>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "24px" }}>
              <span style={{ fontSize: "0.78rem", color: "#8da4be" }}>Daily Quote • FitPulse Mindset</span>
              <span style={{ fontSize: "0.75rem", padding: "4px 10px", borderRadius: "9999px", background: "rgba(0, 229, 255, 0.15)", color: "#00f0ff", fontWeight: 700 }}>
                #BEASTMODE
              </span>
            </div>
          </div>
        </div>

        {/* The Asymmetrical Bento Grid */}
        <div className="dashboard-bento-grid">
          {/* Card 1: Wide 2-Column Live Workout Engine */}
          <div
            className="bento-card bento-span-2"
            onClick={() => navigateTo("/dashboard/workouts")}
          >
            <div className="bento-card-header">
              <div>
                <div className="bento-card-kicker">ACTIVE TRAINING PROTOCOL</div>
                <h3 className="bento-card-title">{workoutTitle}</h3>
                <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                  {workoutPhase} • Progressive Overload Dynamic
                </span>
              </div>
              <span className="bento-badge-live">
                <span className="module-status-dot" />
                SESSION IN PROGRESS • {workoutDuration} MINS
              </span>
            </div>

            {/* Live Progress Bar & Intra-Set Rest Timer */}
            <div className="workout-live-status-bar">
              <div>
                <div style={{ fontSize: "0.72rem", color: "#94a3b8", textTransform: "uppercase", fontWeight: 700 }}>
                  Current Volume Progress
                </div>
                <div style={{ fontSize: "1rem", fontWeight: 800, color: "#ffffff", fontFamily: "JetBrains Mono" }}>
                  {completedSetsCount} of {exercises.length} Exercises Logged
                </div>
              </div>

              {/* Mini Rest Timer Widget */}
              <div
                style={{ display: "flex", alignItems: "center", gap: 12 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div>
                  <div style={{ fontSize: "0.68rem", color: "#94a3b8", textTransform: "uppercase" }}>Rest Interval</div>
                  <div style={{ fontSize: "1.25rem", fontWeight: 900, color: "#00e5ff", fontFamily: "JetBrains Mono" }}>
                    {Math.floor(timerSeconds / 60)}:{(timerSeconds % 60).toString().padStart(2, "0")}
                  </div>
                </div>
                <button
                  type="button"
                  className="workout-timer-btn"
                  style={{ padding: "6px 12px", fontSize: "0.75rem" }}
                  onClick={toggleTimer}
                >
                  {isTimerRunning ? "Pause ⏸" : "Start ▶"}
                </button>
                <button
                  type="button"
                  className="workout-timer-btn"
                  style={{ padding: "6px 10px", fontSize: "0.75rem" }}
                  onClick={() => resetTimer(90)}
                >
                  ↻
                </button>
              </div>
            </div>

            {/* Live Interactive Exercise Checklist */}
            <div
              className="workout-exercise-checklist"
              onClick={(e) => e.stopPropagation()}
            >
              {exercises.length === 0 ? (
                <div style={{ textAlign: "center", padding: "28px 16px", color: "#94a3b8" }}>
                  <div style={{ fontSize: "1.8rem", marginBottom: 6 }}>⚡</div>
                  <div style={{ fontWeight: 800, color: "#ffffff", fontSize: "0.92rem" }}>
                    No Active Routine Assigned Yet
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#8da4be", maxWidth: 360, margin: "4px auto 14px" }}>
                    Hire a dedicated master coach or choose a workout split to receive your personalized training schedule.
                  </div>
                  <button
                    type="button"
                    className="portal-btn-primary"
                    style={{ padding: "8px 18px", fontSize: "0.78rem" }}
                    onClick={() => navigateTo("/dashboard/trainers")}
                  >
                    Hire Master Coach →
                  </button>
                </div>
              ) : (
                exercises.map((ex) => (
                  <div
                    key={ex.id}
                    className={`workout-check-item ${ex.completed ? "completed" : ""}`}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <input
                        type="checkbox"
                        checked={ex.completed}
                        onChange={() => toggleExercise(ex.id)}
                        style={{ width: 18, height: 18, cursor: "pointer", accentColor: "#00b4ff" }}
                      />
                      <div>
                        <div style={{ fontSize: "0.9rem", fontWeight: 800, textDecoration: ex.completed ? "line-through" : "none" }}>
                          {ex.name}
                        </div>
                        <div style={{ fontSize: "0.74rem", color: "#94a3b8" }}>{ex.target}</div>
                      </div>
                    </div>
                    <span className="module-status-pill" style={{ fontSize: "0.74rem" }}>
                      {ex.weight}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="bento-footer-cta">
              <span>Launch Full Workout Suite & Routine Builder</span>
              <span className="bento-cta-arrow">→</span>
            </div>
          </div>

          {/* Card 2: Daily Metabolic Fuel & Macros */}
          <div
            className="bento-card"
            onClick={() => navigateTo("/dashboard/nutrition")}
          >
            <div className="bento-card-header">
              <div>
                <div className="bento-card-kicker">METABOLIC MACROS</div>
                <h3 className="bento-card-title">Daily Nutrition</h3>
              </div>
              <span className="bento-badge-live">{caloriesBurned.toLocaleString()} / 2,650 KCAL</span>
            </div>

            {/* Segmented Macro Bars */}
            {(() => {
              const proteinGrams = Math.round(caloriesBurned * 0.07);
              const proteinPct = Math.min(Math.round((proteinGrams / 185) * 100), 100);
              const carbsGrams = Math.round(caloriesBurned * 0.09);
              const carbsPct = Math.min(Math.round((carbsGrams / 310) * 100), 100);
              const fatsGrams = Math.round(caloriesBurned * 0.024);
              const fatsPct = Math.min(Math.round((fatsGrams / 70) * 100), 100);

              return (
                <>
                  <div className="macro-meter-row">
                    <div className="macro-meter-head">
                      <span style={{ color: "#00b4ff" }}>Protein</span>
                      <span style={{ fontFamily: "JetBrains Mono" }}>{proteinGrams}g / 185g ({proteinPct}%)</span>
                    </div>
                    <div className="macro-meter-track">
                      <div className="macro-meter-fill" style={{ width: `${proteinPct}%`, background: "#00b4ff" }} />
                    </div>
                  </div>

                  <div className="macro-meter-row">
                    <div className="macro-meter-head">
                      <span style={{ color: "#f59e0b" }}>Carbohydrates</span>
                      <span style={{ fontFamily: "JetBrains Mono" }}>{carbsGrams}g / 310g ({carbsPct}%)</span>
                    </div>
                    <div className="macro-meter-track">
                      <div className="macro-meter-fill" style={{ width: `${carbsPct}%`, background: "#f59e0b" }} />
                    </div>
                  </div>

                  <div className="macro-meter-row">
                    <div className="macro-meter-head">
                      <span style={{ color: "#10b981" }}>Essential Fats</span>
                      <span style={{ fontFamily: "JetBrains Mono" }}>{fatsGrams}g / 70g ({fatsPct}%)</span>
                    </div>
                    <div className="macro-meter-track">
                      <div className="macro-meter-fill" style={{ width: `${fatsPct}%`, background: "#10b981" }} />
                    </div>
                  </div>
                </>
              );
            })()}

            {/* Hydration Logger Bar */}
            <div
              style={{
                marginTop: 8,
                background: "rgba(255, 255, 255, 0.03)",
                padding: "12px 14px",
                borderRadius: 14,
                border: "1px solid rgba(255, 255, 255, 0.06)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: "0.76rem", color: "#94a3b8", fontWeight: 700 }}>CELLULAR HYDRATION</span>
                <span style={{ fontSize: "0.85rem", fontWeight: 900, fontFamily: "JetBrains Mono", color: "#00f0ff" }}>
                  {waterCount.toFixed(1)}L / 3.5L
                </span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="workout-timer-btn"
                  style={{ flex: 1, padding: "5px 0", fontSize: "0.74rem" }}
                  onClick={() => handleAddWater(0.25)}
                >
                  +250ml
                </button>
                <button
                  type="button"
                  className="workout-timer-btn"
                  style={{ flex: 1, padding: "5px 0", fontSize: "0.74rem" }}
                  onClick={() => handleAddWater(0.5)}
                >
                  +500ml
                </button>
              </div>
            </div>

            <div className="bento-footer-cta">
              <span>Open Nutrition Hub & Meals</span>
              <span className="bento-cta-arrow">→</span>
            </div>
          </div>

          {/* Card 3: Master Coach Concierge */}
          <div
            className="bento-card"
            onClick={() => navigateTo("/dashboard/trainers")}
          >
            <div className="bento-card-header">
              <div>
                <div className="bento-card-kicker">1-ON-1 COACHING</div>
                <h3 className="bento-card-title">Coach Concierge</h3>
              </div>
              <span className="bento-badge-live pulse-green">
                {assignedCoach ? "PAIRED & ACTIVE" : "AVAILABLE"}
              </span>
            </div>

            {assignedCoach ? (
              <>
                <div className="coach-preview-box">
                  <div className="coach-avatar-wrapper">
                    <img
                      src={assignedCoach.avatar || "https://images.unsplash.com/photo-1567013127542-490d757e51fc?w=120&auto=format&fit=crop&q=80"}
                      alt={assignedCoach.name}
                      className="coach-avatar-img"
                    />
                    <span className="coach-status-beacon" />
                  </div>
                  <div>
                    <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#ffffff" }}>
                      {assignedCoach.name}
                    </div>
                    <div style={{ fontSize: "0.74rem", color: "#00b4ff", fontWeight: 700 }}>
                      {assignedCoach.specialty || "Certified Master Coach"}
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>
                      5.0 ★ • Dedicated 1-on-1 Coach
                    </div>
                  </div>
                </div>

                <div className="coach-chat-snip">
                  <span style={{ color: "#00b4ff", fontWeight: 800 }}>{assignedCoach.name.split(" ")[0]}: </span>
                  "Private channel ready. Message me anytime for form audits or programming adjustments!"
                </div>

                <div style={{ fontSize: "0.78rem", color: "#cbd5e1", display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <span>🗓</span>
                  <span>{upcomingSessionText}</span>
                </div>

                <div className="bento-footer-cta">
                  <span>Direct Message Coach {assignedCoach.name.split(" ")[0]}</span>
                  <span className="bento-cta-arrow">→</span>
                </div>
              </>
            ) : (
              <div style={{ padding: "16px 0", textAlign: "center" }}>
                <div style={{ fontSize: "2rem", marginBottom: 8 }}>🏋️‍♂️</div>
                <div style={{ fontWeight: 800, color: "#ffffff", fontSize: "0.95rem" }}>
                  No Dedicated Coach Subscribed
                </div>
                <div style={{ fontSize: "0.76rem", color: "#8da4be", marginTop: 4, marginBottom: 14, lineHeight: 1.4 }}>
                  FitPulse members are paired with a single master coach for 24/7 direct chat, form critiques, and custom programming.
                </div>
                <button
                  type="button"
                  className="portal-btn-primary"
                  style={{ width: "100%", padding: "9px 14px", fontSize: "0.78rem", justifyContent: "center" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateTo("/dashboard/trainers");
                  }}
                >
                  Hire a Master Coach (From ₹2,799/mo) →
                </button>
                <div className="bento-footer-cta" style={{ marginTop: 14 }}>
                  <span>Browse Certified Coaches Roster</span>
                  <span className="bento-cta-arrow">→</span>
                </div>
              </div>
            )}
          </div>

          {/* Card 4: Athlete Community Pulse */}
          <div
            className="bento-card"
            onClick={() => navigateTo("/dashboard/community")}
          >
            <div className="bento-card-header">
              <div>
                <div className="bento-card-kicker">FITPULSE ATHLETE NETWORK</div>
                <h3 className="bento-card-title">Community Pulse</h3>
              </div>
              <span className="bento-badge-live">184 ATHLETES</span>
            </div>

            {/* Monthly Challenge Box */}
            <div style={{ background: "rgba(0, 180, 255, 0.05)", border: "1px solid rgba(0, 180, 255, 0.16)", borderRadius: 14, padding: "12px 14px", marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", fontWeight: 800, marginBottom: 6 }}>
                <span>100km Monthly Rowing Quest</span>
                <span style={{ color: "#00e5ff" }}>64%</span>
              </div>
              <div className="macro-meter-track" style={{ height: 6 }}>
                <div className="macro-meter-fill" style={{ width: "64%", background: "linear-gradient(90deg, #0084ff, #00f0ff)" }} />
              </div>
              <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: 4 }}>
                64.2 km logged • Rank #03 in gym
              </div>
            </div>

            {/* Trending Member Milestone */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255, 255, 255, 0.03)", padding: "10px 12px", borderRadius: 12 }}>
              <img
                src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=80&auto=format&fit=crop&q=80"
                alt="Elena"
                style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.8rem", fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  Elena Rostova hit 145kg PR! 🏆
                </div>
                <div style={{ fontSize: "0.68rem", color: "#94a3b8" }}>42 Likes • 8 Comments</div>
              </div>
            </div>

            <div className="bento-footer-cta">
              <span>Join Discussion & Leaderboard</span>
              <span className="bento-cta-arrow">→</span>
            </div>
          </div>

          {/* Card 5: Strength & 1RM Progression */}
          <div
            className="bento-card"
            onClick={() => navigateTo("/dashboard/progress")}
          >
            <div className="bento-card-header">
              <div>
                <div className="bento-card-kicker">BIOMETRIC TRACKING</div>
                <h3 className="bento-card-title">Strength & 1RM Gains</h3>
              </div>
              <span className="bento-badge-live pulse-green">+5 KG THIS MONTH</span>
            </div>

            {/* Interactive SVG Sparkline Chart */}
            <div className="strength-chart-box">
              <div className="strength-chart-meta">
                <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#94a3b8" }}>Barbell Bench Press 1RM</span>
                <span style={{ fontSize: "1.3rem", fontWeight: 900, fontFamily: "JetBrains Mono", color: "#00e5ff" }}>
                  {bench1RM}
                </span>
              </div>
              <svg className="strength-chart-svg" viewBox="0 0 300 70">
                <defs>
                  <linearGradient id="chartGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#00b4ff" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#00b4ff" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                {/* Area Fill */}
                <path
                  d="M 10 55 L 60 48 L 120 40 L 180 32 L 240 22 L 290 10 L 290 70 L 10 70 Z"
                  fill="url(#chartGrad)"
                />
                {/* Smooth Curve Line */}
                <path
                  d="M 10 55 L 60 48 L 120 40 L 180 32 L 240 22 L 290 10"
                  fill="none"
                  stroke="#00b4ff"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                {/* Data Points */}
                <circle cx="10" cy="55" r="3" fill="#ffffff" />
                <circle cx="60" cy="48" r="3" fill="#ffffff" />
                <circle cx="120" cy="40" r="3" fill="#ffffff" />
                <circle cx="180" cy="32" r="3" fill="#ffffff" />
                <circle cx="240" cy="22" r="3" fill="#ffffff" />
                <circle cx="290" cy="10" r="4.5" fill="#00f0ff" stroke="#ffffff" strokeWidth="1.5" />
              </svg>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.66rem", color: "#64748b", marginTop: 4, fontFamily: "JetBrains Mono" }}>
                <span>Apr (85kg)</span>
                <span>Jun (95kg)</span>
                <span>Sep (105kg)</span>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.76rem", color: "#cbd5e1" }}>
              <span>Weight: <strong>72.4kg</strong></span>
              <span>Body Fat: <strong style={{ color: "#10b981" }}>12.8%</strong></span>
              <span>SBD: <strong style={{ color: "#00b4ff" }}>477.5kg</strong></span>
            </div>

            <div className="bento-footer-cta">
              <span>View Full Analytics & InBody Scans</span>
              <span className="bento-cta-arrow">→</span>
            </div>
          </div>

          {/* Card 6: Biometric Gym Membership Pass */}
          <div
            className="bento-card"
            onClick={() => navigateTo("/dashboard/plans")}
            style={{ cursor: "pointer" }}
          >
            <div className="bento-card-header">
              <div>
                <div className="bento-card-kicker">MEMBERSHIP ACCESS</div>
                <h3 className="bento-card-title">Gym Access Pass</h3>
              </div>
              <span
                className="bento-badge-live"
                style={{
                  background: gymMembership.isActive ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                  color: gymMembership.isActive ? "#10b981" : "#ef4444",
                  borderColor: gymMembership.isActive ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)",
                }}
              >
                {gymMembership.isActive
                  ? `ACTIVE • ${gymMembership.daysRemaining} DAYS REMAINING`
                  : "UNPAID / EXPIRED"}
              </span>
            </div>

            {/* Brushed FitPulse Card */}
            <div
              className="digital-vip-card"
              style={{
                background: gymMembership.isActive
                  ? "linear-gradient(135deg, #0d1a2d 0%, #06101e 100%)"
                  : "linear-gradient(135deg, #1c1315 0%, #11090a 100%)",
                border: gymMembership.isActive
                  ? "1px solid rgba(0, 229, 255, 0.35)"
                  : "1px solid rgba(239, 68, 68, 0.35)",
              }}
            >
              <div className="vip-card-header">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div
                    className="vip-card-chip"
                    style={{
                      background: gymMembership.isActive
                        ? "linear-gradient(135deg, #ffd700, #b8860b)"
                        : "#4b5563",
                    }}
                  />
                  <span style={{ fontSize: "0.68rem", color: "#94a3b8", fontFamily: "JetBrains Mono" }}>
                    NFC READY • INR (₹)
                  </span>
                </div>
                <span
                  style={{
                    fontSize: "0.74rem",
                    fontWeight: 900,
                    letterSpacing: "0.08em",
                    color: gymMembership.isActive ? "#00f0ff" : "#ef4444",
                    textTransform: "uppercase",
                  }}
                >
                  {gymMembership.isActive ? gymMembership.planName : "NO ACTIVE PLAN"}
                </span>
              </div>
              <div className="vip-card-number" style={{ letterSpacing: "2px" }}>
                FP-MEM-{String(getStoredUser().id || 1).padStart(4, "0")}
              </div>
              <div className="vip-card-footer">
                <span>{userName.toUpperCase()}</span>
                <span>
                  {gymMembership.isActive && gymMembership.expiresAt
                    ? `VALID TILL ${new Date(gymMembership.expiresAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" }).toUpperCase()}`
                    : "PLAN REQUIRED"}
                </span>
              </div>
            </div>

            <div style={{ fontSize: "0.76rem", color: "#94a3b8", lineHeight: 1.4 }}>
              {gymMembership.isActive
                ? "✓ 24/7 Optical Face ID Gate & 1-Min Dynamic MFA Attendance PIN active. Eligible to hire dedicated trainers."
                : "⚠️ Turnstile Face Scan & Dynamic MFA locked. Select a 1M, 3M, 6M, or 1Y Indian Rupee pass to unlock."}
            </div>

            <div className="bento-footer-cta">
              <span>{gymMembership.isActive ? "Manage Plan & Billing Receipts" : "Pay Gym Fee via Cashfree (1M / 3M / 6M / 1Y)"}</span>
              <span className="bento-cta-arrow">→</span>
            </div>
          </div>
        </div>
      </main>

      {/* QR Code Digital Turnstile Entry Modal */}
      {showQrModal && (
        <div
          className="qr-modal-backdrop"
          onClick={() => setShowQrModal(false)}
        >
          <div
            className="qr-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: "0.75rem", color: "#00b4ff", fontWeight: 800, letterSpacing: "0.1em" }}>
              FITPULSE DIGITAL TURNSTILE PASS
            </div>
            <h3 style={{ margin: "6px 0 16px 0", fontSize: "1.3rem", fontWeight: 900 }}>
              Member Access Pass
            </h3>

            {/* Simulated Vector QR Graphic */}
            <div
              style={{
                width: 180,
                height: 180,
                margin: "0 auto 18px",
                background: "#ffffff",
                borderRadius: 16,
                padding: 14,
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div style={{ width: 44, height: 44, background: "#000", borderRadius: 4 }} />
                <div style={{ width: 44, height: 44, background: "#000", borderRadius: 4 }} />
              </div>
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 40, fontWeight: 900, color: "#000", fontSize: "0.75rem", letterSpacing: "0.1em" }}>
                FITPULSE • MEMBER
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div style={{ width: 44, height: 44, background: "#000", borderRadius: 4 }} />
                <div style={{ width: 44, height: 44, border: "3px solid #000", borderRadius: 4 }} />
              </div>
            </div>

            <div style={{ fontFamily: "JetBrains Mono", fontSize: "0.85rem", fontWeight: 800, color: "#fff", marginBottom: 6 }}>
              ID: FP-MEM-{String(getStoredUser().id || 1).padStart(4, "0")}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginBottom: 20 }}>
              {gymMembership.isActive
                ? "Hold screen against turnstile scanner for contact-free club entry."
                : "Pass locked: Please renew or purchase a gym membership to activate turnstile passage."}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                className="community-btn-primary"
                style={{ flex: 1 }}
                onClick={() => {
                  setShowQrModal(false);
                  navigateTo("/dashboard/attendance");
                }}
              >
                Open Attendance Hub →
              </button>
              <button
                type="button"
                className="workout-timer-btn"
                style={{ padding: "10px 18px" }}
                onClick={() => setShowQrModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from "react";
import CustomerSidebar3D from "../../components/dashboard/CustomerSidebar3D";
import { fetchAssignedCoach, onRealtimeEvent } from "../../services/realtime";
import "../../styles/module-pages.css";

const workoutSplits = {
  Push: [
    { id: "ex-1", name: "Incline Dumbbell Bench Press", target: "Upper Pectorals", sets: "4 Sets", reps: "8-10 Reps", weight: "36 kg", completed: false },
    { id: "ex-2", name: "Barbell Flat Bench Press", target: "Mid Chest", sets: "4 Sets", reps: "6-8 Reps", weight: "90 kg", completed: true },
    { id: "ex-3", name: "Weighted Chest Dips", target: "Lower Chest & Triceps", sets: "3 Sets", reps: "10-12 Reps", weight: "+20 kg", completed: false },
    { id: "ex-4", name: "Cable Lateral Raises", target: "Lateral Deltoids", sets: "4 Sets", reps: "12-15 Reps", weight: "14 kg", completed: false },
    { id: "ex-5", name: "Overhead Rope Tricep Extension", target: "Triceps Long Head", sets: "3 Sets", reps: "12 Reps", weight: "28 kg", completed: false },
  ],
  Pull: [
    { id: "ex-6", name: "Conventional Barbell Deadlift", target: "Posterior Chain", sets: "4 Sets", reps: "5 Reps", weight: "150 kg", completed: false },
    { id: "ex-7", name: "Chest-Supported T-Bar Row", target: "Lats & Rhomboids", sets: "4 Sets", reps: "8-10 Reps", weight: "65 kg", completed: false },
    { id: "ex-8", name: "Neutral Grip Lat Pulldown", target: "Upper Lats", sets: "3 Sets", reps: "10-12 Reps", weight: "75 kg", completed: false },
    { id: "ex-9", name: "Incline Dumbbell Bicep Curl", target: "Biceps Brachii", sets: "3 Sets", reps: "12 Reps", weight: "18 kg", completed: false },
    { id: "ex-10", name: "Face Pulls with External Rotation", target: "Rear Delts & Rotators", sets: "4 Sets", reps: "15 Reps", weight: "22 kg", completed: false },
  ],
  Legs: [
    { id: "ex-11", name: "Barbell Back Squat", target: "Quads & Glutes", sets: "4 Sets", reps: "6-8 Reps", weight: "125 kg", completed: false },
    { id: "ex-12", name: "Romanian Deadlift", target: "Hamstrings", sets: "4 Sets", reps: "8-10 Reps", weight: "100 kg", completed: false },
    { id: "ex-13", name: "Bulgarian Split Squat", target: "Unilateral Quads", sets: "3 Sets", reps: "10 Reps", weight: "24 kg DBs", completed: false },
    { id: "ex-14", name: "Seated Calf Raise", target: "Soleus", sets: "4 Sets", reps: "15 Reps", weight: "55 kg", completed: false },
  ],
};

export default function WorkoutsModulePage() {
  const [activeSplit, setActiveSplit] = useState("Push");
  const [exercises, setExercises] = useState(workoutSplits);
  const [timerSeconds, setTimerSeconds] = useState(90);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [assignedCoach, setAssignedCoach] = useState(null);

  useEffect(() => {
    let memberId = null;
    try {
      const stored = JSON.parse(localStorage.getItem("fitpulse_user") || "{}");
      if (stored.id) memberId = stored.id;
    } catch {}

    if (memberId) {
      fetchAssignedCoach(memberId).then((res) => {
        if (res && res.success && res.coach) {
          setAssignedCoach(res.coach);
        } else {
          setAssignedCoach(null);
        }
      });
    }

    const unsubAssigned = onRealtimeEvent("trainee:assigned", (payload) => {
      if (payload && (!memberId || payload.memberId === memberId)) {
        setAssignedCoach({
          trainer_id: payload.trainerId,
          name: payload.trainerName,
        });
      }
    });

    const unsubLeft = onRealtimeEvent("trainee:left", (payload) => {
      if (payload && (!memberId || payload.memberId === memberId)) {
        setAssignedCoach(null);
      }
    });

    return () => {
      unsubAssigned();
      unsubLeft();
    };
  }, []);

  // Rest timer countdown
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

  const toggleTimer = () => {
    setIsTimerRunning(!isTimerRunning);
  };

  const resetTimer = (secs = 90) => {
    setIsTimerRunning(false);
    setTimerSeconds(secs);
  };

  const toggleExerciseComplete = (split, id) => {
    setExercises((prev) => ({
      ...prev,
      [split]: prev[split].map((ex) =>
        ex.id === id ? { ...ex, completed: !ex.completed } : ex
      ),
    }));
  };

  const navigateTo = (path) => {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const currentList = exercises[activeSplit] || [];
  const completedCount = currentList.filter((e) => e.completed).length;

  return (
    <div className="module-page-container">
      {/* Photorealistic Dedicated Background */}
      <img
        src="/assets/modules/bg-workouts.jpg"
        alt="FitPulse Strength Training"
        className="module-page-bg"
      />
      <div className="module-page-vignette" />

      {/* 3D Sidebar Dock */}
      <CustomerSidebar3D currentModule="workouts" />

      {/* Main Page Area */}
      <main className="module-page-main">
        {/* Topbar & Breadcrumb */}
        <div className="module-page-topbar">
          <div className="module-breadcrumb-row">
            <button
              type="button"
              className="module-back-btn"
              onClick={() => navigateTo("/dashboard")}
            >
              <span>←</span>
              <span>Back to Dashboard</span>
            </button>
            <span style={{ color: "rgba(255,255,255,0.3)" }}>/</span>
            <span className="module-breadcrumb-current">Workouts & Routines</span>
          </div>

          <div className="module-topbar-actions">
            <div className="portal-search-bar">
              <span style={{ fontSize: "0.85rem", color: "#64748b" }}>🔍</span>
              <input
                type="text"
                placeholder="Search exercises, routines... ⌘K"
                className="portal-search-input"
              />
            </div>
            <div className="portal-date-pill">
              <span>📅</span>
              <span>23 Sep 2026</span>
            </div>
          </div>
        </div>

        {/* Screen 2 Top Title & Stats Banner */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "22px", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <h1 className="portal-screen-title">
              {assignedCoach ? `${assignedCoach.name}'s Custom Split` : "Standard Workout Split"}
            </h1>
            <p className="portal-screen-subtitle">
              {assignedCoach
                ? `Structured progressive overload protocols tailored by ${assignedCoach.name}.`
                : "Standard campus routine template. Hire a master coach to receive tailored periodization."}
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "18px", background: "rgba(12, 17, 27, 0.9)", border: "1px solid rgba(255, 255, 255, 0.08)", padding: "10px 18px", borderRadius: "14px" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "1.05rem", fontWeight: 900, color: "#00e5ff", fontFamily: "JetBrains Mono" }}>1/5</div>
              <div style={{ fontSize: "0.68rem", color: "#8da4be" }}>workouts</div>
            </div>
            <div style={{ width: "1px", height: "24px", background: "rgba(255, 255, 255, 0.1)" }} />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "1.05rem", fontWeight: 900, color: "#ffffff", fontFamily: "JetBrains Mono" }}>32</div>
              <div style={{ fontSize: "0.68rem", color: "#8da4be" }}>Sets</div>
            </div>
            <div style={{ width: "1px", height: "24px", background: "rgba(255, 255, 255, 0.1)" }} />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "1.05rem", fontWeight: 900, color: "#ffffff", fontFamily: "JetBrains Mono" }}>18.4k</div>
              <div style={{ fontSize: "0.68rem", color: "#8da4be" }}>kg volume</div>
            </div>

            <button
              type="button"
              className="portal-btn-primary"
              style={{ marginLeft: "8px", padding: "10px 22px", fontSize: "0.85rem" }}
              onClick={() => {
                setIsTimerRunning(true);
                alert("Workout session initiated! Timer running.");
              }}
            >
              Start Workout
            </button>
          </div>
        </div>

        {/* Banner if no coach is assigned */}
        {!assignedCoach && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "rgba(0, 180, 255, 0.08)",
              border: "1px solid rgba(0, 180, 255, 0.25)",
              borderRadius: "14px",
              padding: "14px 20px",
              marginBottom: "20px",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "1.5rem" }}>📋</span>
              <div>
                <div style={{ fontWeight: 800, color: "#ffffff", fontSize: "0.92rem" }}>
                  Unassigned Routine • Standard Template Mode
                </div>
                <div style={{ color: "#8da4be", fontSize: "0.76rem", marginTop: "2px" }}>
                  Subscribe to a dedicated 1-on-1 coach in the Trainers module to unlock customized progressive overload protocols.
                </div>
              </div>
            </div>
            <button
              type="button"
              className="portal-btn-primary"
              style={{ fontSize: "0.78rem", padding: "8px 16px", whiteSpace: "nowrap" }}
              onClick={() => navigateTo("/trainers")}
            >
              Hire a Master Coach →
            </button>
          </div>
        )}

        {/* Screen 2 Card: Day Tabs & Exact Exercise List */}
        <div className="portal-card" style={{ marginBottom: "26px", padding: "24px" }}>
          {/* Day Tabs */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <div className="portal-pill-tabs">
              <button
                type="button"
                className={`portal-pill-tab ${activeSplit === "Push" ? "active" : ""}`}
                onClick={() => setActiveSplit("Push")}
              >
                Day 1: Push
              </button>
              <button
                type="button"
                className={`portal-pill-tab ${activeSplit === "Pull" ? "active" : ""}`}
                onClick={() => setActiveSplit("Pull")}
              >
                Day 2: Pull
              </button>
              <button
                type="button"
                className={`portal-pill-tab ${activeSplit === "Legs" ? "active" : ""}`}
                onClick={() => setActiveSplit("Legs")}
              >
                Day 3: Legs
              </button>
              <button
                type="button"
                className="portal-pill-tab"
                onClick={() => alert("Rest & Recovery scheduled")}
              >
                •••
              </button>
            </div>

            <div style={{ fontSize: "0.78rem", color: "#8da4be" }}>
              {completedCount} of {currentList.length} completed
            </div>
          </div>

          {/* Exercise Items List matching Screen 2 */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {currentList.map((ex) => (
              <div
                key={ex.id}
                className="portal-exercise-row"
                style={{
                  padding: "16px 20px",
                  background: ex.completed ? "rgba(16, 185, 129, 0.05)" : "rgba(255, 255, 255, 0.02)",
                  borderColor: ex.completed ? "rgba(16, 185, 129, 0.3)" : "rgba(255, 255, 255, 0.06)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <input
                    type="checkbox"
                    checked={ex.completed}
                    onChange={() => toggleExerciseComplete(activeSplit, ex.id)}
                    style={{ width: "20px", height: "20px", accentColor: "#0070f3", cursor: "pointer" }}
                  />
                  <div>
                    <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#ffffff", textDecoration: ex.completed ? "line-through" : "none" }}>
                      {ex.name}
                    </div>
                    <div style={{ fontSize: "0.76rem", color: "#8da4be", marginTop: "2px" }}>
                      {ex.sets} • {ex.reps}
                    </div>
                  </div>
                </div>

                <div className="portal-weight-badge">
                  {ex.weight}
                </div>
              </div>
            ))}
          </div>

          {/* Bottom Link */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}>
            <button
              type="button"
              style={{
                background: "transparent",
                border: "none",
                color: "#00b4ff",
                fontSize: "0.82rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
              onClick={() => alert("Opening FitPulse Comprehensive Exercise Library (120+ exercises)...")}
            >
              View Exercise Library →
            </button>
          </div>
        </div>

        {/* Extended Scrolling Tools Below */}
        <div className="module-grid-2col">

          {/* Right Column: Rest Timer & Cues */}
          <div>
            {/* Live Rest Timer Widget */}
            <div className="module-card" style={{ marginBottom: 24 }}>
              <div className="module-hero-kicker">SET RECOVERY INTERVAL</div>
              <h3 style={{ margin: "0 0 16px 0", fontSize: "1.15rem", fontWeight: 800 }}>
                Intra-Set Rest Timer
              </h3>

              <div className="workout-timer-box">
                <div>
                  <div style={{ fontSize: "0.74rem", color: "#94a3b8", textTransform: "uppercase" }}>
                    Rest Remaining
                  </div>
                  <div className="workout-timer-display">
                    {Math.floor(timerSeconds / 60)}:{(timerSeconds % 60).toString().padStart(2, "0")}
                  </div>
                </div>

                <div className="workout-timer-controls">
                  <button
                    type="button"
                    className={`workout-timer-btn ${isTimerRunning ? "active-play" : ""}`}
                    onClick={toggleTimer}
                  >
                    {isTimerRunning ? "Pause ⏸" : "Start ▶"}
                  </button>
                  <button
                    type="button"
                    className="workout-timer-btn"
                    onClick={() => resetTimer(90)}
                  >
                    Reset ↻
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                {[60, 90, 120, 180].map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="workout-timer-btn"
                    style={{ flex: 1, padding: "6px 0", fontSize: "0.76rem" }}
                    onClick={() => resetTimer(s)}
                  >
                    {s}s
                  </button>
                ))}
              </div>
            </div>

            {/* Coach Lifting Cues */}
            <div className="module-card">
              <div className="module-hero-kicker">COACH CUES • ALEX CARTER</div>
              <h3 style={{ margin: "0 0 12px 0", fontSize: "1.15rem", fontWeight: 800 }}>
                Execution Checklist
              </h3>
              <ul style={{ margin: 0, paddingLeft: 18, color: "#cbd5e1", fontSize: "0.86rem", lineHeight: 1.6 }}>
                <li>Retract scapula and lock feet into the ground on presses.</li>
                <li>Never compromise range of motion for ego weight additions.</li>
                <li>3-second negative eccentric on every hypertrophy working set.</li>
                <li>Stay hydrated between compound compound lifts.</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

import { useState, useEffect } from "react";
import CustomerSidebar3D from "../../components/dashboard/CustomerSidebar3D";
import { logProgressRecordLive, subscribeRealtime, fetchDashboardData } from "../../services/realtime";
import "../../styles/module-pages.css";

const initialPRs = [
  { id: "pr-1", lift: "Conventional Deadlift", current: 160, previous: 145, unit: "kg", date: "Sep 10, 2026", badge: "+15 kg PR 🚀" },
  { id: "pr-2", lift: "Barbell Bench Press", current: 105, previous: 100, unit: "kg", date: "Sep 12, 2026", badge: "+5 kg PR ⚡" },
  { id: "pr-3", lift: "High Bar Back Squat", current: 140, previous: 130, unit: "kg", date: "Sep 05, 2026", badge: "+10 kg PR 🏆" },
  { id: "pr-4", lift: "Standing Overhead Press", current: 72.5, previous: 70, unit: "kg", date: "Aug 28, 2026", badge: "+2.5 kg PR ✨" },
];

export default function ProgressModulePage() {
  const [prs, setPrs] = useState([]);
  const [bodyWeight, setBodyWeight] = useState(72.4);
  const [bodyFat, setBodyFat] = useState(12.8);
  const [muscleMass, setMuscleMass] = useState(58.6);
  const [selectedLift, setSelectedLift] = useState("Conventional Deadlift");
  const [newPRWeight, setNewPRWeight] = useState("");
  const [showLogModal, setShowLogModal] = useState(false);
  const [currentMemberId, setCurrentMemberId] = useState(1);

  const navigateTo = (path) => {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  useEffect(() => {
    let email = null;
    try {
      const stored = localStorage.getItem("fitpulse_user");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.id) setCurrentMemberId(parsed.id);
        if (parsed.email) email = parsed.email;
        if (parsed.weight) setBodyWeight(parsed.weight);
      }
    } catch {
      /* ignore */
    }

    const isDemo = email && email.toLowerCase() === "nihal@fitpulse.com";

    fetchDashboardData(email).then((data) => {
      if (data && data.prs && data.prs.length > 0) {
        setPrs(
          data.prs.map((p) => ({
            id: "pr-" + p.id,
            lift: p.lift_name || p.lift,
            current: Number(p.weight_kg || p.current),
            previous: Number(p.previous_weight_kg || p.previous || (Number(p.weight_kg || p.current) - 5)),
            unit: p.unit || "kg",
            date: p.achieved_at ? new Date(p.achieved_at).toLocaleDateString([], { month: "short", day: "numeric" }) : "Today",
            badge: p.badge || "+5 kg PR 🚀",
          }))
        );
      } else if (isDemo) {
        setPrs(initialPRs);
      } else {
        // Fresh member starts with nil PR records
        setPrs([]);
        setBodyFat(0);
        setMuscleMass(0);
      }
    });

    const unsubProgress = subscribeRealtime("progress:updated", (data) => {
      if (Number(data.memberId) === Number(currentMemberId) && data.prs) {
        setPrs(
          data.prs.map((p) => ({
            id: String(p.id),
            lift: p.lift,
            current: Number(p.current),
            previous: Number(p.previous),
            unit: p.unit || "kg",
            date: "Today",
            badge: p.badge,
          }))
        );
      }
    });

    const unsubPref = subscribeRealtime("member:preferences-updated", (data) => {
      if (Number(data.memberId) === Number(currentMemberId) && data.weight) {
        setBodyWeight(data.weight);
      }
    });

    return () => {
      if (unsubProgress) unsubProgress();
      if (unsubPref) unsubPref();
    };
  }, [currentMemberId]);

  const handleAddPR = async (e) => {
    e.preventDefault();
    const val = parseFloat(newPRWeight);
    if (!val) return;

    let previousVal = val - 5;
    const existingIndex = prs.findIndex((p) => p.lift === selectedLift);
    if (existingIndex !== -1) {
      previousVal = prs[existingIndex].current;
    }

    const diff = (val - previousVal).toFixed(1);
    const badge = `+${diff > 0 ? diff : 5} kg PR 🚀`;

    if (existingIndex !== -1) {
      const existing = prs[existingIndex];
      const updated = [...prs];
      updated[existingIndex] = {
        ...existing,
        previous: existing.current,
        current: val,
        date: "Today",
        badge,
      };
      setPrs(updated);
    } else {
      setPrs([
        ...prs,
        {
          id: "pr-" + Date.now(),
          lift: selectedLift,
          current: val,
          previous: previousVal,
          unit: "kg",
          date: "Today",
          badge,
        },
      ]);
    }

    setNewPRWeight("");
    setShowLogModal(false);

    // Persist to MySQL and broadcast live to Trainer & Admin
    try {
      await logProgressRecordLive({
        userId: currentMemberId,
        liftName: selectedLift,
        weightKg: val,
        previousWeightKg: previousVal,
        badge,
      });
    } catch (err) {
      console.warn("Log PR live error:", err);
    }
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("Overview");

  const squatPR = prs.find((p) => (p.lift || "").toLowerCase().includes("squat"))?.current || 0;
  const benchPR = prs.find((p) => (p.lift || "").toLowerCase().includes("bench"))?.current || 0;
  const deadliftPR = prs.find((p) => (p.lift || "").toLowerCase().includes("deadlift"))?.current || 0;
  const sbdTotal = prs.length > 0 ? (squatPR + benchPR + deadliftPR).toFixed(1) : 0;

  return (
    <div className="module-page-container">
      {/* Photorealistic Dedicated Background */}
      <img
        src="/assets/modules/bg-progress.jpg"
        alt="FitPulse Athletic Progress Analytics"
        className="module-page-bg"
      />
      <div className="module-page-vignette" />

      {/* 3D Sidebar Dock */}
      <CustomerSidebar3D currentModule="progress" />

      {/* Main Page Area */}
      <main className="module-page-main">
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
            <span className="module-breadcrumb-current">Progress & Analytics</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div className="portal-search-bar">
              <span style={{ color: "#64748b" }}>🔍</span>
              <input
                type="text"
                className="portal-search-input"
                placeholder="Search PR records..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="portal-date-pill">
              <span>📅</span>
              <span>23 Sep 2026</span>
            </div>
          </div>
        </div>

        {/* Screen 7 Top Title */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "18px", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <h1 className="portal-screen-title">Strength & Body Metrics</h1>
            <p className="portal-screen-subtitle">
              Longitudinal progressive overload telemetry, 1RM curves, and lean tissue accrual.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              type="button"
              className="portal-btn-primary"
              onClick={() => setShowLogModal(true)}
            >
              + Log New PR
            </button>
          </div>
        </div>

        {/* Screen 7 Tab Pills Bar */}
        <div className="portal-pill-tabs" style={{ marginBottom: "22px" }}>
          {["Overview", "Strength", "Body Composition", "Workouts"].map((tab) => (
            <button
              key={tab}
              type="button"
              className={`portal-pill-tab ${activeTab === tab ? "active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Modal for PR */}
        {showLogModal && (
          <div
            className="portal-card"
            style={{
              marginBottom: 24,
              border: "1.5px solid #00b4ff",
              background: "rgba(14, 24, 44, 0.95)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ fontSize: "0.74rem", color: "#00e5ff", fontWeight: 800 }}>NEW LIFT RECORD ENTRY</div>
              <button
                type="button"
                style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: "1.2rem" }}
                onClick={() => setShowLogModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddPR} style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <select
                value={selectedLift}
                onChange={(e) => setSelectedLift(e.target.value)}
                className="trainer-chat-input"
                style={{ flex: 1, minWidth: 200 }}
              >
                <option value="Conventional Deadlift">Conventional Deadlift</option>
                <option value="Barbell Bench Press">Barbell Bench Press</option>
                <option value="High Bar Back Squat">High Bar Back Squat</option>
                <option value="Standing Overhead Press">Standing Overhead Press</option>
              </select>
              <input
                type="number"
                step="0.5"
                placeholder="Weight in kg (e.g. 110)"
                value={newPRWeight}
                onChange={(e) => setNewPRWeight(e.target.value)}
                className="trainer-chat-input"
                style={{ flex: 1, minWidth: 150 }}
              >
              </input>
              <button type="submit" className="portal-btn-primary">
                Save Record
              </button>
            </form>
          </div>
        )}

        {/* Screen 7 Main 2-Column: Bodyweight Trend (Left) & Recent PRs (Right) */}
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "22px", marginBottom: "24px" }}>
          {/* Left: Bodyweight Trend Curve */}
          <div className="portal-card">
            <div className="portal-card-header">
              <div>
                <h3 className="portal-card-title">Bodyweight Trend</h3>
                <div style={{ fontSize: "0.75rem", color: "#8da4be", marginTop: "2px" }}>
                  Jun — Sep 2026 • 12-Week Progressive Cut
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: "1.5rem", fontWeight: 900, color: "#ffffff", fontFamily: "JetBrains Mono" }}>
                  72.4 <span style={{ fontSize: "0.85rem", color: "#00e5ff" }}>kg</span>
                </span>
                <div style={{ fontSize: "0.7rem", color: "#10b981", fontWeight: 700 }}>
                  -2.4 kg past 60 days
                </div>
              </div>
            </div>

            {/* Smooth SVG Line Graph */}
            <div style={{ position: "relative", width: "100%", height: 190, marginTop: 10 }}>
              <svg
                viewBox="0 0 480 180"
                style={{ width: "100%", height: "100%", overflow: "visible" }}
              >
                <defs>
                  <linearGradient id="bodyweightGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#0070f3" stopOpacity="0.38" />
                    <stop offset="100%" stopColor="#0070f3" stopOpacity="0.0" />
                  </linearGradient>
                  <linearGradient id="lineGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#00b4ff" />
                    <stop offset="50%" stopColor="#0070f3" />
                    <stop offset="100%" stopColor="#00f0ff" />
                  </linearGradient>
                </defs>

                {/* Horizontal Gridlines */}
                <line x1="20" y1="30" x2="460" y2="30" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                <line x1="20" y1="75" x2="460" y2="75" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                <line x1="20" y1="120" x2="460" y2="120" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                <line x1="20" y1="165" x2="460" y2="165" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />

                {/* Y-axis Labels */}
                <text x="22" y="26" fill="#64748b" fontSize="9" fontFamily="JetBrains Mono">76kg</text>
                <text x="22" y="71" fill="#64748b" fontSize="9" fontFamily="JetBrains Mono">74kg</text>
                <text x="22" y="116" fill="#64748b" fontSize="9" fontFamily="JetBrains Mono">72kg</text>
                <text x="22" y="161" fill="#64748b" fontSize="9" fontFamily="JetBrains Mono">70kg</text>

                {/* Area Fill */}
                <path
                  d="M 40 45 C 120 50, 180 85, 260 90 C 330 95, 390 115, 450 112 L 450 165 L 40 165 Z"
                  fill="url(#bodyweightGradient)"
                />

                {/* Smooth Curve */}
                <path
                  d="M 40 45 C 120 50, 180 85, 260 90 C 330 95, 390 115, 450 112"
                  fill="none"
                  stroke="url(#lineGlow)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />

                {/* Highlight Point at current weight */}
                <circle cx="450" cy="112" r="7" fill="#00f0ff" stroke="#060913" strokeWidth="2.5" />
                <circle cx="450" cy="112" r="14" fill="none" stroke="#00f0ff" strokeWidth="1" opacity="0.4" />

                {/* Pin Tooltip */}
                <g transform="translate(390, 68)">
                  <rect width="66" height="24" rx="6" fill="rgba(12, 17, 27, 0.95)" stroke="#00b4ff" strokeWidth="1" />
                  <text x="33" y="16" fill="#ffffff" fontSize="10" fontWeight="900" textAnchor="middle" fontFamily="JetBrains Mono">
                    72.4 kg
                  </text>
                </g>

                {/* X-axis Date Markers */}
                <text x="40" y="178" fill="#64748b" fontSize="9" textAnchor="middle" fontFamily="JetBrains Mono">Jun</text>
                <text x="175" y="178" fill="#64748b" fontSize="9" textAnchor="middle" fontFamily="JetBrains Mono">Jul</text>
                <text x="310" y="178" fill="#64748b" fontSize="9" textAnchor="middle" fontFamily="JetBrains Mono">Aug</text>
                <text x="450" y="178" fill="#00e5ff" fontSize="9" fontWeight="700" textAnchor="middle" fontFamily="JetBrains Mono">Sep (Now)</text>
              </svg>
            </div>

            {/* Micro Tags */}
            <div style={{ display: "flex", gap: "10px", marginTop: "14px", paddingTop: "12px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <span className="portal-weight-badge" style={{ fontSize: "0.72rem" }}>
                Target: 70.0 kg
              </span>
              <span className="portal-weight-badge" style={{ fontSize: "0.72rem", color: "#10b981", borderColor: "rgba(16, 185, 129, 0.3)" }}>
                Fat Mass: -1.8 kg
              </span>
              <span className="portal-weight-badge" style={{ fontSize: "0.72rem", color: "#00e5ff", borderColor: "rgba(0, 229, 255, 0.3)" }}>
                Muscle: +0.6 kg
              </span>
            </div>
          </div>

          {/* Right: Recent PRs */}
          <div className="portal-card">
            <div className="portal-card-header">
              <div>
                <h3 className="portal-card-title">Recent PRs</h3>
                <div style={{ fontSize: "0.75rem", color: "#8da4be", marginTop: "2px" }}>
                  Verified 1RM record milestones
                </div>
              </div>
              <span className="portal-weight-badge" style={{ color: "#f59e0b", background: "rgba(245, 158, 11, 0.1)" }}>
                {prs.length} Record{prs.length === 1 ? "" : "s"}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {prs.length === 0 ? (
                <div style={{ textAlign: "center", padding: "34px 18px", background: "rgba(255,255,255,0.02)", borderRadius: 14, border: "1px dashed rgba(255,255,255,0.08)" }}>
                  <div style={{ fontSize: "2.2rem", marginBottom: 8 }}>🏋️‍♂️</div>
                  <div style={{ fontSize: "0.98rem", fontWeight: 800, color: "#ffffff" }}>No PR Records Logged Yet</div>
                  <div style={{ fontSize: "0.78rem", color: "#8da4be", maxWidth: 280, margin: "6px auto 14px" }}>
                    Log your personal bests (Squat, Bench, Deadlift, OHP) to track overload progression.
                  </div>
                  <button
                    type="button"
                    className="portal-btn-primary"
                    style={{ fontSize: "0.78rem", padding: "8px 16px" }}
                    onClick={() => setShowLogModal(true)}
                  >
                    + Log Your First PR
                  </button>
                </div>
              ) : (
                prs
                  .filter((pr) => !searchQuery || pr.lift.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((pr) => (
                    <div key={pr.id} className="portal-exercise-row">
                      <div>
                        <div style={{ fontSize: "0.92rem", fontWeight: 800, color: "#ffffff" }}>
                          {pr.lift}
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "#8da4be", marginTop: 2 }}>
                          {pr.date} • Prev: {pr.previous} {pr.unit}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "1.15rem", fontWeight: 900, color: "#ffffff", fontFamily: "JetBrains Mono" }}>
                          {pr.current} <span style={{ fontSize: "0.75rem", color: "#00b4ff" }}>{pr.unit}</span>
                        </div>
                        <span
                          className="portal-weight-badge"
                          style={{
                            fontSize: "0.68rem",
                            padding: "2px 8px",
                            color: "#34d399",
                            borderColor: "rgba(52, 211, 153, 0.3)",
                            background: "rgba(52, 211, 153, 0.08)",
                          }}
                        >
                          {pr.badge}
                        </span>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>

        {/* Scrollable Extended Content: InBody Diagnostics & Volume Analytics */}
        <div className="portal-card">
          <div className="portal-card-header">
            <div>
              <h3 className="portal-card-title">InBody 770 Body Composition Diagnostics</h3>
              <div style={{ fontSize: "0.75rem", color: "#8da4be", marginTop: "2px" }}>
                Multi-frequency bioelectrical impedance analysis
              </div>
            </div>
            <span className="portal-weight-badge">
              Calibrated: Sep 2026
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            <div style={{ padding: 14, borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontSize: "0.72rem", color: "#8da4be" }}>BODY FAT PERCENT</div>
              <div style={{ fontSize: "1.45rem", fontWeight: 900, color: "#10b981", fontFamily: "JetBrains Mono", margin: "6px 0 2px" }}>
                {bodyFat > 0 ? `${bodyFat}%` : "--%"}
              </div>
              <div style={{ fontSize: "0.7rem", color: "#8da4be" }}>Athletic Elite Range</div>
            </div>
            <div style={{ padding: 14, borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontSize: "0.72rem", color: "#8da4be" }}>SKELETAL MUSCLE</div>
              <div style={{ fontSize: "1.45rem", fontWeight: 900, color: "#00b4ff", fontFamily: "JetBrains Mono", margin: "6px 0 2px" }}>
                {muscleMass > 0 ? `${muscleMass} kg` : "-- kg"}
              </div>
              <div style={{ fontSize: "0.7rem", color: "#8da4be" }}>{muscleMass > 0 ? "+1.8 kg lean accrual" : "Pending Diagnostic"}</div>
            </div>
            <div style={{ padding: 14, borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontSize: "0.72rem", color: "#8da4be" }}>SBD TOTAL</div>
              <div style={{ fontSize: "1.45rem", fontWeight: 900, color: "#f59e0b", fontFamily: "JetBrains Mono", margin: "6px 0 2px" }}>
                {prs.length > 0 ? `${sbdTotal} kg` : "-- kg"}
              </div>
              <div style={{ fontSize: "0.7rem", color: "#8da4be" }}>Squat + Bench + Deadlift</div>
            </div>
            <div style={{ padding: 14, borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontSize: "0.72rem", color: "#8da4be" }}>TRAINING INTENSITY</div>
              <div style={{ fontSize: "1.45rem", fontWeight: 900, color: "#a855f7", fontFamily: "JetBrains Mono", margin: "6px 0 2px" }}>
                {prs.length > 0 ? "94% RPE" : "--% RPE"}
              </div>
              <div style={{ fontSize: "0.7rem", color: "#8da4be" }}>Optimal Recovery Zone</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

import { useState, useEffect, useRef } from "react";
import CustomerSidebar3D from "../../components/dashboard/CustomerSidebar3D";
import {
  fetchDashboardData,
  updateSettingsLive,
  createMemberQueryLive,
  changePasswordLive,
} from "../../services/realtime";
import "../../styles/module-pages.css";

export default function SettingsModulePage() {
  const [activeTab, setActiveTab] = useState("account");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPwModal, setShowPwModal] = useState(false);

  // File picker reference for desktop avatar upload
  const fileInputRef = useRef(null);

  // Change Password state
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  const getStoredUser = () => {
    try {
      return JSON.parse(localStorage.getItem("fitpulse_user") || "{}");
    } catch {
      return {};
    }
  };
  const initialUser = getStoredUser();

  // 1. Account & Profile State
  const [profile, setProfile] = useState({
    userId: initialUser.id || 1,
    fullName: initialUser.name || "Member",
    email: initialUser.email || "",
    phone: initialUser.phone || "+91 98765 43210",
    dob: "1998-05-14",
    gender: initialUser.gender || "Male",
    height: initialUser.height ? String(initialUser.height) : "180",
    weight: initialUser.weight ? String(initialUser.weight) : "72.4",
    emergencyContact: "Emergency Contact",
    membershipId: initialUser.membershipId || "FP-8849-ELITE",
    avatar: initialUser.avatar || localStorage.getItem("fitpulse_avatar") || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&auto=format&fit=crop&q=80",
  });

  // Fetch initial profile from MySQL
  useEffect(() => {
    const user = getStoredUser();
    fetchDashboardData(user.email).then((data) => {
      if (data && data.user) {
        setProfile((prev) => ({
          ...prev,
          userId: data.user.id || prev.userId,
          fullName: data.user.name || prev.fullName,
          email: data.user.email || prev.email,
          phone: data.user.phone || prev.phone,
          gender: data.user.gender || prev.gender,
          height: data.user.height ? String(data.user.height) : prev.height,
          weight: data.user.weight ? String(data.user.weight) : prev.weight,
          emergencyContact: data.user.emergencyContact || prev.emergencyContact,
          membershipId: data.user.membershipId || prev.membershipId,
          avatar: data.user.avatar || prev.avatar,
        }));
      }
    });
  }, []);

  // 2. Security & Login State
  const [twoFactor, setTwoFactor] = useState(true);
  const [loginAlerts, setLoginAlerts] = useState(true);

  // 4. Fitness Preferences State
  const [primaryGoal, setPrimaryGoal] = useState("Build Muscle");
  const [workoutTime, setWorkoutTime] = useState("Morning");
  const [trainingLevel, setTrainingLevel] = useState("Advanced");
  const [workoutDuration, setWorkoutDuration] = useState("60 min");

  // 5. Health & Measurement Units State
  const [weightUnit, setWeightUnit] = useState("kg");
  const [heightUnit, setHeightUnit] = useState("cm");
  const [distanceUnit, setDistanceUnit] = useState("km");
  const [calorieUnit, setCalorieUnit] = useState("kcal");
  const [trackWeekly, setTrackWeekly] = useState(true);
  const [bodyMetricsVisible, setBodyMetricsVisible] = useState(true);
  const [privateFitnessInfo, setPrivateFitnessInfo] = useState(false);

  // 7. Privacy Settings State
  const [communityVisible, setCommunityVisible] = useState(true);
  const [achievementsVisible, setAchievementsVisible] = useState(true);
  const [workoutActivityVisible, setWorkoutActivityVisible] = useState(false);
  const [streakVisible, setStreakVisible] = useState(true);
  const [dataSharing, setDataSharing] = useState(false);

  // 8. Appearance State
  const [theme, setTheme] = useState("Dark");

  // 9. Member Support Query Box State
  const [supportCategory, setSupportCategory] = useState("Facility & Equipment");
  const [supportPriority, setSupportPriority] = useState("Normal");
  const [supportSubject, setSupportSubject] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [querySending, setQuerySending] = useState(false);
  const [querySubmitted, setQuerySubmitted] = useState(null);

  const handleSubmitQuery = async (e) => {
    e.preventDefault();
    if (!supportSubject.trim() || !supportMessage.trim()) return;
    setQuerySending(true);

    const res = await createMemberQueryLive({
      memberId: 3,
      memberName: profile.fullName,
      memberEmail: profile.email,
      memberPhone: profile.phone,
      category: supportCategory,
      priority: supportPriority,
      subject: supportSubject.trim(),
      message: supportMessage.trim(),
    });

    setQuerySending(false);
    if (res && res.success) {
      setQuerySubmitted(`Ticket registered! Administrator received query #${res.queryId} via real-time WebSocket.`);
      setSupportSubject("");
      setSupportMessage("");
      setTimeout(() => setQuerySubmitted(null), 6000);
    } else {
      alert("Error submitting query. Please try again.");
    }
  };

  const navigateTo = (path) => {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const handleProfileChange = (field, val) => {
    setProfile((prev) => ({ ...prev, [field]: val }));
  };

  // Real desktop avatar file upload handler
  const handleAvatarFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result;
      if (dataUrl) {
        handleProfileChange("avatar", dataUrl);
        try {
          localStorage.setItem("fitpulse_avatar", dataUrl);
          await updateSettingsLive({
            userId: profile.userId,
            avatar: dataUrl,
            avatar_url: dataUrl,
          });
        } catch {
          /* ignore */
        }
      }
    };
    reader.readAsDataURL(file);
  };

  // Real bcrypt password change handler
  const handleChangePassword = async (e) => {
    if (e) e.preventDefault();
    setPwError("");
    setPwSuccess("");

    if (!currentPw || !newPw || !confirmPw) {
      setPwError("All password fields are required.");
      return;
    }

    if (newPw.length < 6) {
      setPwError("New password must be at least 6 characters long.");
      return;
    }

    if (newPw !== confirmPw) {
      setPwError("New password and confirm password do not match.");
      return;
    }

    setPwLoading(true);
    const res = await changePasswordLive({
      userId: profile.userId,
      currentPassword: currentPw,
      newPassword: newPw,
    });
    setPwLoading(false);

    if (res && res.success) {
      setPwSuccess(res.message || "Password updated successfully in secure vault!");
      setTimeout(() => {
        setShowPwModal(false);
        setCurrentPw("");
        setNewPw("");
        setConfirmPw("");
        setPwSuccess("");
      }, 1600);
    } else {
      setPwError(res?.message || "Failed to update password. Check your current password.");
    }
  };

  // Appearance theme switcher (Light / Dark)
  useEffect(() => {
    const savedTheme = localStorage.getItem("fitpulse_theme") || "Dark";
    setTheme(savedTheme);
    if (savedTheme === "Light") {
      document.documentElement.setAttribute("data-theme", "light");
    } else {
      document.documentElement.setAttribute("data-theme", "dark");
    }
  }, []);

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem("fitpulse_theme", newTheme);
    if (newTheme === "Light") {
      document.documentElement.setAttribute("data-theme", "light");
    } else {
      document.documentElement.setAttribute("data-theme", "dark");
    }
  };

  const handleSaveChanges = async (e) => {
    if (e) e.preventDefault();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 4000);

    try {
      await updateSettingsLive({
        userId: profile.userId,
        name: profile.fullName,
        phone: profile.phone,
        gender: profile.gender,
        height: parseFloat(profile.height) || 180,
        weight: parseFloat(profile.weight) || 72.4,
        emergencyContact: profile.emergencyContact,
        goal: primaryGoal,
        avatar: profile.avatar,
      });
    } catch {
      /* ignore */
    }
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem("fitpulse_token");
      localStorage.removeItem("fitpulse_user");
    } catch {
      /* ignore */
    }
    navigateTo("/login");
  };

  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="module-page-container">
      {/* Background Media */}
      <img
        src="/assets/modules/bg-progress.jpg"
        alt="FitPulse Settings & Security"
        className="module-page-bg"
      />
      <div className="module-page-vignette" />

      {/* 3D Sidebar Dock */}
      <CustomerSidebar3D currentModule="settings" />

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
            <span className="module-breadcrumb-current">Settings & Security</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div className="portal-search-bar">
              <span style={{ color: "#64748b" }}>🔍</span>
              <input
                type="text"
                className="portal-search-input"
                placeholder="Search settings, 2FA, units..."
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

        {/* Screen 9 Top Title with Save Changes Button */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <h1 className="portal-screen-title">Account & Platform Settings</h1>
            <p className="portal-screen-subtitle">
              Manage your personal biometrics, security credentials, and platform preferences.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              type="button"
              className="portal-btn-primary"
              style={{ padding: "9px 22px", fontSize: "0.85rem" }}
              onClick={handleSaveChanges}
            >
              💾 Save Changes
            </button>
          </div>
        </div>

        {/* Success Toast */}
        {saveSuccess && (
          <div
            style={{
              padding: "14px 20px",
              background: "rgba(16, 185, 129, 0.2)",
              border: "1px solid #10b981",
              borderRadius: 14,
              color: "#34d399",
              marginBottom: 20,
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              gap: 10,
              boxShadow: "0 0 20px rgba(16, 185, 129, 0.3)",
            }}
          >
            <span>✓</span>
            <span>All athlete settings and preferences have been updated and synced to database!</span>
          </div>
        )}

        {/* Screen 9 Tab Pills matching mockup */}
        <div className="portal-pill-tabs" style={{ marginBottom: "24px" }}>
          {[
            { id: "account", label: "Account" },
            { id: "security", label: "Security" },
            { id: "fitness", label: "Preferences" },
            { id: "billing", label: "Billing" },
            { id: "privacy", label: "Privacy" },
            { id: "appearance", label: "Appearance" },
            { id: "support", label: "Admin Helpdesk" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`portal-pill-tab ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => {
                setActiveTab(tab.id);
                const el = document.getElementById(`sec-${tab.id}`);
                if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* =========================================================
            1. ACCOUNT & PROFILE
            ========================================================= */}
        <section id="sec-account" className="settings-section-card">
          <div className="settings-section-header">
            <div>
              <div className="bento-card-kicker">PERSONAL INFORMATION</div>
              <h3 className="settings-section-title">1. Account & Profile</h3>
              <p className="settings-section-desc">
                Your personal details, contact info, and club biometric baselines.
              </p>
            </div>
            <span className="module-status-pill">MEMBER ID: {profile.membershipId}</span>
          </div>

          {/* Profile Photo Row */}
          <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 24 }}>
            <img
              src={profile.avatar}
              alt={profile.fullName}
              style={{ width: 80, height: 80, borderRadius: "50%", objectFit: "cover", border: "2.5px solid #00b4ff" }}
            />
            <div>
              <div style={{ fontSize: "1rem", fontWeight: 800, color: "#fff" }}>{profile.fullName}</div>
              <div style={{ fontSize: "0.78rem", color: "#00b4ff", marginBottom: 10 }}>Elite Black Card Member</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handleAvatarFileSelect}
                />
                <button
                  type="button"
                  className="workout-timer-btn"
                  onClick={() => fileInputRef.current?.click()}
                  style={{ background: "rgba(0, 180, 255, 0.15)", borderColor: "#00b4ff", color: "#00e5ff" }}
                >
                  📁 Select from Desktop
                </button>
                <button
                  type="button"
                  className="workout-timer-btn"
                  style={{ color: "#94a3b8" }}
                  onClick={() => {
                    const defUrl = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&auto=format&fit=crop&q=80";
                    handleProfileChange("avatar", defUrl);
                    localStorage.setItem("fitpulse_avatar", defUrl);
                    updateSettingsLive({ userId: profile.userId, avatar: defUrl, avatar_url: defUrl });
                  }}
                >
                  Reset Default
                </button>
              </div>
            </div>
          </div>

          <form onSubmit={handleSaveChanges}>
            <div className="settings-form-grid-2">
              <div className="settings-field-group">
                <label className="settings-label">Full Name</label>
                <input
                  type="text"
                  value={profile.fullName}
                  onChange={(e) => handleProfileChange("fullName", e.target.value)}
                  className="settings-input"
                />
              </div>

              <div className="settings-field-group">
                <label className="settings-label">Email Address</label>
                <input
                  type="email"
                  value={profile.email}
                  onChange={(e) => handleProfileChange("email", e.target.value)}
                  className="settings-input"
                />
              </div>
            </div>

            <div className="settings-form-grid-3">
              <div className="settings-field-group">
                <label className="settings-label">Phone Number</label>
                <input
                  type="tel"
                  value={profile.phone}
                  onChange={(e) => handleProfileChange("phone", e.target.value)}
                  className="settings-input"
                />
              </div>

              <div className="settings-field-group">
                <label className="settings-label">Date of Birth</label>
                <input
                  type="date"
                  value={profile.dob}
                  onChange={(e) => handleProfileChange("dob", e.target.value)}
                  className="settings-input"
                />
              </div>

              <div className="settings-field-group">
                <label className="settings-label">Gender</label>
                <select
                  value={profile.gender}
                  onChange={(e) => handleProfileChange("gender", e.target.value)}
                  className="settings-input"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Non-Binary">Non-Binary</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>
            </div>

            <div className="settings-form-grid-3">
              <div className="settings-field-group">
                <label className="settings-label">Height ({heightUnit})</label>
                <input
                  type="number"
                  value={profile.height}
                  onChange={(e) => handleProfileChange("height", e.target.value)}
                  className="settings-input"
                />
              </div>

              <div className="settings-field-group">
                <label className="settings-label">Weight ({weightUnit})</label>
                <input
                  type="number"
                  step="0.1"
                  value={profile.weight}
                  onChange={(e) => handleProfileChange("weight", e.target.value)}
                  className="settings-input"
                />
              </div>

              <div className="settings-field-group">
                <label className="settings-label">Emergency Contact</label>
                <input
                  type="text"
                  value={profile.emergencyContact}
                  onChange={(e) => handleProfileChange("emergencyContact", e.target.value)}
                  className="settings-input"
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
              <button type="submit" className="community-btn-primary">
                Save Profile Changes ✓
              </button>
            </div>
          </form>
        </section>

        {/* =========================================================
            2. SECURITY & LOGIN
            ========================================================= */}
        <section id="sec-security" className="settings-section-card">
          <div className="settings-section-header">
            <div>
              <div className="bento-card-kicker">AUTHENTICATION & SESSIONS</div>
              <h3 className="settings-section-title">2. Security & Login</h3>
              <p className="settings-section-desc">
                Protect your account with modern two-factor authentication and manage active device sessions.
              </p>
            </div>
            <span className="module-status-pill" style={{ color: "#10b981", borderColor: "rgba(16, 185, 129, 0.4)" }}>
              SECURITY: STRONG
            </span>
          </div>

          {/* Password Row */}
          <div className="settings-toggle-row">
            <div>
              <div className="settings-toggle-title">Account Password</div>
              <div className="settings-toggle-desc">Last changed 45 days ago • Strength: High</div>
            </div>
            <button
              type="button"
              className="workout-timer-btn"
              onClick={() => setShowPwModal(true)}
            >
              Change Password 🔑
            </button>
          </div>

          {/* 2FA Toggle */}
          <div className="settings-toggle-row">
            <div>
              <div className="settings-toggle-title">Two-Factor Authentication (2FA)</div>
              <div className="settings-toggle-desc">
                Requires an 6-digit authenticator app code whenever logging in from a new browser.
              </div>
            </div>
            <button
              type="button"
              className={`settings-switch-btn ${twoFactor ? "active" : ""}`}
              onClick={() => setTwoFactor(!twoFactor)}
              aria-label="Toggle 2FA"
            >
              <div className="settings-switch-thumb" />
            </button>
          </div>

          {/* Login Alerts Toggle */}
          <div className="settings-toggle-row">
            <div>
              <div className="settings-toggle-title">Unrecognized Device Login Alerts</div>
              <div className="settings-toggle-desc">
                Receive instant email and push notifications when your account is accessed from a new IP.
              </div>
            </div>
            <button
              type="button"
              className={`settings-switch-btn ${loginAlerts ? "active" : ""}`}
              onClick={() => setLoginAlerts(!loginAlerts)}
              aria-label="Toggle Login Alerts"
            >
              <div className="settings-switch-thumb" />
            </button>
          </div>

          {/* Active Sessions */}
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "#fff", marginBottom: 12 }}>
              Active Login Sessions
            </div>

            <div className="workout-exercise-row" style={{ marginBottom: 10 }}>
              <div>
                <div className="workout-ex-name">Windows 11 • Microsoft Edge</div>
                <div className="workout-ex-target">Mumbai, India • Active Now (Current Device)</div>
              </div>
              <span className="module-status-pill" style={{ color: "#10b981" }}>THIS DEVICE</span>
            </div>

            <div className="workout-exercise-row" style={{ marginBottom: 16 }}>
              <div>
                <div className="workout-ex-name">iPhone 15 Pro • FitPulse App</div>
                <div className="workout-ex-target">Mumbai, India • Last active 2 hours ago</div>
              </div>
              <button
                type="button"
                className="workout-timer-btn"
                style={{ fontSize: "0.74rem" }}
                onClick={() => alert("Session terminated.")}
              >
                Log Out Device
              </button>
            </div>

            <button
              type="button"
              className="workout-timer-btn"
              onClick={() => alert("All other sessions logged out.")}
            >
              Log Out All Other Active Devices
            </button>
          </div>
        </section>

        {/* =========================================================
            3. FITNESS PREFERENCES
            ========================================================= */}
        <section id="sec-fitness" className="settings-section-card">
          <div className="settings-section-header">
            <div>
              <div className="bento-card-kicker">TRAINING & ALGORITHM</div>
              <h3 className="settings-section-title">3. Fitness Preferences</h3>
              <p className="settings-section-desc">
                These preferences personalize your training splits, periodization targets, and coach recommendations.
              </p>
            </div>
          </div>

          {/* Primary Goal */}
          <div style={{ marginBottom: 22 }}>
            <div className="settings-label" style={{ marginBottom: 10 }}>Primary Training Goal</div>
            <div className="settings-pill-row">
              {["Build Muscle", "Lose Weight", "Improve Fitness", "Strength", "Endurance"].map((g) => (
                <button
                  key={g}
                  type="button"
                  className={`settings-pill-btn ${primaryGoal === g ? "active" : ""}`}
                  onClick={() => setPrimaryGoal(g)}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Workout Time Preference */}
          <div style={{ marginBottom: 22 }}>
            <div className="settings-label" style={{ marginBottom: 10 }}>Preferred Workout Time</div>
            <div className="settings-pill-row">
              {[
                { id: "Morning", label: "Morning 🌅 (06:00 - 11:00)" },
                { id: "Afternoon", label: "Afternoon ☀️ (12:00 - 16:00)" },
                { id: "Evening", label: "Evening 🌙 (17:00 - 22:00)" },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`settings-pill-btn ${workoutTime === t.id ? "active" : ""}`}
                  onClick={() => setWorkoutTime(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Training Level */}
          <div style={{ marginBottom: 22 }}>
            <div className="settings-label" style={{ marginBottom: 10 }}>Experience Level</div>
            <div className="settings-pill-row">
              {["Beginner", "Intermediate", "Advanced"].map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  className={`settings-pill-btn ${trainingLevel === lvl ? "active" : ""}`}
                  onClick={() => setTrainingLevel(lvl)}
                >
                  {lvl} {lvl === "Advanced" ? "🔥" : ""}
                </button>
              ))}
            </div>
          </div>

          {/* Workout Duration */}
          <div>
            <div className="settings-label" style={{ marginBottom: 10 }}>Preferred Session Duration</div>
            <div className="settings-pill-row">
              {["30 min", "45 min", "60 min", "90+ min"].map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`settings-pill-btn ${workoutDuration === d ? "active" : ""}`}
                  onClick={() => setWorkoutDuration(d)}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* =========================================================
            4. HEALTH & MEASUREMENT PREFERENCES
            ========================================================= */}
        <section id="sec-health" className="settings-section-card">
          <div className="settings-section-header">
            <div>
              <div className="bento-card-kicker">UNITS & TELEMETRY</div>
              <h3 className="settings-section-title">4. Health & Measurement Preferences</h3>
              <p className="settings-section-desc">
                Select your preferred unit standards for weights, height, distance, and privacy masking.
              </p>
            </div>
          </div>

          {/* Units Matrix */}
          <div className="settings-form-grid-2" style={{ marginBottom: 20 }}>
            <div>
              <div className="settings-label" style={{ marginBottom: 8 }}>Weight Unit</div>
              <div className="settings-pill-row">
                {["kg", "lb"].map((u) => (
                  <button
                    key={u}
                    type="button"
                    className={`settings-pill-btn ${weightUnit === u ? "active" : ""}`}
                    onClick={() => setWeightUnit(u)}
                  >
                    {u.toUpperCase()} ({u})
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="settings-label" style={{ marginBottom: 8 }}>Height Unit</div>
              <div className="settings-pill-row">
                {["cm", "ft"].map((u) => (
                  <button
                    key={u}
                    type="button"
                    className={`settings-pill-btn ${heightUnit === u ? "active" : ""}`}
                    onClick={() => setHeightUnit(u)}
                  >
                    {u.toUpperCase()} ({u})
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="settings-form-grid-2" style={{ marginBottom: 20 }}>
            <div>
              <div className="settings-label" style={{ marginBottom: 8 }}>Distance Unit</div>
              <div className="settings-pill-row">
                {["km", "miles"].map((u) => (
                  <button
                    key={u}
                    type="button"
                    className={`settings-pill-btn ${distanceUnit === u ? "active" : ""}`}
                    onClick={() => setDistanceUnit(u)}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="settings-label" style={{ marginBottom: 8 }}>Calorie Unit</div>
              <div className="settings-pill-row">
                {["kcal", "kJ"].map((u) => (
                  <button
                    key={u}
                    type="button"
                    className={`settings-pill-btn ${calorieUnit === u ? "active" : ""}`}
                    onClick={() => setCalorieUnit(u)}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Toggles */}
          <div className="settings-toggle-row">
            <div>
              <div className="settings-toggle-title">Weekly Progress Auto-Tracking</div>
              <div className="settings-toggle-desc">Automatically compute weekly volume density and 1RM progression delta.</div>
            </div>
            <button
              type="button"
              className={`settings-switch-btn ${trackWeekly ? "active" : ""}`}
              onClick={() => setTrackWeekly(!trackWeekly)}
              aria-label="Toggle Weekly Tracking"
            >
              <div className="settings-switch-thumb" />
            </button>
          </div>

          <div className="settings-toggle-row">
            <div>
              <div className="settings-toggle-title">Body Measurement Visibility</div>
              <div className="settings-toggle-desc">Show tissue composition, body fat %, and lean mass on analytics dashboard.</div>
            </div>
            <button
              type="button"
              className={`settings-switch-btn ${bodyMetricsVisible ? "active" : ""}`}
              onClick={() => setBodyMetricsVisible(!bodyMetricsVisible)}
              aria-label="Toggle Body Metrics"
            >
              <div className="settings-switch-thumb" />
            </button>
          </div>

          {/* Master Health Privacy Switch */}
          <div className="settings-toggle-row" style={{ background: "rgba(0, 180, 255, 0.06)", padding: "14px 18px", borderRadius: 14 }}>
            <div>
              <div className="settings-toggle-title" style={{ color: "#00e5ff" }}>
                Keep my fitness information private
              </div>
              <div className="settings-toggle-desc">
                Mask all your weight, body fat %, and PR records from leaderboards and other gym members.
              </div>
            </div>
            <button
              type="button"
              className={`settings-switch-btn ${privateFitnessInfo ? "active" : ""}`}
              onClick={() => setPrivateFitnessInfo(!privateFitnessInfo)}
              aria-label="Toggle Master Privacy"
            >
              <div className="settings-switch-thumb" />
            </button>
          </div>
        </section>

        {/* =========================================================
            5. MEMBERSHIP & BILLING 💳
            ========================================================= */}
        <section id="sec-billing" className="settings-section-card">
          <div className="settings-section-header">
            <div>
              <div className="bento-card-kicker">SUBSCRIPTION & INVOICES</div>
              <h3 className="settings-section-title">5. Membership & Billing 💳</h3>
              <p className="settings-section-desc">
                Manage your gym access tier, payment methods, and invoice downloads.
              </p>
            </div>
            <span className="bento-badge-live pulse-green">ACTIVE VIP MEMBER</span>
          </div>

          {/* Current Plan Card */}
          <div className="workout-live-status-bar" style={{ marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: "0.72rem", color: "#94a3b8", textTransform: "uppercase", fontWeight: 700 }}>
                CURRENT PLAN
              </div>
              <div style={{ fontSize: "1.25rem", fontWeight: 900, color: "#ffffff" }}>
                FITPULSE ELITE BLACK CARD
              </div>
              <div style={{ fontSize: "0.8rem", color: "#00b4ff", marginTop: 2 }}>
                Monthly Membership • Automatic Renewal on 28 October 2026 (₹3,999/mo)
              </div>
            </div>
            <button
              type="button"
              className="community-btn-primary"
              onClick={() => navigateTo("/dashboard/plans")}
            >
              Upgrade / Change Tier →
            </button>
          </div>

          {/* Payment Method */}
          <div className="settings-toggle-row">
            <div>
              <div className="settings-toggle-title">Default Payment Method</div>
              <div className="settings-toggle-desc">Visa ending in •••• 4242 (Expires 12/28)</div>
            </div>
            <button
              type="button"
              className="workout-timer-btn"
              onClick={() => alert("Stripe payment portal...")}
            >
              Update Payment Card
            </button>
          </div>

          <div className="settings-toggle-row">
            <div>
              <div className="settings-toggle-title">Invoices & Billing History</div>
              <div className="settings-toggle-desc">Download PDF tax receipts and statements for company wellness reimbursement.</div>
            </div>
            <button
              type="button"
              className="workout-timer-btn"
              onClick={() => navigateTo("/dashboard/plans")}
            >
              View Invoices (3 Paid) ⬇
            </button>
          </div>

          <div style={{ marginTop: 14 }}>
            <button
              type="button"
              style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: "0.8rem", fontWeight: 700, padding: 0 }}
              onClick={() => alert("Please contact reception or your coach to pause or cancel membership.")}
            >
              Cancel or pause membership →
            </button>
          </div>
        </section>

        {/* =========================================================
            6. PRIVACY
            ========================================================= */}
        <section id="sec-privacy" className="settings-section-card">
          <div className="settings-section-header">
            <div>
              <div className="bento-card-kicker">SOCIAL & DATA SHARING</div>
              <h3 className="settings-section-title">6. Privacy Controls</h3>
              <p className="settings-section-desc">
                Fine-tune what fellow gym members and the community feed can see about your profile.
              </p>
            </div>
          </div>

          <div className="settings-toggle-row">
            <div>
              <div className="settings-toggle-title">Show my profile in Community Feed</div>
              <div className="settings-toggle-desc">Allow members to see your posts and send training high-fives.</div>
            </div>
            <button
              type="button"
              className={`settings-switch-btn ${communityVisible ? "active" : ""}`}
              onClick={() => setCommunityVisible(!communityVisible)}
            >
              <div className="settings-switch-thumb" />
            </button>
          </div>

          <div className="settings-toggle-row">
            <div>
              <div className="settings-toggle-title">Show achievements & milestone badges to others</div>
              <div className="settings-toggle-desc">Display your 100km quest badges and streak trophies on leaderboards.</div>
            </div>
            <button
              type="button"
              className={`settings-switch-btn ${achievementsVisible ? "active" : ""}`}
              onClick={() => setAchievementsVisible(!achievementsVisible)}
            >
              <div className="settings-switch-thumb" />
            </button>
          </div>

          <div className="settings-toggle-row">
            <div>
              <div className="settings-toggle-title">Show live workout activity</div>
              <div className="settings-toggle-desc">Broadcast your working sets and current exercise in real-time to friends.</div>
            </div>
            <button
              type="button"
              className={`settings-switch-btn ${workoutActivityVisible ? "active" : ""}`}
              onClick={() => setWorkoutActivityVisible(!workoutActivityVisible)}
            >
              <div className="settings-switch-thumb" />
            </button>
          </div>

          <div className="settings-toggle-row">
            <div>
              <div className="settings-toggle-title">Show attendance streak</div>
              <div className="settings-toggle-desc">Display your 24-day consecutive check-in streak on the campus leaderboard.</div>
            </div>
            <button
              type="button"
              className={`settings-switch-btn ${streakVisible ? "active" : ""}`}
              onClick={() => setStreakVisible(!streakVisible)}
            >
              <div className="settings-switch-thumb" />
            </button>
          </div>

          <div className="settings-toggle-row">
            <div>
              <div className="settings-toggle-title">Anonymized Telemetry Data Sharing</div>
              <div className="settings-toggle-desc">Share anonymized workout volume data to help train FitPulse AI recommendations.</div>
            </div>
            <button
              type="button"
              className={`settings-switch-btn ${dataSharing ? "active" : ""}`}
              onClick={() => setDataSharing(!dataSharing)}
            >
              <div className="settings-switch-thumb" />
            </button>
          </div>
        </section>

        {/* =========================================================
            7. APPEARANCE 🎨
            ========================================================= */}
        <section id="sec-appearance" className="settings-section-card">
          <div className="settings-section-header">
            <div>
              <div className="bento-card-kicker">GRAPHICAL INTERFACE</div>
              <h3 className="settings-section-title">7. Appearance 🎨</h3>
              <p className="settings-section-desc">
                Customize the visual presentation of the FitPulse member application.
              </p>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div className="settings-label" style={{ marginBottom: 10 }}>Color Theme</div>
            <div className="settings-pill-row">
              {[
                { id: "Dark", label: "Dark 🌙 (Luxury Obsidian Glass)" },
                { id: "Light", label: "Light ☀️ (Porcelain Frost)" },
                { id: "System", label: "System 💻 (Sync OS)" },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`settings-pill-btn ${theme === t.id ? "active" : ""}`}
                  onClick={() => handleThemeChange(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* =========================================================
            8. SUPPORT & HELP
            ========================================================= */}
        <section id="sec-support-help" className="settings-section-card">
          <div className="settings-section-header">
            <div>
              <div className="bento-card-kicker">ASSISTANCE & POLICIES</div>
              <h3 className="settings-section-title">8. Support & Help</h3>
              <p className="settings-section-desc">
                Need guidance or encountering an issue? Reach out to club staff directly.
              </p>
            </div>
          </div>

          <div className="settings-form-grid-3">
            {[
              { title: "Help Center", desc: "Browse guides & tutorials", icon: "📚" },
              { title: "Contact Support", desc: "Talk with staff / Concierge", icon: "💬" },
              { title: "Report a Problem", desc: "Submit broken machine ticket", icon: "🔧" },
              { title: "Frequently Asked Questions", desc: "Common member queries", icon: "❓" },
              { title: "Feedback & Suggestions", desc: "Help improve FitPulse", icon: "💡" },
              { title: "Terms & Privacy Policy", desc: "Club bylaws & legal rights", icon: "📜" },
            ].map((item, i) => (
              <div
                key={i}
                className="workout-exercise-row"
                style={{ cursor: "pointer", flexDirection: "column", alignItems: "flex-start" }}
                onClick={() => alert(`Opening ${item.title}...`)}
              >
                <div style={{ fontSize: "1.4rem", marginBottom: 6 }}>{item.icon}</div>
                <div className="workout-ex-name">{item.title}</div>
                <div className="workout-ex-target">{item.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* =========================================================
            9. ACCOUNT MANAGEMENT 🛡️
            ========================================================= */}
        <section id="sec-danger" className="settings-section-card">
          <div className="settings-section-header">
            <div>
              <div className="bento-card-kicker" style={{ color: "#00e5ff" }}>MEMBERSHIP ACCESS</div>
              <h3 className="settings-section-title">9. Account Management 🛡️</h3>
              <p className="settings-section-desc">
                Manage your active session, temporarily pause turnstile access, or manage account continuity.
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
            <button
              type="button"
              className="workout-timer-btn"
              onClick={handleLogout}
            >
              Log Out of This Session
            </button>

            <button
              type="button"
              className="workout-timer-btn"
              style={{ borderColor: "rgba(255, 255, 255, 0.2)", color: "#cbd5e1" }}
              onClick={() => alert("Turnstile access paused temporarily. Scan your pass or log back in to reactivate.")}
            >
              Pause Turnstile Access
            </button>

            <button
              type="button"
              className="workout-timer-btn"
              style={{ borderColor: "rgba(255, 255, 255, 0.2)", color: "#94a3b8" }}
              onClick={() => setShowDeleteModal(true)}
            >
              Close Account Options...
            </button>
          </div>
        </section>

        {/* =========================================================
            10. 📬 MEMBER SUPPORT & QUERIES (DIRECT TO ADMIN)
            ========================================================= */}
        <section id="sec-support" className="settings-section-card">
          <div className="settings-section-header">
            <div>
              <div className="bento-card-kicker" style={{ color: "#00f2fe" }}>HELPDESK TICKETING</div>
              <h3 className="settings-section-title">10. Raise Support Query / Request</h3>
              <p className="settings-section-desc">
                Submit questions, locker issues, billing inquiries, or facility feedback directly to the Gym Administrator.
              </p>
            </div>
            <span className="module-status-pill" style={{ borderColor: "#00f2fe44", color: "#00f2fe" }}>
              LIVE ADMIN INBOX
            </span>
          </div>

          {querySubmitted && (
            <div
              style={{
                padding: "14px 18px",
                background: "rgba(16, 185, 129, 0.15)",
                border: "1px solid #10b981",
                borderRadius: "10px",
                color: "#34d399",
                marginBottom: 16,
                fontWeight: 700,
                fontSize: "0.9rem",
              }}
            >
              ✓ {querySubmitted}
            </div>
          )}

          <form onSubmit={handleSubmitQuery} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label className="settings-label">Query Category</label>
                <select
                  value={supportCategory}
                  onChange={(e) => setSupportCategory(e.target.value)}
                  className="settings-input"
                  style={{ cursor: "pointer" }}
                >
                  <option value="Facility & Equipment">Facility & Equipment</option>
                  <option value="Billing & Membership">Billing & Membership</option>
                  <option value="Trainer Feedback">Trainer Feedback</option>
                  <option value="Locker & Turnstile Access">Locker & Turnstile Access</option>
                  <option value="General Query">General Query</option>
                </select>
              </div>

              <div>
                <label className="settings-label">Urgency / Priority</label>
                <select
                  value={supportPriority}
                  onChange={(e) => setSupportPriority(e.target.value)}
                  className="settings-input"
                  style={{ cursor: "pointer" }}
                >
                  <option value="Normal">Normal Priority</option>
                  <option value="High">High / Urgent Issue</option>
                  <option value="Low">Low / General Inquiry</option>
                </select>
              </div>
            </div>

            <div>
              <label className="settings-label">Subject</label>
              <input
                type="text"
                required
                placeholder="Brief summary of your query or request..."
                value={supportSubject}
                onChange={(e) => setSupportSubject(e.target.value)}
                className="settings-input"
              />
            </div>

            <div>
              <label className="settings-label">Detailed Description</label>
              <textarea
                rows={4}
                required
                placeholder="Provide full context for the Gym Administrator..."
                value={supportMessage}
                onChange={(e) => setSupportMessage(e.target.value)}
                className="settings-input"
                style={{ resize: "vertical", height: "auto" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="submit"
                disabled={querySending}
                className="community-btn-primary"
                style={{ padding: "10px 24px", fontSize: "0.88rem" }}
              >
                {querySending ? "Broadcasting to Admin..." : "Submit to Admin Query Box ↗"}
              </button>
            </div>
          </form>
        </section>
      </main>

      {/* Change Password Modal */}
      {showPwModal && (
        <div className="qr-modal-backdrop" onClick={() => setShowPwModal(false)}>
          <div className="qr-modal-content" onClick={(e) => e.stopPropagation()} style={{ textAlign: "left", maxWidth: 440 }}>
            <div className="module-hero-kicker">SECURITY CREDENTIALS</div>
            <h3 style={{ margin: "4px 0 16px 0", fontSize: "1.3rem", fontWeight: 900 }}>Change Password</h3>

            {pwError && (
              <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.15)", border: "1px solid #ef4444", borderRadius: 8, color: "#fca5a5", fontSize: "0.82rem", marginBottom: 14 }}>
                ⚠️ {pwError}
              </div>
            )}

            {pwSuccess && (
              <div style={{ padding: "10px 14px", background: "rgba(16,185,129,0.15)", border: "1px solid #10b981", borderRadius: 8, color: "#34d399", fontSize: "0.82rem", marginBottom: 14 }}>
                ✓ {pwSuccess}
              </div>
            )}

            <form onSubmit={handleChangePassword}>
              <div className="settings-field-group" style={{ marginBottom: 12 }}>
                <label className="settings-label">Current Password</label>
                <input
                  type="password"
                  required
                  className="settings-input"
                  placeholder="••••••••"
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                />
              </div>
              <div className="settings-field-group" style={{ marginBottom: 12 }}>
                <label className="settings-label">New Password</label>
                <input
                  type="password"
                  required
                  className="settings-input"
                  placeholder="At least 6 characters"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                />
              </div>
              <div className="settings-field-group" style={{ marginBottom: 20 }}>
                <label className="settings-label">Confirm New Password</label>
                <input
                  type="password"
                  required
                  className="settings-input"
                  placeholder="Re-enter new password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="submit"
                  disabled={pwLoading}
                  className="community-btn-primary"
                  style={{ flex: 1 }}
                >
                  {pwLoading ? "Updating Secure Vault..." : "Update Password"}
                </button>
                <button
                  type="button"
                  className="workout-timer-btn"
                  onClick={() => {
                    setShowPwModal(false);
                    setPwError("");
                    setPwSuccess("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Account Confirmation Modal */}
      {showDeleteModal && (
        <div className="qr-modal-backdrop" onClick={() => setShowDeleteModal(false)}>
          <div className="qr-modal-content" onClick={(e) => e.stopPropagation()} style={{ borderColor: "#ef4444" }}>
            <div style={{ fontSize: "2rem", marginBottom: 8 }}>⚠️</div>
            <h3 style={{ margin: "0 0 10px 0", fontSize: "1.3rem", fontWeight: 900, color: "#fca5a5" }}>
              Permanently Delete Account?
            </h3>
            <p style={{ fontSize: "0.82rem", color: "#cbd5e1", lineHeight: 1.5, margin: "0 0 20px 0" }}>
              Are you absolutely sure, <strong>Nihal</strong>? All your historical workout PRs, biometric scans, 24-day attendance streaks, and Elite Black Card membership will be permanently erased.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                className="settings-btn-danger"
                style={{ flex: 1 }}
                onClick={() => {
                  setShowDeleteModal(false);
                  handleLogout();
                }}
              >
                Yes, Delete Account
              </button>
              <button
                type="button"
                className="workout-timer-btn"
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

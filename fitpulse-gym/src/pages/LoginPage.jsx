import { useState } from "react";
import { loginLive, requestTrainerResetLive, confirmTrainerResetLive } from "../services/realtime";
import "../styles/auth-3d.css";

function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isClickSweeping, setIsClickSweeping] = useState(false);
  const [authError, setAuthError] = useState("");

  const [form, setForm] = useState({
    email: "",
    password: "",
    remember: false,
  });

  // Trainer Password Reset Modal State
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetStep, setResetStep] = useState(1); // 1: corporate email, 2: token & new password
  const [resetEmail, setResetEmail] = useState("");
  const [resetMaskedEmail, setResetMaskedEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resetNewPass, setResetNewPass] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetStatus, setResetStatus] = useState({ type: "", text: "" });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    setAuthError("");
  };

  const navigateTo = (path) => {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsClickSweeping(true);
    setIsAuthenticating(true);
    setAuthError("");

    try {
      const res = await loginLive(form.email, form.password);

      if (res && res.success && res.user) {
        // Successful login against MySQL
        localStorage.setItem("fitpulse_token", res.token);
        localStorage.setItem("fitpulse_user", JSON.stringify(res.user));

        setTimeout(() => {
          if (res.user.role === "Admin") {
            navigateTo("/admin-dashboard");
          } else if (res.user.role === "Trainer") {
            navigateTo("/trainer-dashboard");
          } else {
            navigateTo("/dashboard");
          }
        }, 500);
        return;
      } else {
        setAuthError(res?.message || "Invalid email or password.");
        setIsAuthenticating(false);
        setIsClickSweeping(false);
        return;
      }
    } catch (err) {
      console.warn("Backend auth request error:", err);
      setAuthError("Authentication failed: Unable to connect to server.");
      setIsAuthenticating(false);
      setIsClickSweeping(false);
    }
  };

  // Trainer Password Reset: Step 1 (Request reset token via linked personal Gmail)
  const handleRequestTrainerReset = async (e) => {
    e.preventDefault();
    if (!resetEmail.trim()) return;
    setResetLoading(true);
    setResetStatus({ type: "", text: "" });

    const res = await requestTrainerResetLive(resetEmail.trim());
    setResetLoading(false);

    if (res && res.success) {
      setResetMaskedEmail(res.linkedPersonalEmail || "your linked personal Gmail");
      setResetStep(2);
      setResetStatus({
        type: "success",
        text: res.message || "Verification code dispatched to your linked personal Gmail.",
      });
    } else {
      setResetStatus({
        type: "error",
        text: res?.message || "Trainer account not found or personal Gmail not linked.",
      });
    }
  };

  // Trainer Password Reset: Step 2 (Confirm new password)
  const handleConfirmTrainerReset = async (e) => {
    e.preventDefault();
    if (!resetNewPass || resetNewPass.length < 6) {
      setResetStatus({ type: "error", text: "Password must be at least 6 characters." });
      return;
    }
    setResetLoading(true);

    const res = await confirmTrainerResetLive(resetEmail.trim(), resetNewPass);
    setResetLoading(false);

    if (res && res.success) {
      setResetStatus({
        type: "success",
        text: "Password updated successfully in database! You can now log in.",
      });
      setTimeout(() => {
        setShowResetModal(false);
        setForm((prev) => ({ ...prev, email: resetEmail, password: resetNewPass }));
        setResetStep(1);
        setResetStatus({ type: "", text: "" });
      }, 1800);
    } else {
      setResetStatus({
        type: "error",
        text: res?.message || "Error updating password. Please retry.",
      });
    }
  };

  return (
    <main className="gym-auth-page-wrapper">
      {/* Background Image */}
      <img
        src="/assets/auth-gym-clean-bg.jpg"
        alt="FitPulse Luxury Gym"
        className="gym-auth-bg-media"
      />

      {/* Cinematic Dark Vignette Overlay */}
      <div className="gym-auth-vignette-overlay" />

      {/* Centered Dark Glassmorphic Dashboard Card */}
      <div className="gym-auth-center-container">
        <div className="gym-dark-glass-card" style={{ maxWidth: "480px" }}>
          {/* Subtle Top Specular Sheen */}
          <div className="gym-card-sheen-sweep" />

          {/* Top Brand Pill & Badge */}
          <div className="gym-card-top-row">
            <div className="gym-brand-pill">
              <span className="gym-brand-dot" />
              <span className="gym-brand-text">FITPULSE</span>
            </div>
            <div className="gym-badge-column">
              <span className="gym-badge-tag" style={{ borderColor: "#00f2fe44", color: "#00f2fe" }}>
                LIVE BACKEND
              </span>
              <span className="gym-badge-tag">ROLES & ACCESS</span>
            </div>
          </div>

          {/* Card Header Typography */}
          <div className="gym-card-header">
            <h1 className="gym-card-title">FitPulse Portal</h1>
            <p className="gym-card-subtitle">Select role or enter gym credentials</p>
          </div>

          {/* Dedicated Attendance Face ID Login Quick Switch */}
          <button
            type="button"
            onClick={() => navigateTo("/attendance-login")}
            style={{
              width: "100%",
              marginBottom: "1.2rem",
              padding: "0.75rem 1rem",
              borderRadius: "12px",
              background: "linear-gradient(135deg, rgba(0, 229, 255, 0.15) 0%, rgba(16, 185, 129, 0.15) 100%)",
              border: "1.5px solid rgba(0, 229, 255, 0.4)",
              color: "#ffffff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              boxShadow: "0 0 20px rgba(0, 229, 255, 0.15)",
              transition: "all 0.2s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", textAlign: "left" }}>
              <span style={{ fontSize: "1.3rem" }}>📷</span>
              <div>
                <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "#00e5ff" }}>
                  Attendance Face ID Login
                </div>
                <div style={{ fontSize: "0.7rem", color: "rgba(255, 255, 255, 0.65)" }}>
                  Turnstile facial recognition terminal
                </div>
              </div>
            </div>
            <span style={{ fontSize: "0.8rem", color: "#10b981", fontWeight: 800, background: "rgba(16, 185, 129, 0.2)", padding: "4px 8px", borderRadius: "6px" }}>
              GO →
            </span>
          </button>

          {authError && (
            <div
              style={{
                background: "rgba(239, 68, 68, 0.15)",
                border: "1px solid rgba(239, 68, 68, 0.4)",
                color: "#f87171",
                borderRadius: "8px",
                padding: "0.6rem 0.8rem",
                fontSize: "0.8rem",
                marginBottom: "1rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <span>⚠️</span>
              <span>{authError}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="gym-login-form">
            {/* Email Field */}
            <div className="gym-field-group">
              <label htmlFor="login-email" className="gym-field-label">
                Email or Corporate ID
              </label>
              <div className="gym-input-capsule">
                <span className="gym-input-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </span>
                <input
                  id="login-email"
                  type="text"
                  name="email"
                  className="gym-input-field"
                  placeholder="name@fitpulse.com"
                  value={form.email}
                  onChange={handleChange}
                  autoComplete="username"
                  required
                  autoFocus
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="gym-field-group">
              <div className="gym-label-row">
                <label htmlFor="login-password" className="gym-field-label">
                  Password
                </label>
                <button
                  type="button"
                  className="gym-forgot-btn"
                  onClick={() => {
                    setShowResetModal(true);
                    setResetStep(1);
                    setResetEmail(form.email.includes("@") ? form.email : "");
                    setResetStatus({ type: "", text: "" });
                  }}
                  style={{ color: "#00f2fe", fontWeight: 600 }}
                >
                  Trainer Password Reset ↗
                </button>
              </div>
              <div className="gym-input-capsule">
                <span className="gym-input-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  className="gym-input-field"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="gym-password-toggle-btn"
                  onClick={() => setShowPassword((prev) => !prev)}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me Option */}
            <div className="gym-options-row">
              <label className="gym-remember-label">
                <input
                  type="checkbox"
                  name="remember"
                  checked={form.remember}
                  onChange={handleChange}
                  className="gym-remember-checkbox"
                />
                <span>Remember session for 30 days</span>
              </label>
            </div>

            {/* Primary Action Button */}
            <button
              type="submit"
              className={`gym-login-submit-btn ${isClickSweeping ? "is-sweeping" : ""}`}
              disabled={isAuthenticating}
            >
              <div className="gym-btn-shine-bar" />
              <span>{isAuthenticating ? "Authenticating Session..." : "Secure Login"}</span>
              <span className="gym-btn-arrow-icon">→</span>
            </button>

            {/* Footer Registration Link */}
            <div className="gym-card-footer" style={{ marginTop: "1rem" }}>
              <span>New member?</span>
              <button
                type="button"
                onClick={() => navigateTo("/signup")}
                className="gym-card-footer-link"
              >
                Create an account
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Trainer Self-Service Password Reset Modal */}
      {showResetModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          <div
            style={{
              background: "linear-gradient(145deg, #0d121c 0%, #070a0e 100%)",
              border: "1px solid rgba(0, 242, 254, 0.3)",
              borderRadius: "16px",
              padding: "2rem",
              width: "100%",
              maxWidth: "460px",
              boxShadow: "0 25px 60px rgba(0,0,0,0.8), 0 0 30px rgba(0,242,254,0.15)",
              position: "relative",
            }}
          >
            <button
              type="button"
              onClick={() => setShowResetModal(false)}
              style={{
                position: "absolute",
                top: "1.2rem",
                right: "1.2rem",
                background: "transparent",
                border: "none",
                color: "#6b7280",
                fontSize: "1.2rem",
                cursor: "pointer",
              }}
            >
              ✕
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.5rem" }}>
              <span style={{ fontSize: "1.5rem" }}>🔑</span>
              <h2 style={{ fontSize: "1.3rem", fontWeight: 700, color: "#fff", margin: 0 }}>
                Trainer Password Reset
              </h2>
            </div>
            <p style={{ fontSize: "0.85rem", color: "#9ca3af", marginBottom: "1.5rem", lineHeight: 1.5 }}>
              FitPulse Trainer Self-Service: Reset your password independently using your linked personal Gmail.
            </p>

            {resetStatus.text && (
              <div
                style={{
                  padding: "0.75rem 1rem",
                  borderRadius: "8px",
                  fontSize: "0.85rem",
                  marginBottom: "1.2rem",
                  background: resetStatus.type === "success" ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                  border: resetStatus.type === "success" ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid rgba(239, 68, 68, 0.4)",
                  color: resetStatus.type === "success" ? "#34d399" : "#f87171",
                }}
              >
                {resetStatus.text}
              </div>
            )}

            {resetStep === 1 ? (
              <form onSubmit={handleRequestTrainerReset}>
                <div style={{ marginBottom: "1.2rem" }}>
                  <label style={{ display: "block", fontSize: "0.78rem", color: "#9ca3af", marginBottom: "0.4rem" }}>
                    Trainer Corporate Email
                  </label>
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="e.g. alex@fitpulse.com or sarah@fitpulse.com"
                    required
                    style={{
                      width: "100%",
                      padding: "0.75rem 1rem",
                      background: "rgba(255, 255, 255, 0.05)",
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      borderRadius: "8px",
                      color: "#fff",
                      fontSize: "0.9rem",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                  <span style={{ fontSize: "0.72rem", color: "#6b7280", marginTop: "0.3rem", display: "block" }}>
                    The system will automatically find your linked personal Gmail account.
                  </span>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.8rem" }}>
                  <button
                    type="button"
                    onClick={() => setShowResetModal(false)}
                    style={{
                      padding: "0.6rem 1.2rem",
                      background: "transparent",
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      borderRadius: "8px",
                      color: "#9ca3af",
                      cursor: "pointer",
                      fontSize: "0.85rem",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={resetLoading}
                    style={{
                      padding: "0.6rem 1.4rem",
                      background: "linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)",
                      border: "none",
                      borderRadius: "8px",
                      color: "#000",
                      fontWeight: 700,
                      cursor: resetLoading ? "not-allowed" : "pointer",
                      fontSize: "0.85rem",
                    }}
                  >
                    {resetLoading ? "Verifying..." : "Verify & Send Code →"}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleConfirmTrainerReset}>
                <div style={{ marginBottom: "1rem" }}>
                  <label style={{ display: "block", fontSize: "0.78rem", color: "#9ca3af", marginBottom: "0.3rem" }}>
                    Linked Personal Gmail (Verified)
                  </label>
                  <div
                    style={{
                      padding: "0.6rem 0.8rem",
                      background: "rgba(0, 242, 254, 0.08)",
                      border: "1px solid rgba(0, 242, 254, 0.25)",
                      borderRadius: "8px",
                      color: "#00f2fe",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                    }}
                  >
                    ✉️ {resetMaskedEmail}
                  </div>
                </div>

                <div style={{ marginBottom: "1rem" }}>
                  <label style={{ display: "block", fontSize: "0.78rem", color: "#9ca3af", marginBottom: "0.3rem" }}>
                    Verification Code
                  </label>
                  <input
                    type="text"
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    placeholder="Enter 6-digit verification code"
                    required
                    style={{
                      width: "100%",
                      padding: "0.7rem 1rem",
                      background: "rgba(255, 255, 255, 0.05)",
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      borderRadius: "8px",
                      color: "#fff",
                      fontSize: "0.9rem",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                  <span style={{ fontSize: "0.7rem", color: "#10b981", marginTop: "0.2rem", display: "block" }}>
                    Self-Service simulation: Use code <strong>RESET2026</strong> or check personal mail.
                  </span>
                </div>

                <div style={{ marginBottom: "1.4rem" }}>
                  <label style={{ display: "block", fontSize: "0.78rem", color: "#9ca3af", marginBottom: "0.3rem" }}>
                    New Password
                  </label>
                  <input
                    type="password"
                    value={resetNewPass}
                    onChange={(e) => setResetNewPass(e.target.value)}
                    placeholder="At least 6 characters"
                    required
                    style={{
                      width: "100%",
                      padding: "0.7rem 1rem",
                      background: "rgba(255, 255, 255, 0.05)",
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      borderRadius: "8px",
                      color: "#fff",
                      fontSize: "0.9rem",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", gap: "0.8rem" }}>
                  <button
                    type="button"
                    onClick={() => setResetStep(1)}
                    style={{
                      padding: "0.6rem 1rem",
                      background: "transparent",
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      borderRadius: "8px",
                      color: "#9ca3af",
                      cursor: "pointer",
                      fontSize: "0.85rem",
                    }}
                  >
                    ← Back
                  </button>
                  <button
                    type="submit"
                    disabled={resetLoading}
                    style={{
                      padding: "0.6rem 1.4rem",
                      background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                      border: "none",
                      borderRadius: "8px",
                      color: "#fff",
                      fontWeight: 700,
                      cursor: resetLoading ? "not-allowed" : "pointer",
                      fontSize: "0.85rem",
                    }}
                  >
                    {resetLoading ? "Updating MySQL..." : "Save New Password ✓"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

export default LoginPage;
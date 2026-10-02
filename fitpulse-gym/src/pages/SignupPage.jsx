import { useState } from "react";
import "../styles/auth-3d.css";

const steps = [
  "IDENTITY",
  "CONTACT",
  "SECURITY",
  "GOAL",
];

const goals = [
  {
    id: "muscle",
    title: "BUILD MUSCLE",
    description: "Increase strength, size and physical power.",
  },
  {
    id: "fat-loss",
    title: "LOSE FAT",
    description: "Build a leaner and healthier physique.",
  },
  {
    id: "strength",
    title: "GET STRONGER",
    description: "Improve raw strength and athletic output.",
  },
  {
    id: "performance",
    title: "PERFORMANCE",
    description: "Optimize stamina, agility and recovery.",
  },
];

function SignupPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [complete, setComplete] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    name: "",
    gender: "Male",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    goal: "muscle",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = (name, value) => {
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const validateCurrentStep = () => {
    if (currentStep === 0) return form.name.trim().length >= 2 && Boolean(form.gender);
    if (currentStep === 1) return form.email.includes("@") && form.email.includes(".");
    if (currentStep === 2) return form.password.length >= 6 && form.password === form.confirmPassword;
    if (currentStep === 3) return Boolean(form.goal);
    return false;
  };

  const nextStep = async (e) => {
    if (e) e.preventDefault();
    if (!validateCurrentStep()) {
      if (currentStep === 0) alert("Please enter your name (at least 2 characters) and select your gender.");
      else if (currentStep === 1) alert("Please enter a valid email address.");
      else if (currentStep === 2) alert("Password must be at least 6 characters and match confirmation.");
      else if (currentStep === 3) alert("Please select a fitness goal.");
      return;
    }

    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      setIsSubmitting(true);
      try {
        const response = await fetch("http://localhost:5000/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            email: form.email,
            phone: form.phone,
            gender: form.gender,
            password: form.password,
            goal: form.goal,
          }),
        });

        const data = await response.json();
        if (data.success && data.user) {
          localStorage.setItem("fitpulse_token", data.token);
          localStorage.setItem("fitpulse_user", JSON.stringify(data.user));
        } else {
          localStorage.setItem(
            "fitpulse_user",
            JSON.stringify({
              name: form.name,
              email: form.email,
              gender: form.gender,
              goal: form.goal,
              role: "Member",
            })
          );
        }
      } catch (err) {
        console.warn("Backend registration fallback:", err);
        localStorage.setItem(
          "fitpulse_user",
          JSON.stringify({
            name: form.name,
            email: form.email,
            gender: form.gender,
            goal: form.goal,
            role: "Member",
          })
        );
      } finally {
        setIsSubmitting(false);
        setComplete(true);
      }
    }
  };

  const previousStep = () => {
    if (currentStep > 0) setCurrentStep((prev) => prev - 1);
  };

  const navigateTo = (path) => {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  return (
    <main className="gym-auth-page-wrapper">
      {/* High-Resolution Clean Gym Background */}
      <img
        src="/assets/auth-gym-clean-bg.jpg"
        alt="FitPulse Luxury Gym"
        className="gym-auth-bg-media"
      />

      {/* Vignette Overlay */}
      <div className="gym-auth-vignette-overlay" />

      {/* Centered Dark Glassmorphic Dashboard Card */}
      <div className="gym-auth-center-container">
        <div className="gym-dark-glass-card gym-signup-card">
          <div className="gym-card-sheen-sweep" />

          {/* Top Brand Pill & Step Counter */}
          <div className="gym-card-top-row">
            <div className="gym-brand-pill">
              <span className="gym-brand-dot" />
              <span className="gym-brand-text">FITPULSE</span>
            </div>
            <div className="gym-signup-steps-tracker">
              {steps.map((label, idx) => (
                <div
                  key={label}
                  className={`gym-step-indicator ${
                    idx === currentStep
                      ? "is-current"
                      : idx < currentStep
                      ? "is-done"
                      : ""
                  }`}
                  title={label}
                />
              ))}
            </div>
          </div>

          {!complete ? (
            <>
              {/* Header */}
              <div className="gym-card-header">
                <div className="gym-signup-step-kicker">
                  STEP 0{currentStep + 1} — {steps[currentStep]}
                </div>
                <h1 className="gym-card-title">
                  {currentStep === 0 && "Join FitPulse"}
                  {currentStep === 1 && "Contact Details"}
                  {currentStep === 2 && "Secure Access"}
                  {currentStep === 3 && "Your Target Goal"}
                </h1>
                <p className="gym-card-subtitle">
                  {currentStep === 0 && "Start your elite transformation journey."}
                  {currentStep === 1 && "Where should we send your workout analytics?"}
                  {currentStep === 2 && "Create a secure password for your portal."}
                  {currentStep === 3 && "Select your primary training objective."}
                </p>
              </div>

              {/* Form Content per Step */}
              <form onSubmit={nextStep} className="gym-login-form">
                {currentStep === 0 && (
                  <>
                    <div className="gym-field-group">
                      <label htmlFor="signup-name" className="gym-field-label">
                        Full Name
                      </label>
                      <div className="gym-input-capsule">
                        <span className="gym-input-icon">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                          </svg>
                        </span>
                        <input
                          id="signup-name"
                          type="text"
                          className="gym-input-field"
                          placeholder="Nihal Carter"
                          value={form.name}
                          onChange={(e) => updateField("name", e.target.value)}
                          autoFocus
                          required
                        />
                      </div>
                    </div>

                    <div className="gym-field-group" style={{ marginTop: "14px" }}>
                      <label className="gym-field-label">Gender</label>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px", marginTop: "6px" }}>
                        {[
                          { id: "Male", label: "Male", icon: "♂" },
                          { id: "Female", label: "Female", icon: "♀" },
                          { id: "Non-Binary", label: "Non-Binary", icon: "⚧" },
                          { id: "Prefer not to say", label: "Prefer not to say", icon: "✦" },
                        ].map((g) => (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => updateField("gender", g.id)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "8px",
                              padding: "11px 12px",
                              borderRadius: "10px",
                              background: form.gender === g.id ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.03)",
                              border: form.gender === g.id ? "1px solid rgba(255, 255, 255, 0.45)" : "1px solid rgba(255, 255, 255, 0.08)",
                              color: form.gender === g.id ? "#ffffff" : "rgba(255, 255, 255, 0.65)",
                              fontWeight: form.gender === g.id ? "600" : "500",
                              fontSize: "0.82rem",
                              letterSpacing: "0.02em",
                              cursor: "pointer",
                              transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                              boxShadow: form.gender === g.id ? "0 4px 16px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)" : "none",
                            }}
                          >
                            <span style={{ fontSize: "1rem", opacity: form.gender === g.id ? 1 : 0.6 }}>{g.icon}</span>
                            <span>{g.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {currentStep === 1 && (
                  <>
                    <div className="gym-field-group">
                      <label htmlFor="signup-email" className="gym-field-label">
                        Email Address
                      </label>
                      <div className="gym-input-capsule">
                        <span className="gym-input-icon">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                            <polyline points="22,6 12,13 2,6" />
                          </svg>
                        </span>
                        <input
                          id="signup-email"
                          type="email"
                          className="gym-input-field"
                          placeholder="nihal@fitpulse.com"
                          value={form.email}
                          onChange={(e) => updateField("email", e.target.value)}
                          autoFocus
                          required
                        />
                      </div>
                    </div>
                    <div className="gym-field-group">
                      <label htmlFor="signup-phone" className="gym-field-label">
                        Phone Number (Optional)
                      </label>
                      <div className="gym-input-capsule">
                        <span className="gym-input-icon">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                          </svg>
                        </span>
                        <input
                          id="signup-phone"
                          type="tel"
                          className="gym-input-field"
                          placeholder="+1 (555) 019-2834"
                          value={form.phone}
                          onChange={(e) => updateField("phone", e.target.value)}
                        />
                      </div>
                    </div>
                  </>
                )}

                {currentStep === 2 && (
                  <>
                    <div className="gym-field-group">
                      <label htmlFor="signup-password" className="gym-field-label">
                        Create Password
                      </label>
                      <div className="gym-input-capsule">
                        <span className="gym-input-icon">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                          </svg>
                        </span>
                        <input
                          id="signup-password"
                          type={showPassword ? "text" : "password"}
                          className="gym-input-field"
                          placeholder="Min 6 characters"
                          value={form.password}
                          onChange={(e) => updateField("password", e.target.value)}
                          autoFocus
                          required
                        />
                        <button
                          type="button"
                          className="gym-password-toggle-btn"
                          onClick={() => setShowPassword((prev) => !prev)}
                        >
                          {showPassword ? "Hide" : "Show"}
                        </button>
                      </div>
                    </div>
                    <div className="gym-field-group">
                      <label htmlFor="signup-confirm" className="gym-field-label">
                        Confirm Password
                      </label>
                      <div className="gym-input-capsule">
                        <span className="gym-input-icon">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                          </svg>
                        </span>
                        <input
                          id="signup-confirm"
                          type={showPassword ? "text" : "password"}
                          className="gym-input-field"
                          placeholder="Repeat password"
                          value={form.confirmPassword}
                          onChange={(e) => updateField("confirmPassword", e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  </>
                )}

                {currentStep === 3 && (
                  <div className="gym-goals-grid">
                    {goals.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        className={`gym-goal-card ${form.goal === g.id ? "is-selected" : ""}`}
                        onClick={() => updateField("goal", g.id)}
                      >
                        <div className="gym-goal-title">{g.title}</div>
                        <div className="gym-goal-desc">{g.description}</div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Step Actions */}
                <div className="gym-step-actions-row">
                  {currentStep > 0 && (
                    <button
                      type="button"
                      onClick={previousStep}
                      className="gym-secondary-btn"
                    >
                      ← Back
                    </button>
                  )}
                  <button
                    type="submit"
                    className="gym-login-submit-btn"
                    style={{ flex: 1 }}
                  >
                    <div className="gym-btn-shine-bar" />
                    <span>{currentStep === steps.length - 1 ? "Complete Registration" : "Continue"}</span>
                    <span className="gym-btn-arrow-icon">→</span>
                  </button>
                </div>

                {/* Footer Switch to Login */}
                <div className="gym-card-footer">
                  <span>Already have an account?</span>
                  <button
                    type="button"
                    onClick={() => navigateTo("/login")}
                    className="gym-card-footer-link"
                  >
                    Log In
                  </button>
                </div>
              </form>
            </>
          ) : (
            /* Success State */
            <div className="gym-signup-success-view">
              <div className="gym-success-badge">✓</div>
              <h2 className="gym-card-title">Registration Complete!</h2>
              <p className="gym-card-subtitle">
                Welcome aboard, <strong>{form.name}</strong>. Your customized fitness dashboard is ready.
              </p>
              <button
                type="button"
                className="gym-login-submit-btn"
                onClick={() => navigateTo("/dashboard")}
              >
                <span>Enter Member Dashboard</span>
                <span className="gym-btn-arrow-icon">→</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default SignupPage;
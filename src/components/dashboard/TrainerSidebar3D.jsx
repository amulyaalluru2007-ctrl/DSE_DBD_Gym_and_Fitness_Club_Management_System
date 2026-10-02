import { useState, useRef, useEffect } from "react";
import "../../styles/customer-sidebar-3d.css";

const trainerModules = [
  { id: "section-trainer-dashboard", label: "Dashboard", index: "01", icon: "home" },
  { id: "section-trainer-clients", label: "My Clients", index: "02", icon: "users" },
  { id: "section-trainer-workout-plans", label: "Workout Plans", index: "03", icon: "dumbbell" },
  { id: "section-trainer-schedule", label: "Schedule", index: "04", icon: "calendar" },
  { id: "section-trainer-progress", label: "Client Progress", index: "05", icon: "chart" },
  { id: "section-trainer-attendance", label: "Attendance", index: "06", icon: "qr" },
  { id: "section-trainer-nutrition", label: "Nutrition", index: "07", icon: "salad" },
  { id: "section-trainer-messages", label: "Messages", index: "08", icon: "chat" },
  { id: "section-trainer-performance", label: "Performance", index: "09", icon: "trophy" },
  { id: "section-trainer-exercises", label: "Exercise Library", index: "10", icon: "library" },
  { id: "section-trainer-notifications", label: "Notifications", index: "11", icon: "bell" },
  { id: "section-trainer-profile", label: "Trainer Profile", index: "12", icon: "profile" },
];

export default function TrainerSidebar3D({
  activeSection = "section-trainer-dashboard",
  onSelectModule,
  trainer,
}) {
  const [sliderStyle, setSliderStyle] = useState({ opacity: 0 });
  const dockRef = useRef(null);
  const moduleRefs = useRef({});

  const updateSlider = (targetId) => {
    const el = moduleRefs.current[targetId];
    const dock = dockRef.current;
    if (!el || !dock) return;

    const dockRect = dock.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();

    const top = elRect.top - dockRect.top;
    const height = elRect.height;

    setSliderStyle({
      transform: `translateY(${top}px)`,
      height: `${height}px`,
      opacity: 1,
    });
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      updateSlider(activeSection);
    }, 60);
    return () => clearTimeout(timer);
  }, [activeSection]);

  const handleLogout = () => {
    try {
      localStorage.removeItem("fitpulse_token");
      localStorage.removeItem("fitpulse_user");
    } catch {
      /* ignore */
    }
    window.history.pushState({}, "", "/login");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const handleSwitchToMember = () => {
    window.history.pushState({}, "", "/dashboard");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  // Reusable silver chrome 3D embossed SVG icons matching navbar-3d
  const renderIcon = (iconName) => {
    switch (iconName) {
      case "home":
        return (
          <svg className="sidebar-3d-icon-svg" viewBox="0 0 24 24">
            <path
              d="M12 3.2L2.5 11.5c-.3.3-.4.7-.2 1.1.2.4.6.6 1 .6h2v6.5c0 .6.4 1.1 1 1.1h3.5v-5h4.4v5h3.5c.6 0 1-.5 1-1.1v-6.5h2c.4 0 .8-.2 1-.6.2-.4.1-.8-.2-1.1L12 3.2z"
              fill="url(#sidebar-chrome-grad)"
            />
          </svg>
        );

      case "users":
        return (
          <svg className="sidebar-3d-icon-svg" viewBox="0 0 24 24">
            <path
              d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 3s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"
              fill="url(#sidebar-chrome-grad)"
            />
          </svg>
        );

      case "dumbbell":
        return (
          <svg className="sidebar-3d-icon-svg" viewBox="0 0 24 24">
            <path
              d="M6.5 6.5h1.8v11H6.5v-11zm-4 3h2.2v5H2.5v-5zm15-3h1.8v11h-1.8v-11zm4 3h2.2v5h-2.2v-5zM9.5 11h5v2h-5v-2z"
              fill="url(#sidebar-chrome-grad)"
            />
          </svg>
        );

      case "calendar":
        return (
          <svg className="sidebar-3d-icon-svg" viewBox="0 0 24 24">
            <path
              d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM5 8V6h14v2H5zm2 4h5v5H7v-5z"
              fill="url(#sidebar-chrome-grad)"
            />
          </svg>
        );

      case "chart":
        return (
          <svg className="sidebar-3d-icon-svg" viewBox="0 0 24 24">
            <path
              d="M13 2.5L4 13.5h6v8l9-11h-6v-8z"
              fill="url(#sidebar-chrome-grad)"
            />
          </svg>
        );

      case "qr":
        return (
          <svg className="sidebar-3d-icon-svg" viewBox="0 0 24 24">
            <path
              d="M3 3h7v7H3V3zm2 2v3h3V5H5zm8-2h7v7h-7V3zm2 2v3h3V5h-3zM3 14h7v7H3v-7zm2 2v3h3v-3H5zm9-2h2v2h-2v-2zm3 0h2v2h-2v-2zm-3 3h2v2h-2v-2zm3 0h2v4h-2v-4zm-3 3h2v2h-2v-2zm-2-6h2v2h-2v-2zm0 4h2v4h-2v-4z"
              fill="url(#sidebar-chrome-grad)"
            />
          </svg>
        );

      case "salad":
        return (
          <svg className="sidebar-3d-icon-svg" viewBox="0 0 24 24">
            <path
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"
              fill="url(#sidebar-chrome-grad)"
            />
          </svg>
        );

      case "chat":
        return (
          <svg className="sidebar-3d-icon-svg" viewBox="0 0 24 24">
            <path
              d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"
              fill="url(#sidebar-chrome-grad)"
            />
          </svg>
        );

      case "trophy":
        return (
          <svg className="sidebar-3d-icon-svg" viewBox="0 0 24 24">
            <path
              d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94A5.01 5.01 0 0 0 11 15.9V19H7v2h10v-2h-4v-3.1c1.94-.31 3.49-1.89 3.61-3.96C19.08 11.63 21 9.55 21 7V5c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"
              fill="url(#sidebar-chrome-grad)"
            />
          </svg>
        );

      case "library":
        return (
          <svg className="sidebar-3d-icon-svg" viewBox="0 0 24 24">
            <path
              d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12z"
              fill="url(#sidebar-chrome-grad)"
            />
          </svg>
        );

      case "bell":
        return (
          <svg className="sidebar-3d-icon-svg" viewBox="0 0 24 24">
            <path
              d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"
              fill="url(#sidebar-chrome-grad)"
            />
          </svg>
        );

      case "profile":
        return (
          <svg className="sidebar-3d-icon-svg" viewBox="0 0 24 24">
            <path
              d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"
              fill="url(#sidebar-chrome-grad)"
            />
          </svg>
        );

      default:
        return null;
    }
  };

  return (
    <aside className="customer-sidebar-3d-wrapper trainer-sidebar-3d" aria-label="Trainer Command Navigation">
      {/* Chrome Gradient Definition */}
      <svg width="0" height="0" style={{ position: "absolute", pointerEvents: "none" }}>
        <defs>
          <linearGradient id="sidebar-chrome-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="30%" stopColor="#f1f5f9" />
            <stop offset="65%" stopColor="#cbd5e1" />
            <stop offset="90%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#64748b" />
          </linearGradient>
        </defs>
      </svg>

      {/* 3D Glassmorphic Sidebar Dock */}
      <div className="customer-sidebar-3d-dock">
        {/* Brand Banner */}
        <div
          className="customer-sidebar-brand"
          onClick={() => onSelectModule?.("section-trainer-dashboard")}
          role="button"
          tabIndex={0}
        >
          <div className="sidebar-brand-disc">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M6.5 6.5h11M6.5 17.5h11M12 3v18M4 10h16M4 14h16" />
            </svg>
          </div>
          <div className="sidebar-brand-text">
            <span className="sidebar-brand-title">FITPULSE</span>
            <span className="sidebar-brand-sub" style={{ color: "#00f2fe" }}>TRAINER COMMAND</span>
          </div>
        </div>

        {/* Modules List with Physical Sliding Capsule */}
        <nav className="customer-sidebar-nav" ref={dockRef}>
          <div className="customer-sidebar-sliding-pill" style={sliderStyle} />

          {trainerModules.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                ref={(el) => (moduleRefs.current[item.id] = el)}
                className={`customer-sidebar-item ${isActive ? "active" : ""}`}
                onClick={() => onSelectModule?.(item.id)}
                title={item.label}
              >
                {/* 3D Circular Disc with Iridescent Optical Rainbow Ring */}
                <div className="sidebar-3d-disc-wrapper">
                  <div className={`sidebar-3d-chromatic-ring ${isActive ? "active-ring" : ""}`} />
                  <div className="sidebar-3d-disc">{renderIcon(item.icon)}</div>
                </div>

                <span className="sidebar-item-label">{item.label}</span>
                <span className="sidebar-item-index">{item.index}</span>
              </button>
            );
          })}
        </nav>

        {/* Coach Identity Capsule, Portal Switcher & Logout */}
        <div className="customer-sidebar-footer">
          {(() => {
            const coachName = trainer?.name || "Trainer";
            const coachSpecialty = trainer?.specialty || "Master Coach • Certified";
            const initials = coachName
              .split(" ")
              .filter(Boolean)
              .map((w) => w[0])
              .join("")
              .slice(0, 2)
              .toUpperCase() || "TR";

            return (
              <div
                className="sidebar-user-card"
                onClick={() => onSelectModule?.("section-trainer-profile")}
                style={{ cursor: "pointer" }}
              >
                <div
                  className="sidebar-user-avatar"
                  style={{ background: "linear-gradient(135deg, #00b4ff 0%, #0050c8 100%)", fontWeight: 800 }}
                >
                  {initials}
                </div>
                <div className="sidebar-user-info">
                  <span className="sidebar-user-name">{coachName}</span>
                  <span className="sidebar-user-role" style={{ color: "#00f2fe" }}>
                    {coachSpecialty}
                  </span>
                </div>
              </div>
            );
          })()}

          <button
            type="button"
            className="sidebar-switch-portal-action"
            onClick={handleSwitchToMember}
            title="Switch to Member Portal"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            <span>Member Portal ↗</span>
          </button>

          <button
            type="button"
            className="sidebar-logout-action"
            onClick={handleLogout}
            title="Sign Out"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

import { useState, useRef, useEffect } from "react";
import "../../styles/customer-sidebar-3d.css";

const sidebarModules = [
  {
    id: "dashboard",
    label: "Dashboard",
    path: "/dashboard",
    index: "01",
    icon: "home",
  },
  {
    id: "workouts",
    label: "Workouts",
    path: "/dashboard/workouts",
    index: "02",
    icon: "dumbbell",
  },
  {
    id: "community",
    label: "Community",
    path: "/dashboard/community",
    index: "03",
    icon: "users",
  },
  {
    id: "nutrition",
    label: "Nutrition",
    path: "/dashboard/nutrition",
    index: "04",
    icon: "salad",
  },
  {
    id: "attendance",
    label: "Attendance",
    path: "/dashboard/attendance",
    index: "05",
    icon: "qr",
  },
  {
    id: "trainers",
    label: "Trainers",
    path: "/dashboard/trainers",
    index: "06",
    icon: "coach",
  },
  {
    id: "progress",
    label: "Progress",
    path: "/dashboard/progress",
    index: "07",
    icon: "chart",
  },
  {
    id: "plans",
    label: "Plans",
    path: "/dashboard/plans",
    index: "08",
    icon: "diamond",
  },
  {
    id: "settings",
    label: "Settings",
    path: "/dashboard/settings",
    index: "09",
    icon: "gear",
  },
];

export default function CustomerSidebar3D({ currentModule = "dashboard" }) {
  const [activeId, setActiveId] = useState(currentModule);
  const [sliderStyle, setSliderStyle] = useState({ opacity: 0 });
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("fitpulse_user") || "{}");
    } catch {
      return {};
    }
  });

  const dockRef = useRef(null);
  const moduleRefs = useRef({});

  // Sync active item when currentModule prop changes
  useEffect(() => {
    setActiveId(currentModule);
  }, [currentModule]);

  // Sync user session from localStorage
  useEffect(() => {
    const syncUser = () => {
      try {
        setUser(JSON.parse(localStorage.getItem("fitpulse_user") || "{}"));
      } catch {}
    };
    syncUser();
    window.addEventListener("storage", syncUser);
    window.addEventListener("popstate", syncUser);
    return () => {
      window.removeEventListener("storage", syncUser);
      window.removeEventListener("popstate", syncUser);
    };
  }, []);

  // Update vertical sliding pill indicator
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
      updateSlider(activeId);
    }, 60);
    return () => clearTimeout(timer);
  }, [activeId]);

  const navigateTo = (path, id) => {
    setActiveId(id);
    updateSlider(id);
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

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

      case "dumbbell":
        return (
          <svg className="sidebar-3d-icon-svg" viewBox="0 0 24 24">
            <path
              d="M6.5 6.5h1.8v11H6.5v-11zm-4 3h2.2v5H2.5v-5zm15-3h1.8v11h-1.8v-11zm4 3h2.2v5h-2.2v-5zM9.5 11h5v2h-5v-2z"
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

      case "salad":
        return (
          <svg className="sidebar-3d-icon-svg" viewBox="0 0 24 24">
            <path
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"
              fill="url(#sidebar-chrome-grad)"
            />
          </svg>
        );

      case "coach":
        return (
          <svg className="sidebar-3d-icon-svg" viewBox="0 0 24 24">
            <path
              d="M12 2a5 5 0 0 0-5 5c0 1.9 1 3.5 2.5 4.3v4.7c0 .6.4 1 1 1h3a1 1 0 0 0 1-1v-2h1a1 1 0 0 0 1-1v-2h-1v-.7c1.5-.8 2.5-2.4 2.5-4.3a5 5 0 0 0-5-5zm0 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4z"
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

      case "diamond":
        return (
          <svg className="sidebar-3d-icon-svg" viewBox="0 0 24 24">
            <path
              d="M6 3.5h12l4 5.5-10 12L2 9l4-5.5zm1.5 2L4.6 8.5h3.6l1.2-3H7.5zm3.5 0l-1.2 3h4.4l-1.2-3h-2zm3.5 0l1.2 3h3.6l-2.9-3h-1.9zm-4.3 4.5h-4.3l7.1 8.5-2.8-8.5zm1.6 0l2.4 7.2 2.4-7.2h-4.8zm6.4 0h-4.3l2.8 8.5 7.1-8.5h-5.6z"
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

      case "gear":
        return (
          <svg className="sidebar-3d-icon-svg" viewBox="0 0 24 24">
            <path
              d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"
              fill="url(#sidebar-chrome-grad)"
            />
          </svg>
        );

      default:
        return null;
    }
  };

  return (
    <aside className="customer-sidebar-3d-wrapper" aria-label="Customer Navigation">
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
          onClick={() => navigateTo("/dashboard", "dashboard")}
          role="button"
          tabIndex={0}
        >
          <div className="sidebar-brand-disc">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
          <div className="sidebar-brand-text">
            <span className="sidebar-brand-title">FITPULSE</span>
            <span className="sidebar-brand-sub">MEMBER PORTAL</span>
          </div>
        </div>

        {/* Modules List with Physical Sliding Capsule */}
        <nav className="customer-sidebar-nav" ref={dockRef}>
          <div className="customer-sidebar-sliding-pill" style={sliderStyle} />

          {sidebarModules.map((item) => {
            const isActive = activeId === item.id;
            return (
              <button
                key={item.id}
                ref={(el) => (moduleRefs.current[item.id] = el)}
                className={`customer-sidebar-item ${isActive ? "active" : ""}`}
                onClick={() => navigateTo(item.path, item.id)}
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

        {/* User Profile & Logout */}
        <div className="customer-sidebar-footer">
          <div className="sidebar-user-card">
            <div className="sidebar-user-avatar">
              {user.avatar && !user.avatar.includes("placeholder") ? (
                <img
                  src={user.avatar}
                  alt={user.name || "Member"}
                  style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }}
                />
              ) : (
                user.name ? user.name.charAt(0).toUpperCase() : "M"
              )}
            </div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{user.name || "Member"}</span>
              <span className="sidebar-user-role">{user.role ? `${user.role} Member` : "Elite Member"}</span>
            </div>
          </div>
          <button
            type="button"
            className="sidebar-logout-action"
            onClick={handleLogout}
            title="Sign Out"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

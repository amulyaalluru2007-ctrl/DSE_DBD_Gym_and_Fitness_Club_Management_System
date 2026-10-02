import { useEffect, useState, useRef } from "react";
import "../styles/navbar-3d.css";

const navModules = [
  {
    id: "home",
    label: "Home",
    target: "top",
  },
  {
    id: "system",
    label: "System",
    target: "system",
  },
  {
    id: "plans",
    label: "Plans",
    target: "plans",
  },
  {
    id: "trainers",
    label: "Trainers",
    target: "trainers",
  },
  {
    id: "performance",
    label: "Performance",
    target: "performance",
  },
];

export default function Navbar() {
  const [activeModule, setActiveModule] = useState("home");
  const [isVisible, setIsVisible] = useState(false);
  const [showPortalMenu, setShowPortalMenu] = useState(false);

  const dockRef = useRef(null);
  const moduleRefs = useRef({});
  const portalMenuRef = useRef(null);
  const [sliderStyle, setSliderStyle] = useState({ opacity: 0 });

  // Update sliding pill position to smoothly glide under active module
  const updateSliderPosition = (targetId) => {
    const activeEl = moduleRefs.current[targetId];
    const dockEl = dockRef.current;
    if (!activeEl || !dockEl) return;

    const dockRect = dockEl.getBoundingClientRect();
    const activeRect = activeEl.getBoundingClientRect();

    const left = activeRect.left - dockRect.left;
    const top = activeRect.top - dockRect.top;
    const width = activeRect.width;
    const height = activeRect.height;

    setSliderStyle({
      transform: `translate(${left}px, ${top}px)`,
      width: `${width}px`,
      height: `${height}px`,
      opacity: 1,
    });
  };

  // Re-calculate slider position whenever activeModule or visibility changes
  useEffect(() => {
    if (isVisible) {
      // Small timeout ensures layout metrics are computed
      const timer = setTimeout(() => {
        updateSliderPosition(activeModule);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [activeModule, isVisible]);

  // Window resize handler
  useEffect(() => {
    const handleResize = () => {
      if (isVisible) updateSliderPosition(activeModule);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [activeModule, isVisible]);

  // Close portal dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (portalMenuRef.current && !portalMenuRef.current.contains(event.target)) {
        setShowPortalMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Track scroll position:
  // 1) Reveal navbar only after user scrolls past initial video frames (e.g. scrollY > 220px)
  // 2) Detect which section is currently active and smoothly glide the active module
  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollY = window.scrollY;

          // Reveal navbar only after user starts scrolling down the video
          const shouldBeVisible = scrollY > 220;
          setIsVisible(shouldBeVisible);

          // Section offsets detection
          const systemEl = document.getElementById("system");
          const plansEl = document.getElementById("plans");
          const trainersEl = document.getElementById("trainers");
          const performanceEl = document.getElementById("performance");

          const threshold = scrollY + window.innerHeight * 0.35;

          let current = "home";
          if (performanceEl && threshold >= performanceEl.offsetTop) {
            current = "performance";
          } else if (trainersEl && threshold >= trainersEl.offsetTop) {
            current = "trainers";
          } else if (plansEl && threshold >= plansEl.offsetTop) {
            current = "plans";
          } else if (systemEl && threshold >= systemEl.offsetTop) {
            current = "system";
          } else {
            current = "home";
          }

          setActiveModule(current);
          if (shouldBeVisible) {
            updateSliderPosition(current);
          }

          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleModuleClick = (mod) => {
    setActiveModule(mod.id);
    updateSliderPosition(mod.id);

    if (mod.target === "top") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      const el = document.getElementById(mod.target);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  const navigateTo = (url) => {
    window.history.pushState({}, "", url);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  // Render 3D embossed silver chrome icons
  const renderIcon = (id) => {
    switch (id) {
      case "home":
        // Exact home icon from media_1789296863879.png
        return (
          <svg className="navbar-3d-icon-svg" viewBox="0 0 24 24">
            <path
              d="M12 3.2L2.5 11.5c-.3.3-.4.7-.2 1.1.2.4.6.6 1 .6h2v6.5c0 .6.4 1.1 1 1.1h3.5v-5h4.4v5h3.5c.6 0 1-.5 1-1.1v-6.5h2c.4 0 .8-.2 1-.6.2-.4.1-.8-.2-1.1L12 3.2z"
              fill="url(#chrome-specular-grad)"
            />
          </svg>
        );

      case "system":
        // 3D Ecosystem Core / Processor Chip
        return (
          <svg className="navbar-3d-icon-svg" viewBox="0 0 24 24">
            <path
              d="M19 8h-1V6a2 2 0 0 0-2-2h-2V3a1 1 0 0 0-2 0v1h-2V3a1 1 0 0 0-2 0v1H6a2 2 0 0 0-2 2v2H3a1 1 0 0 0 0 2h1v2H3a1 1 0 0 0 0 2h1v2a2 2 0 0 0 2 2h2v1a1 1 0 0 0 2 0v-1h2v1a1 1 0 0 0 2 0v-1h2a2 2 0 0 0 2-2v-2h1a1 1 0 0 0 0-2h-1v-2h1a1 1 0 0 0 0-2zM8 8h8v8H8V8zm2 2v4h4v-4h-4z"
              fill="url(#chrome-specular-grad)"
            />
          </svg>
        );

      case "plans":
        // 3D Faceted Diamond / Membership Emblem
        return (
          <svg className="navbar-3d-icon-svg" viewBox="0 0 24 24">
            <path
              d="M6 3.5h12l4 5.5-10 12L2 9l4-5.5zm1.5 2L4.6 8.5h3.6l1.2-3H7.5zm3.5 0l-1.2 3h4.4l-1.2-3h-2zm3.5 0l1.2 3h3.6l-2.9-3h-1.9zm-4.3 4.5h-4.3l7.1 8.5-2.8-8.5zm1.6 0l2.4 7.2 2.4-7.2h-4.8zm6.4 0h-4.3l2.8 8.5 7.1-8.5h-5.6z"
              fill="url(#chrome-specular-grad)"
            />
          </svg>
        );

      case "trainers":
        // 3D Dumbbell / Coach Athlete Badge
        return (
          <svg className="navbar-3d-icon-svg" viewBox="0 0 24 24">
            <path
              d="M6.5 6.5h1.8v11H6.5v-11zm-4 3h2.2v5H2.5v-5zm15-3h1.8v11h-1.8v-11zm4 3h2.2v5h-2.2v-5zM9.5 11h5v2h-5v-2z"
              fill="url(#chrome-specular-grad)"
            />
          </svg>
        );

      case "performance":
        // 3D Activity Telemetry / Biometric Bolt
        return (
          <svg className="navbar-3d-icon-svg" viewBox="0 0 24 24">
            <path
              d="M13 2.5L4 13.5h6v8l9-11h-6v-8z"
              fill="url(#chrome-specular-grad)"
            />
          </svg>
        );

      case "portal":
        // 3D Access Keyhole / Portal Arrow
        return (
          <svg className="navbar-3d-icon-svg" viewBox="0 0 24 24">
            <path
              d="M12 2a5 5 0 0 0-5 5c0 1.9 1 3.5 2.5 4.3v4.7c0 .6.4 1 1 1h3a1 1 0 0 0 1-1v-2h1a1 1 0 0 0 1-1v-2h-1v-.7c1.5-.8 2.5-2.4 2.5-4.3a5 5 0 0 0-5-5zm0 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4z"
              fill="url(#chrome-specular-grad)"
            />
          </svg>
        );

      default:
        return null;
    }
  };

  return (
    <nav className={`navbar-3d-wrapper ${isVisible ? "visible" : ""}`} aria-label="Main Navigation">
      {/* Universal Specular Chrome SVG Gradient Definitions */}
      <svg width="0" height="0" style={{ position: "absolute", pointerEvents: "none" }}>
        <defs>
          <linearGradient id="chrome-specular-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="30%" stopColor="#f1f5f9" />
            <stop offset="65%" stopColor="#cbd5e1" />
            <stop offset="90%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#64748b" />
          </linearGradient>
        </defs>
      </svg>

      {/* Floating 3D Capsule Dock Container */}
      <div className="navbar-3d-dock" ref={dockRef}>
        {/* Physical 3D Liquid Sliding Capsule Pill Indicator */}
        <div className="navbar-3d-sliding-pill" style={sliderStyle} />

        {/* Navigation Modules (Home, System, Plans, Trainers, Performance) */}
        {navModules.map((mod) => {
          const isActive = activeModule === mod.id;
          return (
            <button
              key={mod.id}
              ref={(el) => (moduleRefs.current[mod.id] = el)}
              className={`navbar-3d-module ${isActive ? "active" : ""}`}
              onClick={() => handleModuleClick(mod)}
              title={mod.label}
            >
              {/* Circular 3D Disc with Iridescent Optical Rainbow Ring */}
              <div className="navbar-3d-disc-wrapper">
                <div className={`navbar-3d-chromatic-ring ${isActive ? "active-ring" : ""}`} />
                <div className="navbar-3d-disc">{renderIcon(mod.id)}</div>
              </div>

              {/* Clean Sans-serif Typography Label */}
              <span className="navbar-3d-label">{mod.label}</span>
            </button>
          );
        })}

        {/* Portal / Login 3D Module with Quick Command Selector */}
        <div
          style={{ position: "relative" }}
          ref={(el) => {
            portalMenuRef.current = el;
            moduleRefs.current["portal"] = el;
          }}
        >
          <button
            className={`navbar-3d-module ${showPortalMenu || activeModule === "portal" ? "active" : ""}`}
            onClick={() => setShowPortalMenu(!showPortalMenu)}
            title="Access Portal"
          >
            <div className="navbar-3d-disc-wrapper">
              <div className={`navbar-3d-chromatic-ring ${showPortalMenu ? "active-ring" : ""}`} />
              <div className="navbar-3d-disc">{renderIcon("portal")}</div>
            </div>
            <span className="navbar-3d-label">Portal</span>
          </button>

          {/* Quick Portal Switcher Popover */}
          {showPortalMenu && (
            <div className="navbar-3d-portal-dropdown">
              <button
                className="navbar-3d-portal-opt"
                onClick={() => {
                  setShowPortalMenu(false);
                  navigateTo("/trainer-dashboard");
                }}
              >
                <span className="navbar-3d-portal-opt-icon">🏋️</span>
                <div>
                  <div className="navbar-3d-portal-opt-title">Trainer Command OS</div>
                  <div className="navbar-3d-portal-opt-sub">Coach roster & client plans</div>
                </div>
              </button>

              <button
                className="navbar-3d-portal-opt"
                onClick={() => {
                  setShowPortalMenu(false);
                  navigateTo("/dashboard");
                }}
              >
                <span className="navbar-3d-portal-opt-icon">👤</span>
                <div>
                  <div className="navbar-3d-portal-opt-title">Member Experience</div>
                  <div className="navbar-3d-portal-opt-sub">Workouts, streak & metrics</div>
                </div>
              </button>

              <button
                className="navbar-3d-portal-opt"
                onClick={() => {
                  setShowPortalMenu(false);
                  navigateTo("/login");
                }}
              >
                <span className="navbar-3d-portal-opt-icon">🔐</span>
                <div>
                  <div className="navbar-3d-portal-opt-title">Account Login</div>
                  <div className="navbar-3d-portal-opt-sub">Sign in with credentials</div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
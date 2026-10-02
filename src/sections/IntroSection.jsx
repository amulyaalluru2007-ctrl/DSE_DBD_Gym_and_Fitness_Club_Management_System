import { useEffect, useRef } from "react";

function IntroSection() {
  const sectionRef = useRef(null);
  const progressRef = useRef(null);

  useEffect(() => {
    const section = sectionRef.current;
    const progress = progressRef.current;

    if (!section || !progress) return;

    let animationFrame = null;

    const update = () => {
      const rect = section.getBoundingClientRect();

      const distance =
        section.offsetHeight - window.innerHeight;

      if (distance <= 0) return;

      let value = -rect.top / distance;

      value = Math.max(0, Math.min(1, value));

      section.style.setProperty(
        "--section-progress",
        value
      );

      progress.style.transform =
        `scaleX(${value})`;
    };

    const handleScroll = () => {
      if (animationFrame !== null) return;

      animationFrame =
        requestAnimationFrame(() => {
          update();
          animationFrame = null;
        });
    };

    window.addEventListener("scroll", handleScroll, {
      passive: true,
    });

    update();

    return () => {
      window.removeEventListener("scroll", handleScroll);

      if (animationFrame !== null) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="intro-section"
    >

      <div className="intro-grid" />

      <div className="intro-glow" />

      <div className="intro-topbar">

        <span>
          01
        </span>

        <span className="intro-topbar-center">
          THE SYSTEM
        </span>

        <span className="intro-online">
          <i />
          SYSTEM ONLINE
        </span>

      </div>

      <div className="intro-content">

        <div className="intro-label">

          <span />

          MORE THAN A GYM

        </div>

        <h2 className="intro-title">

          <span>
            YOUR GYM.
          </span>

          <span>
            YOUR
          </span>

          <span className="intro-accent">
            PERFORMANCE.
          </span>

          <span>
            YOUR EVOLUTION.
          </span>

        </h2>

        <div className="intro-bottom">

          <p>
            FitPulse connects your entire
            fitness ecosystem into one
            intelligent experience — members,
            trainers, memberships, workouts,
            attendance and payments.
          </p>

          <div className="intro-stat">

            <strong>
              01
            </strong>

            <span>
              CONNECTED
              <br />
              FITNESS ECOSYSTEM
            </span>

          </div>

        </div>

      </div>

      <div className="intro-progress">

        <div
          ref={progressRef}
          className="intro-progress-fill"
        />

      </div>

      <div className="intro-scroll">
        CONTINUE
        <span>↓</span>
      </div>

    </section>
  );
}

export default IntroSection;
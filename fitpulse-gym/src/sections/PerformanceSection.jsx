import { useEffect, useRef } from "react";

const metrics = [
  {
    label: "STRENGTH",
    value: 84,
    unit: "%",
  },
  {
    label: "ENDURANCE",
    value: 71,
    unit: "%",
  },
  {
    label: "CONSISTENCY",
    value: 93,
    unit: "%",
  },
];

function PerformanceSection() {
  const sectionRef = useRef(null);

  useEffect(() => {
    const section = sectionRef.current;

    if (!section) return;

    const update = () => {
      const rect = section.getBoundingClientRect();

      const distance =
        section.offsetHeight -
        window.innerHeight;

      if (distance <= 0) return;

      let progress =
        -rect.top / distance;

      progress = Math.max(
        0,
        Math.min(1, progress)
      );

      section.style.setProperty(
        "--performance-progress",
        progress
      );
    };

    window.addEventListener(
      "scroll",
      update,
      {
        passive: true,
      }
    );

    update();

    return () => {
      window.removeEventListener(
        "scroll",
        update
      );
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      id="performance"
      className="performance-section"
    >
      <div className="performance-header">

        <span>
          05 / PERFORMANCE
        </span>

        <h2>
          YOUR BODY.
          <br />
          <span>YOUR DATA.</span>
        </h2>

      </div>

      <div className="performance-dashboard">

        <div className="dashboard-top">

          <span>
            PERFORMANCE OVERVIEW
          </span>

          <span>
            LIVE
            <i />
          </span>

        </div>

        <div className="performance-main">

          <div className="performance-score">

            <span>
              OVERALL
            </span>

            <strong>
              87
            </strong>

            <small>
              PERFORMANCE INDEX
            </small>

          </div>

          <div className="performance-chart">

            <div className="chart-lines">
              <span />
              <span />
              <span />
              <span />
            </div>

            <svg
              viewBox="0 0 600 220"
              preserveAspectRatio="none"
            >
              <polyline
                points="
                  0,185
                  70,170
                  130,178
                  190,130
                  250,145
                  310,105
                  375,118
                  435,72
                  500,91
                  555,45
                  600,58
                "
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
              />
            </svg>

          </div>

        </div>

        <div className="metric-grid">

          {metrics.map((metric) => (
            <div
              className="metric-card"
              key={metric.label}
            >
              <span>
                {metric.label}
              </span>

              <strong>
                {metric.value}
                {metric.unit}
              </strong>

              <div className="metric-bar">

                <div
                  style={{
                    width:
                      `${metric.value}%`,
                  }}
                />

              </div>

            </div>
          ))}

        </div>

      </div>
    </section>
  );
}

export default PerformanceSection;
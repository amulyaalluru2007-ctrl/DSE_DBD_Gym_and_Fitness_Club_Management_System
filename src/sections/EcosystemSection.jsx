import { useEffect, useRef } from "react";

const features = [
  {
    number: "01",
    title: "MEMBERS",
    description:
      "Profiles, memberships, progress and personal fitness information in one connected space.",
  },
  {
    number: "02",
    title: "TRAINERS",
    description:
      "Manage trainers, specializations, schedules and member relationships.",
  },
  {
    number: "03",
    title: "WORKOUTS",
    description:
      "Build structured workout programs and track performance over time.",
  },
  {
    number: "04",
    title: "MEMBERSHIPS",
    description:
      "Explore plans, benefits, renewals and upgrades without friction.",
  },
  {
    number: "05",
    title: "ATTENDANCE",
    description:
      "Fast QR check-in keeps every visit connected to the member profile.",
  },
  {
    number: "06",
    title: "PAYMENTS",
    description:
      "Keep membership payments and transaction history organized.",
  },
];

function EcosystemSection() {
  const sectionRef = useRef(null);

  useEffect(() => {
    const section = sectionRef.current;

    if (!section) return;

    const handleScroll = () => {
      const rect = section.getBoundingClientRect();

      const distance =
        section.offsetHeight -
        window.innerHeight;

      if (distance <= 0) return;

      let progress = -rect.top / distance;

      progress = Math.max(
        0,
        Math.min(1, progress)
      );

      section.style.setProperty(
        "--ecosystem-progress",
        progress
      );
    };

    window.addEventListener("scroll", handleScroll, {
      passive: true,
    });

    handleScroll();

    return () => {
      window.removeEventListener(
        "scroll",
        handleScroll
      );
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      id="system"
      className="ecosystem-section"
    >
      <div className="section-grid" />

      <div className="section-heading">

        <div className="section-index">
          02 / ECOSYSTEM
        </div>

        <h2>
          EVERYTHING
          <br />
          CONNECTED.
        </h2>

        <p>
          One operating layer for the entire
          fitness experience.
        </p>

      </div>

      <div className="ecosystem-core">

        <div className="core-ring ring-one" />
        <div className="core-ring ring-two" />
        <div className="core-ring ring-three" />

        <div className="core-center">

          <div className="core-symbol">
            F
          </div>

          <strong>
            FITPULSE
          </strong>

          <span>
            FITNESS OS
          </span>

        </div>

        {features.map((feature, index) => (
          <div
            key={feature.number}
            className={`ecosystem-node node-${index + 1}`}
          >
            <span className="node-number">
              {feature.number}
            </span>

            <div>
              <strong>
                {feature.title}
              </strong>

              <p>
                {feature.description}
              </p>
            </div>
          </div>
        ))}

      </div>

      <div className="ecosystem-bottom">
        <span>
          06 CORE SYSTEMS
        </span>

        <span>
          ONE EXPERIENCE
        </span>
      </div>
    </section>
  );
}

export default EcosystemSection;
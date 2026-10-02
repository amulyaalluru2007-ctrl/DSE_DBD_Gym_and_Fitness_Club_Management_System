import { useEffect, useRef } from "react";

const plans = [
  {
    name: "CORE",
    price: "₹1,499",
    period: "/ month",
    description:
      "Everything needed to build a consistent training routine.",
    features: [
      "Gym access",
      "Basic workout tracking",
      "Attendance tracking",
      "Member profile",
    ],
  },
  {
    name: "PRO",
    price: "₹2,499",
    period: "/ month",
    description:
      "A deeper fitness experience for members ready to progress.",
    features: [
      "Unlimited gym access",
      "Trainer assistance",
      "Advanced workouts",
      "Performance tracking",
      "Priority support",
    ],
    featured: true,
  },
  {
    name: "ELITE",
    price: "₹3,999",
    period: "/ month",
    description:
      "The complete performance-focused experience.",
    features: [
      "Everything in PRO",
      "Personal trainer",
      "Custom workout plans",
      "Advanced analytics",
      "Priority scheduling",
    ],
  },
];

function MembershipSection() {
  const sectionRef = useRef(null);

  const navigateTo = (path) => {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const handleSelectPlan = (plan) => {
    try {
      const stored = localStorage.getItem("fitpulse_user");
      if (stored) {
        navigateTo("/dashboard/plans");
        return;
      }
    } catch {}
    navigateTo("/login");
  };

  useEffect(() => {
    const section = sectionRef.current;

    if (!section) return;

    const update = () => {
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
        "--plans-progress",
        progress
      );
    };

    window.addEventListener("scroll", update, {
      passive: true,
    });

    update();

    return () => {
      window.removeEventListener("scroll", update);
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      id="plans"
      className="membership-section"
    >
      <div className="plans-header">

        <span>
          03 / MEMBERSHIPS
        </span>

        <h2>
          CHOOSE
          <br />
          YOUR LEVEL.
        </h2>

        <p>
          Flexible plans designed around
          different levels of commitment.
        </p>

      </div>

      <div className="plans-grid">

        {plans.map((plan, index) => (
          <article
            key={plan.name}
            className={`plan-card ${
              plan.featured
                ? "plan-featured"
                : ""
            }`}
            style={{
              "--card-index": index,
            }}
          >
            {plan.featured && (
              <div className="plan-badge">
                MOST POPULAR
              </div>
            )}

            <div className="plan-number">
              0{index + 1}
            </div>

            <h3>
              {plan.name}
            </h3>

            <p className="plan-description">
              {plan.description}
            </p>

            <div className="plan-price">
              {plan.price}

              <span>
                {plan.period}
              </span>
            </div>

            <div className="plan-divider" />

            <ul>
              {plan.features.map((feature) => (
                <li key={feature}>
                  <span>+</span>
                  {feature}
                </li>
              ))}
            </ul>

            <button
              className="plan-button"
              type="button"
              onClick={() => handleSelectPlan(plan)}
            >
              SELECT PLAN
              <span>→</span>
            </button>
          </article>
        ))}

      </div>
    </section>
  );
}

export default MembershipSection;
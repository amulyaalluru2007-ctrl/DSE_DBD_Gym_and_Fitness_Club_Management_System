const steps = [
  {
    number: "01",
    title: "JOIN",
    description: "Create your fitness identity.",
  },
  {
    number: "02",
    title: "CHOOSE PLAN",
    description: "Select the membership built for you.",
  },
  {
    number: "03",
    title: "MEET TRAINER",
    description: "Connect with the right coach.",
  },
  {
    number: "04",
    title: "GET WORKOUT",
    description: "Receive a structured training plan.",
  },
  {
    number: "05",
    title: "TRACK PROGRESS",
    description: "Turn every session into measurable data.",
  },
  {
    number: "06",
    title: "TRANSFORM",
    description: "Become the next version of yourself.",
  },
];

function ProcessSection() {
  return (
    <section className="process-section">

      <div className="process-heading">

        <span>
          08 / THE JOURNEY
        </span>

        <h2>
          FROM
          <br />

          <span>
            INTENT
          </span>

          <br />

          TO
          <br />

          <span>
            TRANSFORMATION.
          </span>
        </h2>

      </div>

      <div className="process-track">

        <div className="process-line" />

        {steps.map((step) => (
          <div
            className="process-step"
            key={step.number}
          >

            <div className="process-number">
              {step.number}
            </div>

            <div className="process-dot" />

            <div className="process-step-content">

              <strong>
                {step.title}
              </strong>

              <p>
                {step.description}
              </p>

            </div>

          </div>
        ))}

      </div>

    </section>
  );
}

export default ProcessSection;
function TrainersSection() {
  const navigateTo = (path) => {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const handleExploreTrainers = () => {
    try {
      const stored = localStorage.getItem("fitpulse_user");
      if (stored) {
        navigateTo("/dashboard/trainers");
        return;
      }
    } catch {}
    navigateTo("/login");
  };

  return (
    <section
      id="trainers"
      className="trainers-section"
    >
      <div className="trainers-content">

        <div className="trainers-heading">

          <span>
            04 / TRAINERS
          </span>

          <h2>
            TRAIN
            <br />
            WITH
            <br />
            PURPOSE.
          </h2>

        </div>

        <div className="trainer-feature">

          <div className="trainer-image">
            <div className="trainer-placeholder">
              TRAINER
              <span>PROFILE 001</span>
            </div>

            <div className="trainer-image-overlay" />
          </div>

          <div className="trainer-info">

            <div>
              <span className="trainer-label">
                PERFORMANCE COACH
              </span>

              <h3>
                YOUR TRAINING.
                <br />
                <span>YOUR STANDARD.</span>
              </h3>
            </div>

            <p>
              Connect members with trainers,
              manage specializations and create
              a more focused training experience.
            </p>

            <div className="trainer-stats">

              <div>
                <strong>
                  08+
                </strong>

                <span>
                  SPECIALIZATIONS
                </span>
              </div>

              <div>
                <strong>
                  1:1
                </strong>

                <span>
                  COACHING
                </span>
              </div>

              <div>
                <strong>
                  24/7
                </strong>

                <span>
                  PROFILE ACCESS
                </span>
              </div>

            </div>

            <div style={{ marginTop: "1.5rem" }}>
              <button
                type="button"
                className="plan-button"
                onClick={handleExploreTrainers}
                style={{ cursor: "pointer" }}
              >
                CONNECT WITH TRAINERS
                <span>→</span>
              </button>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
}

export default TrainersSection;
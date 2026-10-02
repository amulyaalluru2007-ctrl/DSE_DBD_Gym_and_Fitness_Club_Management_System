function FinalSection() {
  const navigateTo = (path) => {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const handleEnterClick = () => {
    navigateTo("/login");
  };

  return (
    <section className="final-section">

      <div className="final-grid" />

      <div className="final-content">

        <span>
          09 / BEGIN
        </span>

        <h2>
          YOUR NEXT
          <br />
          LEVEL
          <br />
          <span>
            STARTS HERE.
          </span>
        </h2>

        <p>
          Stop managing your fitness experience
          like it's 2015.
        </p>

        <button
          type="button"
          onClick={handleEnterClick}
          style={{ cursor: "pointer" }}
        >
          ENTER FITPULSE OS
          <span>↗</span>
        </button>

      </div>

      <div className="final-footer">

        <span>
          FITPULSE OS
        </span>

        <span>
          FITNESS BEYOND LIMITS
        </span>

        <span>
          © 2026
        </span>

      </div>

    </section>
  );
}

export default FinalSection;
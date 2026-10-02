function AttendanceSection() {
  const navigateTo = (path) => {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const handleScannerClick = () => {
    navigateTo("/attendance-login");
  };

  return (
    <section className="attendance-section">

      <div className="attendance-copy">

        <span>
          06 / ATTENDANCE
        </span>

        <h2>
          TAP.
          <br />
          SCAN.
          <br />
          <span>TRAIN.</span>
        </h2>

        <p>
          A fast QR-powered check-in
          experience that keeps every visit
          connected to the member profile.
        </p>

        <div style={{ marginTop: "1.5rem" }}>
          <button
            type="button"
            className="plan-button"
            onClick={handleScannerClick}
            style={{ cursor: "pointer" }}
          >
            OPEN ATTENDANCE KIOSK
            <span>→</span>
          </button>
        </div>

      </div>

      <div
        className="scanner"
        onClick={handleScannerClick}
        style={{ cursor: "pointer" }}
        title="Click to launch Turnstile Scanner"
      >

        <div className="scanner-top">
          <span>
            FITPULSE ACCESS
          </span>

          <span>
            SECURE
          </span>
        </div>

        <div className="qr-frame">

          <div className="qr-pattern">
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>

          <div className="scan-line" />

        </div>

        <div className="scanner-status">

          <div className="scanner-dot" />

          <span>
            READY TO SCAN
          </span>

        </div>

      </div>

    </section>
  );
}

export default AttendanceSection;
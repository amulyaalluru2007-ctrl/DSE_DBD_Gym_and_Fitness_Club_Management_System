import { useEffect, useRef, useState } from "react";

const TOTAL_FRAMES = 240;

const clamp = (value, min, max) => {
  return Math.max(min, Math.min(max, value));
};

function HeroVideo() {
  const sectionRef = useRef(null);
  const canvasRef = useRef(null);

  const framesRef = useRef([]);
  const currentFrameRef = useRef(0);
  const targetFrameRef = useRef(0);

  const animationRef = useRef(null);
  const scrollRef = useRef(null);

  const [loadedFrames, setLoadedFrames] = useState(0);
  const [ready, setReady] = useState(false);

  const navigateTo = (path) => {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const handleEnterClick = () => {
    try {
      const stored = localStorage.getItem("fitpulse_user");
      if (stored) {
        const user = JSON.parse(stored);
        if (user.role === "Admin") {
          navigateTo("/admin-dashboard");
          return;
        } else if (user.role === "Trainer") {
          navigateTo("/trainer-dashboard");
          return;
        } else if (user.role === "Member") {
          navigateTo("/dashboard");
          return;
        }
      }
    } catch {}
    navigateTo("/login");
  };

  const handleMenuClick = () => {
    const sysEl = document.getElementById("system") || document.getElementById("plans");
    if (sysEl) {
      sysEl.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      window.scrollTo({ top: window.innerHeight, behavior: "smooth" });
    }
  };

  useEffect(() => {
    let cancelled = false;

    const frames = [];
    let loaded = 0;

    for (let i = 1; i <= TOTAL_FRAMES; i += 1) {
      const image = new Image();

      image.src = `/frames/frame-${String(i).padStart(3, "0")}.webp`;

      image.onload = () => {
        if (cancelled) return;

        loaded += 1;
        setLoadedFrames(loaded);
      };

      image.onerror = () => {
        console.error(`Could not load frame ${i}`);
      };

      frames.push(image);
    }

    framesRef.current = frames;

    const checkReady = window.setInterval(() => {
      if (cancelled) return;

      const allLoaded = frames.every(
        (image) => image.complete && image.naturalWidth > 0
      );

      if (allLoaded) {
        window.clearInterval(checkReady);
        setReady(true);
      }
    }, 50);

    return () => {
      cancelled = true;
      window.clearInterval(checkReady);
    };
  }, []);

  const drawFrame = (frameNumber) => {
    const canvas = canvasRef.current;
    const frames = framesRef.current;

    if (!canvas || frames.length === 0) return;

    const image = frames[frameNumber];

    if (!image || !image.complete || image.naturalWidth === 0) {
      return;
    }

    const context = canvas.getContext("2d");

    if (!context) return;

    const width = canvas.width;
    const height = canvas.height;

    const imageWidth = image.naturalWidth;
    const imageHeight = image.naturalHeight;

    const imageRatio = imageWidth / imageHeight;
    const canvasRatio = width / height;

    let drawWidth;
    let drawHeight;
    let offsetX;
    let offsetY;

    if (imageRatio > canvasRatio) {
      drawHeight = height;
      drawWidth = height * imageRatio;

      offsetX = (width - drawWidth) / 2;
      offsetY = 0;
    } else {
      drawWidth = width;
      drawHeight = width / imageRatio;

      offsetX = 0;
      offsetY = (height - drawHeight) / 2;
    }

    context.clearRect(0, 0, width, height);

    context.drawImage(
      image,
      offsetX,
      offsetY,
      drawWidth,
      drawHeight
    );

    currentFrameRef.current = frameNumber;
  };

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const resizeCanvas = () => {
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.floor(window.innerWidth * pixelRatio);
      canvas.height = Math.floor(window.innerHeight * pixelRatio);

      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;

      if (ready) {
        drawFrame(currentFrameRef.current);
      }
    };

    resizeCanvas();

    window.addEventListener("resize", resizeCanvas);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [ready]);

  useEffect(() => {
    if (!ready) return;

    const section = sectionRef.current;

    if (!section) return;

    const updateScroll = () => {
      scrollRef.current = null;

      const rect = section.getBoundingClientRect();

      const scrollDistance =
        section.offsetHeight - window.innerHeight;

      if (scrollDistance <= 0) return;

      let progress = -rect.top / scrollDistance;

      progress = clamp(progress, 0, 1);

      const targetFrame = Math.round(
        progress * (TOTAL_FRAMES - 1)
      );

      targetFrameRef.current = targetFrame;

      /*
       * GUI timing
       *
       * 0.00 - 0.28
       * Cinematic + FitPulse cloud title
       *
       * 0.28 - 0.45
       * GUI begins appearing
       *
       * 0.45 - 0.70
       * Main title appears
       *
       * 0.70 - 0.88
       * Description + button
       *
       * 0.88 - 1.00
       * Complete GUI + final frame
       */

      let guiProgress = 0;

      if (progress > 0.28) {
        guiProgress = (progress - 0.28) / 0.72;
      }

      guiProgress = clamp(guiProgress, 0, 1);

      section.style.setProperty(
        "--gui-progress",
        guiProgress
      );

      section.style.setProperty(
        "--cinematic-progress",
        progress
      );
    };

    const handleScroll = () => {
      if (scrollRef.current !== null) return;

      scrollRef.current = requestAnimationFrame(updateScroll);
    };

    window.addEventListener("scroll", handleScroll, {
      passive: true,
    });

    updateScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);

      if (scrollRef.current !== null) {
        cancelAnimationFrame(scrollRef.current);
      }
    };
  }, [ready]);

  useEffect(() => {
    if (!ready) return;

    const animate = () => {
      const current = currentFrameRef.current;
      const target = targetFrameRef.current;

      const difference = target - current;

      if (difference !== 0) {
        const step = Math.max(
          1,
          Math.ceil(Math.abs(difference) * 0.18)
        );

        let nextFrame;

        if (difference > 0) {
          nextFrame = current + step;
        } else {
          nextFrame = current - step;
        }

        nextFrame = clamp(
          nextFrame,
          0,
          TOTAL_FRAMES - 1
        );

        drawFrame(nextFrame);
      }

      animationRef.current =
        requestAnimationFrame(animate);
    };

    animationRef.current =
      requestAnimationFrame(animate);

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [ready]);

  useEffect(() => {
    if (!ready) return;

    currentFrameRef.current = 0;
    targetFrameRef.current = 0;

    drawFrame(0);
  }, [ready]);

  const loadingPercentage = Math.round(
    (loadedFrames / TOTAL_FRAMES) * 100
  );

  return (
    <section
      ref={sectionRef}
      className="hero-video-section"
    >
      <div className="hero-video-sticky">

        <canvas
          ref={canvasRef}
          className="hero-canvas"
        />

        <div className="hero-vignette" />

        <div className="hero-film-grain" />

        <div className="hero-overlay">

          {/* HEADER */}

          <header className="hero-header">

            <div className="brand">

              <div className="brand-symbol">
                F
              </div>

              <div>
                <div className="brand-name">
                  FITPULSE OS
                </div>

                <div className="brand-tagline">
                  FITNESS BEYOND LIMITS
                </div>
              </div>

            </div>

            <div className="hero-system-status">
              <span className="status-dot" />
              SYSTEM ONLINE
            </div>

            <button
              className="menu-button"
              type="button"
              aria-label="Open menu"
              onClick={handleMenuClick}
            >
              <span />
              <span />
              <span />
            </button>

          </header>

          {/* MAIN GUI */}

          <div className="hero-content">

            <div className="hero-eyebrow">

              <span className="eyebrow-symbol">
                ϟ
              </span>

              <span>
                LIVING FITNESS
                <br className="desktop-break" />
                OPERATING SYSTEM
              </span>

            </div>

            <h1 className="hero-title">

              <span className="title-line-one">
                DISCIPLINE
              </span>

              <span className="title-line-two">
                <span className="title-accent">
                  BUILDS
                </span>{" "}
                FREEDOM.
              </span>

            </h1>

            <p className="hero-description">
              A cinematic management ecosystem
              for members, trainers and modern gyms.
            </p>

            <div className="hero-actions">

              <button
                className="enter-button"
                type="button"
                onClick={handleEnterClick}
              >
                <span>
                  Enter FITPULSE OS
                </span>

                <span className="arrow">
                  →
                </span>
              </button>

              <div className="scroll-indicator">

                <div className="mouse">
                  <div className="mouse-wheel" />
                </div>

                <span>
                  Scroll to explore
                </span>

              </div>

            </div>

          </div>

          {/* LOWER INFORMATION */}

          <div className="hero-frame-info">

            <span>
              CINEMATIC ENTRY
            </span>

            <span className="frame-divider">
              /
            </span>

            <span>
              240 FRAMES
            </span>

          </div>

          <div className="hero-progress">

            <div className="hero-progress-track">

              <div className="hero-progress-fill" />

            </div>

            <span className="hero-progress-label">
              SCROLL
            </span>

          </div>

        </div>
      </div>

      {/* LOADING */}

      {!ready && (
        <div className="frame-loader">

          <div className="loader-brand">
            FITPULSE OS
          </div>

          <div className="loader-label">
            INITIALIZING CINEMATIC SYSTEM
          </div>

          <div className="loader-number">
            {loadingPercentage}%
          </div>

          <div className="loader-line">

            <div
              className="loader-progress"
              style={{
                width: `${loadingPercentage}%`,
              }}
            />

          </div>

        </div>
      )}

    </section>
  );
}

export default HeroVideo;
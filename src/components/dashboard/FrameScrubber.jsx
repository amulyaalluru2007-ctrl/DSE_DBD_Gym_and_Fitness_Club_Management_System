import { useEffect, useRef, useState } from "react";

const TOTAL_FRAMES = 240;

function FrameScrubber() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const framesRef = useRef([]);
  const animFrameIdRef = useRef(null);

  const [currentFrame, setCurrentFrame] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loadedPercent, setLoadedPercent] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  // Preload frames progressively
  useEffect(() => {
    let cancelled = false;
    const frames = [];
    let loaded = 0;

    for (let i = 1; i <= TOTAL_FRAMES; i += 1) {
      const img = new Image();
      img.src = `/frames/frame-${String(i).padStart(3, "0")}.webp`;
      img.onload = () => {
        if (cancelled) return;
        loaded += 1;
        setLoadedPercent(Math.round((loaded / TOTAL_FRAMES) * 100));
      };
      frames.push(img);
    }
    framesRef.current = frames;

    return () => {
      cancelled = true;
    };
  }, []);

  // Draw current frame on canvas with aspect-ratio cover/contain
  const renderFrame = (frameNum) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const frameIndex = Math.max(0, Math.min(TOTAL_FRAMES - 1, frameNum - 1));
    const img = framesRef.current[frameIndex];

    if (!img || !img.complete || img.naturalWidth === 0) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const imgRatio = img.naturalWidth / img.naturalHeight;
    const canvasRatio = width / height;

    let drawW, drawH, offsetX, offsetY;

    if (imgRatio > canvasRatio) {
      drawH = height;
      drawW = height * imgRatio;
      offsetX = (width - drawW) / 2;
      offsetY = 0;
    } else {
      drawW = width;
      drawH = width / imgRatio;
      offsetX = 0;
      offsetY = (height - drawH) / 2;
    }

    ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
  };

  // Resize canvas according to container and DPR
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const handleResize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = container.getBoundingClientRect();
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      renderFrame(currentFrame);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [currentFrame, loadedPercent]);

  // Handle auto-play loop
  useEffect(() => {
    if (!isPlaying) {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      return;
    }

    let lastTime = performance.now();
    const fps = 30 * playbackSpeed;
    const interval = 1000 / fps;

    const loop = (now) => {
      const elapsed = now - lastTime;
      if (elapsed >= interval) {
        lastTime = now - (elapsed % interval);
        setCurrentFrame((prev) => (prev >= TOTAL_FRAMES ? 1 : prev + 1));
      }
      animFrameIdRef.current = requestAnimationFrame(loop);
    };

    animFrameIdRef.current = requestAnimationFrame(loop);
    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [isPlaying, playbackSpeed]);

  // Handle scroll wheel on canvas to scrub
  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 2 : -2;
    setCurrentFrame((prev) => {
      let next = prev + delta;
      if (next < 1) next = 1;
      if (next > TOTAL_FRAMES) next = TOTAL_FRAMES;
      return next;
    });
  };

  const handleSliderChange = (e) => {
    setCurrentFrame(Number(e.target.value));
  };

  return (
    <div className="dash-scrubber-card">
      <div className="dash-scrubber-header">
        <div className="dash-scrubber-title-group">
          <span className="dash-scrubber-badge">MOTION STUDIO</span>
          <h3>FITPULSE Interactive Kinetic Visualizer</h3>
        </div>
        <div className="dash-scrubber-meta">
          <span className="dash-scrubber-frame-tag">
            FRAME {String(currentFrame).padStart(3, "0")} / {TOTAL_FRAMES}
          </span>
          <span className="dash-scrubber-scroll-hint">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M19 12l-7 7-7-7" />
            </svg>
            Scroll / Drag to scrub
          </span>
        </div>
      </div>

      <div
        className="dash-scrubber-viewport"
        ref={containerRef}
        onWheel={handleWheel}
      >
        <canvas ref={canvasRef} className="dash-scrubber-canvas" />

        {/* Ambient overlay badges */}
        <div className="dash-scrubber-overlay-tag top-left">
          <span>KINETIC HUD</span>
          <strong>3D RENDER STREAM</strong>
        </div>

        <div className="dash-scrubber-overlay-tag bottom-right">
          <span>CINEMATIC SCROLLER</span>
          <strong>240 WEBP SEQUENCE</strong>
        </div>

        {loadedPercent < 100 && (
          <div className="dash-scrubber-loader-pill">
            <span>Preloading frames... {loadedPercent}%</span>
          </div>
        )}
      </div>

      {/* Scrub Controls Bar */}
      <div className="dash-scrubber-controls">
        <button
          type="button"
          className="dash-scrub-play-btn"
          onClick={() => setIsPlaying(!isPlaying)}
          title={isPlaying ? "Pause Playback" : "Auto Play"}
        >
          {isPlaying ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          )}
          <span>{isPlaying ? "PAUSE" : "AUTO PLAY"}</span>
        </button>

        <div className="dash-scrub-slider-wrapper">
          <input
            type="range"
            min="1"
            max={TOTAL_FRAMES}
            value={currentFrame}
            onChange={handleSliderChange}
            className="dash-scrub-slider"
          />
          <div
            className="dash-scrub-slider-fill"
            style={{ width: `${(currentFrame / TOTAL_FRAMES) * 100}%` }}
          />
        </div>

        <div className="dash-scrub-speed-group">
          {[1, 1.5, 2].map((speed) => (
            <button
              key={speed}
              type="button"
              className={`dash-speed-pill ${playbackSpeed === speed ? "active" : ""}`}
              onClick={() => setPlaybackSpeed(speed)}
            >
              {speed}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default FrameScrubber;

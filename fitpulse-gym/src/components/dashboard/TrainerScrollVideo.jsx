import { useEffect, useRef, useState } from "react";

const TOTAL_FRAMES = 240;

export default function TrainerScrollVideo({ scrollProgress = 0 }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const framesRef = useRef([]);
  const currentFrameRef = useRef(0);
  const targetFrameRef = useRef(0);
  const animIdRef = useRef(null);
  const hasDrawnInitialRef = useRef(false);

  const [loadedCount, setLoadedCount] = useState(0);
  const [currentDisplayFrame, setCurrentDisplayFrame] = useState(1);
  const [ready, setReady] = useState(false);

  // Preload all 240 frames from public/Trainer_Frames
  useEffect(() => {
    let cancelled = false;
    const frames = [];
    let loaded = 0;

    for (let i = 1; i <= TOTAL_FRAMES; i += 1) {
      const img = new Image();
      const numStr = String(i).padStart(3, "0");
      img.src = `/Trainer_Frames/frame-${numStr}.png`;

      img.onload = () => {
        if (cancelled) return;
        loaded += 1;
        setLoadedCount(loaded);

        if (i === 1 && canvasRef.current) {
          drawFrame(0);
          hasDrawnInitialRef.current = true;
        }

        if (loaded >= 15) {
          setReady(true);
        }
      };

      img.onerror = () => {
        /* silent fallback */
      };

      frames.push(img);
    }

    framesRef.current = frames;

    return () => {
      cancelled = true;
    };
  }, []);

  // Update target frame when scroll progress changes
  useEffect(() => {
    const clampedProgress = Math.max(0, Math.min(1, scrollProgress));
    targetFrameRef.current = clampedProgress * (TOTAL_FRAMES - 1);
  }, [scrollProgress]);

  // Function to draw a specific frame onto the canvas with cover scaling
  const drawFrame = (frameIdx) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const frames = framesRef.current;
    if (!frames || frames.length === 0) return;

    const validIdx = Math.max(0, Math.min(TOTAL_FRAMES - 1, Math.round(frameIdx)));
    let image = frames[validIdx];
    if (!image || !image.complete || image.naturalWidth === 0) {
      image = frames[0] && frames[0].complete && frames[0].naturalWidth > 0 ? frames[0] : null;
    }

    if (!image || !image.complete || image.naturalWidth === 0) return;

    const w = canvas.width;
    const h = canvas.height;
    if (w === 0 || h === 0) return;

    // Cover calculation preserving aspect ratio
    const imgRatio = image.naturalWidth / image.naturalHeight;
    const canvasRatio = w / h;

    let drawW;
    let drawH;
    let offX;
    let offY;

    if (imgRatio > canvasRatio) {
      drawH = h;
      drawW = h * imgRatio;
      offX = (w - drawW) / 2;
      offY = 0;
    } else {
      drawW = w;
      drawH = w / imgRatio;
      offX = 0;
      offY = (h - drawH) / 2;
    }

    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(image, offX, offY, drawW, drawH);
  };

  // High-performance 60fps RAF lerp loop
  useEffect(() => {
    const renderLoop = () => {
      const target = targetFrameRef.current;
      const current = currentFrameRef.current;
      const diff = target - current;

      if (Math.abs(diff) > 0.01) {
        currentFrameRef.current = current + diff * 0.16;
        drawFrame(currentFrameRef.current);
        setCurrentDisplayFrame(Math.round(currentFrameRef.current) + 1);
        hasDrawnInitialRef.current = true;
      } else if (!hasDrawnInitialRef.current && framesRef.current[0]?.complete) {
        drawFrame(0);
        hasDrawnInitialRef.current = true;
      }

      animIdRef.current = requestAnimationFrame(renderLoop);
    };

    animIdRef.current = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animIdRef.current);
  }, []);

  // Responsive canvas resize handler
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = container.getBoundingClientRect();
      const w = rect.width || window.innerWidth - 260;
      const h = rect.height || window.innerHeight;

      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      hasDrawnInitialRef.current = false;
      drawFrame(currentFrameRef.current);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="dash-scroll-video-container trainer-video-container" ref={containerRef}>
      {/* 60fps Canvas drawing 240 high-definition trainer frames */}
      <canvas ref={canvasRef} className="dash-scroll-video-media" />

      {/* Cinematic Dark Vignette Overlay */}
      <div className="dash-scroll-video-vignette" />

      {/* Real-Time Scroll Telemetry HUD */}
      <div className="dash-video-scrub-hud">
        <div className="dash-hud-pill trainer-hud-pill">
          <span className="dash-hud-dot" />
          <span className="dash-hud-title">TRAINER COMMAND</span>
          <span className="dash-hud-time">
            FRAME {String(currentDisplayFrame).padStart(3, "0")} / {TOTAL_FRAMES}
          </span>
          <span className="dash-hud-pct">
            {Math.round(scrollProgress * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
}

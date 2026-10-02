import { useEffect, useRef, useState } from "react";
import Gym3DScene from "./Gym3DScene";

// Pixel frame reference: 9 individual angles provided by user in public/hero_frames
export const HERO_FRAMES = [
  { index: 0, angle: 0, label: "0° FRONT VIEW", file: "/hero_frames/frame_01_0deg_front.png", pixelX: 0 },
  { index: 1, angle: 45, label: "45° FRONT RIGHT", file: "/hero_frames/frame_02_45deg_front_right.png", pixelX: 72 },
  { index: 2, angle: 90, label: "90° RIGHT SIDE", file: "/hero_frames/frame_03_90deg_right_side.png", pixelX: 144 },
  { index: 3, angle: 135, label: "135° BACK RIGHT", file: "/hero_frames/frame_04_135deg_back_right.png", pixelX: 216 },
  { index: 4, angle: 180, label: "180° BACK VIEW", file: "/hero_frames/frame_05_180deg_back.png", pixelX: 288 },
  { index: 5, angle: 225, label: "225° BACK LEFT", file: "/hero_frames/frame_06_225deg_back_left.png", pixelX: 360 },
  { index: 6, angle: 270, label: "270° LEFT SIDE", file: "/hero_frames/frame_07_270deg_left_side.png", pixelX: 432 },
  { index: 7, angle: 315, label: "315° FRONT LEFT", file: "/hero_frames/frame_08_315deg_front_left.png", pixelX: 504 },
  { index: 8, angle: 360, label: "360° FRONT AGAIN", file: "/hero_frames/frame_09_360deg_front_again.png", pixelX: 576 },
];

function Hero3DStage({ scrollProgress = 0 }) {
  const canvasRef = useRef(null);
  const stageRef = useRef(null);
  const [smoothedProgress, setSmoothedProgress] = useState(0);

  // Preload all 9 sliced frame images immediately on mount for zero-latency rotation
  useEffect(() => {
    HERO_FRAMES.forEach((frame) => {
      const img = new Image();
      img.src = frame.file;
    });
  }, []);

  // Smooth lerp for scroll progress to guarantee lag-free 60fps rotation
  useEffect(() => {
    let animId;
    const targetProgress = Math.max(0, Math.min(1, scrollProgress));

    const update = () => {
      setSmoothedProgress((prev) => {
        const diff = targetProgress - prev;
        if (Math.abs(diff) < 0.0004) return targetProgress;
        return prev + diff * 0.14;
      });
      animId = requestAnimationFrame(update);
    };

    animId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animId);
  }, [scrollProgress]);

  // Ambient floating particles on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    const particles = Array.from({ length: 40 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 2 + 0.8,
      speedY: Math.random() * 0.35 + 0.12,
      speedX: (Math.random() - 0.5) * 0.2,
      alpha: Math.random() * 0.5 + 0.2,
      color: Math.random() > 0.4 ? "#00f0ff" : "#818cf8",
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      particles.forEach((p) => {
        p.y -= p.speedY;
        p.x += p.speedX;

        if (p.y < 0) p.y = height;
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 8;
        ctx.shadowColor = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animId);
    };
  }, []);

  // Frame calculation across the 8 intervals (0 to 8)
  const safeProgress =
    typeof smoothedProgress === "number" && !isNaN(smoothedProgress)
      ? Math.max(0, Math.min(1, smoothedProgress))
      : 0;
  const framePos = safeProgress * 8;
  const currentDeg = Math.round(safeProgress * 360);
  const activeIndex = Math.min(8, Math.max(0, Math.round(framePos)));
  const currentFrame = HERO_FRAMES[activeIndex] || HERO_FRAMES[0];

  // Subtle 3D perspective adjustments
  const subtleSway = (safeProgress - 0.5) * 10;
  const scale = 1 + Math.sin(safeProgress * Math.PI) * 0.04;
  const lightShiftX = Math.cos(safeProgress * Math.PI * 2) * 50;

  return (
    <div className="dash-hero-3d-stage" ref={stageRef}>
      {/* Background Ambience & Cyber Lighting Gradients */}
      <div
        className="dash-stage-lighting"
        style={{
          background: `
            radial-gradient(circle at ${55 + lightShiftX * 0.1}% 35%, rgba(0, 240, 255, 0.15) 0%, transparent 55%),
            radial-gradient(circle at ${75 - lightShiftX * 0.1}% 65%, rgba(99, 102, 241, 0.12) 0%, transparent 50%),
            radial-gradient(circle at 50% 50%, rgba(7, 12, 24, 0.94) 0%, #060912 100%)
          `,
        }}
      />

      {/* Real-time Procedural Three.js 3D Gym Environment */}
      <Gym3DScene scrollProgress={safeProgress} />

      {/* Floating Ambient Kinetic Particles Canvas */}
      <canvas ref={canvasRef} className="dash-stage-particles" />

      {/* Volumetric Overhead Glowing Halo Ring */}
      <div
        className="dash-stage-halo"
        style={{
          transform: `translateX(-50%) perspective(900px) rotateX(68deg) rotateY(${subtleSway * 0.5}deg)`,
        }}
      />

      {/* 3D Rotating Hero Character Container with Pixel Frame Reference */}
      <div
        className="dash-stage-character-wrapper"
        style={{
          transform: `translateX(-50%) perspective(1200px) rotateY(${subtleSway}deg) scale(${scale})`,
        }}
      >
        {/* Floating Telemetry / Rotation Angle HUD */}
        <div className="dash-hero-hud">
          <div className="dash-hud-badge">
            <span className="dash-hud-pulse" />
            <span className="dash-hud-title">3D MODEL VIEWPORT</span>
            <span className="dash-hud-deg">{currentDeg}°</span>
          </div>
          <div className="dash-hud-caption">{currentFrame.label}</div>
          <div className="dash-hud-ticks">
            {HERO_FRAMES.map((f, i) => (
              <span
                key={f.angle}
                className={`dash-hud-tick ${activeIndex === i ? "active" : ""}`}
                title={`${f.label} (Pixel: ${f.pixelX}px)`}
              />
            ))}
          </div>
        </div>

        {/* Character Visual Layers: Multi-Angle Sliced Frame Stack with Smooth Crossfade */}
        <div className="dash-character-mesh">
          {HERO_FRAMES.map((frame, i) => {
            const distance = Math.abs(framePos - i);
            const opacity = Math.max(0, 1 - distance);

            // Hide completely transparent frames for high GPU performance
            if (opacity <= 0.001) return null;

            return (
              <img
                key={frame.angle}
                src={frame.file}
                alt={frame.label}
                className="dash-character-angle-frame"
                style={{
                  opacity,
                }}
              />
            );
          })}

          {/* Cyber Rim Light Overlays */}
          <div
            className="dash-character-rim-light cyan"
            style={{
              opacity: 0.35 + Math.cos((currentDeg * Math.PI) / 180) * 0.2,
            }}
          />
          <div
            className="dash-character-rim-light violet"
            style={{
              opacity: 0.3 + Math.sin((currentDeg * Math.PI) / 180) * 0.2,
            }}
          />

          {/* Glowing Cyber Floor Pedestal */}
          <div className="dash-character-pedestal">
            <div
              className="dash-pedestal-ring"
              style={{
                transform: `rotate(${currentDeg}deg)`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Cinematic Gym Depth Trusses & Background Architecture */}
      <div className="dash-stage-gym-structure" />

      {/* Soft Vignette Mask */}
      <div className="dash-stage-vignette" />
    </div>
  );
}

export default Hero3DStage;


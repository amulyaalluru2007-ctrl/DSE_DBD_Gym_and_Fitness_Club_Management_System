import * as faceapi from "@vladmandic/face-api";

export const DIMENSIONS = 128;
let modelsLoadingPromise = null;
let modelsLoaded = false;

/**
 * Loads the deep neural network models from local /models directory
 */
export const loadFaceModels = async () => {
  if (modelsLoaded) return true;
  if (modelsLoadingPromise) return modelsLoadingPromise;

  modelsLoadingPromise = (async () => {
    try {
      const MODEL_URL = "/models";
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL),
      ]);
      modelsLoaded = true;
      console.log("[FitPulse AI] High-precision neural models loaded: SSD Mobilenet v1, Landmarks68, FaceRecognitionNet, AgeGender.");
      return true;
    } catch (err) {
      console.error("[FitPulse AI] Error loading face models:", err);
      modelsLoadingPromise = null;
      return false;
    }
  })();

  return modelsLoadingPromise;
};

/**
 * Ultra-fast face locator (runs in ~10-18ms) for continuous iPhone-style tracking HUD
 * @param {HTMLVideoElement | HTMLCanvasElement | HTMLImageElement} source
 */
export const detectFastFace = async (source) => {
  if (!source) return null;
  try {
    const ready = await loadFaceModels();
    if (!ready) return null;
    const res = await faceapi.detectSingleFace(
      source,
      new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.25 })
    );
    return res ? { box: res.box, score: res.score } : null;
  } catch {
    return null;
  }
};

/**
 * Ultra-fast, high-precision face recognition descriptor extractor.
 * Evaluates TinyFaceDetector (320px) first in ~25ms with 68-landmark ResNet-34 128-d descriptor,
 * falling back gracefully to SsdMobilenetv1 if lighting is dim or head is tilted.
 * @param {HTMLVideoElement | HTMLCanvasElement | HTMLImageElement} source
 */
export const detectAndDescribeFace = async (source) => {
  if (!source) return null;

  try {
    const ready = await loadFaceModels();
    if (!ready) return null;

    let detection = null;
    
    // 1. Lightning-fast primary pass (TinyFaceDetector 320 with sensitive threshold 0.25)
    try {
      detection = await faceapi
        .detectSingleFace(source, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.25 }))
        .withFaceLandmarks()
        .withFaceDescriptor()
        .withAgeAndGender();
    } catch {
      detection = null;
    }

    // 2. High-precision SSD Mobilenet v1 fallback if tiny detector didn't catch the angle
    if (!detection) {
      try {
        detection = await faceapi
          .detectSingleFace(source, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.35 }))
          .withFaceLandmarks()
          .withFaceDescriptor()
          .withAgeAndGender();
      } catch {
        detection = null;
      }
    }

    if (!detection) {
      return null;
    }

    return {
      descriptor: Array.from(detection.descriptor), // Real 128-float ResNet embedding
      age: Math.round(detection.age),
      gender: detection.gender === "female" ? "Female" : "Male",
      genderProbability: Math.round(detection.genderProbability * 100),
      box: detection.detection.box,
      score: detection.detection.score,
    };
  } catch (err) {
    console.warn("[FitPulse AI] Detection error:", err);
    return null;
  }
};

/**
 * Samples up to maxTries rapid video frames over ~120ms to guarantee an instant,
 * high-fidelity face lock on the FIRST attempt without requiring multiple manual tries.
 * @param {HTMLVideoElement} video
 * @param {number} maxTries
 */
export const sampleBestFace = async (video, maxTries = 3) => {
  if (!video) return null;
  let best = null;

  for (let i = 0; i < maxTries; i++) {
    const res = await detectAndDescribeFace(video);
    if (res) {
      if (!best || (res.score && res.score > (best.score || 0))) {
        best = res;
      }
      // If we got a crisp, high-confidence detection (>= 0.60), return immediately!
      if (res.score >= 0.6) {
        return res;
      }
    }
    // Brief 40ms interval before next snapshot
    if (i < maxTries - 1) {
      await new Promise((r) => setTimeout(r, 40));
    }
  }

  return best;
};

/**
 * Backward-compatible helper returning raw 128-d descriptor array
 */
export const extractBiometricDescriptor = async (source) => {
  const res = await detectAndDescribeFace(source);
  return res ? res.descriptor : null;
};

/**
 * Capture high-quality JPEG base64 frame from video element
 * @param {HTMLVideoElement} video
 * @returns {string} base64 data url
 */
export const captureVideoFrame = (video) => {
  if (!video || !video.videoWidth) return null;
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
};

/**
 * Calculate Euclidean Distance between two 128-d vectors
 */
export const calculateEuclideanDistance = (vecA, vecB) => {
  if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length !== vecB.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < vecA.length; i++) {
    const d = vecA[i] - vecB[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
};

/**
 * Plays an iPhone Face ID style futuristic pleasant unlock chime
 */
export const playFaceIdUnlockSound = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // Harmonic 1 (pleasant warm chord)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.exponentialRampToValueAtTime(880.0, now + 0.12); // A5
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.28);

    // Harmonic 2 (crisp iPhone chime ping)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1174.66, now + 0.08); // D6
    gain2.gain.setValueAtTime(0.16, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.38);
  } catch {}
};

/**
 * Plays a subtle low double-tone error haptic feedback for unrecognized face
 */
export const playFaceIdRejectSound = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.setValueAtTime(180, now + 0.1);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  } catch {}
};

/**
 * Generates a deterministic 128-d vector for quick testing personas
 */
export const generateDeterministicVector = (seedKey = "seed") => {
  const str = String(seedKey);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }

  const vector = [];
  let sumSq = 0;

  for (let i = 0; i < DIMENSIONS; i++) {
    const pseudoRandom = Math.sin((hash + 1) * (i + 13.37)) * 10000;
    const val = pseudoRandom - Math.floor(pseudoRandom);
    vector.push(val);
    sumSq += val * val;
  }

  const norm = Math.sqrt(sumSq) || 1;
  return vector.map((v) => Number((v / norm).toFixed(6)));
};

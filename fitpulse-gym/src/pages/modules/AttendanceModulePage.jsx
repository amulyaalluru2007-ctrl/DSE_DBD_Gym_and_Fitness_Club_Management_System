import { useState, useEffect, useRef } from "react";
import CustomerSidebar3D from "../../components/dashboard/CustomerSidebar3D";
import {
  onRealtimeEvent,
  fetchDashboardData,
  scanAttendanceLive,
  enrollFaceLive,
  recognizeFaceLive,
  fetchFaceStatusLive,
  fetchUserMfaCodeLive,
  verifyMfaAttendanceLive,
} from "../../services/realtime";
import {
  detectAndDescribeFace,
  sampleBestFace,
  loadFaceModels,
  captureVideoFrame,
  generateDeterministicVector,
  playFaceIdUnlockSound,
} from "../../utils/faceBiometrics";
import "../../styles/module-pages.css";

const initialLogs = [
  { id: "att-1", date: "Today, Sep 13", time: "07:15 AM", terminal: "Turnstile #02 (Main Entrance)", duration: "Active Now", status: "Verified In" },
  { id: "att-2", date: "Yesterday, Sep 12", time: "06:30 PM", terminal: "Turnstile #01 (Free Weights)", duration: "1h 45m", status: "Completed" },
  { id: "att-3", date: "Sep 11, 2026", time: "07:00 AM", terminal: "Turnstile #02 (Main Entrance)", duration: "1h 30m", status: "Completed" },
  { id: "att-4", date: "Sep 10, 2026", time: "06:45 PM", terminal: "Turnstile #04 (Olympic Racks)", duration: "2h 10m", status: "Completed" },
  { id: "att-5", date: "Sep 09, 2026", time: "07:20 AM", terminal: "Turnstile #02 (Main Entrance)", duration: "1h 25m", status: "Completed" },
];

export default function AttendanceModulePage() {
  const [activeTab, setActiveTab] = useState("face_id"); // "face_id" | "qr_pass" | "mfa_code"
  const [logs, setLogs] = useState([]);
  const [monthlyCount, setMonthlyCount] = useState(0);
  const [streakDays, setStreakDays] = useState(0);
  const [hasScannedToday, setHasScannedToday] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanSuccessMessage, setScanSuccessMessage] = useState(null);
  const [securityToken, setSecurityToken] = useState("FP-8849-9482");
  const [tokenCountdown, setTokenCountdown] = useState(48);
  const [searchQuery, setSearchQuery] = useState("");

  // Dynamic 1-Minute MFA Passcode State
  const [mfaCode, setMfaCode] = useState("------");
  const [mfaSecondsRemaining, setMfaSecondsRemaining] = useState(60);
  const [mfaTesting, setMfaTesting] = useState(false);
  const [mfaTestInput, setMfaTestInput] = useState("");
  const [mfaFeedback, setMfaFeedback] = useState(null);
  const [mfaCopied, setMfaCopied] = useState(false);

  // Member details dynamically loaded from session
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("fitpulse_user") || "{}");
    } catch {
      return {};
    }
  });

  const memberId = currentUser.id || null;
  const memberName = currentUser.name || "Member";
  const [memberAge, setMemberAge] = useState(currentUser.age || 22);
  const [memberGender, setMemberGender] = useState(currentUser.gender || "Male");

  // Face ID Biometric Enrollment State
  const [faceEnrolled, setFaceEnrolled] = useState(false);
  const [faceEnrolledAt, setFaceEnrolledAt] = useState(null);
  const [facePhoto, setFacePhoto] = useState(null);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [biometricFeedback, setBiometricFeedback] = useState("");
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Initial Fetch & Socket Listeners
  useEffect(() => {
    fetchDashboardData(currentUser.email).then((data) => {
      if (data && data.user) {
        setCurrentUser((prev) => {
          const updated = { ...prev, ...data.user };
          try {
            localStorage.setItem("fitpulse_user", JSON.stringify(updated));
          } catch {}
          return updated;
        });
        if (data.user.age) setMemberAge(data.user.age);
        if (data.user.gender) setMemberGender(data.user.gender);
      }
      if (data && data.attendance) {
        if (typeof data.attendance.monthlyCount === "number") setMonthlyCount(data.attendance.monthlyCount);
        if (typeof data.attendance.streakDays === "number") setStreakDays(data.attendance.streakDays);
        setHasScannedToday(Boolean(data.attendance.isCurrentlyInGym));
        if (data.attendance.records && data.attendance.records.length > 0) {
          const mapped = data.attendance.records.map((r) => ({
            id: "att-" + r.id,
            date: new Date(r.scanned_at).toLocaleDateString([], { month: "short", day: "numeric" }),
            time: new Date(r.scanned_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            terminal: r.terminal,
            duration: r.duration || "Active Now",
            status: r.status,
          }));
          setLogs(mapped);
        } else if (currentUser.email && currentUser.email.toLowerCase() === "nihal@fitpulse.com") {
          setLogs(initialLogs);
          setMonthlyCount(19);
          setStreakDays(7);
          setHasScannedToday(true);
        } else {
          setLogs([]);
        }
      }
    });

    // Check Face ID Status from MySQL
    if (memberId) {
      fetchFaceStatusLive(memberId).then((status) => {
        if (status && status.success) {
          setFaceEnrolled(Boolean(status.enrolled));
          setFaceEnrolledAt(status.enrolledAt);
          if (status.age) setMemberAge(status.age);
          if (status.gender) setMemberGender(status.gender);
          if (status.photo) setFacePhoto(status.photo);
        } else {
          setFaceEnrolled(false);
          setFaceEnrolledAt(null);
          setFacePhoto(null);
        }
      });
    }

    const unsubAttendance = onRealtimeEvent("attendance:scanned", (payload) => {
      if (payload) {
        if (payload.monthlyCount) setMonthlyCount(payload.monthlyCount);
        if (payload.streakDays) setStreakDays(payload.streakDays);
        if (payload.record) {
          const newEntry = {
            id: "att-" + payload.record.id,
            date: "Today, Sep 13",
            time: payload.time || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            terminal: payload.terminal || payload.record.terminal,
            duration: payload.record.duration || "Active Now",
            status: payload.status || payload.record.status,
          };
          setLogs((prev) => [newEntry, ...prev.filter((l) => l.id !== newEntry.id)]);
        }
        setHasScannedToday(true);
      }
    });

    const unsubFaceEnroll = onRealtimeEvent("user:face-enrolled", (payload) => {
      if (payload && payload.userId === memberId) {
        setFaceEnrolled(true);
        setFaceEnrolledAt(payload.faceEnrolledAt || new Date().toISOString());
        if (payload.age) setMemberAge(payload.age);
        if (payload.gender) setMemberGender(payload.gender);
      }
    });

    return () => {
      unsubAttendance();
      unsubFaceEnroll();
    };
  }, [memberId]);

  // Rolling security token timer for QR pass
  useEffect(() => {
    const timer = setInterval(() => {
      setTokenCountdown((prev) => {
        if (prev <= 1) {
          setSecurityToken(`FP-8849-${Math.floor(1000 + Math.random() * 9000)}`);
          return 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Camera Management for Face ID Setup
  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Webcam API not supported on this browser.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
      setCameraError(null);
      setBiometricFeedback("Camera active. Center your face in the biometric oval.");

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      console.warn("Camera start error:", err.message);
      setCameraError("Camera unavailable. You can click 'Instant Calibration' below.");
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    if (cameraActive && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraActive]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Preload face models on mount
  useEffect(() => {
    loadFaceModels();
  }, []);

  const navigateTo = (path) => {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  // Real Deep Learning Face ID Enrollment Handler
  const handleEnrollFace = async (useSimulated = false) => {
    if (!memberId) {
      setBiometricFeedback("⚠️ Account profile loading. Please ensure you are logged in to enroll Face ID.");
      return;
    }

    setIsEnrolling(true);
    setBiometricFeedback("Analyzing facial landmarks & extracting 128-d neural biometric embedding...");

    try {
      let descriptor = null;
      let photo = null;
      let detectedAge = Number(memberAge) || 22;
      let detectedGender = memberGender || "Male";

      if (!useSimulated && videoRef.current && cameraActive) {
        // Fast multi-frame neural face detection
        const faceData = await sampleBestFace(videoRef.current, 2);
        if (!faceData) {
          setBiometricFeedback("⚠️ No face detected in camera viewport! Please position your face directly inside the oval.");
          setIsEnrolling(false);
          return;
        }

        descriptor = faceData.descriptor;
        photo = captureVideoFrame(videoRef.current);
        if (faceData.age) {
          detectedAge = faceData.age;
          setMemberAge(faceData.age);
        }
        if (faceData.gender) {
          detectedGender = faceData.gender;
          setMemberGender(faceData.gender);
        }
      } else {
        descriptor = generateDeterministicVector(`user-${memberId}-${memberName}`);
        photo = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80";
      }

      const res = await enrollFaceLive({
        userId: memberId,
        faceDescriptor: descriptor,
        facePhoto: photo,
        age: detectedAge,
        gender: detectedGender,
      });

      if (res && res.success) {
        playFaceIdUnlockSound();
        setFaceEnrolled(true);
        setFaceEnrolledAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
        if (photo) setFacePhoto(photo);
        setBiometricFeedback(`✓ Face ID registered & calibrated! AI Detected: ${detectedGender}, approx ${detectedAge} years.`);
        setScanSuccessMessage(`Face ID successfully calibrated for ${memberName} (${detectedAge}y, ${detectedGender})!`);
        setTimeout(() => setScanSuccessMessage(null), 7000);
      } else {
        setBiometricFeedback(res?.message || "Could not register Face ID.");
      }
    } catch (err) {
      console.warn("Face enroll error:", err);
      setBiometricFeedback("Network error enrolling Face ID.");
    } finally {
      setIsEnrolling(false);
    }
  };

  // Test Turnstile Face Scan from Member Dashboard
  const handleTestFaceScan = async () => {
    setIsScanning(true);
    setBiometricFeedback("Scanning face with AI neural network...");
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    try {
      let descriptor = null;
      if (videoRef.current && cameraActive) {
        const faceData = await sampleBestFace(videoRef.current, 2);
        if (!faceData) {
          setBiometricFeedback("⚠️ No face detected in camera. Look directly into the sensor.");
          setIsScanning(false);
          return;
        }
        descriptor = faceData.descriptor;
      } else {
        descriptor = generateDeterministicVector(`user-${memberId}-${memberName}`);
      }

      const res = await recognizeFaceLive({
        faceDescriptor: descriptor,
        terminal: "Turnstile #01 (Main Entrance - Face Scanner)",
      });

      setIsScanning(false);
      if (res && res.matched && res.member) {
        playFaceIdUnlockSound();
        const newEntry = {
          id: "att-" + Date.now(),
          date: "Today, Sep 13",
          time: timeStr,
          terminal: "Turnstile #01 (Main Entrance - Face Scanner)",
          duration: "Active Now",
          status: "Verified In",
        };
        setLogs((prev) => [newEntry, ...prev]);
        setHasScannedToday(true);
        setBiometricFeedback(`✓ ACCESS GRANTED: Verified ${res.member.name} (${res.member.confidence} Match)`);
        setScanSuccessMessage(
          `BIOMETRIC ACCESS GRANTED: Verified ${res.member.name} (${res.member.age}y, ${res.member.gender}) • Turnstile #01 Unlocked!`
        );
        setTimeout(() => setScanSuccessMessage(null), 7000);
      } else {
        setBiometricFeedback(`❌ ACCESS DENIED: ${res?.message || "Face does not match registered member."}`);
      }
    } catch (err) {
      setIsScanning(false);
      console.warn("Test scan error:", err);
      setBiometricFeedback("Network error verifying face biometrics.");
    }
  };

  // QR Pass simulation
  const handleSimulateQRScan = async () => {
    setIsScanning(true);
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    try {
      await scanAttendanceLive("Turnstile #02 (Main Entrance)", false);
      setIsScanning(false);
      const newEntry = {
        id: "att-" + Date.now(),
        date: "Today, Sep 13",
        time: timeStr,
        terminal: "Turnstile #02 (Main Entrance)",
        duration: "Just Scanned",
        status: "Verified In",
      };
      setLogs((prev) => [newEntry, ...prev]);
      setHasScannedToday(true);
      setScanSuccessMessage(`ACCESS GRANTED • Turnstile #02 QR Verified at ${timeStr}`);
      setTimeout(() => setScanSuccessMessage(null), 6000);
    } catch {
      setIsScanning(false);
    }
  };

  // MFA 1-minute rotating timer loop
  useEffect(() => {
    let isCancelled = false;

    const loadMfa = async () => {
      const uId = currentUser.id || 1;
      const res = await fetchUserMfaCodeLive(uId);
      if (!isCancelled && res && res.success) {
        setMfaCode(String(res.code || res.mfaCode || "------"));
        setMfaSecondsRemaining(res.secondsRemaining || 60);
      }
    };

    loadMfa();

    // 1-second countdown ticker
    const interval = setInterval(() => {
      setMfaSecondsRemaining((prev) => {
        if (prev <= 1) {
          loadMfa();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [currentUser.id]);

  const handleCopyMfa = () => {
    navigator.clipboard?.writeText?.(mfaCode);
    setMfaCopied(true);
    setTimeout(() => setMfaCopied(false), 2000);
  };

  const handleVerifyMfaTurnstile = async (overrideCode) => {
    const code = (overrideCode || mfaTestInput || mfaCode).trim();
    if (!code || code.length !== 6) {
      setMfaFeedback({ type: "error", message: "Please enter a valid 6-digit MFA passcode." });
      return;
    }
    setMfaTesting(true);
    setMfaFeedback(null);

    try {
      const res = await verifyMfaAttendanceLive(code, "Turnstile #01 (MFA Simulator)");
      if (res && res.success) {
        playFaceIdUnlockSound();
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        setMfaFeedback({
          type: "success",
          message: `✓ TURNSTILE UNLOCKED: Welcome, ${res.user?.name || memberName}! Gate #01 opened at ${timeStr}. Streak: ${res.streakDays ?? streakDays} days.`,
        });
        setHasScannedToday(true);
        if (typeof res.streakDays === "number") setStreakDays(res.streakDays);
        if (typeof res.totalVisits === "number") setMonthlyCount(res.totalVisits);

        const newLog = {
          id: "mfa-" + Date.now(),
          date: "Today, " + now.toLocaleDateString([], { month: "short", day: "numeric" }),
          time: timeStr,
          terminal: "Turnstile #01 (MFA Passcode Kiosk)",
          duration: "Active Now",
          status: "Verified In",
        };
        setLogs((prev) => [newLog, ...prev]);
        setScanSuccessMessage(`ACCESS GRANTED • Turnstile #01 MFA Passcode Verified at ${timeStr}`);
        setTimeout(() => setScanSuccessMessage(null), 6000);
      } else {
        setMfaFeedback({
          type: "error",
          message: res?.message || "Invalid or expired MFA code. Please re-check your 1-minute rotating code.",
        });
      }
    } catch (err) {
      setMfaFeedback({ type: "error", message: "Server connection error validating MFA passcode." });
    } finally {
      setMfaTesting(false);
    }
  };

  return (
    <div className="module-page-container">
      {/* Background Media */}
      <img
        src="/assets/modules/bg-progress.jpg"
        alt="FitPulse Athletic Facility Access"
        className="module-page-bg"
      />
      <div className="module-page-vignette" />

      {/* 3D Sidebar Dock */}
      <CustomerSidebar3D currentModule="attendance" />

      {/* Main Page Area */}
      <main className="module-page-main">
        {/* Topbar matching screen design */}
        <div className="portal-screen-header">
          <div className="module-breadcrumb-row">
            <button
              type="button"
              className="module-back-btn"
              onClick={() => navigateTo("/dashboard")}
            >
              <span>←</span>
              <span>Dashboard</span>
            </button>
            <span style={{ color: "rgba(255,255,255,0.3)" }}>/</span>
            <span className="module-breadcrumb-current">
              {activeTab === "face_id" ? "Facial Recognition Face ID" : "Digital QR Pass"}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div className="portal-search-bar">
              <span style={{ color: "#64748b" }}>🔍</span>
              <input
                type="text"
                className="portal-search-input"
                placeholder="Search terminal logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="portal-date-pill">
              <span>📅</span>
              <span>23 Sep 2026</span>
            </div>
          </div>
        </div>

        {/* Screen Title & Fast Navigation */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <h1 className="portal-screen-title">Campus Attendance & Face ID</h1>
            <p className="portal-screen-subtitle">
              Contactless biometric turnstile entry, facial landmark registration, and real-time ledger synchronization.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              type="button"
              onClick={() => navigateTo("/attendance-login")}
              className="portal-btn-primary"
              style={{
                padding: "10px 18px",
                fontSize: "0.82rem",
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "linear-gradient(135deg, #00e5ff 0%, #10b981 100%)",
              }}
            >
              <span>🚀</span>
              <span>Open Attendance Login Kiosk</span>
            </button>
          </div>
        </div>

        {/* Dynamic 1-Minute Rotating MFA Passcode Quick Bar (Near Attendance) */}
        <div
          style={{
            background: "linear-gradient(135deg, rgba(6, 14, 28, 0.95) 0%, rgba(13, 24, 44, 0.85) 100%)",
            border: "1.5px solid rgba(0, 229, 255, 0.35)",
            borderRadius: "18px",
            padding: "16px 22px",
            marginBottom: "20px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.5), 0 0 20px rgba(0, 229, 255, 0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "14px",
                background: "linear-gradient(135deg, rgba(0, 229, 255, 0.2) 0%, rgba(16, 185, 129, 0.2) 100%)",
                border: "1px solid rgba(0, 229, 255, 0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.4rem",
              }}
            >
              🔢
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: "0.72rem", color: "#00e5ff", fontWeight: 800, letterSpacing: "0.08em" }}>
                  SECONDARY ATTENDANCE PASSCODE (OPTIONAL)
                </span>
                <span className="portal-weight-badge" style={{ fontSize: "0.68rem", color: "#10b981", borderColor: "rgba(16, 185, 129, 0.4)" }}>
                  ● ROTATES EVERY 60s
                </span>
              </div>
              <div style={{ fontSize: "0.84rem", color: "#cbd5e1", marginTop: 2 }}>
                Enter this 6-digit rolling PIN at any gym entrance turnstile kiosk to clock in instantly.
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
            {/* 6-Digit Passcode Display */}
            <div
              onClick={handleCopyMfa}
              title="Click to copy passcode"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 16px",
                background: "rgba(0, 0, 0, 0.6)",
                border: "1.5px solid #00e5ff",
                borderRadius: "12px",
                cursor: "pointer",
                boxShadow: "0 0 20px rgba(0, 229, 255, 0.25)",
              }}
            >
              {String(mfaCode || "------").split("").map((digit, idx) => (
                <span
                  key={idx}
                  style={{
                    fontFamily: "JetBrains Mono, monospace",
                    fontSize: "1.3rem",
                    fontWeight: 900,
                    color: "#00f0ff",
                    minWidth: "14px",
                    textAlign: "center",
                  }}
                >
                  {digit}
                </span>
              ))}
              <span style={{ fontSize: "0.8rem", color: mfaCopied ? "#10b981" : "#64748b", marginLeft: 6 }}>
                {mfaCopied ? "✓ Copied" : "📋"}
              </span>
            </div>

            {/* Countdown Badge */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                background: "rgba(255, 255, 255, 0.04)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "12px",
                padding: "6px 12px",
                minWidth: "68px",
              }}
            >
              <span style={{ fontSize: "1.1rem", fontWeight: 900, color: mfaSecondsRemaining <= 10 ? "#f87171" : "#10b981", fontFamily: "JetBrains Mono" }}>
                {mfaSecondsRemaining}s
              </span>
              <span style={{ fontSize: "0.65rem", color: "#8da4be" }}>RENEWS IN</span>
            </div>

            {/* Simulator Test Button */}
            <button
              type="button"
              className="portal-btn-primary"
              onClick={() => handleVerifyMfaTurnstile(mfaCode)}
              disabled={mfaTesting}
              style={{
                padding: "9px 16px",
                fontSize: "0.78rem",
                background: "linear-gradient(135deg, #00e5ff 0%, #10b981 100%)",
              }}
            >
              {mfaTesting ? "Verifying..." : "⚡ Test Turnstile PIN"}
            </button>
          </div>
        </div>

        {/* Top Navigation Tabs */}
        <div style={{ display: "flex", gap: "12px", marginBottom: "24px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setActiveTab("face_id")}
            style={{
              padding: "12px 24px",
              borderRadius: "14px",
              fontWeight: 800,
              fontSize: "0.88rem",
              cursor: "pointer",
              transition: "all 0.2s ease",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              border: activeTab === "face_id" ? "1.5px solid #00e5ff" : "1px solid rgba(255,255,255,0.08)",
              background: activeTab === "face_id" ? "rgba(0, 229, 255, 0.15)" : "rgba(13, 20, 36, 0.6)",
              color: activeTab === "face_id" ? "#00e5ff" : "#8da4be",
              boxShadow: activeTab === "face_id" ? "0 0 25px rgba(0, 229, 255, 0.2)" : "none",
            }}
          >
            <span>⚡</span>
            <span>Biometric Face ID Setup & Access</span>
            {faceEnrolled && (
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px #10b981" }} />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("qr_pass")}
            style={{
              padding: "12px 24px",
              borderRadius: "14px",
              fontWeight: 800,
              fontSize: "0.88rem",
              cursor: "pointer",
              transition: "all 0.2s ease",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              border: activeTab === "qr_pass" ? "1.5px solid #00e5ff" : "1px solid rgba(255,255,255,0.08)",
              background: activeTab === "qr_pass" ? "rgba(0, 229, 255, 0.15)" : "rgba(13, 20, 36, 0.6)",
              color: activeTab === "qr_pass" ? "#00e5ff" : "#8da4be",
              boxShadow: activeTab === "qr_pass" ? "0 0 25px rgba(0, 229, 255, 0.2)" : "none",
            }}
          >
            <span>📱</span>
            <span>Digital QR Optical Pass</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("mfa_code")}
            style={{
              padding: "12px 24px",
              borderRadius: "14px",
              fontWeight: 800,
              fontSize: "0.88rem",
              cursor: "pointer",
              transition: "all 0.2s ease",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              border: activeTab === "mfa_code" ? "1.5px solid #00e5ff" : "1px solid rgba(255,255,255,0.08)",
              background: activeTab === "mfa_code" ? "rgba(0, 229, 255, 0.15)" : "rgba(13, 20, 36, 0.6)",
              color: activeTab === "mfa_code" ? "#00e5ff" : "#8da4be",
              boxShadow: activeTab === "mfa_code" ? "0 0 25px rgba(0, 229, 255, 0.2)" : "none",
            }}
          >
            <span>🔢</span>
            <span>1-Min Rotating MFA Passcode</span>
            <span style={{ fontSize: "0.72rem", background: "rgba(0, 229, 255, 0.2)", color: "#00e5ff", padding: "2px 8px", borderRadius: "8px", fontFamily: "JetBrains Mono", fontWeight: 900 }}>
              {mfaSecondsRemaining}s
            </span>
          </button>
        </div>

        {/* Scan Feedback Banner */}
        {scanSuccessMessage && (
          <div
            style={{
              padding: "16px 22px",
              background: "rgba(16, 185, 129, 0.15)",
              border: "1.5px solid #10b981",
              borderRadius: 16,
              color: "#34d399",
              marginBottom: 24,
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              gap: 12,
              boxShadow: "0 0 25px rgba(16, 185, 129, 0.3)",
            }}
          >
            <span style={{ fontSize: "1.2rem" }}>✓</span>
            <span>{scanSuccessMessage}</span>
          </div>
        )}

        {/* TAB 1: FACIAL RECOGNITION (FACE ID) */}
        {activeTab === "face_id" && (
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "22px", marginBottom: "24px" }}>
            {/* Camera Viewport & Capture Console */}
            <div className="portal-card" style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div>
                  <div style={{ fontSize: "0.72rem", color: "#00e5ff", fontWeight: 800, letterSpacing: "0.08em" }}>
                    BIOMETRIC CAMERA SENSOR
                  </div>
                  <h3 className="portal-card-title" style={{ marginTop: 2 }}>
                    Face ID Registration & Calibration
                  </h3>
                </div>
                <span
                  className="portal-weight-badge"
                  style={{
                    color: faceEnrolled ? "#10b981" : "#f59e0b",
                    borderColor: faceEnrolled ? "rgba(16, 185, 129, 0.4)" : "rgba(245, 158, 11, 0.4)",
                    background: faceEnrolled ? "rgba(16, 185, 129, 0.1)" : "rgba(245, 158, 11, 0.1)",
                  }}
                >
                  {faceEnrolled ? "● FACE ID ENROLLED" : "○ NOT ENROLLED"}
                </span>
              </div>

              {/* Viewport Box */}
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  height: 320,
                  borderRadius: 18,
                  overflow: "hidden",
                  background: "#02050b",
                  border: "2px solid rgba(0, 229, 255, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {/* Video element - always mounted in DOM so stream connects instantly */}
                <video
                  ref={(el) => {
                    videoRef.current = el;
                    if (el && streamRef.current && el.srcObject !== streamRef.current) {
                      el.srcObject = streamRef.current;
                      el.play().catch(() => {});
                    }
                  }}
                  autoPlay
                  playsInline
                  muted
                  onLoadedMetadata={(e) => {
                    e.target.play().catch(() => {});
                  }}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    transform: "scaleX(-1)",
                    display: cameraActive ? "block" : "none",
                  }}
                />

                {!cameraActive && (
                  facePhoto ? (
                    <img
                      src={facePhoto}
                      alt="Registered Face"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <div style={{ textAlign: "center", padding: 24 }}>
                      <div style={{ fontSize: "3rem", marginBottom: 10 }}>📷</div>
                      <div style={{ fontSize: "1rem", fontWeight: 800, color: "#ffffff" }}>
                        Camera Off / Standby
                      </div>
                      <div style={{ fontSize: "0.76rem", color: "#8da4be", marginTop: 4 }}>
                        {cameraError || "Click 'Start Camera' below to calibrate your Face ID."}
                      </div>
                    </div>
                  )
                )}

                {/* Biometric Oval Guide Overlay */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    pointerEvents: "none",
                  }}
                >
                  <div
                    style={{
                      width: 170,
                      height: 230,
                      borderRadius: "50% / 60%",
                      border: faceEnrolled ? "2px dashed #10b981" : "2px dashed #00e5ff",
                      boxShadow: faceEnrolled
                        ? "0 0 25px rgba(16, 185, 129, 0.3), inset 0 0 20px rgba(16, 185, 129, 0.15)"
                        : "0 0 25px rgba(0, 229, 255, 0.25), inset 0 0 20px rgba(0, 229, 255, 0.15)",
                    }}
                  />
                </div>

                {/* Telemetry pill */}
                <div
                  style={{
                    position: "absolute",
                    bottom: 10,
                    left: 14,
                    fontSize: "0.7rem",
                    fontFamily: "JetBrains Mono",
                    color: "#00e5ff",
                    background: "rgba(6, 9, 19, 0.75)",
                    padding: "4px 8px",
                    borderRadius: 6,
                  }}
                >
                  128-D VECTOR ENGINE • FP-NET V4
                </div>
              </div>

              {/* Status feedback */}
              <div style={{ fontSize: "0.8rem", color: "#8da4be", margin: "14px 0 16px 0", minHeight: "1.2rem" }}>
                {biometricFeedback || (faceEnrolled ? "Face ID is registered and active in the database." : "Click below to setup your facial recognition.")}
              </div>

              {/* Action Buttons */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                {!cameraActive ? (
                  <button
                    type="button"
                    className="portal-btn-primary"
                    style={{ background: "rgba(255, 255, 255, 0.08)", border: "1px solid rgba(255, 255, 255, 0.2)", color: "#fff" }}
                    onClick={startCamera}
                  >
                    🎥 Start Camera
                  </button>
                ) : (
                  <button
                    type="button"
                    className="portal-btn-primary"
                    style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#f87171" }}
                    onClick={stopCamera}
                  >
                    ⏹ Stop Camera
                  </button>
                )}

                <button
                  type="button"
                  className="portal-btn-primary"
                  onClick={() => handleEnrollFace(false)}
                  disabled={isEnrolling}
                >
                  {isEnrolling ? "Calibrating..." : "⚡ Capture & Register Face ID"}
                </button>
              </div>

              {/* Secondary Instant Calibration Button */}
              <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
                <button
                  type="button"
                  style={{
                    flex: 1,
                    padding: "10px 14px",
                    borderRadius: 12,
                    background: "rgba(0, 229, 255, 0.06)",
                    border: "1px solid rgba(0, 229, 255, 0.25)",
                    color: "#00e5ff",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                  onClick={() => handleEnrollFace(true)}
                  disabled={isEnrolling}
                >
                  ⚡ Instant Biometric Calibration (Demo Setup)
                </button>

                <button
                  type="button"
                  style={{
                    flex: 1,
                    padding: "10px 14px",
                    borderRadius: 12,
                    background: "rgba(16, 185, 129, 0.08)",
                    border: "1px solid rgba(16, 185, 129, 0.3)",
                    color: "#34d399",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                  onClick={handleTestFaceScan}
                  disabled={isScanning}
                >
                  {isScanning ? "Scanning..." : "🔓 Test Turnstile Gate Entry"}
                </button>
              </div>
            </div>

            {/* Face ID Credentials & Biometrics Card */}
            <div className="portal-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div className="portal-card-header">
                  <div>
                    <h3 className="portal-card-title">Biometric Identity Pass</h3>
                    <div style={{ fontSize: "0.75rem", color: "#8da4be", marginTop: "2px" }}>
                      Member facial credentials for turnstile gates
                    </div>
                  </div>
                  <span className="portal-weight-badge" style={{ color: "#00e5ff", background: "rgba(0, 229, 255, 0.1)" }}>
                    VIP Turnstile Pass
                  </span>
                </div>

                {/* Identity Snapshot Row */}
                <div style={{ display: "flex", alignItems: "center", gap: 16, margin: "16px 0" }}>
                  <div
                    style={{
                      width: 74,
                      height: 74,
                      borderRadius: 18,
                      overflow: "hidden",
                      border: "2px solid #00e5ff",
                      boxShadow: "0 0 18px rgba(0, 229, 255, 0.35)",
                      background: "#0c1222",
                    }}
                  >
                    <img
                      src={facePhoto || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&auto=format&fit=crop&q=80"}
                      alt={memberName}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: "0.72rem", color: "#10b981", fontWeight: 800, letterSpacing: "0.08em" }}>
                      {faceEnrolled ? "✓ BIOMETRIC FACE ID ACTIVE" : "PENDING SETUP"}
                    </div>
                    <div style={{ fontSize: "1.3rem", fontWeight: 900, color: "#ffffff" }}>
                      {memberName}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "#8da4be" }}>
                      ID: FP-8849-ELITE
                    </div>
                  </div>
                </div>

                {/* Explicit Details: Name, Age, Gender inputs/display */}
                <div style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255, 255, 255, 0.06)", borderRadius: 16, padding: "16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                  <div>
                    <div style={{ fontSize: "0.7rem", color: "#8da4be", textTransform: "uppercase", fontWeight: 700 }}>Full Name</div>
                    <div style={{ fontSize: "1.05rem", fontWeight: 900, color: "#ffffff", marginTop: 2 }}>{memberName}</div>
                  </div>

                  <div>
                    <div style={{ fontSize: "0.7rem", color: "#8da4be", textTransform: "uppercase", fontWeight: 700 }}>Age</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                      <input
                        type="number"
                        value={memberAge}
                        onChange={(e) => setMemberAge(e.target.value)}
                        style={{
                          width: 60,
                          background: "rgba(0,0,0,0.4)",
                          border: "1px solid rgba(0, 229, 255, 0.3)",
                          color: "#00e5ff",
                          borderRadius: 6,
                          padding: "2px 6px",
                          fontWeight: 900,
                          fontSize: "1rem",
                        }}
                      />
                      <span style={{ fontSize: "0.8rem", color: "#8da4be" }}>Years</span>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: "0.7rem", color: "#8da4be", textTransform: "uppercase", fontWeight: 700 }}>Gender</div>
                    <select
                      value={memberGender}
                      onChange={(e) => setMemberGender(e.target.value)}
                      style={{
                        background: "rgba(0,0,0,0.4)",
                        border: "1px solid rgba(0, 229, 255, 0.3)",
                        color: "#00e5ff",
                        borderRadius: 6,
                        padding: "4px 8px",
                        fontWeight: 800,
                        fontSize: "0.85rem",
                        marginTop: 2,
                      }}
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <div style={{ fontSize: "0.7rem", color: "#8da4be", textTransform: "uppercase", fontWeight: 700 }}>Turnstile Security</div>
                    <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#10b981", marginTop: 2 }}>AES-256 Vault</div>
                  </div>
                </div>

                {/* Enrollment status note */}
                <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 12, background: "rgba(0, 229, 255, 0.04)", border: "1px solid rgba(0, 229, 255, 0.15)", fontSize: "0.75rem", color: "#8da4be", lineHeight: 1.5 }}>
                  💡 <strong style={{ color: "#00e5ff" }}>How it works:</strong> Once your Face ID is registered, you can enter via any gym turnstile simply by looking at the optical scanner. You can also use the <strong style={{ color: "#ffffff" }}>Attendance Login</strong> terminal at the entrance to clock in!
                </div>
              </div>

              {/* Open Turnstile Kiosk CTA */}
              <div style={{ marginTop: 20 }}>
                <button
                  type="button"
                  className="portal-btn-primary"
                  style={{ width: "100%", padding: "12px 20px", fontSize: "0.88rem", background: "linear-gradient(135deg, #00e5ff 0%, #0070f3 100%)" }}
                  onClick={() => navigateTo("/attendance-login")}
                >
                  ⚡ Open Dedicated Turnstile Attendance Login →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DIGITAL QR PASS */}
        {activeTab === "qr_pass" && (
          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: "22px", marginBottom: "24px" }}>
            {/* Custom QR Pass Container */}
            <div className="portal-card" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", position: "relative" }}>
              <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center", marginBottom: "16px" }}>
                <div>
                  <div style={{ fontSize: "0.72rem", color: "#00e5ff", fontWeight: 800, letterSpacing: "0.08em" }}>
                    DIGITAL PASS • ACTIVE
                  </div>
                  <div style={{ fontSize: "1.2rem", fontWeight: 900, color: "#ffffff" }}>
                    {memberName}
                  </div>
                </div>
                <span className="portal-weight-badge" style={{ color: "#00f0ff", borderColor: "rgba(0, 240, 255, 0.3)", background: "rgba(0, 240, 255, 0.08)" }}>
                  FP-8849-ELITE
                </span>
              </div>

              {/* Encrypted QR Box */}
              <div
                style={{
                  position: "relative",
                  width: 230,
                  height: 230,
                  background: "#ffffff",
                  borderRadius: 20,
                  padding: 16,
                  boxSizing: "border-box",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  boxShadow: "0 18px 45px rgba(0, 0, 0, 0.6), 0 0 32px rgba(0, 180, 255, 0.35)",
                  border: "3px solid #00e5ff",
                  margin: "10px 0 18px 0",
                  overflow: "hidden",
                }}
              >
                {isScanning && (
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      height: 4,
                      background: "linear-gradient(90deg, transparent, #00f0ff, transparent)",
                      boxShadow: "0 0 14px #00f0ff",
                      animation: "hudPulse 0.4s infinite alternate",
                      top: "50%",
                    }}
                  />
                )}

                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div style={{ width: 54, height: 54, background: "#060913", borderRadius: 8, padding: 7, boxSizing: "border-box" }}>
                    <div style={{ width: "100%", height: "100%", background: "#fff", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ width: 18, height: 18, background: "#060913", borderRadius: 2 }} />
                    </div>
                  </div>
                  <div style={{ width: 54, height: 54, background: "#060913", borderRadius: 8, padding: 7, boxSizing: "border-box" }}>
                    <div style={{ width: "100%", height: "100%", background: "#fff", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ width: 18, height: 18, background: "#060913", borderRadius: 2 }} />
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 46 }}>
                  <div style={{ padding: "5px 12px", background: "#060913", color: "#00e5ff", borderRadius: 9999, fontWeight: 900, fontSize: "0.72rem", letterSpacing: "0.1em", border: "1px solid #00b4ff" }}>
                    ⚡ FITPULSE
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                  <div style={{ width: 54, height: 54, background: "#060913", borderRadius: 8, padding: 7, boxSizing: "border-box" }}>
                    <div style={{ width: "100%", height: "100%", background: "#fff", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ width: 18, height: 18, background: "#060913", borderRadius: 2 }} />
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ width: 44, height: 12, background: "#060913", borderRadius: 3 }} />
                    <div style={{ width: 44, height: 22, background: "#060913", borderRadius: 4 }} />
                  </div>
                </div>
              </div>

              {/* Rolling Security Token */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: "0.82rem", fontFamily: "JetBrains Mono", fontWeight: 800, color: "#ffffff" }}>
                  TOKEN: {securityToken}
                </span>
                <span className="portal-weight-badge" style={{ fontSize: "0.68rem", color: "#34d399", borderColor: "rgba(52, 211, 153, 0.3)" }}>
                  RENEWS IN {tokenCountdown}s
                </span>
              </div>

              <p style={{ fontSize: "0.76rem", color: "#8da4be", maxWidth: 320, margin: "0 0 18px 0", lineHeight: 1.4 }}>
                Dynamic optical barcode refreshed cryptographically. Scan directly at turnstile sensor 10-15cm away.
              </p>

              <button
                type="button"
                className="portal-btn-primary"
                style={{ width: "100%", padding: "12px 20px", fontSize: "0.88rem" }}
                onClick={handleSimulateQRScan}
                disabled={isScanning}
              >
                {isScanning ? "Scanning Turnstile Gate..." : "⚡ Simulate Turnstile Check-In Scan"}
              </button>
            </div>

            {/* Attendance Stats & September Calendar Grid */}
            <div className="portal-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div className="portal-card-header">
                  <div>
                    <h3 className="portal-card-title">Attendance Stats</h3>
                    <div style={{ fontSize: "0.75rem", color: "#8da4be", marginTop: "2px" }}>
                      September 2026 Discipline Grid
                    </div>
                  </div>
                  <span className="portal-weight-badge" style={{ color: "#00e5ff", background: "rgba(0, 229, 255, 0.1)" }}>
                    {monthlyCount > 0 ? Math.round((monthlyCount / 28) * 100) : 0}% Consistency
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "baseline", gap: "8px", margin: "14px 0 18px 0" }}>
                  <span style={{ fontSize: "2.4rem", fontWeight: 900, color: "#ffffff", fontFamily: "JetBrains Mono" }}>
                    {monthlyCount}/28
                  </span>
                  <span style={{ fontSize: "0.9rem", color: "#8da4be", fontWeight: 600 }}>
                    Days Attended this month
                  </span>
                </div>

                <div className="portal-calendar-month-grid" style={{ marginBottom: "16px" }}>
                  {Array.from({ length: 28 }).map((_, idx) => {
                    const dayNum = idx + 1;
                    const isAttended = idx < monthlyCount;
                    const isRest = !isAttended;
                    return (
                      <div
                        key={idx}
                        className={`portal-calendar-day ${isAttended ? "checked-in" : isRest ? "rest-day" : ""}`}
                      >
                        {dayNum}
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "#8da4be", paddingTop: "6px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: "#00f0ff" }} />
                    <span>Checked In ({monthlyCount} Days)</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#a855f7" }} />
                    <span>Rest Days ({28 - monthlyCount} Days)</span>
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "16px" }}>
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "10px 14px" }}>
                  <div style={{ fontSize: "0.7rem", color: "#8da4be" }}>CURRENT STREAK</div>
                  <div style={{ fontSize: "1.2rem", fontWeight: 900, color: "#f59e0b", fontFamily: "JetBrains Mono" }}>{streakDays} Days 🔥</div>
                </div>
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "10px 14px" }}>
                  <div style={{ fontSize: "0.7rem", color: "#8da4be" }}>CAMPUS ENTRY</div>
                  <div style={{ fontSize: "1.2rem", fontWeight: 900, color: "#10b981", fontFamily: "JetBrains Mono" }}>VIP UNLIMITED</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: DYNAMIC 1-MINUTE ROTATING MFA PASSCODE */}
        {activeTab === "mfa_code" && (
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "22px", marginBottom: "24px" }}>
            {/* Left: Dynamic Rotating Passcode Console */}
            <div className="portal-card" style={{ display: "flex", flexDirection: "column", position: "relative" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
                <div>
                  <div style={{ fontSize: "0.72rem", color: "#00e5ff", fontWeight: 800, letterSpacing: "0.08em" }}>
                    CRYPTOGRAPHIC TIME-BASED PASSCODE
                  </div>
                  <h3 className="portal-card-title" style={{ marginTop: 2 }}>
                    Dynamic 1-Minute MFA Passcode
                  </h3>
                </div>
                <span
                  className="portal-weight-badge"
                  style={{
                    color: mfaSecondsRemaining <= 10 ? "#f87171" : "#10b981",
                    borderColor: mfaSecondsRemaining <= 10 ? "rgba(248, 113, 113, 0.4)" : "rgba(16, 185, 129, 0.4)",
                    background: mfaSecondsRemaining <= 10 ? "rgba(248, 113, 113, 0.1)" : "rgba(16, 185, 129, 0.1)",
                  }}
                >
                  ● ROTATES IN {mfaSecondsRemaining}s
                </span>
              </div>

              {/* Big Rolling PIN Display Card */}
              <div
                style={{
                  background: "linear-gradient(135deg, rgba(3, 8, 20, 0.95) 0%, rgba(9, 18, 38, 0.95) 100%)",
                  border: "2px solid rgba(0, 229, 255, 0.35)",
                  borderRadius: 20,
                  padding: "26px 20px",
                  textAlign: "center",
                  boxShadow: "0 15px 35px rgba(0,0,0,0.6), inset 0 0 20px rgba(0,229,255,0.08)",
                  marginBottom: 20,
                }}
              >
                <div style={{ fontSize: "0.76rem", color: "#8da4be", textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 14 }}>
                  Turnstile Access PIN (Valid for 60 seconds)
                </div>

                {/* 6 Digit Capsules */}
                <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 18 }}>
                  {String(mfaCode || "------").split("").map((digit, i) => (
                    <div
                      key={i}
                      style={{
                        width: 50,
                        height: 64,
                        background: "rgba(0, 229, 255, 0.08)",
                        border: "2px solid #00e5ff",
                        borderRadius: 14,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "2rem",
                        fontFamily: "JetBrains Mono, monospace",
                        fontWeight: 900,
                        color: "#00f0ff",
                        boxShadow: "0 0 15px rgba(0, 229, 255, 0.3)",
                      }}
                    >
                      {digit}
                    </div>
                  ))}
                </div>

                {/* Smooth Depletion Progress Bar */}
                <div style={{ width: "85%", margin: "0 auto 12px auto" }}>
                  <div style={{ height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${(mfaSecondsRemaining / 60) * 100}%`,
                        height: "100%",
                        background: mfaSecondsRemaining <= 10 ? "#ef4444" : "linear-gradient(90deg, #00e5ff, #10b981)",
                        transition: "width 1s linear",
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 14 }}>
                  <button
                    type="button"
                    onClick={handleCopyMfa}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 10,
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      color: mfaCopied ? "#10b981" : "#ffffff",
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {mfaCopied ? "✓ Passcode Copied!" : "📋 Copy 6-Digit PIN"}
                  </button>

                  <span style={{ fontSize: "0.75rem", color: "#8da4be" }}>
                    ID: FP-{currentUser.id || 1}-{memberName.replace(/\s+/g, "").toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Guide / How it Works Note */}
              <div style={{ padding: "14px 16px", background: "rgba(0, 229, 255, 0.04)", border: "1px solid rgba(0, 229, 255, 0.15)", borderRadius: 14, fontSize: "0.8rem", color: "#8da4be", lineHeight: 1.5 }}>
                ℹ️ <strong style={{ color: "#00e5ff" }}>Secondary Optional Turnstile Method:</strong> This rolling 6-digit PIN regenerates every minute from a synchronized server clock. When entering through the campus turnstile, simply type this code on the kiosk keypad if you do not want to use Face ID or QR code.
              </div>
            </div>

            {/* Right: Turnstile Terminal Simulator */}
            <div className="portal-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div className="portal-card-header">
                  <div>
                    <h3 className="portal-card-title">Turnstile Keypad Simulator</h3>
                    <div style={{ fontSize: "0.75rem", color: "#8da4be", marginTop: "2px" }}>
                      Test your 1-minute MFA verification at Gate #01
                    </div>
                  </div>
                  <span className="portal-weight-badge" style={{ color: "#10b981", background: "rgba(16, 185, 129, 0.1)" }}>
                    GATE #01 READY
                  </span>
                </div>

                {/* Feedback Banner */}
                {mfaFeedback && (
                  <div
                    style={{
                      padding: "12px 16px",
                      borderRadius: 12,
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      marginBottom: 16,
                      background: mfaFeedback.type === "success" ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                      border: mfaFeedback.type === "success" ? "1px solid #10b981" : "1px solid #ef4444",
                      color: mfaFeedback.type === "success" ? "#34d399" : "#f87171",
                    }}
                  >
                    {mfaFeedback.message}
                  </div>
                )}

                {/* Input Field */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: "0.75rem", color: "#8da4be", textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>
                    Enter 6-Digit Turnstile MFA PIN
                  </label>
                  <div style={{ display: "flex", gap: 10 }}>
                    <input
                      type="text"
                      maxLength={6}
                      value={mfaTestInput}
                      onChange={(e) => setMfaTestInput(e.target.value.replace(/\D/g, ""))}
                      placeholder={mfaCode}
                      style={{
                        flex: 1,
                        padding: "12px 16px",
                        background: "rgba(0,0,0,0.5)",
                        border: "1.5px solid rgba(0, 229, 255, 0.3)",
                        borderRadius: 12,
                        color: "#00f0ff",
                        fontSize: "1.2rem",
                        fontFamily: "JetBrains Mono, monospace",
                        fontWeight: 900,
                        letterSpacing: "4px",
                        textAlign: "center",
                        outline: "none",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setMfaTestInput(mfaCode)}
                      style={{
                        padding: "0 14px",
                        borderRadius: 12,
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.15)",
                        color: "#94a3b8",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Fill PIN
                    </button>
                  </div>
                </div>

                {/* Numeric Dial Keypad */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 16 }}>
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⌫"].map((btn) => (
                    <button
                      key={btn}
                      type="button"
                      onClick={() => {
                        if (btn === "C") setMfaTestInput("");
                        else if (btn === "⌫") setMfaTestInput((prev) => prev.slice(0, -1));
                        else setMfaTestInput((prev) => (prev.length < 6 ? prev + btn : prev));
                      }}
                      style={{
                        padding: "12px 0",
                        borderRadius: 10,
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        color: "#ffffff",
                        fontSize: "1.05rem",
                        fontWeight: 800,
                        fontFamily: "JetBrains Mono, monospace",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {btn}
                    </button>
                  ))}
                </div>
              </div>

              {/* Verify & Unlock Button */}
              <button
                type="button"
                className="portal-btn-primary"
                onClick={() => handleVerifyMfaTurnstile(mfaTestInput || mfaCode)}
                disabled={mfaTesting}
                style={{
                  width: "100%",
                  padding: "14px 20px",
                  fontSize: "0.9rem",
                  background: "linear-gradient(135deg, #00e5ff 0%, #10b981 100%)",
                }}
              >
                {mfaTesting ? "Verifying Attendance..." : "🔓 Verify MFA PIN & Unlock Turnstile"}
              </button>
            </div>
          </div>
        )}

        {/* Turnstile History Ledger */}
        <div className="portal-card">
          <div className="portal-card-header">
            <div>
              <h3 className="portal-card-title">Verified Turnstile Entry History</h3>
              <div style={{ fontSize: "0.75rem", color: "#8da4be", marginTop: "2px" }}>
                Biometrically validated timestamp logs across campus turnstiles
              </div>
            </div>
            <span className="portal-weight-badge">
              {logs.length} Total Logs
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {logs.length === 0 ? (
              <div style={{ textAlign: "center", padding: "36px 20px", background: "rgba(255,255,255,0.02)", borderRadius: 14, border: "1px dashed rgba(255,255,255,0.08)" }}>
                <div style={{ fontSize: "2.4rem", marginBottom: 8 }}>🚪</div>
                <div style={{ fontSize: "1rem", fontWeight: 800, color: "#ffffff" }}>No Attendance Scans Yet</div>
                <div style={{ fontSize: "0.78rem", color: "#8da4be", maxWidth: 320, margin: "6px auto 14px" }}>
                  Scan your Face ID or digital pass at any campus optical scanner to clock in and build your streak.
                </div>
              </div>
            ) : (
              logs
                .filter((log) => !searchQuery || log.terminal.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((log) => (
                  <div key={log.id} className="portal-exercise-row">
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(0, 112, 243, 0.12)", border: "1px solid rgba(0, 112, 243, 0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem" }}>
                        🚪
                      </div>
                      <div>
                        <div style={{ fontSize: "0.92rem", fontWeight: 800, color: "#ffffff" }}>{log.terminal}</div>
                        <div style={{ fontSize: "0.74rem", color: "#8da4be" }}>{log.date} • {log.time}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right", display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{ fontSize: "0.76rem", color: "#8da4be", fontFamily: "JetBrains Mono" }}>
                        {log.duration}
                      </div>
                      <span
                        className="portal-weight-badge"
                        style={{
                          fontSize: "0.72rem",
                          color: log.status === "Verified In" ? "#10b981" : "#00b4ff",
                          borderColor: log.status === "Verified In" ? "rgba(16, 185, 129, 0.4)" : "rgba(0, 180, 255, 0.3)",
                          background: log.status === "Verified In" ? "rgba(16, 185, 129, 0.08)" : "rgba(0, 180, 255, 0.08)",
                        }}
                      >
                        {log.status}
                      </span>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

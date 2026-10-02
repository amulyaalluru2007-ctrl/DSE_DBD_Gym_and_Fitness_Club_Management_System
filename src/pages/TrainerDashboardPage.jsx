import { useEffect, useState, useRef } from "react";
import TrainerSidebar3D from "../components/dashboard/TrainerSidebar3D";
import {
  assignWorkoutLive,
  fetchTrainerTrainees,
  fetchChatMessages,
  sendChatMessageLive,
  subscribeRealtime,
  fetchUserMfaCodeLive,
  verifyMfaAttendanceLive,
  enrollFaceLive,
  recognizeFaceLive,
  fetchFaceStatusLive,
  fetchTrainerPaymentsLive,
  updateTrainerProfileLive,
} from "../services/realtime";
import TrainerRemovalRequestModal from "../components/trainer/TrainerRemovalRequestModal";
import TrainerRemovalRequestsTracker from "../components/trainer/TrainerRemovalRequestsTracker";
import NotificationBell from "../components/notifications/NotificationBell";
import {
  loadFaceModels,
  sampleBestFace,
  captureVideoFrame,
  generateDeterministicVector,
  playFaceIdUnlockSound,
  playFaceIdRejectSound,
} from "../utils/faceBiometrics";
import "../styles/module-pages.css";
import "../styles/trainer-dashboard.css";

const trainerNav = [
  { id: "section-trainer-dashboard", label: "Dashboard", index: "01", icon: "🏠" },
  { id: "section-trainer-clients", label: "My Clients", index: "02", icon: "👥" },
  { id: "section-trainer-workout-plans", label: "Workout Plans", index: "03", icon: "🏋️" },
  { id: "section-trainer-schedule", label: "Schedule", index: "04", icon: "📅" },
  { id: "section-trainer-progress", label: "Client Progress", index: "05", icon: "📈" },
  { id: "section-trainer-attendance", label: "Attendance", index: "06", icon: "🟠" },
  { id: "section-trainer-nutrition", label: "Nutrition", index: "07", icon: "🥗" },
  { id: "section-trainer-messages", label: "Messages", index: "08", icon: "💬" },
  { id: "section-trainer-performance", label: "Performance", index: "09", icon: "🏆" },
  { id: "section-trainer-exercises", label: "Exercise Library", index: "10", icon: "📚" },
  { id: "section-trainer-notifications", label: "Notifications", index: "11", icon: "🔔" },
  { id: "section-trainer-profile", label: "Trainer Profile", index: "12", icon: "👤" },
];

const initialClients = [];

const exerciseDatabase = [
  { id: 1, name: "Barbell Incline Bench Press", muscle: "Chest", difficulty: "intermediate", setsReps: "4 sets × 8-10 reps", cues: "Retract scapulae, touch upper chest, drive feet firmly." },
  { id: 2, name: "Weighted Chest Dips", muscle: "Chest", difficulty: "advanced", setsReps: "3 sets × 8-12 reps", cues: "Slight forward torso lean, squeeze lower pecs at peak." },
  { id: 3, name: "Weighted Pull-Ups", muscle: "Back", difficulty: "advanced", setsReps: "4 sets × 6-8 reps", cues: "Drive elbows into back pockets, control 2s eccentric." },
  { id: 4, name: "Chest-Supported T-Bar Row", muscle: "Back", difficulty: "intermediate", setsReps: "4 sets × 10-12 reps", cues: "Neutral spine, retract lats without lower back strain." },
  { id: 5, name: "Barbell Back Squat", muscle: "Legs", difficulty: "advanced", setsReps: "5 sets × 5 reps", cues: "Brace 360 core pressure, knees track over mid-toes." },
  { id: 6, name: "Romanian Deadlift (RDL)", muscle: "Legs", difficulty: "intermediate", setsReps: "3 sets × 10 reps", cues: "Hinge deep at hips, keep bar glued to shins." },
  { id: 7, name: "Seated DB Overhead Press", muscle: "Shoulders", difficulty: "intermediate", setsReps: "4 sets × 8-10 reps", cues: "Keep elbows at 75° scaption plane, lockout overhead." },
  { id: 8, name: "Cable Lateral Raises", muscle: "Shoulders", difficulty: "beginner", setsReps: "4 sets × 15 reps", cues: "Constant tension at bottom, lead with lateral delts." },
  { id: 9, name: "Incline Dumbbell Hammer Curls", muscle: "Arms", difficulty: "beginner", setsReps: "3 sets × 12 reps", cues: "Elbows pinned back, target brachialis & forearm." },
  { id: 10, name: "Overhead Rope Tricep Extension", muscle: "Arms", difficulty: "intermediate", setsReps: "4 sets × 12-15 reps", cues: "Full stretch on long head of triceps, flare rope at lockout." },
  { id: 11, name: "Hanging Leg Raises", muscle: "Core", difficulty: "advanced", setsReps: "3 sets × 15 reps", cues: "Posterior pelvic tilt, curl pelvis up toward ribs." },
  { id: 12, name: "Cable Woodchoppers", muscle: "Core", difficulty: "intermediate", setsReps: "3 sets × 12/side", cues: "Rotate through thoracic spine, keep hips locked." },
];

export default function TrainerDashboardPage() {
  const [activeSection, setActiveSection] = useState("section-trainer-dashboard");
  const [visibleSections, setVisibleSections] = useState(() => new Set(["section-trainer-dashboard"]));
  const [scrollProgress, setScrollProgress] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  // Current Logged-In Trainer (Dynamically loaded from localStorage session)
  const [currentTrainer, setCurrentTrainer] = useState(() => {
    try {
      const stored = localStorage.getItem("fitpulse_user");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.role === "Trainer") {
          return parsed;
        }
      }
    } catch {
      /* ignore */
    }
    return {
      id: 4,
      name: "Alex Carter",
      email: "alex@fitpulse.com",
      role: "Trainer",
      specialty: "Head Strength & Performance Lead",
    };
  });

  const trainerInitials = (currentTrainer?.name || "Coach")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // Client Filter & Selected Client
  const [clients, setClients] = useState(initialClients);
  const [clientCategoryFilter, setClientCategoryFilter] = useState("All");
  const [selectedClientId, setSelectedClientId] = useState(null);
  const selectedClient = clients.find((c) => c.id === selectedClientId) || clients[0] || null;

  // Member Removal Request State
  const [showRemovalModal, setShowRemovalModal] = useState(false);
  const [selectedClientForRemoval, setSelectedClientForRemoval] = useState(null);

  // Live Dedicated Trainee Payments & PT Revenue (Cashfree PG)
  const [trainerPayments, setTrainerPayments] = useState([]);
  const [trainerPtRevenue, setTrainerPtRevenue] = useState(0);
  const [trainerClientCount, setTrainerClientCount] = useState(0);

  // Live Trainee Nutrition Telemetry (Synchronized with MySQL & Socket.io)
  const [traineeNutrition, setTraineeNutrition] = useState({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    water: 0,
    meals: [],
  });

  // Workout Builder State
  const [builderTargetClient, setBuilderTargetClient] = useState("");
  const [builderPlanName, setBuilderPlanName] = useState("Hypertrophy Push Block A");
  const [builderDaysPerWeek, setBuilderDaysPerWeek] = useState(4);
  const [builderExercises, setBuilderExercises] = useState([
    { id: 1, name: "Barbell Incline Bench Press", sets: 4, reps: "8-10", weight: "85 kg", rest: "90s" },
    { id: 2, name: "Weighted Chest Dips", sets: 3, reps: "10-12", weight: "+15 kg", rest: "75s" },
    { id: 3, name: "Seated DB Overhead Press", sets: 4, reps: "10", weight: "28 kg", rest: "60s" },
    { id: 4, name: "Cable Lateral Raises", sets: 4, reps: "15", weight: "12 kg", rest: "45s" },
  ]);
  const [newExName, setNewExName] = useState("");
  const [newExSets, setNewExSets] = useState("3");
  const [newExReps, setNewExReps] = useState("12");
  const [newExWeight, setNewExWeight] = useState("20 kg");
  const [planAssignedAlert, setPlanAssignedAlert] = useState("");

  // Schedule timeline state
  const [scheduleDateFilter, setScheduleDateFilter] = useState("Today");
  const [scheduleSlots, setScheduleSlots] = useState([
    { time: "06:00 AM", title: "Gym Floor Protocol & Opening Duty", client: "Facility", type: "duty", status: "Completed" },
    { time: "08:00 AM", title: "PT: Hypertrophy Chest & Delts", client: "Nihal", type: "pt", status: "Completed" },
    { time: "10:00 AM", title: "PT: Biomechanics Review", client: "Nihal", type: "pt", status: "Completed" },
    { time: "12:00 PM", title: "Open PT Walk-in Consultation", client: "Open Slot", type: "open", status: "Available" },
    { time: "02:00 PM", title: "Strength Assessment & Video Feedback", client: "Nihal", type: "assessment", status: "Upcoming" },
    { time: "04:00 PM", title: "Open Consultation Slot", client: "Open Slot", type: "open", status: "Available" },
    { time: "05:00 PM", title: "Floor Conditioning Session", client: "Facility", type: "duty", status: "Upcoming" },
    { time: "07:00 PM", title: "Duty Wrap-up & Tomorrow Programming", client: "Facility", type: "duty", status: "Upcoming" },
  ]);

  // Attendance Module State
  const [attendanceTab, setAttendanceTab] = useState("clients"); // 'clients' | 'duty' | 'face_id'
  const [clientAttendanceState, setClientAttendanceState] = useState({});
  const [trainerClockedIn, setTrainerClockedIn] = useState(true);

  // Trainer 1-Minute Rotating MFA Passcode State
  const [trainerMfaCode, setTrainerMfaCode] = useState("------");
  const [trainerMfaSecondsRemaining, setTrainerMfaSecondsRemaining] = useState(60);
  const [trainerMfaCopied, setTrainerMfaCopied] = useState(false);
  const [trainerMfaTesting, setTrainerMfaTesting] = useState(false);
  const [trainerMfaFeedback, setTrainerMfaFeedback] = useState(null);

  // Trainer Biometric Face ID & Turnstile State
  const trainerVideoRef = useRef(null);
  const trainerStreamRef = useRef(null);
  const [trainerCameraActive, setTrainerCameraActive] = useState(false);
  const [trainerCameraError, setTrainerCameraError] = useState(null);
  const [trainerIsEnrolling, setTrainerIsEnrolling] = useState(false);
  const [trainerIsScanning, setTrainerIsScanning] = useState(false);
  const [trainerFaceEnrolled, setTrainerFaceEnrolled] = useState(false);
  const [trainerFaceEnrolledAt, setTrainerFaceEnrolledAt] = useState(null);
  const [trainerFacePhoto, setTrainerFacePhoto] = useState(null);
  const [trainerBiometricFeedback, setTrainerBiometricFeedback] = useState(null);
  const [trainerTurnstileAlert, setTrainerTurnstileAlert] = useState(null);

  // Trainer Website & Facility Settings State
  const [acceptingNewClients, setAcceptingNewClients] = useState(true);
  const [autoConfirmBookings, setAutoConfirmBookings] = useState(true);
  const [realtimeCheckinAlerts, setRealtimeCheckinAlerts] = useState(true);
  const [chatAlertsEnabled, setChatAlertsEnabled] = useState(true);
  const [trainerBioText, setTrainerBioText] = useState(
    "Biomechanically sound progressive overload, precise recovery parameters, and individualized periodization. We don't guess; we measure, adapt, and conquer."
  );
  const [profileSettingsFeedback, setProfileSettingsFeedback] = useState(null);
  const [athleteArrivalToast, setAthleteArrivalToast] = useState(null);

  // Trainer Profile Self-Service Editing State
  const [trainerEditName, setTrainerEditName] = useState(() => currentTrainer?.name || "Alex Carter");
  const [trainerEditAvatar, setTrainerEditAvatar] = useState(() => currentTrainer?.avatar || currentTrainer?.avatar_url || "");
  const [savingProfile, setSavingProfile] = useState(false);
  const trainerFileInputRef = useRef(null);

  useEffect(() => {
    if (currentTrainer) {
      if (currentTrainer.name) setTrainerEditName(currentTrainer.name);
      if (currentTrainer.avatar || currentTrainer.avatar_url) {
        setTrainerEditAvatar(currentTrainer.avatar || currentTrainer.avatar_url);
      }
      if (currentTrainer.bio) {
        setTrainerBioText(currentTrainer.bio);
      }
    }
  }, [currentTrainer]);

  const handleTrainerImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("Image size should be under 5MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target.result;
      setTrainerEditAvatar(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveTrainerProfile = async () => {
    if (!trainerEditName.trim()) {
      alert("Trainer name cannot be empty.");
      return;
    }
    setSavingProfile(true);
    setProfileSettingsFeedback(null);
    try {
      const trainerId = currentTrainer?.id || 4;
      const res = await updateTrainerProfileLive(trainerId, {
        name: trainerEditName.trim(),
        avatar: trainerEditAvatar,
        bio: trainerBioText,
        specialty: currentTrainer?.specialty,
      });

      if (res && res.success) {
        const updatedTrainer = {
          ...currentTrainer,
          name: trainerEditName.trim(),
          full_name: trainerEditName.trim(),
          avatar: trainerEditAvatar,
          avatar_url: trainerEditAvatar,
          bio: trainerBioText,
        };
        setCurrentTrainer(updatedTrainer);
        try {
          const stored = localStorage.getItem("fitpulse_user");
          if (stored) {
            const parsed = JSON.parse(stored);
            localStorage.setItem("fitpulse_user", JSON.stringify({ ...parsed, ...updatedTrainer }));
          }
        } catch (e) {
          console.warn("Storage sync error:", e);
        }
        setProfileSettingsFeedback("✓ Profile updated! Name and photo saved to database successfully.");
        setTimeout(() => setProfileSettingsFeedback(null), 4000);
      } else {
        setProfileSettingsFeedback(`⚠️ Failed to update: ${res?.message || "Unknown error"}`);
      }
    } catch (err) {
      setProfileSettingsFeedback("⚠️ Network error updating trainer profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  // Messages State (supports both Assigned Clients and Admin Dispatch)
  const [activeChatClientId, setActiveChatClientId] = useState("admin");
  const [chatMessages, setChatMessages] = useState({
    admin: [
      { id: 101, sender: "Gym Administrator", text: "Welcome Coach. Turnstiles and duty logs are live. All client metrics sync in real time.", time: "08:00 AM", isMe: false },
    ],
  });
  const [chatInputText, setChatInputText] = useState("");

  // Exercise Library filter
  const [exerciseMuscleFilter, setExerciseMuscleFilter] = useState("All");

  // Notifications State
  const [notifications, setNotifications] = useState([
    { id: 1, type: "milestone", title: "Personal Record Smashed", body: "Nihal hit 100kg Bench Press (1RM estimated at 105kg).", time: "2 hours ago", unread: true },
    { id: 2, type: "client", title: "New Client Assigned", body: "Rahul Sharma assigned to your roster by Gym Management.", time: "4 hours ago", unread: true },
    { id: 3, type: "alert", title: "Attendance Notice", body: "Arjun Reddy flagged absent for morning conditioning session.", time: "Yesterday", unread: false },
    { id: 4, type: "plan", title: "4-Week Cycle Expiring", body: "Sneha Rao's Phase 1 mobility program ends this Sunday.", time: "2 days ago", unread: false },
  ]);

  // Stagger & In-view Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        setVisibleSections((prev) => {
          const next = new Set(prev);
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              next.add(entry.target.id);
            } else {
              next.delete(entry.target.id);
            }
          });
          return next;
        });
      },
      { threshold: 0.05 }
    );

    trainerNav.forEach((item) => {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  // Frame Scrubbing Progress Tracker
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const total = document.documentElement.scrollHeight - window.innerHeight;
          if (total > 0) {
            setScrollProgress(window.scrollY / total);
          }

          // Active section detect
          const midScreen = window.scrollY + window.innerHeight * 0.35;
          for (let i = trainerNav.length - 1; i >= 0; i -= 1) {
            const el = document.getElementById(trainerNav[i].id);
            if (el && el.offsetTop <= midScreen) {
              setActiveSection(trainerNav[i].id);
              break;
            }
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Preload face models
  useEffect(() => {
    loadFaceModels();
  }, []);

  // Sync camera feed if active
  useEffect(() => {
    if (trainerCameraActive && trainerStreamRef.current && trainerVideoRef.current) {
      trainerVideoRef.current.srcObject = trainerStreamRef.current;
      trainerVideoRef.current.play().catch(() => {});
    }
  }, [trainerCameraActive]);

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      if (trainerStreamRef.current) {
        trainerStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Camera Controls for Trainer Face ID
  const startTrainerCamera = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera API not supported on this browser.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      trainerStreamRef.current = stream;
      setTrainerCameraActive(true);
      setTrainerCameraError(null);
      if (trainerVideoRef.current) {
        trainerVideoRef.current.srcObject = stream;
        trainerVideoRef.current.play().catch(() => {});
      }
    } catch (err) {
      console.warn("Trainer camera error:", err);
      setTrainerCameraError("Camera unavailable or permission denied. You can use Instant Neural Calibration.");
      setTrainerCameraActive(false);
    }
  };

  const stopTrainerCamera = () => {
    if (trainerStreamRef.current) {
      trainerStreamRef.current.getTracks().forEach((track) => track.stop());
      trainerStreamRef.current = null;
    }
    setTrainerCameraActive(false);
  };

  const handleTrainerEnrollFace = async (useSimulation = false) => {
    setTrainerIsEnrolling(true);
    setTrainerBiometricFeedback("Analyzing facial landmarks & extracting 128-D neural embeddings...");

    try {
      let descriptor = null;
      let photo = null;
      let detectedAge = 27;
      let detectedGender = "Male";

      if (!useSimulation && trainerVideoRef.current && trainerCameraActive) {
        const faceData = await sampleBestFace(trainerVideoRef.current, 3);
        if (!faceData) {
          setTrainerBiometricFeedback("⚠️ No face detected. Ensure your face is centered inside the reticle.");
          setTrainerIsEnrolling(false);
          return;
        }
        descriptor = faceData.descriptor;
        photo = captureVideoFrame(trainerVideoRef.current);
        if (faceData.age) detectedAge = faceData.age;
        if (faceData.gender) detectedGender = faceData.gender;
      } else {
        descriptor = generateDeterministicVector(`trainer-${currentTrainer.id}-${currentTrainer.name}`);
        photo = currentTrainer.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80";
      }

      const res = await enrollFaceLive({
        userId: currentTrainer.id,
        faceDescriptor: descriptor,
        facePhoto: photo,
        age: detectedAge,
        gender: detectedGender,
      });

      if (res && res.success) {
        playFaceIdUnlockSound();
        setTrainerFaceEnrolled(true);
        const timeNow = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        setTrainerFaceEnrolledAt(timeNow);
        if (photo) setTrainerFacePhoto(photo);
        setTrainerBiometricFeedback(`✓ Face ID successfully registered! AI detected ${detectedGender}, approx ${detectedAge} years.`);
        setTrainerTurnstileAlert(`Biometric turnstile profile calibrated for Coach ${currentTrainer.name}. You can now unlock campus turnstiles via Face ID!`);
        setTimeout(() => setTrainerTurnstileAlert(null), 8000);
      } else {
        setTrainerBiometricFeedback(res?.message || "Failed to register Face ID.");
      }
    } catch (err) {
      console.warn("Trainer face enroll error:", err);
      setTrainerBiometricFeedback("Network error enrolling Face ID.");
    } finally {
      setTrainerIsEnrolling(false);
    }
  };

  const handleTrainerTestFaceScan = async () => {
    setTrainerIsScanning(true);
    setTrainerBiometricFeedback("Testing turnstile face match with neural network...");

    try {
      let descriptor = null;
      if (trainerVideoRef.current && trainerCameraActive) {
        const faceData = await sampleBestFace(trainerVideoRef.current, 2);
        if (!faceData) {
          setTrainerBiometricFeedback("⚠️ No face detected in camera. Center face in sensor.");
          setTrainerIsScanning(false);
          return;
        }
        descriptor = faceData.descriptor;
      } else {
        descriptor = generateDeterministicVector(`trainer-${currentTrainer.id}-${currentTrainer.name}`);
      }

      const res = await recognizeFaceLive({
        faceDescriptor: descriptor,
        terminal: "Turnstile #01 (Main Entrance - Face Scanner)",
      });

      setTrainerIsScanning(false);
      if (res && res.matched && res.member) {
        playFaceIdUnlockSound();
        setTrainerBiometricFeedback(`✓ TURNSTILE UNLOCKED: Verified Coach ${res.member.name} (${res.member.confidence || "99.2%"} Match)`);
        setTrainerTurnstileAlert(`ACCESS AUTHORIZED • Turnstile #01 Unlocked for Coach ${res.member.name} (${res.member.role || "Trainer"}). Floor attendance timestamped!`);
        setTimeout(() => setTrainerTurnstileAlert(null), 8000);
      } else {
        playFaceIdRejectSound();
        setTrainerBiometricFeedback(`❌ ACCESS DENIED: ${res?.message || "Face does not match registered trainer."}`);
      }
    } catch (err) {
      setTrainerIsScanning(false);
      console.warn("Trainer face test error:", err);
      setTrainerBiometricFeedback("Network error verifying face biometrics.");
    }
  };

  // Load backend assigned trainees, chat messages, and subscribe to live Socket.io events
  useEffect(() => {
    let activeTrainerId = currentTrainer?.id || 4;
    try {
      const stored = localStorage.getItem("fitpulse_user");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.role === "Trainer") {
          setCurrentTrainer(parsed);
          activeTrainerId = parsed.id || activeTrainerId;
        }
      }
    } catch {
      /* ignore */
    }

    // Check Face ID status for this coach
    fetchFaceStatusLive(activeTrainerId).then((statusRes) => {
      if (statusRes && statusRes.success && statusRes.enrolled) {
        setTrainerFaceEnrolled(true);
        setTrainerFaceEnrolledAt(
          statusRes.enrolledAt
            ? new Date(statusRes.enrolledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            : "Active Biometrics"
        );
        if (statusRes.photo) {
          setTrainerFacePhoto(statusRes.photo);
        }
      }
    });

    // Load trainer payments & revenue from Cashfree
    const loadTrainerPayments = (trId) => {
      fetchTrainerPaymentsLive(trId).then((payRes) => {
        if (payRes && payRes.success) {
          setTrainerPayments(payRes.payments || []);
          setTrainerPtRevenue(payRes.ptRevenue || 0);
          setTrainerClientCount(payRes.clientCount || 0);
        }
      });
    };
    loadTrainerPayments(activeTrainerId);

    // Role & Trainee Isolation: Fetch ONLY assigned trainees from MySQL
    fetchTrainerTrainees(activeTrainerId).then((res) => {
      if (res && res.success && res.trainees && res.trainees.length > 0) {
        const mapped = res.trainees.map((t) => ({
          id: String(t.id),
          dbId: t.id,
          name: t.name.split(" ")[0],
          fullName: t.name,
          email: t.email,
          phone: t.phone,
          goal: t.goal || "Build Muscle",
          category: "Muscle Gain",
          height: `${t.height || 180} cm`,
          weight: `${t.weight || 72.4} kg`,
          targetWeight: "75 kg",
          progress: t.attendanceVisits ? Math.min(Math.round((t.attendanceVisits / 24) * 100), 100) : 0,
          streak: t.streakDays ?? 0,
          lastSession: t.attendanceVisits > 0 ? "Recent Session" : "None Yet",
          attendance: `${t.attendanceVisits ?? 0} visits`,
          status: "Active",
          avatar: t.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
          macros: {
            calories: t.nutritionToday?.totalCalories ?? 2500,
            protein: t.nutritionToday?.totalProtein ?? 160,
            carbs: t.nutritionToday?.totalCarbs ?? 260,
            fat: t.nutritionToday?.totalFats ?? 60,
            water: 3.5,
          },
          prs: t.prs || { bench: "80 kg (+5kg)", squat: "110 kg (+10kg)", deadlift: "140 kg (+15kg)" },
          measurements: { chest: "40.0 in (+1.0)", arms: "15.0 in (+0.5)", waist: "32.0 in (-1.0)", bf: "15.0% (-2.0%)" },
        }));

        setClients(mapped);
        setSelectedClientId(mapped[0].id);
        setBuilderTargetClient(mapped[0].id);
        setActiveChatClientId(mapped[0].id);

        if (res.trainees[0]?.nutritionToday) {
          const nt = res.trainees[0].nutritionToday;
          setTraineeNutrition({
            calories: nt.totalCalories || 2450,
            protein: nt.totalProtein || 172,
            carbs: nt.totalCarbs || 253,
            fat: nt.totalFats || 56,
            water: 3.8,
            meals: (nt.meals || []).map((m) => ({
              id: m.id,
              name: m.mealName,
              title: m.mealName,
              calories: m.calories,
              protein: m.protein,
              time: m.timeLogged || "Today",
            })),
          });
        }

        // Fetch initial chat messages with first assigned trainee
        fetchChatMessages(activeTrainerId, mapped[0].dbId, "member_trainer").then((chatRes) => {
          if (chatRes && chatRes.success && chatRes.messages && chatRes.messages.length > 0) {
            const mappedMsgs = chatRes.messages.map((m) => {
              const isMe = Number(m.sender_id || m.senderId) === Number(activeTrainerId);
              const tDate = m.created_at || m.createdAt;
              const timeStr = tDate && !isNaN(new Date(tDate).getTime())
                ? new Date(tDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                : "Just now";
              return {
                id: m.id,
                sender: isMe ? (currentTrainer?.name || "Coach") : mapped[0].name,
                text: m.message,
                time: timeStr,
                isMe,
              };
            });
            setChatMessages((prev) => ({
              ...prev,
              [mapped[0].id]: mappedMsgs,
              [String(mapped[0].dbId)]: mappedMsgs,
            }));
          }
        });
      } else {
        // Coach has 0 assigned clients - fresh state for new coach
        setClients([]);
        setSelectedClientId(null);
        setBuilderTargetClient("");
        setActiveChatClientId("admin");
        setTraineeNutrition({
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          water: 0,
          meals: [],
        });
      }
    });

    // Fetch initial chat messages with Admin Dispatch (id: 3)
    fetchChatMessages(activeTrainerId, 3, "admin_trainer").then((adminRes) => {
      if (adminRes && adminRes.success && adminRes.messages && adminRes.messages.length > 0) {
        const mappedAdminMsgs = adminRes.messages.map((m) => {
          const isMe = Number(m.sender_id || m.senderId) === Number(activeTrainerId);
          const tDate = m.created_at || m.createdAt;
          const timeStr = tDate && !isNaN(new Date(tDate).getTime())
            ? new Date(tDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            : "Just now";
          return {
            id: m.id,
            sender: isMe ? (currentTrainer?.name || "Coach") : "Gym Administrator",
            text: m.message,
            time: timeStr,
            isMe,
          };
        });
        setChatMessages((prev) => ({
          ...prev,
          admin: mappedAdminMsgs,
        }));
      }
    });

    // Trainer 1-Minute Rotating MFA Passcode ticker loop
    const loadTrainerMfa = async () => {
      const res = await fetchUserMfaCodeLive(activeTrainerId);
      if (res && res.success) {
        setTrainerMfaCode(String(res.code || res.mfaCode || "------"));
        setTrainerMfaSecondsRemaining(res.secondsRemaining || 60);
      }
    };
    loadTrainerMfa();

    const mfaTimer = setInterval(() => {
      setTrainerMfaSecondsRemaining((prev) => {
        if (prev <= 1) {
          loadTrainerMfa();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    // Real-time Chat Socket Listener (STRICT ISOLATION & DEDUPLICATION)
    const unsubChat = subscribeRealtime("chat:message", (data) => {
      const ch = data.channel_type || data.channelType;
      const sId = Number(data.sender_id || data.senderId);
      const rId = Number(data.receiver_id || data.receiverId);
      const myTrainerId = Number(activeTrainerId);

      if (ch === "admin_trainer") {
        if (sId !== myTrainerId && rId !== myTrainerId) return;
        const isMe = sId === myTrainerId;
        const tDate = data.created_at || data.createdAt;
        const timeStr = tDate && !isNaN(new Date(tDate).getTime())
          ? new Date(tDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : "Just now";

        const bubble = {
          id: data.id || Date.now(),
          sender: isMe ? (currentTrainer?.name || "Trainer") : (data.sender_name || "Gym Administrator"),
          text: data.message,
          time: timeStr,
          isMe,
        };

        setChatMessages((prev) => {
          const list = prev.admin || [];
          if (list.some((m) => m.id === bubble.id)) return prev;
          const optIdx = list.findIndex((m) => m.isOptimistic && m.text === bubble.text && m.isMe === isMe);
          if (optIdx !== -1) {
            const updated = [...list];
            updated[optIdx] = { ...updated[optIdx], id: bubble.id, isOptimistic: false };
            return { ...prev, admin: updated };
          }
          return { ...prev, admin: [...list, bubble] };
        });
      } else if (ch === "member_trainer") {
        if (sId !== myTrainerId && rId !== myTrainerId) return;
        const isMe = sId === myTrainerId;
        const traineeId = isMe ? rId : sId;
        const traineeKey = String(traineeId);

        const tDate = data.created_at || data.createdAt;
        const timeStr = tDate && !isNaN(new Date(tDate).getTime())
          ? new Date(tDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : "Just now";

        const bubble = {
          id: data.id || Date.now(),
          sender: isMe ? (currentTrainer?.name || "Trainer") : (data.sender_name || "Trainee"),
          text: data.message,
          time: timeStr,
          isMe,
        };

        setChatMessages((prev) => {
          const list = prev[traineeKey] || prev["1"] || [];
          if (list.some((m) => m.id === bubble.id)) return prev;
          const optIdx = list.findIndex((m) => m.isOptimistic && m.text === bubble.text && m.isMe === isMe);
          if (optIdx !== -1) {
            const updated = [...list];
            updated[optIdx] = { ...updated[optIdx], id: bubble.id, isOptimistic: false };
            return {
              ...prev,
              [traineeKey]: updated,
              "1": traineeId === 1 ? updated : (prev["1"] || []),
            };
          }
          return {
            ...prev,
            [traineeKey]: [...list, bubble],
            "1": traineeId === 1 ? [...list, bubble] : (prev["1"] || []),
          };
        });
      }
    });

    // Real-time Nutrition Telemetry Socket Listener
    const unsubNutrition = subscribeRealtime("nutrition:logged", (data) => {
      setTraineeNutrition((prev) => ({
        ...prev,
        calories: (prev.calories || 2450) + (data.caloriesAdded || 300),
        protein: (prev.protein || 172) + (data.proteinAdded || 25),
        meals: [
          {
            id: Date.now(),
            name: data.mealType || "Logged Intake",
            title: data.foodName || "Nutrient Log",
            calories: data.caloriesAdded || 300,
            protein: data.proteinAdded || 25,
            time: "Just now",
          },
          ...prev.meals,
        ],
      }));
    });

    // Real-time Member Body Metrics & Fitness Preferences Listener
    const unsubPrefs = subscribeRealtime("member:preferences-updated", (data) => {
      setClients((prev) =>
        prev.map((c) =>
          Number(c.dbId || c.id) === Number(data.memberId)
            ? {
                ...c,
                height: data.height ? `${data.height} cm` : c.height,
                weight: data.weight ? `${data.weight} kg` : c.weight,
                goal: data.goal || c.goal,
                avatar: data.avatar || c.avatar,
              }
            : c
        )
      );
    });

    // Real-time Physical Development: Personal Records (PRs)
    const unsubProgress = subscribeRealtime("progress:updated", (data) => {
      if (data.newPr && data.memberId) {
        setClients((prev) =>
          prev.map((c) => {
            if (Number(c.dbId || c.id) === Number(data.memberId)) {
              const lift = (data.newPr.liftName || "").toLowerCase();
              const newPrs = { ...c.prs };
              const diff = (data.newPr.weightKg - data.newPr.previousWeightKg).toFixed(1);
              const badge = diff > 0 ? `+${diff}kg` : "+5kg";

              if (lift.includes("bench")) {
                newPrs.bench = `${data.newPr.weightKg} kg (${badge})`;
              } else if (lift.includes("squat")) {
                newPrs.squat = `${data.newPr.weightKg} kg (${badge})`;
              } else if (lift.includes("deadlift")) {
                newPrs.deadlift = `${data.newPr.weightKg} kg (${badge})`;
              }

              return {
                ...c,
                prs: newPrs,
              };
            }
            return c;
          })
        );
      }
    });

    // Real-time Attendance Check-in
    const unsubAttendance = subscribeRealtime("attendance:scanned", (data) => {
      setClients((prev) =>
        prev.map((c) =>
          Number(c.dbId || c.id) === Number(data.userId)
            ? { ...c, attendance: `${data.monthlyCount || 19} visits`, streak: data.streakDays || 7 }
            : c
        )
      );
    });

    // Real-time Dedicated Athlete Arrival Alert for Coach
    const unsubAthleteArrival = subscribeRealtime("trainer:client-checkin", (data) => {
      if (Number(data.trainerId) === Number(activeTrainerId)) {
        setAthleteArrivalToast({
          name: data.userName,
          terminal: data.terminal,
          time: data.time || "Just now",
          streak: data.streakDays || 7,
        });

        // Auto clear toast after 6 seconds
        setTimeout(() => {
          setAthleteArrivalToast(null);
        }, 6000);

        setClients((prev) =>
          prev.map((c) =>
            Number(c.dbId || c.id) === Number(data.userId)
              ? { ...c, attendance: `${data.monthlyCount || 19} visits`, streak: data.streakDays || 7, status: "🟢 In Gym Now" }
              : c
          )
        );
      }
    });

    // Real-time Trainee Assigned / Switched
    const unsubAssigned = subscribeRealtime("trainee:assigned", (data) => {
      fetchTrainerTrainees(activeTrainerId).then((res) => {
        if (res && res.success && res.trainees) {
          const mapped = res.trainees.map((t) => ({
            id: String(t.id),
            dbId: t.id,
            name: t.name.split(" ")[0],
            fullName: t.name,
            email: t.email,
            phone: t.phone,
            goal: t.goal || "Build Muscle",
            category: "Muscle Gain",
            height: `${t.height || 180} cm`,
            weight: `${t.weight || 72.4} kg`,
            targetWeight: "75 kg",
            progress: t.attendanceVisits ? Math.min(Math.round((t.attendanceVisits / 24) * 100), 100) : 0,
            streak: t.streakDays ?? 0,
            lastSession: t.attendanceVisits > 0 ? "Recent Session" : "None Yet",
            attendance: `${t.attendanceVisits ?? 0} visits`,
            status: "Active",
            avatar: t.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
            macros: {
              calories: t.nutritionToday?.totalCalories ?? 0,
              protein: t.nutritionToday?.totalProtein ?? 0,
              carbs: t.nutritionToday?.totalCarbs ?? 0,
              fat: t.nutritionToday?.totalFats ?? 0,
              water: 0.0,
            },
            prs: t.prs || { bench: "-- kg", squat: "-- kg", deadlift: "-- kg" },
            measurements: { chest: "--", arms: "--", waist: "--", bf: "--" },
          }));
          setClients(mapped);
          if (mapped.length > 0) {
            setSelectedClientId(mapped[0].id);
            setActiveChatClientId(mapped[0].id);
          }
        }
      });
    });

    // Real-time Trainee Released
    const unsubReleased = subscribeRealtime("trainee:released", () => {
      fetchTrainerTrainees(activeTrainerId).then((res) => {
        if (res && res.success && res.trainees) {
          const mapped = res.trainees.map((t) => ({
            id: String(t.id),
            dbId: t.id,
            name: t.name.split(" ")[0],
            fullName: t.name,
            email: t.email,
            phone: t.phone,
            goal: t.goal || "Build Muscle",
            category: "Muscle Gain",
            height: `${t.height || 180} cm`,
            weight: `${t.weight || 72.4} kg`,
            targetWeight: "75 kg",
            progress: t.attendanceVisits ? Math.min(Math.round((t.attendanceVisits / 24) * 100), 100) : 0,
            streak: t.streakDays ?? 0,
            lastSession: t.attendanceVisits > 0 ? "Recent Session" : "None Yet",
            attendance: `${t.attendanceVisits ?? 0} visits`,
            status: "Active",
            avatar: t.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
            macros: {
              calories: t.nutritionToday?.totalCalories ?? 0,
              protein: t.nutritionToday?.totalProtein ?? 0,
              carbs: t.nutritionToday?.totalCarbs ?? 0,
              fat: t.nutritionToday?.totalFats ?? 0,
              water: 0.0,
            },
            prs: t.prs || { bench: "-- kg", squat: "-- kg", deadlift: "-- kg" },
            measurements: { chest: "--", arms: "--", waist: "--", bf: "--" },
          }));
          setClients(mapped);
        }
      });
    });

    // Real-time Trainer Fee Paid via Cashfree
    const unsubTrainerPayment = subscribeRealtime("trainer:payment_received", (payload) => {
      if (!payload?.trainerId || Number(payload.trainerId) === Number(activeTrainerId)) {
        loadTrainerPayments(activeTrainerId);
        fetchTrainerTrainees(activeTrainerId).then((res) => {
          if (res && res.success && res.trainees) {
            const mapped = res.trainees.map((t) => ({
              id: String(t.id),
              dbId: t.id,
              name: t.name.split(" ")[0],
              fullName: t.name,
              email: t.email,
              phone: t.phone,
              goal: t.goal || "Build Muscle",
              category: "Muscle Gain",
              height: `${t.height || 180} cm`,
              weight: `${t.weight || 72.4} kg`,
              targetWeight: "75 kg",
              progress: t.attendanceVisits ? Math.min(Math.round((t.attendanceVisits / 24) * 100), 100) : 0,
              streak: t.streakDays ?? 0,
              lastSession: t.attendanceVisits > 0 ? "Recent Session" : "None Yet",
              attendance: `${t.attendanceVisits ?? 0} visits`,
              status: "Active",
              avatar: t.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
              macros: {
                calories: t.nutritionToday?.totalCalories ?? 2500,
                protein: t.nutritionToday?.totalProtein ?? 160,
                carbs: t.nutritionToday?.totalCarbs ?? 260,
                fat: t.nutritionToday?.totalFats ?? 60,
                water: 3.5,
              },
              prs: t.prs || { bench: "-- kg", squat: "-- kg", deadlift: "-- kg" },
              measurements: { chest: "--", arms: "--", waist: "--", bf: "--" },
            }));
            setClients(mapped);
          }
        });
      }
    });

    return () => {
      clearInterval(mfaTimer);
      if (unsubChat) unsubChat();
      if (unsubNutrition) unsubNutrition();
      if (unsubPrefs) unsubPrefs();
      if (unsubProgress) unsubProgress();
      if (unsubAttendance) unsubAttendance();
      if (unsubAthleteArrival) unsubAthleteArrival();
      if (unsubAssigned) unsubAssigned();
      if (unsubReleased) unsubReleased();
      if (unsubTrainerPayment) unsubTrainerPayment();
    };
  }, []);

  // Load chat messages when activeChatClientId changes (Admin Dispatch OR Trainees)
  useEffect(() => {
    const trainerId = currentTrainer?.id || 4;

    if (activeChatClientId === "admin") {
      fetchChatMessages(trainerId, 3, "admin_trainer").then((res) => {
        if (res && res.success && res.messages) {
          const mappedMsgs = res.messages.map((m) => {
            const isMe = Number(m.sender_id || m.senderId) === Number(trainerId);
            const tDate = m.created_at || m.createdAt;
            const timeStr =
              tDate && !isNaN(new Date(tDate).getTime())
                ? new Date(tDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                : "Just now";
            return {
              id: m.id,
              sender: isMe ? (currentTrainer?.name || "Coach") : "Gym Administrator",
              text: m.message,
              time: timeStr,
              isMe,
            };
          });
          setChatMessages((prev) => ({
            ...prev,
            admin: mappedMsgs,
          }));
        }
      });
      return;
    }

    const targetClient = clients.find((c) => c.id === activeChatClientId);
    if (!targetClient) return;
    const targetDbId = targetClient.dbId || targetClient.id;

    fetchChatMessages(trainerId, targetDbId, "member_trainer").then((res) => {
      if (res && res.success && res.messages) {
        const mappedMsgs = res.messages.map((m) => {
          const isMe = Number(m.sender_id || m.senderId) === Number(trainerId);
          const tDate = m.created_at || m.createdAt;
          const timeStr =
            tDate && !isNaN(new Date(tDate).getTime())
              ? new Date(tDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : "Just now";
          return {
            id: m.id,
            sender: isMe ? (currentTrainer?.name || "Coach") : (m.sender_name || targetClient.name || "Trainee"),
            text: m.message,
            time: timeStr,
            isMe,
          };
        });
        setChatMessages((prev) => ({
          ...prev,
          [String(targetDbId)]: mappedMsgs,
          [String(activeChatClientId)]: mappedMsgs,
        }));
      }
    });
  }, [activeChatClientId, currentTrainer.id, clients]);

  const scrollToModule = (id) => {
    setActiveSection(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
    }
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!chatInputText.trim()) return;

    const text = chatInputText.trim();
    setChatInputText("");

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const localId = Date.now();

    const isAdminChat = activeChatClientId === "admin";
    const targetClient = clients.find((c) => c.id === activeChatClientId) || selectedClient;
    if (!isAdminChat && !targetClient) {
      alert("No active client selected to message.");
      return;
    }
    const targetDbId = isAdminChat ? 3 : Number(targetClient?.dbId || targetClient?.id || 1);
    const targetKey = isAdminChat ? "admin" : String(targetDbId);

    const newMsg = {
      id: localId,
      sender: currentTrainer?.name || "Coach",
      text: text,
      time: timeStr,
      isMe: true,
      isOptimistic: true,
    };

    setChatMessages((prev) => ({
      ...prev,
      [targetKey]: [...(prev[targetKey] || []), newMsg],
      ...(isAdminChat ? {} : { [String(activeChatClientId)]: [...(prev[String(activeChatClientId)] || []), newMsg] }),
    }));

    // Broadcast across Socket.io & save to MySQL
    try {
      const payload = {
        sender_id: currentTrainer.id || 4,
        sender_name: currentTrainer.name || "Coach",
        sender_role: "Trainer",
        receiver_id: targetDbId,
        receiver_name: isAdminChat ? "Gym Administrator" : (targetClient?.fullName || targetClient?.name || "Trainee"),
        channel_type: isAdminChat ? "admin_trainer" : "member_trainer",
        message: text,
      };

      const res = await sendChatMessageLive(payload);
      if (res && res.success && res.message) {
        setChatMessages((prev) => ({
          ...prev,
          [targetKey]: (prev[targetKey] || []).map((m) =>
            m.id === localId ? { ...m, id: res.message.id, isOptimistic: false } : m
          ),
        }));
      }
    } catch (err) {
      console.warn("Send message error:", err);
    }
  };

  const handleAddExerciseToBuilder = (e) => {
    e?.preventDefault?.();
    if (!newExName.trim()) return;

    const newEx = {
      id: Date.now(),
      name: newExName.trim(),
      sets: parseInt(newExSets, 10) || 3,
      reps: newExReps || "10",
      weight: newExWeight || "BW",
      rest: "60s",
    };

    setBuilderExercises((prev) => [...prev, newEx]);
    setNewExName("");
  };

  const handleAssignPlan = async () => {
    if (!builderExercises.length) return;
    if (clients.length === 0 || !builderTargetClient) {
      alert("No assigned client selected. Once gym management links trainees to your roster, you can assign customized training routines.");
      return;
    }
    const targetClient = clients.find((c) => c.id === builderTargetClient);
    const target = targetClient?.name || "Client";
    setPlanAssignedAlert(`Routine "${builderPlanName}" (${builderExercises.length} exercises) successfully assigned to ${target}!`);
    setTimeout(() => setPlanAssignedAlert(""), 4500);

    // Broadcast live to member dashboard and MySQL database
    try {
      await assignWorkoutLive({
        userId: targetClient?.dbId || targetClient?.id || 1,
        title: builderPlanName,
        phase: "Phase II",
        exercises: builderExercises.map((e) => ({
          name: e.name,
          target: "Hypertrophy",
          sets: `${e.sets} sets`,
          reps: `${e.reps} reps`,
          weight: e.weight || "30 kg",
        })),
        trainerName: `Coach ${currentTrainer?.name || "Trainer"}`,
      });
    } catch {
      /* ignore */
    }
  };

  const toggleClientAttendance = (clientId) => {
    setClientAttendanceState((prev) => ({
      ...prev,
      [clientId]: prev[clientId] === "present" ? "absent" : "present",
    }));
  };

  const filteredClients = clients.filter((c) => {
    const matchesCat = clientCategoryFilter === "All" || c.category === clientCategoryFilter;
    const matchesSearch = !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.goal.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const filteredExercises = exerciseDatabase.filter((ex) => {
    const matchesMuscle = exerciseMuscleFilter === "All" || ex.muscle === exerciseMuscleFilter;
    const matchesSearch = !searchQuery || ex.name.toLowerCase().includes(searchQuery.toLowerCase()) || ex.muscle.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesMuscle && matchesSearch;
  });

  return (
    <div className="trainer-dashboard-container">
      {/* Subtle Atmospheric Gym Background (Opacity 0.16, dark masked) */}
      <img
        src="/assets/auth-gym-clean-bg.jpg"
        alt="FitPulse Luxury Campus"
        className="module-page-bg"
      />
      <div className="module-page-vignette" />

      {/* 3D Glassmorphic Sidebar Dock matching Navbar GUI */}
      <TrainerSidebar3D
        activeSection={activeSection}
        onSelectModule={scrollToModule}
        trainer={currentTrainer}
      />

      {/* =========================================================
          MAIN SCROLL CONTENT CONTAINER
          ========================================================= */}
      <main className="trainer-main-scroll">
        {/* Top telemetry bar with search and quick actions */}
        <header className="trainer-topbar">
          <div className="trainer-search-box">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className="trainer-search-input"
              placeholder="Search clients, exercises, workouts, notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="trainer-topbar-actions">
            <button className="trainer-quick-btn" onClick={() => scrollToModule("section-trainer-workout-plans")}>
              + Create Routine
            </button>
            <button className="trainer-quick-btn" onClick={() => scrollToModule("section-trainer-attendance")}>
              + Log Attendance
            </button>
            <NotificationBell
              userId={currentTrainer.id || 4}
              onNavigateAction={() => scrollToModule("section-trainer-clients")}
            />
          </div>
        </header>

        {/* Real-time Athlete Arrival Telemetry Floating Banner */}
        {athleteArrivalToast && (
          <div
            style={{
              position: "fixed",
              top: 20,
              right: 24,
              zIndex: 9999,
              background: "rgba(8, 14, 26, 0.95)",
              border: "1px solid #00f2fe",
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.8), 0 0 25px rgba(0, 242, 254, 0.4)",
              borderRadius: 14,
              padding: "14px 18px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              backdropFilter: "blur(16px)",
              animation: "acrFadeIn 0.3s ease-out",
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: "rgba(0, 242, 254, 0.2)",
                color: "#00f2fe",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.3rem",
              }}
            >
              🏃
            </div>
            <div>
              <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "#ffffff" }}>
                Athlete Arrival: {athleteArrivalToast.name}
              </div>
              <div style={{ fontSize: "0.74rem", color: "#94a3b8", marginTop: 2 }}>
                Scanned in at {athleteArrivalToast.terminal} ({athleteArrivalToast.time}) • {athleteArrivalToast.streak}-Day Streak 🔥
              </div>
            </div>
            <button
              onClick={() => setAthleteArrivalToast(null)}
              style={{
                background: "none",
                border: "none",
                color: "#64748b",
                cursor: "pointer",
                fontSize: "0.9rem",
                marginLeft: 10,
                padding: "4px",
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* =========================================================
            01. 🏠 DASHBOARD (COMMAND CENTER)
            ========================================================= */}
        <section
          id="section-trainer-dashboard"
          className={`trainer-module-section ${visibleSections.has("section-trainer-dashboard") ? "in-view" : "out-of-view"}`}
        >
          <div className="trainer-card" style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
              <div>
                <div style={{ fontSize: "0.8rem", color: "var(--tp-cyan)", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  COACHING COMMAND CENTER • {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                </div>
                <h1 style={{ margin: "6px 0 8px 0", fontSize: "2rem", fontWeight: 900, color: "#ffffff" }}>
                  Good morning, Coach {currentTrainer.name}
                </h1>
                <p style={{ margin: 0, color: "var(--tp-text-muted)", fontSize: "0.92rem", maxWidth: 640 }}>
                  {clients.length === 0
                    ? "You are active on gym floor duty. Management will link your trainee roster shortly. All campus turnstiles, telemetry, and duty logs sync in real time."
                    : `You have ${clients.length} active athlete${clients.length > 1 ? "s" : ""} on your coaching roster today. All workout progress and nutrition logs sync in real time.`}
                </p>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <span className="dash-hud-pill trainer-hud-pill" style={{ position: "static" }}>
                  <span className="dash-hud-dot" /> GYM FLOOR ACTIVE
                </span>
              </div>
            </div>

            {/* Quick Actions Bar */}
            <div className="trainer-quick-actions-bar">
              <button className="trainer-quick-btn" onClick={() => scrollToModule("section-trainer-clients")}>
                👥 View Assigned Clients ({clients.length})
              </button>
              <button className="trainer-quick-btn" onClick={() => scrollToModule("section-trainer-workout-plans")}>
                🏋️ Assign Workout Plan
              </button>
              <button className="trainer-quick-btn" onClick={() => scrollToModule("section-trainer-schedule")}>
                📅 Today's Schedule ({clients.length === 0 ? 0 : Math.min(clients.length * 2, 6)} Sessions)
              </button>
              <button className="trainer-quick-btn" onClick={() => scrollToModule("section-trainer-messages")}>
                💬 Message {clients.length > 0 ? clients[0].name : "Management"}
              </button>
            </div>
          </div>

          {/* 4 Stat Tiles */}
          <div className="trainer-stats-grid">
            <div className="trainer-stat-tile">
              <div className="trainer-stat-header">
                <span className="trainer-stat-label">ACTIVE CLIENTS</span>
                <span className="trainer-stat-badge">ROSTER</span>
              </div>
              <div className="trainer-stat-value">{clients.length}</div>
              <div className="trainer-stat-sub">
                {clients.length === 0
                  ? "Awaiting member assignment from management"
                  : `${clients.length} active client${clients.length > 1 ? "s" : ""} on roster`}
              </div>
            </div>

            <div className="trainer-stat-tile">
              <div className="trainer-stat-header">
                <span className="trainer-stat-label">TODAY'S SESSIONS</span>
                <span className="trainer-stat-badge highlight">{clients.length === 0 ? "0 TOTAL" : `${Math.min(clients.length * 2, 6)} TOTAL`}</span>
              </div>
              <div className="trainer-stat-value">{clients.length === 0 ? 0 : Math.min(clients.length * 2, 6)}</div>
              <div className="trainer-stat-sub">
                {clients.length === 0
                  ? "Floor supervision & duty hours active"
                  : `${Math.min(clients.length, 3)} Completed • ${Math.max(0, clients.length * 2 - 3)} Remaining`}
              </div>
            </div>

            <div className="trainer-stat-tile">
              <div className="trainer-stat-header">
                <span className="trainer-stat-label">ATTENDANCE RATE</span>
                <span className="trainer-stat-badge">MONTHLY</span>
              </div>
              <div className="trainer-stat-value">{clients.length === 0 ? "100%" : "96%"}</div>
              <div className="trainer-stat-sub">
                {clients.length === 0 ? "On-duty facility attendance logged" : "+4% higher than gym target"}
              </div>
            </div>

            <div className="trainer-stat-tile">
              <div className="trainer-stat-header">
                <span className="trainer-stat-label">PLANS TO REVIEW</span>
                <span className="trainer-stat-badge">ACTION</span>
              </div>
              <div className="trainer-stat-value">{clients.length === 0 ? 0 : clients.length}</div>
              <div className="trainer-stat-sub">
                {clients.length === 0
                  ? "No pending program reviews"
                  : `${clients.map((c) => c.name).join(", ")} phase updates`}
              </div>
            </div>
          </div>

          {/* Today's Schedule Preview & Realtime Alerts Split Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 24 }}>
            {/* Schedule Preview */}
            <div className="trainer-card">
              <div className="trainer-card-header">
                <h3>Today's Coaching Schedule</h3>
                <button className="trainer-portal-switch-btn" onClick={() => scrollToModule("section-trainer-schedule")}>
                  Full Schedule →
                </button>
              </div>
              <div className="trainer-timeline-list">
                <div className="trainer-timeline-item">
                  <div className="trainer-timeline-time">08:00 AM</div>
                  <div className="trainer-timeline-client">
                    Nihal <span style={{ fontSize: "0.78rem", color: "var(--tp-cyan)" }}>• Hypertrophy Push</span>
                  </div>
                  <span style={{ fontSize: "0.75rem", padding: "3px 8px", borderRadius: 4, background: "rgba(16,185,129,0.2)", color: "#10b981", fontWeight: 700 }}>
                    COMPLETED
                  </span>
                </div>

                <div className="trainer-timeline-item">
                  <div className="trainer-timeline-time">10:00 AM</div>
                  <div className="trainer-timeline-client">
                    Priya Patel <span style={{ fontSize: "0.78rem", color: "var(--tp-cyan)" }}>• HIIT & Glutes</span>
                  </div>
                  <span style={{ fontSize: "0.75rem", padding: "3px 8px", borderRadius: 4, background: "rgba(16,185,129,0.2)", color: "#10b981", fontWeight: 700 }}>
                    COMPLETED
                  </span>
                </div>

                <div className="trainer-timeline-item" style={{ borderLeftColor: "#f59e0b" }}>
                  <div className="trainer-timeline-time">02:00 PM</div>
                  <div className="trainer-timeline-client">
                    Rahul Sharma <span style={{ fontSize: "0.78rem", color: "#f59e0b" }}>• Form Biomechanics</span>
                  </div>
                  <span style={{ fontSize: "0.75rem", padding: "3px 8px", borderRadius: 4, background: "rgba(245,158,11,0.2)", color: "#f59e0b", fontWeight: 700 }}>
                    NEXT UP
                  </span>
                </div>

                <div className="trainer-timeline-item">
                  <div className="trainer-timeline-time">05:00 PM</div>
                  <div className="trainer-timeline-client">
                    Arjun Reddy <span style={{ fontSize: "0.78rem", color: "var(--tp-cyan)" }}>• Conditioning</span>
                  </div>
                  <span style={{ fontSize: "0.75rem", padding: "3px 8px", borderRadius: 4, background: "rgba(255,255,255,0.08)", color: "#94a3b8", fontWeight: 700 }}>
                    SCHEDULED
                  </span>
                </div>
              </div>
            </div>

            {/* Coaching Progress Alerts */}
            <div className="trainer-card">
              <div className="trainer-card-header">
                <h3>Coaching Alerts & Milestones</h3>
                <button className="trainer-portal-switch-btn" onClick={() => scrollToModule("section-trainer-notifications")}>
                  View All
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div className="trainer-alert-item highlight">
                  <span style={{ fontSize: "1.2rem" }}>🔥</span>
                  <div>
                    <div style={{ fontWeight: 800, color: "#ffffff" }}>Nihal benched 100 kg!</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--tp-text-muted)" }}>+12.5kg PR breakthrough in 6-week cycle</div>
                  </div>
                </div>

                <div className="trainer-alert-item">
                  <span style={{ fontSize: "1.2rem" }}>⚠️</span>
                  <div>
                    <div style={{ fontWeight: 800, color: "#ffffff" }}>Arjun missed workout check-in</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--tp-text-muted)" }}>2 consecutive days without logged nutrition</div>
                  </div>
                </div>

                <div className="trainer-alert-item">
                  <span style={{ fontSize: "1.2rem" }}>📋</span>
                  <div>
                    <div style={{ fontWeight: 800, color: "#ffffff" }}>Sneha's Phase 1 ends in 2 days</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--tp-text-muted)" }}>Schedule movement re-assessment test</div>
                  </div>
                </div>

                <div className="trainer-alert-item">
                  <span style={{ fontSize: "1.2rem" }}>🥗</span>
                  <div>
                    <div style={{ fontWeight: 800, color: "#ffffff" }}>Priya requested carb cycle update</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--tp-text-muted)" }}>Pending macro prescription confirmation</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================
            02. 👥 MY CLIENTS (THE FLAGSHIP MODULE)
            ========================================================= */}
        <section
          id="section-trainer-clients"
          className={`trainer-module-section ${visibleSections.has("section-trainer-clients") ? "in-view" : "out-of-view"}`}
        >
          <div className="trainer-card" style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
              <div>
                <div style={{ fontSize: "0.8rem", color: "var(--tp-cyan)", fontWeight: 800 }}>MODULE 02 • CLIENT ROSTER</div>
                <h2 style={{ margin: "4px 0", fontSize: "1.7rem", fontWeight: 900 }}>My Assigned Clients ({filteredClients.length})</h2>
                <p style={{ margin: 0, color: "var(--tp-text-muted)", fontSize: "0.88rem" }}>
                  Manage individual goals, transformation velocity, programs, and direct coaching interventions.
                </p>
              </div>

              {/* Category Filter Tabs */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {["All", "Muscle Gain", "Strength", "Fat Loss", "Conditioning", "Mobility"].map((cat) => (
                  <button
                    key={cat}
                    className={`trainer-att-tab-btn ${clientCategoryFilter === cat ? "active" : ""}`}
                    onClick={() => setClientCategoryFilter(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Client Cards Grid */}
          {filteredClients.length === 0 ? (
            <div className="trainer-card" style={{ textAlign: "center", padding: "48px 24px" }}>
              <div style={{ fontSize: "3rem", marginBottom: 14 }}>👥</div>
              <h3 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#ffffff", marginBottom: 8 }}>
                No Assigned Trainees Yet
              </h3>
              <p style={{ color: "var(--tp-text-muted)", fontSize: "0.88rem", maxWidth: 500, margin: "0 auto", lineHeight: 1.6 }}>
                You are currently active on gym floor duty. Gym Management will assign your initial member roster shortly. Once athletes are assigned, their fitness objectives, progress velocity, and direct coaching controls will appear here.
              </p>
            </div>
          ) : (
            <div className="trainer-clients-grid">
              {filteredClients.map((client) => (
                <div key={client.id} className="trainer-client-card">
                  <div>
                    <div className="trainer-client-header">
                      <img src={client.avatar} alt={client.name} className="trainer-client-avatar" />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <h4 className="trainer-client-name">{client.name}</h4>
                          <span style={{ fontSize: "0.68rem", fontWeight: 800, padding: "2px 8px", borderRadius: 4, background: "rgba(0,180,255,0.15)", color: "var(--tp-cyan)", border: "1px solid rgba(0,180,255,0.3)" }}>
                            {client.status}
                          </span>
                        </div>
                        <div className="trainer-client-goal">Goal: {client.goal}</div>
                        <div style={{ fontSize: "0.74rem", color: "var(--tp-text-muted)", marginTop: 2 }}>
                          Last Session: {client.lastSession}
                        </div>
                      </div>
                    </div>

                    {/* 4 Stat Readouts */}
                    <div className="trainer-client-stats-row" style={{ marginTop: 14 }}>
                      <div>
                        <div className="trainer-client-stat-val">{client.weight}</div>
                        <div className="trainer-client-stat-lbl">WEIGHT</div>
                      </div>
                      <div>
                        <div className="trainer-client-stat-val" style={{ color: "var(--tp-cyan)" }}>{client.progress}%</div>
                        <div className="trainer-client-stat-lbl">PROGRESS</div>
                      </div>
                      <div>
                        <div className="trainer-client-stat-val" style={{ color: "#f59e0b" }}>{client.streak}d</div>
                        <div className="trainer-client-stat-lbl">STREAK</div>
                      </div>
                      <div>
                        <div className="trainer-client-stat-val" style={{ color: "#10b981" }}>{client.attendance}</div>
                        <div className="trainer-client-stat-lbl">ATTENDANCE</div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ marginTop: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "var(--tp-text-muted)", marginBottom: 4 }}>
                        <span>Target: {client.targetWeight}</span>
                        <span>{client.progress}% Completed</span>
                      </div>
                      <div style={{ height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ width: `${client.progress}%`, height: "100%", background: "linear-gradient(90deg, #0084ff, #00d2ff)" }} />
                      </div>
                    </div>
                  </div>

                  {/* 6 Actions: View Profile, View Progress, Assign Workout, View Attendance, Create Plan, Message */}
                  <div className="trainer-client-actions">
                    <button
                      className="trainer-client-action-btn primary"
                      onClick={() => {
                        setSelectedClientId(client.id);
                        setBuilderTargetClient(client.id);
                        scrollToModule("section-trainer-workout-plans");
                      }}
                    >
                      Assign Workout
                    </button>
                    <button
                      className="trainer-client-action-btn"
                      onClick={() => {
                        setSelectedClientId(client.id);
                        scrollToModule("section-trainer-progress");
                      }}
                    >
                      Progress
                    </button>
                    <button
                      className="trainer-client-action-btn"
                      onClick={() => {
                        setActiveChatClientId(client.id);
                        scrollToModule("section-trainer-messages");
                      }}
                    >
                      Message
                    </button>
                    <button
                      className="trainer-client-action-btn"
                      onClick={() => {
                        setSelectedClientId(client.id);
                        scrollToModule("section-trainer-nutrition");
                      }}
                    >
                      Nutrition
                    </button>
                    <button
                      className="trainer-client-action-btn"
                      onClick={() => {
                        scrollToModule("section-trainer-attendance");
                      }}
                    >
                      Attendance
                    </button>
                    <button
                      className="trainer-client-action-btn"
                      onClick={() => {
                        alert(`Client Details: ${client.fullName}\nEmail: ${client.email || `${client.id}@fitpulse.com`}\nAssigned Coach: ${currentTrainer.name}\nGoal: ${client.goal}`);
                      }}
                    >
                      Profile
                    </button>
                    <button
                      className="trainer-client-action-btn"
                      style={{
                        color: "#fca5a5",
                        borderColor: "rgba(239, 68, 68, 0.3)",
                        background: "rgba(239, 68, 68, 0.08)",
                      }}
                      onClick={() => {
                        setSelectedClientForRemoval(client);
                        setShowRemovalModal(true);
                      }}
                      title="Submit removal or reassignment request to Gym Administration"
                    >
                      Request Removal
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Live Roster Removal Requests Tracker */}
          <TrainerRemovalRequestsTracker trainerId={currentTrainer.id || 4} />
        </section>

        {/* =========================================================
            03. 🏋️ WORKOUT PLANS (INTERACTIVE BUILDER)
            ========================================================= */}
        <section
          id="section-trainer-workout-plans"
          className={`trainer-module-section ${visibleSections.has("section-trainer-workout-plans") ? "in-view" : "out-of-view"}`}
        >
          <div className="trainer-card" style={{ marginBottom: 22 }}>
            <div style={{ fontSize: "0.8rem", color: "var(--tp-cyan)", fontWeight: 800 }}>MODULE 03 • PROGRAMMING & PERIODIZATION</div>
            <h2 style={{ margin: "4px 0", fontSize: "1.7rem", fontWeight: 900 }}>Workout Plan Builder</h2>
            <p style={{ margin: 0, color: "var(--tp-text-muted)", fontSize: "0.88rem" }}>
              Select client → pick movements → configure sets, reps, load & rest intervals → assign to client's dashboard.
            </p>
          </div>

          {planAssignedAlert && (
            <div style={{ padding: "14px 20px", borderRadius: 12, background: "rgba(16,185,129,0.15)", border: "1px solid #10b981", color: "#34d399", fontWeight: 800, marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
              <span>✓</span> {planAssignedAlert}
            </div>
          )}

          <div className="trainer-builder-grid">
            {/* Left: Active Builder */}
            <div className="trainer-card">
              <div className="trainer-card-header">
                <h3>Routine Protocol Editor</h3>
                <span className="dash-hud-pill trainer-hud-pill" style={{ position: "static" }}>
                  {builderExercises.length} Movements Configured
                </span>
              </div>

              <div className="trainer-builder-form">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 120px", gap: 14 }}>
                  <div className="trainer-form-group">
                    <label>ASSIGN TO CLIENT</label>
                    <select
                      className="trainer-form-select"
                      value={builderTargetClient || ""}
                      onChange={(e) => setBuilderTargetClient(e.target.value)}
                    >
                      {clients.length === 0 ? (
                        <option value="">No Assigned Clients Yet</option>
                      ) : (
                        clients.map((c) => (
                          <option key={c.id} value={c.id}>{c.name} ({c.goal})</option>
                        ))
                      )}
                    </select>
                  </div>

                  <div className="trainer-form-group">
                    <label>ROUTINE TITLE</label>
                    <input
                      type="text"
                      className="trainer-form-input"
                      value={builderPlanName}
                      onChange={(e) => setBuilderPlanName(e.target.value)}
                    />
                  </div>

                  <div className="trainer-form-group">
                    <label>DAYS / WK</label>
                    <select
                      className="trainer-form-select"
                      value={builderDaysPerWeek}
                      onChange={(e) => setBuilderDaysPerWeek(Number(e.target.value))}
                    >
                      <option value={3}>3 Days</option>
                      <option value={4}>4 Days</option>
                      <option value={5}>5 Days</option>
                      <option value={6}>6 Days</option>
                    </select>
                  </div>
                </div>

                {/* Table of Exercises in this Plan */}
                <table className="trainer-exercise-table">
                  <thead>
                    <tr>
                      <th>EXERCISE</th>
                      <th>SETS</th>
                      <th>REPS</th>
                      <th>LOAD</th>
                      <th>REST</th>
                      <th>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {builderExercises.map((ex, idx) => (
                      <tr key={ex.id || idx}>
                        <td style={{ fontWeight: 700, color: "#ffffff" }}>{ex.name}</td>
                        <td>{ex.sets}</td>
                        <td>{ex.reps}</td>
                        <td style={{ color: "var(--tp-cyan)", fontWeight: 700 }}>{ex.weight}</td>
                        <td>{ex.rest}</td>
                        <td>
                          <button
                            style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontWeight: 700 }}
                            onClick={() => setBuilderExercises(builderExercises.filter((_, i) => i !== idx))}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Add Exercise Row */}
                <div style={{ marginTop: 14, padding: 14, background: "rgba(18,26,44,0.5)", borderRadius: 10, border: "1px dashed rgba(0,180,255,0.3)" }}>
                  <div style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--tp-cyan)", marginBottom: 8 }}>+ QUICK ADD EXERCISE</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1.5fr 70px 90px 100px auto", gap: 10 }}>
                    <input
                      type="text"
                      className="trainer-form-input"
                      placeholder="e.g. Dumbbell Incline Press"
                      value={newExName}
                      onChange={(e) => setNewExName(e.target.value)}
                    />
                    <input
                      type="text"
                      className="trainer-form-input"
                      placeholder="Sets"
                      value={newExSets}
                      onChange={(e) => setNewExSets(e.target.value)}
                    />
                    <input
                      type="text"
                      className="trainer-form-input"
                      placeholder="Reps"
                      value={newExReps}
                      onChange={(e) => setNewExReps(e.target.value)}
                    />
                    <input
                      type="text"
                      className="trainer-form-input"
                      placeholder="Weight"
                      value={newExWeight}
                      onChange={(e) => setNewExWeight(e.target.value)}
                    />
                    <button className="trainer-quick-btn" onClick={handleAddExerciseToBuilder}>
                      Add
                    </button>
                  </div>
                </div>

                <button className="trainer-btn-assign" onClick={handleAssignPlan}>
                  ⚡ ASSIGN ROUTINE TO CLIENT DASHBOARD
                </button>
              </div>
            </div>

            {/* Right: Master Template Library */}
            <div className="trainer-card">
              <div className="trainer-card-header">
                <h3>Coach Master Templates</h3>
                <span style={{ fontSize: "0.75rem", color: "var(--tp-text-muted)" }}>1-Click Load</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  {
                    title: "Push/Pull/Legs Hypertrophy",
                    split: "6-Day Split • Volume Focus",
                    exs: ["Incline BB Bench", "Weighted Dips", "Overhead Press", "Lateral Raises"],
                  },
                  {
                    title: "Strength 5x5 Peaking Protocol",
                    split: "3-Day Split • Heavy Compound Focus",
                    exs: ["Squat 5x5", "Bench Press 5x5", "Deadlift 1x5", "Barbell Row 5x5"],
                  },
                  {
                    title: "Fat Loss Metabolic Density",
                    split: "4-Day Split • High Work-to-Rest Ratio",
                    exs: ["Barbell Complexes", "Kettlebell Swings", "Sled Pushes", "Assault Bike"],
                  },
                  {
                    title: "Postural Restoration & Mobility",
                    split: "4-Day Split • Corrective Protocol",
                    exs: ["Face Pulls", "Deadbugs", "Hip 90/90 Hinge", "Pallof Press"],
                  },
                ].map((tpl, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: 14,
                      borderRadius: 12,
                      background: "rgba(18,26,44,0.6)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                    onClick={() => {
                      setBuilderPlanName(tpl.title);
                      setPlanAssignedAlert(`Loaded template: "${tpl.title}" into builder.`);
                      setTimeout(() => setPlanAssignedAlert(""), 3000);
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontWeight: 800, color: "#ffffff", fontSize: "0.94rem" }}>{tpl.title}</div>
                      <span style={{ fontSize: "0.72rem", color: "var(--tp-cyan)", fontWeight: 700 }}>Load ↗</span>
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--tp-text-muted)", marginTop: 2 }}>{tpl.split}</div>
                    <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: 6 }}>
                      Key movements: {tpl.exs.join(" • ")}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================
            04. 📅 SCHEDULE (INTERACTIVE 06:00 AM - 09:00 PM TIMELINE)
            ========================================================= */}
        <section
          id="section-trainer-schedule"
          className={`trainer-module-section ${visibleSections.has("section-trainer-schedule") ? "in-view" : "out-of-view"}`}
        >
          <div className="trainer-card" style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
              <div>
                <div style={{ fontSize: "0.8rem", color: "var(--tp-cyan)", fontWeight: 800 }}>MODULE 04 • TIMELINE DISPATCH</div>
                <h2 style={{ margin: "4px 0", fontSize: "1.7rem", fontWeight: 900 }}>Daily Coaching Schedule</h2>
                <p style={{ margin: 0, color: "var(--tp-text-muted)", fontSize: "0.88rem" }}>
                  Operating hours: 06:00 AM to 09:00 PM. Includes 1-on-1 PT sessions, floor assessments, and walk-in consultation blocks.
                </p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {["Today", "Tomorrow", "This Week"].map((filter) => (
                  <button
                    key={filter}
                    className={`trainer-att-tab-btn ${scheduleDateFilter === filter ? "active" : ""}`}
                    onClick={() => setScheduleDateFilter(filter)}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="trainer-card">
            <div className="trainer-schedule-timeline">
              {(clients.length === 0
                ? [
                    { time: "06:00 AM", title: "Gym Floor Opening Protocol & Equipment Inspection", client: "Facility", type: "duty", status: "Completed" },
                    { time: "09:00 AM", title: "Floor Supervision & Biomechanical Spotting", client: "Gym Floor", type: "duty", status: "Completed" },
                    { time: "11:00 AM", title: "Open PT Walk-in Consultation", client: "Open Slot", type: "open", status: "Available" },
                    { time: "02:00 PM", title: "Facility Safety & Turnstile Calibration", client: "Turnstiles", type: "duty", status: "Upcoming" },
                    { time: "04:00 PM", title: "Open Member Form Assessment Slot", client: "Open Slot", type: "open", status: "Available" },
                    { time: "06:00 PM", title: "Peak Floor Duty & Athlete Support", client: "Facility", type: "duty", status: "Upcoming" },
                    { time: "08:00 PM", title: "Shift Wrap-up & Daily Activity Sync", client: "Facility", type: "duty", status: "Upcoming" },
                  ]
                : scheduleSlots
              ).map((slot, idx) => {
                let cardClass = "trainer-schedule-slot-card";
                if (slot.type === "pt") cardClass += " pt-session";
                else if (slot.type === "assessment") cardClass += " assessment";
                else if (slot.type === "open") cardClass += " available";

                return (
                  <div key={idx} className="trainer-schedule-hour-row">
                    <div className="trainer-schedule-hour-label">{slot.time}</div>
                    <div className={cardClass}>
                      <div>
                        <div style={{ fontWeight: 800, color: "#ffffff", fontSize: "0.95rem" }}>
                          {slot.title}
                        </div>
                        <div style={{ fontSize: "0.78rem", color: slot.type === "open" ? "var(--tp-cyan)" : "var(--tp-text-muted)", marginTop: 2 }}>
                          {slot.type === "open" ? "+ Click to book client walk-in" : `Client: ${slot.client} • Type: ${slot.type.toUpperCase()}`}
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span
                          style={{
                            fontSize: "0.75rem",
                            fontWeight: 800,
                            padding: "4px 10px",
                            borderRadius: 6,
                            background:
                              slot.status === "Completed"
                                ? "rgba(16,185,129,0.2)"
                                : slot.status === "Available"
                                ? "rgba(0,180,255,0.15)"
                                : "rgba(245,158,11,0.2)",
                            color:
                              slot.status === "Completed"
                                ? "#10b981"
                                : slot.status === "Available"
                                ? "var(--tp-cyan)"
                                : "#f59e0b",
                          }}
                        >
                          {slot.status}
                        </span>

                        {slot.type === "pt" && (
                          <button
                            className="trainer-client-action-btn"
                            onClick={() => {
                              setSelectedClientId(slot.client.toLowerCase());
                              scrollToModule("section-trainer-clients");
                            }}
                          >
                            Details
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* =========================================================
            05. 📈 CLIENT PROGRESS (COMPARATIVE ANALYTICS)
            ========================================================= */}
        <section
          id="section-trainer-progress"
          className={`trainer-module-section ${visibleSections.has("section-trainer-progress") ? "in-view" : "out-of-view"}`}
        >
          <div className="trainer-card" style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
              <div>
                <div style={{ fontSize: "0.8rem", color: "var(--tp-cyan)", fontWeight: 800 }}>MODULE 05 • COACHING ANALYTICS</div>
                <h2 style={{ margin: "4px 0", fontSize: "1.7rem", fontWeight: 900 }}>Client Transformation Analytics</h2>
                <p style={{ margin: 0, color: "var(--tp-text-muted)", fontSize: "0.88rem" }}>
                  Deep comparative tracking of lean tissue gains, 1RM strength progression, and body circumference changes.
                </p>
              </div>

              {/* Client Selector Dropdown */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: "0.82rem", color: "var(--tp-text-muted)", fontWeight: 700 }}>SELECT CLIENT:</span>
                <select
                  className="trainer-form-select"
                  value={selectedClientId || ""}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.goal})</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {!selectedClient ? (
            <div className="trainer-card" style={{ textAlign: "center", padding: "48px 24px" }}>
              <div style={{ fontSize: "3rem", marginBottom: 14 }}>📈</div>
              <h3 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#ffffff", marginBottom: 8 }}>
                No Trainee Transformation Data Yet
              </h3>
              <p style={{ color: "var(--tp-text-muted)", fontSize: "0.88rem", maxWidth: 500, margin: "0 auto", lineHeight: 1.6 }}>
                You do not have any assigned clients linked to your roster yet. Once an athlete is assigned, their anthropometric measurements, DEXA body fat telemetry, and 1RM strength progression curves will automatically render here.
              </p>
            </div>
          ) : (
            <>
              {/* 5 Core Metric Boxes */}
              <div className="trainer-progress-stats-grid">
                <div className="trainer-metric-box">
                  <div className="trainer-metric-val">{selectedClient.weight}</div>
                  <div className="trainer-metric-lbl">CURRENT WEIGHT</div>
                  <div style={{ fontSize: "0.72rem", color: "#10b981", marginTop: 4, fontWeight: 700 }}>Target: {selectedClient.targetWeight}</div>
                </div>
                <div className="trainer-metric-box">
                  <div className="trainer-metric-val" style={{ color: "var(--tp-cyan)" }}>{selectedClient.prs.bench.split(" ")[0]} kg</div>
                  <div className="trainer-metric-lbl">BENCH PRESS</div>
                  <div style={{ fontSize: "0.72rem", color: "var(--tp-cyan)", marginTop: 4, fontWeight: 700 }}>{selectedClient.prs.bench.split(" ")[2]}</div>
                </div>
                <div className="trainer-metric-box">
                  <div className="trainer-metric-val" style={{ color: "var(--tp-cyan)" }}>{selectedClient.prs.squat.split(" ")[0]} kg</div>
                  <div className="trainer-metric-lbl">SQUAT 1RM</div>
                  <div style={{ fontSize: "0.72rem", color: "var(--tp-cyan)", marginTop: 4, fontWeight: 700 }}>{selectedClient.prs.squat.split(" ")[2]}</div>
                </div>
                <div className="trainer-metric-box">
                  <div className="trainer-metric-val" style={{ color: "var(--tp-cyan)" }}>{selectedClient.prs.deadlift.split(" ")[0]} kg</div>
                  <div className="trainer-metric-lbl">DEADLIFT 1RM</div>
                  <div style={{ fontSize: "0.72rem", color: "var(--tp-cyan)", marginTop: 4, fontWeight: 700 }}>{selectedClient.prs.deadlift.split(" ")[2]}</div>
                </div>
                <div className="trainer-metric-box">
                  <div className="trainer-metric-val" style={{ color: "#10b981" }}>{selectedClient.measurements.bf.split(" ")[0]}</div>
                  <div className="trainer-metric-lbl">BODY FAT %</div>
                  <div style={{ fontSize: "0.72rem", color: "#10b981", marginTop: 4, fontWeight: 700 }}>{selectedClient.measurements.bf.split(" ")[1]}</div>
                </div>
              </div>

              {/* Spline Chart & Body Circumference Table */}
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 24 }}>
                <div className="trainer-card">
                  <div className="trainer-card-header">
                    <h3>8-Week Progression Spline</h3>
                    <span style={{ fontSize: "0.75rem", color: "var(--tp-cyan)", fontWeight: 700 }}>Strength Index vs Target</span>
                  </div>
                  <div style={{ height: 220, position: "relative", display: "flex", alignItems: "flex-end", paddingBottom: 20 }}>
                    {/* SVG Visualizing Spline */}
                    <svg width="100%" height="180" viewBox="0 0 500 180" fill="none" style={{ overflow: "visible" }}>
                      <defs>
                        <linearGradient id="splineGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#00b4ff" stopOpacity="0.4" />
                          <stop offset="100%" stopColor="#00b4ff" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M 10 150 Q 80 140, 150 120 T 300 80 T 480 30 L 480 180 L 10 180 Z"
                        fill="url(#splineGrad)"
                      />
                      <path
                        d="M 10 150 Q 80 140, 150 120 T 300 80 T 480 30"
                        stroke="#00b4ff"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                      />
                      {/* Milestones */}
                      <circle cx="10" cy="150" r="5" fill="#00b4ff" />
                      <circle cx="150" cy="120" r="5" fill="#00b4ff" />
                      <circle cx="300" cy="80" r="5" fill="#00b4ff" />
                      <circle cx="480" cy="30" r="6" fill="#ffffff" stroke="#00b4ff" strokeWidth="3" />
                    </svg>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--tp-text-muted)", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 8 }}>
                    <span>Week 1 (Baseline)</span>
                    <span>Week 3</span>
                    <span>Week 5</span>
                    <span>Week 8 (Current)</span>
                  </div>
                </div>

                {/* Anthropometric Measurements */}
                <div className="trainer-card">
                  <div className="trainer-card-header">
                    <h3>Body Measurements</h3>
                    <span style={{ fontSize: "0.75rem", color: "var(--tp-text-muted)" }}>Last check-in: 3 days ago</span>
                  </div>
                  <table className="trainer-exercise-table">
                    <thead>
                      <tr>
                        <th>METRIC</th>
                        <th>MEASUREMENT</th>
                        <th>DELTA</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Chest Girth</td>
                        <td style={{ fontWeight: 800 }}>{selectedClient.measurements.chest.split(" ")[0]} in</td>
                        <td style={{ color: "var(--tp-cyan)", fontWeight: 700 }}>{selectedClient.measurements.chest.split(" ")[1]}</td>
                      </tr>
                      <tr>
                        <td>Arm Girth (Flexed)</td>
                        <td style={{ fontWeight: 800 }}>{selectedClient.measurements.arms.split(" ")[0]} in</td>
                        <td style={{ color: "var(--tp-cyan)", fontWeight: 700 }}>{selectedClient.measurements.arms.split(" ")[1]}</td>
                      </tr>
                      <tr>
                        <td>Waist Circumference</td>
                        <td style={{ fontWeight: 800 }}>{selectedClient.measurements.waist.split(" ")[0]} in</td>
                        <td style={{ color: "#10b981", fontWeight: 700 }}>{selectedClient.measurements.waist.split(" ")[1]}</td>
                      </tr>
                      <tr>
                        <td>DEXA Body Fat %</td>
                        <td style={{ fontWeight: 800 }}>{selectedClient.measurements.bf.split(" ")[0]}</td>
                        <td style={{ color: "#10b981", fontWeight: 700 }}>{selectedClient.measurements.bf.split(" ")[1]}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </section>

        {/* =========================================================
            06. 🟠 ATTENDANCE (TRAINER DUTY + CLIENT CHECK-IN)
            ========================================================= */}
        <section
          id="section-trainer-attendance"
          className={`trainer-module-section ${visibleSections.has("section-trainer-attendance") ? "in-view" : "out-of-view"}`}
        >
          <div className="trainer-card" style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
              <div>
                <div style={{ fontSize: "0.8rem", color: "var(--tp-cyan)", fontWeight: 800 }}>MODULE 06 • ACCESS & ATTENDANCE LOG</div>
                <h2 style={{ margin: "4px 0", fontSize: "1.7rem", fontWeight: 900 }}>Attendance Management</h2>
                <p style={{ margin: 0, color: "var(--tp-text-muted)", fontSize: "0.88rem" }}>
                  Verify client session compliance and manage Coach {currentTrainer.name}'s personal gym floor duty hours.
                </p>
              </div>

              {/* 3-Way Mode Tab Selector */}
              <div className="trainer-attendance-tab-bar">
                <button
                  className={`trainer-att-tab-btn ${attendanceTab === "clients" ? "active" : ""}`}
                  onClick={() => {
                    setAttendanceTab("clients");
                    stopTrainerCamera();
                  }}
                >
                  👥 My Clients ({clients.length})
                </button>
                <button
                  className={`trainer-att-tab-btn ${attendanceTab === "duty" ? "active" : ""}`}
                  onClick={() => {
                    setAttendanceTab("duty");
                    stopTrainerCamera();
                  }}
                >
                  ⏱️ Trainer Duty Log
                </button>
                <button
                  className={`trainer-att-tab-btn ${attendanceTab === "face_id" ? "active" : ""}`}
                  onClick={() => {
                    setAttendanceTab("face_id");
                    startTrainerCamera();
                  }}
                  style={{
                    border: attendanceTab === "face_id" ? "1.5px solid #00e5ff" : "1px solid rgba(255,255,255,0.08)",
                    color: attendanceTab === "face_id" ? "#00e5ff" : "var(--tp-text-muted)",
                    boxShadow: attendanceTab === "face_id" ? "0 0 15px rgba(0, 229, 255, 0.2)" : "none",
                  }}
                >
                  📷 Coach Face ID Access {trainerFaceEnrolled && "✓"}
                </button>
              </div>
            </div>
          </div>

          {/* Coach Personal 1-Minute MFA Passcode (Near Attendance) */}
          <div
            style={{
              background: "linear-gradient(135deg, rgba(6, 14, 28, 0.95) 0%, rgba(13, 24, 44, 0.85) 100%)",
              border: "1.5px solid rgba(0, 229, 255, 0.35)",
              borderRadius: "18px",
              padding: "18px 22px",
              marginBottom: "22px",
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
                    COACH STAFF PASSCODE • ROTATES EVERY 60s
                  </span>
                  <span className="portal-weight-badge" style={{ fontSize: "0.68rem", color: "#10b981", borderColor: "rgba(16, 185, 129, 0.4)" }}>
                    STAFF TURNSTILE ACCESS
                  </span>
                </div>
                <div style={{ fontSize: "0.85rem", color: "#cbd5e1", marginTop: 2 }}>
                  Coach {currentTrainer.name}'s rolling duty passcode. Enter at turnstile terminal for floor check-in.
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
              {/* Passcode Display */}
              <div
                onClick={() => {
                  navigator.clipboard?.writeText?.(trainerMfaCode);
                  setTrainerMfaCopied(true);
                  setTimeout(() => setTrainerMfaCopied(false), 2000);
                }}
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
                {String(trainerMfaCode || "------").split("").map((digit, idx) => (
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
                <span style={{ fontSize: "0.8rem", color: trainerMfaCopied ? "#10b981" : "#64748b", marginLeft: 6 }}>
                  {trainerMfaCopied ? "✓ Copied" : "📋"}
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
                <span style={{ fontSize: "1.1rem", fontWeight: 900, color: trainerMfaSecondsRemaining <= 10 ? "#f87171" : "#10b981", fontFamily: "JetBrains Mono" }}>
                  {trainerMfaSecondsRemaining}s
                </span>
                <span style={{ fontSize: "0.65rem", color: "#8da4be" }}>RENEWS IN</span>
              </div>

              {/* Test Duty Check-In Button */}
              <button
                type="button"
                className="trainer-quick-btn"
                disabled={trainerMfaTesting}
                onClick={async () => {
                  setTrainerMfaTesting(true);
                  try {
                    const res = await verifyMfaAttendanceLive(trainerMfaCode, "Turnstile #01 (Staff Floor)");
                    if (res && res.success) {
                      setTrainerClockedIn(true);
                      setTrainerMfaFeedback("✓ Duty hours verified at Turnstile #01! Shift status: ACTIVE.");
                    } else {
                      setTrainerMfaFeedback("❌ " + (res?.message || "Failed verifying duty passcode."));
                    }
                  } catch {
                    setTrainerMfaFeedback("❌ Connection error.");
                  } finally {
                    setTrainerMfaTesting(false);
                    setTimeout(() => setTrainerMfaFeedback(null), 5000);
                  }
                }}
                style={{
                  background: "linear-gradient(135deg, #00e5ff 0%, #10b981 100%)",
                  color: "#000",
                  fontWeight: 800,
                  fontSize: "0.8rem",
                  padding: "10px 16px",
                  borderRadius: 10,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {trainerMfaTesting ? "Verifying..." : "⚡ Clock In via MFA"}
              </button>
            </div>
          </div>

          {trainerMfaFeedback && (
            <div
              style={{
                padding: "10px 16px",
                borderRadius: "10px",
                background: trainerMfaFeedback.startsWith("✓") ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                border: trainerMfaFeedback.startsWith("✓") ? "1px solid #10b981" : "1px solid #ef4444",
                color: trainerMfaFeedback.startsWith("✓") ? "#34d399" : "#f87171",
                fontSize: "0.82rem",
                fontWeight: 700,
                marginBottom: 16,
              }}
            >
              {trainerMfaFeedback}
            </div>
          )}

          {trainerTurnstileAlert && (
            <div
              style={{
                padding: "14px 20px",
                borderRadius: "12px",
                background: "rgba(16, 185, 129, 0.15)",
                border: "1.5px solid #10b981",
                color: "#34d399",
                fontWeight: 800,
                fontSize: "0.9rem",
                marginBottom: 20,
                display: "flex",
                alignItems: "center",
                gap: 12,
                boxShadow: "0 0 25px rgba(16, 185, 129, 0.2)",
              }}
            >
              <span style={{ fontSize: "1.4rem" }}>🔓</span>
              <span>{trainerTurnstileAlert}</span>
            </div>
          )}

          {/* TAB 1: CLIENTS ATTENDANCE */}
          {attendanceTab === "clients" && (
            <div className="trainer-card">
              <div className="trainer-card-header">
                <h3>Today's Assigned Clients Attendance ({clients.length})</h3>
                <span style={{ fontSize: "0.8rem", color: "var(--tp-text-muted)" }}>1-Click Check-in Toggle</span>
              </div>
              {clients.length === 0 ? (
                <div style={{ textAlign: "center", padding: "36px 16px", color: "var(--tp-text-muted)", fontSize: "0.88rem" }}>
                  <div style={{ fontSize: "2.4rem", marginBottom: 10 }}>👥</div>
                  <div style={{ fontWeight: 800, color: "#ffffff", marginBottom: 4 }}>No Assigned Clients on Roster</div>
                  <div>Gym management will assign athletes to your shift shortly. When assigned, their daily attendance check-ins will render here.</div>
                </div>
              ) : (
                clients.map((client) => {
                  const status = clientAttendanceState[client.id] || "absent";
                  return (
                    <div key={client.id} className="trainer-client-att-row">
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <img src={client.avatar} alt={client.name} style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover" }} />
                        <div>
                          <div style={{ fontWeight: 800, color: "#ffffff" }}>{client.fullName}</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--tp-text-muted)" }}>
                            Goal: {client.goal} • Last session: {client.lastSession}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <span style={{ fontSize: "0.8rem", color: "var(--tp-text-muted)", fontFamily: "JetBrains Mono" }}>
                          Monthly: {client.attendance}
                        </span>
                        <button
                          className={`trainer-btn-checkin ${status}`}
                          onClick={() => toggleClientAttendance(client.id)}
                        >
                          {status === "present" ? "✓ PRESENT" : "✕ ABSENT"}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: TRAINER DUTY LOG */}
          {attendanceTab === "duty" && (
            <div className="trainer-card">
              <div className="trainer-card-header">
                <h3>Coach {currentTrainer.name} Duty & Floor Hours</h3>
                <span style={{ fontSize: "0.8rem", color: "#10b981", fontWeight: 700 }}>
                  {trainerClockedIn ? "• CLOCKED IN (06:15 AM)" : "• CLOCKED OUT"}
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 20 }}>
                <div className="trainer-metric-box">
                  <div className="trainer-metric-val">{clients.length === 0 ? "1 / 28" : "26 / 28"}</div>
                  <div className="trainer-metric-lbl">DAYS ATTENDED THIS MONTH</div>
                </div>
                <div className="trainer-metric-box">
                  <div className="trainer-metric-val" style={{ color: "var(--tp-cyan)" }}>
                    {clients.length === 0 ? "8.0 hrs" : "174.5 hrs"}
                  </div>
                  <div className="trainer-metric-lbl">TOTAL FLOOR & PT HOURS</div>
                </div>
                <div className="trainer-metric-box">
                  <div className="trainer-metric-val" style={{ color: "#10b981" }}>
                    {clients.length === 0 ? "100%" : "93.0%"}
                  </div>
                  <div className="trainer-metric-lbl">ON-TIME PUNCTUALITY SCORE</div>
                </div>
              </div>

              <button
                className="trainer-quick-btn"
                style={{ width: "100%", justifyContent: "center", padding: 14 }}
                onClick={() => setTrainerClockedIn(!trainerClockedIn)}
              >
                {trainerClockedIn ? "Clock Out for Shift" : "Clock In for Shift"}
              </button>
            </div>
          )}

          {/* TAB 3: COACH BIOMETRIC FACE ID ACCESS */}
          {attendanceTab === "face_id" && (
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 24 }}>
              {/* Left Column: Biometric Camera Sensor */}
              <div className="trainer-card">
                <div className="trainer-card-header">
                  <div>
                    <div style={{ fontSize: "0.72rem", color: "var(--tp-cyan)", fontWeight: 800 }}>
                      BIOMETRIC OPTICAL SENSOR
                    </div>
                    <h3 style={{ margin: "2px 0 0 0" }}>Coach Face ID Calibration</h3>
                  </div>
                  <span
                    className="dash-hud-pill trainer-hud-pill"
                    style={{
                      position: "static",
                      color: trainerFaceEnrolled ? "#10b981" : "#f59e0b",
                      borderColor: trainerFaceEnrolled ? "rgba(16, 185, 129, 0.4)" : "rgba(245, 158, 11, 0.4)",
                      background: trainerFaceEnrolled ? "rgba(16, 185, 129, 0.1)" : "rgba(245, 158, 11, 0.1)",
                    }}
                  >
                    {trainerFaceEnrolled ? "✓ FACE ID ENROLLED" : "⚠️ NOT ENROLLED"}
                  </span>
                </div>

                {/* Viewport Box */}
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    height: 320,
                    background: "#050914",
                    borderRadius: 16,
                    overflow: "hidden",
                    border: trainerFaceEnrolled ? "1.5px solid rgba(16, 185, 129, 0.4)" : "1.5px solid rgba(0, 229, 255, 0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 16,
                  }}
                >
                  <video
                    ref={trainerVideoRef}
                    playsInline
                    muted
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: trainerCameraActive ? "block" : "none",
                      transform: "scaleX(-1)",
                    }}
                  />

                  {!trainerCameraActive && (
                    <div style={{ textAlign: "center", padding: 24, zIndex: 1 }}>
                      {trainerFacePhoto ? (
                        <img
                          src={trainerFacePhoto}
                          alt="Enrolled Face"
                          style={{
                            width: 110,
                            height: 110,
                            borderRadius: "50%",
                            objectFit: "cover",
                            border: "3px solid #10b981",
                            margin: "0 auto 12px auto",
                            boxShadow: "0 0 25px rgba(16, 185, 129, 0.35)",
                          }}
                        />
                      ) : (
                        <div style={{ fontSize: "3.2rem", marginBottom: 12 }}>📷</div>
                      )}
                      <div style={{ fontSize: "1rem", fontWeight: 800, color: "#ffffff" }}>
                        {trainerFaceEnrolled ? "Biometric Profile Registered" : "Coach Camera Sensor Standby"}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "var(--tp-text-muted)", marginTop: 6, maxWidth: 320 }}>
                        {trainerCameraError || (trainerFaceEnrolled ? "Click 'Start Live Camera' to re-calibrate or test turnstile scan." : "Click 'Start Live Camera' below to calibrate your Face ID.")}
                      </div>
                    </div>
                  )}

                  {/* HUD Reticle Overlay */}
                  {trainerCameraActive && (
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        pointerEvents: "none",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <div
                        style={{
                          width: 180,
                          height: 230,
                          borderRadius: "50%",
                          border: trainerFaceEnrolled ? "2px dashed #10b981" : "2px dashed #00e5ff",
                          boxShadow: trainerFaceEnrolled ? "0 0 30px rgba(16, 185, 129, 0.35)" : "0 0 30px rgba(0, 229, 255, 0.25)",
                        }}
                      />
                      <div
                        style={{
                          position: "absolute",
                          bottom: 12,
                          left: 14,
                          fontSize: "0.68rem",
                          color: "#00e5ff",
                          fontFamily: "JetBrains Mono, monospace",
                          background: "rgba(0,0,0,0.6)",
                          padding: "2px 8px",
                          borderRadius: 4,
                        }}
                      >
                        RESNET-34 • 128-D DESCRIPTORS
                      </div>
                    </div>
                  )}
                </div>

                {/* Biometric Status / Feedback Message */}
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: 10,
                    background: "rgba(18, 26, 44, 0.6)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    fontSize: "0.82rem",
                    color: trainerBiometricFeedback ? (trainerBiometricFeedback.startsWith("✓") ? "#34d399" : "#38bdf8") : "var(--tp-text-muted)",
                    marginBottom: 16,
                    fontWeight: 700,
                  }}
                >
                  {trainerBiometricFeedback || (trainerFaceEnrolled ? `Face ID active and verified in database for Coach ${currentTrainer.name}.` : "Position your face in the oval and click Capture & Register.")}
                </div>

                {/* Control Action Buttons */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <button
                    type="button"
                    className="trainer-quick-btn"
                    onClick={trainerCameraActive ? stopTrainerCamera : startTrainerCamera}
                    style={{ justifyContent: "center", background: trainerCameraActive ? "rgba(239, 68, 68, 0.15)" : "rgba(0, 229, 255, 0.15)", color: trainerCameraActive ? "#f87171" : "#00e5ff" }}
                  >
                    {trainerCameraActive ? "⏹ Stop Camera" : "📷 Start Live Camera"}
                  </button>

                  <button
                    type="button"
                    className="trainer-quick-btn"
                    onClick={() => handleTrainerEnrollFace(false)}
                    disabled={trainerIsEnrolling}
                    style={{ justifyContent: "center", background: "linear-gradient(135deg, #00e5ff 0%, #0084ff 100%)", color: "#000", fontWeight: 900 }}
                  >
                    {trainerIsEnrolling ? "Calibrating..." : "✓ Capture & Register"}
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <button
                    type="button"
                    className="trainer-quick-btn"
                    onClick={() => handleTrainerEnrollFace(true)}
                    disabled={trainerIsEnrolling}
                    style={{ justifyContent: "center", fontSize: "0.78rem" }}
                  >
                    ⚡ Instant Neural Calibration
                  </button>

                  <button
                    type="button"
                    className="trainer-quick-btn"
                    onClick={handleTrainerTestFaceScan}
                    disabled={trainerIsScanning}
                    style={{ justifyContent: "center", fontSize: "0.78rem", background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", color: "#ffffff", fontWeight: 800 }}
                  >
                    {trainerIsScanning ? "Verifying..." : "🔓 Test Turnstile Gate Entry"}
                  </button>
                </div>
              </div>

              {/* Right Column: Coach Turnstile Staff Biometric Identity Pass */}
              <div className="trainer-card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div className="trainer-card-header">
                  <h3>Staff Turnstile Pass</h3>
                  <span className="dash-hud-pill trainer-hud-pill" style={{ position: "static" }}>
                    TIER 4 STAFF
                  </span>
                </div>

                {/* Identity Pass Card */}
                <div
                  style={{
                    padding: 20,
                    borderRadius: 14,
                    background: "linear-gradient(135deg, rgba(13, 22, 40, 0.95) 0%, rgba(6, 12, 24, 0.9) 100%)",
                    border: "1.5px solid rgba(0, 229, 255, 0.3)",
                    boxShadow: "0 0 30px rgba(0, 229, 255, 0.15)",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: "50%",
                      margin: "0 auto 12px auto",
                      overflow: "hidden",
                      border: "2px solid #00e5ff",
                      background: "linear-gradient(135deg, #0084ff, #0044b4)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "1.8rem",
                      fontWeight: 900,
                      color: "#ffffff",
                    }}
                  >
                    {trainerFacePhoto ? (
                      <img src={trainerFacePhoto} alt="Coach Photo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      trainerInitials
                    )}
                  </div>

                  <h3 style={{ margin: "0 0 4px 0", fontSize: "1.2rem", fontWeight: 900, color: "#ffffff" }}>
                    Coach {currentTrainer.name}
                  </h3>
                  <div style={{ fontSize: "0.75rem", color: "var(--tp-cyan)", fontWeight: 800, textTransform: "uppercase" }}>
                    {currentTrainer.specialty || "Master Trainer Staff"}
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "var(--tp-text-muted)", marginTop: 4 }}>
                    ID: FP-TR-000{currentTrainer.id || 4} • {currentTrainer.email}
                  </div>

                  <div
                    style={{
                      marginTop: 16,
                      padding: 10,
                      borderRadius: 8,
                      background: trainerFaceEnrolled ? "rgba(16, 185, 129, 0.12)" : "rgba(245, 158, 11, 0.12)",
                      border: trainerFaceEnrolled ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(245, 158, 11, 0.3)",
                      fontSize: "0.75rem",
                      color: trainerFaceEnrolled ? "#34d399" : "#fbbf24",
                      fontWeight: 800,
                    }}
                  >
                    {trainerFaceEnrolled ? `✓ BIOMETRIC FACE ID ACTIVE • ${trainerFaceEnrolledAt || "CALIBRATED"}` : "⚠️ ENROLLMENT PENDING"}
                  </div>
                </div>

                {/* Instructions Box */}
                <div style={{ padding: 14, borderRadius: 10, background: "rgba(18,26,44,0.6)", border: "1px solid rgba(255,255,255,0.06)", fontSize: "0.8rem", color: "var(--tp-text-muted)", lineHeight: 1.5 }}>
                  <strong style={{ color: "#00e5ff" }}>Turnstile Kiosk Entry:</strong> Step in front of any campus optical kiosk at <a href="/attendance-login" style={{ color: "#00e5ff", textDecoration: "underline" }}>/attendance-login</a>. The AI neural engine will recognize your facial landmarks, unlock the turnstile gate for staff passage, and timestamp your floor attendance ledger.
                </div>
              </div>
            </div>
          )}
        </section>

        {/* =========================================================
            07. 🥗 NUTRITION (MACRO PRESCRIPTIONS)
            ========================================================= */}
        <section
          id="section-trainer-nutrition"
          className={`trainer-module-section ${visibleSections.has("section-trainer-nutrition") ? "in-view" : "out-of-view"}`}
        >
          <div className="trainer-card" style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
              <div>
                <div style={{ fontSize: "0.8rem", color: "var(--tp-cyan)", fontWeight: 800 }}>MODULE 07 • DIETARY PROGRAMMING</div>
                <h2 style={{ margin: "4px 0", fontSize: "1.7rem", fontWeight: 900 }}>Nutrition & Fuel Prescriptions</h2>
                <p style={{ margin: 0, color: "var(--tp-text-muted)", fontSize: "0.88rem" }}>
                  Prescribe macronutrient ratios, caloric surpluses/deficits, and hydration baselines for assigned athletes.
                </p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: "0.82rem", color: "var(--tp-text-muted)", fontWeight: 700 }}>SELECT CLIENT:</span>
                <select
                  className="trainer-form-select"
                  value={selectedClientId || ""}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                >
                  {clients.length === 0 ? (
                    <option value="">No Assigned Trainees</option>
                  ) : (
                    clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.name} ({c.goal})</option>
                    ))
                  )}
                </select>
              </div>
            </div>
          </div>

          {!selectedClient ? (
            <div className="trainer-card" style={{ textAlign: "center", padding: "48px 24px" }}>
              <div style={{ fontSize: "3rem", marginBottom: 14 }}>🥗</div>
              <h3 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#ffffff", marginBottom: 8 }}>
                No Trainee Macro Protocols Active
              </h3>
              <p style={{ color: "var(--tp-text-muted)", fontSize: "0.88rem", maxWidth: 500, margin: "0 auto", lineHeight: 1.6 }}>
                You do not have any assigned clients linked to your roster yet. Once an athlete is assigned, their daily food journals, calorie/protein sync, and custom nutritional directives will appear here.
              </p>
            </div>
          ) : (
            <>
              {/* Live Trainee Food Journal & Real-time Telemetry */}
              <div className="trainer-card" style={{ marginBottom: 22, border: "1px solid rgba(16, 185, 129, 0.35)", background: "rgba(10, 16, 26, 0.75)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: "1.2rem" }}>🥗</span>
                    <div>
                      <h3 style={{ margin: 0, fontSize: "1.05rem", color: "#fff" }}>
                        Live Trainee Food Journal — {selectedClient.name}
                      </h3>
                      <div style={{ fontSize: "0.75rem", color: "#34d399" }}>
                        ● Real-Time Biometric Sync with MySQL & Trainee Customer Portal
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 12 }}>
                    <div style={{ background: "rgba(255,255,255,0.05)", padding: "4px 10px", borderRadius: 8, fontSize: "0.78rem" }}>
                      Calories Today: <strong style={{ color: "#00f2fe" }}>{traineeNutrition.calories} / {selectedClient.macros.calories} kcal</strong>
                    </div>
                    <div style={{ background: "rgba(255,255,255,0.05)", padding: "4px 10px", borderRadius: 8, fontSize: "0.78rem" }}>
                      Protein Logged: <strong style={{ color: "#34d399" }}>{traineeNutrition.protein} / {selectedClient.macros.protein}g</strong>
                    </div>
                  </div>
                </div>

                {/* Meal Items Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                  {traineeNutrition.meals.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        background: "rgba(255, 255, 255, 0.03)",
                        border: "1px solid rgba(255, 255, 255, 0.06)",
                        borderRadius: 10,
                        padding: "10px 12px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <span style={{ fontSize: "0.72rem", color: "#00f2fe", fontWeight: 700, textTransform: "uppercase" }}>
                          {m.name || m.meal}
                        </span>
                        <span style={{ fontSize: "0.68rem", color: "var(--tp-text-muted)" }}>{m.time}</span>
                      </div>
                      <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#f8fafc", marginBottom: 6 }}>
                        {m.title}
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--tp-text-muted)" }}>
                        <span>⚡ {m.calories} kcal</span>
                        <span style={{ color: "#34d399", fontWeight: 600 }}>🥩 {m.protein}g protein</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                {/* Prescribed Macros */}
                <div className="trainer-card">
                  <div className="trainer-card-header">
                    <h3>{selectedClient.name}'s Target Prescriptions</h3>
                    <span className="dash-hud-pill trainer-hud-pill" style={{ position: "static" }}>
                      {selectedClient.macros.calories} kcal
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", fontWeight: 800, marginBottom: 4 }}>
                        <span>PROTEIN (4 kcal/g)</span>
                        <span style={{ color: "var(--tp-cyan)" }}>{selectedClient.macros.protein} g ({Math.round(selectedClient.macros.protein * 400 / selectedClient.macros.calories)}%)</span>
                      </div>
                      <div style={{ height: 8, background: "rgba(255,255,255,0.08)", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ width: "30%", height: "100%", background: "#00b4ff" }} />
                      </div>
                    </div>

                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", fontWeight: 800, marginBottom: 4 }}>
                        <span>CARBOHYDRATES (4 kcal/g)</span>
                        <span style={{ color: "#f59e0b" }}>{selectedClient.macros.carbs} g ({Math.round(selectedClient.macros.carbs * 400 / selectedClient.macros.calories)}%)</span>
                      </div>
                      <div style={{ height: 8, background: "rgba(255,255,255,0.08)", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ width: "50%", height: "100%", background: "#f59e0b" }} />
                      </div>
                    </div>

                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", fontWeight: 800, marginBottom: 4 }}>
                        <span>FATS (9 kcal/g)</span>
                        <span style={{ color: "#10b981" }}>{selectedClient.macros.fat} g ({Math.round(selectedClient.macros.fat * 900 / selectedClient.macros.calories)}%)</span>
                      </div>
                      <div style={{ height: 8, background: "rgba(255,255,255,0.08)", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ width: "20%", height: "100%", background: "#10b981" }} />
                      </div>
                    </div>

                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", fontWeight: 800, marginBottom: 4 }}>
                        <span>HYDRATION BASELINE</span>
                        <span style={{ color: "#38bdf8" }}>{selectedClient.macros.water} Liters / Day</span>
                      </div>
                      <div style={{ height: 8, background: "rgba(255,255,255,0.08)", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ width: "80%", height: "100%", background: "#38bdf8" }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Coach Nutritional Directives */}
                <div className="trainer-card">
                  <div className="trainer-card-header">
                    <h3>Coach Notes & Supplements</h3>
                    <span style={{ fontSize: "0.75rem", color: "var(--tp-cyan)", fontWeight: 700 }}>Active Directives</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ padding: 12, borderRadius: 10, background: "rgba(18,26,44,0.6)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <div style={{ fontWeight: 800, color: "#ffffff", fontSize: "0.88rem" }}>Pre-Workout Fueling</div>
                      <div style={{ fontSize: "0.78rem", color: "var(--tp-text-muted)", marginTop: 4 }}>
                        Consume 45g simple carbs (banana + rice cake with honey) 45 mins prior to heavy lifting sessions.
                      </div>
                    </div>

                    <div style={{ padding: 12, borderRadius: 10, background: "rgba(18,26,44,0.6)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <div style={{ fontWeight: 800, color: "#ffffff", fontSize: "0.88rem" }}>Supplement Stack Prescribed</div>
                      <div style={{ fontSize: "0.78rem", color: "var(--tp-text-muted)", marginTop: 4 }}>
                        • Creatine Monohydrate: 5g daily with morning shake<br />
                        • Whey Protein Isolate: 30g post-workout<br />
                        • Magnesium Glycinate: 400mg 30 mins before bed for neural recovery
                      </div>
                    </div>

                    <button
                      className="trainer-portal-switch-btn"
                      onClick={() => alert(`Saved new nutritional note for ${selectedClient?.name || "trainee"}`)}
                    >
                      + Add Custom Macro Note
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>

        {/* =========================================================
            08. 💬 MESSAGES (TRAINER ↔ CLIENTS DIRECT CHAT)
            ========================================================= */}
        <section
          id="section-trainer-messages"
          className={`trainer-module-section ${visibleSections.has("section-trainer-messages") ? "in-view" : "out-of-view"}`}
        >
          <div className="trainer-card" style={{ marginBottom: 22 }}>
            <div style={{ fontSize: "0.8rem", color: "var(--tp-cyan)", fontWeight: 800 }}>MODULE 08 • COACHING MESSAGING HUB</div>
            <h2 style={{ margin: "4px 0", fontSize: "1.7rem", fontWeight: 900 }}>Direct Client Communications</h2>
            <p style={{ margin: 0, color: "var(--tp-text-muted)", fontSize: "0.88rem" }}>
              Real-time two-way coaching channel between Coach {currentTrainer.name} and assigned members.
            </p>
          </div>

          <div className="trainer-card" style={{ padding: 0, overflow: "hidden" }}>
            <div className="trainer-chat-layout">
              {/* Left: Contact List */}
              <div className="trainer-convo-list" style={{ padding: 16, borderRight: "1px solid var(--tp-border-subtle)" }}>
                {/* Admin Management Channel */}
                <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--tp-cyan)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: 6 }}>
                  <span>🛡️</span> Management Dispatch
                </div>
                <div
                  className={`trainer-convo-item ${activeChatClientId === "admin" ? "active" : ""}`}
                  onClick={() => setActiveChatClientId("admin")}
                  style={{
                    background: activeChatClientId === "admin" ? "rgba(0, 240, 255, 0.12)" : "rgba(255,255,255,0.02)",
                    border: activeChatClientId === "admin" ? "1px solid var(--tp-cyan)" : "1px solid rgba(255,255,255,0.06)",
                    marginBottom: 16,
                    borderRadius: 10,
                  }}
                >
                  <div style={{ width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg, #00f0ff 0%, #0060df 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", border: "1px solid var(--tp-cyan)", flexShrink: 0 }}>
                    👑
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontWeight: 800, color: "#ffffff", fontSize: "0.88rem" }}>Admin Dispatch</div>
                      {(chatMessages.admin || []).length > 0 && (
                        <span style={{ fontSize: "0.68rem", color: "var(--tp-cyan)" }}>
                          {(chatMessages.admin[chatMessages.admin.length - 1]).time}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--tp-text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {(chatMessages.admin || []).length > 0 ? chatMessages.admin[chatMessages.admin.length - 1].text : "Headquarters channel"}
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--tp-text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Assigned Trainees ({clients.length})
                </div>
                {clients.length === 0 ? (
                  <div style={{ padding: "12px 8px", fontSize: "0.78rem", color: "var(--tp-text-muted)", textAlign: "center" }}>
                    No assigned trainees yet
                  </div>
                ) : (
                  clients.map((client) => {
                    const isCur = activeChatClientId === client.id;
                    const msgs = chatMessages[client.id] || chatMessages[client.dbId] || [];
                    const lastMsg = msgs[msgs.length - 1];

                    return (
                      <div
                        key={client.id}
                        className={`trainer-convo-item ${isCur ? "active" : ""}`}
                        onClick={() => setActiveChatClientId(client.id)}
                      >
                        <img src={client.avatar} alt={client.name} style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover" }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ fontWeight: 800, color: "#ffffff", fontSize: "0.88rem" }}>{client.name}</div>
                            {lastMsg && <span style={{ fontSize: "0.68rem", color: "var(--tp-text-muted)" }}>{lastMsg.time}</span>}
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "var(--tp-text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {lastMsg ? lastMsg.text : "No messages yet"}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Right: Message Window */}
              <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: 18 }}>
                {/* Active Header */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, paddingBottom: 14, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  {activeChatClientId === "admin" ? (
                    <>
                      <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg, #00f0ff 0%, #0060df 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", border: "1px solid var(--tp-cyan)" }}>
                        👑
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, color: "#ffffff", fontSize: "1rem" }}>
                          Gym Administrator / Management Dispatch
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "var(--tp-cyan)" }}>
                          🟢 Live WebSocket • Priority Coaching Dispatch • ID #3
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <img
                        src={clients.find((c) => c.id === activeChatClientId)?.avatar || selectedClient?.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"}
                        alt="client"
                        style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--tp-cyan)" }}
                      />
                      <div>
                        <div style={{ fontWeight: 800, color: "#ffffff" }}>
                          {clients.find((c) => c.id === activeChatClientId)?.fullName || selectedClient?.fullName || "Assigned Trainee"}
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "var(--tp-cyan)" }}>
                          Online • Assigned Trainee • Goal: {clients.find((c) => c.id === activeChatClientId)?.goal || selectedClient?.goal || "Fitness"}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Messages stream */}
                <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, padding: "16px 0" }}>
                  {(activeChatClientId === "admin"
                    ? (chatMessages.admin || [])
                    : (chatMessages[activeChatClientId] || (clients.find((c) => c.id === activeChatClientId) && chatMessages[clients.find((c) => c.id === activeChatClientId).dbId]) || [])
                  ).map((msg) => (
                    <div
                      key={msg.id}
                      style={{
                        alignSelf: msg.isMe ? "flex-end" : "flex-start",
                        maxWidth: "70%",
                        background: msg.isMe ? "linear-gradient(180deg, #0084ff 0%, #0060df 100%)" : "rgba(18,26,44,0.85)",
                        border: msg.isMe ? "1px solid rgba(0,200,255,0.4)" : "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 12,
                        padding: "10px 14px",
                        color: "#ffffff",
                      }}
                    >
                      <div style={{ fontSize: "0.72rem", color: msg.isMe ? "#bae6fd" : "var(--tp-cyan)", fontWeight: 700, marginBottom: 2 }}>
                        {msg.isMe ? "You" : msg.sender}
                      </div>
                      <div style={{ fontSize: "0.85rem", lineHeight: 1.4 }}>{msg.text}</div>
                      <div style={{ fontSize: "0.65rem", opacity: 0.7, textAlign: "right", marginTop: 4 }}>
                        {msg.time}
                      </div>
                    </div>
                  ))}
                  {(activeChatClientId === "admin"
                    ? (chatMessages.admin || []).length === 0
                    : (chatMessages[activeChatClientId] || (clients.find((c) => c.id === activeChatClientId) && chatMessages[clients.find((c) => c.id === activeChatClientId).dbId]) || []).length === 0
                  ) && (
                    <div style={{ textAlign: "center", color: "var(--tp-text-muted)", margin: "auto", fontSize: "0.85rem" }}>
                      {activeChatClientId === "admin"
                        ? "No messages yet with Gym Administrator. Send an operational memo below."
                        : "No messages yet. Send a coaching instruction below."}
                    </div>
                  )}
                </div>

                {/* Chat Input Field */}
                <form onSubmit={handleSendMessage} style={{ display: "flex", gap: 10, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <input
                    type="text"
                    className="trainer-form-input"
                    placeholder={
                      activeChatClientId === "admin"
                        ? "Message Gym Administrator / Management..."
                        : `Message ${clients.find((c) => c.id === activeChatClientId)?.name || selectedClient?.name || "Trainee"}...`
                    }
                    value={chatInputText}
                    onChange={(e) => setChatInputText(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button type="submit" className="trainer-quick-btn" style={{ background: "linear-gradient(180deg, #0099ff 0%, #0070e0 100%)" }}>
                    Send
                  </button>
                </form>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================
            09. 🏆 PERFORMANCE (TRAINER KPIS & RETENTION)
            ========================================================= */}
        <section
          id="section-trainer-performance"
          className={`trainer-module-section ${visibleSections.has("section-trainer-performance") ? "in-view" : "out-of-view"}`}
        >
          <div className="trainer-card" style={{ marginBottom: 22 }}>
            <div style={{ fontSize: "0.8rem", color: "var(--tp-cyan)", fontWeight: 800 }}>MODULE 09 • COACHING KPIS</div>
            <h2 style={{ margin: "4px 0", fontSize: "1.7rem", fontWeight: 900 }}>Trainer Performance & Retention</h2>
            <p style={{ margin: 0, color: "var(--tp-text-muted)", fontSize: "0.88rem" }}>
              Metrics, client retention analytics, feedback rating, and monthly coaching performance breakdown.
            </p>
          </div>

          <div className="trainer-stats-grid">
            <div className="trainer-stat-tile">
              <div className="trainer-stat-header">
                <span className="trainer-stat-label">CLIENT RETENTION</span>
                <span className={`trainer-stat-badge ${clients.length > 0 ? "highlight" : ""}`}>
                  {clients.length === 0 ? "NEW COACH" : "TOP 5%"}
                </span>
              </div>
              <div className="trainer-stat-value">
                {clients.length === 0 ? "0%" : `${Math.min(90 + clients.length * 2, 98)}%`}
              </div>
              <div className="trainer-stat-sub">
                {clients.length === 0 ? "0 active client contracts" : `${clients.length} of ${clients.length + 1} clients active`}
              </div>
            </div>

            <div className="trainer-stat-tile">
              <div className="trainer-stat-header">
                <span className="trainer-stat-label">COACH RATING</span>
                <span className="trainer-stat-badge">
                  {clients.length === 0 ? "NEW COACH" : "REVIEWS"}
                </span>
              </div>
              <div className="trainer-stat-value">
                {clients.length === 0 ? "0.0 ★" : "4.9 ★"}
              </div>
              <div className="trainer-stat-sub">
                {clients.length === 0 ? "Awaiting first client reviews" : `Based on ${clients.length * 12 + 6} verified member ratings`}
              </div>
            </div>

            <div className="trainer-stat-tile">
              <div className="trainer-stat-header">
                <span className="trainer-stat-label">MONTHLY SESSIONS</span>
                <span className="trainer-stat-badge">
                  {clients.length === 0 ? "FLOOR DUTY" : "TARGET: 120"}
                </span>
              </div>
              <div className="trainer-stat-value">
                {clients.length === 0 ? "0" : clients.length * 24}
              </div>
              <div className="trainer-stat-sub">
                {clients.length === 0 ? "Available for client booking" : `Delivered across current training block`}
              </div>
            </div>

            <div className="trainer-stat-tile">
              <div className="trainer-stat-header">
                <span className="trainer-stat-label">PT REVENUE</span>
                <span className="trainer-stat-badge">CASHFREE INR</span>
              </div>
              <div className="trainer-stat-value">
                ₹{trainerPtRevenue.toLocaleString("en-IN")}
              </div>
              <div className="trainer-stat-sub">
                {trainerPayments.length === 0
                  ? "Awaiting first client retainer intake"
                  : `${trainerPayments.length} verified Cashfree retainer ${trainerPayments.length === 1 ? "payment" : "payments"}`}
              </div>
            </div>
          </div>

          {/* Most Improved Client Highlight Card */}
          {clients.length > 0 ? (
            <div className="trainer-card" style={{ border: "1px solid rgba(0,180,255,0.45)", background: "linear-gradient(135deg, rgba(11,17,30,0.9), rgba(0,84,180,0.2))" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                  <img src={clients[0].avatar} alt={clients[0].name} style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", border: "2px solid var(--tp-cyan)" }} />
                  <div>
                    <span style={{ fontSize: "0.72rem", color: "var(--tp-cyan)", fontWeight: 800, textTransform: "uppercase" }}>
                      ⭐ MOST IMPROVED ATHLETE OF THE MONTH
                    </span>
                    <h3 style={{ margin: "4px 0", fontSize: "1.3rem", fontWeight: 900 }}>{clients[0].fullName || clients[0].name}</h3>
                    <p style={{ margin: 0, color: "var(--tp-text-muted)", fontSize: "0.85rem" }}>
                      Goal: {clients[0].goal} • Composite Strength Index: +18% • 12-day consecutive training streak
                    </p>
                  </div>
                </div>

                <button
                  className="trainer-client-action-btn primary"
                  style={{ padding: "10px 18px", fontSize: "0.85rem" }}
                  onClick={() => {
                    setSelectedClientId(clients[0].id);
                    scrollToModule("section-trainer-progress");
                  }}
                >
                  View Transformation Case Study →
                </button>
              </div>
            </div>
          ) : (
            <div className="trainer-card" style={{ border: "1px dashed rgba(255,255,255,0.15)", background: "rgba(11,17,30,0.5)", textAlign: "center", padding: "30px 20px" }}>
              <div style={{ fontSize: "2rem", marginBottom: 8 }}>⭐</div>
              <h3 style={{ margin: "0 0 6px 0", fontSize: "1.1rem" }}>Awaiting Trainee Assignments</h3>
              <p style={{ margin: 0, color: "var(--tp-text-muted)", fontSize: "0.85rem" }}>
                Once athletes are assigned to your roster, monthly performance spotlights and milestone transformations will appear here.
              </p>
            </div>
          )}

          {/* Client Retainer Receipts Ledger */}
          <div className="trainer-card" style={{ marginTop: 22, background: "rgba(10, 16, 26, 0.8)", border: "1px solid rgba(0, 229, 255, 0.25)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--tp-cyan)", fontWeight: 800, textTransform: "uppercase" }}>
                  DEDICATED TRAINEE RETAINERS
                </div>
                <h3 style={{ margin: "2px 0 0 0", fontSize: "1.15rem", fontWeight: 800, color: "#ffffff" }}>
                  Cashfree Coaching Invoices & Remittances
                </h3>
              </div>
              <span
                style={{
                  background: "rgba(16, 185, 129, 0.15)",
                  color: "#34d399",
                  padding: "4px 10px",
                  borderRadius: 6,
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                }}
              >
                ₹{trainerPtRevenue.toLocaleString("en-IN")} Total Disbursed
              </span>
            </div>

            {trainerPayments.length === 0 ? (
              <div style={{ textAlign: "center", padding: "28px 16px", color: "var(--tp-text-muted)", fontSize: "0.85rem" }}>
                <div style={{ fontSize: "2rem", marginBottom: 8 }}>💳</div>
                <div style={{ fontWeight: 700, color: "#ffffff", marginBottom: 4 }}>No Client Retainers Paid Yet</div>
                <div>When members with active gym memberships subscribe to your private coaching channel, their Cashfree payments will log here in real time.</div>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="admin-table" style={{ width: "100%" }}>
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>Trainee</th>
                      <th>Coaching Package</th>
                      <th>Amount (INR)</th>
                      <th>Status</th>
                      <th>Paid At</th>
                      <th>Valid Until</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trainerPayments.map((p) => (
                      <tr key={p.id}>
                        <td style={{ fontFamily: "JetBrains Mono", fontSize: "0.8rem", color: "#00f2fe" }}>
                          {p.orderId}
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: "#ffffff" }}>{p.memberName}</div>
                          <div style={{ fontSize: "0.72rem", color: "var(--tp-text-muted)" }}>{p.memberEmail}</div>
                        </td>
                        <td style={{ fontSize: "0.82rem", color: "#e2e8f0" }}>
                          {p.planName || "Dedicated 1-on-1 Monthly Retainer"}
                        </td>
                        <td style={{ fontFamily: "JetBrains Mono", fontWeight: 800, color: "#facc15" }}>
                          ₹{Number(p.amount).toLocaleString("en-IN")}
                        </td>
                        <td>
                          <span
                            className="admin-badge-pill"
                            style={{
                              background: "rgba(16, 185, 129, 0.15)",
                              color: "#34d399",
                              border: "1px solid rgba(16, 185, 129, 0.3)",
                              padding: "2px 8px",
                              borderRadius: 4,
                              fontSize: "0.75rem",
                              fontWeight: 700,
                            }}
                          >
                            ✓ PAID
                          </span>
                        </td>
                        <td style={{ fontSize: "0.75rem", color: "var(--tp-text-muted)" }}>
                          {p.paymentTime ? new Date(p.paymentTime).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "--"}
                        </td>
                        <td style={{ fontSize: "0.75rem", color: "#38bdf8", fontFamily: "JetBrains Mono" }}>
                          {p.expiresAt ? new Date(p.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "--"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* =========================================================
            10. 📚 EXERCISE LIBRARY
            ========================================================= */}
        <section
          id="section-trainer-exercises"
          className={`trainer-module-section ${visibleSections.has("section-trainer-exercises") ? "in-view" : "out-of-view"}`}
        >
          <div className="trainer-card" style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
              <div>
                <div style={{ fontSize: "0.8rem", color: "var(--tp-cyan)", fontWeight: 800 }}>MODULE 10 • MOVEMENT TAXONOMY</div>
                <h2 style={{ margin: "4px 0", fontSize: "1.7rem", fontWeight: 900 }}>Exercise Library & Biomechanical Cues</h2>
                <p style={{ margin: 0, color: "var(--tp-text-muted)", fontSize: "0.88rem" }}>
                  Curated movements indexed by target muscle group, setup cues, and prescription guidelines.
                </p>
              </div>

              {/* Filter Tabs */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {["All", "Chest", "Back", "Legs", "Shoulders", "Arms", "Core"].map((m) => (
                  <button
                    key={m}
                    className={`trainer-att-tab-btn ${exerciseMuscleFilter === m ? "active" : ""}`}
                    onClick={() => setExerciseMuscleFilter(m)}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="trainer-library-grid">
            {filteredExercises.map((ex) => (
              <div key={ex.id} className="trainer-exercise-card">
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <span style={{ fontSize: "0.72rem", color: "var(--tp-cyan)", fontWeight: 800, textTransform: "uppercase" }}>
                      {ex.muscle}
                    </span>
                    <span className={`trainer-diff-badge ${ex.difficulty}`}>
                      {ex.difficulty}
                    </span>
                  </div>
                  <h4 style={{ margin: "4px 0 8px 0", fontSize: "1rem", fontWeight: 800, color: "#ffffff" }}>
                    {ex.name}
                  </h4>
                  <div style={{ fontSize: "0.78rem", color: "var(--tp-text-dark)", fontWeight: 600, marginBottom: 8 }}>
                    Standard: {ex.setsReps}
                  </div>
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--tp-text-muted)", lineHeight: 1.4 }}>
                    <strong style={{ color: "#cbd5e1" }}>Coaching Cue:</strong> {ex.cues}
                  </p>
                </div>

                <button
                  className="trainer-client-action-btn primary"
                  onClick={() => {
                    setNewExName(ex.name);
                    scrollToModule("section-trainer-workout-plans");
                  }}
                >
                  + Add to Builder
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* =========================================================
            11. 🔔 NOTIFICATIONS (COACHING ALERTS)
            ========================================================= */}
        <section
          id="section-trainer-notifications"
          className={`trainer-module-section ${visibleSections.has("section-trainer-notifications") ? "in-view" : "out-of-view"}`}
        >
          <div className="trainer-card" style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
              <div>
                <div style={{ fontSize: "0.8rem", color: "var(--tp-cyan)", fontWeight: 800 }}>MODULE 11 • ALERT STREAM</div>
                <h2 style={{ margin: "4px 0", fontSize: "1.7rem", fontWeight: 900 }}>Coaching Notifications</h2>
                <p style={{ margin: 0, color: "var(--tp-text-muted)", fontSize: "0.88rem" }}>
                  Real-time alerts regarding PR breaks, missed workouts, client roster assignments, and phase reviews.
                </p>
              </div>

              <button
                className="trainer-portal-switch-btn"
                onClick={() => setNotifications(notifications.map((n) => ({ ...n, unread: false })))}
              >
                Mark All as Read
              </button>
            </div>
          </div>

          <div className="trainer-card">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`trainer-alert-item ${notif.unread ? "highlight" : ""}`}
                  style={{ justifyContent: "space-between" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <span style={{ fontSize: "1.3rem" }}>
                      {notif.type === "milestone" ? "🏆" : notif.type === "client" ? "👥" : notif.type === "alert" ? "⚠️" : "📋"}
                    </span>
                    <div>
                      <div style={{ fontWeight: 800, color: "#ffffff", fontSize: "0.92rem" }}>
                        {notif.title}
                        {notif.unread && <span style={{ marginLeft: 8, fontSize: "0.65rem", padding: "2px 6px", borderRadius: 4, background: "rgba(0,180,255,0.3)", color: "var(--tp-cyan)" }}>NEW</span>}
                      </div>
                      <div style={{ fontSize: "0.78rem", color: "var(--tp-text-muted)", marginTop: 2 }}>{notif.body}</div>
                    </div>
                  </div>
                  <span style={{ fontSize: "0.72rem", color: "var(--tp-text-muted)", fontFamily: "JetBrains Mono" }}>{notif.time}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* =========================================================
            12. 👤 TRAINER PROFILE (COACH CREDENTIALS)
            ========================================================= */}
        <section
          id="section-trainer-profile"
          className={`trainer-module-section ${visibleSections.has("section-trainer-profile") ? "in-view" : "out-of-view"}`}
        >
          <div className="trainer-card" style={{ marginBottom: 22 }}>
            <div style={{ fontSize: "0.8rem", color: "var(--tp-cyan)", fontWeight: 800 }}>MODULE 12 • COACH CREDENTIALS</div>
            <h2 style={{ margin: "4px 0", fontSize: "1.7rem", fontWeight: 900 }}>Trainer Profile & Certification</h2>
            <p style={{ margin: 0, color: "var(--tp-text-muted)", fontSize: "0.88rem" }}>
              Professional accreditation, coaching philosophy, working hours, and facility settings.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "0.8fr 1.2fr", gap: 24 }}>
            {/* Left Card: Head Coach Identity */}
            <div className="trainer-card" style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  position: "relative",
                  width: 104,
                  height: 104,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #0084ff, #0044b4)",
                  color: "#ffffff",
                  fontSize: "2rem",
                  fontWeight: 900,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 0 30px rgba(0,132,255,0.5)",
                  overflow: "hidden",
                  border: "2px solid rgba(0, 242, 254, 0.4)",
                }}
              >
                {trainerEditAvatar || trainerFacePhoto || currentTrainer.avatar ? (
                  <img
                    src={trainerEditAvatar || trainerFacePhoto || currentTrainer.avatar}
                    alt={trainerEditName || currentTrainer.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  (trainerEditName || currentTrainer?.name || "Coach")
                    .split(" ")
                    .map((w) => w[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()
                )}
              </div>

              <input
                ref={trainerFileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleTrainerImageUpload}
              />

              <button
                type="button"
                onClick={() => trainerFileInputRef.current?.click()}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "5px 14px",
                  borderRadius: 20,
                  background: "rgba(0, 242, 254, 0.12)",
                  border: "1px solid rgba(0, 242, 254, 0.35)",
                  color: "#00f2fe",
                  fontSize: "0.72rem",
                  fontWeight: 800,
                  cursor: "pointer",
                  marginTop: -4,
                }}
              >
                <span>📷</span>
                <span>Change Photo</span>
              </button>

              <div>
                <h3 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 900 }}>Coach {trainerEditName || currentTrainer.name}</h3>
                <div style={{ fontSize: "0.82rem", color: "var(--tp-cyan)", fontWeight: 800, marginTop: 4 }}>
                  {(currentTrainer.specialty || "Head Strength Coach & Athletic Performance Lead").toUpperCase()}
                </div>
                <div style={{ fontSize: "0.78rem", color: "var(--tp-text-muted)", marginTop: 6 }}>
                  FitPulse Gym • ID: FP-TR-000{currentTrainer.id || 4} • {currentTrainer.email}
                </div>
              </div>

              <div style={{ width: "100%", padding: 12, borderRadius: 10, background: "rgba(18,26,44,0.6)", border: "1px solid rgba(255,255,255,0.05)", textAlign: "left" }}>
                <div style={{ fontSize: "0.72rem", color: "var(--tp-text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
                  Active Shift & Floor Assignment
                </div>
                <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "#ffffff", marginTop: 2 }}>
                  Mon - Sat: 06:00 AM - 02:00 PM & 05:00 PM - 09:00 PM
                </div>
                <div style={{ fontSize: "0.76rem", color: "var(--tp-cyan)", marginTop: 4, fontWeight: 700 }}>
                  Floor Zone: Zone B (Olympic Platforms & Free Weights)
                </div>
                <div style={{ fontSize: "0.76rem", color: "#fbbf24", marginTop: 2, fontWeight: 700 }}>
                  Personal Coaching Retainer: ₹2,500/mo (Official Tier)
                </div>
              </div>

              {/* Facility & Intake Toggles */}
              <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.06)",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "#ffffff" }}>
                      Coaching Intake Status
                    </div>
                    <div style={{ fontSize: "0.68rem", color: "var(--tp-text-muted)" }}>
                      {acceptingNewClients ? "Accepting New Athletes" : "Roster Currently Capped"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAcceptingNewClients((prev) => !prev)}
                    style={{
                      background: acceptingNewClients ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)",
                      border: `1px solid ${acceptingNewClients ? "#10b981" : "#ef4444"}`,
                      color: acceptingNewClients ? "#34d399" : "#f87171",
                      padding: "4px 10px",
                      borderRadius: 6,
                      fontSize: "0.72rem",
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    {acceptingNewClients ? "OPEN" : "FULL"}
                  </button>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.06)",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "#ffffff" }}>
                      Auto-Confirm Bookings
                    </div>
                    <div style={{ fontSize: "0.68rem", color: "var(--tp-text-muted)" }}>
                      {autoConfirmBookings ? "Instant confirmation during shift" : "Manual review required"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAutoConfirmBookings((prev) => !prev)}
                    style={{
                      background: autoConfirmBookings ? "rgba(0, 242, 254, 0.2)" : "rgba(255, 255, 255, 0.05)",
                      border: `1px solid ${autoConfirmBookings ? "#00f2fe" : "rgba(255,255,255,0.15)"}`,
                      color: autoConfirmBookings ? "#00f2fe" : "#94a3b8",
                      padding: "4px 10px",
                      borderRadius: 6,
                      fontSize: "0.72rem",
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    {autoConfirmBookings ? "ACTIVE" : "OFF"}
                  </button>
                </div>
              </div>
            </div>

            {/* Right Card: Bio, Accreditations & Website Settings */}
            <div className="trainer-card">
              <div className="trainer-card-header">
                <h3>Website & Facility Settings</h3>
                <span className="dash-hud-pill trainer-hud-pill" style={{ position: "static" }}>
                  VERIFIED SPECIALIST
                </span>
              </div>

              {profileSettingsFeedback && (
                <div
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: "rgba(16, 185, 129, 0.15)",
                    border: "1px solid rgba(16, 185, 129, 0.35)",
                    color: "#34d399",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    marginBottom: 10,
                  }}
                >
                  {profileSettingsFeedback}
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* 1. Editable Coach Profile Identity: Full Name & Avatar URL / Upload */}
                <div style={{ padding: 14, borderRadius: 10, background: "rgba(18,26,44,0.7)", border: "1px solid rgba(0,242,254,0.2)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ fontSize: "0.74rem", color: "var(--tp-cyan)", fontWeight: 800, textTransform: "uppercase" }}>
                      Profile Identity & Appearance
                    </div>
                    <span style={{ fontSize: "0.68rem", color: "#94a3b8", fontFamily: "JetBrains Mono" }}>
                      Live Database Sync
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.72rem", color: "#cbd5e1", fontWeight: 700, marginBottom: 4 }}>
                        Coach Full Name
                      </label>
                      <input
                        type="text"
                        value={trainerEditName}
                        onChange={(e) => setTrainerEditName(e.target.value)}
                        placeholder="e.g. Alex Carter"
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          borderRadius: 8,
                          background: "rgba(0,0,0,0.4)",
                          border: "1px solid rgba(255,255,255,0.12)",
                          color: "#ffffff",
                          fontSize: "0.82rem",
                          fontWeight: 700,
                          boxSizing: "border-box",
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "0.72rem", color: "#cbd5e1", fontWeight: 700, marginBottom: 4 }}>
                        Profile Photo (URL or Device Upload)
                      </label>
                      <div style={{ display: "flex", gap: 6 }}>
                        <input
                          type="text"
                          value={trainerEditAvatar}
                          onChange={(e) => setTrainerEditAvatar(e.target.value)}
                          placeholder="Paste image URL..."
                          style={{
                            flex: 1,
                            padding: "8px 12px",
                            borderRadius: 8,
                            background: "rgba(0,0,0,0.4)",
                            border: "1px solid rgba(255,255,255,0.12)",
                            color: "#ffffff",
                            fontSize: "0.82rem",
                            boxSizing: "border-box",
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => trainerFileInputRef.current?.click()}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 8,
                            background: "rgba(0,242,254,0.15)",
                            border: "1px solid rgba(0,242,254,0.3)",
                            color: "var(--tp-cyan)",
                            fontSize: "0.72rem",
                            fontWeight: 800,
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Browse...
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Certifications Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div style={{ padding: 12, borderRadius: 10, background: "rgba(18,26,44,0.6)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ fontSize: "0.72rem", color: "var(--tp-cyan)", fontWeight: 800 }}>CERTIFICATION</div>
                    <div style={{ fontWeight: 800, color: "#ffffff", marginTop: 2 }}>CSCS (NSCA)</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--tp-text-muted)" }}>Certified Strength & Conditioning Specialist</div>
                  </div>

                  <div style={{ padding: 12, borderRadius: 10, background: "rgba(18,26,44,0.6)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ fontSize: "0.72rem", color: "var(--tp-cyan)", fontWeight: 800 }}>CERTIFICATION</div>
                    <div style={{ fontWeight: 800, color: "#ffffff", marginTop: 2 }}>NASM-PES & CPT</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--tp-text-muted)" }}>Performance Enhancement Specialist</div>
                  </div>
                </div>

                {/* Notification Telemetry Settings */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div
                    style={{
                      padding: 10,
                      borderRadius: 10,
                      background: "rgba(18,26,44,0.6)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "0.72rem", color: "var(--tp-cyan)", fontWeight: 800 }}>
                        ATHLETE ARRIVAL ALERTS
                      </div>
                      <div style={{ fontSize: "0.7rem", color: "var(--tp-text-muted)" }}>
                        Instant turnstile entrance alerts
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRealtimeCheckinAlerts((prev) => !prev)}
                      style={{
                        background: realtimeCheckinAlerts ? "rgba(0, 242, 254, 0.2)" : "rgba(255, 255, 255, 0.05)",
                        border: `1px solid ${realtimeCheckinAlerts ? "#00f2fe" : "rgba(255,255,255,0.15)"}`,
                        color: realtimeCheckinAlerts ? "#00f2fe" : "#94a3b8",
                        padding: "3px 8px",
                        borderRadius: 6,
                        fontSize: "0.68rem",
                        fontWeight: 800,
                        cursor: "pointer",
                      }}
                    >
                      {realtimeCheckinAlerts ? "ON" : "OFF"}
                    </button>
                  </div>

                  <div
                    style={{
                      padding: 10,
                      borderRadius: 10,
                      background: "rgba(18,26,44,0.6)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "0.72rem", color: "var(--tp-cyan)", fontWeight: 800 }}>
                        DIRECT CHAT NOTIFICATIONS
                      </div>
                      <div style={{ fontSize: "0.7rem", color: "var(--tp-text-muted)" }}>
                        Push alerts for athlete messages
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setChatAlertsEnabled((prev) => !prev)}
                      style={{
                        background: chatAlertsEnabled ? "rgba(0, 242, 254, 0.2)" : "rgba(255, 255, 255, 0.05)",
                        border: `1px solid ${chatAlertsEnabled ? "#00f2fe" : "rgba(255,255,255,0.15)"}`,
                        color: chatAlertsEnabled ? "#00f2fe" : "#94a3b8",
                        padding: "3px 8px",
                        borderRadius: 6,
                        fontSize: "0.68rem",
                        fontWeight: 800,
                        cursor: "pointer",
                      }}
                    >
                      {chatAlertsEnabled ? "ON" : "OFF"}
                    </button>
                  </div>
                </div>

                {/* Editable Coaching Philosophy & Bio */}
                <div style={{ padding: 12, borderRadius: 10, background: "rgba(18,26,44,0.6)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: "0.72rem", color: "var(--tp-cyan)", fontWeight: 800 }}>
                    COACHING PHILOSOPHY & PUBLIC BIO
                  </div>
                  <textarea
                    rows="3"
                    value={trainerBioText}
                    onChange={(e) => setTrainerBioText(e.target.value)}
                    style={{
                      width: "100%",
                      background: "rgba(0,0,0,0.4)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8,
                      padding: 8,
                      color: "#ffffff",
                      fontSize: "0.8rem",
                      marginTop: 6,
                      outline: "none",
                      resize: "vertical",
                      fontFamily: "inherit",
                    }}
                  />

                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                    <button
                      type="button"
                      disabled={savingProfile}
                      onClick={handleSaveTrainerProfile}
                      style={{
                        background: "linear-gradient(135deg, #0084ff, #00f2fe)",
                        border: "none",
                        color: "#060913",
                        fontWeight: 800,
                        fontSize: "0.75rem",
                        padding: "7px 18px",
                        borderRadius: 8,
                        cursor: savingProfile ? "wait" : "pointer",
                        opacity: savingProfile ? 0.7 : 1,
                      }}
                    >
                      {savingProfile ? "Saving to Database..." : "Save Profile & Settings"}
                    </button>
                  </div>
                </div>

                {/* Specialties Badges */}
                <div style={{ padding: 12, borderRadius: 10, background: "rgba(18,26,44,0.6)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: "0.72rem", color: "var(--tp-cyan)", fontWeight: 800 }}>SPECIALTIES</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                    {["Hypertrophy", "Biomechanics & Form Analysis", "Powerlifting Peaking", "Metabolic Conditioning", "Postural Rehab"].map((tag) => (
                      <span
                        key={tag}
                        style={{
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          padding: "3px 8px",
                          borderRadius: 6,
                          background: "rgba(0,180,255,0.12)",
                          color: "var(--tp-cyan)",
                          border: "1px solid rgba(0,180,255,0.25)",
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Member Removal Request Modal */}
        <TrainerRemovalRequestModal
          isOpen={showRemovalModal}
          onClose={() => {
            setShowRemovalModal(false);
            setSelectedClientForRemoval(null);
          }}
          trainerId={currentTrainer.id || 4}
          client={selectedClientForRemoval}
          onSuccess={() => {
            alert("Member removal request submitted to Gym Administration.");
          }}
        />
      </main>
    </div>
  );
}

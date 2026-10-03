import express from "express";
import {
  getDashboardData,
  scanAttendance,
  getAttendanceLedger,
  getAssignedCoach,
  assignWorkout,
  toggleExercise,
  finishWorkout,
  bookSession,
  logNutrition,
  processPayment,
  updateSettings,
  getTrainerTrainees,
  createMemberQuery,
  selectTrainer,
  leaveTrainer,
  logProgressRecord,
  enrollFace,
  recognizeFaceAndCheckIn,
  getFaceStatus,
  getUserMfaCode,
  verifyMfaCodeAndCheckIn,
} from "../controllers/realtimeController.js";
import {
  getAdminOverview,
  getAllTrainers,
  createTrainer,
  updateTrainerProfile,
  getAllMembers,
  assignTrainerToMember,
  getMemberQueries,
  resolveMemberQuery,
} from "../controllers/adminController.js";
import {
  getChatMessages,
  sendChatMessage,
} from "../controllers/chatController.js";
import {
  createCashfreeOrder,
  verifyCashfreeOrder,
  getUserMembershipStatus,
  getAdminPaymentsLedger,
  getTrainerPaymentsLedger,
} from "../controllers/paymentController.js";
import {
  getMemberTrainerProfile,
  getEligibleTrainers,
  getBillingPreview,
  submitMemberChangeRequest,
  getMemberChangeRequests,
  withdrawMemberRequest,
  getTrainerAssignedMembers,
  submitTrainerRemovalRequest,
  getTrainerRequests,
  getAdminChangeRequests,
  getAdminRequestSummary,
  getAdminRequestDetails,
  approveChangeRequest,
  rejectChangeRequest,
  createAdjustmentPaymentOrder,
  verifyAdjustmentPayment,
  getPlanChangePreview,
  submitPlanChangeRequest,
  getMemberPlanChangeRequests,
} from "../controllers/changeRequestController.js";
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from "../controllers/notificationController.js";
import {
  getCommunityPosts,
  createCommunityPost,
  toggleLikeCommunityPost,
} from "../controllers/communityController.js";

const router = express.Router();

// Real-Time Dashboard Aggregation
router.get("/dashboard/data", getDashboardData);

// Attendance Live Scan & Ledger
router.post("/attendance/scan", scanAttendance);
router.get("/attendance/ledger", getAttendanceLedger);

// Secondary Attendance: 1-Minute Dynamic MFA Code & Verification
router.get("/user/mfa-code", getUserMfaCode);
router.post("/attendance/verify-mfa", verifyMfaCodeAndCheckIn);

// Biometric Facial Recognition & Attendance Login
router.post("/user/enroll-face", enrollFace);
router.post("/attendance/recognize-face", recognizeFaceAndCheckIn);
router.get("/user/face-status", getFaceStatus);

// Member Assigned Coach & Single Coach Workflow
router.get("/user/assigned-coach", getAssignedCoach);
router.post("/member/select-trainer", selectTrainer);
router.post("/member/leave-trainer", leaveTrainer);

// Member Physical Development: PR Records
router.post("/member/progress-record", logProgressRecord);

// Workouts Live Updates
router.post("/workouts/assign", assignWorkout);
router.post("/workouts/toggle-exercise", toggleExercise);
router.post("/workouts/finish", finishWorkout);

// Trainer Sessions Live Booking
router.post("/sessions/book", bookSession);

// Nutrition Live Log
router.post("/nutrition/log", logNutrition);

// Payments & Membership (Legacy & Cashfree Gateway)
router.post("/membership/pay", processPayment);
router.post("/payment/cashfree/create-order", createCashfreeOrder);
router.post("/payment/cashfree/verify-order", verifyCashfreeOrder);
router.get("/payment/user-status/:userId", getUserMembershipStatus);
router.get("/payment/admin/all-payments", getAdminPaymentsLedger);
router.get("/payment/trainer/:trainerId", getTrainerPaymentsLedger);

// Settings
router.put("/settings/profile", updateSettings);

// Trainer Trainees Isolation & Live Nutrition
router.get("/trainer/trainees", getTrainerTrainees);

// Member Support Queries
router.post("/queries/create", createMemberQuery);

// Chat (Member <-> Trainer & Admin <-> Trainer)
router.get("/chat/messages", getChatMessages);
router.post("/chat/send", sendChatMessage);

// Admin Control Panel
router.get("/admin/overview", getAdminOverview);
router.get("/admin/trainers", getAllTrainers);
router.post("/admin/trainers/create", createTrainer);
router.put("/trainers/:id/profile", updateTrainerProfile);
router.get("/admin/members", getAllMembers);
router.post("/admin/members/assign-trainer", assignTrainerToMember);
router.get("/admin/queries", getMemberQueries);
router.put("/admin/queries/:id/resolve", resolveMemberQuery);

// =========================================================================
// Trainer Change & Member Removal Requests API
// =========================================================================

// Member Flow
router.get("/change-requests/member/profile", getMemberTrainerProfile);
router.get("/change-requests/member/eligible-trainers", getEligibleTrainers);
router.post("/change-requests/member/billing-preview", getBillingPreview);
router.post("/change-requests/member/submit", submitMemberChangeRequest);
router.get("/change-requests/member/requests", getMemberChangeRequests);
router.post("/change-requests/member/withdraw", withdrawMemberRequest);
router.post("/change-requests/payment/create-order", createAdjustmentPaymentOrder);
router.post("/change-requests/payment/verify", verifyAdjustmentPayment);

// Membership Plan Change Flow
router.post("/change-requests/plan/preview", getPlanChangePreview);
router.get("/change-requests/plan/preview", getPlanChangePreview);
router.post("/change-requests/plan/submit", submitPlanChangeRequest);
router.get("/change-requests/plan/member/:memberId", getMemberPlanChangeRequests);

// Trainer Flow
router.get("/change-requests/trainer/members", getTrainerAssignedMembers);
router.post("/change-requests/trainer/submit-removal", submitTrainerRemovalRequest);
router.get("/change-requests/trainer/requests", getTrainerRequests);

// Admin Control & One-Click Review
router.get("/change-requests/admin/summary", getAdminRequestSummary);
router.get("/change-requests/admin/all", getAdminChangeRequests);
router.get("/change-requests/admin/details/:id", getAdminRequestDetails);
router.post("/change-requests/admin/:id/approve", approveChangeRequest);
router.post("/change-requests/admin/:id/reject", rejectChangeRequest);

// =========================================================================
// Centralized Notifications API
// =========================================================================
router.get("/notifications", getNotifications);
router.get("/notifications/unread-count", getUnreadCount);
router.post("/notifications/:id/read", markAsRead);
router.post("/notifications/read-all", markAllAsRead);

// =========================================================================
// Athlete Network / Community Posts API
// =========================================================================
router.get("/community/posts", getCommunityPosts);
router.post("/community/posts", createCommunityPost);
router.post("/community/posts/:id/like", toggleLikeCommunityPost);

export default router;

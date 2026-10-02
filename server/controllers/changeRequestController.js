import { pool } from "../config/db.js";
import { calculateProratedAdjustment, calculatePlanChangeAdjustment } from "../services/billingService.js";
import { GYM_PLANS } from "./paymentController.js";
import { createNotification, logAudit } from "../services/notificationService.js";
import { broadcastEvent } from "../socket.js";

const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID || "TEST11229889069c15c0e7ceb1c81ce998892211";
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY || "cfsk_ma_test_d721997453c0b962407d98d405781093_eb2735f6";
const CASHFREE_API_VERSION = process.env.CASHFREE_API_VERSION || "2023-08-01";
const CASHFREE_BASE_URL = "https://sandbox.cashfree.com/pg";

/* ==========================================================================
   01. MEMBER FLOW CONTROLLERS
========================================================================== */

/**
 * Get member's assigned coach profile and assignment history.
 */
export const getMemberTrainerProfile = async (req, res) => {
  try {
    const memberId = req.query.memberId || req.user?.id || 1;

    const [[member]] = await pool.query(
      `SELECT id, full_name, email, phone, role, trainer_id, 
              gym_membership_active, gym_membership_expires_at,
              trainer_fee_paid, trainer_fee_expires_at
       FROM users WHERE id = ?`,
      [memberId]
    );

    if (!member) {
      return res.status(404).json({ success: false, message: "Member not found." });
    }

    let assignedTrainer = null;
    let activeAssignment = null;

    if (member.trainer_id) {
      const [[trainer]] = await pool.query(
        `SELECT id, full_name, email, phone, monthly_fee, role,
                avatar_url, created_at
         FROM users WHERE id = ? AND role = 'Trainer'`,
        [member.trainer_id]
      );

      if (trainer) {
        assignedTrainer = {
          ...trainer,
          monthly_fee: Number(trainer.monthly_fee || 2999),
          specialty: "Strength, Biomechanics & Hypertrophy",
          experience_years: 6,
          rating: 4.95,
          active_clients_count: 14,
        };
      }

      // Fetch active assignment record
      const [[assignment]] = await pool.query(
        `SELECT id, start_at, status, notes
         FROM trainer_assignments 
         WHERE member_id = ? AND trainer_id = ? AND status = 'Active'
         ORDER BY id DESC LIMIT 1`,
        [memberId, member.trainer_id]
      );
      activeAssignment = assignment || null;
    }

    // Active pending change request if any
    const [pendingRequests] = await pool.query(
      `SELECT r.*, 
              ct.full_name AS current_trainer_name,
              pt.full_name AS preferred_trainer_name,
              ba.final_adjustment_minor, ba.charge_amount_minor, ba.credit_amount_minor,
              ba.status AS billing_status, ba.calculation_snapshot
       FROM trainer_change_requests r
       LEFT JOIN users ct ON r.current_trainer_id = ct.id
       LEFT JOIN users pt ON r.preferred_trainer_id = pt.id
       LEFT JOIN trainer_change_billing_adjustments ba ON r.billing_adjustment_id = ba.id
       WHERE r.member_id = ? AND r.status IN ('Submitted', 'Under Review', 'Awaiting Payment', 'Processing', 'Action Required')
       ORDER BY r.id DESC LIMIT 1`,
      [memberId]
    );

    return res.status(200).json({
      success: true,
      member: {
        id: member.id,
        full_name: member.full_name,
        email: member.email,
        gym_membership_active: Boolean(member.gym_membership_active),
        gym_membership_expires_at: member.gym_membership_expires_at,
        trainer_fee_paid: Boolean(member.trainer_fee_paid),
        trainer_fee_expires_at: member.trainer_fee_expires_at,
      },
      assignedTrainer,
      activeAssignment,
      activeRequest: pendingRequests[0] || null,
    });
  } catch (error) {
    console.error("Error fetching member trainer profile:", error);
    return res.status(500).json({ success: false, message: "Internal server error fetching trainer profile." });
  }
};

/**
 * List eligible replacement trainers with pricing and current roster load.
 */
export const getEligibleTrainers = async (req, res) => {
  try {
    const memberId = req.query.memberId || req.user?.id || 1;

    const [[member]] = await pool.query("SELECT trainer_id FROM users WHERE id = ?", [memberId]);
    const currentTrainerId = member?.trainer_id || 0;

    // Fetch all trainers excluding current trainer
    const [trainers] = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.monthly_fee, u.avatar_url,
              COUNT(m.id) as active_clients_count
       FROM users u
       LEFT JOIN users m ON m.trainer_id = u.id AND m.role = 'Member'
       WHERE u.role = 'Trainer' AND u.id != ?
       GROUP BY u.id
       ORDER BY u.full_name ASC`,
      [currentTrainerId]
    );

    const specialtiesMap = {
      4: { specialty: "Biomechanics & Powerlifting", experience: "7 Years", rating: 4.9 },
      5: { specialty: "VO2 Max, Agility & HIIT Conditioning", experience: "5 Years", rating: 4.8 },
      6: { specialty: "Hypertrophy & Competitive Bodybuilding", experience: "8 Years", rating: 5.0 },
    };

    const formattedTrainers = trainers.map((t) => {
      const extra = specialtiesMap[t.id] || { specialty: "Functional Strength & Mobility", experience: "4 Years", rating: 4.8 };
      return {
        id: t.id,
        full_name: t.full_name,
        email: t.email,
        monthly_fee: Number(t.monthly_fee || 2999),
        specialty: extra.specialty,
        experience: extra.experience,
        rating: extra.rating,
        active_clients_count: Number(t.active_clients_count || 0),
        capacity_max: 20,
        is_available: Number(t.active_clients_count || 0) < 20,
      };
    });

    return res.status(200).json({
      success: true,
      currentTrainerId,
      trainers: formattedTrainers,
    });
  } catch (error) {
    console.error("Error fetching eligible trainers:", error);
    return res.status(500).json({ success: false, message: "Internal server error fetching trainers." });
  }
};

/**
 * Live Server-Side Billing Preview
 * Computes exact prorated adjustment for swapping to a specific new trainer.
 */
export const getBillingPreview = async (req, res) => {
  try {
    const { memberId = 1, newTrainerId } = req.body;

    if (!newTrainerId) {
      return res.status(400).json({ success: false, message: "newTrainerId is required." });
    }

    const [[member]] = await pool.query("SELECT trainer_id FROM users WHERE id = ?", [memberId]);
    if (!member || !member.trainer_id) {
      return res.status(400).json({ success: false, message: "Member currently has no assigned trainer." });
    }

    if (Number(member.trainer_id) === Number(newTrainerId)) {
      return res.status(400).json({ success: false, message: "Selected trainer is already your current coach." });
    }

    const calculation = await calculateProratedAdjustment(memberId, member.trainer_id, newTrainerId);

    return res.status(200).json({
      success: true,
      calculation,
    });
  } catch (error) {
    console.error("Error generating billing preview:", error);
    return res.status(400).json({ success: false, message: error.message || "Failed to calculate billing preview." });
  }
};

/**
 * Submit Member Trainer Change Request
 */
export const submitMemberChangeRequest = async (req, res) => {
  try {
    const {
      memberId = 1,
      newTrainerId,
      reasonCode,
      description = "",
      isConfidential = false,
      ipAddress = "127.0.0.1",
    } = req.body;

    if (!newTrainerId || !reasonCode) {
      return res.status(400).json({ success: false, message: "newTrainerId and reasonCode are required." });
    }

    // 1. Verify Member status
    const [[member]] = await pool.query(
      `SELECT id, full_name, email, trainer_id, gym_membership_active, gym_membership_expires_at
       FROM users WHERE id = ?`,
      [memberId]
    );

    if (!member) {
      return res.status(404).json({ success: false, message: "Member account not found." });
    }

    const isGymActive =
      member.gym_membership_active === 1 &&
      member.gym_membership_expires_at &&
      new Date(member.gym_membership_expires_at) > new Date();

    if (!isGymActive) {
      return res.status(400).json({
        success: false,
        message: "You must have an active gym membership to request trainer changes.",
      });
    }

    if (!member.trainer_id) {
      return res.status(400).json({
        success: false,
        message: "You do not currently have an assigned personal trainer to change.",
      });
    }

    if (Number(member.trainer_id) === Number(newTrainerId)) {
      return res.status(400).json({
        success: false,
        message: "You cannot request a change to your currently assigned trainer.",
      });
    }

    // 2. Check for existing active requests
    const [existing] = await pool.query(
      `SELECT id, request_number, status FROM trainer_change_requests
       WHERE member_id = ? AND status IN ('Submitted', 'Under Review', 'Awaiting Payment', 'Processing', 'Action Required')`,
      [memberId]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `You already have an active request (${existing[0].request_number}) with status "${existing[0].status}". Please await admin review or withdraw it before submitting a new one.`,
      });
    }

    // 3. Compute trusted server-side prorated adjustment
    const calc = await calculateProratedAdjustment(memberId, member.trainer_id, newTrainerId);

    // 4. Generate unique request number
    const requestNumber = `TCR-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    // 5. Insert change request record
    const [requestResult] = await pool.query(
      `INSERT INTO trainer_change_requests 
       (request_number, request_type, initiated_by_user_id, member_id, current_trainer_id, preferred_trainer_id,
        reason_code, description, is_confidential, status, effective_at, version, created_at)
       VALUES (?, 'member_change_trainer', ?, ?, ?, ?, ?, ?, ?, 'Submitted', NOW(), 1, NOW())`,
      [
        requestNumber,
        memberId,
        memberId,
        member.trainer_id,
        newTrainerId,
        reasonCode,
        description,
        isConfidential ? 1 : 0,
      ]
    );

    const requestId = requestResult.insertId;

    // 6. Insert billing adjustment record
    const [billingResult] = await pool.query(
      `INSERT INTO trainer_change_billing_adjustments
       (request_id, member_id, current_trainer_fee_minor, new_trainer_fee_minor, currency,
        billing_period_start, billing_period_end, effective_at, remaining_eligible_days, total_billing_period_days,
        calculation_method, credit_amount_minor, charge_amount_minor, tax_amount_minor, final_adjustment_minor,
        status, calculation_snapshot, created_at)
       VALUES (?, ?, ?, ?, 'INR', ?, ?, NOW(), ?, ?, 'same_period_difference', ?, ?, 0, ?, 'Pending', ?, NOW())`,
      [
        requestId,
        memberId,
        calc.currentFeeMinor,
        calc.newFeeMinor,
        calc.billingStart,
        calc.billingEnd,
        calc.remainingDays,
        calc.totalDays,
        calc.creditAmountMinor,
        calc.chargeAmountMinor,
        calc.proratedAdjustmentMinor,
        JSON.stringify(calc.snapshot),
      ]
    );

    const billingAdjustmentId = billingResult.insertId;

    // Link billing adjustment to request
    await pool.query("UPDATE trainer_change_requests SET billing_adjustment_id = ? WHERE id = ?", [
      billingAdjustmentId,
      requestId,
    ]);

    // 7. Fetch trainer names for notifications
    const [[currentTrainer]] = await pool.query("SELECT full_name FROM users WHERE id = ?", [member.trainer_id]);
    const [[newTrainer]] = await pool.query("SELECT full_name FROM users WHERE id = ?", [newTrainerId]);

    // 8. Dispatch Centralized Notifications
    // To Member: Confirmation
    await createNotification({
      recipientUserId: memberId,
      category: "trainer_change",
      title: `Trainer Change Request Logged (${requestNumber})`,
      message: `Your request to transfer from Coach ${currentTrainer?.full_name} to Coach ${newTrainer?.full_name} has been submitted for admin review.`,
      type: "info",
      entityType: "trainer_change_request",
      entityId: requestId,
      isConfidential,
      emailSubject: `FitPulse: Trainer Change Request Received [${requestNumber}]`,
      emailBodyLines: [
        `Hello ${member.full_name},`,
        `We have received your request to change your assigned personal trainer to Coach ${newTrainer?.full_name}.`,
        `Our administration desk will review availability, schedule alignment, and fee adjustments.`,
        calc.isCharge
          ? `Estimated Prorated Difference: ₹${calc.snapshot.proratedAdjustmentINR} (payable upon approval).`
          : calc.isCredit
          ? `Estimated Eligible Credit: ₹${calc.snapshot.proratedAdjustmentINR} (applied upon approval).`
          : `No fee adjustment required (identical rate).`,
      ],
      emailMetadata: [
        { label: "Request ID", value: requestNumber },
        { label: "Current Coach", value: currentTrainer?.full_name || "Assigned Trainer" },
        { label: "Requested Coach", value: newTrainer?.full_name || "New Coach" },
        { label: "Status", value: "Submitted (Pending Review)" },
      ],
    });

    // To Admins: Broadcast alert
    const [admins] = await pool.query("SELECT id FROM users WHERE role = 'Admin'");
    for (const admin of admins) {
      await createNotification({
        recipientUserId: admin.id,
        category: "trainer_change",
        title: `New Change Request: ${member.full_name}`,
        message: `${member.full_name} requested a trainer transfer to ${newTrainer?.full_name} (${requestNumber}). Review required.`,
        type: "alert",
        entityType: "trainer_change_request",
        entityId: requestId,
        isConfidential,
        emailSubject: `[Action Required] Trainer Change Request: ${requestNumber}`,
        emailBodyLines: [
          `A new trainer change request has been submitted and is awaiting your review in the FitPulse Admin Console.`,
          `Member: ${member.full_name}`,
          `Current Coach: ${currentTrainer?.full_name}`,
          `Requested Coach: ${newTrainer?.full_name}`,
          `Prorated Adjustment: ₹${calc.snapshot.proratedAdjustmentINR} (${calc.snapshot.actionType})`,
        ],
      });
    }

    // 9. Audit Log
    await logAudit({
      actorUserId: memberId,
      actorRole: "Member",
      action: "SUBMIT_TRAINER_CHANGE_REQUEST",
      entityType: "trainer_change_request",
      entityId: requestId,
      newState: {
        requestNumber,
        memberId,
        currentTrainerId: member.trainer_id,
        preferredTrainerId: newTrainerId,
        reasonCode,
        isConfidential,
        calculation: calc.snapshot,
      },
      ipAddress,
    });

    // Broadcast live event
    broadcastEvent("request:created", {
      requestId,
      requestNumber,
      requestType: "member_change_trainer",
      memberName: member.full_name,
      status: "Submitted",
    });

    return res.status(201).json({
      success: true,
      message: "Trainer change request submitted successfully. Admin review is underway.",
      request: {
        id: requestId,
        request_number: requestNumber,
        status: "Submitted",
        member_id: memberId,
        current_trainer_id: member.trainer_id,
        preferred_trainer_id: newTrainerId,
        calculation: calc,
      },
    });
  } catch (error) {
    console.error("Error submitting member change request:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to submit change request." });
  }
};

/**
 * Get member's request history.
 */
export const getMemberChangeRequests = async (req, res) => {
  try {
    const memberId = req.query.memberId || req.user?.id || 1;

    const [rows] = await pool.query(
      `SELECT r.*,
              ct.full_name AS current_trainer_name,
              pt.full_name AS preferred_trainer_name,
              ba.final_adjustment_minor, ba.charge_amount_minor, ba.credit_amount_minor,
              ba.status AS billing_status, ba.payment_order_id, ba.calculation_snapshot
       FROM trainer_change_requests r
       LEFT JOIN users ct ON r.current_trainer_id = ct.id
       LEFT JOIN users pt ON r.preferred_trainer_id = pt.id
       LEFT JOIN trainer_change_billing_adjustments ba ON r.billing_adjustment_id = ba.id
       WHERE r.member_id = ?
       ORDER BY r.created_at DESC`,
      [memberId]
    );

    return res.status(200).json({ success: true, requests: rows });
  } catch (error) {
    console.error("Error fetching member requests:", error);
    return res.status(500).json({ success: false, message: "Internal server error fetching requests." });
  }
};

/**
 * Member withdraws a pending change request.
 */
export const withdrawMemberRequest = async (req, res) => {
  try {
    const { requestId, memberId = 1, withdrawalReason = "Member requested cancellation" } = req.body;

    const [[request]] = await pool.query("SELECT * FROM trainer_change_requests WHERE id = ? AND member_id = ?", [
      requestId,
      memberId,
    ]);

    if (!request) {
      return res.status(404).json({ success: false, message: "Request not found." });
    }

    if (!["Submitted", "Under Review", "Awaiting Payment", "Action Required"].includes(request.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot withdraw request with status "${request.status}". Only pending requests can be withdrawn.`,
      });
    }

    await pool.query(
      "UPDATE trainer_change_requests SET status = 'Withdrawn', rejection_reason = ?, updated_at = NOW() WHERE id = ?",
      [withdrawalReason, requestId]
    );

    // Cancel pending billing adjustment if any
    if (request.billing_adjustment_id) {
      await pool.query(
        "UPDATE trainer_change_billing_adjustments SET status = 'Waived' WHERE id = ? AND status = 'Pending'",
        [request.billing_adjustment_id]
      );
    }

    // Notifications
    await createNotification({
      recipientUserId: memberId,
      category: "trainer_change",
      title: `Request Withdrawn (${request.request_number})`,
      message: `Your trainer change request has been withdrawn. Your current coach assignment remains active.`,
      type: "info",
      entityType: "trainer_change_request",
      entityId: requestId,
    });

    await logAudit({
      actorUserId: memberId,
      actorRole: "Member",
      action: "WITHDRAW_TRAINER_CHANGE_REQUEST",
      entityType: "trainer_change_request",
      entityId: requestId,
      previousState: { status: request.status },
      newState: { status: "Withdrawn", withdrawalReason },
    });

    broadcastEvent("request:updated", {
      requestId,
      status: "Withdrawn",
      requestNumber: request.request_number,
    });

    return res.status(200).json({ success: true, message: "Request withdrawn successfully." });
  } catch (error) {
    console.error("Error withdrawing request:", error);
    return res.status(500).json({ success: false, message: "Internal server error withdrawing request." });
  }
};

/* ==========================================================================
   02. TRAINER FLOW CONTROLLERS
========================================================================== */

/**
 * Get members assigned to a trainer with active assignment metadata.
 */
export const getTrainerAssignedMembers = async (req, res) => {
  try {
    const trainerId = req.query.trainerId || req.user?.id || 4;

    const [members] = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.phone, u.goal, u.avatar_url,
              u.gym_membership_active, u.gym_membership_expires_at,
              u.trainer_fee_paid, u.trainer_fee_expires_at,
              ta.start_at AS assignment_start_at,
              ta.status AS assignment_status,
              COUNT(DISTINCT w.id) AS completed_workouts_count
       FROM users u
       LEFT JOIN trainer_assignments ta ON ta.member_id = u.id AND ta.trainer_id = ? AND ta.status = 'Active'
       LEFT JOIN workouts w ON w.user_id = u.id AND w.status = 'Completed'
       WHERE u.role = 'Member' AND (u.trainer_id = ? OR ta.status = 'Active')
       GROUP BY u.id
       ORDER BY u.full_name ASC`,
      [trainerId, trainerId]
    );

    return res.status(200).json({ success: true, members });
  } catch (error) {
    console.error("Error fetching trainer assigned members:", error);
    return res.status(500).json({ success: false, message: "Internal server error fetching assigned members." });
  }
};

/**
 * Trainer submits removal / reassignment request for a member.
 */
export const submitTrainerRemovalRequest = async (req, res) => {
  try {
    const {
      trainerId = 4,
      memberId,
      reasonCode,
      description = "",
      isConfidential = false,
      ipAddress = "127.0.0.1",
    } = req.body;

    if (!memberId || !reasonCode) {
      return res.status(400).json({ success: false, message: "memberId and reasonCode are required." });
    }

    const [[trainer]] = await pool.query("SELECT id, full_name, email FROM users WHERE id = ? AND role = 'Trainer'", [
      trainerId,
    ]);
    if (!trainer) {
      return res.status(404).json({ success: false, message: "Trainer not found." });
    }

    const [[member]] = await pool.query("SELECT id, full_name, email, trainer_id FROM users WHERE id = ?", [memberId]);
    if (!member) {
      return res.status(404).json({ success: false, message: "Member not found." });
    }

    if (Number(member.trainer_id) !== Number(trainerId)) {
      return res.status(400).json({
        success: false,
        message: "This member is not currently assigned to you.",
      });
    }

    // Check for existing pending request for this member
    const [existing] = await pool.query(
      `SELECT id, request_number, status FROM trainer_change_requests
       WHERE member_id = ? AND current_trainer_id = ? AND status IN ('Submitted', 'Under Review', 'Action Required')`,
      [memberId, trainerId]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `An active removal request (${existing[0].request_number}) is already pending for this member.`,
      });
    }

    const requestNumber = `TRR-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    const [insertResult] = await pool.query(
      `INSERT INTO trainer_change_requests 
       (request_number, request_type, initiated_by_user_id, member_id, current_trainer_id,
        reason_code, description, is_confidential, status, effective_at, version, created_at)
       VALUES (?, 'trainer_remove_member', ?, ?, ?, ?, ?, ?, 'Submitted', NOW(), 1, NOW())`,
      [
        requestNumber,
        trainerId,
        memberId,
        trainerId,
        reasonCode,
        description,
        isConfidential ? 1 : 0,
      ]
    );

    const requestId = insertResult.insertId;

    // Notify Trainer
    await createNotification({
      recipientUserId: trainerId,
      category: "trainer_change",
      title: `Member Removal Request Logged (${requestNumber})`,
      message: `Your request to remove ${member.full_name} from your roster has been logged and forwarded to Admin.`,
      type: "info",
      entityType: "trainer_change_request",
      entityId: requestId,
      isConfidential,
    });

    // Notify Admins
    const [admins] = await pool.query("SELECT id FROM users WHERE role = 'Admin'");
    for (const admin of admins) {
      await createNotification({
        recipientUserId: admin.id,
        category: "trainer_change",
        title: `Trainer Removal Request: Coach ${trainer.full_name}`,
        message: `Coach ${trainer.full_name} submitted a request to remove member ${member.full_name} (${requestNumber}).`,
        type: "alert",
        entityType: "trainer_change_request",
        entityId: requestId,
        isConfidential,
      });
    }

    // Audit Log
    await logAudit({
      actorUserId: trainerId,
      actorRole: "Trainer",
      action: "SUBMIT_TRAINER_REMOVAL_REQUEST",
      entityType: "trainer_change_request",
      entityId: requestId,
      newState: {
        requestNumber,
        trainerId,
        memberId,
        reasonCode,
        isConfidential,
      },
      ipAddress,
    });

    broadcastEvent("request:created", {
      requestId,
      requestNumber,
      requestType: "trainer_remove_member",
      trainerName: trainer.full_name,
      memberName: member.full_name,
      status: "Submitted",
    });

    return res.status(201).json({
      success: true,
      message: "Member removal request submitted successfully for administrative review.",
      request: {
        id: requestId,
        request_number: requestNumber,
        status: "Submitted",
        member_id: memberId,
        current_trainer_id: trainerId,
      },
    });
  } catch (error) {
    console.error("Error submitting trainer removal request:", error);
    return res.status(500).json({ success: false, message: "Internal server error submitting removal request." });
  }
};

/**
 * Get trainer's requests (both member requests involving this trainer and trainer's own removal requests).
 * Strict confidentiality enforcement: sensitive member reasons are never returned to the trainer!
 */
export const getTrainerRequests = async (req, res) => {
  try {
    const trainerId = req.query.trainerId || req.user?.id || 4;

    const [rows] = await pool.query(
      `SELECT r.id, r.request_number, r.request_type, r.initiated_by_user_id,
              r.member_id, r.current_trainer_id, r.preferred_trainer_id,
              r.status, r.effective_at, r.created_at, r.completed_at, r.rejection_reason,
              r.is_confidential,
              -- Strict confidentiality: hide sensitive details if member flagged confidential
              CASE 
                WHEN r.is_confidential = 1 AND r.initiated_by_user_id != ? THEN 'Confidential member preference'
                ELSE r.reason_code 
              END AS reason_code,
              CASE 
                WHEN r.is_confidential = 1 AND r.initiated_by_user_id != ? THEN 'Details confidential and shared only with gym administration.'
                ELSE r.description 
              END AS description,
              m.full_name AS member_name,
              m.avatar_url AS member_avatar,
              ct.full_name AS current_trainer_name,
              pt.full_name AS preferred_trainer_name
       FROM trainer_change_requests r
       JOIN users m ON r.member_id = m.id
       LEFT JOIN users ct ON r.current_trainer_id = ct.id
       LEFT JOIN users pt ON r.preferred_trainer_id = pt.id
       WHERE r.current_trainer_id = ? OR r.preferred_trainer_id = ? OR r.initiated_by_user_id = ?
       ORDER BY r.created_at DESC`,
      [trainerId, trainerId, trainerId, trainerId, trainerId]
    );

    return res.status(200).json({ success: true, requests: rows });
  } catch (error) {
    console.error("Error fetching trainer requests:", error);
    return res.status(500).json({ success: false, message: "Internal server error fetching trainer requests." });
  }
};

/* ==========================================================================
   03. ADMIN CONSOLE & AUTOMATED APPROVAL ENGINE
========================================================================== */

/**
 * Fetch all change & removal requests for Admin with comprehensive filters.
 */
export const getAdminChangeRequests = async (req, res) => {
  try {
    const { status, type, search } = req.query;

    let query = `
      SELECT r.*,
             m.full_name AS member_name, m.email AS member_email, m.phone AS member_phone,
             ct.full_name AS current_trainer_name, ct.monthly_fee AS current_trainer_fee,
             pt.full_name AS preferred_trainer_name, pt.monthly_fee AS preferred_trainer_fee,
             ba.final_adjustment_minor, ba.charge_amount_minor, ba.credit_amount_minor,
             ba.status AS billing_status, ba.payment_order_id, ba.calculation_snapshot,
             adm.full_name AS reviewed_by_name
      FROM trainer_change_requests r
      JOIN users m ON r.member_id = m.id
      LEFT JOIN users ct ON r.current_trainer_id = ct.id
      LEFT JOIN users pt ON r.preferred_trainer_id = pt.id
      LEFT JOIN trainer_change_billing_adjustments ba ON r.billing_adjustment_id = ba.id
      LEFT JOIN users adm ON r.reviewed_by_admin_id = adm.id
      WHERE 1=1
    `;

    const params = [];

    if (status && status !== "ALL") {
      query += " AND r.status = ?";
      params.push(status);
    }

    if (type && type !== "ALL") {
      query += " AND r.request_type = ?";
      params.push(type);
    }

    if (search && search.trim() !== "") {
      query += ` AND (r.request_number LIKE ? OR m.full_name LIKE ? OR ct.full_name LIKE ? OR pt.full_name LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }

    query += " ORDER BY r.created_at DESC";

    const [requests] = await pool.query(query, params);

    return res.status(200).json({ success: true, requests });
  } catch (error) {
    console.error("Error fetching admin requests:", error);
    return res.status(500).json({ success: false, message: "Internal server error fetching requests." });
  }
};

/**
 * Get 9 KPI Summary Cards for Admin Dashboard.
 */
export const getAdminRequestSummary = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        COUNT(*) AS total_count,
        SUM(CASE WHEN status IN ('Submitted', 'Under Review') THEN 1 ELSE 0 END) AS pending_count,
        SUM(CASE WHEN request_type = 'member_change_trainer' THEN 1 ELSE 0 END) AS member_change_count,
        SUM(CASE WHEN request_type = 'trainer_remove_member' THEN 1 ELSE 0 END) AS trainer_removal_count,
        SUM(CASE WHEN status = 'Awaiting Payment' THEN 1 ELSE 0 END) AS awaiting_payment_count,
        SUM(CASE WHEN status = 'Approved' THEN 1 ELSE 0 END) AS approved_count,
        SUM(CASE WHEN status = 'Rejected' THEN 1 ELSE 0 END) AS rejected_count,
        SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) AS completed_count,
        SUM(CASE WHEN is_confidential = 1 OR (status IN ('Submitted', 'Under Review') AND created_at < DATE_SUB(NOW(), INTERVAL 48 HOUR)) THEN 1 ELSE 0 END) AS urgent_count
      FROM trainer_change_requests
    `);

    const summary = {
      totalRequests: Number(rows[0]?.total_count || 0),
      pendingRequests: Number(rows[0]?.pending_count || 0),
      memberChangeRequests: Number(rows[0]?.member_change_count || 0),
      trainerRemovalRequests: Number(rows[0]?.trainer_removal_count || 0),
      awaitingPaymentRequests: Number(rows[0]?.awaiting_payment_count || 0),
      approvedRequests: Number(rows[0]?.approved_count || 0),
      rejectedRequests: Number(rows[0]?.rejected_count || 0),
      completedRequests: Number(rows[0]?.completed_count || 0),
      urgentRequests: Number(rows[0]?.urgent_count || 0),
    };

    return res.status(200).json({ success: true, summary });
  } catch (error) {
    console.error("Error fetching admin request summary:", error);
    return res.status(500).json({ success: false, message: "Internal server error fetching KPI summary." });
  }
};

/**
 * Get complete 4-Card review dossier for a specific request.
 */
export const getAdminRequestDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const [[request]] = await pool.query(
      `SELECT r.*,
              m.full_name AS member_name, m.email AS member_email, m.phone AS member_phone,
              m.gym_membership_active, m.gym_membership_expires_at,
              ct.full_name AS current_trainer_name, ct.email AS current_trainer_email, ct.monthly_fee AS current_trainer_fee,
              pt.full_name AS preferred_trainer_name, pt.email AS preferred_trainer_email, pt.monthly_fee AS preferred_trainer_fee,
              ba.id AS billing_id, ba.final_adjustment_minor, ba.charge_amount_minor, ba.credit_amount_minor,
              ba.status AS billing_status, ba.payment_order_id, ba.calculation_snapshot,
              adm.full_name AS reviewed_by_name
       FROM trainer_change_requests r
       JOIN users m ON r.member_id = m.id
       LEFT JOIN users ct ON r.current_trainer_id = ct.id
       LEFT JOIN users pt ON r.preferred_trainer_id = pt.id
       LEFT JOIN trainer_change_billing_adjustments ba ON r.billing_adjustment_id = ba.id
       LEFT JOIN users adm ON r.reviewed_by_admin_id = adm.id
       WHERE r.id = ?`,
      [id]
    );

    if (!request) {
      return res.status(404).json({ success: false, message: "Request dossier not found." });
    }

    // 1. Upcoming session conflicts
    const [upcomingSessions] = await pool.query(
      `SELECT * FROM trainer_sessions 
       WHERE (trainer_name = ? OR member_name = ?)
       LIMIT 10`,
      [request.current_trainer_name, request.member_name]
    );

    // 2. Historical assignments
    const [assignmentHistory] = await pool.query(
      `SELECT ta.*, t.full_name AS trainer_name
       FROM trainer_assignments ta
       JOIN users t ON ta.trainer_id = t.id
       WHERE ta.member_id = ?
       ORDER BY ta.start_at DESC`,
      [request.member_id]
    );

    // 3. Audit trail
    const [auditTrail] = await pool.query(
      `SELECT a.*, u.full_name AS actor_name
       FROM audit_logs a
       LEFT JOIN users u ON a.actor_user_id = u.id
       WHERE a.entity_type = 'trainer_change_request' AND a.entity_id = ?
       ORDER BY a.created_at ASC`,
      [id]
    );

    return res.status(200).json({
      success: true,
      request,
      upcomingSessions,
      assignmentHistory,
      auditTrail,
    });
  } catch (error) {
    console.error("Error fetching request details:", error);
    return res.status(500).json({ success: false, message: "Internal server error fetching details." });
  }
};

/**
 * ONE-CLICK ADMIN APPROVAL ENGINE
 * Handles everything automatically:
 * - Recalculates and verifies pricing.
 * - If extra payment required -> Generates Cashfree order & sets 'Awaiting Payment'.
 * - If zero adjustment or credit -> Reassigns trainer immediately in DB, reconciles sessions, logs credit, and sets 'Completed'.
 * - If trainer removal -> Ends assignment, unassigns member, reconciles sessions, and sets 'Completed'.
 * - Dispatches notifications to Member, Trainers, and Admin.
 */
export const approveChangeRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.body.adminId || req.user?.id || 1; // Default admin
    const notes = req.body.notes || "Approved by System Administrator";

    const [[request]] = await pool.query("SELECT * FROM trainer_change_requests WHERE id = ?", [id]);
    if (!request) {
      return res.status(404).json({ success: false, message: "Change request not found." });
    }

    if (!["Submitted", "Under Review", "Action Required"].includes(request.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot approve request with current status "${request.status}".`,
      });
    }

    const [[member]] = await pool.query("SELECT * FROM users WHERE id = ?", [request.member_id]);
    const [[currentTrainer]] = await pool.query("SELECT * FROM users WHERE id = ?", [request.current_trainer_id]);

    /* =========================================================================
       PATH 1: MEMBER TRAINER CHANGE
    ========================================================================= */
    if (request.request_type === "member_change_trainer") {
      const preferredTrainerId = request.preferred_trainer_id;
      const [[newTrainer]] = await pool.query("SELECT * FROM users WHERE id = ?", [preferredTrainerId]);

      if (!newTrainer) {
        return res.status(400).json({ success: false, message: "Selected replacement trainer does not exist." });
      }

      // Re-validate and recalculate billing adjustment server-side
      const calc = await calculateProratedAdjustment(request.member_id, request.current_trainer_id, preferredTrainerId);

      // Update stored billing adjustment
      if (request.billing_adjustment_id) {
        await pool.query(
          `UPDATE trainer_change_billing_adjustments SET
             current_trainer_fee_minor = ?,
             new_trainer_fee_minor = ?,
             remaining_eligible_days = ?,
             total_billing_period_days = ?,
             credit_amount_minor = ?,
             charge_amount_minor = ?,
             final_adjustment_minor = ?,
             calculation_snapshot = ?
           WHERE id = ?`,
          [
            calc.currentFeeMinor,
            calc.newFeeMinor,
            calc.remainingDays,
            calc.totalDays,
            calc.creditAmountMinor,
            calc.chargeAmountMinor,
            calc.proratedAdjustmentMinor,
            JSON.stringify(calc.snapshot),
            request.billing_adjustment_id,
          ]
        );
      }

      // SUB-CASE 1A: ADDITIONAL PAYMENT REQUIRED (UPGRADE)
      if (calc.isCharge && calc.chargeAmountMinor > 0) {
        const chargeINR = calc.chargeAmountMinor / 100;
        const orderId = `order_TC_${request.id}_${Date.now()}`;

        // Create Cashfree Payment Order
        let paymentSessionId = null;
        try {
          const cfResponse = await fetch(`${CASHFREE_BASE_URL}/orders`, {
            method: "POST",
            headers: {
              "x-client-id": CASHFREE_APP_ID,
              "x-client-secret": CASHFREE_SECRET_KEY,
              "x-api-version": CASHFREE_API_VERSION,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              order_id: orderId,
              order_amount: Number(chargeINR),
              order_currency: "INR",
              customer_details: {
                customer_id: `cust_${member.id}`,
                customer_name: member.full_name || "FitPulse Member",
                customer_email: member.email || "member@fitpulse.com",
                customer_phone: member.phone || "9999999999",
              },
              order_meta: {
                return_url: `${process.env.CLIENT_URL || "http://localhost:5173"}/dashboard/trainer?order_id=${orderId}&request_id=${request.id}`,
              },
              order_note: `FitPulse Trainer Upgrade Difference - ${newTrainer.full_name} (${request.request_number})`,
            }),
          });
          const cfData = await cfResponse.json();
          if (cfResponse.ok && cfData.payment_session_id) {
            paymentSessionId = cfData.payment_session_id;
          }
        } catch (cfErr) {
          console.warn("[Cashfree PG] Error generating order during approval:", cfErr.message);
        }

        // Update Request to Awaiting Payment
        await pool.query(
          `UPDATE trainer_change_requests SET
             status = 'Awaiting Payment',
             reviewed_by_admin_id = ?,
             reviewed_at = NOW(),
             updated_at = NOW()
           WHERE id = ?`,
          [adminId, id]
        );

        if (request.billing_adjustment_id) {
          await pool.query(
            `UPDATE trainer_change_billing_adjustments SET
               status = 'Payment Required',
               payment_order_id = ?
             WHERE id = ?`,
            [orderId, request.billing_adjustment_id]
          );
        }

        // Insert pending payment log
        await pool.query(
          `INSERT INTO payments (
            order_id, user_id, user_name, user_email, payment_type, plan_name,
            trainer_id, trainer_name, amount, currency, payment_status, payment_method
          ) VALUES (?, ?, ?, ?, 'trainer_change_adjustment', ?, ?, ?, ?, 'INR', 'PENDING', 'Cashfree PG')`,
          [
            orderId,
            member.id,
            member.full_name,
            member.email,
            `Prorated Upgrade Fee (${newTrainer.full_name})`,
            newTrainer.id,
            newTrainer.full_name,
            chargeINR,
          ]
        );

        // Notify Member of Approval & Payment Requirement
        await createNotification({
          recipientUserId: member.id,
          category: "trainer_change",
          title: `Request Approved: Payment Required (${request.request_number})`,
          message: `Admin approved your coach transfer to ${newTrainer.full_name}. Please complete the prorated difference of ₹${chargeINR} to activate your new coach.`,
          type: "payment",
          entityType: "trainer_change_request",
          entityId: request.id,
          emailSubject: `FitPulse: Transfer Approved — Prorated Settlement Required [${request.request_number}]`,
          emailBodyLines: [
            `Hi ${member.full_name},`,
            `Your trainer transfer request to Coach ${newTrainer.full_name} has been approved by gym administration!`,
            `Because Coach ${newTrainer.full_name} has a higher tier rate, an automated prorated adjustment of ₹${chargeINR} is due for the remaining ${calc.remainingDays} days of your cycle.`,
            `Please click below or visit your Member Dashboard to finalize this settlement securely via Cashfree.`,
          ],
          ctaText: `Pay ₹${chargeINR} & Complete Transfer`,
          ctaUrl: `${process.env.CLIENT_URL || "http://localhost:5173"}/dashboard/trainer?action=pay&order_id=${orderId}`,
        });

        // Audit Log
        await logAudit({
          actorUserId: adminId,
          actorRole: "Admin",
          action: "APPROVE_REQUEST_AWAITING_PAYMENT",
          entityType: "trainer_change_request",
          entityId: id,
          newState: { status: "Awaiting Payment", orderId, chargeINR },
        });

        broadcastEvent("request:updated", {
          requestId: id,
          status: "Awaiting Payment",
          requestNumber: request.request_number,
          chargeINR,
        });

        return res.status(200).json({
          success: true,
          status: "Awaiting Payment",
          requiresPayment: true,
          chargeINR,
          orderId,
          paymentSessionId,
          message: `Request approved. Member has been prompted to settle prorated difference of ₹${chargeINR}.`,
        });
      }

      // SUB-CASE 1B: NO PAYMENT OR DOWNGRADE / CREDIT (IMMEDIATE AUTOMATION)
      // 1. Close current assignment
      await pool.query(
        `UPDATE trainer_assignments SET status = 'Transferred', end_at = NOW() 
         WHERE member_id = ? AND trainer_id = ? AND status = 'Active'`,
        [member.id, request.current_trainer_id]
      );

      // 2. Insert new active assignment
      await pool.query(
        `INSERT INTO trainer_assignments (member_id, trainer_id, status, start_at, source_request_id, notes)
         VALUES (?, ?, 'Active', NOW(), ?, ?)`,
        [member.id, preferredTrainerId, id, `Transferred via approved request ${request.request_number}`]
      );

      // 3. Update member's assigned coach in users table
      await pool.query("UPDATE users SET trainer_id = ? WHERE id = ?", [
        preferredTrainerId,
        member.id,
      ]);

      // 4. Gym Policy: STRICTLY NO REFUNDS OR CREDITS FOR COACH DOWNGRADES
      if (request.billing_adjustment_id) {
        await pool.query("UPDATE trainer_change_billing_adjustments SET status = 'Settled' WHERE id = ?", [
          request.billing_adjustment_id,
        ]);
      }

      // 5. Reconcile upcoming sessions in trainer_sessions
      await pool.query(
        `UPDATE trainer_sessions SET trainer_name = ? 
         WHERE member_name = ? AND trainer_name = ? AND status = 'Confirmed'`,
        [newTrainer.full_name, member.full_name, currentTrainer.full_name]
      );

      // 6. Complete the request
      await pool.query(
        `UPDATE trainer_change_requests SET
           status = 'Completed',
           reviewed_by_admin_id = ?,
           reviewed_at = NOW(),
           completed_at = NOW(),
           updated_at = NOW()
         WHERE id = ?`,
        [adminId, id]
      );

      // 7. Dispatch Centralized Notifications to ALL Parties
      // To Member
      await createNotification({
        recipientUserId: member.id,
        category: "trainer_change",
        title: `Coach Transfer Complete! (${request.request_number})`,
        message: `Your coach transfer to ${newTrainer.full_name} is now complete and active. Welcome your new coach!`,
        type: "success",
        entityType: "trainer_change_request",
        entityId: id,
        emailSubject: `FitPulse: Coach Transfer Completed Successfully!`,
        emailBodyLines: [
          `Hi ${member.full_name},`,
          `Your personal coach assignment has been officially transferred to Coach ${newTrainer.full_name}.`,
          `Your workout schedule, biometric logs, and upcoming sessions have been smoothly transferred.`,
          calc.isCredit
            ? `An eligible credit note of ₹${calc.creditAmountMinor / 100} has been added to your FitPulse account.`
            : `All future sessions will now be led by Coach ${newTrainer.full_name}.`,
        ],
      });

      // To Old Trainer (Respect confidentiality: NEVER mention member's private reasons!)
      await createNotification({
        recipientUserId: currentTrainer.id,
        category: "trainer_change",
        title: `Roster Update: ${member.full_name}`,
        message: `${member.full_name} has completed a scheduled reassignment to another coaching tier.`,
        type: "info",
        entityType: "trainer_change_request",
        entityId: id,
        emailSubject: `FitPulse Roster Update: Member Transfer Notice`,
        emailBodyLines: [
          `Hello Coach ${currentTrainer.full_name},`,
          `This is an automated notification that member ${member.full_name} has transitioned to another coaching division.`,
          `Your schedule slots have been released. Thank you for your leadership and dedication.`,
        ],
      });

      // To New Trainer
      await createNotification({
        recipientUserId: newTrainer.id,
        category: "trainer_change",
        title: `New Athlete Assigned: ${member.full_name}`,
        message: `${member.full_name} has been assigned to your coaching squad. Review their fitness profile now.`,
        type: "success",
        entityType: "trainer_change_request",
        entityId: id,
        emailSubject: `FitPulse: New Athlete Added to Your Coaching Squad`,
        emailBodyLines: [
          `Hello Coach ${newTrainer.full_name},`,
          `Athlete ${member.full_name} has been officially transferred to your coaching roster.`,
          `You can view their training log, biomechanics history, and goals directly in your Coach Dashboard.`,
        ],
      });

      // Audit Log
      await logAudit({
        actorUserId: adminId,
        actorRole: "Admin",
        action: "APPROVE_AND_EXECUTE_TRAINER_CHANGE",
        entityType: "trainer_change_request",
        entityId: id,
        newState: {
          status: "Completed",
          newTrainerId: preferredTrainerId,
          creditMinor: calc.creditAmountMinor,
        },
      });

      broadcastEvent("request:updated", {
        requestId: id,
        status: "Completed",
        requestNumber: request.request_number,
        newTrainerName: newTrainer.full_name,
      });

      return res.status(200).json({
        success: true,
        status: "Completed",
        requiresPayment: false,
        message: `Trainer change successfully approved. Coach ${newTrainer.full_name} is now actively assigned.`,
      });
    }

    /* =========================================================================
       PATH 2: TRAINER REMOVAL REQUEST
    ========================================================================= */
    if (request.request_type === "trainer_remove_member") {
      // 1. Close active assignment
      await pool.query(
        `UPDATE trainer_assignments SET status = 'Ended', end_at = NOW(), notes = ?
         WHERE member_id = ? AND trainer_id = ? AND status = 'Active'`,
        [`Ended via approved removal request ${request.request_number}`, member.id, currentTrainer.id]
      );

      // 2. Unassign trainer from member
      await pool.query("UPDATE users SET trainer_id = NULL WHERE id = ?", [member.id]);

      // 3. Reconcile sessions (Mark as Rescheduling Required so slots are freed)
      await pool.query(
        `UPDATE trainer_sessions SET status = 'Rescheduling Required' 
         WHERE member_name = ? AND trainer_name = ? AND status = 'Confirmed'`,
        [member.full_name, currentTrainer.full_name]
      );

      // 4. Complete request
      await pool.query(
        `UPDATE trainer_change_requests SET
           status = 'Completed',
           reviewed_by_admin_id = ?,
           reviewed_at = NOW(),
           completed_at = NOW(),
           updated_at = NOW()
         WHERE id = ?`,
        [adminId, id]
      );

      // 5. Notifications
      // To Member (Gentle, professional notification; never exposes sensitive internal notes)
      await createNotification({
        recipientUserId: member.id,
        category: "trainer_change",
        title: "Coaching Roster Update",
        message: `Your training cycle with Coach ${currentTrainer.full_name} has concluded. You are free to select a new trainer at any time.`,
        type: "info",
        entityType: "trainer_change_request",
        entityId: id,
        emailSubject: `FitPulse: Coaching Cycle Update`,
        emailBodyLines: [
          `Hi ${member.full_name},`,
          `Your individual coaching cycle with Coach ${currentTrainer.full_name} has concluded.`,
          `Your membership access remains fully active. You may explore our coach directory and select a new trainer whenever you are ready.`,
        ],
      });

      // To Trainer
      await createNotification({
        recipientUserId: currentTrainer.id,
        category: "trainer_change",
        title: `Removal Approved (${request.request_number})`,
        message: `Admin approved your request to remove ${member.full_name}. Your roster and calendar have been updated.`,
        type: "success",
        entityType: "trainer_change_request",
        entityId: id,
      });

      // Audit Log
      await logAudit({
        actorUserId: adminId,
        actorRole: "Admin",
        action: "APPROVE_TRAINER_REMOVAL",
        entityType: "trainer_change_request",
        entityId: id,
        newState: { status: "Completed", memberId: member.id, trainerId: currentTrainer.id },
      });

      broadcastEvent("request:updated", {
        requestId: id,
        status: "Completed",
        requestNumber: request.request_number,
      });

      return res.status(200).json({
        success: true,
        status: "Completed",
        message: "Trainer removal request approved. Member has been cleanly unassigned and calendar reconciled.",
      });
    }

    /* =========================================================================
       PATH 3: MEMBER MEMBERSHIP PLAN CHANGE / UPGRADE
    ========================================================================= */
    if (request.request_type === "member_change_plan") {
      const requestedDuration = request.requested_plan_duration;
      const targetPlan = GYM_PLANS[requestedDuration];
      if (!targetPlan) {
        return res.status(400).json({ success: false, message: `Target plan ${requestedDuration} is invalid.` });
      }

      // Re-calculate plan upgrade difference server-side
      const planCalc = await calculatePlanChangeAdjustment(request.member_id, requestedDuration);
      const chargeINR = planCalc.proratedAdjustmentINR;

      if (chargeINR > 0) {
        // Upgrade requires prorated payment
        const orderId = `order_PC_${request.id}_${Date.now()}`;
        let paymentSessionId = null;

        try {
          const cfResponse = await fetch(`${CASHFREE_BASE_URL}/orders`, {
            method: "POST",
            headers: {
              "x-client-id": CASHFREE_APP_ID,
              "x-client-secret": CASHFREE_SECRET_KEY,
              "x-api-version": CASHFREE_API_VERSION,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              order_id: orderId,
              order_amount: Number(chargeINR),
              order_currency: "INR",
              customer_details: {
                customer_id: `cust_${member.id}`,
                customer_name: member.full_name || "FitPulse Member",
                customer_email: member.email || "member@fitpulse.com",
                customer_phone: member.phone || "9999999999",
              },
              order_meta: {
                return_url: `${process.env.CLIENT_URL || "http://localhost:5173"}/dashboard/plans?order_id=${orderId}&request_id=${request.id}`,
              },
              order_note: `FitPulse Membership Plan Upgrade - ${targetPlan.name} (${request.request_number})`,
            }),
          });
          const cfData = await cfResponse.json();
          if (cfResponse.ok && cfData.payment_session_id) {
            paymentSessionId = cfData.payment_session_id;
          }
        } catch (cfErr) {
          console.warn("[Cashfree PG] Error generating order during plan approval:", cfErr.message);
        }

        // Update Request to Awaiting Payment
        await pool.query(
          `UPDATE trainer_change_requests SET
             status = 'Awaiting Payment',
             plan_adjustment_inr = ?,
             reviewed_by_admin_id = ?,
             reviewed_at = NOW(),
             updated_at = NOW()
           WHERE id = ?`,
          [chargeINR, adminId, id]
        );

        // Insert pending payment record
        await pool.query(
          `INSERT INTO payments (
            order_id, user_id, user_name, user_email, payment_type, plan_name,
            amount, currency, payment_status, payment_method
          ) VALUES (?, ?, ?, ?, 'plan_change_adjustment', ?, ?, 'INR', 'PENDING', 'Cashfree PG')`,
          [
            orderId,
            member.id,
            member.full_name,
            member.email,
            `Prorated Upgrade (${targetPlan.name})`,
            chargeINR,
          ]
        );

        // Notify member
        await createNotification({
          recipientUserId: member.id,
          category: "payment",
          title: `Plan Upgrade Approved: Payment Required (${request.request_number})`,
          message: `Admin approved your switch to ${targetPlan.name}. Please settle the prorated upgrade difference of ₹${chargeINR} to activate your new plan.`,
          type: "payment",
          entityType: "plan_change_request",
          entityId: request.id,
          ctaText: `Pay ₹${chargeINR} & Activate Plan`,
          ctaUrl: `${process.env.CLIENT_URL || "http://localhost:5173"}/dashboard/plans?action=pay&order_id=${orderId}`,
        });

        broadcastEvent("request:updated", {
          requestId: id,
          status: "Awaiting Payment",
          requestNumber: request.request_number,
          chargeINR,
          planName: targetPlan.name,
        });

        return res.status(200).json({
          success: true,
          status: "Awaiting Payment",
          requiresPayment: true,
          chargeINR,
          orderId,
          paymentSessionId,
          message: `Plan upgrade approved. Member prompted to settle prorated difference of ₹${chargeINR}.`,
        });
      }

      // No payment required (downgrade / zero difference per gym non-refundable policy) -> Activate immediately!
      await pool.query(
        `UPDATE users SET
           gym_membership_active = 1,
           gym_membership_plan = ?,
           gym_membership_duration = ?,
           gym_membership_expires_at = DATE_ADD(NOW(), INTERVAL ? DAY)
         WHERE id = ?`,
        [targetPlan.name, targetPlan.durationKey, targetPlan.days, member.id]
      );

      await pool.query(
        `UPDATE trainer_change_requests SET
           status = 'Completed',
           plan_adjustment_inr = 0,
           reviewed_by_admin_id = ?,
           reviewed_at = NOW(),
           completed_at = NOW(),
           updated_at = NOW()
         WHERE id = ?`,
        [adminId, id]
      );

      // Notify member
      await createNotification({
        recipientUserId: member.id,
        category: "general",
        title: `Plan Change Active (${request.request_number})`,
        message: `Admin approved your membership plan change! Your account is now upgraded to ${targetPlan.name}.`,
        type: "general",
        entityType: "plan_change_request",
        entityId: request.id,
      });

      broadcastEvent("request:updated", {
        requestId: id,
        status: "Completed",
        requestNumber: request.request_number,
      });
      broadcastEvent("membership:updated", {
        memberId: member.id,
        planName: targetPlan.name,
      });

      return res.status(200).json({
        success: true,
        status: "Completed",
        requiresPayment: false,
        message: `Plan change approved and activated immediately for ${member.full_name}.`,
      });
    }

    return res.status(400).json({ success: false, message: "Unrecognized request type." });
  } catch (error) {
    console.error("Error approving change request:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to approve request." });
  }
};

/**
 * ONE-CLICK ADMIN REJECTION
 */
export const rejectChangeRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.body.adminId || req.user?.id || 1;
    const rejectionReason = req.body.rejectionReason || "Request could not be accommodated at this time due to scheduling or policy limits.";

    const [[request]] = await pool.query("SELECT * FROM trainer_change_requests WHERE id = ?", [id]);
    if (!request) {
      return res.status(404).json({ success: false, message: "Request not found." });
    }

    if (!["Submitted", "Under Review", "Action Required"].includes(request.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot reject request with status "${request.status}".`,
      });
    }

    await pool.query(
      `UPDATE trainer_change_requests SET
         status = 'Rejected',
         reviewed_by_admin_id = ?,
         reviewed_at = NOW(),
         rejection_reason = ?,
         updated_at = NOW()
       WHERE id = ?`,
      [adminId, rejectionReason, id]
    );

    // Cancel pending billing adjustment
    if (request.billing_adjustment_id) {
      await pool.query(
        "UPDATE trainer_change_billing_adjustments SET status = 'Waived' WHERE id = ? AND status = 'Pending'",
        [request.billing_adjustment_id]
      );
    }

    // Notify Initiator
    await createNotification({
      recipientUserId: request.initiated_by_user_id,
      category: "trainer_change",
      title: `Request Not Approved (${request.request_number})`,
      message: `Your request was reviewed by gym administration. Reason: ${rejectionReason}`,
      type: "alert",
      entityType: "trainer_change_request",
      entityId: id,
      emailSubject: `FitPulse: Request Status Update [${request.request_number}]`,
      emailBodyLines: [
        `Gym administration has reviewed request #${request.request_number}.`,
        `Outcome: Not Approved`,
        `Feedback: ${rejectionReason}`,
        `Your active assignments remain unchanged. Feel free to contact the front desk for further assistance.`,
      ],
    });

    // Audit Log
    await logAudit({
      actorUserId: adminId,
      actorRole: "Admin",
      action: "REJECT_CHANGE_REQUEST",
      entityType: "trainer_change_request",
      entityId: id,
      newState: { status: "Rejected", rejectionReason },
    });

    broadcastEvent("request:updated", {
      requestId: id,
      status: "Rejected",
      requestNumber: request.request_number,
    });

    return res.status(200).json({ success: true, status: "Rejected", message: "Request has been rejected." });
  } catch (error) {
    console.error("Error rejecting request:", error);
    return res.status(500).json({ success: false, message: "Internal server error rejecting request." });
  }
};

/* ==========================================================================
   04. SETTLEMENT & CASHFREE ORDER VERIFICATION FOR UPGRADES
========================================================================== */

/**
 * Generate Cashfree Order for an Awaiting Payment change request.
 */
export const createAdjustmentPaymentOrder = async (req, res) => {
  try {
    const { requestId, memberId = 1 } = req.body;

    const [[request]] = await pool.query(
      `SELECT r.*, ba.charge_amount_minor, ba.final_adjustment_minor, ba.id as adj_id,
              m.full_name as member_name, m.email as member_email, m.phone as member_phone,
              pt.full_name as new_trainer_name
       FROM trainer_change_requests r
       JOIN trainer_change_billing_adjustments ba ON r.billing_adjustment_id = ba.id
       JOIN users m ON r.member_id = m.id
       JOIN users pt ON r.preferred_trainer_id = pt.id
       WHERE r.id = ? AND r.member_id = ?`,
      [requestId, memberId]
    );

    if (!request) {
      return res.status(404).json({ success: false, message: "Awaiting payment request not found." });
    }

    if (request.status !== "Awaiting Payment") {
      return res.status(400).json({ success: false, message: `Request is not awaiting payment (status: ${request.status}).` });
    }

    const chargeINR = Number((request.charge_amount_minor / 100).toFixed(2));
    const orderId = `order_TC_${request.id}_${Date.now()}`;

    // Create Cashfree Order
    let paymentSessionId = null;
    let cfOrderId = null;

    try {
      const cfResponse = await fetch(`${CASHFREE_BASE_URL}/orders`, {
        method: "POST",
        headers: {
          "x-client-id": CASHFREE_APP_ID,
          "x-client-secret": CASHFREE_SECRET_KEY,
          "x-api-version": CASHFREE_API_VERSION,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          order_id: orderId,
          order_amount: chargeINR,
          order_currency: "INR",
          customer_details: {
            customer_id: `cust_${request.member_id}`,
            customer_name: request.member_name || "FitPulse Member",
            customer_email: request.member_email || "member@fitpulse.com",
            customer_phone: request.member_phone || "9999999999",
          },
          order_meta: {
            return_url: `${process.env.CLIENT_URL || "http://localhost:5173"}/dashboard/trainer?order_id=${orderId}&request_id=${request.id}`,
          },
          order_note: `FitPulse Coach Upgrade Settlement - Coach ${request.new_trainer_name}`,
        }),
      });

      const cfData = await cfResponse.json();
      if (cfResponse.ok) {
        paymentSessionId = cfData.payment_session_id;
        cfOrderId = cfData.cf_order_id;
      }
    } catch (cfErr) {
      console.warn("Cashfree create order warning:", cfErr);
    }

    // Update adjustment payment_order_id
    await pool.query("UPDATE trainer_change_billing_adjustments SET payment_order_id = ? WHERE id = ?", [
      orderId,
      request.adj_id,
    ]);

    // Insert payment record
    await pool.query(
      `INSERT INTO payments (
        order_id, cf_order_id, user_id, user_name, user_email, payment_type, plan_name,
        trainer_id, trainer_name, amount, currency, payment_status, payment_method
      ) VALUES (?, ?, ?, ?, ?, 'trainer_change_adjustment', ?, ?, ?, ?, 'INR', 'PENDING', 'Cashfree PG')`,
      [
        orderId,
        cfOrderId,
        request.member_id,
        request.member_name,
        request.member_email,
        `Prorated Upgrade Fee (${request.new_trainer_name})`,
        request.preferred_trainer_id,
        request.new_trainer_name,
        chargeINR,
      ]
    );

    return res.status(200).json({
      success: true,
      orderId,
      cfOrderId,
      paymentSessionId,
      amount: chargeINR,
      currency: "INR",
      requestNumber: request.request_number,
      newTrainerName: request.new_trainer_name,
    });
  } catch (error) {
    console.error("Error creating adjustment payment order:", error);
    return res.status(500).json({ success: false, message: "Internal server error creating payment order." });
  }
};

/**
 * Verify Cashfree Payment and finalize the coach transfer.
 */
export const verifyAdjustmentPayment = async (req, res) => {
  try {
    const { orderId, simulateSuccess = false } = req.body;

    if (!orderId) {
      return res.status(400).json({ success: false, message: "orderId is required." });
    }

    // Fetch adjustment and request linked to orderId
    let [[adjustment]] = await pool.query(
      `SELECT ba.*, r.id as request_id, r.request_number, r.request_type, r.member_id, r.current_trainer_id, r.preferred_trainer_id, r.status as req_status
       FROM trainer_change_billing_adjustments ba
       JOIN trainer_change_requests r ON ba.request_id = r.id
       WHERE ba.payment_order_id = ?`,
      [orderId]
    );

    // If not found in trainer billing adjustments, check if it's a plan change request order
    let planRequest = null;
    if (!adjustment) {
      const [[pReq]] = await pool.query(
        `SELECT r.*, p.amount as payment_amount, p.plan_name as payment_plan_name
         FROM trainer_change_requests r
         JOIN payments p ON p.order_id = ?
         WHERE r.request_type = 'member_change_plan'
           AND (p.order_id = ? OR r.request_number = p.plan_name)`,
        [orderId, orderId]
      );
      if (pReq) {
        planRequest = pReq;
      }
    }

    if (!adjustment && !planRequest) {
      return res.status(404).json({ success: false, message: "No adjustment or plan change found for this payment order." });
    }

    if (adjustment && adjustment.status === "Paid" && adjustment.req_status === "Completed") {
      return res.status(200).json({ success: true, message: "Payment already verified and coach transfer completed." });
    }

    if (planRequest && planRequest.status === "Completed") {
      return res.status(200).json({ success: true, message: "Payment already verified and plan change activated." });
    }

    // Cashfree Status Check
    let isPaid = simulateSuccess;
    try {
      const cfRes = await fetch(`${CASHFREE_BASE_URL}/orders/${orderId}`, {
        headers: {
          "x-client-id": CASHFREE_APP_ID,
          "x-client-secret": CASHFREE_SECRET_KEY,
          "x-api-version": CASHFREE_API_VERSION,
        },
      });
      if (cfRes.ok) {
        const cfData = await cfRes.json();
        if (cfData.order_status === "PAID") {
          isPaid = true;
        }
      }
    } catch (cfErr) {
      console.warn("Cashfree verification warning:", cfErr);
    }

    if (!isPaid) {
      return res.status(400).json({ success: false, message: "Payment has not been completed on Cashfree gateway." });
    }

    // Mark payment record as PAID
    await pool.query("UPDATE payments SET payment_status = 'PAID', payment_time = NOW() WHERE order_id = ?", [orderId]);

    /* =========================================================================
       SUB-CASE: PLAN CHANGE UPGRADE PAYMENT VERIFICATION
    ========================================================================= */
    if (planRequest) {
      const targetPlan = GYM_PLANS[planRequest.requested_plan_duration];
      if (targetPlan) {
        await pool.query(
          `UPDATE users SET
             gym_membership_active = 1,
             gym_membership_plan = ?,
             gym_membership_duration = ?,
             gym_membership_expires_at = DATE_ADD(NOW(), INTERVAL ? DAY)
           WHERE id = ?`,
          [targetPlan.name, targetPlan.durationKey, targetPlan.days, planRequest.member_id]
        );
      }

      await pool.query(
        "UPDATE trainer_change_requests SET status = 'Completed', completed_at = NOW(), updated_at = NOW() WHERE id = ?",
        [planRequest.id]
      );

      const [[member]] = await pool.query("SELECT full_name FROM users WHERE id = ?", [planRequest.member_id]);

      await createNotification({
        recipientUserId: planRequest.member_id,
        category: "payment",
        title: "Plan Upgrade Settlement Confirmed",
        message: `Your payment of ₹${planRequest.plan_adjustment_inr || planRequest.payment_amount} was successful. ${targetPlan?.name || "Your new membership plan"} is now active!`,
        type: "success",
        entityType: "plan_change_request",
        entityId: planRequest.id,
      });

      broadcastEvent("request:updated", {
        requestId: planRequest.id,
        status: "Completed",
        requestNumber: planRequest.request_number,
        planName: targetPlan?.name,
      });
      broadcastEvent("membership:updated", {
        memberId: planRequest.member_id,
        planName: targetPlan?.name,
      });

      return res.status(200).json({
        success: true,
        message: "Payment verified successfully. Membership plan upgrade is now active!",
        newPlanName: targetPlan?.name,
      });
    }

    /* =========================================================================
       SUB-CASE: TRAINER CHANGE ADJUSTMENT PAYMENT VERIFICATION
    ========================================================================= */
    // 2. Mark billing adjustment as Paid
    await pool.query("UPDATE trainer_change_billing_adjustments SET status = 'Paid', updated_at = NOW() WHERE id = ?", [
      adjustment.id,
    ]);

    // 3. Close old assignment
    await pool.query(
      `UPDATE trainer_assignments SET status = 'Transferred', end_at = NOW()
       WHERE member_id = ? AND trainer_id = ? AND status = 'Active'`,
      [adjustment.member_id, adjustment.current_trainer_id]
    );

    // 4. Create new active assignment
    await pool.query(
      `INSERT INTO trainer_assignments (member_id, trainer_id, status, start_at, source_request_id, notes)
       VALUES (?, ?, 'Active', NOW(), ?, ?)`,
      [
        adjustment.member_id,
        adjustment.preferred_trainer_id,
        adjustment.request_id,
        `Transferred via paid adjustment ${adjustment.request_number}`,
      ]
    );

    // 5. Update user's trainer_id
    await pool.query("UPDATE users SET trainer_id = ? WHERE id = ?", [
      adjustment.preferred_trainer_id,
      adjustment.member_id,
    ]);

    // 6. Complete the request
    await pool.query(
      "UPDATE trainer_change_requests SET status = 'Completed', completed_at = NOW(), updated_at = NOW() WHERE id = ?",
      [adjustment.request_id]
    );

    // 7. Reconcile sessions
    const [[newTrainer]] = await pool.query("SELECT full_name FROM users WHERE id = ?", [adjustment.preferred_trainer_id]);
    const [[currentTrainer]] = await pool.query("SELECT full_name FROM users WHERE id = ?", [adjustment.current_trainer_id]);
    const [[member]] = await pool.query("SELECT full_name, email FROM users WHERE id = ?", [adjustment.member_id]);

    await pool.query(
      `UPDATE trainer_sessions SET trainer_name = ? 
       WHERE member_name = ? AND trainer_name = ? AND status = 'Confirmed'`,
      [newTrainer?.full_name, member?.full_name, currentTrainer?.full_name]
    );

    // 8. Notifications
    await createNotification({
      recipientUserId: adjustment.member_id,
      category: "trainer_change",
      title: "Settlement Confirmed • Transfer Active",
      message: `Your payment of ₹${adjustment.charge_amount_minor / 100} was successful. Coach ${newTrainer?.full_name} is now your active personal trainer!`,
      type: "success",
      entityType: "trainer_change_request",
      entityId: adjustment.request_id,
    });

    await createNotification({
      recipientUserId: adjustment.preferred_trainer_id,
      category: "trainer_change",
      title: `New Athlete Assigned: ${member?.full_name}`,
      message: `${member?.full_name} has finalized settlement and joined your squad.`,
      type: "success",
      entityType: "trainer_change_request",
      entityId: adjustment.request_id,
    });

    // Audit Log
    await logAudit({
      actorUserId: adjustment.member_id,
      actorRole: "Member",
      action: "COMPLETE_PRORATED_UPGRADE_PAYMENT",
      entityType: "trainer_change_request",
      entityId: adjustment.request_id,
      newState: { orderId, status: "Completed", newTrainerId: adjustment.preferred_trainer_id },
    });

    broadcastEvent("request:updated", {
      requestId: adjustment.request_id,
      status: "Completed",
      requestNumber: adjustment.request_number,
      newTrainerName: newTrainer?.full_name,
    });

    return res.status(200).json({
      success: true,
      message: "Payment verified successfully. Coach transfer is now fully active.",
      newTrainerName: newTrainer?.full_name,
    });
  } catch (error) {
    console.error("Error verifying adjustment payment:", error);
    return res.status(500).json({ success: false, message: "Internal server error verifying payment." });
  }
};

/* ==========================================================================
   04. MEMBERSHIP PLAN CHANGE CONTROLLERS
========================================================================== */

/**
 * Calculate preview for membership plan change / upgrade.
 */
export const getPlanChangePreview = async (req, res) => {
  try {
    const memberId = req.body?.memberId || req.query?.memberId;
    const requestedDuration = req.body?.requestedDuration || req.query?.requestedDuration;
    if (!memberId || !requestedDuration) {
      return res.status(400).json({ success: false, message: "memberId and requestedDuration are required." });
    }

    const calculation = await calculatePlanChangeAdjustment(memberId, requestedDuration);
    return res.status(200).json({ success: true, calculation });
  } catch (error) {
    console.error("Error calculating plan change preview:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to calculate plan preview." });
  }
};

/**
 * Submit Membership Plan Change Request.
 */
export const submitPlanChangeRequest = async (req, res) => {
  try {
    const { memberId, requestedDuration, reason = "Athletic progression / goal upgrade", isConfidential = false } = req.body;

    if (!memberId || !requestedDuration) {
      return res.status(400).json({ success: false, message: "memberId and requestedDuration are required." });
    }

    const [[member]] = await pool.query("SELECT * FROM users WHERE id = ?", [memberId]);
    if (!member) {
      return res.status(404).json({ success: false, message: "Member not found." });
    }

    // Check for existing pending plan change requests
    const [pending] = await pool.query(
      "SELECT id FROM trainer_change_requests WHERE member_id = ? AND request_type = 'member_change_plan' AND status IN ('Submitted', 'Under Review', 'Awaiting Payment')",
      [memberId]
    );
    if (pending.length > 0) {
      return res.status(409).json({
        success: false,
        message: "You already have a pending membership plan change request under administrative review.",
      });
    }

    const calc = await calculatePlanChangeAdjustment(memberId, requestedDuration);
    const requestNumber = `PCR-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

    const [result] = await pool.query(
      `INSERT INTO trainer_change_requests (
        request_number, request_type, initiated_by_user_id, member_id,
        current_plan_duration, requested_plan_duration, plan_adjustment_inr,
        reason_code, description, is_confidential, status, effective_at, created_at
      ) VALUES (?, 'member_change_plan', ?, ?, ?, ?, ?, ?, ?, ?, 'Submitted', NOW(), NOW())`,
      [
        requestNumber,
        memberId,
        memberId,
        calc.currentPlan.durationKey,
        requestedDuration,
        calc.proratedAdjustmentINR,
        reason,
        calc.explanation,
        isConfidential ? 1 : 0,
      ]
    );

    const newRequestId = result.insertId;

    // Notify Gym Administrators
    const [admins] = await pool.query("SELECT id FROM users WHERE role = 'Admin'");
    for (const adm of admins) {
      await createNotification({
        recipientUserId: adm.id,
        category: "request",
        title: `New Plan Upgrade Request (${requestNumber})`,
        message: `${member.full_name} submitted a request to switch plan to ${calc.newPlan.name} (Prorated Adjustment: ₹${calc.proratedAdjustmentINR}).`,
        type: "request",
        entityType: "plan_change_request",
        entityId: newRequestId,
      });
    }

    // Notify Member of successful submission
    await createNotification({
      recipientUserId: memberId,
      category: "general",
      title: `Plan Change Request Submitted (${requestNumber})`,
      message: `Your request to transition to ${calc.newPlan.name} is now queued for administrative approval. Prorated difference: ₹${calc.proratedAdjustmentINR}.`,
      type: "info",
      entityType: "plan_change_request",
      entityId: newRequestId,
    });

    broadcastEvent("request:created", {
      requestId: newRequestId,
      requestNumber,
      requestType: "member_change_plan",
      memberName: member.full_name,
      planAdjustmentINR: calc.proratedAdjustmentINR,
      status: "Submitted",
    });

    return res.status(201).json({
      success: true,
      request: {
        id: newRequestId,
        request_number: requestNumber,
        request_type: "member_change_plan",
        current_plan_duration: calc.currentPlan.durationKey,
        requested_plan_duration: requestedDuration,
        plan_adjustment_inr: calc.proratedAdjustmentINR,
        status: "Submitted",
        calculation: calc,
      },
      message: "Membership plan change request submitted successfully for administrator approval.",
    });
  } catch (error) {
    console.error("Error submitting plan change request:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to submit plan change request." });
  }
};

/**
 * Fetch member's plan change requests.
 */
export const getMemberPlanChangeRequests = async (req, res) => {
  try {
    const memberId = req.params.memberId || req.query.memberId || 1;
    const [requests] = await pool.query(
      `SELECT r.*,
              adm.full_name as reviewed_by_name
       FROM trainer_change_requests r
       LEFT JOIN users adm ON r.reviewed_by_admin_id = adm.id
       WHERE r.member_id = ? AND r.request_type = 'member_change_plan'
       ORDER BY r.id DESC`,
      [memberId]
    );

    return res.status(200).json({ success: true, requests });
  } catch (error) {
    console.error("Error fetching member plan change requests:", error);
    return res.status(500).json({ success: false, message: "Internal server error fetching plan requests." });
  }
};

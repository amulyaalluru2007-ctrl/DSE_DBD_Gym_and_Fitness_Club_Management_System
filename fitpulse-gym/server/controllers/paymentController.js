import { pool } from "../config/db.js";
import { broadcastEvent } from "../socket.js";
import { createNotification } from "../services/notificationService.js";

const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID || "TEST11229889069c15c0e7ceb1c81ce998892211";
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY || "";
const CASHFREE_API_VERSION = process.env.CASHFREE_API_VERSION || "2023-08-01";
const CASHFREE_BASE_URL = "https://sandbox.cashfree.com/pg";

// 4 Indian Rupee Gym Plans
export const GYM_PLANS = {
  "1_month": {
    durationKey: "1_month",
    name: "1 Month Gym Membership",
    price: 1499.00,
    days: 30,
    desc: "30 Days Full Campus Access • Turnstile Face ID & Dynamic MFA",
  },
  "3_months": {
    durationKey: "3_months",
    name: "3 Months Gym Membership",
    price: 3999.00,
    days: 90,
    desc: "90 Days Full Campus Access • Most Popular Quarter Pass",
  },
  "6_months": {
    durationKey: "6_months",
    name: "6 Months Gym Membership",
    price: 6999.00,
    days: 180,
    desc: "180 Days Full Campus Access • Semi-Annual Athlete Package",
  },
  "1_year": {
    durationKey: "1_year",
    name: "1 Year Gym Membership",
    price: 11999.00,
    days: 365,
    desc: "365 Days Unrestricted Campus Access • Best Annual Value",
  },
};

export const TRAINER_MONTHLY_FEE = 2999.00;

export const sanitizeCashfreePhone = (phone) => {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return "9999999999";
};

/* =====================================================
   01. CREATE CASHFREE PAYMENT ORDER
===================================================== */
export const createCashfreeOrder = async (req, res) => {
  try {
    const {
      userId = 1,
      paymentType = "gym_membership", // 'gym_membership' | 'trainer_fee'
      planDuration = "1_month",       // '1_month' | '3_months' | '6_months' | '1_year'
      trainerId = null,
      customerPhone = "9999999999",
    } = req.body;

    // Fetch User Info
    const [[user]] = await pool.query(
      `SELECT id, full_name, email, phone, gym_membership_active, gym_membership_expires_at 
       FROM users WHERE id = ?`,
      [userId]
    );

    if (!user) {
      return res.status(404).json({ success: false, message: "Member user not found." });
    }

    // STRICT RULE: User MUST pay for Gym before paying for a Trainer!
    if (paymentType === "trainer_fee") {
      const isGymActive =
        user.gym_membership_active === 1 &&
        user.gym_membership_expires_at &&
        new Date(user.gym_membership_expires_at) > new Date();

      if (!isGymActive) {
        return res.status(400).json({
          success: false,
          requiresGymMembership: true,
          message:
            "Rule Requirement: You must have an active paid Gym Membership before hiring or paying for a Personal Trainer.",
        });
      }

      if (!trainerId) {
        return res.status(400).json({ success: false, message: "Trainer ID is required for trainer fee payment." });
      }
    }

    // Determine Amount, Plan Name, Order Note
    let amount = 0;
    let planName = "";
    let trainerName = null;

    if (paymentType === "gym_membership") {
      const selectedPlan = GYM_PLANS[planDuration] || GYM_PLANS["1_month"];
      amount = selectedPlan.price;
      planName = selectedPlan.name;
    } else {
      // Trainer Fee
      const [[coach]] = await pool.query("SELECT id, full_name, specialty FROM users WHERE id = ?", [trainerId]);
      if (!coach) {
        return res.status(404).json({ success: false, message: "Coach not found." });
      }
      trainerName = coach.full_name;
      amount = TRAINER_MONTHLY_FEE;
      planName = `1-on-1 Coaching Retainer (${trainerName})`;
    }

    // Generate unique Cashfree Order ID
    const orderId = `order_FP_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

    const returnUrl = `${process.env.CLIENT_URL || "http://localhost:5173"}/dashboard/plans?order_id=${orderId}`;

    const cashfreePayload = {
      order_id: orderId,
      order_amount: Number(amount),
      order_currency: "INR",
      customer_details: {
        customer_id: `cust_${user.id}`,
        customer_name: user.full_name || "FitPulse Member",
        customer_email: user.email || "member@fitpulse.com",
        customer_phone: sanitizeCashfreePhone(customerPhone || user.phone),
      },
      order_meta: {
        return_url: returnUrl,
      },
      order_note: `FitPulse Gym - ${planName}`,
    };

    console.log(`[Cashfree API] Creating order "${orderId}" for ${amount} INR...`);

    const cfResponse = await fetch(`${CASHFREE_BASE_URL}/orders`, {
      method: "POST",
      headers: {
        "x-client-id": CASHFREE_APP_ID,
        "x-client-secret": CASHFREE_SECRET_KEY,
        "x-api-version": CASHFREE_API_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(cashfreePayload),
    });

    const cfData = await cfResponse.json();

    if (!cfResponse.ok || !cfData.payment_session_id) {
      console.error("[Cashfree API Error]:", cfData);
      return res.status(502).json({
        success: false,
        message: cfData.message || "Failed to initiate Cashfree payment session.",
        error: cfData,
      });
    }

    // Save pending payment record in MySQL
    await pool.query(
      `INSERT INTO payments (
        order_id, cf_order_id, user_id, user_name, user_email,
        payment_type, plan_duration, plan_name, trainer_id, trainer_name,
        amount, currency, payment_status, payment_method, raw_response
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'INR', 'PENDING', 'Cashfree PG', ?)`,
      [
        orderId,
        cfData.cf_order_id || null,
        user.id,
        user.full_name,
        user.email,
        paymentType,
        planDuration,
        planName,
        trainerId,
        trainerName,
        amount,
        JSON.stringify(cfData),
      ]
    );

    return res.status(200).json({
      success: true,
      orderId,
      cfOrderId: cfData.cf_order_id,
      paymentSessionId: cfData.payment_session_id,
      amount,
      currency: "INR",
      planName,
      planDuration,
      paymentType,
      trainerId,
      trainerName,
      user: {
        id: user.id,
        name: user.full_name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Cashfree create order error:", error);
    return res.status(500).json({ success: false, message: "Internal server error creating Cashfree order." });
  }
};

/* =====================================================
   02. VERIFY CASHFREE PAYMENT & ACTIVATE MEMBERSHIP / TRAINER
===================================================== */
export const verifyCashfreeOrder = async (req, res) => {
  try {
    const { orderId, simulateSuccess = false } = req.body;

    if (!orderId) {
      return res.status(400).json({ success: false, message: "orderId is required." });
    }

    // Fetch existing payment record
    const [[payment]] = await pool.query("SELECT * FROM payments WHERE order_id = ?", [orderId]);
    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment order not found in database." });
    }

    // If already marked as PAID, return cached successful state
    if (payment.payment_status === "PAID") {
      return res.status(200).json({
        success: true,
        alreadyProcessed: true,
        message: "Payment already verified and active.",
        payment,
      });
    }

    // Query Cashfree live order status
    let orderStatus = "PENDING";
    let cfPaymentId = `cf_pay_${Date.now()}`;
    let paymentMethod = "Cashfree PG • UPI / NetBanking";

    try {
      const cfRes = await fetch(`${CASHFREE_BASE_URL}/orders/${orderId}`, {
        method: "GET",
        headers: {
          "x-client-id": CASHFREE_APP_ID,
          "x-client-secret": CASHFREE_SECRET_KEY,
          "x-api-version": CASHFREE_API_VERSION,
        },
      });

      if (cfRes.ok) {
        const cfOrder = await cfRes.json();
        orderStatus = cfOrder.order_status;
        console.log(`[Cashfree Verification] Order ${orderId} live status: "${orderStatus}"`);
      }
    } catch (cfErr) {
      console.warn("Cashfree API status check warning:", cfErr);
    }

    // In sandbox test mode, if simulateSuccess is passed or order is PAID:
    const isPaid = orderStatus === "PAID" || simulateSuccess === true;

    if (!isPaid) {
      return res.status(200).json({
        success: false,
        paymentStatus: orderStatus,
        message: `Order status is "${orderStatus}". Payment has not been finalized yet.`,
      });
    }

    // Calculate Expiry Date based on Plan Duration
    let daysToAdd = 30;
    if (payment.payment_type === "gym_membership") {
      const planConfig = GYM_PLANS[payment.plan_duration] || GYM_PLANS["1_month"];
      daysToAdd = planConfig.days;
    } else {
      daysToAdd = 30; // Trainer retainer is 30 days
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + daysToAdd);
    const renewalDateFormatted = expiresAt.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    // Update payment record to PAID
    await pool.query(
      `UPDATE payments 
       SET payment_status = 'PAID', 
           cf_payment_id = ?, 
           payment_method = ?, 
           payment_time = NOW(), 
           expires_at = ? 
       WHERE order_id = ?`,
      [cfPaymentId, paymentMethod, expiresAt, orderId]
    );

    // Record invoice in invoices table for accounting
    const invCode = `INV-${orderId.slice(-8)}`;
    await pool.query(
      `INSERT INTO invoices (user_id, invoice_code, amount, status, payment_date)
       VALUES (?, ?, ?, 'Paid', DATE_FORMAT(NOW(), '%b %d, %Y'))`,
      [payment.user_id, invCode, `₹${Number(payment.amount).toLocaleString("en-IN")}`]
    );

    // If Gym Membership Payment:
    if (payment.payment_type === "gym_membership") {
      // Activate gym membership for the user
      await pool.query(
        `UPDATE users 
         SET gym_membership_active = 1,
             gym_membership_plan = ?,
             gym_membership_duration = ?,
             gym_membership_expires_at = ?,
             gym_membership_paid_at = NOW()
         WHERE id = ?`,
        [payment.plan_name, payment.plan_duration, expiresAt, payment.user_id]
      );

      // Update memberships table
      await pool.query(
        `UPDATE memberships 
         SET status = 'Active', 
             plan_name = ?, 
             price_monthly = ?, 
             renewal_date = ?, 
             payment_method = ? 
         WHERE user_id = ?`,
        [payment.plan_name, payment.amount, renewalDateFormatted, paymentMethod, payment.user_id]
      );

      // WebSocket broadcast for real-time telemetry
      const paymentPayload = {
        orderId,
        invoiceCode: invCode,
        userId: payment.user_id,
        userName: payment.user_name,
        amount: `₹${Number(payment.amount).toLocaleString("en-IN")}`,
        planName: payment.plan_name,
        planDuration: payment.plan_duration,
        expiresAt: expiresAt.toISOString(),
        renewalDate: renewalDateFormatted,
        type: "gym_membership",
        status: "Active",
      };

      broadcastEvent("payment:success", paymentPayload);
      broadcastEvent("membership:updated", paymentPayload);
      broadcastEvent("notification:new", {
        type: "payment",
        title: "Gym Membership Activated",
        message: `Payment of ₹${Number(payment.amount).toLocaleString("en-IN")} via Cashfree verified. Turnstile Face ID & Dynamic MFA gates unlocked until ${renewalDateFormatted}! 🔥`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });

      // Dispatch durable in-app & email notification to member
      try {
        await createNotification({
          recipientUserId: payment.user_id,
          category: "payment",
          title: "Gym Membership Activated",
          message: `Payment of ₹${Number(payment.amount).toLocaleString("en-IN")} via Cashfree verified. Turnstile Face ID & Dynamic MFA gates unlocked until ${renewalDateFormatted}! 🔥`,
          type: "payment",
          entityType: "payment",
          entityId: orderId,
        });

        // Also notify assigned trainer if member has one
        const [[mUser]] = await pool.query("SELECT trainer_id FROM users WHERE id = ?", [payment.user_id]);
        if (mUser?.trainer_id) {
          await createNotification({
            recipientUserId: mUser.trainer_id,
            category: "payment",
            title: `Athlete Membership Renewed: ${payment.user_name}`,
            message: `Your assigned athlete ${payment.user_name} has renewed their Gym Membership (${payment.plan_name}). Facility access active until ${renewalDateFormatted}.`,
            type: "info",
            entityType: "payment",
            entityId: orderId,
          });
        }
      } catch (payNotifErr) {
        console.warn("Gym payment notification error:", payNotifErr);
      }
    } else {
      // Trainer Fee Payment:
      await pool.query(
        `UPDATE users 
         SET trainer_id = ?, 
             trainer_fee_paid = 1, 
             trainer_fee_expires_at = ? 
         WHERE id = ?`,
        [payment.trainer_id, expiresAt, payment.user_id]
      );

      // Release previous active coach assignments and insert new active assignment
      await pool.query(
        "UPDATE trainee_assignments SET status = 'Released' WHERE member_id = ? AND status = 'Active'",
        [payment.user_id]
      );
      await pool.query(
        "INSERT INTO trainee_assignments (trainer_id, member_id, status, assigned_at) VALUES (?, ?, 'Active', NOW())",
        [payment.trainer_id, payment.user_id]
      );

      const trainerPayload = {
        orderId,
        invoiceCode: invCode,
        memberId: payment.user_id,
        memberName: payment.user_name,
        trainerId: payment.trainer_id,
        trainerName: payment.trainer_name,
        amount: `₹${Number(payment.amount).toLocaleString("en-IN")}`,
        expiresAt: expiresAt.toISOString(),
        renewalDate: renewalDateFormatted,
        type: "trainer_fee",
      };

      broadcastEvent("payment:success", trainerPayload);
      broadcastEvent("trainee:assigned", trainerPayload);
      broadcastEvent("trainer:payment_received", trainerPayload);
      broadcastEvent("notification:new", {
        type: "coach",
        title: "Personal Trainer Subscribed",
        message: `Coaching fee of ₹${Number(payment.amount).toLocaleString("en-IN")} for Coach ${payment.trainer_name} paid via Cashfree. 1-on-1 private coaching channel active!`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });

      // Dispatch durable notifications to both Member and Trainer
      try {
        await createNotification({
          recipientUserId: payment.user_id,
          category: "payment",
          title: "Personal Trainer Retainer Confirmed",
          message: `Coaching retainer of ₹${Number(payment.amount).toLocaleString("en-IN")} for Coach ${payment.trainer_name} paid via Cashfree. 1-on-1 private coaching active until ${renewalDateFormatted}!`,
          type: "payment",
          entityType: "payment",
          entityId: orderId,
        });

        await createNotification({
          recipientUserId: payment.trainer_id,
          category: "payment",
          title: `Coaching Retainer Received: ${payment.user_name}`,
          message: `Athlete ${payment.user_name} has paid their monthly personal coaching fee of ₹${Number(payment.amount).toLocaleString("en-IN")}. 1-on-1 coaching channel active until ${renewalDateFormatted}.`,
          type: "payment",
          entityType: "payment",
          entityId: orderId,
        });
      } catch (trainerPayErr) {
        console.warn("Trainer payment notification error:", trainerPayErr);
      }
    }

    return res.status(200).json({
      success: true,
      message: "Payment successfully verified and activated via Cashfree!",
      payment: {
        orderId,
        paymentStatus: "PAID",
        paymentType: payment.payment_type,
        amount: payment.amount,
        planName: payment.plan_name,
        planDuration: payment.plan_duration,
        expiresAt: expiresAt.toISOString(),
        renewalDate: renewalDateFormatted,
      },
    });
  } catch (error) {
    console.error("Cashfree verify order error:", error);
    return res.status(500).json({ success: false, message: "Error verifying Cashfree order." });
  }
};

/* =====================================================
   03. GET USER MEMBERSHIP & PAYMENT STATUS
===================================================== */
export const getUserMembershipStatus = async (req, res) => {
  try {
    const { userId = 1 } = req.params;

    const [[user]] = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.role, 
              u.gym_membership_active, u.gym_membership_plan, u.gym_membership_duration,
              u.gym_membership_expires_at, u.gym_membership_paid_at,
              u.trainer_id, u.trainer_fee_paid, u.trainer_fee_expires_at,
              c.full_name as trainer_name, c.specialty as trainer_specialty, c.avatar_url as trainer_avatar
       FROM users u
       LEFT JOIN users c ON u.trainer_id = c.id
       WHERE u.id = ?`,
      [userId]
    );

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const now = new Date();
    const gymExpires = user.gym_membership_expires_at ? new Date(user.gym_membership_expires_at) : null;
    const isGymActive = user.gym_membership_active === 1 && gymExpires && gymExpires > now;

    let daysRemaining = 0;
    if (isGymActive && gymExpires) {
      daysRemaining = Math.max(0, Math.ceil((gymExpires - now) / (1000 * 60 * 60 * 24)));
    }

    const trainerExpires = user.trainer_fee_expires_at ? new Date(user.trainer_fee_expires_at) : null;
    const isTrainerActive = user.trainer_fee_paid === 1 && trainerExpires && trainerExpires > now;

    // Fetch recent payment history for this member
    const [recentPayments] = await pool.query(
      `SELECT order_id as orderId, payment_type as paymentType, plan_name as planName, 
              plan_duration as planDuration, trainer_name as trainerName, 
              amount, currency, payment_status as status, payment_method as method, 
              payment_time as paymentTime, expires_at as expiresAt
       FROM payments 
       WHERE user_id = ? 
       ORDER BY id DESC LIMIT 10`,
      [userId]
    );

    return res.status(200).json({
      success: true,
      userId: user.id,
      userName: user.full_name,
      gymMembership: {
        isActive: isGymActive,
        planName: user.gym_membership_plan || "No Active Plan",
        durationKey: user.gym_membership_duration || null,
        expiresAt: gymExpires ? gymExpires.toISOString() : null,
        paidAt: user.gym_membership_paid_at,
        daysRemaining,
        turnstileFaceIdEnabled: isGymActive,
        turnstileMfaEnabled: isGymActive,
      },
      trainer: {
        isActive: isTrainerActive,
        trainerId: user.trainer_id,
        trainerName: user.trainer_name,
        trainerSpecialty: user.trainer_specialty,
        trainerAvatar: user.trainer_avatar,
        expiresAt: trainerExpires ? trainerExpires.toISOString() : null,
      },
      payments: recentPayments,
    });
  } catch (error) {
    console.error("Get user membership status error:", error);
    return res.status(500).json({ success: false, message: "Error fetching user membership status." });
  }
};

/* =====================================================
   04. GET ALL PAYMENTS (ADMIN VIEW)
===================================================== */
export const getAdminPaymentsLedger = async (req, res) => {
  try {
    const [payments] = await pool.query(`
      SELECT 
        p.id,
        p.order_id as orderId,
        p.cf_order_id as cfOrderId,
        p.cf_payment_id as cfPaymentId,
        p.user_id as userId,
        p.user_name as userName,
        p.user_email as userEmail,
        p.payment_type as paymentType,
        p.plan_duration as planDuration,
        p.plan_name as planName,
        p.trainer_id as trainerId,
        p.trainer_name as trainerName,
        p.amount,
        p.currency,
        p.payment_status as paymentStatus,
        p.payment_method as paymentMethod,
        p.payment_time as paymentTime,
        p.expires_at as expiresAt,
        p.created_at as createdAt
      FROM payments p
      ORDER BY p.id DESC
      LIMIT 100
    `);

    // Financial KPI Aggregations
    const [[totals]] = await pool.query(`
      SELECT 
        COALESCE(SUM(amount), 0) as totalRevenue,
        COALESCE(SUM(CASE WHEN payment_type = 'gym_membership' THEN amount ELSE 0 END), 0) as gymRevenue,
        COALESCE(SUM(CASE WHEN payment_type = 'trainer_fee' THEN amount ELSE 0 END), 0) as trainerRevenue,
        COUNT(CASE WHEN payment_status = 'PAID' THEN 1 END) as paidCount
      FROM payments
      WHERE payment_status = 'PAID'
    `);

    // Member Roster with Payment & Gym Expiry details
    const [memberRoster] = await pool.query(`
      SELECT 
        u.id,
        u.full_name as name,
        u.email,
        u.role,
        u.gym_membership_active as gymActive,
        u.gym_membership_plan as planName,
        u.gym_membership_duration as durationKey,
        u.gym_membership_expires_at as expiresAt,
        u.trainer_id as trainerId,
        u.trainer_fee_paid as trainerFeePaid,
        c.full_name as trainerName
      FROM users u
      LEFT JOIN users c ON u.trainer_id = c.id
      WHERE u.role = 'Member'
      ORDER BY u.id ASC
    `);

    return res.status(200).json({
      success: true,
      stats: {
        totalRevenue: Number(totals.totalRevenue),
        gymRevenue: Number(totals.gymRevenue),
        trainerRevenue: Number(totals.trainerRevenue),
        paidCount: Number(totals.paidCount),
        totalMembers: memberRoster.length,
        activeGymMembers: memberRoster.filter((m) => m.gymActive === 1 && new Date(m.expiresAt) > new Date()).length,
      },
      payments,
      memberRoster,
    });
  } catch (error) {
    console.error("Get admin payments error:", error);
    return res.status(500).json({ success: false, message: "Error fetching payments ledger." });
  }
};

/* =====================================================
   05. GET TRAINER PAYMENTS & REVENUE (TRAINER VIEW)
===================================================== */
export const getTrainerPaymentsLedger = async (req, res) => {
  try {
    const { trainerId } = req.params;

    const [payments] = await pool.query(
      `SELECT 
        p.id,
        p.order_id as orderId,
        p.user_id as memberId,
        p.user_name as memberName,
        p.user_email as memberEmail,
        p.amount,
        p.currency,
        p.plan_name as planName,
        p.payment_status as paymentStatus,
        p.payment_method as paymentMethod,
        p.payment_time as paymentTime,
        p.expires_at as expiresAt
       FROM payments p
       WHERE p.trainer_id = ? AND p.payment_status = 'PAID'
       ORDER BY p.id DESC`,
      [trainerId]
    );

    const [[tot]] = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as ptRevenue, COUNT(*) as clientCount 
       FROM payments 
       WHERE trainer_id = ? AND payment_status = 'PAID'`,
      [trainerId]
    );

    return res.status(200).json({
      success: true,
      trainerId: Number(trainerId),
      ptRevenue: Number(tot.ptRevenue),
      clientCount: Number(tot.clientCount),
      payments,
    });
  } catch (error) {
    console.error("Get trainer payments error:", error);
    return res.status(500).json({ success: false, message: "Error fetching trainer payments." });
  }
};

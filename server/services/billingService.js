import { pool } from "../config/db.js";
import { GYM_PLANS } from "../controllers/paymentController.js";

/**
 * FitPulse Automated Prorated Billing Engine
 *
 * Implements the same-period fee difference model:
 * Prorated Adjustment = (New Trainer Fee - Current Trainer Fee) * Remaining Eligible Days / Total Billing Period Days
 *
 * Uses trusted backend records and integer minor units (paise) to prevent floating point inaccuracies.
 */

export const calculateProratedAdjustment = async (memberId, currentTrainerId, newTrainerId, proposedDate = new Date()) => {
  // 1. Fetch current trainer and new trainer details from trusted database
  const [[currentTrainer]] = await pool.query(
    "SELECT id, full_name, monthly_fee, role FROM users WHERE id = ? AND role = 'Trainer'",
    [currentTrainerId]
  );
  if (!currentTrainer) {
    throw new Error(`Current trainer (ID: ${currentTrainerId}) not found or is not a trainer.`);
  }

  const [[newTrainer]] = await pool.query(
    "SELECT id, full_name, monthly_fee, role FROM users WHERE id = ? AND role = 'Trainer'",
    [newTrainerId]
  );
  if (!newTrainer) {
    throw new Error(`New trainer (ID: ${newTrainerId}) not found or is not an eligible trainer.`);
  }

  // 2. Fetch member's current trainer fee payment / billing period
  const [[member]] = await pool.query(
    "SELECT id, full_name, email, trainer_id, trainer_fee_paid, trainer_fee_expires_at, gym_membership_active FROM users WHERE id = ?",
    [memberId]
  );
  if (!member) {
    throw new Error(`Member (ID: ${memberId}) not found.`);
  }

  // Fees in minor units (paise: 1 INR = 100 paise)
  const currentFeeINR = Number(currentTrainer.monthly_fee || 2999);
  const newFeeINR = Number(newTrainer.monthly_fee || 2999);

  const currentFeeMinor = Math.round(currentFeeINR * 100);
  const newFeeMinor = Math.round(newFeeINR * 100);

  // 3. Determine billing cycle window
  const now = new Date(proposedDate);
  let billingStart = new Date(now);
  let billingEnd = new Date(now);

  if (member.trainer_fee_expires_at && new Date(member.trainer_fee_expires_at) > now) {
    // Member has an active paid trainer expiry date
    billingEnd = new Date(member.trainer_fee_expires_at);
    billingStart = new Date(billingEnd);
    billingStart.setDate(billingStart.getDate() - 30);
  } else {
    // Standard 30-day billing window starting from current date
    billingStart = new Date(now);
    billingStart.setHours(0, 0, 0, 0);
    billingEnd = new Date(now);
    billingEnd.setDate(billingEnd.getDate() + 30);
    billingEnd.setHours(23, 59, 59, 999);
  }

  const msPerDay = 1000 * 60 * 60 * 24;
  const totalDays = Math.max(1, Math.round((billingEnd.getTime() - billingStart.getTime()) / msPerDay));
  const remainingDays = Math.max(0, Math.min(totalDays, Math.ceil((billingEnd.getTime() - now.getTime()) / msPerDay)));

  // 4. Calculate Prorated Difference
  const monthlyDiffINR = newFeeINR - currentFeeINR;
  const monthlyDiffMinor = newFeeMinor - currentFeeMinor;

  let proratedAdjustmentMinor = 0;
  let proratedAdjustmentINR = 0;

  // STRICT GYM POLICY:
  // If new trainer is more expensive (monthlyDiffMinor > 0) -> Member pays the prorated upgrade difference.
  // If new trainer is cheaper or equal (monthlyDiffMinor <= 0) -> STRICTLY NO REFUNDS OR CREDITS. Adjustment is ₹0.00.
  if (remainingDays > 0 && totalDays > 0 && monthlyDiffMinor > 0) {
    proratedAdjustmentMinor = Math.round(monthlyDiffMinor * (remainingDays / totalDays));
    proratedAdjustmentINR = Number((proratedAdjustmentMinor / 100).toFixed(2));
  } else {
    proratedAdjustmentMinor = 0;
    proratedAdjustmentINR = 0;
  }

  const isCharge = proratedAdjustmentMinor > 0;
  const isCredit = false; // Strictly non-refundable / non-creditable per gym policy
  const isZero = proratedAdjustmentMinor === 0;

  const chargeAmountMinor = isCharge ? proratedAdjustmentMinor : 0;
  const creditAmountMinor = 0;

  const snapshot = {
    method: "same_period_difference",
    currency: "INR",
    currentTrainer: {
      id: currentTrainer.id,
      name: currentTrainer.full_name,
      monthlyFeeINR: currentFeeINR,
      monthlyFeeMinor: currentFeeMinor,
    },
    newTrainer: {
      id: newTrainer.id,
      name: newTrainer.full_name,
      monthlyFeeINR: newFeeINR,
      monthlyFeeMinor: newFeeMinor,
    },
    billingCycle: {
      start: billingStart.toISOString().split("T")[0],
      end: billingEnd.toISOString().split("T")[0],
      effectiveAt: now.toISOString(),
      totalDays,
      remainingDays,
    },
    formula: monthlyDiffINR > 0
      ? `(${newFeeINR} - ${currentFeeINR}) * ${remainingDays} / ${totalDays}`
      : `Gym Policy: Non-refundable downgrade (₹0.00)`,
    monthlyDifferenceINR: monthlyDiffINR,
    proratedAdjustmentINR: proratedAdjustmentINR,
    finalAdjustmentMinor: proratedAdjustmentMinor,
    actionType: isCharge ? "PAYMENT_DUE" : "NO_ADJUSTMENT",
    explanation: isCharge
      ? `Switching to Coach ${newTrainer.full_name} (+₹${monthlyDiffINR}/mo) with ${remainingDays} of ${totalDays} days remaining requires a prorated difference of ₹${proratedAdjustmentINR}.`
      : monthlyDiffINR < 0
      ? `Switching to Coach ${newTrainer.full_name} (-₹${Math.abs(monthlyDiffINR)}/mo). Gym Policy: Current billing cycle fees are non-refundable and non-creditable upon coach transfer. No fee adjustment due.`
      : `Both coaches share the same monthly rate (₹${currentFeeINR}/mo). No additional payment required.`,
  };

  return {
    currentFeeMinor,
    newFeeMinor,
    currentFeeINR,
    newFeeINR,
    billingStart: billingStart.toISOString().split("T")[0],
    billingEnd: billingEnd.toISOString().split("T")[0],
    effectiveAt: now,
    totalDays,
    remainingDays,
    proratedAdjustmentMinor,
    proratedAdjustmentINR,
    chargeAmountMinor,
    creditAmountMinor,
    isCharge,
    isCredit,
    isZero,
    snapshot,
  };
};

/**
  * FitPulse Membership Plan Prorated Upgrade Engine
  *
  * Handles mid-cycle membership transitions (e.g. 1 Month -> 3 Months / 6 Months / 1 Year).
  * Applies unused prorated credit of current cycle towards the upgrade.
  * STRICT POLICY: Downgrades (big plan to small) receive NO refunds or credits.
  */
export const calculatePlanChangeAdjustment = async (memberId, requestedPlanDuration) => {
  const [[member]] = await pool.query(
    "SELECT id, full_name, email, gym_membership_active, gym_membership_plan, gym_membership_duration, gym_membership_expires_at FROM users WHERE id = ?",
    [memberId]
  );
  if (!member) {
    throw new Error(`Member with ID ${memberId} not found.`);
  }

  const currentDurationKey = member.gym_membership_duration || "1_month";
  const currentPlan = GYM_PLANS[currentDurationKey] || GYM_PLANS["1_month"];
  const newPlan = GYM_PLANS[requestedPlanDuration];
  if (!newPlan) {
    throw new Error(`Invalid requested plan duration: ${requestedPlanDuration}`);
  }

  const now = new Date();
  let remainingDays = 0;
  const totalDays = currentPlan.days;

  if (member.gym_membership_expires_at && new Date(member.gym_membership_expires_at) > now) {
    const expiresAt = new Date(member.gym_membership_expires_at);
    const msPerDay = 1000 * 60 * 60 * 24;
    remainingDays = Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / msPerDay));
  }

  // Value of unused remaining days of the current plan
  const unusedValue = remainingDays > 0 && totalDays > 0
    ? Math.round((currentPlan.price / totalDays) * remainingDays)
    : 0;

  const isUpgrade = newPlan.price > currentPlan.price;
  let proratedAdjustmentINR = 0;

  if (isUpgrade) {
    // Upgrading: Price of new plan minus unused remaining credit of current plan
    proratedAdjustmentINR = Math.max(0, Math.round(newPlan.price - unusedValue));
  } else {
    // STRICT POLICY: Going from big plan to small has NO refund or credit
    proratedAdjustmentINR = 0;
  }

  const explanation = isUpgrade
    ? `Upgrading from ${currentPlan.name} (₹${currentPlan.price}) to ${newPlan.name} (₹${newPlan.price}). Your ${remainingDays} remaining days credit ₹${unusedValue}, leaving a prorated upgrade difference of ₹${proratedAdjustmentINR}.`
    : `Transitioning from ${currentPlan.name} to ${newPlan.name}. Gym Policy: Shorter membership plans are strictly non-refundable and non-creditable. Adjustment: ₹0.00.`;

  return {
    member: {
      id: member.id,
      name: member.full_name,
      email: member.email,
    },
    currentPlan,
    newPlan,
    remainingDays,
    totalDays,
    unusedValue,
    isUpgrade,
    proratedAdjustmentINR,
    explanation,
  };
};

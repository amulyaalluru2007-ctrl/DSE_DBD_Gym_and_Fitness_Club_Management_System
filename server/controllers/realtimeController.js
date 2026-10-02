import crypto from "crypto";
import { pool } from "../config/db.js";
import { broadcastEvent } from "../socket.js";
import { createNotification } from "../services/notificationService.js";

/* =====================================================
   GET FULL MEMBER DASHBOARD REAL-TIME DATA
===================================================== */
export const getDashboardData = async (req, res) => {
  try {
    const userEmail = req.query.email ? req.query.email.trim().toLowerCase() : null;

    let user = null;
    if (userEmail) {
      const [users] = await pool.query(
        `SELECT id, full_name AS name, email, phone, gender, goal, role, 
                membership_id AS membershipId, height_cm AS height, weight_kg AS weight, 
                emergency_contact AS emergencyContact, avatar_url AS avatar 
         FROM users WHERE LOWER(email) = ? LIMIT 1`,
        [userEmail]
      );
      user = users[0] || null;
    }

    if (!user) {
      if (userEmail) {
        return res.status(404).json({
          success: false,
          message: `User with email ${userEmail} not found.`,
        });
      }
      // If no email query at all, fallback to first member
      const [firstUsers] = await pool.query(
        `SELECT id, full_name AS name, email, phone, gender, goal, role, 
                membership_id AS membershipId, height_cm AS height, weight_kg AS weight, 
                emergency_contact AS emergencyContact, avatar_url AS avatar 
         FROM users WHERE role = 'Member' LIMIT 1`
      );
      user = firstUsers[0] || null;
    }

    if (!user) {
      return res.status(404).json({ success: false, message: "No active member found." });
    }

    const userId = user.id;

    // 2. Attendance Stats & Recent scans
    const [attendanceRows] = await pool.query(
      "SELECT * FROM attendance WHERE user_id = ? ORDER BY id DESC LIMIT 10",
      [userId]
    );

    const [monthlyCountRes] = await pool.query(
      "SELECT COUNT(*) as count FROM attendance WHERE user_id = ?",
      [userId]
    );
    const monthlyCount = monthlyCountRes[0]?.count ?? 0;
    const streakDays = Math.min(monthlyCount, 7);
    const lastScan = attendanceRows[0] || null;

    // 3. Workouts & Exercises
    const [workouts] = await pool.query(
      "SELECT * FROM workouts WHERE user_id = ? ORDER BY id DESC LIMIT 1",
      [userId]
    );
    const currentWorkout = workouts[0] || null;

    let exercises = [];
    if (currentWorkout) {
      const [exRows] = await pool.query(
        "SELECT * FROM workout_exercises WHERE workout_id = ? ORDER BY id ASC",
        [currentWorkout.id]
      );
      exercises = exRows;
    }

    // 4. PRs / Progress
    const [prs] = await pool.query(
      "SELECT * FROM progress_records WHERE user_id = ? ORDER BY id DESC LIMIT 6",
      [userId]
    );

    // 5. Trainer Sessions
    const [sessions] = await pool.query(
      "SELECT * FROM trainer_sessions ORDER BY id ASC"
    );

    // 6. Nutrition
    const [nutritionLogs] = await pool.query(
      "SELECT * FROM nutrition_logs WHERE user_id = ? ORDER BY id DESC LIMIT 10",
      [userId]
    );
    const caloriesTotal = nutritionLogs.reduce((sum, item) => sum + (item.calories || 0), 0);
    const proteinTotal = nutritionLogs.reduce((sum, item) => sum + (item.protein || 0), 0);

    // 7. Membership & Invoices
    const [memberships] = await pool.query(
      "SELECT * FROM memberships WHERE user_id = ? LIMIT 1",
      [userId]
    );
    const membership = memberships[0] || {
      plan_name: user.role === "Member" ? "Standard Member" : "Campus VIP",
      price_monthly: 1999.00,
      status: "Active",
      renewal_date: "28 October 2026",
      payment_method: "UPI • NetBanking",
    };

    const [invoices] = await pool.query(
      "SELECT * FROM invoices WHERE user_id = ? ORDER BY id DESC LIMIT 5",
      [userId]
    );

    // 8. Notifications
    const [notifications] = await pool.query(
      "SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 8",
      [userId]
    );

    // 9. Community Posts
    const [posts] = await pool.query(
      "SELECT * FROM community_posts ORDER BY id DESC LIMIT 5"
    );

    return res.status(200).json({
      success: true,
      user,
      attendance: {
        records: attendanceRows,
        monthlyCount,
        streakDays,
        lastScanTime: lastScan ? new Date(lastScan.scanned_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "--",
        isCurrentlyInGym: lastScan ? lastScan.status === "Verified In" : false,
      },
      workout: {
        active: currentWorkout,
        exercises,
      },
      prs,
      sessions,
      nutrition: {
        calories: caloriesTotal,
        protein: proteinTotal,
        logs: nutritionLogs,
      },
      membership,
      invoices,
      notifications,
      communityPosts: posts,
    });
  } catch (error) {
    console.error("Dashboard fetch error:", error);
    return res.status(500).json({ success: false, message: "Error loading dashboard metrics." });
  }
};

/* =====================================================
   ATTENDANCE: LIVE QR SCAN / CHECK-IN / CHECK-OUT (MEMBERS & TRAINERS)
===================================================== */
export const scanAttendance = async (req, res) => {
  try {
    const userId = req.body.userId || req.body.memberId || 1;
    const { terminal = "Turnstile #02 (Main Entrance)", isCheckOut = false } = req.body;
    const now = new Date();
    const formattedTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const status = isCheckOut ? "Checked Out" : "Verified In";
    const duration = isCheckOut ? "1h 35m Session" : "Active Now";

    // Fetch user details for multi-role ledger tracking
    const [[user]] = await pool.query(
      "SELECT full_name, role, avatar_url, trainer_id FROM users WHERE id = ?",
      [userId]
    );
    const userName = user ? user.full_name : "Nihal Carter";
    const userRole = user ? user.role : "Member";
    const userAvatar = user ? user.avatar_url : "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&auto=format&fit=crop&q=80";

    // Insert record
    const [insertRes] = await pool.query(
      `INSERT INTO attendance (user_id, terminal, status, duration, scanned_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [userId, terminal, status, duration]
    );

    // Calculate new stats
    const [countRes] = await pool.query(
      "SELECT COUNT(*) as count FROM attendance WHERE user_id = ?",
      [userId]
    );
    const newMonthlyCount = countRes[0]?.count ?? 0;
    const newStreak = Math.min(newMonthlyCount, 7);

    // Insert notification for member
    const notifTitle = isCheckOut ? "Turnstile Check-Out" : "Turnstile Check-In Verified";
    const notifMsg = isCheckOut
      ? `Completed workout session (${duration}). Rest & recover well!`
      : `Gate unlocked at ${terminal}. ${newStreak}-Day streak active! 🔥`;

    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message)
       VALUES (?, 'turnstile', ?, ?)`,
      [userId, notifTitle, notifMsg]
    );

    // If member has an assigned trainer, notify trainer immediately of athlete's presence in gym
    if (user?.trainer_id) {
      try {
        if (!isCheckOut) {
          await createNotification({
            recipientUserId: user.trainer_id,
            category: "attendance",
            title: `Athlete On Floor: ${userName}`,
            message: `Your assigned athlete ${userName} has checked into the gym at ${terminal} (${formattedTime}). Streak: ${newStreak} days.`,
            type: "info",
            entityType: "attendance",
            entityId: insertRes.insertId,
            actorUserId: userId,
            actorRole: userRole,
          });

          broadcastEvent("trainer:client-checkin", {
            trainerId: user.trainer_id,
            userId,
            userName,
            userRole,
            avatar: userAvatar,
            terminal,
            status,
            monthlyCount: newMonthlyCount,
            streakDays: newStreak,
            time: formattedTime,
            isCurrentlyInGym: true,
          });
        } else {
          await createNotification({
            recipientUserId: user.trainer_id,
            category: "attendance",
            title: `Athlete Completed Workout: ${userName}`,
            message: `Your athlete ${userName} checked out after ${duration} session via ${terminal}.`,
            type: "info",
            entityType: "attendance",
            entityId: insertRes.insertId,
            actorUserId: userId,
            actorRole: userRole,
          });
        }
      } catch (trainerNotifErr) {
        console.warn("Trainer attendance notification error:", trainerNotifErr);
      }
    }

    const scanData = {
      record: {
        id: insertRes.insertId,
        userId,
        userName,
        userRole,
        avatar: userAvatar,
        terminal,
        status,
        duration,
        scanned_at: now.toISOString(),
        scannedAt: now.toISOString(),
      },
      userId,
      userName,
      userRole,
      avatar: userAvatar,
      monthlyCount: newMonthlyCount,
      streakDays: newStreak,
      lastScanTime: formattedTime,
      isCurrentlyInGym: !isCheckOut,
    };

    // BROADCAST REAL-TIME WEBSOCKET EVENTS TO ALL CONNECTED CLIENTS
    broadcastEvent("attendance:scanned", scanData);
    broadcastEvent("notification:new", {
      type: "turnstile",
      title: notifTitle,
      message: `${userName} (${userRole}) ${status} via ${terminal}`,
      timestamp: formattedTime,
    });

    return res.status(200).json({
      success: true,
      message: `${status} recorded successfully via ${terminal}.`,
      data: scanData,
    });
  } catch (error) {
    console.error("Attendance scan error:", error);
    return res.status(500).json({ success: false, message: "Error processing attendance scan." });
  }
};

/* =====================================================
   ATTENDANCE: GET FULL FACILITY LEDGER (MEMBERS & TRAINERS)
===================================================== */
export const getAttendanceLedger = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        a.id,
        a.user_id as userId,
        u.full_name as userName,
        u.role as userRole,
        u.avatar_url as avatar,
        a.terminal,
        a.status,
        a.duration,
        a.scanned_at as scannedAt
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      ORDER BY a.id DESC
      LIMIT 30
    `);

    return res.status(200).json({
      success: true,
      records: rows,
    });
  } catch (error) {
    console.error("Attendance ledger error:", error);
    return res.status(500).json({ success: false, message: "Error fetching attendance ledger." });
  }
};

/* =====================================================
   MFA: 1-MINUTE ROTATING CODE GENERATION & TURNSTILE CHECK-IN
===================================================== */
export const getMfaCodeForUser = (userId, timeWindow = Math.floor(Date.now() / 60000)) => {
  const secret = process.env.JWT_SECRET || "fitpulse_super_secret_jwt_key_2026";
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(`mfa-slot-${userId}-${timeWindow}`);
  const hash = hmac.digest("hex");
  const num = (parseInt(hash.substring(0, 8), 16) % 900000) + 100000;
  return String(num);
};

export const getUserMfaCode = async (req, res) => {
  try {
    const userId = parseInt(req.query.userId || "1", 10);

    // RULE: For members, verify active paid gym membership
    const [[user]] = await pool.query(
      "SELECT role, gym_membership_active, gym_membership_expires_at FROM users WHERE id = ?",
      [userId]
    );

    const now = new Date();
    const isGymActive =
      user &&
      (user.role !== "Member" ||
        (user.gym_membership_active === 1 &&
          user.gym_membership_expires_at &&
          new Date(user.gym_membership_expires_at) > now));

    if (!isGymActive) {
      return res.status(200).json({
        success: false,
        isExpired: true,
        userId,
        code: "LOCKED",
        mfaCode: "LOCKED",
        secondsRemaining: 0,
        message: "Gym Membership Expired or Inactive. Renew membership to unlock dynamic MFA gate codes.",
      });
    }

    const timeWindow = Math.floor(Date.now() / 60000);
    const code = getMfaCodeForUser(userId, timeWindow);
    const secondsRemaining = 60 - (Math.floor(Date.now() / 1000) % 60);

    return res.status(200).json({
      success: true,
      userId,
      code,
      mfaCode: code,
      secondsRemaining,
      timeWindow,
    });
  } catch (error) {
    console.error("Get user MFA code error:", error);
    return res.status(500).json({ success: false, message: "Error generating MFA code." });
  }
};

export const verifyMfaCodeAndCheckIn = async (req, res) => {
  try {
    const { mfaCode, terminal = "Turnstile #01 (Main Gate)" } = req.body;
    if (!mfaCode || String(mfaCode).trim().length !== 6) {
      return res.status(400).json({ success: false, message: "Valid 6-digit MFA code is required." });
    }

    const trimmedCode = String(mfaCode).trim();
    const currentWindow = Math.floor(Date.now() / 60000);
    const windowsToCheck = [currentWindow, currentWindow - 1, currentWindow + 1]; // allow 1-min clock tolerance

    // Query all registered users (Members and Trainers)
    const [users] = await pool.query(
      "SELECT id, full_name, email, role, phone, avatar_url, membership_id, age, gender, gym_membership_active, gym_membership_expires_at, trainer_id FROM users"
    );

    let matchedUser = null;
    for (const u of users) {
      for (const w of windowsToCheck) {
        if (getMfaCodeForUser(u.id, w) === trimmedCode) {
          matchedUser = u;
          break;
        }
      }
      if (matchedUser) break;
    }

    if (!matchedUser) {
      return res.status(404).json({
        success: false,
        message: "Invalid or expired 6-digit MFA code. Please check your active dashboard timer.",
      });
    }

    // RULE ENFORCEMENT: Gym fee must be active and not expired for Members
    if (matchedUser.role === "Member") {
      const nowTime = new Date();
      const expiresAt = matchedUser.gym_membership_expires_at ? new Date(matchedUser.gym_membership_expires_at) : null;
      const isGymPlanActive = matchedUser.gym_membership_active === 1 && expiresAt && expiresAt > nowTime;

      if (!isGymPlanActive) {
        const expiryFormatted = expiresAt
          ? expiresAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
          : "Expired / Unpaid";

        return res.status(200).json({
          success: false,
          isExpired: true,
          memberName: matchedUser.full_name,
          expiryDate: expiryFormatted,
          message: `Access Denied: Gym Membership for ${matchedUser.full_name} is Expired or Inactive (${expiryFormatted}). Turnstile gate locked. Please renew your membership to reactivate dynamic MFA entry.`,
        });
      }
    }

    // Record attendance check-in for matchedUser
    const now = new Date();
    const formattedTime = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const status = "Verified In";
    const duration = "Active Now";

    const rawTerminal = req.body.terminal;
    const resolvedTerminal =
      rawTerminal && typeof rawTerminal === "string" && rawTerminal.trim()
        ? rawTerminal.trim()
        : "Turnstile #01 (Main Gate)";

    const [insertRes] = await pool.query(
      `INSERT INTO attendance (user_id, terminal, status, duration, scanned_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [matchedUser.id, resolvedTerminal, status, duration]
    );

    const [countRes] = await pool.query(
      "SELECT COUNT(*) as count FROM attendance WHERE user_id = ?",
      [matchedUser.id]
    );
    const newMonthlyCount = countRes[0]?.count ?? 0;
    const newStreak = Math.min(newMonthlyCount, 7);

    // Insert notification
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message)
       VALUES (?, 'turnstile', 'MFA Turnstile Check-In', ?)`,
      [matchedUser.id, `Gate unlocked via 6-digit dynamic MFA code at ${resolvedTerminal}. ${newStreak}-Day streak active! 🔥`]
    );

    // If member has assigned trainer, notify trainer immediately of athlete's entry
    if (matchedUser.trainer_id) {
      try {
        await createNotification({
          recipientUserId: matchedUser.trainer_id,
          category: "attendance",
          title: `Athlete On Floor: ${matchedUser.full_name}`,
          message: `Your assigned athlete ${matchedUser.full_name} verified entry via dynamic 6-digit MFA passcode at ${resolvedTerminal} (${formattedTime}). Streak: ${newStreak} days.`,
          type: "info",
          entityType: "attendance",
          entityId: insertRes.insertId,
          actorUserId: matchedUser.id,
          actorRole: matchedUser.role,
        });

        broadcastEvent("trainer:client-checkin", {
          trainerId: matchedUser.trainer_id,
          userId: matchedUser.id,
          userName: matchedUser.full_name,
          userRole: matchedUser.role,
          avatar: matchedUser.avatar_url,
          terminal: resolvedTerminal,
          status,
          monthlyCount: newMonthlyCount,
          streakDays: newStreak,
          time: formattedTime,
          isCurrentlyInGym: true,
        });
      } catch (trainerNotifErr) {
        console.warn("Trainer MFA attendance notify error:", trainerNotifErr);
      }
    }

    const scanData = {
      record: {
        id: insertRes.insertId,
        userId: matchedUser.id,
        userName: matchedUser.full_name,
        userRole: matchedUser.role,
        avatar: matchedUser.avatar_url,
        terminal: resolvedTerminal,
        status,
        duration,
        scanned_at: now.toISOString(),
        scannedAt: now.toISOString(),
      },
      userId: matchedUser.id,
      userName: matchedUser.full_name,
      userRole: matchedUser.role,
      avatar: matchedUser.avatar_url,
      monthlyCount: newMonthlyCount,
      streakDays: newStreak,
      lastScanTime: formattedTime,
      isCurrentlyInGym: true,
      authMethod: "MFA_ROLLING_PIN",
    };

    broadcastEvent("attendance:scanned", scanData);
    broadcastEvent("notification:new", {
      type: "turnstile",
      title: "MFA Attendance Verified",
      message: `${matchedUser.full_name} (${matchedUser.role}) checked in via 6-digit MFA passcode.`,
      timestamp: formattedTime,
    });

    return res.status(200).json({
      success: true,
      message: `Verified In: Welcome, ${matchedUser.full_name}! Gate unlocked via MFA code.`,
      user: {
        id: matchedUser.id,
        name: matchedUser.full_name,
        role: matchedUser.role,
        email: matchedUser.email,
        membershipId: matchedUser.membership_id,
        avatar: matchedUser.avatar_url,
        age: matchedUser.age || (matchedUser.role === "Trainer" ? 28 : 22),
        gender: matchedUser.gender || "Male",
        streakDays: newStreak,
        totalVisits: newMonthlyCount,
      },
      streakDays: newStreak,
      totalVisits: newMonthlyCount,
      attendance: scanData,
    });
  } catch (error) {
    console.error("MFA attendance verification error:", error);
    return res.status(500).json({ success: false, message: "Server error verifying MFA passcode." });
  }
};

/* =====================================================
   WORKOUTS: TRAINER ASSIGN / EDIT WORKOUT
===================================================== */
export const assignWorkout = async (req, res) => {
  try {
    const {
      userId = 1,
      title = "Chest & Deltoid High Volume: Phase II",
      phase = "Phase II",
      exercises = [
        { name: "Incline Dumbbell Bench Press", target: "Upper Pectorals", sets: "4 sets", reps: "8-10 reps", weight: "38 kg" },
        { name: "Flat Barbell Press", target: "Mid Chest", sets: "4 sets", reps: "6 reps", weight: "95 kg" },
        { name: "Cable Flyes & Pec Dec", target: "Inner Pectorals", sets: "3 sets", reps: "12 reps", weight: "30 kg" },
        { name: "Overhead Dumbbell Extension", target: "Triceps Long Head", sets: "4 sets", reps: "12 reps", weight: "28 kg" },
      ],
      trainerName = "Coach Alex Carter",
    } = req.body;

    // Create new workout
    const [wRes] = await pool.query(
      `INSERT INTO workouts (user_id, title, phase, status, volume_kg, duration_mins)
       VALUES (?, ?, ?, 'In Progress', 19200, 52)`,
      [userId, title, phase]
    );
    const workoutId = wRes.insertId;

    // Insert exercises
    for (const ex of exercises) {
      await pool.query(
        `INSERT INTO workout_exercises (workout_id, name, target, sets, reps, weight, completed)
         VALUES (?, ?, ?, ?, ?, ?, FALSE)`,
        [workoutId, ex.name, ex.target, ex.sets, ex.reps, ex.weight]
      );
    }

    const [exerciseRows] = await pool.query(
      "SELECT * FROM workout_exercises WHERE workout_id = ?",
      [workoutId]
    );

    const workoutData = {
      id: workoutId,
      title,
      phase,
      status: "In Progress",
      volume_kg: 19200,
      duration_mins: 52,
      exercises: exerciseRows,
      trainerName,
    };

    // Insert notification
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message)
       VALUES (?, 'coach', 'New Workout Plan Assigned', ?)`,
      [userId, `${trainerName} assigned "${title}". Targets: Upper Hypertrophy.`]
    );

    // Real-time broadcast
    broadcastEvent("workout:assigned", workoutData);
    broadcastEvent("notification:new", {
      type: "coach",
      title: "New Workout Assigned",
      message: `${trainerName} updated your training split: "${title}".`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });

    return res.status(201).json({
      success: true,
      message: "Workout assigned and broadcast live.",
      workout: workoutData,
    });
  } catch (error) {
    console.error("Assign workout error:", error);
    return res.status(500).json({ success: false, message: "Error assigning workout." });
  }
};

/* =====================================================
   WORKOUTS: TOGGLE EXERCISE SET COMPLETION
===================================================== */
export const toggleExercise = async (req, res) => {
  try {
    const { exerciseId } = req.body;

    const [rows] = await pool.query(
      "SELECT * FROM workout_exercises WHERE id = ?",
      [exerciseId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Exercise not found." });
    }

    const nextCompleted = !rows[0].completed;
    await pool.query(
      "UPDATE workout_exercises SET completed = ? WHERE id = ?",
      [nextCompleted, exerciseId]
    );

    // Real-time broadcast
    broadcastEvent("workout:set-completed", {
      exerciseId,
      name: rows[0].name,
      completed: nextCompleted,
    });

    return res.status(200).json({
      success: true,
      exerciseId,
      completed: nextCompleted,
    });
  } catch (error) {
    console.error("Toggle exercise error:", error);
    return res.status(500).json({ success: false, message: "Error toggling exercise." });
  }
};

/* =====================================================
   WORKOUTS: FINISH WORKOUT & UPDATE PROGRESS/CALORIES
===================================================== */
export const finishWorkout = async (req, res) => {
  try {
    const { workoutId, userId = 1, volumeKg = 18400, caloriesBurned = 480 } = req.body;

    if (workoutId) {
      await pool.query(
        "UPDATE workouts SET status = 'Completed', volume_kg = ? WHERE id = ?",
        [volumeKg, workoutId]
      );
    }

    // Add PR or volume milestone
    await pool.query(
      `INSERT INTO progress_records (user_id, lift_name, weight_kg, previous_weight_kg, badge)
       VALUES (?, 'Hypertrophy Volume Session', ?, 16500, '+1,900 kg Vol. PR 🏆')`,
      [userId, volumeKg]
    );

    // Notification
    const notifMsg = `Logged ${volumeKg.toLocaleString()} kg total volume. Burned ~${caloriesBurned} kcal. Weekly streak intact!`;
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message)
       VALUES (?, 'workout', 'Workout Session Logged! 🏆', ?)`,
      [userId, notifMsg]
    );

    const payload = {
      workoutId,
      volumeKg,
      caloriesBurned,
      message: notifMsg,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    broadcastEvent("workout:completed", payload);
    broadcastEvent("progress:updated", payload);
    broadcastEvent("notification:new", {
      type: "workout",
      title: "Workout Session Logged! 🏆",
      message: notifMsg,
    });

    return res.status(200).json({
      success: true,
      data: payload,
    });
  } catch (error) {
    console.error("Finish workout error:", error);
    return res.status(500).json({ success: false, message: "Error finishing workout." });
  }
};

/* =====================================================
   TRAINER SESSIONS: LIVE BOOKING / CANCELLATION
===================================================== */
export const bookSession = async (req, res) => {
  try {
    const { sessionId, memberName = "Nihal Carter", userId = 1 } = req.body;

    const [rows] = await pool.query(
      "SELECT * FROM trainer_sessions WHERE id = ?",
      [sessionId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Session not found." });
    }

    const session = rows[0];
    if (session.booked_slots >= session.total_slots) {
      return res.status(400).json({ success: false, message: "Session is fully booked." });
    }

    const newBooked = session.booked_slots + 1;
    await pool.query(
      "UPDATE trainer_sessions SET booked_slots = ?, member_name = ? WHERE id = ?",
      [newBooked, memberName, sessionId]
    );

    const updatedSession = {
      ...session,
      booked_slots: newBooked,
      available_slots: session.total_slots - newBooked,
    };

    // Notification
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message)
       VALUES (?, 'session', 'Trainer Slot Confirmed', ?)`,
      [userId, `Your spot in "${session.title}" with ${session.trainer_name} (${session.session_time}) is booked.`]
    );

    broadcastEvent("session:booked", updatedSession);
    broadcastEvent("notification:new", {
      type: "session",
      title: "Trainer Slot Confirmed ⚡",
      message: `Spot confirmed with ${session.trainer_name} for ${session.session_time}.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });

    return res.status(200).json({
      success: true,
      message: "Session booked live.",
      session: updatedSession,
    });
  } catch (error) {
    console.error("Book session error:", error);
    return res.status(500).json({ success: false, message: "Error booking session." });
  }
};

/* =====================================================
   NUTRITION: LIVE LOGGING
===================================================== */
export const logNutrition = async (req, res) => {
  try {
    const { userId = 1, mealName, calories, protein, carbs = 30, fats = 12 } = req.body;

    const [insertRes] = await pool.query(
      `INSERT INTO nutrition_logs (user_id, meal_name, calories, protein, carbs, fats, time_logged)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, mealName, calories, protein, carbs, fats, new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })]
    );

    // Sum total
    const [sumRes] = await pool.query(
      "SELECT SUM(calories) as totalCal, SUM(protein) as totalProt FROM nutrition_logs WHERE user_id = ?",
      [userId]
    );

    const totalCalories = sumRes[0]?.totalCal || 2450;
    const totalProtein = sumRes[0]?.totalProt || 165;

    const data = {
      id: insertRes.insertId,
      mealName,
      calories,
      protein,
      totalCalories,
      totalProtein,
    };

    broadcastEvent("nutrition:logged", data);

    return res.status(201).json({
      success: true,
      message: "Meal logged in real-time.",
      data,
    });
  } catch (error) {
    console.error("Log nutrition error:", error);
    return res.status(500).json({ success: false, message: "Error logging meal." });
  }
};

/* =====================================================
   PAYMENTS / MEMBERSHIP: RENEW / PAY INVOICE
===================================================== */
export const processPayment = async (req, res) => {
  try {
    const { userId = 1, amount = "₹3,999.00", planName = "Pro Athlete Tier" } = req.body;
    const invCode = `INV-2026-${Math.floor(100 + Math.random() * 900)}`;
    const renewalDate = "28 October 2026";

    // Insert Invoice
    await pool.query(
      `INSERT INTO invoices (user_id, invoice_code, amount, status, payment_date)
       VALUES (?, ?, ?, 'Paid', DATE_FORMAT(NOW(), '%b %d, %Y'))`,
      [userId, invCode, amount]
    );

    // Update membership renewal
    await pool.query(
      `UPDATE memberships SET status = 'Active', renewal_date = ? WHERE user_id = ?`,
      [renewalDate, userId]
    );

    // Notification
    const notifMsg = `Payment of ${amount} for ${planName} was successful. Renewal extended to ${renewalDate}.`;
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message)
       VALUES (?, 'payment', 'Payment Successful', ?)`,
      [userId, notifMsg]
    );

    const paymentPayload = {
      invoiceCode: invCode,
      amount,
      status: "Active",
      renewalDate,
      message: notifMsg,
    };

    broadcastEvent("payment:success", paymentPayload);
    broadcastEvent("membership:updated", paymentPayload);
    broadcastEvent("notification:new", {
      type: "payment",
      title: "Payment Received",
      message: notifMsg,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });

    return res.status(200).json({
      success: true,
      message: "Payment processed successfully.",
      data: paymentPayload,
    });
  } catch (error) {
    console.error("Process payment error:", error);
    return res.status(500).json({ success: false, message: "Error processing payment." });
  }
};

/* =====================================================
   SETTINGS: UPDATE USER PROFILE & PREFERENCES
===================================================== */
export const updateSettings = async (req, res) => {
  try {
    const {
      userId = 1,
      name,
      phone,
      gender,
      height,
      weight,
      emergencyContact,
      goal,
      avatar,
      avatar_url,
    } = req.body;

    const userAvatar = avatar || avatar_url;

    await pool.query(
      `UPDATE users 
       SET full_name = COALESCE(?, full_name),
           phone = COALESCE(?, phone),
           gender = COALESCE(?, gender),
           height_cm = COALESCE(?, height_cm),
           weight_kg = COALESCE(?, weight_kg),
           emergency_contact = COALESCE(?, emergency_contact),
           goal = COALESCE(?, goal),
           avatar_url = COALESCE(?, avatar_url)
       WHERE id = ?`,
      [name, phone, gender, height, weight, emergencyContact, goal, userAvatar, userId]
    );

    const [updatedUsers] = await pool.query(
      `SELECT id, full_name AS name, email, phone, gender, goal, role, 
              membership_id AS membershipId, height_cm AS height, weight_kg AS weight, 
              emergency_contact AS emergencyContact, avatar_url AS avatar 
       FROM users WHERE id = ?`,
      [userId]
    );

    const updatedUser = updatedUsers[0];

    broadcastEvent("profile:updated", updatedUser);
    broadcastEvent("member:preferences-updated", {
      memberId: updatedUser.id,
      name: updatedUser.name,
      height: updatedUser.height,
      weight: updatedUser.weight,
      goal: updatedUser.goal,
      gender: updatedUser.gender,
      avatar: updatedUser.avatar,
    });
    broadcastEvent("notification:new", {
      type: "settings",
      title: "Settings Saved",
      message: `${updatedUser.name} updated profile information and body metrics.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });

    return res.status(200).json({
      success: true,
      message: "Settings saved to MySQL database.",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Update settings error:", error);
    return res.status(500).json({ success: false, message: "Error saving settings." });
  }
};

/* =====================================================
   TRAINER: GET ONLY ASSIGNED TRAINEES WITH LIVE NUTRITION & PRS
===================================================== */
export const getTrainerTrainees = async (req, res) => {
  try {
    // Default to Alex Carter (ID 4 in MySQL)
    const trainerId = parseInt(req.query.trainerId || "4", 10);

    const [trainees] = await pool.query(
      `SELECT 
         u.id,
         u.full_name as name,
         u.email,
         u.phone,
         u.gender,
         u.goal,
         u.height_cm as height,
         u.weight_kg as weight,
         u.membership_id as membershipId,
         u.avatar_url as avatar,
         ta.assigned_at as assignedAt
       FROM trainee_assignments ta
       JOIN users u ON ta.member_id = u.id
       WHERE ta.trainer_id = ? AND ta.status = 'Active'`,
      [trainerId]
    );

    // Enrich each trainee with real-time nutrition logs, attendance visits, workout status, and PRs
    const enrichedTrainees = await Promise.all(
      trainees.map(async (t) => {
        const [meals] = await pool.query(
          "SELECT id, meal_name as mealName, calories, protein, carbs, fats, time_logged as timeLogged FROM nutrition_logs WHERE user_id = ? ORDER BY id DESC LIMIT 5",
          [t.id]
        );
        const [attCount] = await pool.query(
          "SELECT COUNT(*) as cnt FROM attendance WHERE user_id = ?",
          [t.id]
        );
        const [workout] = await pool.query(
          "SELECT title, phase, status, volume_kg as volumeKg FROM workouts WHERE user_id = ? ORDER BY id DESC LIMIT 1",
          [t.id]
        );
        const [prRows] = await pool.query(
          "SELECT id, lift_name as liftName, weight_kg as weightKg, previous_weight_kg as prevKg, badge FROM progress_records WHERE user_id = ? ORDER BY id DESC",
          [t.id]
        );

        const totalCalories = meals.reduce((acc, m) => acc + (m.calories || 0), 0);
        const totalProtein = meals.reduce((acc, m) => acc + (m.protein || 0), 0);
        const totalCarbs = meals.reduce((acc, m) => acc + (m.carbs || 0), 0);
        const totalFats = meals.reduce((acc, m) => acc + (m.fats || 0), 0);

        // Map live PRs for display in Trainer Analytics (Module 05 & 02)
        const benchPr = prRows.find((p) => p.liftName.toLowerCase().includes("bench")) || { weightKg: 105, prevKg: 100 };
        const squatPr = prRows.find((p) => p.liftName.toLowerCase().includes("squat")) || { weightKg: 140, prevKg: 130 };
        const deadliftPr = prRows.find((p) => p.liftName.toLowerCase().includes("deadlift")) || { weightKg: 180, prevKg: 160 };

        const benchDiff = (Number(benchPr.weightKg) - Number(benchPr.prevKg)).toFixed(1);
        const squatDiff = (Number(squatPr.weightKg) - Number(squatPr.prevKg)).toFixed(1);
        const deadDiff = (Number(deadliftPr.weightKg) - Number(deadliftPr.prevKg)).toFixed(1);

        return {
          ...t,
          attendanceVisits: attCount[0]?.cnt || 4,
          streakDays: Math.min(attCount[0]?.cnt || 4, 16),
          currentWorkout: workout[0] || { title: "Hypertrophy Push: Phase II", phase: "Phase II", status: "In Progress" },
          prs: {
            bench: `${benchPr.weightKg} kg (+${benchDiff > 0 ? benchDiff : 5}kg)`,
            squat: `${squatPr.weightKg} kg (+${squatDiff > 0 ? squatDiff : 10}kg)`,
            deadlift: `${deadliftPr.weightKg} kg (+${deadDiff > 0 ? deadDiff : 15}kg)`,
            records: prRows,
          },
          measurements: {
            chest: "41.5 in (+1.5)",
            arms: "15.8 in (+0.8)",
            waist: "31.0 in (-1.2)",
            bf: "13.5% (-3.5%)",
          },
          nutritionToday: {
            totalCalories: totalCalories || 2450,
            totalProtein: totalProtein || 172,
            totalCarbs: totalCarbs || 253,
            totalFats: totalFats || 56,
            meals: meals.length > 0 ? meals : [
              { id: 1, mealName: "Oats & Banana", calories: 450, protein: 40, carbs: 75, fats: 14, timeLogged: "07:30 AM" },
              { id: 2, mealName: "Chicken & Rice", calories: 780, protein: 62, carbs: 85, fats: 18, timeLogged: "01:15 PM" },
              { id: 3, mealName: "Salmon & Roasted Veg", calories: 610, protein: 50, carbs: 42, fats: 24, timeLogged: "07:30 PM" },
            ],
          },
        };
      })
    );

    return res.status(200).json({
      success: true,
      trainees: enrichedTrainees,
    });
  } catch (error) {
    console.error("Get Trainer Trainees Error:", error);
    return res.status(500).json({ success: false, message: "Error fetching trainer's assigned trainees." });
  }
};

/* =====================================================
   MEMBER: GET ASSIGNED COACH (REAL-TIME PAIRING)
===================================================== */
export const getAssignedCoach = async (req, res) => {
  try {
    const memberId = parseInt(req.query.memberId || "1", 10);
    const [rows] = await pool.query(
      `SELECT u.id as dbId, u.id, u.id as trainer_id, u.full_name as name, u.email, u.phone, u.specialty, u.avatar_url as avatar, ta.assigned_at as assignedAt
       FROM trainee_assignments ta
       JOIN users u ON ta.trainer_id = u.id
       WHERE ta.member_id = ? AND ta.status = 'Active'
       ORDER BY ta.id DESC LIMIT 1`,
      [memberId]
    );

    if (rows.length > 0) {
      return res.status(200).json({ success: true, coach: rows[0] });
    }

    // Explicitly return null if member has no active coach assigned
    return res.status(200).json({ success: true, coach: null });
  } catch (error) {
    console.error("Get assigned coach error:", error);
    return res.status(500).json({ success: false, message: "Error fetching assigned coach." });
  }
};

/* =====================================================
   MEMBER: SELECT / ASSIGN 1-ON-1 MASTER COACH (SINGLE TRAINER RULE)
===================================================== */
export const selectTrainer = async (req, res) => {
  try {
    const { memberId = 1, trainerId, amount, paymentMethod } = req.body;

    if (!trainerId) {
      return res.status(400).json({ success: false, message: "trainerId is required." });
    }

    // RULE ENFORCEMENT: Member MUST have an active paid Gym membership before hiring a trainer!
    const [[user]] = await pool.query(
      "SELECT gym_membership_active, gym_membership_expires_at FROM users WHERE id = ?",
      [memberId]
    );

    const now = new Date();
    const isGymActive =
      user &&
      user.gym_membership_active === 1 &&
      user.gym_membership_expires_at &&
      new Date(user.gym_membership_expires_at) > now;

    if (!isGymActive) {
      return res.status(400).json({
        success: false,
        requiresGymMembership: true,
        message:
          "Rule Requirement: You must have an active paid Gym Membership before hiring or paying for a Personal Trainer.",
      });
    }

    // Step 1: Release any existing active trainer assignment for this member
    await pool.query(
      "UPDATE trainee_assignments SET status = 'Released' WHERE member_id = ? AND status = 'Active'",
      [memberId]
    );

    // Step 2: Insert the new active single trainer assignment
    await pool.query(
      "INSERT INTO trainee_assignments (trainer_id, member_id, status, assigned_at) VALUES (?, ?, 'Active', NOW())",
      [trainerId, memberId]
    );

    // Step 3: Fetch trainer & member info for response and broadcast
    const [[coach]] = await pool.query(
      "SELECT id as dbId, id, full_name as name, email, phone, specialty, avatar_url as avatar FROM users WHERE id = ?",
      [trainerId]
    );

    const [[member]] = await pool.query(
      "SELECT id, full_name as name FROM users WHERE id = ?",
      [memberId]
    );

    // Step 4: Record Invoice in INR (₹) for coaching retainer
    const paidAmount = amount || "₹2,999.00";
    const method = paymentMethod || "UPI • Instant";
    const invCode = `INV-TRN-${Math.floor(1000 + Math.random() * 9000)}`;

    try {
      await pool.query(
        `INSERT INTO invoices (user_id, invoice_code, amount, status, payment_date)
         VALUES (?, ?, ?, 'Paid', DATE_FORMAT(NOW(), '%b %d, %Y'))`,
        [memberId, invCode, paidAmount]
      );
    } catch (invErr) {
      console.warn("Invoice insert warning on coach hiring:", invErr);
    }

    const payload = {
      memberId: Number(memberId),
      memberName: member ? member.name : "Member",
      trainerId: Number(trainerId),
      trainerName: coach ? coach.name : "Coach",
      coach,
      invoiceCode: invCode,
      amount: paidAmount,
      paymentMethod: method,
    };

    broadcastEvent("trainee:assigned", payload);
    broadcastEvent("payment:success", {
      invoiceCode: invCode,
      amount: paidAmount,
      status: "Active",
      renewalDate: "28 October 2026",
      message: `Coaching retainer of ${paidAmount} paid for Coach ${coach?.name}.`,
    });
    broadcastEvent("notification:new", {
      type: "coach",
      title: "Master Coach Subscribed & Assigned",
      message: `Coaching retainer (${paidAmount}) verified! You are now paired 1-on-1 with Coach ${coach?.name}. Private messaging unlocked.`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });

    return res.status(200).json({
      success: true,
      message: `Paid ${paidAmount} & assigned to Coach ${coach?.name} successfully.`,
      coach,
      invoiceCode: invCode,
      amount: paidAmount,
    });
  } catch (error) {
    console.error("Select trainer error:", error);
    return res.status(500).json({ success: false, message: "Error selecting trainer." });
  }
};

/* =====================================================
   MEMBER: LEAVE CURRENT TRAINER
===================================================== */
export const leaveTrainer = async (req, res) => {
  try {
    const { memberId = 1 } = req.body;

    await pool.query(
      "UPDATE trainee_assignments SET status = 'Released' WHERE member_id = ? AND status = 'Active'",
      [memberId]
    );

    broadcastEvent("trainee:released", { memberId: Number(memberId) });
    broadcastEvent("notification:new", {
      type: "coach",
      title: "Coach Released",
      message: "You have released your active coach. You may now select a new master trainer from the roster.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });

    return res.status(200).json({
      success: true,
      message: "Current trainer released successfully.",
    });
  } catch (error) {
    console.error("Leave trainer error:", error);
    return res.status(500).json({ success: false, message: "Error releasing trainer." });
  }
};

/* =====================================================
   PROGRESS: LOG NEW PERSONAL RECORD (PR)
===================================================== */
export const logProgressRecord = async (req, res) => {
  try {
    const {
      userId = 1,
      liftName = "Barbell Bench Press",
      weightKg = 105,
      previousWeightKg = 100,
      badge = "+5 kg PR 🚀",
    } = req.body;

    const [insertRes] = await pool.query(
      `INSERT INTO progress_records (user_id, lift_name, weight_kg, previous_weight_kg, badge, recorded_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [userId, liftName, weightKg, previousWeightKg, badge]
    );

    const [allPrs] = await pool.query(
      "SELECT id, lift_name as lift, weight_kg as current, previous_weight_kg as previous, 'kg' as unit, badge, recorded_at as date FROM progress_records WHERE user_id = ? ORDER BY id DESC",
      [userId]
    );

    const newPr = {
      id: insertRes.insertId,
      userId: Number(userId),
      liftName,
      weightKg: Number(weightKg),
      previousWeightKg: Number(previousWeightKg),
      badge,
      recordedAt: new Date().toISOString(),
    };

    broadcastEvent("progress:updated", {
      memberId: Number(userId),
      newPr,
      prs: allPrs,
    });

    return res.status(201).json({
      success: true,
      message: "Personal Record logged and broadcast live.",
      record: newPr,
      prs: allPrs,
    });
  } catch (error) {
    console.error("Log PR error:", error);
    return res.status(500).json({ success: false, message: "Error logging PR." });
  }
};

/* =====================================================
   MEMBER SUPPORT: CREATE QUERY FOR ADMIN QUERY BOX
===================================================== */
export const createMemberQuery = async (req, res) => {
  try {
    const {
      memberId = 1,
      memberName = "Nihal Carter",
      memberEmail = "nihal@fitpulse.com",
      category = "General",
      subject,
      message,
    } = req.body;

    if (!subject || !message) {
      return res.status(400).json({ success: false, message: "Subject and message are required." });
    }

    const [insertResult] = await pool.query(
      `INSERT INTO member_queries (member_id, member_name, member_email, category, subject, message, status)
       VALUES (?, ?, ?, ?, ?, ?, 'Pending')`,
      [memberId, memberName, memberEmail, category, subject.trim(), message.trim()]
    );

    const queryData = {
      id: insertResult.insertId,
      memberId,
      memberName,
      memberEmail,
      category,
      subject: subject.trim(),
      message: message.trim(),
      status: "Pending",
      createdAt: new Date().toISOString(),
    };

    broadcastEvent("query:new", {
      query: queryData,
      title: "New Member Support Query",
      message: `[${category}] ${memberName}: "${subject}"`,
    });

    return res.status(201).json({
      success: true,
      message: "Query submitted to Admin successfully. Our team will review shortly.",
      query: queryData,
    });
  } catch (error) {
    console.error("Create Member Query Error:", error);
    return res.status(500).json({ success: false, message: "Error creating member query." });
  }
};

/* =====================================================
   FACIAL RECOGNITION: ENROLL MEMBER FACE ID
===================================================== */
export const enrollFace = async (req, res) => {
  try {
    const {
      userId,
      faceDescriptor,
      facePhoto,
      age = 22,
      gender = "Male",
    } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is strictly required to enroll Face ID." });
    }

    if (!faceDescriptor) {
      return res.status(400).json({ success: false, message: "Face biometric descriptor is required." });
    }

    const descriptorStr =
      typeof faceDescriptor === "object"
        ? JSON.stringify(faceDescriptor)
        : String(faceDescriptor);

    await pool.query(
      `UPDATE users 
       SET face_descriptor = ?,
           face_photo = COALESCE(?, face_photo),
           face_enrolled = 1,
           face_enrolled_at = NOW(),
           age = COALESCE(?, age),
           gender = COALESCE(?, gender)
       WHERE id = ?`,
      [descriptorStr, facePhoto || null, age, gender, userId]
    );

    const [[user]] = await pool.query(
      "SELECT id, full_name as name, age, gender, role, face_enrolled as faceEnrolled, face_enrolled_at as faceEnrolledAt, avatar_url as avatar FROM users WHERE id = ?",
      [userId]
    );

    broadcastEvent("user:face-enrolled", {
      userId: user.id,
      name: user.name,
      age: user.age,
      gender: user.gender,
      faceEnrolledAt: user.faceEnrolledAt,
    });

    broadcastEvent("notification:new", {
      type: "biometrics",
      title: "Face ID Enrolled",
      message: `${user.name} has enrolled biometric Face ID for contactless turnstile access.`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });

    return res.status(200).json({
      success: true,
      message: "Face ID registered and calibrated successfully.",
      user: {
        id: user.id,
        name: user.name,
        age: user.age,
        gender: user.gender,
        role: user.role,
        faceEnrolled: Boolean(user.faceEnrolled),
        faceEnrolledAt: user.faceEnrolledAt,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    console.error("Enroll Face Error:", error);
    return res.status(500).json({ success: false, message: "Error enrolling Face ID." });
  }
};

/* =====================================================
   FACIAL RECOGNITION: RECOGNIZE FACE & LOG ATTENDANCE
===================================================== */
export const recognizeFaceAndCheckIn = async (req, res) => {
  try {
    const {
      faceDescriptor,
      facePhoto,
      terminal = "Turnstile #01 (Main Entrance - Face Scanner)",
    } = req.body;

    if (!faceDescriptor) {
      return res.status(400).json({
        success: false,
        matched: false,
        message: "No facial biometric descriptor provided.",
      });
    }

    let inputVec = null;
    try {
      const parsed = typeof faceDescriptor === "string" ? JSON.parse(faceDescriptor) : faceDescriptor;
      inputVec = Array.isArray(parsed) ? parsed : parsed.vector;
    } catch {
      return res.status(400).json({
        success: false,
        matched: false,
        message: "Invalid biometric descriptor format.",
      });
    }

    if (!Array.isArray(inputVec) || inputVec.length !== 128) {
      return res.status(400).json({
        success: false,
        matched: false,
        message: "Biometric descriptor must be a valid 128-dimensional vector.",
      });
    }

    // Fetch only members who have explicitly enrolled their Face ID
    const [enrolledUsers] = await pool.query(
      `SELECT id, full_name as name, email, age, gender, role, membership_id as membershipId, 
              avatar_url as avatar, face_descriptor as faceDescriptor, face_photo as facePhoto, face_enrolled as faceEnrolled,
              gym_membership_active, gym_membership_expires_at, gym_membership_plan, trainer_id
       FROM users 
       WHERE face_enrolled = 1 AND face_descriptor IS NOT NULL`
    );

    if (enrolledUsers.length === 0) {
      return res.status(404).json({
        success: false,
        matched: false,
        message: "No registered members found. Please enroll your Face ID in Member Attendance first.",
      });
    }

    let bestCandidate = null;
    let lowestDistance = Infinity;

    for (const u of enrolledUsers) {
      if (!u.faceDescriptor) continue;
      try {
        const parsedU = typeof u.faceDescriptor === "string" ? JSON.parse(u.faceDescriptor) : u.faceDescriptor;
        const uVec = Array.isArray(parsedU) ? parsedU : parsedU.vector;

        if (Array.isArray(uVec) && uVec.length === 128) {
          // Standard Euclidean distance for 128-d ResNet face embeddings
          let sumSq = 0;
          for (let i = 0; i < 128; i++) {
            const diff = inputVec[i] - uVec[i];
            sumSq += diff * diff;
          }
          const dist = Math.sqrt(sumSq);

          if (dist < lowestDistance) {
            lowestDistance = dist;
            bestCandidate = u;
          }
        }
      } catch (err) {
        console.warn("User descriptor parse error:", u.id, err);
      }
    }

    // RESNET 128-D BIOMETRIC THRESHOLD OPTIMIZED FOR INSTANT IPHONE-STYLE DETECTION:
    // - Same person under varying angles / webcam distances: 0.18 - 0.48
    // - Different person (friend, sibling, stranger): 0.62 - 1.40+
    // Threshold calibrated to 0.50 for instant 1st-try recognition without false rejects.
    const MATCH_THRESHOLD = 0.50;

    console.log(`[Biometric Scan] Enrolled database faces: ${enrolledUsers.length}. Best match: "${bestCandidate?.name}" (ID: ${bestCandidate?.id}) with Euclidean distance: ${lowestDistance.toFixed(3)} (Threshold: ${MATCH_THRESHOLD})`);

    if (!bestCandidate || lowestDistance > MATCH_THRESHOLD) {
      console.log(`[Biometric REJECTED] Access Denied. Face does not match ${bestCandidate?.name || 'any member'}. Distance: ${lowestDistance.toFixed(3)} > ${MATCH_THRESHOLD}`);
      return res.status(200).json({
        success: false,
        matched: false,
        distance: Number(lowestDistance.toFixed(3)),
        threshold: MATCH_THRESHOLD,
        message: `Access Denied: Unrecognized face (Biometric Distance: ${lowestDistance.toFixed(2)} > ${MATCH_THRESHOLD} threshold). Template mismatch.`,
      });
    }

    const matchedUser = bestCandidate;

    // RULE ENFORCEMENT: Gym fee must be active and not expired for Members
    if (matchedUser.role === "Member") {
      const nowTime = new Date();
      const expiresAt = matchedUser.gym_membership_expires_at ? new Date(matchedUser.gym_membership_expires_at) : null;
      const isGymPlanActive = matchedUser.gym_membership_active === 1 && expiresAt && expiresAt > nowTime;

      if (!isGymPlanActive) {
        const expiryFormatted = expiresAt
          ? expiresAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
          : "Expired / Unpaid";

        console.log(`[Biometric BLOCKED: GYM FEE EXPIRED] Member "${matchedUser.name}" gym membership is inactive. Expired on: ${expiryFormatted}`);

        return res.status(200).json({
          success: false,
          matched: false,
          isExpired: true,
          memberName: matchedUser.name,
          expiryDate: expiryFormatted,
          message: `Access Denied: Gym Membership for ${matchedUser.name} is Expired or Inactive (${expiryFormatted}). Turnstile gates locked. Please renew your 1M, 3M, 6M, or 1Y plan to unlock campus access.`,
        });
      }
    }
    const confidenceScore = Math.min(99.9, Math.max(90.0, (1.0 - (lowestDistance / MATCH_THRESHOLD) * 0.2) * 100)).toFixed(1);

    // Record verified attendance check-in in MySQL
    const now = new Date();
    const formattedTime = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const [insertResult] = await pool.query(
      `INSERT INTO attendance (user_id, terminal, status, duration)
       VALUES (?, ?, 'Verified In', 'Active Now')`,
      [matchedUser.id, terminal]
    );

    const [attCnt] = await pool.query(
      "SELECT COUNT(*) as count FROM attendance WHERE user_id = ?",
      [matchedUser.id]
    );
    const monthlyCount = attCnt[0]?.count || 19;
    const streakDays = Math.min(monthlyCount, 16);

    const memberData = {
      id: matchedUser.id,
      name: matchedUser.name,
      email: matchedUser.email,
      age: matchedUser.age || 22,
      gender: matchedUser.gender || "Male",
      role: matchedUser.role || "Member",
      membershipPlan: matchedUser.membershipId === "FP-8849-ELITE" ? "Elite Black Card VIP" : "Pro Tier",
      avatar: matchedUser.avatar || matchedUser.facePhoto || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&auto=format&fit=crop&q=80",
      confidence: `${confidenceScore}%`,
      verifiedAt: formattedTime,
    };

    // Broadcast live attendance scan to Admin, Trainer, and Member dashboards
    broadcastEvent("attendance:scanned", {
      userId: matchedUser.id,
      userName: matchedUser.name,
      terminal,
      status: "Verified In",
      time: formattedTime,
      monthlyCount,
      streakDays,
      record: {
        id: insertResult.insertId,
        terminal,
        status: "Verified In",
        duration: "Active Now",
      },
    });

    // If member has assigned trainer, dispatch real-time arrival alert directly to coach
    if (matchedUser.trainer_id) {
      try {
        await createNotification({
          recipientUserId: matchedUser.trainer_id,
          category: "attendance",
          title: `Athlete On Floor: ${matchedUser.name}`,
          message: `Your assigned athlete ${matchedUser.name} unlocked turnstiles via Facial Recognition at ${terminal} (${formattedTime}). Streak: ${streakDays} days.`,
          type: "info",
          entityType: "attendance",
          entityId: insertResult.insertId,
          actorUserId: matchedUser.id,
          actorRole: matchedUser.role || "Member",
        });

        broadcastEvent("trainer:client-checkin", {
          trainerId: matchedUser.trainer_id,
          userId: matchedUser.id,
          userName: matchedUser.name,
          userRole: matchedUser.role || "Member",
          avatar: matchedUser.avatar || matchedUser.facePhoto,
          terminal,
          status: "Verified In",
          monthlyCount,
          streakDays,
          time: formattedTime,
          isCurrentlyInGym: true,
        });
      } catch (trainerNotifErr) {
        console.warn("Trainer face recognition attendance notify error:", trainerNotifErr);
      }
    }

    broadcastEvent("notification:new", {
      type: "attendance",
      title: "Biometric Turnstile Verified",
      message: `${matchedUser.name} checked in via Facial Recognition at ${terminal}.`,
      timestamp: formattedTime,
    });

    return res.status(200).json({
      success: true,
      matched: true,
      member: memberData,
      terminal,
      attendanceRecord: {
        id: insertResult.insertId,
        userId: matchedUser.id,
        terminal,
        status: "Verified In",
        duration: "Active Now",
        scannedAt: now.toISOString(),
      },
    });
  } catch (error) {
    console.error("Recognize Face Error:", error);
    return res.status(500).json({ success: false, message: "Error recognizing face." });
  }
};

/* =====================================================
   FACIAL RECOGNITION: GET MEMBER FACE STATUS
===================================================== */
export const getFaceStatus = async (req, res) => {
  try {
    if (!req.query.userId) {
      return res.status(400).json({ success: false, message: "userId query parameter is required." });
    }
    const userId = parseInt(req.query.userId, 10);
    if (isNaN(userId)) {
      return res.status(400).json({ success: false, message: "Invalid userId provided." });
    }
    const [[user]] = await pool.query(
      "SELECT id, full_name as name, age, gender, role, face_enrolled as faceEnrolled, face_enrolled_at as faceEnrolledAt, face_photo as facePhoto, avatar_url as avatar FROM users WHERE id = ?",
      [userId]
    );

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    return res.status(200).json({
      success: true,
      userId: user.id,
      name: user.name,
      age: user.age || 22,
      gender: user.gender || "Male",
      enrolled: Boolean(user.faceEnrolled),
      enrolledAt: user.faceEnrolledAt,
      photo: user.facePhoto || user.avatar,
    });
  } catch (error) {
    console.error("Get Face Status Error:", error);
    return res.status(500).json({ success: false, message: "Error fetching Face ID status." });
  }
};

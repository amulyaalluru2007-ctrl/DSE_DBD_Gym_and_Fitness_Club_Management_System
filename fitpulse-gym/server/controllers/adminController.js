import bcrypt from "bcryptjs";
import { pool } from "../config/db.js";
import { broadcastEvent } from "../socket.js";

/* =====================================================
   ADMIN OVERVIEW METRICS
===================================================== */
export const getAdminOverview = async (req, res) => {
  try {
    const [[{ totalTrainers }]] = await pool.query(
      "SELECT COUNT(*) as totalTrainers FROM users WHERE role = 'Trainer'"
    );
    const [[{ totalMembers }]] = await pool.query(
      "SELECT COUNT(*) as totalMembers FROM users WHERE role = 'Member'"
    );
    const [[{ pendingQueries }]] = await pool.query(
      "SELECT COUNT(*) as pendingQueries FROM member_queries WHERE status = 'Pending'"
    );
    const [[{ activeWorkouts }]] = await pool.query(
      "SELECT COUNT(*) as activeWorkouts FROM workouts WHERE status = 'In Progress'"
    );

    return res.status(200).json({
      success: true,
      data: {
        totalTrainers,
        totalMembers,
        pendingQueries,
        activeWorkouts,
      },
    });
  } catch (error) {
    console.error("Admin Overview Error:", error);
    return res.status(500).json({ success: false, message: "Error fetching admin overview." });
  }
};

/* =====================================================
   TRAINER MANAGEMENT
===================================================== */
export const getAllTrainers = async (req, res) => {
  try {
    const [trainers] = await pool.query(`
      SELECT 
        u.id,
        u.full_name as name,
        u.email,
        u.personal_email as personalEmail,
        u.personal_email,
        u.specialty,
        u.phone,
        u.avatar_url as avatar,
        u.bio,
        COALESCE(u.monthly_fee, 2999) as monthly_fee,
        (SELECT COUNT(*) FROM trainee_assignments ta WHERE ta.trainer_id = u.id AND ta.status = 'Active') as activeTraineeCount,
        (SELECT COUNT(*) FROM trainee_assignments ta WHERE ta.trainer_id = u.id AND ta.status = 'Active') as trainee_count
      FROM users u
      WHERE u.role = 'Trainer'
      ORDER BY u.created_at DESC
    `);

    return res.status(200).json({
      success: true,
      trainers,
    });
  } catch (error) {
    console.error("Admin Get Trainers Error:", error);
    return res.status(500).json({ success: false, message: "Error fetching trainers." });
  }
};

export const createTrainer = async (req, res) => {
  try {
    const { name, email, password, personalEmail, specialty, phone } = req.body;
    const monthlyFee = Number(req.body.monthly_fee || req.body.price || 2999);

    if (!name || !email || !password || !personalEmail) {
      return res.status(400).json({
        success: false,
        message: "Full name, corporate email, password, and linked personal Gmail are required.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPersonal = personalEmail.trim().toLowerCase();

    // Check if corporate email already exists
    const [existing] = await pool.query("SELECT id FROM users WHERE email = ?", [normalizedEmail]);
    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: "An account with this corporate email already exists.",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const trainerMembershipId = `FP-TRAINER-${Math.floor(100 + Math.random() * 900)}`;

    const [insertResult] = await pool.query(
      `INSERT INTO users (full_name, email, personal_email, specialty, phone, password_hash, role, membership_id, avatar_url, monthly_fee)
       VALUES (?, ?, ?, ?, ?, ?, 'Trainer', ?, 'https://images.unsplash.com/photo-1567013127542-490d757e51fc?w=160&auto=format&fit=crop&q=80', ?)`,
      [
        name,
        normalizedEmail,
        normalizedPersonal,
        specialty || "Performance Coach",
        phone || "+1 (555) 019-2831",
        passwordHash,
        trainerMembershipId,
        monthlyFee,
      ]
    );

    const newTrainer = {
      id: insertResult.insertId,
      name,
      email: normalizedEmail,
      personalEmail: normalizedPersonal,
      specialty: specialty || "Performance Coach",
      monthly_fee: monthlyFee,
      activeTraineeCount: 0,
      avatar: "https://images.unsplash.com/photo-1567013127542-490d757e51fc?w=160&auto=format&fit=crop&q=80",
    };

    broadcastEvent("trainer:created", {
      trainer: newTrainer,
      title: "New Coach Provisioned",
      message: `${name} has been added to the FitPulse Master Coach Roster at ₹${monthlyFee}/mo.`,
    });

    return res.status(201).json({
      success: true,
      trainer: newTrainer,
      message: `Trainer ${name} created successfully with monthly rate ₹${monthlyFee}.`,
    });
  } catch (error) {
    console.error("Admin Create Trainer Error:", error);
    return res.status(500).json({ success: false, message: "Error creating trainer." });
  }
};

export const updateTrainerProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const trainerName = req.body.full_name || req.body.name || null;
    const trainerAvatar = req.body.avatar_url || req.body.avatar || null;
    const trainerBio = req.body.bio !== undefined ? req.body.bio : null;
    const trainerSpecialty = req.body.specialty || null;

    await pool.query(
      `UPDATE users SET
         full_name = COALESCE(?, full_name),
         avatar_url = COALESCE(?, avatar_url),
         bio = COALESCE(?, bio),
         specialty = COALESCE(?, specialty)
       WHERE id = ? AND role = 'Trainer'`,
      [trainerName, trainerAvatar, trainerBio, trainerSpecialty, id]
    );

    const [[updated]] = await pool.query(
      "SELECT id, full_name as name, email, specialty, phone, avatar_url as avatar, bio, monthly_fee FROM users WHERE id = ?",
      [id]
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: "Trainer not found." });
    }

    broadcastEvent("trainer:updated", updated);

    return res.status(200).json({
      success: true,
      trainer: updated,
      message: "Trainer profile updated successfully in database!",
    });
  } catch (error) {
    console.error("Update Trainer Profile Error:", error);
    return res.status(500).json({ success: false, message: "Error updating trainer profile." });
  }
};

/* =====================================================
   MEMBER DIRECTORY & COACH ASSIGNMENT
===================================================== */
export const getAllMembers = async (req, res) => {
  try {
    const [members] = await pool.query(`
      SELECT 
        u.id,
        u.full_name as name,
        u.email,
        u.phone,
        u.gender,
        u.height_cm as height,
        u.weight_kg as weight,
        u.goal,
        u.membership_id as membershipId,
        COALESCE(u.gym_membership_plan, m.plan_name, 'No Active Plan') as planName,
        u.gym_membership_active as gymMembershipActive,
        u.gym_membership_duration as gymMembershipDuration,
        u.gym_membership_expires_at as gymMembershipExpiresAt,
        u.trainer_fee_paid as trainerFeePaid,
        COALESCE(m.status, 'Active') as billingStatus,
        COALESCE(m.price_monthly, 1499.00) as monthlyAmount,
        COALESCE(m.renewal_date, 'Active') as renewalDate,
        COALESCE(m.payment_method, 'Cashfree PG') as paymentMethod,
        u.avatar_url as avatar,
        ta.trainer_id as assignedTrainerId,
        t.full_name as assignedTrainerName,
        (SELECT COUNT(*) FROM attendance a WHERE a.user_id = u.id) as attendanceVisits
      FROM users u
      LEFT JOIN memberships m ON u.id = m.user_id
      LEFT JOIN trainee_assignments ta ON u.id = ta.member_id AND ta.status = 'Active'
      LEFT JOIN users t ON ta.trainer_id = t.id
      WHERE u.role = 'Member'
      ORDER BY u.created_at DESC
    `);

    return res.status(200).json({
      success: true,
      members,
    });
  } catch (error) {
    console.error("Admin Get Members Error:", error);
    return res.status(500).json({ success: false, message: "Error fetching members." });
  }
};

export const assignTrainerToMember = async (req, res) => {
  try {
    const { memberId, trainerId } = req.body;

    if (!memberId) {
      return res.status(400).json({ success: false, message: "Member ID is required." });
    }

    if (!trainerId || trainerId === "none" || Number(trainerId) === 0) {
      // Unassign trainer
      await pool.query("UPDATE trainee_assignments SET status = 'Released' WHERE member_id = ?", [memberId]);
      await pool.query("UPDATE users SET trainer_id = NULL WHERE id = ?", [memberId]);
      return res.status(200).json({ success: true, message: "Coach unassigned successfully." });
    }

    // Deactivate previous active assignment
    await pool.query(
      "UPDATE trainee_assignments SET status = 'Reassigned' WHERE member_id = ?",
      [memberId]
    );

    // Insert new active assignment
    await pool.query(
      "INSERT INTO trainee_assignments (trainer_id, member_id, status) VALUES (?, ?, 'Active')",
      [trainerId, memberId]
    );

    // Keep users table in sync
    await pool.query("UPDATE users SET trainer_id = ? WHERE id = ?", [trainerId, memberId]);

    const [[trainer]] = await pool.query("SELECT full_name FROM users WHERE id = ?", [trainerId]);
    const [[member]] = await pool.query("SELECT full_name FROM users WHERE id = ?", [memberId]);

    broadcastEvent("trainee:assigned", {
      memberId,
      trainerId,
      trainerName: trainer?.full_name,
      memberName: member?.full_name,
      title: "Coach Assigned",
      message: `${member?.full_name} is now assigned to Coach ${trainer?.full_name}.`,
    });

    return res.status(200).json({
      success: true,
      message: `Assigned ${member?.full_name} to Coach ${trainer?.full_name}.`,
    });
  } catch (error) {
    console.error("Assign Trainer Error:", error);
    return res.status(500).json({ success: false, message: "Error assigning trainer." });
  }
};

/* =====================================================
   MEMBER QUERY HELPDESK
===================================================== */
export const getMemberQueries = async (req, res) => {
  try {
    const [queries] = await pool.query(`
      SELECT 
        q.id,
        q.member_id as memberId,
        q.member_name as memberName,
        q.member_email as memberEmail,
        q.category,
        q.subject,
        q.message,
        q.status,
        q.admin_notes as adminNotes,
        q.created_at as createdAt,
        COALESCE(m.plan_name, 'Elite Black Card') as planName,
        u.avatar_url as avatar
      FROM member_queries q
      LEFT JOIN users u ON q.member_id = u.id
      LEFT JOIN memberships m ON q.member_id = m.user_id
      ORDER BY 
        CASE WHEN q.status = 'Pending' THEN 0 ELSE 1 END,
        q.created_at DESC
    `);

    return res.status(200).json({
      success: true,
      queries,
    });
  } catch (error) {
    console.error("Admin Get Queries Error:", error);
    return res.status(500).json({ success: false, message: "Error fetching member queries." });
  }
};

export const resolveMemberQuery = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminNotes, status } = req.body;

    await pool.query(
      "UPDATE member_queries SET status = ?, admin_notes = ? WHERE id = ?",
      [status || "Resolved", adminNotes || "Resolved by Admin", id]
    );

    broadcastEvent("query:resolved", {
      queryId: id,
      status: status || "Resolved",
      title: "Query Resolved",
      message: `Support ticket #${id} has been resolved by Administration.`,
    });

    return res.status(200).json({
      success: true,
      message: `Query #${id} marked as ${status || "Resolved"}.`,
    });
  } catch (error) {
    console.error("Resolve Query Error:", error);
    return res.status(500).json({ success: false, message: "Error resolving query." });
  }
};

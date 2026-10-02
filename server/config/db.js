import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { migrateChangeRequests } from "../migrate_change_requests.js";

dotenv.config();

// Create master pool
export const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "Happy@2007",
  database: process.env.DB_NAME || "fitpulse_gym",
  port: parseInt(process.env.DB_PORT || "3306", 10),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export const initializeDatabase = async () => {
  try {
    // 1. Connect without DB first to ensure fitpulse_gym database exists
    const rootConn = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "Happy@2007",
      port: parseInt(process.env.DB_PORT || "3306", 10),
    });

    await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME || "fitpulse_gym"}\`;`);
    await rootConn.end();

    console.log(`[MySQL] Database "${process.env.DB_NAME || "fitpulse_gym"}" verified.`);

    // 2. Create Schema Tables using pool
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        full_name VARCHAR(100) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        phone VARCHAR(50),
        gender VARCHAR(30) DEFAULT 'Not Specified',
        age INT DEFAULT 22,
        password_hash VARCHAR(255) NOT NULL,
        goal VARCHAR(50) DEFAULT 'Build Muscle',
        role VARCHAR(30) DEFAULT 'Member',
        membership_id VARCHAR(50) DEFAULT 'FP-8849-ELITE',
        height_cm DECIMAL(5,2) DEFAULT 180.0,
        weight_kg DECIMAL(5,2) DEFAULT 72.4,
        emergency_contact VARCHAR(150) DEFAULT 'Sarah Carter (+91 98765 43211)',
        avatar_url LONGTEXT,
        face_descriptor LONGTEXT,
        face_photo LONGTEXT,
        face_enrolled TINYINT(1) DEFAULT 0,
        face_enrolled_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Auto-migrate users columns if missing
    try {
      const [cols] = await pool.query("DESCRIBE users");
      const colNames = cols.map((c) => c.Field);
      if (!colNames.includes("age")) {
        await pool.query("ALTER TABLE users ADD COLUMN age INT DEFAULT 22 AFTER gender");
      }
      if (!colNames.includes("face_descriptor")) {
        await pool.query("ALTER TABLE users ADD COLUMN face_descriptor LONGTEXT DEFAULT NULL");
      }
      if (!colNames.includes("face_photo")) {
        await pool.query("ALTER TABLE users ADD COLUMN face_photo LONGTEXT DEFAULT NULL");
      }
      if (!colNames.includes("face_enrolled")) {
        await pool.query("ALTER TABLE users ADD COLUMN face_enrolled TINYINT(1) DEFAULT 0");
      }
      if (!colNames.includes("face_enrolled_at")) {
        await pool.query("ALTER TABLE users ADD COLUMN face_enrolled_at TIMESTAMP NULL DEFAULT NULL");
      }
    } catch (e) {
      console.warn("Users table migration check notice:", e.message);
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS attendance (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        terminal VARCHAR(100) NOT NULL,
        status VARCHAR(50) DEFAULT 'Verified In',
        duration VARCHAR(50) DEFAULT 'Active Now',
        scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        scan_date DATE DEFAULT (CURRENT_DATE)
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS workouts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        title VARCHAR(150) NOT NULL,
        phase VARCHAR(50) DEFAULT 'Phase II',
        status VARCHAR(50) DEFAULT 'In Progress',
        volume_kg INT DEFAULT 18400,
        duration_mins INT DEFAULT 48,
        assigned_date DATE DEFAULT (CURRENT_DATE),
        notes TEXT
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS workout_exercises (
        id INT AUTO_INCREMENT PRIMARY KEY,
        workout_id INT,
        name VARCHAR(150) NOT NULL,
        target VARCHAR(100),
        sets VARCHAR(50),
        reps VARCHAR(50),
        weight VARCHAR(50),
        completed BOOLEAN DEFAULT FALSE
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS progress_records (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        lift_name VARCHAR(100) NOT NULL,
        weight_kg DECIMAL(5,2) NOT NULL,
        previous_weight_kg DECIMAL(5,2) NOT NULL,
        badge VARCHAR(50),
        recorded_at DATE DEFAULT (CURRENT_DATE)
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS trainer_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        trainer_name VARCHAR(100) NOT NULL,
        member_name VARCHAR(100),
        title VARCHAR(150) NOT NULL,
        session_time VARCHAR(100) NOT NULL,
        total_slots INT DEFAULT 10,
        booked_slots INT DEFAULT 7,
        status VARCHAR(50) DEFAULT 'Confirmed'
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS nutrition_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        meal_name VARCHAR(150) NOT NULL,
        calories INT NOT NULL,
        protein INT NOT NULL,
        carbs INT NOT NULL,
        fats INT NOT NULL,
        time_logged VARCHAR(50),
        log_date DATE DEFAULT (CURRENT_DATE)
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS memberships (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        plan_name VARCHAR(100) DEFAULT 'Pro Athlete Tier',
        price_monthly DECIMAL(8,2) DEFAULT 3999.00,
        status VARCHAR(50) DEFAULT 'Active',
        renewal_date VARCHAR(50) DEFAULT '28 October 2026',
        payment_method VARCHAR(100) DEFAULT 'UPI • NetBanking'
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        invoice_code VARCHAR(50) NOT NULL,
        amount VARCHAR(50) NOT NULL,
        status VARCHAR(50) DEFAULT 'Paid',
        payment_date VARCHAR(50)
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS community_posts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        author_name VARCHAR(100) NOT NULL,
        author_role VARCHAR(100),
        author_avatar TEXT,
        badge VARCHAR(50),
        content TEXT NOT NULL,
        likes_count INT DEFAULT 0,
        comments_count INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        type VARCHAR(50) DEFAULT 'info',
        title VARCHAR(150) NOT NULL,
        message TEXT NOT NULL,
        read_status BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    try {
      await pool.query("ALTER TABLE users ADD COLUMN personal_email VARCHAR(150);");
    } catch {
      /* column may already exist */
    }
    try {
      await pool.query("ALTER TABLE users ADD COLUMN specialty VARCHAR(100);");
    } catch {
      /* column may already exist */
    }
    try {
      await pool.query("ALTER TABLE users ADD COLUMN gym_membership_active TINYINT(1) DEFAULT 0;");
      await pool.query("ALTER TABLE users ADD COLUMN gym_membership_plan VARCHAR(100) DEFAULT NULL;");
      await pool.query("ALTER TABLE users ADD COLUMN gym_membership_duration VARCHAR(50) DEFAULT NULL;");
      await pool.query("ALTER TABLE users ADD COLUMN gym_membership_expires_at DATETIME DEFAULT NULL;");
      await pool.query("ALTER TABLE users ADD COLUMN gym_membership_paid_at DATETIME DEFAULT NULL;");
      await pool.query("ALTER TABLE users ADD COLUMN trainer_id INT DEFAULT NULL;");
      await pool.query("ALTER TABLE users ADD COLUMN trainer_fee_paid TINYINT(1) DEFAULT 0;");
      await pool.query("ALTER TABLE users ADD COLUMN trainer_fee_expires_at DATETIME DEFAULT NULL;");
    } catch {
      /* columns may already exist */
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id VARCHAR(100) UNIQUE NOT NULL,
        cf_order_id VARCHAR(100),
        cf_payment_id VARCHAR(100),
        user_id INT NOT NULL,
        user_name VARCHAR(150),
        user_email VARCHAR(150),
        payment_type ENUM('gym_membership', 'trainer_fee') NOT NULL,
        plan_duration VARCHAR(50),
        plan_name VARCHAR(150),
        trainer_id INT DEFAULT NULL,
        trainer_name VARCHAR(150) DEFAULT NULL,
        amount DECIMAL(10,2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'INR',
        payment_status VARCHAR(50) DEFAULT 'PENDING',
        payment_method VARCHAR(100) DEFAULT 'Cashfree PG',
        payment_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME,
        raw_response LONGTEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS trainee_assignments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        trainer_id INT NOT NULL,
        member_id INT NOT NULL,
        status VARCHAR(50) DEFAULT 'Active',
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sender_id INT NOT NULL,
        sender_name VARCHAR(100) NOT NULL,
        sender_role VARCHAR(50) NOT NULL,
        receiver_id INT NOT NULL,
        receiver_name VARCHAR(100),
        channel_type VARCHAR(50) DEFAULT 'member_trainer',
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS member_queries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        member_id INT NOT NULL,
        member_name VARCHAR(100) NOT NULL,
        member_email VARCHAR(150) NOT NULL,
        category VARCHAR(100) DEFAULT 'General',
        subject VARCHAR(200) NOT NULL,
        message TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'Pending',
        admin_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Seed Default Accounts (Admin, Trainers, Member)
    // 3.1 Admin
    const [adminCheck] = await pool.query("SELECT id FROM users WHERE email = 'admin@fitpulse.com'");
    let adminId;
    if (adminCheck.length === 0) {
      const [adminRes] = await pool.query(`
        INSERT INTO users (full_name, email, phone, gender, password_hash, goal, role, membership_id, avatar_url)
        VALUES (
          'System Administrator',
          'admin@fitpulse.com',
          '+1 (800) 555-0199',
          'Not Specified',
          '$2a$10$7Zz3R10uP66QzYn6N.D/k.aLw.3o2y0rZ24kXvT.b6V1lM92s.G8i',
          'Platform Governance',
          'Admin',
          'FP-ADMIN-01',
          'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=160&auto=format&fit=crop&q=80'
        );
      `);
      adminId = adminRes.insertId;
      console.log("[MySQL] Admin account created: admin@fitpulse.com / Admin@2026");
    } else {
      adminId = adminCheck[0].id;
    }

    // 3.2 Trainer: Alex Carter
    const [alexCheck] = await pool.query("SELECT id FROM users WHERE email = 'alex@fitpulse.com'");
    let alexId;
    if (alexCheck.length === 0) {
      const [alexRes] = await pool.query(`
        INSERT INTO users (full_name, email, personal_email, specialty, phone, gender, password_hash, goal, role, membership_id, avatar_url)
        VALUES (
          'Alex Carter',
          'alex@fitpulse.com',
          'alexcarter.coach@gmail.com',
          'Head Strength & Hypertrophy',
          '+1 (555) 014-9921',
          'Male',
          '$2a$10$7Zz3R10uP66QzYn6N.D/k.aLw.3o2y0rZ24kXvT.b6V1lM92s.G8i',
          'Strength & Hypertrophy',
          'Trainer',
          'FP-TRAINER-01',
          'https://images.unsplash.com/photo-1567013127542-490d757e51fc?w=160&auto=format&fit=crop&q=80'
        );
      `);
      alexId = alexRes.insertId;
      console.log("[MySQL] Trainer account created: alex@fitpulse.com (Personal: alexcarter.coach@gmail.com) / Coach@2026");
    } else {
      alexId = alexCheck[0].id;
      // Ensure personal email is set
      await pool.query("UPDATE users SET personal_email = 'alexcarter.coach@gmail.com', specialty = 'Head Strength & Hypertrophy', role = 'Trainer' WHERE id = ?", [alexId]);
    }

    // 3.3 Trainer: Sarah Jenkins
    const [sarahCheck] = await pool.query("SELECT id FROM users WHERE email = 'sarah@fitpulse.com'");
    let sarahId;
    if (sarahCheck.length === 0) {
      const [sarahRes] = await pool.query(`
        INSERT INTO users (full_name, email, personal_email, specialty, phone, gender, password_hash, goal, role, membership_id, avatar_url)
        VALUES (
          'Sarah Jenkins',
          'sarah@fitpulse.com',
          'sarahjenkins.coach@gmail.com',
          'Kinematics & Conditioning',
          '+1 (555) 018-4432',
          'Female',
          '$2a$10$7Zz3R10uP66QzYn6N.D/k.aLw.3o2y0rZ24kXvT.b6V1lM92s.G8i',
          'Conditioning & Agility',
          'Trainer',
          'FP-TRAINER-02',
          'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=160&auto=format&fit=crop&q=80'
        );
      `);
      sarahId = sarahRes.insertId;
      console.log("[MySQL] Trainer account created: sarah@fitpulse.com (Personal: sarahjenkins.coach@gmail.com) / Coach@2026");
    } else {
      sarahId = sarahCheck[0].id;
      await pool.query("UPDATE users SET personal_email = 'sarahjenkins.coach@gmail.com', specialty = 'Kinematics & Conditioning', role = 'Trainer' WHERE id = ?", [sarahId]);
    }

    // 3.4 Member: Nihal Carter
    const [existingUsers] = await pool.query("SELECT id FROM users WHERE email = 'nihal@fitpulse.com'");
    let memberId;
    if (existingUsers.length === 0) {
      const [insertUser] = await pool.query(`
        INSERT INTO users (full_name, email, phone, gender, password_hash, goal, role, membership_id, avatar_url)
        VALUES (
          'Nihal Carter',
          'nihal@fitpulse.com',
          '+91 98765 43210',
          'Male',
          '$2a$10$7Zz3R10uP66QzYn6N.D/k.aLw.3o2y0rZ24kXvT.b6V1lM92s.G8i',
          'Build Muscle',
          'Member',
          'FP-8849-ELITE',
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&auto=format&fit=crop&q=80'
        );
      `);
      memberId = insertUser.insertId;

      // Seed Initial Attendance
      await pool.query(`
        INSERT INTO attendance (user_id, terminal, status, duration, scanned_at)
        VALUES 
          (${memberId}, 'Turnstile #02 (Main Entrance)', 'Verified In', 'Active Now', NOW()),
          (${memberId}, 'Turnstile #01 (Free Weights)', 'Completed', '1h 45m', DATE_SUB(NOW(), INTERVAL 1 DAY)),
          (${memberId}, 'Turnstile #02 (Main Entrance)', 'Completed', '1h 30m', DATE_SUB(NOW(), INTERVAL 2 DAY));
      `);

      // Seed Initial Workout
      const [workoutRes] = await pool.query(`
        INSERT INTO workouts (user_id, title, phase, status, volume_kg, duration_mins)
        VALUES (${memberId}, 'Hypertrophy Push: Phase II', 'Phase II', 'In Progress', 18400, 48);
      `);
      const workoutId = workoutRes.insertId;

      await pool.query(`
        INSERT INTO workout_exercises (workout_id, name, target, sets, reps, weight, completed)
        VALUES
          (${workoutId}, 'Incline Dumbbell Bench Press', 'Upper Pectorals', '4 sets', '8-10 reps', '36 kg', TRUE),
          (${workoutId}, 'Barbell Flat Bench Press', 'Mid Chest', '4 sets', '6 reps', '90 kg', TRUE),
          (${workoutId}, 'Weighted Chest Dips', 'Lower Chest & Triceps', '3 sets', '10 reps', '+20 kg', FALSE),
          (${workoutId}, 'Cable Lateral Deltoid Raises', 'Lateral Deltoids', '4 sets', '15 reps', '14 kg', FALSE);
      `);

      // Seed Initial PRs
      await pool.query(`
        INSERT INTO progress_records (user_id, lift_name, weight_kg, previous_weight_kg, badge)
        VALUES
          (${memberId}, 'Conventional Deadlift', 160.0, 145.0, '+15 kg PR 🚀'),
          (${memberId}, 'Barbell Bench Press', 105.0, 100.0, '+5 kg PR ⚡'),
          (${memberId}, 'High Bar Back Squat', 140.0, 130.0, '+10 kg PR 🏆'),
          (${memberId}, 'Standing Overhead Press', 72.5, 70.0, '+2.5 kg PR ✨');
      `);

      // Seed Initial Trainer Session
      await pool.query(`
        INSERT INTO trainer_sessions (trainer_name, member_name, title, session_time, total_slots, booked_slots, status)
        VALUES
          ('Alex Carter', 'Nihal Carter', '1-on-1 Upper Biomechanics', 'Tomorrow @ 10:00 AM', 10, 7, 'Confirmed'),
          ('Sarah Jenkins', NULL, 'Athletic VO2 Max & Agility', 'Tuesday @ 04:00 PM', 10, 5, 'Open'),
          ('Marcus Vance', NULL, 'Olympic Snatch Diagnostic', 'Wednesday @ 06:30 PM', 8, 8, 'Sold Out');
      `);

      // Seed Membership & Invoices
      await pool.query(`
        INSERT INTO memberships (user_id, plan_name, price_monthly, status, renewal_date, payment_method)
        VALUES (${memberId}, 'Elite Black Card', 6999.00, 'Active', '28 October 2026', 'UPI • GPay');
      `);

      await pool.query(`
        INSERT INTO invoices (user_id, invoice_code, amount, status, payment_date)
        VALUES
          (${memberId}, 'INV-2026-009', '₹6,999.00', 'Paid', 'Sep 12, 2026'),
          (${memberId}, 'INV-2026-008', '₹6,999.00', 'Paid', 'Aug 12, 2026'),
          (${memberId}, 'INV-2026-007', '₹3,999.00', 'Paid', 'Jul 12, 2026');
      `);

      // Seed Initial Community Post
      await pool.query(`
        INSERT INTO community_posts (author_name, author_role, author_avatar, badge, content, likes_count, comments_count)
        VALUES
          ('Elena Rostova', 'Athlete Member', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80', 'PR ALERT 🏆', 'Hit a new deadlift personal record today at 145kg! Massive thanks to Coach Alex Carter for dialing in my hip drive cue.', 42, 8),
          ('Marcus Vance', 'Head Strength Coach', 'https://images.unsplash.com/photo-1567013127542-490d757e51fc?w=120&auto=format&fit=crop&q=80', 'COACH ADVICE 💡', 'Reminder for the evening hypertrophy squad: don''t neglect your eccentric control on dumbbell incline presses.', 89, 15);
      `);

      // Seed Initial Notifications
      await pool.query(`
        INSERT INTO notifications (user_id, type, title, message)
        VALUES
          (${memberId}, 'coach', 'Coach Alex Carter', 'Ready for tomorrow''s 10:00 AM session? Focus on scapular retraction on presses.'),
          (${memberId}, 'turnstile', 'Turnstile Gate #02', 'Checked in today at 07:15 AM. 24-Day Discipline Streak active 🔥');
      `);

      console.log("[MySQL] Seed data created for Nihal Carter.");
    } else {
      memberId = existingUsers[0].id;
    }

    // 4. Seed Trainee Assignment (Alex Carter -> Nihal Carter)
    const [assignCheck] = await pool.query("SELECT id FROM trainee_assignments WHERE trainer_id = ? AND member_id = ?", [alexId, memberId]);
    if (assignCheck.length === 0) {
      await pool.query(
        "INSERT INTO trainee_assignments (trainer_id, member_id, status) VALUES (?, ?, 'Active')",
        [alexId, memberId]
      );
      console.log("[MySQL] Trainee assignment created: Alex Carter -> Nihal Carter.");
    }

    // 5. Seed Initial Chat Messages (Alex <-> Nihal and Admin <-> Alex)
    const [chatCheck] = await pool.query("SELECT id FROM chat_messages LIMIT 1");
    if (chatCheck.length === 0) {
      await pool.query(`
        INSERT INTO chat_messages (sender_id, sender_name, sender_role, receiver_id, receiver_name, channel_type, message, created_at)
        VALUES
          (${alexId}, 'Alex Carter', 'Trainer', ${memberId}, 'Nihal Carter', 'member_trainer', 'Hey Nihal! Great work on yesterday\\'s deadlifts. Did the hip hinge cue feel more natural?', DATE_SUB(NOW(), INTERVAL 2 HOUR)),
          (${memberId}, 'Nihal Carter', 'Member', ${alexId}, 'Alex Carter', 'member_trainer', 'Yes coach! Zero lower back discomfort today and felt way more lat engagement.', DATE_SUB(NOW(), INTERVAL 90 MINUTE)),
          (${alexId}, 'Alex Carter', 'Trainer', ${memberId}, 'Nihal Carter', 'member_trainer', 'Fantastic! Keep that same abdominal bracing tomorrow for our heavy incline press session.', DATE_SUB(NOW(), INTERVAL 45 MINUTE)),
          (${adminId}, 'System Administrator', 'Admin', ${alexId}, 'Alex Carter', 'admin_trainer', 'Coach Alex, please note the new Olympic platform calibration scheduled for Friday.', DATE_SUB(NOW(), INTERVAL 1 DAY)),
          (${alexId}, 'Alex Carter', 'Trainer', ${adminId}, 'System Administrator', 'admin_trainer', 'Understood Admin. I will route my morning athlete squad to racks 3 and 4.', DATE_SUB(NOW(), INTERVAL 20 HOUR));
      `);
      console.log("[MySQL] Seed chat messages created.");
    }

    // 6. Seed Initial Member Query for Admin Query Box
    const [queryCheck] = await pool.query("SELECT id FROM member_queries LIMIT 1");
    if (queryCheck.length === 0) {
      await pool.query(`
        INSERT INTO member_queries (member_id, member_name, member_email, category, subject, message, status)
        VALUES
          (${memberId}, 'Nihal Carter', 'nihal@fitpulse.com', 'Access/Turnstile', 'Request for Secondary RFID Keyfob', 'Hi Admin team, would like to request a physical backup RFID keyfob in addition to my phone QR pass for campus turnstiles.', 'Pending'),
          (${memberId}, 'Nihal Carter', 'nihal@fitpulse.com', 'Equipment', 'Cryo Chamber Cold Plunge Slot Reservation', 'Can I schedule a 15-minute recovery slot after my workout tomorrow with Coach Alex at 11:30 AM?', 'Resolved');
      `);
      console.log("[MySQL] Seed member queries created for Admin Helpdesk.");
    }

    // 7. Auto-run Change Requests & Notifications Migration
    await migrateChangeRequests();

    console.log("[MySQL] Tables and credentials initialized successfully.");
  } catch (error) {
    console.error("[MySQL] Initialization error:", error.message);
    throw error;
  }
};

export default initializeDatabase;
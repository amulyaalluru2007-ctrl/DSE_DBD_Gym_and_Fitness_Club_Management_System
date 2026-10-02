import { pool } from "./config/db.js";

export const migrateChangeRequests = async () => {
  console.log("[Migration] Running Trainer Change Request & Notification System Migration...");

  try {
    // 1. Add trainer monthly_fee column if not present
    try {
      await pool.query("ALTER TABLE users ADD COLUMN monthly_fee DECIMAL(10,2) DEFAULT 2999.00;");
    } catch {
      /* column may already exist */
    }

    try {
      await pool.query("ALTER TABLE payments MODIFY COLUMN payment_type VARCHAR(60) NOT NULL;");
    } catch {
      /* ignore */
    }

    // Set standard monthly fees for existing trainers
    await pool.query("UPDATE users SET monthly_fee = 2999.00 WHERE id = 4;"); // Alex Carter
    await pool.query("UPDATE users SET monthly_fee = 2799.00 WHERE id = 5;"); // Sarah Jenkins
    await pool.query("UPDATE users SET monthly_fee = 3499.00 WHERE id = 6;"); // Sai Sathwik
    await pool.query("UPDATE users SET monthly_fee = 2999.00 WHERE role = 'Trainer' AND monthly_fee IS NULL;");

    // 2. Table: trainer_assignments (Persistent historical assignment log)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS trainer_assignments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        member_id INT NOT NULL,
        trainer_id INT NOT NULL,
        status ENUM('Active', 'Ended', 'Transferred', 'Cancelled') DEFAULT 'Active',
        start_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        end_at DATETIME DEFAULT NULL,
        source_request_id INT DEFAULT NULL,
        notes TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_member (member_id),
        INDEX idx_trainer (trainer_id),
        INDEX idx_status (status)
      );
    `);

    // 3. Table: trainer_change_billing_adjustments
    await pool.query(`
      CREATE TABLE IF NOT EXISTS trainer_change_billing_adjustments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        request_id INT NOT NULL,
        member_id INT NOT NULL,
        current_trainer_fee_minor INT NOT NULL,
        new_trainer_fee_minor INT NOT NULL,
        currency VARCHAR(10) DEFAULT 'INR',
        billing_period_start DATE NOT NULL,
        billing_period_end DATE NOT NULL,
        effective_at DATETIME NOT NULL,
        remaining_eligible_days INT NOT NULL,
        total_billing_period_days INT NOT NULL,
        calculation_method VARCHAR(50) DEFAULT 'same_period_difference',
        credit_amount_minor INT DEFAULT 0,
        charge_amount_minor INT DEFAULT 0,
        tax_amount_minor INT DEFAULT 0,
        final_adjustment_minor INT NOT NULL,
        status ENUM('Pending', 'Payment Required', 'Paid', 'Credited', 'Refunded', 'Settled', 'Waived') DEFAULT 'Pending',
        calculation_snapshot LONGTEXT,
        payment_order_id VARCHAR(100) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_request (request_id),
        INDEX idx_member (member_id)
      );
    `);

    // 4. Table: trainer_change_requests
    await pool.query(`
      CREATE TABLE IF NOT EXISTS trainer_change_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        request_number VARCHAR(50) UNIQUE NOT NULL,
        request_type ENUM('member_change_trainer', 'trainer_remove_member') NOT NULL,
        initiated_by_user_id INT NOT NULL,
        member_id INT NOT NULL,
        current_trainer_id INT NOT NULL,
        preferred_trainer_id INT DEFAULT NULL,
        reason_code VARCHAR(100) NOT NULL,
        description TEXT,
        is_confidential TINYINT(1) DEFAULT 0,
        status ENUM('Submitted', 'Under Review', 'Awaiting Payment', 'Approved', 'Processing', 'Completed', 'Rejected', 'Withdrawn', 'On Hold', 'Action Required') DEFAULT 'Submitted',
        effective_at DATETIME DEFAULT NULL,
        billing_adjustment_id INT DEFAULT NULL,
        reviewed_by_admin_id INT DEFAULT NULL,
        reviewed_at DATETIME DEFAULT NULL,
        rejection_reason TEXT DEFAULT NULL,
        completed_at DATETIME DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        version INT DEFAULT 1,
        INDEX idx_member (member_id),
        INDEX idx_curr_trainer (current_trainer_id),
        INDEX idx_pref_trainer (preferred_trainer_id),
        INDEX idx_status (status)
      );
    `);

    // 5. Table: refunds_and_credits
    await pool.query(`
      CREATE TABLE IF NOT EXISTS refunds_and_credits (
        id INT AUTO_INCREMENT PRIMARY KEY,
        adjustment_id INT DEFAULT NULL,
        payment_id INT DEFAULT NULL,
        member_id INT NOT NULL,
        amount_minor INT NOT NULL,
        currency VARCHAR(10) DEFAULT 'INR',
        type ENUM('credit', 'refund') DEFAULT 'credit',
        status ENUM('Pending', 'Completed', 'Failed') DEFAULT 'Pending',
        gateway_refund_id VARCHAR(100) DEFAULT NULL,
        credit_ledger_reference VARCHAR(100) DEFAULT NULL,
        notes TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_member (member_id)
      );
    `);

    // 6. Migrate notifications table columns
    try {
      const [notifCols] = await pool.query("DESCRIBE notifications");
      const names = notifCols.map((c) => c.Field);
      if (!names.includes("recipient_user_id")) {
        await pool.query("ALTER TABLE notifications ADD COLUMN recipient_user_id INT AFTER id;");
        await pool.query("UPDATE notifications SET recipient_user_id = user_id WHERE recipient_user_id IS NULL;");
      }
      if (!names.includes("event_id")) {
        await pool.query("ALTER TABLE notifications ADD COLUMN event_id VARCHAR(100) DEFAULT NULL;");
      }
      if (!names.includes("category")) {
        await pool.query("ALTER TABLE notifications ADD COLUMN category VARCHAR(50) DEFAULT 'system';");
      }
      if (!names.includes("entity_type")) {
        await pool.query("ALTER TABLE notifications ADD COLUMN entity_type VARCHAR(50) DEFAULT NULL;");
      }
      if (!names.includes("entity_id")) {
        await pool.query("ALTER TABLE notifications ADD COLUMN entity_id VARCHAR(50) DEFAULT NULL;");
      }
      if (!names.includes("is_confidential")) {
        await pool.query("ALTER TABLE notifications ADD COLUMN is_confidential TINYINT(1) DEFAULT 0;");
      }
      if (!names.includes("read_at")) {
        await pool.query("ALTER TABLE notifications ADD COLUMN read_at DATETIME DEFAULT NULL;");
      }
    } catch (e) {
      console.warn("Notifications table migration check:", e.message);
    }

    // 7. Table: notification_deliveries (Tracks in-app, email, websocket delivery attempts)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notification_deliveries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        notification_id INT NOT NULL,
        recipient_email VARCHAR(150),
        channel ENUM('in_app', 'email', 'websocket', 'sms') NOT NULL,
        provider VARCHAR(50) DEFAULT 'fitpulse_internal',
        delivery_status ENUM('Queued', 'Sent', 'Delivered', 'Bounced', 'Failed', 'Retrying') DEFAULT 'Queued',
        subject VARCHAR(200),
        attempt_count INT DEFAULT 1,
        last_attempt_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        delivered_at DATETIME DEFAULT NULL,
        provider_message_id VARCHAR(150) DEFAULT NULL,
        last_error TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_notif (notification_id),
        INDEX idx_status (delivery_status)
      );
    `);

    // 8. Table: outbox_events (Transactional Outbox for Event-Driven Architecture)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS outbox_events (
        id INT AUTO_INCREMENT PRIMARY KEY,
        event_type VARCHAR(100) NOT NULL,
        aggregate_type VARCHAR(50) NOT NULL,
        aggregate_id VARCHAR(50) NOT NULL,
        payload LONGTEXT NOT NULL,
        status ENUM('Pending', 'Processed', 'Failed') DEFAULT 'Pending',
        attempt_count INT DEFAULT 0,
        available_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        processed_at DATETIME DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_status (status)
      );
    `);

    // 9. Table: audit_logs (Strict Append-Only Security Trail)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        actor_user_id INT,
        actor_role VARCHAR(50),
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        entity_id VARCHAR(50) NOT NULL,
        previous_state LONGTEXT DEFAULT NULL,
        new_state LONGTEXT DEFAULT NULL,
        ip_address VARCHAR(50) DEFAULT '127.0.0.1',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_entity (entity_type, entity_id),
        INDEX idx_actor (actor_user_id)
      );
    `);

    // 10. Seed active assignment for Nihal (User 1) with Sai Sathwik (Trainer 6)
    const [existingAssignment] = await pool.query(
      "SELECT id FROM trainer_assignments WHERE member_id = 1 AND trainer_id = 6 AND status = 'Active'"
    );
    if (existingAssignment.length === 0) {
      await pool.query(
        "INSERT INTO trainer_assignments (member_id, trainer_id, status, start_at) VALUES (1, 6, 'Active', DATE_SUB(NOW(), INTERVAL 14 DAY))"
      );
    }

    console.log("[Migration] Trainer Change Request & Notification System Migration Complete! ✓");
  } catch (err) {
    console.error("[Migration Error]:", err);
    throw err;
  }
};

if (process.argv[1]?.endsWith("migrate_change_requests.js")) {
  migrateChangeRequests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

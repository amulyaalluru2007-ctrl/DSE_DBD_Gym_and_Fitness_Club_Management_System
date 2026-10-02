import { pool } from "../config/db.js";
import { getIO, broadcastEvent } from "../socket.js";
import crypto from "crypto";

/**
 * FitPulse Centralized Notification & Outbox Dispatcher
 * Handles in-app notifications, delivery tracking, real-time Socket.io events,
 * and transactional email templates with brand-consistent dark glassmorphism styling.
 */

/**
 * Generate a brand-styled FitPulse transactional HTML email.
 */
export const generateFitPulseEmailHtml = ({ title, preheader, bodyLines = [], ctaText, ctaUrl, metadata = [] }) => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #06080e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f1f5f9; }
    .wrapper { width: 100%; max-width: 600px; margin: 0 auto; padding: 32px 16px; }
    .card { background: #0c1017; border: 1px solid rgba(56, 189, 248, 0.2); border-radius: 16px; padding: 32px; box-shadow: 0 10px 40px -10px rgba(0,0,0,0.7); }
    .header { border-bottom: 1px solid rgba(255, 255, 255, 0.08); padding-bottom: 20px; margin-bottom: 24px; }
    .logo { font-size: 24px; font-weight: 800; letter-spacing: -0.03em; color: #ffffff; }
    .logo-accent { color: #38bdf8; }
    .tag { display: inline-block; padding: 4px 10px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; border-radius: 9999px; background: rgba(56, 189, 248, 0.15); color: #38bdf8; margin-bottom: 12px; }
    .title { font-size: 20px; font-weight: 700; color: #ffffff; margin: 0 0 16px 0; }
    .body-p { font-size: 14px; line-height: 1.6; color: #94a3b8; margin: 0 0 12px 0; }
    .meta-box { background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 8px; padding: 14px; margin: 20px 0; }
    .meta-row { display: flex; justify-content: space-between; font-size: 13px; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.04); }
    .meta-row:last-child { border-bottom: none; }
    .meta-label { color: #64748b; }
    .meta-val { color: #f8fafc; font-weight: 600; }
    .cta-container { margin: 28px 0 16px 0; text-align: center; }
    .cta-btn { display: inline-block; background: linear-gradient(135deg, #0284c7, #38bdf8); color: #020617; font-weight: 700; font-size: 14px; padding: 12px 28px; text-decoration: none; border-radius: 8px; box-shadow: 0 4px 14px rgba(56, 189, 248, 0.3); }
    .footer { text-align: center; margin-top: 24px; font-size: 12px; color: #475569; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <div class="logo">FIT<span class="logo-accent">PULSE</span></div>
        <p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b;">Autonomous Gym Management Platform</p>
      </div>
      <div class="tag">Official System Notification</div>
      <h1 class="title">${title}</h1>
      ${bodyLines.map(line => `<p class="body-p">${line}</p>`).join("")}

      ${metadata.length > 0 ? `
        <div class="meta-box">
          ${metadata.map(m => `
            <div class="meta-row">
              <span class="meta-label">${m.label}:</span>
              <span class="meta-val">${m.value}</span>
            </div>
          `).join("")}
        </div>
      ` : ""}

      ${ctaText && ctaUrl ? `
        <div class="cta-container">
          <a href="${ctaUrl}" class="cta-btn">${ctaText}</a>
        </div>
      ` : ""}

      <div class="footer">
        <p>© ${new Date().getFullYear()} FitPulse Gym Management Systems. All rights reserved.</p>
        <p>This automated message was sent securely to your registered FitPulse profile.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
};

/**
 * Dispatch an in-app & multi-channel notification.
 * Persists in notifications, notification_deliveries, outbox_events,
 * and emits via Socket.io to target rooms.
 */
export const createNotification = async ({
  recipientUserId,
  category = "trainer_change",
  title,
  message,
  type = "info", // "info" | "success" | "warning" | "alert" | "payment"
  entityType = "trainer_change_request",
  entityId = null,
  isConfidential = false,
  emailSubject = null,
  emailBodyLines = [],
  emailMetadata = [],
  ctaText = null,
  ctaUrl = null,
  actorUserId = null,
  actorRole = "System",
}) => {
  const eventId = `evt_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

  try {
    // 1. Fetch recipient profile for delivery routing
    let recipientEmail = null;
    let recipientName = "Valued Member";
    if (recipientUserId) {
      const [[user]] = await pool.query(
        "SELECT id, full_name, email, role FROM users WHERE id = ?",
        [recipientUserId]
      );
      if (user) {
        recipientEmail = user.email;
        recipientName = user.full_name;
      }
    }

    // 2. Insert In-App Notification
    const [notifResult] = await pool.query(
      `INSERT INTO notifications 
       (recipient_user_id, user_id, event_id, category, entity_type, entity_id, is_confidential, title, message, type, read_status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW())`,
      [
        recipientUserId,
        recipientUserId,
        eventId,
        category,
        entityType,
        entityId ? String(entityId) : null,
        isConfidential ? 1 : 0,
        title,
        message,
        type,
      ]
    );
    const notificationId = notifResult.insertId;

    // 3. Insert Delivery Records (In-App & Email Channels)
    // In-App Delivery
    await pool.query(
      `INSERT INTO notification_deliveries 
       (notification_id, recipient_email, channel, provider, delivery_status, subject, attempt_count, delivered_at)
       VALUES (?, ?, 'in_app', 'fitpulse_internal', 'Delivered', ?, 1, NOW())`,
      [notificationId, recipientEmail, title]
    );

    // Email Delivery Log (Simulated / Transactional)
    if (recipientEmail) {
      const emailHtml = generateFitPulseEmailHtml({
        title: emailSubject || title,
        preheader: message,
        bodyLines: emailBodyLines.length > 0 ? emailBodyLines : [message],
        ctaText,
        ctaUrl,
        metadata: emailMetadata,
      });

      await pool.query(
        `INSERT INTO notification_deliveries 
         (notification_id, recipient_email, channel, provider, delivery_status, subject, attempt_count, delivered_at, provider_message_id)
         VALUES (?, ?, 'email', 'fitpulse_mail_engine', 'Sent', ?, 1, NOW(), ?)`,
        [notificationId, recipientEmail, emailSubject || title, `msg_${Date.now()}`]
      );
    }

    // 4. Record Transactional Outbox Event for Resilience
    const outboxPayload = JSON.stringify({
      notificationId,
      eventId,
      recipientUserId,
      recipientEmail,
      title,
      message,
      category,
      entityType,
      entityId,
      isConfidential,
      type,
      timestamp: new Date().toISOString(),
    });

    await pool.query(
      `INSERT INTO outbox_events 
       (event_type, aggregate_type, aggregate_id, payload, status, processed_at)
       VALUES (?, ?, ?, ?, 'Processed', NOW())`,
      [`notification.${category}`, entityType, entityId ? String(entityId) : String(notificationId), outboxPayload]
    );

    // 5. Real-Time Socket.io Broadcast
    const payload = {
      id: notificationId,
      recipient_user_id: recipientUserId,
      event_id: eventId,
      category,
      entity_type: entityType,
      entity_id: entityId,
      is_confidential: isConfidential,
      title,
      message,
      type,
      read_status: 0,
      created_at: new Date().toISOString(),
    };

    const io = getIO();
    if (io) {
      if (recipientUserId) {
        io.to(`user:${recipientUserId}`).emit("notification:new", payload);
      }
      // Broadcast to role channels if needed or global
      broadcastEvent("notification:new", payload);
    }

    return {
      success: true,
      notificationId,
      eventId,
    };
  } catch (err) {
    console.error("[NotificationService] Error creating notification:", err);
    throw err;
  }
};

/**
 * Fetch all notifications for a given user.
 */
export const getUserNotifications = async (userId, { limit = 30, unreadOnly = false, category = null } = {}) => {
  let query = `
    SELECT id, recipient_user_id, event_id, category, entity_type, entity_id, is_confidential, title, message, type, read_status, read_at, created_at
    FROM notifications
    WHERE (recipient_user_id = ? OR user_id = ?)
  `;
  const params = [userId, userId];

  if (unreadOnly) {
    query += " AND read_status = 0";
  }
  if (category) {
    query += " AND category = ?";
    params.push(category);
  }

  query += " ORDER BY created_at DESC LIMIT ?";
  params.push(parseInt(limit, 10));

  const [rows] = await pool.query(query, params);
  return rows;
};

/**
 * Count unread notifications for a user.
 */
export const getUnreadNotificationCount = async (userId) => {
  const [[result]] = await pool.query(
    "SELECT COUNT(*) AS unread_count FROM notifications WHERE (recipient_user_id = ? OR user_id = ?) AND read_status = 0",
    [userId, userId]
  );
  return Number(result?.unread_count || 0);
};

/**
 * Mark a specific notification as read.
 */
export const markNotificationRead = async (notificationId, userId) => {
  await pool.query(
    "UPDATE notifications SET read_status = 1, read_at = NOW() WHERE id = ? AND (recipient_user_id = ? OR user_id = ?)",
    [notificationId, userId, userId]
  );
  return { success: true };
};

/**
 * Mark all notifications as read for a user.
 */
export const markAllNotificationsRead = async (userId) => {
  await pool.query(
    "UPDATE notifications SET read_status = 1, read_at = NOW() WHERE (recipient_user_id = ? OR user_id = ?) AND read_status = 0",
    [userId, userId]
  );
  return { success: true };
};

/**
 * Append to audit log.
 */
export const logAudit = async ({
  actorUserId,
  actorRole = "Member",
  action,
  entityType,
  entityId,
  previousState = null,
  newState = null,
  ipAddress = "127.0.0.1",
}) => {
  try {
    await pool.query(
      `INSERT INTO audit_logs 
       (actor_user_id, actor_role, action, entity_type, entity_id, previous_state, new_state, ip_address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        actorUserId || null,
        actorRole,
        action,
        entityType,
        String(entityId),
        previousState ? JSON.stringify(previousState) : null,
        newState ? JSON.stringify(newState) : null,
        ipAddress,
      ]
    );
  } catch (err) {
    console.error("[AuditLog] Failed to record audit log:", err);
  }
};

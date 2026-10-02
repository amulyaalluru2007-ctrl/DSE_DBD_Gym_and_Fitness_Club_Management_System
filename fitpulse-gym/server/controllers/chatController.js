import { pool } from "../config/db.js";
import { broadcastEvent } from "../socket.js";
import { createNotification } from "../services/notificationService.js";

/* =====================================================
   CHAT CONTROLLER (MEMBER <-> TRAINER & ADMIN <-> TRAINER)
===================================================== */
export const getChatMessages = async (req, res) => {
  try {
    const user1Id = req.query.user1Id || req.query.user1_id;
    const user2Id = req.query.user2Id || req.query.user2_id;
    const channelType = req.query.channelType || req.query.channel_type || "member_trainer";

    if (!user1Id || !user2Id) {
      return res.status(400).json({ success: false, message: "user1Id and user2Id are required." });
    }

    const [rawMessages] = await pool.query(
      `SELECT 
         id,
         sender_id,
         sender_name,
         sender_role,
         receiver_id,
         receiver_name,
         channel_type,
         message,
         created_at
       FROM chat_messages
       WHERE channel_type = ?
         AND (
           (sender_id = ? AND receiver_id = ?) OR
           (sender_id = ? AND receiver_id = ?)
         )
       ORDER BY created_at ASC`,
      [channelType, user1Id, user2Id, user2Id, user1Id]
    );

    const messages = rawMessages.map((m) => ({
      id: m.id,
      sender_id: m.sender_id,
      senderId: m.sender_id,
      sender_name: m.sender_name,
      senderName: m.sender_name,
      sender_role: m.sender_role,
      senderRole: m.sender_role,
      receiver_id: m.receiver_id,
      receiverId: m.receiver_id,
      receiver_name: m.receiver_name,
      receiverName: m.receiver_name,
      channel_type: m.channel_type,
      channelType: m.channel_type,
      message: m.message,
      created_at: m.created_at ? new Date(m.created_at).toISOString() : new Date().toISOString(),
      createdAt: m.created_at ? new Date(m.created_at).toISOString() : new Date().toISOString(),
    }));

    return res.status(200).json({
      success: true,
      messages,
    });
  } catch (error) {
    console.error("Get Chat Messages Error:", error);
    return res.status(500).json({ success: false, message: "Error fetching chat messages." });
  }
};

export const sendChatMessage = async (req, res) => {
  try {
    const senderId = req.body.senderId || req.body.sender_id;
    const receiverId = req.body.receiverId || req.body.receiver_id;
    const senderName = req.body.senderName || req.body.sender_name || (Number(senderId) === 1 ? "Administrator" : "Staff/Member");
    const senderRole = req.body.senderRole || req.body.sender_role || (Number(senderId) === 1 ? "Admin" : "Member");
    const receiverName = req.body.receiverName || req.body.receiver_name || "Recipient";
    const channelType = req.body.channelType || req.body.channel_type || "member_trainer";
    const message = (req.body.message || req.body.text || "").trim();

    if (!senderId || !receiverId || !message) {
      return res.status(400).json({ success: false, message: "Sender, receiver, and message are required." });
    }

    const [insertResult] = await pool.query(
      `INSERT INTO chat_messages (sender_id, sender_name, sender_role, receiver_id, receiver_name, channel_type, message)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [senderId, senderName, senderRole, receiverId, receiverName, channelType, message]
    );

    const nowIso = new Date().toISOString();
    const newMsg = {
      id: insertResult.insertId,
      sender_id: Number(senderId),
      senderId: Number(senderId),
      sender_name: senderName,
      senderName,
      sender_role: senderRole,
      senderRole,
      receiver_id: Number(receiverId),
      receiverId: Number(receiverId),
      receiver_name: receiverName,
      receiverName,
      channel_type: channelType,
      channelType,
      message,
      created_at: nowIso,
      createdAt: nowIso,
    };

    // Broadcast instant real-time message to socket listeners
    broadcastEvent("chat:message", newMsg);

    // Dispatch durable in-app & multi-channel notification to the recipient
    try {
      await createNotification({
        recipientUserId: Number(receiverId),
        category: "chat",
        title: `Message from ${senderName}`,
        message: message.length > 120 ? `${message.substring(0, 117)}...` : message,
        type: "info",
        entityType: "chat_message",
        entityId: insertResult.insertId,
        actorUserId: Number(senderId),
        actorRole: senderRole,
        ctaText: "Open Conversation",
        ctaUrl: Number(senderId) === 1 ? "/dashboard" : "/trainer-dashboard#messages",
      });
    } catch (notifErr) {
      console.warn("Failed to create chat notification:", notifErr);
    }

    return res.status(201).json({
      success: true,
      message: newMsg,
      chatMessage: newMsg,
    });
  } catch (error) {
    console.error("Send Chat Message Error:", error);
    return res.status(500).json({ success: false, message: "Error sending message." });
  }
};

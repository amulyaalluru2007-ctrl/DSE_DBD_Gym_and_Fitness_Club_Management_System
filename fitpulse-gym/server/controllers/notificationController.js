import {
  getUserNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
} from "../services/notificationService.js";

/**
 * Fetch in-app notifications for the logged in or specified user.
 */
export const getNotifications = async (req, res) => {
  try {
    const userId = req.query.userId || req.user?.id || 1;
    const { limit = 40, unreadOnly = "false", category = null } = req.query;

    const notifications = await getUserNotifications(userId, {
      limit: parseInt(limit, 10),
      unreadOnly: unreadOnly === "true",
      category: category || null,
    });

    const unreadCount = await getUnreadNotificationCount(userId);

    return res.status(200).json({
      success: true,
      unreadCount,
      notifications,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return res.status(500).json({ success: false, message: "Internal server error fetching notifications." });
  }
};

/**
 * Fetch badge count of unread notifications.
 */
export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.query.userId || req.user?.id || 1;
    const unreadCount = await getUnreadNotificationCount(userId);

    return res.status(200).json({
      success: true,
      unreadCount,
    });
  } catch (error) {
    console.error("Error fetching unread count:", error);
    return res.status(500).json({ success: false, message: "Internal server error fetching unread count." });
  }
};

/**
 * Mark a single notification as read.
 */
export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.body.userId || req.user?.id || 1;

    await markNotificationRead(id, userId);

    return res.status(200).json({
      success: true,
      message: "Notification marked as read.",
    });
  } catch (error) {
    console.error("Error marking notification read:", error);
    return res.status(500).json({ success: false, message: "Internal server error marking notification read." });
  }
};

/**
 * Mark all notifications as read.
 */
export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.body.userId || req.user?.id || 1;

    await markAllNotificationsRead(userId);

    return res.status(200).json({
      success: true,
      message: "All notifications marked as read.",
    });
  } catch (error) {
    console.error("Error marking all notifications read:", error);
    return res.status(500).json({ success: false, message: "Internal server error marking all notifications read." });
  }
};

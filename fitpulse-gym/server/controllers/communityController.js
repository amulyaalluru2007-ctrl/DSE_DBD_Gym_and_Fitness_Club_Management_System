import { pool } from "../config/db.js";
import { broadcastEvent } from "../socket.js";

// Helper: Format relative time
const formatRelativeTime = (timestamp) => {
  if (!timestamp) return "Just now";
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDays = Math.floor(diffHour / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(timestamp).toLocaleDateString("en-IN", { month: "short", day: "numeric" });
};

// 1. GET ALL COMMUNITY POSTS
export const getCommunityPosts = async (req, res) => {
  try {
    const userId = Number(req.query.userId || 0);

    const [posts] = await pool.query(
      `SELECT p.*,
              (SELECT COUNT(*) FROM community_post_likes l WHERE l.post_id = p.id AND l.user_id = ?) as user_has_liked
       FROM community_posts p
       ORDER BY p.id DESC
       LIMIT 60`,
      [userId]
    );

    const formatted = posts.map((p) => ({
      id: p.id,
      userId: p.user_id,
      author: p.author_name,
      role: p.author_role || "Athlete Member",
      avatar:
        p.author_avatar ||
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
      time: formatRelativeTime(p.created_at),
      createdAt: p.created_at,
      badge: p.badge || "MEMBER UPDATE ⚡",
      content: p.content,
      likes: p.likes_count || 0,
      comments: p.comments_count || 0,
      hasLiked: Boolean(p.user_has_liked),
    }));

    return res.status(200).json({ success: true, posts: formatted });
  } catch (error) {
    console.error("Get community posts error:", error);
    return res.status(500).json({ success: false, message: "Error fetching community posts." });
  }
};

// 2. CREATE A NEW COMMUNITY POST
export const createCommunityPost = async (req, res) => {
  try {
    const { userId, content, badge = "MEMBER UPDATE ⚡" } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: "Post content is required." });
    }

    let authorName = "FitPulse Athlete";
    let authorRole = "Athlete Member";
    let authorAvatar = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80";

    if (userId) {
      const [[user]] = await pool.query(
        "SELECT id, full_name, role, avatar_url FROM users WHERE id = ?",
        [userId]
      );
      if (user) {
        authorName = user.full_name;
        authorRole = user.role === "Trainer" ? "Certified Master Coach" : "Athlete Member";
        if (user.avatar_url) authorAvatar = user.avatar_url;
      }
    }

    const [result] = await pool.query(
      `INSERT INTO community_posts (user_id, author_name, author_role, author_avatar, badge, content, likes_count, comments_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, 0, NOW())`,
      [userId || null, authorName, authorRole, authorAvatar, badge, content.trim()]
    );

    const newPost = {
      id: result.insertId,
      userId: userId || null,
      author: authorName,
      role: authorRole,
      avatar: authorAvatar,
      time: "Just now",
      createdAt: new Date().toISOString(),
      badge,
      content: content.trim(),
      likes: 0,
      comments: 0,
      hasLiked: false,
    };

    // Broadcast in real-time to ALL connected users across browsers/tabs!
    broadcastEvent("community:new_post", newPost);

    return res.status(201).json({
      success: true,
      message: "Post published to athlete network.",
      post: newPost,
    });
  } catch (error) {
    console.error("Create community post error:", error);
    return res.status(500).json({ success: false, message: "Error creating community post." });
  }
};

// 3. LIKE / UNLIKE A COMMUNITY POST
export const toggleLikeCommunityPost = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId = 1 } = req.body;

    // Check if user already liked
    const [[existing]] = await pool.query(
      "SELECT id FROM community_post_likes WHERE post_id = ? AND user_id = ?",
      [id, userId]
    );

    let liked = false;
    if (existing) {
      // Unlike
      await pool.query("DELETE FROM community_post_likes WHERE id = ?", [existing.id]);
      await pool.query(
        "UPDATE community_posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = ?",
        [id]
      );
      liked = false;
    } else {
      // Like
      await pool.query(
        "INSERT INTO community_post_likes (post_id, user_id) VALUES (?, ?)",
        [id, userId]
      );
      await pool.query(
        "UPDATE community_posts SET likes_count = likes_count + 1 WHERE id = ?",
        [id]
      );
      liked = true;
    }

    const [[post]] = await pool.query("SELECT likes_count FROM community_posts WHERE id = ?", [id]);
    const likesCount = post?.likes_count || 0;

    // Broadcast like event to all users
    broadcastEvent("community:post_liked", {
      postId: Number(id),
      userId,
      likesCount,
    });

    return res.status(200).json({
      success: true,
      liked,
      likesCount,
    });
  } catch (error) {
    console.error("Like post error:", error);
    return res.status(500).json({ success: false, message: "Error updating like status." });
  }
};

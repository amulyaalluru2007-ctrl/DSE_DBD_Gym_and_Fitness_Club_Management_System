import { useState, useEffect } from "react";
import CustomerSidebar3D from "../../components/dashboard/CustomerSidebar3D";
import {
  fetchCommunityPostsLive,
  createCommunityPostLive,
  toggleLikeCommunityPostLive,
  onRealtimeEvent,
} from "../../services/realtime";
import "../../styles/module-pages.css";

const leaderboard = [
  { rank: 1, name: "Jordan Reed", streak: "60 Days", points: "4,820 XP", tier: "Elite" },
  { rank: 2, name: "Elena Rostova", streak: "48 Days", points: "4,150 XP", tier: "Pro" },
  { rank: 3, name: "Nihal Metuku", streak: "24 Days", points: "2,980 XP", tier: "Elite" },
  { rank: 4, name: "Liam Chen", streak: "21 Days", points: "2,420 XP", tier: "Standard" },
  { rank: 5, name: "Maya Patel", streak: "19 Days", points: "2,190 XP", tier: "Pro" },
];

export default function CommunityModulePage() {
  const [currentUser] = useState(() => {
    try {
      const stored = localStorage.getItem("fitpulse_user");
      return stored ? JSON.parse(stored) : { id: 1, full_name: "Nihal Metuku", role: "Member" };
    } catch {
      return { id: 1, full_name: "Nihal Metuku", role: "Member" };
    }
  });

  const [activeTab, setActiveTab] = useState("All Posts");
  const [postsList, setPostsList] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [likes, setLikes] = useState({});
  const [likedMap, setLikedMap] = useState({});
  const [newPostText, setNewPostText] = useState("");
  const [selectedBadge, setSelectedBadge] = useState("MEMBER UPDATE ⚡");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [toastMessage, setToastMessage] = useState("");

  const navigateTo = (path) => {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  };

  // Load posts from MySQL database via live API
  const loadPosts = async () => {
    try {
      setLoadingPosts(true);
      const res = await fetchCommunityPostsLive(currentUser.id || 1);
      if (res && res.success && Array.isArray(res.posts)) {
        setPostsList(res.posts);
        const lMap = {};
        const countMap = {};
        res.posts.forEach((p) => {
          lMap[p.id] = Boolean(p.hasLiked);
          countMap[p.id] = Number(p.likes || 0);
        });
        setLikedMap(lMap);
        setLikes(countMap);
      }
    } catch (err) {
      console.warn("Failed to load community posts:", err);
    } finally {
      setLoadingPosts(false);
    }
  };

  useEffect(() => {
    loadPosts();

    // Listen for new posts from other members in real time via WebSockets
    const unsubNewPost = onRealtimeEvent("community:new_post", (newPost) => {
      if (!newPost) return;
      setPostsList((prev) => {
        if (prev.some((p) => p.id === newPost.id)) return prev;
        return [newPost, ...prev];
      });
      setLikes((prev) => ({ ...prev, [newPost.id]: newPost.likes || 0 }));
      setLikedMap((prev) => ({ ...prev, [newPost.id]: Boolean(newPost.hasLiked) }));
      showToast(`📢 ${newPost.author} just posted in Athlete Network!`);
    });

    // Listen for likes across all accounts in real time
    const unsubLiked = onRealtimeEvent("community:post_liked", ({ postId, userId, likesCount }) => {
      setLikes((prev) => ({ ...prev, [postId]: likesCount }));
      if (Number(userId) === Number(currentUser.id)) {
        setLikedMap((prev) => ({ ...prev, [postId]: !prev[postId] }));
      }
    });

    return () => {
      unsubNewPost();
      unsubLiked();
    };
  }, [currentUser.id]);

  const handleLike = async (postId) => {
    const currentlyLiked = Boolean(likedMap[postId]);
    // Optimistic UI update
    setLikedMap((prev) => ({ ...prev, [postId]: !currentlyLiked }));
    setLikes((prev) => ({
      ...prev,
      [postId]: currentlyLiked ? Math.max(0, (prev[postId] || 1) - 1) : (prev[postId] || 0) + 1,
    }));

    try {
      await toggleLikeCommunityPostLive(postId, currentUser.id || 1);
    } catch (err) {
      console.error("Error toggling like:", err);
      // Rollback on network failure
      setLikedMap((prev) => ({ ...prev, [postId]: currentlyLiked }));
      setLikes((prev) => ({
        ...prev,
        [postId]: currentlyLiked ? (prev[postId] || 0) + 1 : Math.max(0, (prev[postId] || 1) - 1),
      }));
    }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!newPostText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await createCommunityPostLive({
        userId: currentUser.id || 1,
        content: newPostText.trim(),
        badge: selectedBadge,
      });

      if (res && res.success && res.post) {
        setPostsList((prev) => {
          if (prev.some((p) => p.id === res.post.id)) return prev;
          return [res.post, ...prev];
        });
        setLikes((prev) => ({ ...prev, [res.post.id]: 0 }));
        setLikedMap((prev) => ({ ...prev, [res.post.id]: false }));
        setNewPostText("");
        showToast("✓ Post published live to the Athlete Network!");
      } else {
        alert(res?.message || "Failed to publish post.");
      }
    } catch (err) {
      console.error("Error creating post:", err);
      alert("Error publishing post to athlete network.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter posts based on active tab and search query
  const filteredPosts = postsList.filter((post) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchAuthor = post.author && post.author.toLowerCase().includes(q);
      const matchContent = post.content && post.content.toLowerCase().includes(q);
      const matchBadge = post.badge && post.badge.toLowerCase().includes(q);
      if (!matchAuthor && !matchContent && !matchBadge) return false;
    }

    if (activeTab === "All Posts") return true;
    if (activeTab === "Workout PRs") {
      return (
        (post.badge && (post.badge.includes("PR") || post.badge.includes("🏆"))) ||
        (post.content && post.content.toLowerCase().includes("pr"))
      );
    }
    if (activeTab === "Coach Tips") {
      return (
        (post.badge && (post.badge.includes("Tip") || post.badge.includes("COACH") || post.badge.includes("💡"))) ||
        (post.role && post.role.toLowerCase().includes("coach"))
      );
    }
    if (activeTab === "Challenges") {
      return (
        (post.badge && (post.badge.includes("Challenge") || post.badge.includes("STREAK") || post.badge.includes("⚡"))) ||
        (post.content && (post.content.toLowerCase().includes("challenge") || post.content.toLowerCase().includes("streak")))
      );
    }
    return true;
  });

  return (
    <div className="module-page-container">
      {/* Background Media */}
      <img
        src="/assets/modules/bg-community.jpg"
        alt="FitPulse Athletic Community"
        className="module-page-bg"
      />
      <div className="module-page-vignette" />

      {/* 3D Glassmorphic Sidebar */}
      <CustomerSidebar3D currentModule="community" />

      {/* Main Page Area */}
      <main className="module-page-main">
        {/* Real-time Notification Banner */}
        {toastMessage && (
          <div
            style={{
              position: "sticky",
              top: 10,
              zIndex: 999,
              marginBottom: 16,
              background: "linear-gradient(135deg, rgba(0, 240, 255, 0.2), rgba(0, 112, 243, 0.3))",
              backdropFilter: "blur(12px)",
              border: "1.5px solid #00f0ff",
              borderRadius: 14,
              padding: "12px 20px",
              color: "#ffffff",
              fontSize: "0.88rem",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 12,
              boxShadow: "0 10px 30px rgba(0, 240, 255, 0.2)",
              animation: "fadeIn 0.3s ease",
            }}
          >
            <span>💬</span>
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Topbar & Breadcrumb */}
        <div className="module-page-topbar">
          <div className="module-breadcrumb-row">
            <button
              type="button"
              className="module-back-btn"
              onClick={() => navigateTo("/dashboard")}
            >
              <span>←</span>
              <span>Back to Dashboard</span>
            </button>
            <span style={{ color: "rgba(255,255,255,0.3)" }}>/</span>
            <span className="module-breadcrumb-current">Athlete Network</span>
          </div>

          <div className="module-topbar-actions">
            <div className="portal-search-bar">
              <span style={{ fontSize: "0.85rem", color: "#64748b" }}>🔍</span>
              <input
                type="text"
                placeholder="Search athletes, PRs, topics... ⌘K"
                className="portal-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="portal-date-pill">
              <span>📅</span>
              <span>Live Athlete Feed</span>
            </div>
          </div>
        </div>

        {/* Screen 3 Title Header */}
        <div style={{ marginBottom: "22px" }}>
          <h1 className="portal-screen-title">FitPulse Athlete Network</h1>
          <p className="portal-screen-subtitle">
            Connect, share workout milestones, and celebrate achievements with every athlete across the club.
          </p>
        </div>

        {/* Screen 3 Layout: Left Column (Feed) + Right Sidebar (Leaderboard & Challenge) */}
        <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: "22px" }}>
          {/* Left Column: Create Post & Feed */}
          <div>
            {/* Create Post Card */}
            <div className="portal-card" style={{ marginBottom: "20px", padding: "18px 22px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <div style={{ fontSize: "0.88rem", fontWeight: 800, color: "#ffffff" }}>
                  Create Post
                </div>
                <div style={{ fontSize: "0.74rem", color: "#8da4be" }}>
                  Posting as <strong style={{ color: "#00f0ff" }}>{currentUser.full_name || currentUser.name || "Member"}</strong>
                </div>
              </div>
              <form onSubmit={handleCreatePost}>
                <textarea
                  className="community-post-textarea"
                  placeholder="Share your personal record, workout split, meal idea, or athlete motivation..."
                  value={newPostText}
                  onChange={(e) => setNewPostText(e.target.value)}
                  style={{
                    minHeight: "85px",
                    background: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: "12px",
                    color: "#ffffff",
                    fontSize: "0.86rem",
                    padding: "12px 14px",
                    width: "100%",
                    boxSizing: "border-box",
                    resize: "vertical",
                  }}
                />

                {/* Badge Selection & Submit Row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "14px", flexWrap: "wrap", gap: 8 }}>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {[
                      { label: "⚡ Update", val: "MEMBER UPDATE ⚡" },
                      { label: "🏆 PR Alert", val: "PR ALERT 🏆" },
                      { label: "💡 Coach Tip", val: "COACH ADVICE 💡" },
                      { label: "🔥 Streak", val: "STREAK ⚡" },
                    ].map((b) => (
                      <button
                        key={b.val}
                        type="button"
                        className="portal-pill-tab"
                        style={{
                          padding: "5px 12px",
                          fontSize: "0.74rem",
                          background: selectedBadge === b.val ? "rgba(0, 240, 255, 0.2)" : "rgba(255,255,255,0.05)",
                          border: selectedBadge === b.val ? "1px solid #00f0ff" : "1px solid rgba(255,255,255,0.08)",
                          color: selectedBadge === b.val ? "#00f0ff" : "#cbd5e1",
                          fontWeight: selectedBadge === b.val ? 800 : 500,
                        }}
                        onClick={() => setSelectedBadge(b.val)}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                  <button
                    type="submit"
                    className="portal-btn-primary"
                    style={{ padding: "8px 24px", minWidth: 90 }}
                    disabled={isSubmitting || !newPostText.trim()}
                  >
                    {isSubmitting ? "Publishing..." : "Post Live"}
                  </button>
                </div>
              </form>
            </div>

            {/* Filter Pills */}
            <div className="portal-pill-tabs" style={{ marginBottom: "18px" }}>
              {["All Posts", "Workout PRs", "Coach Tips", "Challenges"].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={`portal-pill-tab ${activeTab === tab ? "active" : ""}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Feed Posts */}
            {loadingPosts ? (
              <div className="portal-card" style={{ padding: "40px", textAlign: "center", color: "#8da4be" }}>
                <div style={{ fontSize: "1.5rem", marginBottom: 10 }}>⚡</div>
                <div>Connecting to Live Athlete Network...</div>
              </div>
            ) : filteredPosts.length === 0 ? (
              <div className="portal-card" style={{ padding: "40px", textAlign: "center", color: "#8da4be" }}>
                <div style={{ fontSize: "1.8rem", marginBottom: 10 }}>🏋️‍♂️</div>
                <div style={{ fontSize: "1rem", fontWeight: 700, color: "#fff", marginBottom: 6 }}>
                  No posts found in this feed.
                </div>
                <div style={{ fontSize: "0.82rem" }}>
                  Be the first athlete to share your workout milestone or nutrition tip!
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                {filteredPosts.map((post) => (
                  <article key={post.id} className="portal-card" style={{ padding: "20px 22px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <img
                          src={post.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80"}
                          alt={post.author}
                          style={{
                            width: "42px",
                            height: "42px",
                            borderRadius: "50%",
                            objectFit: "cover",
                            border: "1.5px solid rgba(0, 180, 255, 0.4)",
                          }}
                        />
                        <div>
                          <div style={{ fontSize: "0.92rem", fontWeight: 800, color: "#ffffff" }}>{post.author}</div>
                          <div style={{ fontSize: "0.72rem", color: "#8da4be" }}>
                            {post.role} • {post.time}
                          </div>
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: "0.7rem",
                          padding: "4px 10px",
                          borderRadius: "6px",
                          background: "rgba(0, 180, 255, 0.15)",
                          color: "#00f0ff",
                          fontWeight: 700,
                          border: "1px solid rgba(0, 180, 255, 0.25)",
                        }}
                      >
                        {post.badge || "Gym Beast"}
                      </span>
                    </div>

                    <p style={{ margin: "0 0 14px 0", fontSize: "0.9rem", color: "#e2e8f0", lineHeight: 1.55 }}>
                      {post.content}
                    </p>

                    {/* Media preview if available */}
                    {post.badge && post.badge.includes("PR") && (
                      <div style={{ borderRadius: "14px", overflow: "hidden", marginBottom: "14px", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                        <img
                          src="https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800&auto=format&fit=crop&q=80"
                          alt="Deadlift PR milestone"
                          style={{ width: "100%", height: "220px", objectFit: "cover", display: "block" }}
                        />
                      </div>
                    )}

                    <div style={{ display: "flex", gap: "16px", paddingTop: "10px", borderTop: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <button
                        type="button"
                        className={`community-action-btn ${likedMap[post.id] ? "liked" : ""}`}
                        onClick={() => handleLike(post.id)}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: likedMap[post.id] ? "#f43f5e" : "#8da4be",
                          fontSize: "0.82rem",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          fontWeight: likedMap[post.id] ? 700 : 500,
                        }}
                      >
                        <span>{likedMap[post.id] ? "❤️" : "🤍"}</span>
                        <span>{likes[post.id] || 0} Likes</span>
                      </button>
                      <button
                        type="button"
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#8da4be",
                          fontSize: "0.82rem",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                        onClick={() => alert(`Discussion on "${post.author}'s post": Comments feature opening soon!`)}
                      >
                        <span>💬</span>
                        <span>{post.comments || 0} Comments</span>
                      </button>
                      <button
                        type="button"
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#8da4be",
                          fontSize: "0.82rem",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                        onClick={() => {
                          if (navigator.clipboard) {
                            navigator.clipboard.writeText(window.location.href);
                            showToast("🔗 Post link copied to clipboard!");
                          } else {
                            showToast("🔗 Post link copied!");
                          }
                        }}
                      >
                        <span>🔗</span>
                        <span>Share</span>
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          {/* Right Sidebar: Top Contributors & Upcoming Challenge */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Top Contributors Card */}
            <div className="portal-card" style={{ padding: "20px 22px" }}>
              <div style={{ fontSize: "0.88rem", fontWeight: 800, color: "#ffffff", marginBottom: "16px" }}>
                Top Club Contributors
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {[
                  { name: "Jordan Reed", xp: "4,820 XP", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&auto=format&fit=crop&q=80" },
                  { name: "Maya Singh", xp: "4,210 XP", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&auto=format&fit=crop&q=80" },
                  { name: "Alex Carter", xp: "3,980 XP", avatar: "https://images.unsplash.com/photo-1567013127542-490d757e51fc?w=80&auto=format&fit=crop&q=80" },
                  { name: "Chris Evans", xp: "3,540 XP", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&auto=format&fit=crop&q=80" },
                  {
                    name: currentUser.full_name || currentUser.name || "Nihal Metuku",
                    xp: "3,120 XP",
                    avatar: currentUser.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&auto=format&fit=crop&q=80",
                    isYou: true,
                  },
                ].map((c) => (
                  <div
                    key={c.name}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 10px",
                      borderRadius: "10px",
                      background: c.isYou ? "rgba(0, 112, 243, 0.12)" : "transparent",
                      border: c.isYou ? "1px solid rgba(0, 112, 243, 0.3)" : "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <img
                        src={c.avatar}
                        alt={c.name}
                        style={{ width: "32px", height: "32px", borderRadius: "50%", objectFit: "cover" }}
                      />
                      <span style={{ fontSize: "0.82rem", fontWeight: 700, color: c.isYou ? "#00e5ff" : "#ffffff" }}>
                        {c.name} {c.isYou && "(You)"}
                      </span>
                    </div>
                    <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "#00b4ff", fontFamily: "JetBrains Mono" }}>
                      {c.xp}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Upcoming Challenge Card */}
            <div className="portal-card" style={{ padding: "20px 22px" }}>
              <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "#8da4be", fontWeight: 800, marginBottom: "4px" }}>
                UPCOMING CHALLENGE
              </div>
              <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#ffffff", marginBottom: "12px" }}>
                100km Rowing & Sprint Quest
              </div>
              <div style={{ fontSize: "0.76rem", color: "#8da4be", lineHeight: 1.4, marginBottom: "16px" }}>
                Log cumulative rowing and treadmill sprint distances before end of month to unlock exclusive Elite athlete gear.
              </div>
              <button
                type="button"
                className="portal-btn-primary"
                style={{ width: "100%", padding: "10px 0" }}
                onClick={() => showToast("🔥 You joined the 100km Rowing & Sprint Quest!")}
              >
                Join Challenge
              </button>
            </div>

            {/* Gym Leaderboard */}
            <div className="module-card">
              <div className="module-hero-kicker">TOP ATHLETES</div>
              <h3 style={{ margin: "0 0 16px 0", fontSize: "1.2rem", fontWeight: 800 }}>
                Consistency Leaderboard
              </h3>
              <div>
                {leaderboard.map((item) => (
                  <div
                    key={item.rank}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 14px",
                      borderRadius: 14,
                      background: item.name.includes("Nihal") ? "rgba(0, 180, 255, 0.12)" : "rgba(255,255,255,0.03)",
                      border: item.name.includes("Nihal") ? "1px solid rgba(0, 180, 255, 0.4)" : "1px solid rgba(255,255,255,0.06)",
                      marginBottom: 8,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{
                        width: 26,
                        height: 26,
                        borderRadius: "50%",
                        background: item.rank === 1 ? "#f59e0b" : item.rank === 2 ? "#94a3b8" : item.rank === 3 ? "#00b4ff" : "rgba(255,255,255,0.1)",
                        color: "#000",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.76rem",
                        fontWeight: 900
                      }}>
                        {item.rank}
                      </span>
                      <div>
                        <div style={{ fontSize: "0.88rem", fontWeight: 800, color: "#fff" }}>
                          {item.name} {item.name.includes("Nihal") && "(You)"}
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
                          {item.tier} • {item.streak}
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "#00b4ff", fontFamily: "JetBrains Mono" }}>
                      {item.points}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

import { useState } from "react";
import CustomerSidebar3D from "../../components/dashboard/CustomerSidebar3D";
import "../../styles/module-pages.css";

const communityPosts = [
  {
    id: "post-1",
    author: "Elena Rostova",
    role: "Athlete Member",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80",
    time: "2 hours ago",
    badge: "PR ALERT 🏆",
    content: "Hit a new deadlift personal record today at 145kg! Massive thanks to Coach Alex Carter for dialing in my hip drive cue. Consistency is finally showing.",
    likes: 42,
    comments: 8,
  },
  {
    id: "post-2",
    author: "Marcus Vance",
    role: "Head Strength Coach",
    avatar: "https://images.unsplash.com/photo-1567013127542-490d757e51fc?w=120&auto=format&fit=crop&q=80",
    time: "5 hours ago",
    badge: "COACH ADVICE 💡",
    content: "Reminder for the evening hypertrophy squad: don't neglect your eccentric control on dumbbell incline presses. A controlled 3-second lowering beats throwing around heavy ego weight every single time.",
    likes: 89,
    comments: 15,
  },
  {
    id: "post-3",
    author: "Jordan Reed",
    role: "Member • 60-Day Streak",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
    time: "Yesterday",
    badge: "STREAK ⚡",
    content: "Officially reached 60 consecutive training check-ins today! Energy levels have completely shifted. See you all at tomorrow morning's mobility circuit.",
    likes: 64,
    comments: 11,
  },
];

const leaderboard = [
  { rank: 1, name: "Jordan Reed", streak: "60 Days", points: "4,820 XP", tier: "Elite" },
  { rank: 2, name: "Elena Rostova", streak: "48 Days", points: "4,150 XP", tier: "Pro" },
  { rank: 3, name: "Nihal Carter", streak: "24 Days", points: "2,980 XP", tier: "Elite" },
  { rank: 4, name: "Liam Chen", streak: "21 Days", points: "2,420 XP", tier: "Standard" },
  { rank: 5, name: "Maya Patel", streak: "19 Days", points: "2,190 XP", tier: "Pro" },
];

export default function CommunityModulePage() {
  const [activeTab, setActiveTab] = useState("All Posts");
  const [likes, setLikes] = useState({ "post-1": 42, "post-2": 89, "post-3": 64 });
  const [likedMap, setLikedMap] = useState({});
  const [newPostText, setNewPostText] = useState("");
  const [postsList, setPostsList] = useState(communityPosts);

  const navigateTo = (path) => {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const handleLike = (id) => {
    const currentlyLiked = Boolean(likedMap[id]);
    setLikedMap((prev) => ({ ...prev, [id]: !currentlyLiked }));
    setLikes((prev) => ({
      ...prev,
      [id]: currentlyLiked ? prev[id] - 1 : prev[id] + 1,
    }));
  };

  const handleCreatePost = (e) => {
    e.preventDefault();
    if (!newPostText.trim()) return;

    const post = {
      id: "post-" + Date.now(),
      author: "Nihal Carter",
      role: "Elite Member",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
      time: "Just now",
      badge: "MEMBER UPDATE ⚡",
      content: newPostText,
      likes: 1,
      comments: 0,
    };

    setPostsList([post, ...postsList]);
    setLikes((prev) => ({ ...prev, [post.id]: 1 }));
    setLikedMap((prev) => ({ ...prev, [post.id]: true }));
    setNewPostText("");
  };

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
              />
            </div>
            <div className="portal-date-pill">
              <span>📅</span>
              <span>23 Sep 2026</span>
            </div>
          </div>
        </div>

        {/* Screen 3 Title Header */}
        <div style={{ marginBottom: "22px" }}>
          <h1 className="portal-screen-title">FitPulse Athlete Network</h1>
          <p className="portal-screen-subtitle">
            Connect, share progress, and stay motivated together.
          </p>
        </div>

        {/* Screen 3 Layout: Left Column (Feed) + Right Sidebar (Leaderboard & Challenge) */}
        <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: "22px" }}>
          {/* Left Column: Create Post & Feed */}
          <div>
            {/* Create Post Card */}
            <div className="portal-card" style={{ marginBottom: "20px", padding: "18px 22px" }}>
              <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "#ffffff", marginBottom: "12px" }}>
                Create Post
              </div>
              <form onSubmit={handleCreatePost}>
                <textarea
                  className="community-post-textarea"
                  placeholder="Share your workout, meal, or a tip..."
                  value={newPostText}
                  onChange={(e) => setNewPostText(e.target.value)}
                  style={{
                    minHeight: "75px",
                    background: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: "12px",
                    color: "#ffffff",
                    fontSize: "0.84rem",
                    padding: "12px 14px",
                  }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px" }}>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      type="button"
                      className="portal-pill-tab"
                      style={{ padding: "5px 12px", fontSize: "0.74rem" }}
                      onClick={() => alert("Photo attachment added")}
                    >
                      📷 Photo
                    </button>
                    <button
                      type="button"
                      className="portal-pill-tab"
                      style={{ padding: "5px 12px", fontSize: "0.74rem" }}
                      onClick={() => alert("PR Badge added")}
                    >
                      🏆 PR
                    </button>
                    <button
                      type="button"
                      className="portal-pill-tab"
                      style={{ padding: "5px 12px", fontSize: "0.74rem" }}
                      onClick={() => alert("Coach Tip formatted")}
                    >
                      💡 Tip
                    </button>
                  </div>
                  <button type="submit" className="portal-btn-primary" style={{ padding: "7px 20px" }}>
                    Post
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
            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              {postsList.map((post) => (
                <article key={post.id} className="portal-card" style={{ padding: "20px 22px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <img
                        src={post.avatar}
                        alt={post.author}
                        style={{ width: "40px", height: "40px", borderRadius: "50%", objectFit: "cover", border: "1.5px solid rgba(0, 180, 255, 0.4)" }}
                      />
                      <div>
                        <div style={{ fontSize: "0.92rem", fontWeight: 800, color: "#ffffff" }}>{post.author}</div>
                        <div style={{ fontSize: "0.72rem", color: "#8da4be" }}>{post.time}</div>
                      </div>
                    </div>
                    <span style={{ fontSize: "0.7rem", padding: "3px 8px", borderRadius: "6px", background: "rgba(0, 180, 255, 0.15)", color: "#00f0ff", fontWeight: 700 }}>
                      {post.badge || "Gym Beast"}
                    </span>
                  </div>

                  <p style={{ margin: "0 0 14px 0", fontSize: "0.88rem", color: "#e2e8f0", lineHeight: 1.5 }}>
                    {post.content}
                  </p>

                  {/* High Quality Platform Media if PR post */}
                  {post.author.includes("Elena") && (
                    <div style={{ borderRadius: "14px", overflow: "hidden", marginBottom: "14px", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                      <img
                        src="https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800&auto=format&fit=crop&q=80"
                        alt="Elena deadlift PR"
                        style={{ width: "100%", height: "230px", objectFit: "cover", display: "block" }}
                      />
                    </div>
                  )}

                  <div style={{ display: "flex", gap: "16px", paddingTop: "10px", borderTop: "1px solid rgba(255, 255, 255, 0.06)" }}>
                    <button
                      type="button"
                      className={`community-action-btn ${likedMap[post.id] ? "liked" : ""}`}
                      onClick={() => handleLike(post.id)}
                      style={{ background: "transparent", border: "none", color: likedMap[post.id] ? "#f43f5e" : "#8da4be", fontSize: "0.8rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                    >
                      <span>{likedMap[post.id] ? "❤️" : "🤍"}</span>
                      <span>{likes[post.id] || 0} Likes</span>
                    </button>
                    <button
                      type="button"
                      style={{ background: "transparent", border: "none", color: "#8da4be", fontSize: "0.8rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                    >
                      <span>💬</span>
                      <span>{post.comments || 8} Comments</span>
                    </button>
                    <button
                      type="button"
                      style={{ background: "transparent", border: "none", color: "#8da4be", fontSize: "0.8rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                      onClick={() => alert("Post link copied!")}
                    >
                      <span>🔗</span>
                      <span>Share</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>

          {/* Right Sidebar: Top Contributors & Upcoming Challenge */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Top Contributors Card */}
            <div className="portal-card" style={{ padding: "20px 22px" }}>
              <div style={{ fontSize: "0.88rem", fontWeight: 800, color: "#ffffff", marginBottom: "16px" }}>
                Top Contributors
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {[
                  { name: "Jordan Reed", xp: "4,820 XP", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&auto=format&fit=crop&q=80" },
                  { name: "Maya Singh", xp: "4,210 XP", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&auto=format&fit=crop&q=80" },
                  { name: "Alex Carter", xp: "3,980 XP", avatar: "https://images.unsplash.com/photo-1567013127542-490d757e51fc?w=80&auto=format&fit=crop&q=80" },
                  { name: "Chris Evans", xp: "3,540 XP", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&auto=format&fit=crop&q=80" },
                  { name: "You (Nihal)", xp: "3,120 XP", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&auto=format&fit=crop&q=80", isYou: true },
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
                        {c.name}
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
                Log cumulative rowing and treadmill sprint distances before end of month to unlock exclusive Elite gear.
              </div>
              <button
                type="button"
                className="portal-btn-primary"
                style={{ width: "100%", padding: "10px 0" }}
                onClick={() => alert("You joined the 100km Rowing & Sprint Quest!")}
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
                      background: item.name === "Nihal Carter" ? "rgba(0, 180, 255, 0.12)" : "rgba(255,255,255,0.03)",
                      border: item.name === "Nihal Carter" ? "1px solid rgba(0, 180, 255, 0.4)" : "1px solid rgba(255,255,255,0.06)",
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
                          {item.name} {item.name === "Nihal Carter" && "(You)"}
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

import { useState, useEffect } from "react";
import CustomerSidebar3D from "../../components/dashboard/CustomerSidebar3D";
import { fetchDashboardData, logNutritionLive, onRealtimeEvent } from "../../services/realtime";
import "../../styles/module-pages.css";

const defaultMealsForDemo = [
  { id: "meal-1", time: "07:30 AM", name: "Anabolic Morning Oats", calories: 650, protein: 48, carbs: 75, fats: 14, tags: "High Protein • Low GI" },
  { id: "meal-2", time: "11:30 AM", name: "Pre-Workout Fuel & Electrolytes", calories: 280, protein: 12, carbs: 54, fats: 2, tags: "Fast Glycogen" },
  { id: "meal-3", time: "02:15 PM", name: "Flame-Seared Chicken & Jasmine Rice", calories: 740, protein: 62, carbs: 82, fats: 16, tags: "Clean Bulk" },
  { id: "meal-4", time: "07:30 PM", name: "Wild Alaskan Salmon & Roasted Roots", calories: 610, protein: 50, carbs: 42, fats: 24, tags: "Omega-3 Rich" },
];

export default function NutritionModulePage() {
  const [meals, setMeals] = useState([]);
  const [waterLiters, setWaterLiters] = useState(0.0);
  const [waterTarget] = useState(3.5);
  const [newMealName, setNewMealName] = useState("");
  const [newMealCalories, setNewMealCalories] = useState("");
  const [newMealProtein, setNewMealProtein] = useState("");

  const navigateTo = (path) => {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  useEffect(() => {
    let email = null;
    try {
      const stored = JSON.parse(localStorage.getItem("fitpulse_user") || "{}");
      if (stored.email) email = stored.email;
    } catch {}

    const isDemo = email && email.toLowerCase() === "nihal@fitpulse.com";

    fetchDashboardData(email).then((data) => {
      if (data && data.nutrition?.logs && data.nutrition.logs.length > 0) {
        setMeals(
          data.nutrition.logs.map((l) => ({
            id: `meal-${l.id}`,
            time: l.time_logged || "Today",
            name: l.meal_name,
            calories: l.calories,
            protein: l.protein,
            carbs: l.carbs || 30,
            fats: l.fats || 10,
            tags: "Daily Log",
          }))
        );
        setWaterLiters(2.4);
      } else if (isDemo) {
        setMeals(defaultMealsForDemo);
        setWaterLiters(2.4);
      } else {
        // Fresh account: nil state
        setMeals([]);
        setWaterLiters(0.0);
      }
    });

    const unsubNutrition = onRealtimeEvent("nutrition:logged", (payload) => {
      if (payload && payload.mealName && payload.mealName !== "Hydration Flask") {
        const liveEntry = {
          id: "meal-" + Date.now(),
          time: "Just now",
          name: payload.mealName,
          calories: payload.calories || 300,
          protein: payload.protein || 25,
          carbs: payload.carbs || 30,
          fats: payload.fats || 10,
          tags: "Live Log",
        };
        setMeals((prev) => [liveEntry, ...prev]);
      }
    });

    return () => {
      unsubNutrition();
    };
  }, []);

  const addWater = (amount) => {
    const nextVal = +(Math.min(waterLiters + amount, 5.0).toFixed(1));
    setWaterLiters(nextVal);
    logNutritionLive({
      mealName: "Hydration Flask",
      calories: 0,
      protein: 0,
    });
  };

  const handleAddMeal = async (e) => {
    e.preventDefault();
    if (!newMealName || !newMealCalories) return;

    const cal = parseInt(newMealCalories, 10) || 300;
    const pro = parseInt(newMealProtein, 10) || 25;

    const newEntry = {
      id: "meal-" + Date.now(),
      time: "Just now",
      name: newMealName,
      calories: cal,
      protein: pro,
      carbs: 30,
      fats: 10,
      tags: "Quick Log",
    };

    setMeals((prev) => [newEntry, ...prev]);
    setNewMealName("");
    setNewMealCalories("");
    setNewMealProtein("");

    try {
      await logNutritionLive({
        mealName: newMealName,
        calories: cal,
        protein: pro,
      });
    } catch {
      /* ignore */
    }
  };

  const totalCalories = meals.reduce((acc, m) => acc + m.calories, 0);
  const totalProtein = meals.reduce((acc, m) => acc + m.protein, 0);
  const totalCarbs = meals.reduce((acc, m) => acc + m.carbs, 0);
  const totalFats = meals.reduce((acc, m) => acc + m.fats, 0);

  return (
    <div className="module-page-container">
      {/* Photorealistic Dedicated Background */}
      <img
        src="/assets/modules/bg-nutrition.jpg"
        alt="FitPulse Nutrition Hub"
        className="module-page-bg"
      />
      <div className="module-page-vignette" />

      {/* 3D Sidebar Dock */}
      <CustomerSidebar3D currentModule="nutrition" />

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
            <span className="module-breadcrumb-current">Nutrition Hub</span>
          </div>

          <div className="module-topbar-actions">
            <div className="portal-search-bar">
              <span style={{ fontSize: "0.85rem", color: "#64748b" }}>🔍</span>
              <input
                type="text"
                placeholder="Search meals, macros, ingredients... ⌘K"
                className="portal-search-input"
              />
            </div>
            <div className="portal-date-pill">
              <span>📅</span>
              <span>23 Sep 2026</span>
            </div>
          </div>
        </div>

        {/* Screen 4 Title Header */}
        <div style={{ marginBottom: "22px" }}>
          <h1 className="portal-screen-title">Fueling & Macro Allocation</h1>
          <p className="portal-screen-subtitle">
            Track your nutrition, stay consistent, and perform better.
          </p>
        </div>

        {/* Screen 4: 4 Macro KPI Cards */}
        <div className="portal-macro-kpis">
          <div className="portal-macro-kpi-card">
            <div className="portal-macro-dot green" />
            <div>
              <div style={{ fontSize: "1.25rem", fontWeight: 900, color: "#ffffff", fontFamily: "JetBrains Mono" }}>
                2,280
              </div>
              <div style={{ fontSize: "0.74rem", color: "#8da4be" }}>kcal consumed</div>
            </div>
          </div>

          <div className="portal-macro-kpi-card">
            <div className="portal-macro-dot coral" />
            <div>
              <div style={{ fontSize: "1.25rem", fontWeight: 900, color: "#ffffff", fontFamily: "JetBrains Mono" }}>
                172g
              </div>
              <div style={{ fontSize: "0.74rem", color: "#8da4be" }}>protein</div>
            </div>
          </div>

          <div className="portal-macro-kpi-card">
            <div className="portal-macro-dot purple" />
            <div>
              <div style={{ fontSize: "1.25rem", fontWeight: 900, color: "#ffffff", fontFamily: "JetBrains Mono" }}>
                253g
              </div>
              <div style={{ fontSize: "0.74rem", color: "#8da4be" }}>carbs</div>
            </div>
          </div>

          <div className="portal-macro-kpi-card">
            <div className="portal-macro-dot gold" />
            <div>
              <div style={{ fontSize: "1.25rem", fontWeight: 900, color: "#ffffff", fontFamily: "JetBrains Mono" }}>
                56g
              </div>
              <div style={{ fontSize: "0.74rem", color: "#8da4be" }}>fats</div>
            </div>
          </div>
        </div>

        {/* Screen 4 2-Column Section: Today's Meals on Left, Macro Breakdown Donut on Right */}
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "22px", marginBottom: "26px" }}>
          {/* Left: Today's Meals */}
          <div className="portal-card" style={{ padding: "22px" }}>
            <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#ffffff", marginBottom: "16px" }}>
              Today's Meals
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {[
                { name: "Oats & Banana", time: "07:30 AM", cal: "450 kcal", p: "40g P", c: "75g C", f: "14g F", icon: "🥣" },
                { name: "Chicken & Rice", time: "01:15 PM", cal: "780 kcal", p: "62g P", c: "85g C", f: "18g F", icon: "🍗" },
                { name: "Salmon & Roasted Veg", time: "07:30 PM", cal: "610 kcal", p: "50g P", c: "42g C", f: "24g F", icon: "🐟" },
              ].map((m) => (
                <div
                  key={m.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "14px 16px",
                    borderRadius: "12px",
                    background: "rgba(255, 255, 255, 0.02)",
                    border: "1px solid rgba(255, 255, 255, 0.06)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem" }}>
                      {m.icon}
                    </div>
                    <div>
                      <div style={{ fontSize: "0.92rem", fontWeight: 800, color: "#ffffff" }}>{m.name}</div>
                      <div style={{ fontSize: "0.72rem", color: "#8da4be" }}>{m.time}</div>
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "0.88rem", fontWeight: 800, color: "#00e5ff", fontFamily: "JetBrains Mono" }}>{m.cal}</div>
                    <div style={{ fontSize: "0.72rem", color: "#8da4be", marginTop: "2px" }}>
                      {m.p} • {m.c} • {m.f}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Macro Breakdown Donut & Water Intake */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Macro Breakdown Donut Card */}
            <div className="portal-card" style={{ padding: "20px 22px" }}>
              <div style={{ fontSize: "0.88rem", fontWeight: 800, color: "#ffffff", marginBottom: "14px" }}>
                Macro Breakdown
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                {/* Donut Graphic */}
                <div style={{ position: "relative", width: "100px", height: "100px", flexShrink: 0 }}>
                  <svg viewBox="0 0 100 100" style={{ transform: "rotate(-90deg)", width: "100%", height: "100%" }}>
                    <circle cx="50" cy="50" r="38" fill="transparent" stroke="#0070f3" strokeWidth="12" strokeDasharray="238.7" strokeDashoffset="0" />
                    <circle cx="50" cy="50" r="38" fill="transparent" stroke="#f59e0b" strokeWidth="12" strokeDasharray="238.7" strokeDashoffset="183.8" />
                    <circle cx="50" cy="50" r="38" fill="transparent" stroke="#10b981" strokeWidth="12" strokeDasharray="238.7" strokeDashoffset="120.0" />
                  </svg>
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 900,
                      fontSize: "0.82rem",
                      color: "#ffffff",
                      fontFamily: "JetBrains Mono",
                      textAlign: "center",
                    }}
                  >
                    <span>2,654</span>
                    <span style={{ fontSize: "0.58rem", color: "#8da4be" }}>kcal</span>
                  </div>
                </div>

                {/* Legend */}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.76rem" }}>
                    <span style={{ color: "#00b4ff", display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#00b4ff" }} />
                      Protein
                    </span>
                    <span style={{ color: "#cbd5e1", fontFamily: "JetBrains Mono" }}>154g (23%)</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.76rem" }}>
                    <span style={{ color: "#f59e0b", display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#f59e0b" }} />
                      Carbs
                    </span>
                    <span style={{ color: "#cbd5e1", fontFamily: "JetBrains Mono" }}>220g (49%)</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.76rem" }}>
                    <span style={{ color: "#10b981", display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981" }} />
                      Fats
                    </span>
                    <span style={{ color: "#cbd5e1", fontFamily: "JetBrains Mono" }}>52g (18%)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Water Intake Card */}
            <div className="portal-card" style={{ padding: "18px 22px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "#ffffff" }}>Water Intake</span>
                <span style={{ fontSize: "0.95rem", fontWeight: 900, color: "#00e5ff", fontFamily: "JetBrains Mono" }}>
                  {waterLiters}L
                </span>
              </div>
              <div style={{ width: "100%", height: "8px", borderRadius: "9999px", background: "rgba(255, 255, 255, 0.08)", overflow: "hidden", marginBottom: "12px" }}>
                <div style={{ width: `${Math.min((waterLiters / waterTarget) * 100, 100)}%`, height: "100%", background: "linear-gradient(90deg, #0070f3, #00f0ff)" }} />
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  className="portal-pill-tab"
                  style={{ flex: 1, padding: "5px 0", textAlign: "center", fontSize: "0.74rem" }}
                  onClick={() => addWater(0.25)}
                >
                  +250ml
                </button>
                <button
                  type="button"
                  className="portal-pill-tab"
                  style={{ flex: 1, padding: "5px 0", textAlign: "center", fontSize: "0.74rem" }}
                  onClick={() => addWater(0.5)}
                >
                  +500ml
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Extended Scrolling Content Below: Meal Logger */}
        <div className="module-card">

          <div className="macro-ring-card">
            <div className="macro-ring-icon macro-fats">🥑</div>
            <div style={{ flex: 1 }}>
              <div className="macro-meta-title">Essential Fats</div>
              <div className="macro-meta-val">{totalFats}g / 70g</div>
              <div style={{ width: "100%", height: 6, background: "rgba(255,255,255,0.1)", borderRadius: 99, marginTop: 8, overflow: "hidden" }}>
                <div style={{ width: `${Math.min((totalFats / 70) * 100, 100)}%`, height: "100%", background: "#10b981" }} />
              </div>
            </div>
          </div>
        </div>

        {/* Grid: Meals List on Left, Hydration & Quick Add on Right */}
        <div className="module-grid-2col">
          {/* Meals Timeline */}
          <div className="module-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800 }}>
                Today's Nutrition Timeline
              </h3>
              <span className="module-status-pill">{meals.length} Meals Logged</span>
            </div>

            {meals.length === 0 ? (
              <div style={{ textAlign: "center", padding: "34px 20px", color: "#94a3b8" }}>
                <div style={{ fontSize: "2rem", marginBottom: 8 }}>🥗</div>
                <div style={{ fontWeight: 800, color: "#fff", fontSize: "0.95rem" }}>No Meals Logged Today</div>
                <div style={{ fontSize: "0.75rem", color: "#8da4be", marginTop: 4 }}>
                  Fuel your athletic performance. Use the Quick Entry form on the right to log your first meal.
                </div>
              </div>
            ) : (
              meals.map((m) => (
                <div key={m.id} className="workout-exercise-row">
                  <div>
                    <div className="workout-ex-name">{m.name}</div>
                    <div className="workout-ex-target">{m.time} • {m.tags}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="workout-ex-meta">{m.calories} kcal</div>
                    <div style={{ fontSize: "0.74rem", color: "#00b4ff" }}>
                      {m.protein}g P • {m.carbs}g C • {m.fats}g F
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Right Column: Hydration & Quick Log */}
          <div>
            {/* Hydration Tracker */}
            <div className="module-card" style={{ marginBottom: 24 }}>
              <div className="module-hero-kicker">CELLULAR HYDRATION</div>
              <h3 style={{ margin: "0 0 14px 0", fontSize: "1.15rem", fontWeight: 800 }}>
                Water Intake Monitor
              </h3>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontSize: "1.8rem", fontWeight: 900, fontFamily: "JetBrains Mono" }}>
                  {waterLiters}L <span style={{ fontSize: "0.9rem", color: "#94a3b8" }}>/ {waterTarget}L</span>
                </span>
                <span className="module-status-pill">
                  {Math.round((waterLiters / waterTarget) * 100)}% GOAL
                </span>
              </div>

              <div style={{ width: "100%", height: 10, background: "rgba(255,255,255,0.1)", borderRadius: 99, marginBottom: 16, overflow: "hidden" }}>
                <div style={{ width: `${Math.min((waterLiters / waterTarget) * 100, 100)}%`, height: "100%", background: "linear-gradient(90deg, #00b4ff, #00f0ff)" }} />
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  className="workout-timer-btn"
                  style={{ flex: 1 }}
                  onClick={() => addWater(0.25)}
                >
                  +250 ml
                </button>
                <button
                  type="button"
                  className="workout-timer-btn"
                  style={{ flex: 1 }}
                  onClick={() => addWater(0.5)}
                >
                  +500 ml
                </button>
                <button
                  type="button"
                  className="workout-timer-btn"
                  style={{ flex: 1 }}
                  onClick={() => addWater(1.0)}
                >
                  +1.0 L
                </button>
              </div>
            </div>

            {/* Quick Meal Logger */}
            <div className="module-card">
              <div className="module-hero-kicker">CUSTOM ENTRY</div>
              <h3 style={{ margin: "0 0 16px 0", fontSize: "1.15rem", fontWeight: 800 }}>
                Log Extra Snack or Shake
              </h3>

              <form onSubmit={handleAddMeal} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <input
                  type="text"
                  placeholder="Item name (e.g. Whey Protein Shake)"
                  value={newMealName}
                  onChange={(e) => setNewMealName(e.target.value)}
                  className="trainer-chat-input"
                  style={{ width: "100%", boxSizing: "border-box" }}
                />
                <div style={{ display: "flex", gap: 10 }}>
                  <input
                    type="number"
                    placeholder="Calories (kcal)"
                    value={newMealCalories}
                    onChange={(e) => setNewMealCalories(e.target.value)}
                    className="trainer-chat-input"
                    style={{ flex: 1 }}
                  />
                  <input
                    type="number"
                    placeholder="Protein (g)"
                    value={newMealProtein}
                    onChange={(e) => setNewMealProtein(e.target.value)}
                    className="trainer-chat-input"
                    style={{ flex: 1 }}
                  />
                </div>
                <button type="submit" className="community-btn-primary" style={{ marginTop: 4 }}>
                  + Add to Timeline
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

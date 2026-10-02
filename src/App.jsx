import { useEffect, useState } from "react";

import HeroVideo from "./components/HeroVideo";
import Navbar from "./components/Navbar";
import RealtimeToast from "./components/RealtimeToast";
import { initRealtimeClient } from "./services/realtime";

import IntroSection from "./sections/IntroSection";
import EcosystemSection from "./sections/EcosystemSection";
import MembershipSection from "./sections/MembershipSection";
import TrainersSection from "./sections/TrainersSection";
import PerformanceSection from "./sections/PerformanceSection";
import AttendanceSection from "./sections/AttendanceSection";
import PaymentSection from "./sections/PaymentSection";
import ProcessSection from "./sections/ProcessSection";
import FinalSection from "./sections/FinalSection";

import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import DashboardPage from "./pages/DashboardPage";
import TrainerDashboardPage from "./pages/TrainerDashboardPage";
import CommunityModulePage from "./pages/modules/CommunityModulePage";
import WorkoutsModulePage from "./pages/modules/WorkoutsModulePage";
import NutritionModulePage from "./pages/modules/NutritionModulePage";
import TrainersModulePage from "./pages/modules/TrainersModulePage";
import ProgressModulePage from "./pages/modules/ProgressModulePage";
import PlansModulePage from "./pages/modules/PlansModulePage";
import AttendanceModulePage from "./pages/modules/AttendanceModulePage";
import SettingsModulePage from "./pages/modules/SettingsModulePage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import AttendanceLoginPage from "./pages/AttendanceLoginPage";

function App() {
  const [pathname, setPathname] = useState(
    window.location.pathname
  );

  useEffect(() => {
    // Start WebSocket listener
    initRealtimeClient();

    const handleNavigation = () => {
      setPathname(
        window.location.pathname
      );
    };

    window.addEventListener(
      "popstate",
      handleNavigation
    );

    return () => {
      window.removeEventListener(
        "popstate",
        handleNavigation
      );
    };
  }, []);

  const renderPage = () => {
    if (pathname === "/login") {
      return <LoginPage />;
    }

    if (pathname === "/attendance-login" || pathname === "/attendance/login") {
      return <AttendanceLoginPage />;
    }

    if (pathname === "/signup") {
      return <SignupPage />;
    }

    // Dedicated Standalone Module Pages
    if (pathname === "/dashboard/community" || pathname === "/community") {
      return <CommunityModulePage />;
    }

    if (pathname === "/dashboard/workouts" || pathname === "/workouts") {
      return <WorkoutsModulePage />;
    }

    if (pathname === "/dashboard/nutrition" || pathname === "/nutrition") {
      return <NutritionModulePage />;
    }

    if (pathname === "/dashboard/attendance" || pathname === "/attendance") {
      return <AttendanceModulePage />;
    }

    if (pathname === "/dashboard/trainers" || pathname === "/trainers") {
      return <TrainersModulePage />;
    }

    if (pathname === "/dashboard/progress" || pathname === "/progress") {
      return <ProgressModulePage />;
    }

    if (pathname === "/dashboard/plans" || pathname === "/plans") {
      return <PlansModulePage />;
    }

    if (pathname === "/dashboard/settings" || pathname === "/settings") {
      return <SettingsModulePage />;
    }

    if (pathname.startsWith("/dashboard")) {
      return <DashboardPage />;
    }

    if (pathname.startsWith("/admin-dashboard") || pathname === "/admin") {
      return <AdminDashboardPage />;
    }

    if (pathname.startsWith("/trainer-dashboard")) {
      return <TrainerDashboardPage />;
    }

    return (
      <main>
        <Navbar />
        <HeroVideo />
        <IntroSection />
        <EcosystemSection />
        <MembershipSection />
        <TrainersSection />
        <PerformanceSection />
        <AttendanceSection />
        <PaymentSection />
        <ProcessSection />
        <FinalSection />
      </main>
    );
  };

  return (
    <>
      {renderPage()}
      <RealtimeToast />
    </>
  );
}

export default App;
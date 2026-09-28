import CampusHeatmap from "./pages/CampusHeatmap";

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { useEffect, useState } from "react";

import { supabase } from "./services/supabase";

import {
  Sun,
  Moon,
} from "lucide-react";

/* Pages */

import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import Home from "./pages/Home";
import ReportLost from "./pages/ReportLost";
import ReportFound from "./pages/ReportFound";
import Matches from "./pages/Matches";
import Dashboard from "./pages/Dashboard";
import MysteryMatch from "./pages/MysteryMatch";
import CommunitySearch from "./pages/CommunitySearch";
import ContactAgent from "./pages/ContactAgent";
import Chat from "./pages/Chat";
import ComplaintBox from "./pages/ComplaintBox";
import ClaimItem from "./pages/ClaimItem";
import VerifyOwnership from "./pages/VerifyOwnership";
import { Leaderboard } from "./pages/leaderboard";

/* ======================================================
   AUTH CHECK
====================================================== */

function ProtectedRoute({ children }) {
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    let mounted = true;

    const getSession = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error("Session error:", error);
      }

      if (mounted) {
        setSession(data?.session || null);
      }
    };

    getSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (mounted) {
        setSession(newSession);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  /* Checking session */

  if (session === undefined) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          background: "var(--app-bg, #050505)",
          color: "var(--app-text, white)",
          fontSize: "18px",
        }}
      >
        Loading...
      </div>
    );
  }

  /* Not logged in */

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

/* ======================================================
   THEME BUTTON
====================================================== */

function ThemeToggle({ theme, onToggle }) {
  const isDark = theme === "dark";

  const handleClick = () => {
    const button = document.querySelector(".theme-toggle");

    if (button) {
      const rect = button.getBoundingClientRect();

      document.documentElement.style.setProperty(
        "--theme-x",
        `${rect.left + rect.width / 2}px`
      );

      document.documentElement.style.setProperty(
        "--theme-y",
        `${rect.top + rect.height / 2}px`
      );
    }

    /*
      Start the circular reveal animation first.
      The actual theme changes slightly after the
      animation begins so the switch feels smoother.
    */

    document.documentElement.classList.add("theme-transition");

    setTimeout(() => {
      onToggle();
    }, 80);

    setTimeout(() => {
      document.documentElement.classList.remove("theme-transition");
    }, 700);
  };

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={handleClick}
      aria-label={`Switch to ${isDark ? "light" : "dark"} theme`}
      title={`Switch to ${isDark ? "light" : "dark"} theme`}
    >
      <span className="theme-icon theme-icon-sun">
        <Sun size={17} />
      </span>

      <span className="theme-icon theme-icon-moon">
        <Moon size={17} />
      </span>

      <span className="theme-toggle-thumb">
        {isDark ? <Moon size={14} /> : <Sun size={14} />}
      </span>
    </button>
  );
}

/* ======================================================
   APP
====================================================== */

function App() {
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem("slf-theme");

    if (savedTheme === "dark" || savedTheme === "light") {
      return savedTheme;
    }

    return "light";
  });

  /* ====================================================
     APPLY THEME
  ==================================================== */

  useEffect(() => {
    const root = document.documentElement;

    root.classList.remove("light", "dark");
    root.classList.add(theme);

    localStorage.setItem("slf-theme", theme);

    root.style.colorScheme = theme;
  }, [theme]);

  /* ====================================================
     THEME TOGGLE
  ==================================================== */

  const toggleTheme = () => {
    setTheme((currentTheme) =>
      currentTheme === "light" ? "dark" : "light"
    );
  };

  return (
    <BrowserRouter basename="/smartlostandfound">

      {/* GLOBAL THEME BUTTON */}

      <ThemeToggle
        theme={theme}
        onToggle={toggleTheme}
      />

      <Routes>

        {/* ==============================================
            ROOT
        ============================================== */}

        <Route
          path="/"
          element={<Navigate to="/home" replace />}
        />

        {/* ==============================================
            AUTH
        ============================================== */}

        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/signup"
          element={<SignUp />}
        />

        {/* ==============================================
            HOME
        ============================================== */}

        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />

        {/* ==============================================
            DASHBOARD
        ============================================== */}

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        {/* ==============================================
            REPORT LOST
        ============================================== */}

        <Route
          path="/report-lost"
          element={
            <ProtectedRoute>
              <ReportLost />
            </ProtectedRoute>
          }
        />

        {/* ==============================================
            REPORT FOUND
        ============================================== */}

        <Route
          path="/report-found"
          element={
            <ProtectedRoute>
              <ReportFound />
            </ProtectedRoute>
          }
        />

        {/* ==============================================
            SMART MATCHES
        ============================================== */}

        <Route
          path="/matches"
          element={
            <ProtectedRoute>
              <Matches />
            </ProtectedRoute>
          }
        />

        {/* ==============================================
            MYSTERY MATCH
        ============================================== */}

        <Route
          path="/mystery-match"
          element={
            <ProtectedRoute>
              <MysteryMatch />
            </ProtectedRoute>
          }
        />

        {/* ==============================================
            LEADERBOARD
        ============================================== */}

        <Route
          path="/leaderboard"
          element={
            <ProtectedRoute>
              <Leaderboard />
            </ProtectedRoute>
          }
        />

        {/* ==============================================
            CAMPUS HEATMAP
        ============================================== */}

        <Route
          path="/heatmap"
          element={
            <ProtectedRoute>
              <CampusHeatmap />
            </ProtectedRoute>
          }
        />

        {/* ==============================================
            COMMUNITY
        ============================================== */}

        <Route
          path="/community"
          element={
            <ProtectedRoute>
              <CommunitySearch />
            </ProtectedRoute>
          }
        />

        {/* ==============================================
            CONTACT AGENT
        ============================================== */}

        <Route
          path="/contact-agent"
          element={
            <ProtectedRoute>
              <ContactAgent />
            </ProtectedRoute>
          }
        />

        {/* ==============================================
            PRIVATE CHAT
        ============================================== */}

        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <Chat />
            </ProtectedRoute>
          }
        />

        {/* ==============================================
            COMPLAINT BOX
        ============================================== */}

        <Route
          path="/complaints"
          element={
            <ProtectedRoute>
              <ComplaintBox />
            </ProtectedRoute>
          }
        />

        {/* ==============================================
            CLAIM ITEM (OWNERSHIP VERIFICATION)
        ============================================== */}

        <Route
          path="/claim/:foundItemId"
          element={
            <ProtectedRoute>
              <ClaimItem />
            </ProtectedRoute>
          }
        />

        {/* ==============================================
            VERIFY OWNERSHIP (FOUNDER REVIEW)
        ============================================== */}

        <Route
          path="/verify-ownership/:foundItemId"
          element={
            <ProtectedRoute>
              <VerifyOwnership />
            </ProtectedRoute>
          }
        />

        {/* ==============================================
            UNKNOWN URL
        ============================================== */}

        <Route
          path="*"
          element={<Navigate to="/home" replace />}
        />

      </Routes>
    </BrowserRouter>
  );
}

export default App;
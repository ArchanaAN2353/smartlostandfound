import CampusHeatmap from "./pages/CampusHeatmap";

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { useEffect, useState } from "react";

import { supabase } from "./services/supabase";

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

    } = supabase.auth.onAuthStateChange(

      (_event, newSession) => {

        if (mounted) {

          setSession(newSession);

        }

      }

    );

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

          background: "#050505",

          color: "white",

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
   APP
====================================================== */

function App() {

  return (

    <BrowserRouter basename="/smartlostandfound">

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


        {/* =========================================================================
            LEADERBOARD
        ========================================================================= */}

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
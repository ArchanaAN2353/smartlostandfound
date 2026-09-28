import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  ArrowLeft,
  Package,
  Search,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  XCircle,
  Clock3,
  RotateCcw,
  User,
  Mail,
  LogOut,
} from "lucide-react";

import { supabase } from "../services/supabase";

function Dashboard() {
  const navigate = useNavigate();

  const [lostItems, setLostItems] = useState([]);
  const [foundItems, setFoundItems] = useState([]);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  const [user, setUser] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);

  // ======================================================
  // LOAD USER + DASHBOARD
  // ======================================================

  useEffect(() => {
    loadUser();
    loadDashboard();
  }, []);

  // ======================================================
  // LOAD CURRENT USER
  // ======================================================

  async function loadUser() {
    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) {
        console.error("User loading error:", error);
        return;
      }

      if (!user) {
        navigate("/login", { replace: true });
        return;
      }

      setUser(user);
    } catch (error) {
      console.error("User loading error:", error);
    }
  }

  // ======================================================
  // LOAD ONLY CURRENT USER'S DATA
  // ======================================================

  async function loadDashboard() {
    try {
      setLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        navigate("/login", { replace: true });
        return;
      }

      setUser(user);

      // --------------------------------------------------
      // ONLY THIS USER'S LOST ITEMS
      // --------------------------------------------------

      const {
        data: lost,
        error: lostError,
      } = await supabase
        .from("lost_items")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (lostError) {
        throw lostError;
      }

      // --------------------------------------------------
      // ONLY THIS USER'S FOUND ITEMS
      // --------------------------------------------------

      const {
        data: found,
        error: foundError,
      } = await supabase
        .from("found_items")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (foundError) {
        throw foundError;
      }

      setLostItems(lost || []);
      setFoundItems(found || []);
    } catch (error) {
      console.error("Dashboard error:", error);
    } finally {
      setLoading(false);
    }
  }

  // ======================================================
  // LOGOUT
  // ======================================================

  async function handleLogout() {
    setLoggingOut(true);

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Logout error:", error);
      alert(error.message);
      setLoggingOut(false);
      return;
    }

    navigate("/login", { replace: true });
  }

  // ======================================================
  // VERIFY CLAIM
  // ======================================================

  async function verifyClaim(foundItemId) {
    setActionLoading(foundItemId);

    try {
      const response = await fetch(
        `https://smartlostandfound-7oo8.onrender.com/api/found/${foundItemId}/verify`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to verify claim"
        );
      }

      setFoundItems((currentItems) =>
        currentItems.map((item) =>
          item.id === foundItemId
            ? {
                ...item,
                claimed: true,
                claim_status: "verified",
              }
            : item
        )
      );
    } catch (error) {
      console.error("Verify claim error:", error);
      alert(error.message);
    } finally {
      setActionLoading(null);
    }
  }

  // ======================================================
  // REJECT CLAIM
  // ======================================================

  async function rejectClaim(foundItemId) {
    setActionLoading(foundItemId);

    try {
      const response = await fetch(
        `https://smartlostandfound-7oo8.onrender.com/api/found/${foundItemId}/reject`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to reject claim"
        );
      }

      setFoundItems((currentItems) =>
        currentItems.map((item) =>
          item.id === foundItemId
            ? {
                ...item,
                claimed: false,
                claim_status: "rejected",
              }
            : item
        )
      );
    } catch (error) {
      console.error("Reject claim error:", error);
      alert(error.message);
    } finally {
      setActionLoading(null);
    }
  }

  // ======================================================
  // MARK AS RETURNED
  // ======================================================

  async function markAsReturned(foundItemId) {
    const confirmed = window.confirm(
      "Mark this verified item as returned?"
    );

    if (!confirmed) return;

    setActionLoading(foundItemId);

    try {
      const response = await fetch(
        `https://smartlostandfound-7oo8.onrender.com/api/found/${foundItemId}/returned`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to mark item as returned"
        );
      }

      setFoundItems((currentItems) =>
        currentItems.map((item) =>
          item.id === foundItemId
            ? {
                ...item,
                claimed: true,
                claim_status: "verified",
                returned: true,
                status: "returned",
                returned_at:
                  data.item?.returned_at ||
                  new Date().toISOString(),
              }
            : item
        )
      );
    } catch (error) {
      console.error("Mark returned error:", error);
      alert(error.message);
    } finally {
      setActionLoading(null);
    }
  }

  // ======================================================
  // DASHBOARD STATISTICS
  // ======================================================

  const claimedCount = foundItems.filter(
    (item) =>
      item.claimed === true &&
      item.claim_status === "verified" &&
      item.returned !== true
  ).length;

  const returnedCount = foundItems.filter(
    (item) => item.returned === true
  ).length;

  const pendingClaims = foundItems.filter(
    (item) =>
      item.claim_status === "pending" &&
      item.returned !== true
  );

  const verifiedClaims = foundItems.filter(
    (item) =>
      item.claim_status === "verified" &&
      item.returned !== true
  );

  const possibleComparisons =
    lostItems.length * foundItems.length;

  // ======================================================
  // DISPLAY NAME
  // ======================================================

  const displayName =
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "User";

  // ======================================================
  // UI
  // ======================================================

  return (
    <div className="form-page">
      <div className="form-container">

        <Link to="/home" className="back-link">
          <ArrowLeft size={18} />
          Back to Home
        </Link>

        <div className="form-header">

          <div className="form-icon">
            <Sparkles size={26} />
          </div>

          <p className="eyebrow">
            CAMPUS RECOVERY CENTER
          </p>

          <h1>Dashboard</h1>

          <p>
            Monitor your lost items, found items and
            SmartMatch activity in one place.
          </p>

        </div>

        <div
          className="step-card"
          style={{
            marginBottom: "25px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "20px",
            flexWrap: "wrap",
          }}
        >

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
            }}
          >

            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid currentColor",
                flexShrink: 0,
              }}
            >
              <User size={22} />
            </div>

            <div>

              <p
                className="eyebrow"
                style={{ marginBottom: "4px" }}
              >
                SIGNED IN AS
              </p>

              <h3 style={{ margin: "0 0 5px" }}>
                {displayName}
              </h3>

              <p
                style={{
                  margin: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "14px",
                }}
              >
                <Mail size={14} />
                {user?.email || "Loading email..."}
              </p>

            </div>

          </div>

          <button
            type="button"
            className="secondary-button"
            onClick={handleLogout}
            disabled={loggingOut}
          >
            <LogOut size={17} />

            {loggingOut
              ? "Signing out..."
              : "Logout"}
          </button>

        </div>

        {loading ? (

          <div className="step-card">

            <Sparkles size={30} />

            <h3>
              Loading your dashboard...
            </h3>

            <p>
              Getting your personal reports.
            </p>

          </div>

        ) : (

          <>

            <div
              className="steps"
              style={{ marginBottom: "25px" }}
            >

              <div className="step-card">

                <Search size={25} />

                <h3>
                  {lostItems.length}
                </h3>

                <p>
                  My Lost Reports
                </p>

              </div>

              <div className="step-card">

                <Package size={25} />

                <h3>
                  {foundItems.length}
                </h3>

                <p>
                  My Found Reports
                </p>

              </div>

              <div className="step-card">

                <Sparkles size={25} />

                <h3>
                  {possibleComparisons}
                </h3>

                <p>
                  Possible Comparisons
                </p>

              </div>

              <div className="step-card">

                <CheckCircle2 size={25} />

                <h3>
                  {claimedCount}
                </h3>

                <p>
                  Verified Claims
                </p>

              </div>

            </div>

            <div
              className="steps"
              style={{ marginBottom: "25px" }}
            >

              <div className="step-card">

                <Clock3 size={24} />

                <h3>
                  {pendingClaims.length}
                </h3>

                <p>
                  Pending Claims
                </p>

              </div>

              <div className="step-card">

                <ShieldCheck size={24} />

                <h3>
                  {verifiedClaims.length}
                </h3>

                <p>
                  Active Verified Claims
                </p>

              </div>

              <div className="step-card">

                <RotateCcw size={24} />

                <h3>
                  {returnedCount}
                </h3>

                <p>
                  Returned Items
                </p>

              </div>

            </div>

            <div
              className="step-card"
              style={{ marginBottom: "25px" }}
            >

              <h3>
                Quick Actions
              </h3>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "12px",
                  marginTop: "15px",
                }}
              >

                <Link
                  to="/report-lost"
                  className="primary-button"
                >
                  <Search size={18} />
                  Report Lost
                </Link>

                <Link
                  to="/report-found"
                  className="secondary-button"
                >
                  <Package size={18} />
                  Report Found
                </Link>

                <Link
                  to="/matches"
                  className="secondary-button"
                >
                  <Sparkles size={18} />
                  SmartMatch
                </Link>

              </div>

            </div>

            <div
              className="step-card"
              style={{ marginBottom: "25px" }}
            >

              <h3>
                My Recent Lost Reports
              </h3>

              {lostItems.length === 0 ? (

                <div
                  style={{
                    padding: "20px 0",
                    opacity: 0.7,
                  }}
                >
                  <Search size={24} />

                  <p>
                    You haven't reported any lost
                    items yet.
                  </p>

                  <Link
                    to="/report-lost"
                    className="primary-button"
                  >
                    Report Lost Item
                  </Link>
                </div>

              ) : (

                lostItems
                  .slice(0, 5)
                  .map((item) => (

                    <div
                      key={item.id}
                      style={{
                        padding: "15px 0",
                        borderBottom:
                          "1px solid rgba(255,255,255,0.08)",
                      }}
                    >

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "15px",
                          flexWrap: "wrap",
                        }}
                      >

                        <div>

                          <strong>
                            {item.item_name}
                          </strong>

                          <p>
                            {item.location || "Location not specified"}
                          </p>

                          {item.lost_date && (
                            <small>
                              Lost on {item.lost_date}
                            </small>
                          )}

                        </div>

                        <span
                          style={{
                            padding: "6px 10px",
                            borderRadius: "20px",
                            fontSize: "12px",
                            border:
                              "1px solid rgba(255,255,255,0.15)",
                          }}
                        >
                          {item.status || "lost"}
                        </span>

                      </div>

                    </div>

                  ))

              )}

            </div>

            <div
              className="step-card"
              style={{ marginBottom: "25px" }}
            >

              <h3>
                My Recent Found Reports
              </h3>

              {foundItems.length === 0 ? (

                <div
                  style={{
                    padding: "20px 0",
                    opacity: 0.7,
                  }}
                >

                  <Package size={24} />

                  <p>
                    You haven't reported any found
                    items yet.
                  </p>

                  <Link
                    to="/report-found"
                    className="secondary-button"
                  >
                    Report Found Item
                  </Link>

                </div>

              ) : (

                foundItems
                  .slice(0, 5)
                  .map((item) => (

                    <div
                      key={item.id}
                      style={{
                        padding: "15px 0",
                        borderBottom:
                          "1px solid rgba(255,255,255,0.08)",
                      }}
                    >

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "15px",
                          flexWrap: "wrap",
                        }}
                      >

                        <div>

                          <strong>
                            {item.item_name}
                          </strong>

                          <p>
                            {item.location || "Location not specified"}
                          </p>

                          {item.found_date && (
                            <small>
                              Found on {item.found_date}
                            </small>
                          )}

                        </div>

                        <span
                          style={{
                            padding: "6px 10px",
                            borderRadius: "20px",
                            fontSize: "12px",
                            border:
                              "1px solid rgba(255,255,255,0.15)",
                          }}
                        >
                          {item.status || "found"}
                        </span>

                      </div>

                      {item.claim_status === "pending" &&
                        item.returned !== true && (

                          <div
                            style={{
                              display: "flex",
                              gap: "10px",
                              flexWrap: "wrap",
                              marginTop: "12px",
                            }}
                          >

                            <Link
                              to={`/verify-ownership/${item.id}`}
                              className="secondary-button"
                              style={{ textDecoration: "none" }}
                            >
                              <ShieldCheck size={16} />
                              Review Evidence
                            </Link>

                            <button
                              type="button"
                              className="primary-button"
                              disabled={
                                actionLoading === item.id
                              }
                              onClick={() =>
                                verifyClaim(item.id)
                              }
                            >
                              <CheckCircle2 size={16} />

                              {actionLoading === item.id
                                ? "Processing..."
                                : "Verify Claim"}
                            </button>

                            <button
                              type="button"
                              className="secondary-button"
                              disabled={
                                actionLoading === item.id
                              }
                              onClick={() =>
                                rejectClaim(item.id)
                              }
                            >
                              <XCircle size={16} />
                              Reject
                            </button>

                          </div>

                        )}

                      {item.claim_status === "verified" &&
                        item.returned !== true && (

                          <div
                            style={{
                              marginTop: "12px",
                            }}
                          >

                            <button
                              type="button"
                              className="secondary-button"
                              disabled={
                                actionLoading === item.id
                              }
                              onClick={() =>
                                markAsReturned(item.id)
                              }
                            >
                              <RotateCcw size={16} />

                              {actionLoading === item.id
                                ? "Updating..."
                                : "Mark as Returned"}
                            </button>

                          </div>

                        )}

                      {item.returned === true && (

                        <div
                          style={{
                            marginTop: "12px",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >

                          <CheckCircle2 size={18} />

                          <span>
                            Item returned successfully
                          </span>

                        </div>

                      )}

                    </div>

                  ))

              )}

            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginTop: "20px",
              }}
            >

              <button
                type="button"
                className="secondary-button"
                onClick={loadDashboard}
              >
                <RotateCcw size={17} />
                Refresh Dashboard
              </button>

            </div>

          </>

        )}

      </div>
    </div>
  );
}

export default Dashboard;
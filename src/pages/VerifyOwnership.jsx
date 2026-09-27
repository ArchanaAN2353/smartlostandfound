import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import {
  ArrowLeft,
  ShieldCheck,
  CheckCircle,
  XCircle,
  Clock,
  ImageIcon,
  Eye,
  EyeOff,
} from "lucide-react";

import { supabase } from "../services/supabase";

function VerifyOwnership() {
  const { foundItemId } = useParams();

  const [currentUser, setCurrentUser] = useState(null);
  const [foundItem, setFoundItem] = useState(null);
  const [claims, setClaims] = useState([]);

  const [showAnswer, setShowAnswer] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadPage();
  }, [foundItemId]);

  async function loadPage() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setError("You must be logged in to review claims.");
        setLoading(false);
        return;
      }

      setCurrentUser(session.user);

      const { data: item, error: itemError } = await supabase
        .from("found_items")
        .select("*")
        .eq("id", foundItemId)
        .single();

      if (itemError) throw itemError;

      if (item.user_id !== session.user.id) {
        setError(
          "Only the person who reported this found item can review claims on it."
        );
        setLoading(false);
        return;
      }

      setFoundItem(item);

      const { data: claimData, error: claimError } = await supabase
        .from("claim_requests")
        .select("*")
        .eq("found_item_id", foundItemId)
        .order("created_at", { ascending: false });

      if (claimError) throw claimError;

      setClaims(claimData || []);
    } catch (err) {
      console.error("VerifyOwnership load error:", err);

      setError(
        err.code === "42P01" || err.message?.includes("does not exist")
          ? "Ownership verification isn't set up in the database yet."
          : err.message || "Unable to load this item."
      );
    } finally {
      setLoading(false);
    }
  }

  async function decideClaim(claimId, decision) {
    setActionLoading(claimId);
    setError("");
    setSuccess("");

    try {
      const { data: updatedClaim, error: claimUpdateError } =
        await supabase
          .from("claim_requests")
          .update({
            status: decision,
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", claimId)
          .select()
          .single();

      if (claimUpdateError) throw claimUpdateError;

      setClaims((previous) =>
        previous.map((claim) =>
          claim.id === claimId ? updatedClaim : claim
        )
      );

      // If verified, also mark the found item itself as verified —
      // same status the rest of the app (Dashboard, Matches) already
      // reads from found_items.claim_status.
      if (decision === "verified") {
        const { error: itemUpdateError } = await supabase
          .from("found_items")
          .update({
            claimed: true,
            claim_status: "verified",
          })
          .eq("id", foundItemId);

        if (itemUpdateError) throw itemUpdateError;

        setFoundItem((previous) => ({
          ...previous,
          claimed: true,
          claim_status: "verified",
        }));

        // Any other still-pending claims on this same item are now
        // moot — the item has already been matched to someone else.
        const { data: rejectedRest } = await supabase
          .from("claim_requests")
          .update({ status: "rejected", reviewed_at: new Date().toISOString() })
          .eq("found_item_id", foundItemId)
          .eq("status", "pending")
          .neq("id", claimId)
          .select();

        if (rejectedRest?.length) {
          setClaims((previous) =>
            previous.map((claim) =>
              rejectedRest.some((r) => r.id === claim.id)
                ? { ...claim, status: "rejected" }
                : claim
            )
          );
        }
      }

      setSuccess(
        decision === "verified"
          ? "Claim verified. The item is now marked as matched."
          : "Claim rejected."
      );
    } catch (err) {
      console.error("Claim decision error:", err);
      setError(err.message || "Unable to update this claim.");
    } finally {
      setActionLoading(null);
    }
  }

  function statusPill(status) {
    if (status === "verified") {
      return (
        <span className="v-status verified">
          <CheckCircle size={13} /> Verified
        </span>
      );
    }

    if (status === "rejected") {
      return (
        <span className="v-status rejected">
          <XCircle size={13} /> Rejected
        </span>
      );
    }

    return (
      <span className="v-status pending">
        <Clock size={13} /> Pending
      </span>
    );
  }

  if (loading) {
    return (
      <div className="v-shell">
        <div className="v-loading">
          <div className="v-spinner" />
          <p>Loading claims...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="v-shell">
      <div className="v-container">
        <Link to="/dashboard" className="v-back">
          <ArrowLeft size={18} />
          Back to Dashboard
        </Link>

        <div className="v-header">
          <div className="v-eyebrow">
            <ShieldCheck size={16} />
            REVIEW OWNERSHIP CLAIMS
          </div>
          <h1>Who does this belong to?</h1>
          <p>
            Compare each claimant's answer against your own secret
            answer before verifying. Verifying one claim
            automatically rejects any other pending claims on this
            item.
          </p>
        </div>

        {error && <div className="v-alert v-error">{error}</div>}
        {success && <div className="v-alert v-success">{success}</div>}

        {foundItem && (
          <div className="v-item-panel">
            {foundItem.image_url ? (
              <img src={foundItem.image_url} alt={foundItem.item_name} />
            ) : (
              <div className="v-image-placeholder">
                <ImageIcon size={26} />
              </div>
            )}

            <div>
              <h2>{foundItem.item_name}</h2>
              <p>{foundItem.description}</p>

              {(foundItem.verification_questions || []).length > 0 ? (
                <div className="v-secret-block">
                  <div className="v-secret-row" style={{ marginBottom: 8 }}>
                    <strong>Your answers:</strong>

                    <button
                      type="button"
                      className="v-eye-toggle"
                      onClick={() => setShowAnswer((s) => !s)}
                    >
                      {showAnswer ? (
                        <>
                          <EyeOff size={14} /> Hide
                        </>
                      ) : (
                        <>
                          <Eye size={14} /> Show
                        </>
                      )}
                    </button>
                  </div>

                  {foundItem.verification_questions.map((question, i) => (
                    <div key={i} style={{ marginBottom: 6 }}>
                      <div style={{ fontSize: 13, color: "#4f483e" }}>
                        Q{i + 1}: {question}
                      </div>
                      <div style={{ fontSize: 13, color: "#8b4d32" }}>
                        A{i + 1}:{" "}
                        {showAnswer ? (
                          foundItem.verification_answers?.[i]
                        ) : (
                          <span className="v-hidden">••••••••</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="v-muted">
                  You didn't set any secret questions for this item —
                  review each claim's description manually.
                </p>
              )}
            </div>
          </div>
        )}

        <section className="v-claims">
          <h2>
            Claims ({claims.length})
          </h2>

          {claims.length === 0 ? (
            <p className="v-muted">No one has claimed this item yet.</p>
          ) : (
            <div className="v-claims-list">
              {claims.map((claim) => (
                <div className="v-claim-card" key={claim.id}>
                  <div className="v-claim-top">
                    <div>
                      <strong>{claim.claimant_name}</strong>
                      <span className="v-claim-date">
                        {new Date(claim.created_at).toLocaleString()}
                      </span>
                    </div>
                    {statusPill(claim.status)}
                  </div>

                  <div className="v-claim-answer">
                    <span className="v-claim-answer-label">
                      Their answers:
                    </span>

                    {(claim.claimant_answers || []).map((a, i) => {
                      const correctAnswer =
                        foundItem?.verification_answers?.[i];

                      const isMatch =
                        correctAnswer &&
                        a.trim().toLowerCase() ===
                          correctAnswer.trim().toLowerCase();

                      return (
                        <div
                          key={i}
                          style={{
                            marginBottom: 4,
                            color: isMatch ? "#4e5b3d" : "inherit",
                            fontWeight: isMatch ? 600 : 400,
                          }}
                        >
                          {i + 1}. {a}
                          {isMatch ? " ✓ matches your answer" : ""}
                        </div>
                      );
                    })}
                  </div>

                  {claim.status === "pending" && (
                    <div className="v-claim-actions">
                      <button
                        type="button"
                        className="v-verify-btn"
                        disabled={actionLoading === claim.id}
                        onClick={() => decideClaim(claim.id, "verified")}
                      >
                        <CheckCircle size={16} />
                        {actionLoading === claim.id
                          ? "Processing..."
                          : "Verify — This Is Correct"}
                      </button>

                      <button
                        type="button"
                        className="v-reject-btn"
                        disabled={actionLoading === claim.id}
                        onClick={() => decideClaim(claim.id, "rejected")}
                      >
                        <XCircle size={16} />
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <style>{`
        .v-shell {
          min-height: 100vh;
          padding: 40px 20px 80px;
          background:
            radial-gradient(circle at 10% 10%, rgba(157, 111, 63, 0.10), transparent 30%),
            radial-gradient(circle at 90% 80%, rgba(78, 91, 61, 0.10), transparent 30%),
            #f4efe5;
          color: #2b2924;
        }

        .v-container { width: min(760px, 100%); margin: 0 auto; }

        .v-back {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: #51483c;
          text-decoration: none;
          font-family: "IBM Plex Mono", monospace;
          font-size: 13px;
          margin-bottom: 30px;
        }

        .v-header { margin-bottom: 28px; }

        .v-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: #8b4d32;
          font-family: "IBM Plex Mono", monospace;
          font-size: 12px;
          letter-spacing: 1.5px;
          margin-bottom: 12px;
        }

        .v-header h1 {
          margin: 0;
          font-family: "Fraunces", serif;
          font-size: clamp(30px, 5vw, 44px);
          font-weight: 600;
        }

        .v-header p {
          margin-top: 12px;
          color: #71685b;
          font-size: 14px;
          line-height: 1.6;
          max-width: 560px;
        }

        .v-alert {
          padding: 14px 16px;
          border-radius: 10px;
          margin-bottom: 20px;
          font-size: 13px;
        }

        .v-error {
          background: rgba(139, 77, 50, 0.10);
          border: 1px solid rgba(139, 77, 50, 0.25);
          color: #7a3f29;
        }

        .v-success {
          background: rgba(78, 91, 61, 0.11);
          border: 1px solid rgba(78, 91, 61, 0.25);
          color: #4e5b3d;
        }

        .v-item-panel {
          display: flex;
          gap: 18px;
          background: rgba(255, 252, 245, 0.85);
          border: 1px solid rgba(91, 76, 58, 0.15);
          border-radius: 16px;
          padding: 20px;
          margin-bottom: 26px;
        }

        .v-item-panel img, .v-image-placeholder {
          width: 110px;
          height: 110px;
          object-fit: cover;
          border-radius: 12px;
          flex-shrink: 0;
        }

        .v-image-placeholder {
          display: grid;
          place-items: center;
          background: #eee6d8;
          color: #93897a;
        }

        .v-item-panel h2 {
          margin: 0 0 6px;
          font-family: "Fraunces", serif;
          font-size: 20px;
        }

        .v-item-panel > div > p { color: #71685b; font-size: 13px; margin: 0 0 10px; }

        .v-secret-block {
          background: #f2ead8;
          border-radius: 10px;
          padding: 12px 14px;
        }

        .v-secret-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          margin-bottom: 4px;
          flex-wrap: wrap;
        }

        .v-secret-row:last-child { margin-bottom: 0; }

        .v-secret-row strong { color: #4f483e; }

        .v-hidden { letter-spacing: 2px; color: #93897a; }

        .v-eye-toggle {
          margin-left: auto;
          border: none;
          background: none;
          cursor: pointer;
          color: #8b4d32;
          display: flex;
          align-items: center;
        }

        .v-muted { font-size: 13px; color: #71685b; }

        .v-claims h2 {
          font-family: "Fraunces", serif;
          font-size: 22px;
          margin-bottom: 16px;
        }

        .v-claims-list { display: grid; gap: 14px; }

        .v-claim-card {
          background: #fffdf8;
          border: 1px solid rgba(91, 76, 58, 0.15);
          border-radius: 14px;
          padding: 18px 20px;
        }

        .v-claim-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 10px;
        }

        .v-claim-top strong { display: block; font-size: 15px; }

        .v-claim-date {
          display: block;
          font-size: 11px;
          color: #93897a;
          margin-top: 3px;
        }

        .v-status {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 10px;
          border-radius: 50px;
          font-size: 11px;
          white-space: nowrap;
        }

        .v-status.pending { background: #f2ead8; color: #806c42; }
        .v-status.verified { background: rgba(78,91,61,0.11); color: #4e5b3d; }
        .v-status.rejected { background: rgba(139,77,50,0.10); color: #8b4d32; }

        .v-claim-answer {
          background: #f7f1e7;
          border-radius: 8px;
          padding: 12px 14px;
          font-size: 14px;
          color: #4f483e;
          line-height: 1.6;
          margin-bottom: 12px;
        }

        .v-claim-answer-label {
          display: block;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #93897a;
          margin-bottom: 4px;
        }

        .v-claim-actions { display: flex; gap: 10px; flex-wrap: wrap; }

        .v-verify-btn, .v-reject-btn {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 10px 14px;
          border-radius: 9px;
          cursor: pointer;
          font: inherit;
          font-size: 13px;
          border: 1px solid transparent;
        }

        .v-verify-btn { background: #4e5b3d; color: white; }
        .v-reject-btn { background: transparent; color: #8b4d32; border-color: rgba(139,77,50,0.25); }

        .v-verify-btn:disabled, .v-reject-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .v-loading {
          min-height: 70vh;
          display: grid;
          place-items: center;
          gap: 15px;
          color: #71685b;
        }

        .v-spinner {
          width: 30px;
          height: 30px;
          border: 2px solid rgba(139,77,50,0.2);
          border-top-color: #8b4d32;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

export default VerifyOwnership;

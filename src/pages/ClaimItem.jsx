import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import {
  ArrowLeft,
  ShieldCheck,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  ImageIcon,
} from "lucide-react";

import { supabase } from "../services/supabase";

function ClaimItem() {
  const { foundItemId } = useParams();
  const [searchParams] = useSearchParams();
  const lostItemId = searchParams.get("lost") || null;

  const [currentUser, setCurrentUser] = useState(null);
  const [foundItem, setFoundItem] = useState(null);
  const [myClaims, setMyClaims] = useState([]);

  const [answers, setAnswers] = useState([]);
  const [name, setName] = useState("");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

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
        setError("You must be logged in to claim an item.");
        setLoading(false);
        return;
      }

      const user = session.user;
      setCurrentUser(user);
      setName(user.user_metadata?.full_name || "");

      /*
       * IMPORTANT: we deliberately do NOT select
       * verification_answers here. Only the questions should
       * ever reach the claimant's browser — the answers stay
       * private to the founder. (Also enforce this server-side
       * via the found_items RLS policy — see migration notes.)
       */
      const { data: item, error: itemError } = await supabase
        .from("found_items")
        .select(
          "id, item_name, description, location, found_date, found_time, image_url, user_id, claim_status, verification_questions"
        )
        .eq("id", foundItemId)
        .single();

      if (itemError) throw itemError;

      setFoundItem(item);
      setAnswers(
        new Array((item.verification_questions || []).length).fill("")
      );

      if (item.user_id === user.id) {
        setError("You can't claim an item you reported yourself.");
      }

      const { data: existingClaims, error: claimsError } =
        await supabase
          .from("claim_requests")
          .select("*")
          .eq("found_item_id", foundItemId)
          .eq("claimant_id", user.id)
          .order("created_at", { ascending: false });

      if (claimsError) throw claimsError;

      setMyClaims(existingClaims || []);
    } catch (err) {
      console.error("ClaimItem load error:", err);

      setError(
        err.code === "42P01" || err.message?.includes("does not exist")
          ? "Ownership verification isn't set up in the database yet."
          : err.message || "Unable to load this item."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    setError("");
    setSuccess("");

    if (!currentUser || !foundItem) return;

    if (foundItem.user_id === currentUser.id) {
      setError("You can't claim an item you reported yourself.");
      return;
    }

    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }

    const questions = foundItem.verification_questions || [];

    if (questions.length > 0) {
      const incomplete = answers.some((a) => !a.trim());

      if (incomplete || answers.length !== questions.length) {
        setError("Please answer every verification question.");
        return;
      }
    }

    const alreadyPending = myClaims.some(
      (claim) => claim.status === "pending"
    );

    if (alreadyPending) {
      setError("You already have a pending claim on this item.");
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        found_item_id: foundItem.id,
        lost_item_id: lostItemId,
        claimant_id: currentUser.id,
        claimant_name: name.trim(),
        claimant_answers: answers.map((a) => a.trim()),
        status: "pending",
      };

      const { data, error: insertError } = await supabase
        .from("claim_requests")
        .insert([payload])
        .select()
        .single();

      if (insertError) throw insertError;

      setMyClaims((previous) => [data, ...previous]);
      setAnswers(new Array(questions.length).fill(""));

      setSuccess(
        "Your claim has been submitted. The person who found this item will review your answer."
      );
    } catch (err) {
      console.error("Claim submission error:", err);
      setError(err.message || "Failed to submit your claim.");
    } finally {
      setSubmitting(false);
    }
  }

  function statusPill(status) {
    if (status === "verified") {
      return (
        <span className="claim-status verified">
          <CheckCircle size={13} /> Verified
        </span>
      );
    }

    if (status === "rejected") {
      return (
        <span className="claim-status rejected">
          <XCircle size={13} /> Rejected
        </span>
      );
    }

    return (
      <span className="claim-status pending">
        <Clock size={13} /> Pending review
      </span>
    );
  }

  if (loading) {
    return (
      <div className="page-shell">
        <div className="loading-state">
          <div className="loading-spinner" />
          <p>Loading item details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell claim-page">
      <div className="claim-container">
        <Link to="/matches" className="back-link">
          <ArrowLeft size={18} />
          Back
        </Link>

        <div className="claim-header">
          <div className="eyebrow">
            <ShieldCheck size={16} />
            OWNERSHIP VERIFICATION
          </div>

          <h1>Claim This Item</h1>

          <p>
            Answer the finder's verification question to prove this
            item belongs to you.
          </p>
        </div>

        {error && (
          <div className="alert error-alert">
            <XCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="alert success-alert">
            <CheckCircle size={20} />
            <span>{success}</span>
          </div>
        )}

        {foundItem && (
          <div className="item-panel">
            {foundItem.image_url ? (
              <img
                src={foundItem.image_url}
                alt={foundItem.item_name}
                className="item-image"
              />
            ) : (
              <div className="item-image-placeholder">
                <ImageIcon size={30} />
              </div>
            )}

            <h2>{foundItem.item_name}</h2>
            <p>{foundItem.description || "No description provided."}</p>

            <div className="item-meta">
              <span>{foundItem.location || "Unknown location"}</span>
              <span>{foundItem.found_date || "Unknown date"}</span>
            </div>
          </div>
        )}

        {foundItem &&
          currentUser &&
          foundItem.user_id !== currentUser.id && (
            <form className="claim-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Your Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  maxLength={100}
                />
              </div>

              {(foundItem.verification_questions || []).length > 0 ? (
                (foundItem.verification_questions || []).map(
                  (question, index) => (
                    <div className="form-group" key={index}>
                      <label>Question {index + 1}</label>

                      <div className="question-box">{question}</div>

                      <textarea
                        value={answers[index] || ""}
                        onChange={(e) => {
                          const next = [...answers];
                          next[index] = e.target.value;
                          setAnswers(next);
                        }}
                        placeholder="Type your answer..."
                        rows={3}
                        maxLength={500}
                      />
                    </div>
                  )
                )
              ) : (
                <div className="form-group">
                  <label>No verification questions were set</label>
                  <p className="claim-muted">
                    The finder didn't set any secret questions for
                    this item. Your claim will still be sent for
                    manual review, but consider adding extra proof
                    (e.g. in the description) to help verify
                    ownership.
                  </p>
                </div>
              )}

              <button
                type="submit"
                className="primary-button send-button"
                disabled={submitting}
              >
                {submitting ? "Submitting..." : (
                  <>
                    <Send size={18} />
                    Submit Claim
                  </>
                )}
              </button>
            </form>
          )}

        {myClaims.length > 0 && (
          <section className="claims-section">
            <h2>Your Claims on This Item</h2>

            <div className="claims-list">
              {myClaims.map((claim) => (
                <div className="claim-card" key={claim.id}>
                  <div className="claim-card-top">
                    <strong>Your submitted answers:</strong>
                    {statusPill(claim.status)}
                  </div>

                  {(claim.claimant_answers || []).map((a, i) => (
                    <p key={i} style={{ margin: "4px 0" }}>
                      {i + 1}. {a}
                    </p>
                  ))}

                  <span className="claim-date">
                    {new Date(claim.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <style>{`
        .page-shell {
          min-height: 100vh;
          padding: 40px 20px 80px;
          background:
            radial-gradient(circle at 10% 10%, rgba(157, 111, 63, 0.10), transparent 30%),
            radial-gradient(circle at 90% 80%, rgba(78, 91, 61, 0.10), transparent 30%),
            #f4efe5;
          color: #2b2924;
        }

        .claim-container {
          width: min(680px, 100%);
          margin: 0 auto;
        }

        .back-link {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: #51483c;
          text-decoration: none;
          font-family: "IBM Plex Mono", monospace;
          font-size: 13px;
          margin-bottom: 30px;
        }

        .claim-header { margin-bottom: 30px; }

        .eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: #8b4d32;
          font-family: "IBM Plex Mono", monospace;
          font-size: 12px;
          letter-spacing: 1.5px;
          margin-bottom: 12px;
        }

        .claim-header h1 {
          margin: 0;
          font-family: "Fraunces", serif;
          font-size: clamp(32px, 5vw, 48px);
          font-weight: 600;
        }

        .claim-header p {
          margin-top: 14px;
          color: #71685b;
          font-size: 15px;
          line-height: 1.6;
        }

        .alert {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 15px 18px;
          border-radius: 12px;
          margin-bottom: 22px;
          font-size: 14px;
        }

        .error-alert {
          background: rgba(139, 77, 50, 0.10);
          border: 1px solid rgba(139, 77, 50, 0.25);
          color: #7a3f29;
        }

        .success-alert {
          background: rgba(78, 91, 61, 0.11);
          border: 1px solid rgba(78, 91, 61, 0.25);
          color: #4e5b3d;
        }

        .item-panel {
          background: rgba(255, 252, 245, 0.85);
          border: 1px solid rgba(91, 76, 58, 0.15);
          border-radius: 16px;
          padding: 22px;
          margin-bottom: 24px;
        }

        .item-image, .item-image-placeholder {
          width: 100%;
          height: 180px;
          object-fit: cover;
          border-radius: 12px;
          margin-bottom: 16px;
        }

        .item-image-placeholder {
          display: grid;
          place-items: center;
          background: #eee6d8;
          color: #93897a;
        }

        .item-panel h2 {
          margin: 0 0 8px;
          font-family: "Fraunces", serif;
          font-size: 22px;
        }

        .item-panel p { color: #71685b; font-size: 14px; line-height: 1.6; }

        .item-meta {
          display: flex;
          gap: 8px;
          margin-top: 14px;
          flex-wrap: wrap;
        }

        .item-meta span {
          padding: 6px 10px;
          border-radius: 8px;
          background: #eee6d8;
          color: #655c50;
          font-family: "IBM Plex Mono", monospace;
          font-size: 10px;
        }

        .claim-form {
          background: #fffdf8;
          border: 1px solid rgba(91, 76, 58, 0.16);
          border-radius: 16px;
          padding: 26px;
          margin-bottom: 24px;
        }

        .form-group { margin-bottom: 18px; }

        .form-group label {
          display: block;
          margin-bottom: 8px;
          font-family: "IBM Plex Mono", monospace;
          font-size: 12px;
          color: #4f483e;
        }

        .form-group input, .form-group textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid rgba(91, 76, 58, 0.2);
          background: #f8f3e9;
          color: #29261f;
          border-radius: 10px;
          padding: 12px 14px;
          outline: none;
          font: inherit;
        }

        .question-box {
          background: #f2ead8;
          border-left: 3px solid #8b4d32;
          padding: 12px 14px;
          border-radius: 8px;
          font-size: 14px;
          margin-bottom: 12px;
          color: #4f483e;
        }

        .claim-muted { font-size: 13px; color: #71685b; line-height: 1.6; }

        .primary-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          border: 0;
          border-radius: 10px;
          padding: 13px 19px;
          background: #8b4d32;
          color: white;
          cursor: pointer;
          font: inherit;
          width: 100%;
        }

        .primary-button:disabled { opacity: 0.6; cursor: not-allowed; }

        .claims-section h2 {
          font-family: "Fraunces", serif;
          font-size: 22px;
          margin-bottom: 14px;
        }

        .claims-list { display: grid; gap: 12px; }

        .claim-card {
          background: #fffdf8;
          border: 1px solid rgba(91, 76, 58, 0.15);
          border-radius: 12px;
          padding: 16px 18px;
        }

        .claim-card-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
          font-size: 13px;
        }

        .claim-status {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 10px;
          border-radius: 50px;
          font-size: 11px;
        }

        .claim-status.pending { background: #f2ead8; color: #806c42; }
        .claim-status.verified { background: rgba(78,91,61,0.11); color: #4e5b3d; }
        .claim-status.rejected { background: rgba(139,77,50,0.10); color: #8b4d32; }

        .claim-date {
          font-size: 11px;
          color: #93897a;
        }

        .loading-state {
          min-height: 70vh;
          display: grid;
          place-items: center;
          gap: 15px;
          color: #71685b;
        }

        .loading-spinner {
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

export default ClaimItem;

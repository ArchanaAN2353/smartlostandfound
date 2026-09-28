import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import {
  ArrowLeft,
  AlertTriangle,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  Inbox,
} from "lucide-react";

import { supabase } from "../services/supabase";

// ==========================================================
// CATEGORY OPTIONS
// ==========================================================

const CATEGORIES = [
  { value: "false_claim", label: "False / fraudulent ownership claim" },
  { value: "harassment", label: "Harassment or inappropriate message" },
  { value: "item_not_returned", label: "Item not returned after verification" },
  { value: "fake_listing", label: "Fake or misleading lost/found listing" },
  { value: "bug_or_technical", label: "Bug or technical issue" },
  { value: "other", label: "Something else" },
];

// ==========================================================
// STATUS BADGE
// ==========================================================

function StatusBadge({ status }) {
  const config = {
    open: { icon: <Clock size={13} />, label: "Open", className: "status-open" },
    in_review: { icon: <Eye size={13} />, label: "In Review", className: "status-review" },
    resolved: { icon: <CheckCircle2 size={13} />, label: "Resolved", className: "status-resolved" },
    dismissed: { icon: <XCircle size={13} />, label: "Dismissed", className: "status-dismissed" },
  };

  const current = config[status] || config.open;

  return (
    <span className={`complaint-status ${current.className}`}>
      {current.icon}
      {current.label}
    </span>
  );
}

// ==========================================================
// MAIN COMPONENT
// ==========================================================

function ComplaintBox() {
  const [user, setUser] = useState(null);

  const [form, setForm] = useState({
    category: "",
    subject: "",
    description: "",
    relatedItemType: "none",
    relatedItemReference: "",
  });

  const [complaints, setComplaints] = useState([]);

  const [loadingHistory, setLoadingHistory] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // ========================================================
  // LOAD USER + COMPLAINT HISTORY
  // ========================================================

  useEffect(() => {
    initialize();
  }, []);

  async function initialize() {
    setLoadingHistory(true);

    try {
      const {
        data: { user: currentUser },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      setUser(currentUser || null);

      if (currentUser) {
        await loadHistory(currentUser.id);
      }
    } catch (err) {
      console.error("ComplaintBox init error:", err);
    } finally {
      setLoadingHistory(false);
    }
  }

  async function loadHistory(userId) {
    try {
      const { data, error: historyError } = await supabase
        .from("complaints")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (historyError) throw historyError;

      setComplaints(data || []);
    } catch (err) {
      // If the `complaints` table doesn't exist yet (migration not
      // applied), fail quietly instead of breaking the page — this
      // keeps the rest of the app working while the DB change is
      // still pending review.
      console.error("Complaint history load error:", err);
      setComplaints([]);
    }
  }

  // ========================================================
  // HANDLE FORM CHANGES
  // ========================================================

  function handleChange(e) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  // ========================================================
  // SUBMIT COMPLAINT
  // ========================================================

  async function handleSubmit(e) {
    e.preventDefault();

    setError("");
    setSuccess("");

    if (!user) {
      setError("You must be logged in to file a complaint.");
      return;
    }

    if (!form.category) {
      setError("Please select a category.");
      return;
    }

    if (!form.subject.trim()) {
      setError("Please enter a short subject.");
      return;
    }

    if (!form.description.trim()) {
      setError("Please describe what happened.");
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        user_id: user.id,
        reporter_name: user.user_metadata?.full_name || "",
        reporter_email: user.email || "",
        category: form.category,
        subject: form.subject.trim(),
        description: form.description.trim(),
        related_item_type: form.relatedItemType,
        related_item_reference:
          form.relatedItemType === "none"
            ? null
            : form.relatedItemReference.trim() || null,
        status: "open",
      };

      const { data, error: insertError } = await supabase
        .from("complaints")
        .insert([payload])
        .select()
        .single();

      if (insertError) throw insertError;

      setComplaints((previous) => [data, ...previous]);

      setForm({
        category: "",
        subject: "",
        description: "",
        relatedItemType: "none",
        relatedItemReference: "",
      });

      setSuccess(
        "Your complaint has been filed. Our team will review it shortly."
      );
    } catch (err) {
      console.error("Complaint submission error:", err);

      setError(
        err.message?.includes("does not exist") ||
          err.code === "42P01"
          ? "Complaint storage isn't set up yet. Please try again once the database update is live."
          : err.message || "Something went wrong. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function formatDate(date) {
    if (!date) return "";

    return new Date(date).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function categoryLabel(value) {
    return CATEGORIES.find((c) => c.value === value)?.label || value;
  }

  // ========================================================
  // UI
  // ========================================================

  return (
    <div className="form-page">
      <div className="form-container">
        <Link to="/home" className="back-link">
          <ArrowLeft size={18} />
          Back to Home
        </Link>

        <div className="form-header">
          <div className="form-icon">
            <AlertTriangle size={26} />
          </div>

          <p className="eyebrow">COMPLAINT BOX</p>

          <h1>Something not right?</h1>

          <p>
            Report a false claim, misuse, harassment, or a bug. Only
            you and the review team can see what you submit here.
          </p>
        </div>

        {error && <div className="complaint-alert error-alert">{error}</div>}
        {success && (
          <div className="complaint-alert success-alert">{success}</div>
        )}

        <form onSubmit={handleSubmit}>
          {/* CATEGORY */}
          <div className="form-group">
            <label>Category</label>

            <select
              name="category"
              value={form.category}
              onChange={handleChange}
              required
            >
              <option value="" disabled>
                Select a category
              </option>

              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* SUBJECT */}
          <div className="form-group">
            <label>Subject</label>

            <input
              type="text"
              name="subject"
              placeholder="e.g. Fake claim on my lost wallet report"
              value={form.subject}
              onChange={handleChange}
              maxLength={150}
              required
            />
          </div>

          {/* DESCRIPTION */}
          <div className="form-group">
            <label>What happened?</label>

            <textarea
              name="description"
              placeholder="Give as much detail as you can — dates, who was involved, what was said or claimed..."
              value={form.description}
              onChange={handleChange}
              rows={6}
              maxLength={2000}
              required
            />
          </div>

          {/* RELATED ITEM */}
          <div className="form-row">
            <div className="form-group">
              <label>Is this about a specific report?</label>

              <select
                name="relatedItemType"
                value={form.relatedItemType}
                onChange={handleChange}
              >
                <option value="none">Not related to a specific item</option>
                <option value="lost">A lost item report</option>
                <option value="found">A found item report</option>
              </select>
            </div>

            {form.relatedItemType !== "none" && (
              <div className="form-group">
                <label>Item name or reference (optional)</label>

                <input
                  type="text"
                  name="relatedItemReference"
                  placeholder="e.g. Black AirPods reported on 12 Sep"
                  value={form.relatedItemReference}
                  onChange={handleChange}
                  maxLength={200}
                />
              </div>
            )}
          </div>

          <button type="submit" className="submit-button" disabled={submitting}>
            {submitting ? (
              "Submitting..."
            ) : (
              <>
                <Send size={16} style={{ marginRight: 8 }} />
                Submit Complaint
              </>
            )}
          </button>
        </form>

        {/* HISTORY */}
        <section className="complaint-history">
          <div className="complaint-history-heading">
            <Inbox size={18} />
            <h2>Your Complaints</h2>
          </div>

          {loadingHistory ? (
            <p className="complaint-muted">Loading your complaint history...</p>
          ) : complaints.length === 0 ? (
            <p className="complaint-muted">
              You haven't filed any complaints yet.
            </p>
          ) : (
            <div className="complaint-list">
              {complaints.map((complaint) => (
                <div className="complaint-card" key={complaint.id}>
                  <div className="complaint-card-top">
                    <div>
                      <strong>{complaint.subject}</strong>
                      <span className="complaint-category">
                        {categoryLabel(complaint.category)}
                      </span>
                    </div>

                    <StatusBadge status={complaint.status} />
                  </div>

                  <p className="complaint-description">
                    {complaint.description}
                  </p>

                  {complaint.related_item_reference && (
                    <div className="complaint-reference">
                      Related to: {complaint.related_item_reference}
                    </div>
                  )}

                  <div className="complaint-date">
                    Filed {formatDate(complaint.created_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <style>{`
        .complaint-alert {
          padding: 12px 14px;
          border-radius: 10px;
          font-size: 13px;
          margin-bottom: 18px;
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

        .complaint-history {
          margin-top: 40px;
          padding-top: 28px;
          border-top: 1px dashed var(--line-strong, rgba(91,76,58,0.25));
        }

        .complaint-history-heading {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 18px;
        }

        .complaint-history-heading h2 {
          margin: 0;
          font-size: 20px;
        }

        .complaint-muted {
          color: var(--ink-soft, #71685b);
          font-size: 13px;
        }

        .complaint-list {
          display: grid;
          gap: 14px;
        }

        .complaint-card {
          border: 1px solid var(--line-strong, rgba(91,76,58,0.2));
          border-radius: 12px;
          padding: 16px 18px;
        }

        .complaint-card-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 10px;
          margin-bottom: 8px;
        }

        .complaint-card-top strong {
          display: block;
          font-size: 15px;
        }

        .complaint-category {
          display: block;
          font-size: 11px;
          color: var(--ink-soft, #93897a);
          margin-top: 3px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .complaint-description {
          font-size: 13px;
          color: var(--ink-soft, #554d42);
          line-height: 1.6;
          margin: 8px 0;
        }

        .complaint-reference {
          font-size: 12px;
          color: #8b4d32;
          margin-bottom: 6px;
        }

        .complaint-date {
          font-size: 11px;
          color: var(--ink-faint, #93897a);
        }

        .complaint-status {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 10px;
          border-radius: 50px;
          font-size: 11px;
          white-space: nowrap;
        }

        .status-open {
          background: #f2ead8;
          color: #806c42;
        }

        .status-review {
          background: rgba(91, 76, 58, 0.12);
          color: #5b4c3a;
        }

        .status-resolved {
          background: rgba(78, 91, 61, 0.12);
          color: #4e5b3d;
        }

        .status-dismissed {
          background: rgba(139, 77, 50, 0.10);
          color: #8b4d32;
        }
      `}</style>
    </div>
  );
}

export default ComplaintBox;

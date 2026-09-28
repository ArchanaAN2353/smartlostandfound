import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import {
  ArrowLeft,
  Bell,
  Brain,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Image as ImageIcon,
  MapPin,
  MessageCircle,
  Sparkles,
  Zap,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import { supabase } from "../services/supabase";

// =========================================================
// TEXT SIMILARITY
// =========================================================

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function textSimilarity(a, b) {
  const first = normalizeText(a);
  const second = normalizeText(b);

  if (!first || !second) return 0;

  if (first === second) return 1;

  const firstWords = new Set(first.split(" "));
  const secondWords = new Set(second.split(" "));

  let common = 0;

  firstWords.forEach((word) => {
    if (secondWords.has(word)) {
      common++;
    }
  });

  const total = new Set([
    ...firstWords,
    ...secondWords,
  ]).size;

  if (total === 0) return 0;

  return common / total;
}

// =========================================================
// LOCATION SIMILARITY
// =========================================================

function locationSimilarity(a, b) {
  const first = normalizeText(a);
  const second = normalizeText(b);

  if (!first || !second) return 0;

  if (first === second) return 1;

  if (
    first.includes(second) ||
    second.includes(first)
  ) {
    return 0.9;
  }

  return textSimilarity(first, second);
}

// =========================================================
// DATE SIMILARITY
// =========================================================

function dateSimilarity(lostDate, foundDate) {
  if (!lostDate || !foundDate) return 0;

  const lost = new Date(lostDate);
  const found = new Date(foundDate);

  if (
    Number.isNaN(lost.getTime()) ||
    Number.isNaN(found.getTime())
  ) {
    return 0;
  }

  const difference =
    Math.abs(lost.getTime() - found.getTime()) /
    (1000 * 60 * 60 * 24);

  if (difference === 0) return 1;
  if (difference <= 1) return 0.8;
  if (difference <= 3) return 0.5;
  if (difference <= 7) return 0.25;

  return 0;
}

// =========================================================
// TIME SIMILARITY
// =========================================================

function timeSimilarity(lostTime, foundTime) {
  if (!lostTime || !foundTime) return 0;

  const [lostHour, lostMinute] = String(lostTime)
    .split(":")
    .map(Number);

  const [foundHour, foundMinute] = String(foundTime)
    .split(":")
    .map(Number);

  if (
    Number.isNaN(lostHour) ||
    Number.isNaN(lostMinute) ||
    Number.isNaN(foundHour) ||
    Number.isNaN(foundMinute)
  ) {
    return 0;
  }

  const lostMinutes =
    lostHour * 60 + lostMinute;

  const foundMinutes =
    foundHour * 60 + foundMinute;

  const difference = Math.abs(
    lostMinutes - foundMinutes
  );

  if (difference <= 15) return 1;
  if (difference <= 30) return 0.8;
  if (difference <= 60) return 0.55;
  if (difference <= 180) return 0.25;

  return 0;
}

// =========================================================
// VISUAL AI MATCH
// =========================================================

function analyzeVisualMatch(lostItem, foundItem) {
  if (
    !lostItem.image_fingerprint ||
    !foundItem.image_fingerprint
  ) {
    return null;
  }

  try {
    const lostFingerprint =
      lostItem.image_fingerprint;

    const foundFingerprint =
      foundItem.image_fingerprint;

    if (
      !Array.isArray(lostFingerprint) ||
      !Array.isArray(foundFingerprint)
    ) {
      return null;
    }

    if (
      lostFingerprint.length === 0 ||
      foundFingerprint.length === 0
    ) {
      return null;
    }

    if (
      lostFingerprint.length !==
      foundFingerprint.length
    ) {
      return null;
    }

    let dotProduct = 0;
    let lostMagnitude = 0;
    let foundMagnitude = 0;

    for (
      let i = 0;
      i < lostFingerprint.length;
      i++
    ) {
      const a = Number(lostFingerprint[i]);
      const b = Number(foundFingerprint[i]);

      dotProduct += a * b;
      lostMagnitude += a * a;
      foundMagnitude += b * b;
    }

    if (
      lostMagnitude === 0 ||
      foundMagnitude === 0
    ) {
      return null;
    }

    const similarity =
      dotProduct /
      (
        Math.sqrt(lostMagnitude) *
        Math.sqrt(foundMagnitude)
      );

    return Math.max(
      0,
      Math.min(100, similarity * 100)
    );
  } catch (error) {
    console.error(
      "Visual similarity failed:",
      error
    );

    return null;
  }
}

// =========================================================
// FULL MATCH ANALYSIS
// =========================================================

async function analyzeMatch(lostItem, foundItem) {
  const visualScore =
    analyzeVisualMatch(
      lostItem,
      foundItem
    );

  const descriptionScore =
    textSimilarity(
      `${lostItem.item_name} ${
        lostItem.description || ""
      } ${
        lostItem.characteristics || ""
      }`,
      `${foundItem.item_name} ${
        foundItem.description || ""
      } ${
        foundItem.characteristics || ""
      }`
    );

  const locationScore =
    locationSimilarity(
      lostItem.location,
      foundItem.location
    );

  const dateScore =
    dateSimilarity(
      lostItem.lost_date,
      foundItem.found_date
    );

  const timeScore =
    timeSimilarity(
      lostItem.lost_time,
      foundItem.found_time
    );

  let finalScore;

  if (visualScore !== null) {
    finalScore =
      visualScore * 0.3 +
      descriptionScore * 100 * 0.4 +
      locationScore * 100 * 0.15 +
      dateScore * 100 * 0.1 +
      timeScore * 100 * 0.05;
  } else {
    finalScore =
      descriptionScore * 100 * 0.55 +
      locationScore * 100 * 0.2 +
      dateScore * 100 * 0.15 +
      timeScore * 100 * 0.1;
  }

  const score = Math.round(
    Math.max(
      0,
      Math.min(100, finalScore)
    )
  );

  const reasons = [];

  if (visualScore !== null) {
    reasons.push(
      `AI image similarity: ${Math.round(
        visualScore
      )}%`
    );
  }

  if (descriptionScore >= 0.4) {
    reasons.push(
      "Item descriptions share important characteristics."
    );
  }

  if (locationScore >= 0.5) {
    reasons.push(
      "The reported locations are closely related."
    );
  }

  if (dateScore >= 0.8) {
    reasons.push(
      "The lost and found dates are very close."
    );
  }

  if (timeScore >= 0.8) {
    reasons.push(
      "The reported times are closely aligned."
    );
  }

  if (reasons.length === 0) {
    reasons.push(
      "The AI found limited similarities between these reports."
    );
  }

  return {
    score,
    visualScore,
    descriptionScore,
    locationScore,
    dateScore,
    timeScore,
    reason: reasons.join(" "),
  };
}

// =========================================================
// SCORE LABEL
// =========================================================

function getScoreLabel(score) {
  if (score >= 90) return "Excellent Match";
  if (score >= 80) return "Strong Match";
  if (score >= 75) return "Possible Match";
  if (score >= 60) return "Weak Match";

  return "Low Similarity";
}

// =========================================================
// SCORE COLOR
// =========================================================

function getScoreClass(score) {
  if (score >= 90) {
    return "matches-score-excellent";
  }

  if (score >= 75) {
    return "matches-score-strong";
  }

  if (score >= 60) {
    return "matches-score-medium";
  }

  return "matches-score-low";
}

// =========================================================
// SCORE BOX
// =========================================================

function ScoreBox({
  label,
  value,
  icon,
}) {
  return (
    <div className="matches-score-box">
      <div className="matches-score-box-icon">
        {icon}
      </div>

      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

// =========================================================
// MATCH CARD
// =========================================================

function MatchCard({ match }) {
  const score = match.score;

  return (
    <article className="matches-card">

      <div className="matches-card-top">

        <div>
          <div className="matches-match-label">
            <Sparkles size={13} />
            AI DISCOVERY
          </div>

          <h2>
            {getScoreLabel(score)}
          </h2>

          <p>
            SmartMatch found similarities between
            these two reports.
          </p>
        </div>

        <div
          className={`matches-big-score ${getScoreClass(
            score
          )}`}
        >
          <strong>{score}%</strong>
          <span>match</span>
        </div>

      </div>

      {/* ITEMS */}

      <div className="matches-items">

        {/* LOST */}

        <div className="matches-item-card">

          <div className="matches-item-image">
            {match.lost.image_url ? (
              <img
                src={match.lost.image_url}
                alt={match.lost.item_name}
              />
            ) : (
              <ImageIcon size={30} />
            )}
          </div>

          <div className="matches-item-content">

            <span className="matches-item-type lost">
              LOST REPORT
            </span>

            <h3>
              {match.lost.item_name}
            </h3>

            <p>
              {match.lost.description}
            </p>

            <div className="matches-item-meta">

              <span>
                <MapPin size={13} />
                {match.lost.location}
              </span>

              <span>
                <Calendar size={13} />
                {match.lost.lost_date}
              </span>

              <span>
                <Clock size={13} />
                {match.lost.lost_time}
              </span>

            </div>

          </div>

        </div>

        {/* AI */}

        <div className="matches-connection">

          <div className="matches-connection-line" />

          <div className="matches-ai-node">
            <Brain size={18} />
          </div>

          <span>AI</span>

          <div className="matches-connection-line" />

        </div>

        {/* FOUND */}

        <div className="matches-item-card">

          <div className="matches-item-image">
            {match.found.image_url ? (
              <img
                src={match.found.image_url}
                alt={match.found.item_name}
              />
            ) : (
              <ImageIcon size={30} />
            )}
          </div>

          <div className="matches-item-content">

            <span className="matches-item-type found">
              FOUND REPORT
            </span>

            <h3>
              {match.found.item_name}
            </h3>

            <p>
              {match.found.description}
            </p>

            <div className="matches-item-meta">

              <span>
                <MapPin size={13} />
                {match.found.location}
              </span>

              <span>
                <Calendar size={13} />
                {match.found.found_date}
              </span>

              <span>
                <Clock size={13} />
                {match.found.found_time}
              </span>

            </div>

          </div>

        </div>

      </div>

      {/* ANALYSIS */}

      <div className="matches-analysis">

        <div className="matches-analysis-heading">

          <div>
            <span>AI ANALYSIS</span>

            <h3>
              Why this may be the same item
            </h3>
          </div>

          <Zap size={20} />

        </div>

        <p>{match.reason}</p>

        <div className="matches-score-grid">

          {match.visualScore !== null && (
            <ScoreBox
              label="Visual"
              value={`${Math.round(
                match.visualScore
              )}%`}
              icon={
                <ImageIcon size={15} />
              }
            />
          )}

          <ScoreBox
            label="Description"
            value={`${Math.round(
              match.descriptionScore * 100
            )}%`}
            icon={
              <Brain size={15} />
            }
          />

          <ScoreBox
            label="Location"
            value={`${Math.round(
              match.locationScore * 100
            )}%`}
            icon={
              <MapPin size={15} />
            }
          />

          <ScoreBox
            label="Date"
            value={`${Math.round(
              match.dateScore * 100
            )}%`}
            icon={
              <Calendar size={15} />
            }
          />

          <ScoreBox
            label="Time"
            value={`${Math.round(
              match.timeScore * 100
            )}%`}
            icon={
              <Clock size={15} />
            }
          />

        </div>

      </div>

      {/* PRIVATE CONTACT */}

      <div className="matches-contact-area">

        <div className="matches-contact-info">

          <div className="matches-contact-icon">
            <ShieldCheck size={20} />
          </div>

          <div>

            <strong>
              Private match connection
            </strong>

            <p>
              Only the owners of these two reports
              can access this match and contact
              each other.
            </p>

          </div>

        </div>

        <Link
          to={`/contact-agent?lost=${match.lost.id}&found=${match.found.id}`}
          className="matches-contact-button"
        >
          <MessageCircle size={17} />
          Contact Person
        </Link>

        {match.viewerRole === "lost-owner" && (
          <Link
            to={`/claim/${match.found.id}?lost=${match.lost.id}`}
            className="matches-contact-button"
            style={{ marginLeft: "10px" }}
          >
            <ShieldCheck size={17} />
            Claim This Item
          </Link>
        )}

      </div>

    </article>
  );
}

// =========================================================
// MAIN COMPONENT
// =========================================================

function Matches() {

  const [matches, setMatches] = useState([]);
  const [alerts, setAlerts] = useState([]);

  const [loading, setLoading] =
    useState(true);

  const [analyzing, setAnalyzing] =
    useState(false);

  const [error, setError] =
    useState("");

  // =======================================================
  // LOAD PRIVATE ALERTS
  // =======================================================

  async function loadAlerts(userId) {

    if (!userId) {
      setAlerts([]);
      return;
    }

    try {

      const {
        data,
        error,
      } = await supabase
        .from("match_alerts")
        .select(`
          *,
          lost_items (
            id,
            item_name,
            image_url,
            location,
            user_id
          ),
          found_items (
            id,
            item_name,
            image_url,
            location,
            user_id
          )
        `)
        .order("created_at", {
          ascending: false,
        });

      if (error) {
        throw error;
      }

      /*
       * IMPORTANT PRIVACY RULE
       *
       * A user can see an alert ONLY when:
       *
       * 1. They own the lost report
       * OR
       * 2. They own the found report
       *
       * User C owns neither -> filtered out.
       */

      const privateAlerts =
        (data || []).filter((alert) => {

          const lostOwner =
            alert.lost_items?.user_id;

          const foundOwner =
            alert.found_items?.user_id;

          if (!lostOwner || !foundOwner) {
            return false;
          }

          return (
            lostOwner === userId ||
            foundOwner === userId
          );
        });

      setAlerts(privateAlerts);

    } catch (error) {

      console.error(
        "Alert loading error:",
        error
      );

      setAlerts([]);
    }
  }

  // =======================================================
  // LOAD + GENERATE PRIVATE MATCHES
  // =======================================================

  async function generateMatches() {

    setAnalyzing(true);
    setError("");

    try {

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        setMatches([]);
        return;
      }

      // ===================================================
      // LOAD ALL REPORTS
      // ===================================================
      //
      // DO NOT filter by status here.
      //
      // The matching engine needs to compare all valid
      // lost reports against all valid found reports.
      //
      // Privacy filtering happens AFTER comparison.
      //

      const [
        lostResponse,
        foundResponse,
      ] = await Promise.all([

        supabase
          .from("lost_items")
          .select("*"),

        supabase
          .from("found_items")
          .select("*"),

      ]);

      if (lostResponse.error) {
        throw lostResponse.error;
      }

      if (foundResponse.error) {
        throw foundResponse.error;
      }

      const lostItems =
        lostResponse.data || [];

      const foundItems =
        foundResponse.data || [];

      if (
        lostItems.length === 0 ||
        foundItems.length === 0
      ) {

        setMatches([]);

        await loadAlerts(user.id);

        return;
      }

      const generatedMatches = [];

      // ===================================================
      // COMPARE ALL LOST × FOUND
      // ===================================================

      for (const lostItem of lostItems) {

        /*
         * SECURITY:
         *
         * A report without user_id has no verified owner.
         * Therefore we don't expose or match it.
         */

        if (!lostItem.user_id) {
          continue;
        }

        for (const foundItem of foundItems) {

          if (!foundItem.user_id) {
            continue;
          }

          // =================================================
          // DON'T MATCH USER WITH THEMSELVES
          // =================================================

          if (
            lostItem.user_id ===
            foundItem.user_id
          ) {
            continue;
          }

          // =================================================
          // OPTIONAL RESOLVED ITEM PROTECTION
          // =================================================
          //
          // If a found item has already been claimed/returned,
          // don't keep presenting it as a new match.
          //

          const foundResolved =
            String(
              foundItem.claim_status || ""
            ).toLowerCase();

          if (
            foundResolved === "returned" ||
            foundResolved === "claimed"
          ) {
            continue;
          }

          // =================================================
          // ANALYZE
          // =================================================

          const analysis =
            await analyzeMatch(
              lostItem,
              foundItem
            );

          // Ignore weak similarities
          if (analysis.score < 55) {
            continue;
          }

          // =================================================
          // CRITICAL PRIVACY CHECK
          // =================================================

          const ownsLost =
            lostItem.user_id === user.id;

          const ownsFound =
            foundItem.user_id === user.id;

          /*
           * USER C:
           *
           * ownsLost = false
           * ownsFound = false
           *
           * Therefore:
           * NOT added to matches.
           */

          if (!ownsLost && !ownsFound) {
            continue;
          }

          // =================================================
          // PRIVATE MATCH
          // =================================================

          generatedMatches.push({
            lost: lostItem,
            found: foundItem,
            ...analysis,

            /*
             * Store ownership information locally.
             * This makes the UI logic explicit.
             */

            viewerRole: ownsLost
              ? "lost-owner"
              : "found-owner",

            otherUserId: ownsLost
              ? foundItem.user_id
              : lostItem.user_id,
          });
        }
      }

      // ===================================================
      // REMOVE DUPLICATES
      // ===================================================

      const uniqueMatches =
        generatedMatches.filter(
          (match, index, array) => {

            return (
              index ===
              array.findIndex(
                (other) =>
                  other.lost.id ===
                    match.lost.id &&
                  other.found.id ===
                    match.found.id
              )
            );
          }
        );

      // ===================================================
      // SORT
      // ===================================================

      uniqueMatches.sort(
        (a, b) =>
          b.score - a.score
      );

      setMatches(uniqueMatches);

      // ===================================================
      // CREATE ALERTS
      // ===================================================

      const {
        data: existingAlerts,
        error: existingAlertError,
      } = await supabase
        .from("match_alerts")
        .select(
          "lost_item_id, found_item_id"
        );

      if (existingAlertError) {

        console.error(
          "Existing alert error:",
          existingAlertError
        );

      }

      const existing =
        existingAlerts || [];

      const newAlerts = [];

      /*
       * IMPORTANT:
       *
       * Alerts are created for the MATCH itself.
       *
       * The UI later determines whether the current
       * user owns either side.
       *
       * User C therefore never sees the alert.
       */

      for (const match of uniqueMatches) {

        if (match.score < 75) {
          continue;
        }

        const alreadyExists =
          existing.some(
            (alert) =>
              alert.lost_item_id ===
                match.lost.id &&
              alert.found_item_id ===
                match.found.id
          );

        if (alreadyExists) {
          continue;
        }

        newAlerts.push({
          lost_item_id:
            match.lost.id,

          found_item_id:
            match.found.id,

          match_score:
            match.score,

          alert_message:
            `SmartMatch found a ${match.score}% possible match between "${match.lost.item_name}" and "${match.found.item_name}".`,
        });
      }

      if (newAlerts.length > 0) {

        const {
          error: alertError,
        } = await supabase
          .from("match_alerts")
          .insert(newAlerts);

        if (alertError) {

          console.error(
            "Alert creation error:",
            alertError
          );

        }
      }

      // Reload private alerts
      await loadAlerts(user.id);

    } catch (err) {

      console.error(
        "Match generation error:",
        err
      );

      setError(
        "Unable to generate matches right now."
      );

    } finally {

      setAnalyzing(false);
    }
  }

  // =======================================================
  // INITIAL LOAD
  // =======================================================

  useEffect(() => {

    async function initialize() {

      setLoading(true);

      try {

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setMatches([]);
          setAlerts([]);
          return;
        }

        await loadAlerts(user.id);

        await generateMatches();

      } finally {

        setLoading(false);
      }
    }

    initialize();

  }, []);

  // =======================================================
  // MARK ALERT READ
  // =======================================================

  async function markAlertRead(id) {

    const {
      error,
    } = await supabase
      .from("match_alerts")
      .update({
        is_read: true,
      })
      .eq("id", id);

    if (error) {

      console.error(error);

      return;
    }

    setAlerts((previous) =>
      previous.map((alert) =>
        alert.id === id
          ? {
              ...alert,
              is_read: true,
            }
          : alert
      )
    );
  }

  // =======================================================
  // MARK ALL READ
  // =======================================================

  async function markAllRead() {

    const unreadIds =
      alerts
        .filter(
          (alert) =>
            !alert.is_read
        )
        .map(
          (alert) =>
            alert.id
        );

    if (
      unreadIds.length === 0
    ) {
      return;
    }

    const {
      error,
    } = await supabase
      .from("match_alerts")
      .update({
        is_read: true,
      })
      .in(
        "id",
        unreadIds
      );

    if (error) {

      console.error(error);

      return;
    }

    setAlerts((previous) =>
      previous.map(
        (alert) => ({
          ...alert,
          is_read: true,
        })
      )
    );
  }

  // =======================================================
  // LOADING
  // =======================================================

  if (loading) {

    return (
      <div className="matches-loading">

        <div className="matches-loading-icon">
          <Brain size={30} />
        </div>

        <h2>
          Starting SmartMatch
        </h2>

        <p>
          Preparing your AI-powered matching
          system...
        </p>

      </div>
    );
  }

  const unreadAlerts =
    alerts.filter(
      (alert) =>
        !alert.is_read
    ).length;

  const strongMatches =
    matches.filter(
      (match) =>
        match.score >= 75
    ).length;

  // =======================================================
  // UI
  // =======================================================

  return (

    <div className="matches-page">

      {/* HEADER */}

      <header className="matches-header">

        <Link
          to="/home"
          className="matches-back"
        >
          <ArrowLeft size={16} />
          Back Home
        </Link>

        <div className="matches-header-center">

          <div className="matches-logo">
            <Sparkles size={19} />
          </div>

          <div>

            <strong>
              SmartMatch
            </strong>

            <span>
              AI Recovery Engine
            </span>

          </div>

        </div>

        <button
          type="button"
          className="matches-refresh"
          onClick={generateMatches}
          disabled={analyzing}
        >

          <RefreshCw
            size={15}
            className={
              analyzing
                ? "matches-spin"
                : ""
            }
          />

          {analyzing
            ? "Analyzing..."
            : "Run AI Match"}

        </button>

      </header>

      <main className="matches-container">

        {/* HERO */}

        <section className="matches-hero">

          <div className="matches-hero-content">

            <div className="matches-eyebrow">

              <span className="matches-live-dot" />

              AI MATCHING ENGINE

            </div>

            <h1>
              Find the connection
              <br />
              <span>
                hidden in the data.
              </span>
            </h1>

            <p>
              SmartMatch compares lost and found
              reports using image fingerprints,
              descriptions, locations, dates and
              times to discover possible matches.
            </p>

            <div className="matches-hero-stats">

              <div>

                <strong>
                  {matches.length}
                </strong>

                <span>
                  Your Matches
                </span>

              </div>

              <div>

                <strong>
                  {strongMatches}
                </strong>

                <span>
                  Strong Matches
                </span>

              </div>

              <div>

                <strong>
                  {unreadAlerts}
                </strong>

                <span>
                  New Alerts
                </span>

              </div>

            </div>

          </div>

          <div className="matches-hero-visual">

            <div className="matches-orbit orbit-a" />

            <div className="matches-orbit orbit-b" />

            <div className="matches-brain-card">

              <div className="matches-brain-icon">
                <Brain size={35} />
              </div>

              <strong>
                AI ANALYZING
              </strong>

              <span>
                Visual + semantic signals
              </span>

              <div className="matches-signal">

                <i />
                <i />
                <i />
                <i />
                <i />

              </div>

            </div>

          </div>

        </section>

        {/* ERROR */}

        {error && (

          <div className="matches-error">

            <Bell size={17} />

            {error}

          </div>

        )}

        {/* ALERTS */}

        {alerts.length > 0 && (

          <section className="matches-alert-section">

            <div className="matches-section-heading">

              <div>

                <span>
                  MATCH NOTIFICATIONS
                </span>

                <h2>
                  Recovery alerts
                </h2>

              </div>

              {unreadAlerts > 0 && (

                <button
                  type="button"
                  onClick={markAllRead}
                  className="matches-mark-all"
                >

                  <Check size={15} />

                  Mark all read

                </button>

              )}

            </div>

            <div className="matches-alert-list">

              {alerts.map((alert) => (

                <div
                  className={`matches-alert ${
                    alert.is_read
                      ? "read"
                      : "unread"
                  }`}
                  key={alert.id}
                >

                  <div className="matches-alert-icon">

                    {alert.is_read ? (
                      <CheckCircle2
                        size={19}
                      />
                    ) : (
                      <Bell size={19} />
                    )}

                  </div>

                  <div className="matches-alert-content">

                    <strong>
                      {alert.match_score}%
                      {" "}
                      possible match
                    </strong>

                    <p>
                      {alert.alert_message}
                    </p>

                    <span>
                      {new Date(
                        alert.created_at
                      ).toLocaleString()}
                    </span>

                  </div>

                  {!alert.is_read && (

                    <button
                      type="button"
                      className="matches-alert-read"
                      onClick={() =>
                        markAlertRead(
                          alert.id
                        )
                      }
                    >

                      <Check size={15} />

                      Read

                    </button>

                  )}

                </div>

              ))}

            </div>

          </section>

        )}

        {/* RESULTS */}

        <section className="matches-results">

          <div className="matches-section-heading">

            <div>

              <span>
                SMART RECOVERY
              </span>

              <h2>
                Your possible matches
              </h2>

              <p>
                Only matches involving your own
                lost or found reports are displayed.
              </p>

            </div>

            <div className="matches-result-count">
              {matches.length} results
            </div>

          </div>

          {matches.length === 0 ? (

            <div className="matches-empty">

              <div className="matches-empty-icon">
                <Sparkles size={30} />
              </div>

              <h3>
                No possible matches yet
              </h3>

              <p>
                Add more lost and found reports
                and run SmartMatch again.
              </p>

              <button
                type="button"
                onClick={generateMatches}
                className="matches-empty-button"
              >

                <RefreshCw size={16} />

                Run SmartMatch

              </button>

            </div>

          ) : (

            <div className="matches-list">

              {matches.map(
                (match, index) => (

                  <div
                    key={`${match.lost.id}-${match.found.id}`}
                    className="matches-result-wrapper"
                  >

                    <div className="matches-rank">

                      <span>
                        {String(
                          index + 1
                        ).padStart(
                          2,
                          "0"
                        )}
                      </span>

                      {index === 0 && (

                        <div className="matches-best">

                          <Sparkles size={11} />

                          BEST MATCH

                        </div>

                      )}

                    </div>

                    <MatchCard
                      match={match}
                    />

                  </div>

                )
              )}

            </div>

          )}

        </section>

        {/* HOW IT WORKS */}

        <section className="matches-how">

          <div className="matches-section-heading centered">

            <div>

              <span>
                UNDER THE HOOD
              </span>

              <h2>
                How SmartMatch thinks
              </h2>

            </div>

          </div>

          <div className="matches-how-grid">

            <div className="matches-how-card">

              <div className="matches-how-number">
                01
              </div>

              <ImageIcon size={22} />

              <h3>
                Visual Fingerprint
              </h3>

              <p>
                Image fingerprints are compared
                to identify visual similarity between
                reports.
              </p>

            </div>

            <div className="matches-how-card">

              <div className="matches-how-number">
                02
              </div>

              <Brain size={22} />

              <h3>
                Semantic Analysis
              </h3>

              <p>
                Item names, descriptions and
                characteristics are compared for
                meaningful overlaps.
              </p>

            </div>

            <div className="matches-how-card">

              <div className="matches-how-number">
                03
              </div>

              <MapPin size={22} />

              <h3>
                Context Signals
              </h3>

              <p>
                Location, date and time help
                determine whether reports could
                describe the same event.
              </p>

            </div>

            <div className="matches-how-card">

              <div className="matches-how-number">
                04
              </div>

              <CheckCircle2 size={22} />

              <h3>
                Private Confidence
              </h3>

              <p>
                A confidence score is generated,
                while the final match is visible
                only to the two report owners.
              </p>

            </div>

          </div>

        </section>

      </main>

    </div>
  );
}

export default Matches;
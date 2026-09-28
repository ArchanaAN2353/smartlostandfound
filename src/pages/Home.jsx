import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import SmartMatchLoader from "../components/SmartMatchLoader";

import {
  Search,
  Package,
  Sparkles,
  LayoutDashboard,
  ArrowRight,
  ShieldCheck,
  Clock3,
  MapPin,
  BrainCircuit,
  CheckCircle2,
  Eye,
  Users,
  AlertTriangle,
} from "lucide-react";

function Home() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1800);

    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <SmartMatchLoader text="Initializing SmartMatch..." />
    );
  }

  return (
    <div className="home-page">

      {/* Background decoration */}
      <div className="home-background">
        <div className="bg-shape bg-shape-purple" />
        <div className="bg-shape bg-shape-cyan" />
      </div>

      <main className="home-content">

        {/* ================= HERO ================= */}
        <section className="hero-section">

          <div className="hero-content">

            <div className="hero-badge">
              <Sparkles size={15} />
              AI-POWERED CAMPUS RECOVERY
            </div>

            <h1 className="hero-title">
              Lost something?
              <br />
              <span>Let's find it.</span>
            </h1>

            <p className="hero-description">
              Smart Lost &amp; Found helps students report
              missing belongings, discover potential matches,
              and recover their items faster.
            </p>

            <div className="hero-actions">

              <Link
                to="/report-lost"
                className="primary-button"
              >
                <Search size={18} />
                I Lost Something
                <ArrowRight size={17} />
              </Link>

              <Link
                to="/report-found"
                className="secondary-button"
              >
                <Package size={18} />
                I Found Something
              </Link>

            </div>

            <div className="hero-trust">

              <div>
                <ShieldCheck size={16} />
                <span>Campus focused</span>
              </div>

              <div>
                <BrainCircuit size={16} />
                <span>Smart matching</span>
              </div>

              <div>
                <CheckCircle2 size={16} />
                <span>Simple recovery</span>
              </div>

            </div>

          </div>

          {/* Hero visual */}
          <div className="hero-visual">

            <div className="visual-card main-visual-card">

              <div className="visual-card-top">

                <div className="visual-icon purple-bg">
                  <Sparkles size={22} />
                </div>

                <span className="status-badge">
                  SMARTMATCH
                </span>

              </div>

              <h3>
                Possible match found
              </h3>

              <p>
                Your lost item may match a recently
                reported found item.
              </p>

              <div className="match-preview">

                <div className="match-icon">
                  <Package size={22} />
                </div>

                <div>
                  <strong>Found Item</strong>
                  <span>Campus Library</span>
                </div>

                <div className="match-score">
                  92%
                </div>

              </div>

              <Link
                to="/matches"
                className="visual-link"
              >
                View Smart Matches
                <ArrowRight size={15} />
              </Link>

            </div>

            <div className="floating-info info-location">

              <div className="small-icon cyan-bg">
                <MapPin size={15} />
              </div>

              <div>
                <strong>Location</strong>
                <span>Campus tracked</span>
              </div>

            </div>

            <div className="floating-info info-time">

              <div className="small-icon pink-bg">
                <Clock3 size={15} />
              </div>

              <div>
                <strong>Quick reports</strong>
                <span>Save time</span>
              </div>

            </div>

          </div>

        </section>


        {/* ================= QUICK ACTIONS ================= */}

        <section className="quick-section">

          <div className="section-title">

            <span>GET STARTED</span>

            <h2>
              What happened?
            </h2>

            <p>
              Choose an option below to get started.
            </p>

          </div>


          <div className="quick-grid">

            {/* LOST */}

            <Link
              to="/report-lost"
              className="quick-card"
            >

              <div className="quick-icon purple-icon">
                <Search size={25} />
              </div>

              <div className="quick-card-content">

                <span className="quick-label">
                  LOST ITEM
                </span>

                <h3>
                  I lost something
                </h3>

                <p>
                  Report your missing item with
                  its details, location and time.
                </p>

                <div className="quick-arrow">
                  Report Lost
                  <ArrowRight size={16} />
                </div>

              </div>

            </Link>


            {/* FOUND */}

            <Link
              to="/report-found"
              className="quick-card"
            >

              <div className="quick-icon cyan-icon">
                <Package size={25} />
              </div>

              <div className="quick-card-content">

                <span className="quick-label">
                  FOUND ITEM
                </span>

                <h3>
                  I found something
                </h3>

                <p>
                  Help another student by
                  reporting an item you found.
                </p>

                <div className="quick-arrow cyan-text">
                  Report Found
                  <ArrowRight size={16} />
                </div>

              </div>

            </Link>


            {/* SMARTMATCH */}

            <Link
              to="/matches"
              className="quick-card"
            >

              <div className="quick-icon pink-icon">
                <Sparkles size={25} />
              </div>

              <div className="quick-card-content">

                <span className="quick-label">
                  SMARTMATCH
                </span>

                <h3>
                  Find my match
                </h3>

                <p>
                  See potential connections between
                  lost and found reports.
                </p>

                <div className="quick-arrow pink-text">
                  View Matches
                  <ArrowRight size={16} />
                </div>

              </div>

            </Link>


            {/* MYSTERY MATCH */}

            <Link
              to="/mystery-match"
              className="quick-card"
            >

              <div className="quick-icon purple-icon">
                <Eye size={25} />
              </div>

              <div className="quick-card-content">

                <span className="quick-label">
                  MYSTERY MATCH
                </span>

                <h3>
                  Reveal a mystery
                </h3>

                <p>
                  Let AI secretly compare lost and
                  found items and reveal the connection.
                </p>

                <div className="quick-arrow">
                  Reveal Match
                  <ArrowRight size={16} />
                </div>

              </div>

            </Link>


            {/* COMMUNITY SEARCH */}

            <Link
              to="/community"
              className="quick-card"
            >

              <div className="quick-icon cyan-icon">
                <Users size={25} />
              </div>

              <div className="quick-card-content">

                <span className="quick-label">
                  COMMUNITY SEARCH
                </span>

                <h3>
                  Help find an item
                </h3>

                <p>
                  See lost items, report sightings,
                  and help other students recover
                  their belongings.
                </p>

                <div className="quick-arrow cyan-text">
                  Join the Search
                  <ArrowRight size={16} />
                </div>

              </div>

            </Link>


            {/* COMPLAINT BOX */}

            <Link
              to="/complaints"
              className="quick-card"
            >

              <div className="quick-icon purple-icon">
                <AlertTriangle size={25} />
              </div>

              <div className="quick-card-content">

                <span className="quick-label">
                  COMPLAINT BOX
                </span>

                <h3>
                  Report a problem
                </h3>

                <p>
                  File a complaint about a false claim,
                  misuse, or an issue with the platform.
                </p>

                <div className="quick-arrow">
                  File Complaint
                  <ArrowRight size={16} />
                </div>

              </div>

            </Link>

          </div>

        </section>


        {/* ================= HOW IT WORKS ================= */}

        <section className="how-section">

          <div className="section-title centered">

            <span>
              HOW IT WORKS
            </span>

            <h2>
              Recovery made
              <br />
              <strong>simple.</strong>
            </h2>

            <p>
              No complicated process. Just report,
              match and recover.
            </p>

          </div>


          <div className="steps-grid">

            <div className="step-item">

              <div className="step-number">
                01
              </div>

              <div className="step-icon purple-bg">
                <Search size={22} />
              </div>

              <h3>
                Report
              </h3>

              <p>
                Submit information about the item
                you lost or found.
              </p>

            </div>


            <div className="step-connector" />


            <div className="step-item">

              <div className="step-number">
                02
              </div>

              <div className="step-icon cyan-bg">
                <BrainCircuit size={22} />
              </div>

              <h3>
                SmartMatch
              </h3>

              <p>
                Compare reports using AI fingerprints,
                item details, locations and timing.
              </p>

            </div>


            <div className="step-connector" />


            <div className="step-item">

              <div className="step-number">
                03
              </div>

              <div className="step-icon pink-bg">
                <CheckCircle2 size={22} />
              </div>

              <h3>
                Recover
              </h3>

              <p>
                Review the match and start the
                recovery process.
              </p>

            </div>

          </div>

        </section>


        {/* ================= MYSTERY MATCH CTA ================= */}

        <section
          style={{
            marginTop: "60px",
            padding: "35px",
            borderRadius: "24px",
            background: "#111827",
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "25px",
            flexWrap: "wrap",
          }}
        >

          <div>

            <span
              style={{
                fontSize: "12px",
                fontWeight: "700",
                letterSpacing: "1.5px",
                opacity: 0.7,
              }}
            >
              🕵️ AI MYSTERY MATCH
            </span>

            <h2
              style={{
                margin: "8px 0",
              }}
            >
              Think AI can find the connection?
            </h2>

            <p
              style={{
                margin: 0,
                opacity: 0.75,
                maxWidth: "600px",
                lineHeight: 1.6,
              }}
            >
              Let Smart Lost &amp; Found secretly compare
              the strongest lost and found reports, then
              reveal the AI-generated match.
            </p>

          </div>


          <Link
            to="/mystery-match"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "13px 20px",
              borderRadius: "12px",
              background: "#ffffff",
              color: "#111827",
              textDecoration: "none",
              fontWeight: "700",
              whiteSpace: "nowrap",
            }}
          >
            <Sparkles size={17} />
            Try Mystery Match
            <ArrowRight size={17} />
          </Link>

        </section>


        {/* ================= DASHBOARD CTA ================= */}

        <section className="dashboard-banner">

          <div className="dashboard-banner-icon">
            <LayoutDashboard size={25} />
          </div>

          <div className="dashboard-banner-content">

            <span>
              CAMPUS OVERVIEW
            </span>

            <h2>
              Track everything in one place.
            </h2>

            <p>
              View lost reports, found reports,
              matches and claimed items from your
              dashboard.
            </p>

          </div>

          <Link
            to="/dashboard"
            className="dashboard-button"
          >
            Open Dashboard
            <ArrowRight size={17} />
          </Link>

        </section>


        {/* ================= FOOTER ================= */}

        <footer className="home-footer">

          <div className="footer-brand">

            <div className="footer-logo">
              <Sparkles size={16} />
            </div>

            <div>

              <strong>
                Smart Lost &amp; Found
              </strong>

              <span>
                AI-powered campus recovery
              </span>

            </div>

          </div>

          <span className="footer-right">
            Built for smarter campuses.
          </span>

        </footer>

      </main>

    </div>
  );
}

export default Home;
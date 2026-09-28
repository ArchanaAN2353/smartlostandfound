import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Flame,
  RefreshCw,
  Search,
  TrendingUp,
} from "lucide-react";

import { supabase } from "../services/supabase";
import "./CampusHeatmap.css";

// =====================================================
// CAMPUS LOCATIONS
// =====================================================

const CAMPUS_ZONES = [
  {
    id: "msrit",
    name: "MSRIT / Main Campus",
    keywords: [
      "msrit",
      "ramaiah institute of technology",
      "ramaiah",
      "main campus",
    ],
    x: 69,
    y: 28,
  },

  {
    id: "parking",
    name: "MSRIT Parking Lot",
    keywords: [
      "parking",
      "parking lot",
      "msrit parking",
    ],
    x: 55,
    y: 76,
  },

  {
    id: "block5",
    name: "Block 5",
    keywords: [
      "block 5",
      "block5",
      "b5",
    ],
    x: 82,
    y: 35,
  },

  {
    id: "library",
    name: "Library",
    keywords: [
      "library",
      "central library",
    ],
    x: 52,
    y: 35,
  },

  {
    id: "canteen",
    name: "Canteen",
    keywords: [
      "canteen",
      "cafeteria",
      "food court",
      "mess",
    ],
    x: 78,
    y: 58,
  },

  {
    id: "auditorium",
    name: "Auditorium",
    keywords: [
      "auditorium",
      "seminar hall",
      "main hall",
    ],
    x: 38,
    y: 48,
  },

  {
    id: "labs",
    name: "Labs",
    keywords: [
      "lab",
      "labs",
      "laboratory",
      "computer lab",
    ],
    x: 38,
    y: 27,
  },

  {
    id: "gate",
    name: "Main Gate",
    keywords: [
      "main gate",
      "gate",
      "entrance",
    ],
    x: 10,
    y: 58,
  },
];

// =====================================================
// NORMALIZE TEXT
// =====================================================

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

// =====================================================
// FIND CAMPUS ZONE
// =====================================================

function findZone(location) {
  const text = normalize(location);

  if (!text) return null;

  return (
    CAMPUS_ZONES.find((zone) =>
      zone.keywords.some((keyword) =>
        text.includes(keyword)
      )
    ) || null
  );
}

// =====================================================
// HEAT COLOR
// =====================================================

function getHeatLevel(count, max) {
  if (count === 0) return "low";

  const ratio = count / max;

  if (ratio >= 0.75) return "critical";
  if (ratio >= 0.5) return "high";
  if (ratio >= 0.25) return "medium";

  return "low";
}

// =====================================================
// COMPONENT
// =====================================================

export default function CampusHeatmap() {
  const [items, setItems] = useState([]);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");

  const [period, setPeriod] = useState("all");

  const [search, setSearch] = useState("");

  const [selectedZone, setSelectedZone] = useState(null);

  // ===================================================
  // LOAD LOST ITEMS
  // ===================================================

  async function loadLostItems(isRefresh = false) {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const { data, error } = await supabase
        .from("lost_items")
        .select(
          "id,item_name,location,lost_date,status,created_at"
        )
        .order("created_at", {
          ascending: false,
        });

      if (error) {
        throw error;
      }

      setItems(data || []);
    } catch (err) {
      console.error(
        "Campus heatmap error:",
        err
      );

      setError(
        err.message ||
          "Unable to load campus heatmap."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  // ===================================================
  // INITIAL LOAD
  // ===================================================

  useEffect(() => {
    loadLostItems();
  }, []);

  // ===================================================
  // FILTER BY PERIOD
  // ===================================================

  const filteredItems = useMemo(() => {
    if (period === "all") {
      return items;
    }

    const now = new Date();

    const days =
      period === "7"
        ? 7
        : period === "30"
        ? 30
        : 90;

    return items.filter((item) => {
      const dateValue =
        item.lost_date ||
        item.created_at;

      if (!dateValue) {
        return false;
      }

      const date = new Date(
        item.lost_date
          ? `${item.lost_date}T23:59:59`
          : item.created_at
      );

      if (Number.isNaN(date.getTime())) {
        return false;
      }

      const difference =
        (now - date) /
        (1000 * 60 * 60 * 24);

      return difference <= days;
    });
  }, [items, period]);

  // ===================================================
  // CALCULATE ZONE COUNTS
  // ===================================================

  const zoneStats = useMemo(() => {
    return CAMPUS_ZONES.map((zone) => {
      const reports =
        filteredItems.filter(
          (item) =>
            findZone(item.location)?.id ===
            zone.id
        );

      return {
        ...zone,
        count: reports.length,
        reports,
      };
    });
  }, [filteredItems]);

  // ===================================================
  // MAXIMUM REPORTS
  // ===================================================

  const maxCount = Math.max(
    ...zoneStats.map(
      (zone) => zone.count
    ),
    1
  );

  // ===================================================
  // RANKING
  // ===================================================

  const ranking = [...zoneStats]
    .filter(
      (zone) => zone.count > 0
    )
    .sort(
      (a, b) => b.count - a.count
    );

  // ===================================================
  // SEARCH
  // ===================================================

  const visibleRanking =
    ranking.filter((zone) =>
      zone.name
        .toLowerCase()
        .includes(
          search.toLowerCase()
        )
    );

  // ===================================================
  // TOTALS
  // ===================================================

  const totalReports =
    filteredItems.length;

  const mappedReports =
    filteredItems.filter(
      (item) =>
        findZone(item.location)
    ).length;

  const highestZone =
    ranking[0] || null;

  // ===================================================
  // SELECT ZONE
  // ===================================================

  function handleZoneClick(zone) {
    if (zone.count === 0) {
      setSelectedZone(null);
      return;
    }

    setSelectedZone(zone);
  }

  return (
    <div className="campus-heatmap-page">
      <div className="campus-heatmap-container">

        {/* ==========================================
            BACK
        ========================================== */}

        <Link
          to="/dashboard"
          className="heatmap-back"
        >
          <ArrowLeft size={17} />
          Back to Dashboard
        </Link>

        {/* ==========================================
            HEADER
        ========================================== */}

        <div className="heatmap-header">
          <div className="heatmap-heading">
            <div className="heatmap-title-icon">
              <Flame size={25} />
            </div>

            <div>
              <div className="heatmap-label">
                CAMPUS INTELLIGENCE
              </div>

              <h1>
                Lost Item Heatmap
              </h1>

              <p>
                Discover where lost-item reports
                happen most frequently across campus.
              </p>
            </div>
          </div>

          <button
            className="heatmap-refresh-button"
            onClick={() =>
              loadLostItems(true)
            }
            disabled={refreshing}
          >
            <RefreshCw
              size={16}
              className={
                refreshing
                  ? "refresh-spin"
                  : ""
              }
            />

            {refreshing
              ? "Refreshing..."
              : "Refresh"}
          </button>
        </div>

        {/* ==========================================
            ERROR
        ========================================== */}

        {error && (
          <div className="heatmap-error">
            {error}
          </div>
        )}

        {/* ==========================================
            STATISTICS
        ========================================== */}

        <div className="heatmap-stats">
          <div className="heatmap-stat">
            <span>
              TOTAL REPORTS
            </span>

            <strong>
              {totalReports}
            </strong>
          </div>

          <div className="heatmap-stat">
            <span>
              MAPPED REPORTS
            </span>

            <strong>
              {mappedReports}
            </strong>
          </div>

          <div className="heatmap-stat">
            <span>
              HOTTEST ZONE
            </span>

            <strong className="hot-zone-name">
              {highestZone
                ? highestZone.name
                : "—"}
            </strong>
          </div>

          <div className="heatmap-stat">
            <span>
              HOTSPOT REPORTS
            </span>

            <strong>
              {highestZone
                ? highestZone.count
                : 0}
            </strong>
          </div>
        </div>

        {/* ==========================================
            CONTROLS
        ========================================== */}

        <div className="heatmap-controls">
          <select
            value={period}
            onChange={(e) =>
              setPeriod(e.target.value)
            }
          >
            <option value="all">
              All Time
            </option>

            <option value="90">
              Last 90 Days
            </option>

            <option value="30">
              Last 30 Days
            </option>

            <option value="7">
              Last 7 Days
            </option>
          </select>

          <div className="heatmap-search">
            <Search size={16} />

            <input
              value={search}
              onChange={(e) =>
                setSearch(
                  e.target.value
                )
              }
              placeholder="Search campus location..."
            />
          </div>
        </div>

        {/* ==========================================
            MAIN CONTENT
        ========================================== */}

        <div className="heatmap-main">

          {/* ========================================
              MAP
          ======================================== */}

          <div className="campus-map-card">
            <div className="map-card-header">
              <div>
                <div className="heatmap-label">
                  CAMPUS MAP
                </div>

                <h2>
                  Lost-item activity
                </h2>
              </div>

              <span>
                Live from Supabase
              </span>
            </div>

            {loading ? (
              <div className="heatmap-loading">
                <Flame size={30} />
                Loading campus data...
              </div>
            ) : (
              <div className="real-campus-map">

                {/* YOUR UPLOADED CAMPUS MAP */}

                <img
                  src={`${import.meta.env.BASE_URL}campus-map.png`}
                  alt="MSRIT campus map"
                  className="campus-map-image"
                />

                {/* ==================================
                    HEAT POINTS
                ================================== */}

                {zoneStats.map(
                  (zone) => {
                    const level =
                      getHeatLevel(
                        zone.count,
                        maxCount
                      );

                    const size =
                      zone.count === 0
                        ? 30
                        : Math.min(
                            95,
                            32 +
                              zone.count * 8
                          );

                    return (
                      <button
                        key={zone.id}
                        className={`map-hotspot hotspot-${level}`}
                        style={{
                          left: `${zone.x}%`,
                          top: `${zone.y}%`,
                          "--hot-size":
                            `${size}px`,
                        }}
                        onClick={() =>
                          handleZoneClick(
                            zone
                          )
                        }
                        title={`${zone.name}: ${zone.count} lost-item reports`}
                      >
                        <span className="hotspot-glow" />

                        <span className="hotspot-core">
                          {zone.count}
                        </span>

                        <span className="hotspot-name">
                          {zone.name}
                        </span>
                      </button>
                    );
                  }
                )}

                {/* NORTH */}

                <div className="map-north">
                  N
                </div>
              </div>
            )}

            {/* ======================================
                LEGEND
            ====================================== */}

            <div className="heatmap-legend">
              <span>
                <i className="legend-low" />
                Low
              </span>

              <span>
                <i className="legend-medium" />
                Medium
              </span>

              <span>
                <i className="legend-high" />
                High
              </span>

              <span>
                <i className="legend-critical" />
                Highest
              </span>
            </div>
          </div>

          {/* ========================================
              RANKING
          ======================================== */}

          <div className="hotzone-card">
            <div className="hotzone-header">
              <div>
                <div className="heatmap-label">
                  ANALYTICS
                </div>

                <h2>
                  Hot Zones
                </h2>
              </div>

              <TrendingUp
                size={21}
              />
            </div>

            {visibleRanking.length === 0 ? (
              <div className="no-hotzones">
                <Flame size={28} />

                <p>
                  No lost-item reports
                  found.
                </p>
              </div>
            ) : (
              <div className="zone-ranking">
                {visibleRanking.map(
                  (zone, index) => (
                    <button
                      key={zone.id}
                      className="zone-ranking-row"
                      onClick={() =>
                        handleZoneClick(
                          zone
                        )
                      }
                    >
                      <div className="zone-number">
                        {String(
                          index + 1
                        ).padStart(
                          2,
                          "0"
                        )}
                      </div>

                      <div className="zone-details">
                        <div className="zone-name">
                          <strong>
                            {zone.name}
                          </strong>

                          <b>
                            {zone.count}
                          </b>
                        </div>

                        <div className="zone-progress">
                          <span
                            style={{
                              width:
                                `${
                                  (zone.count /
                                    maxCount) *
                                  100
                                }%`,
                            }}
                          />
                        </div>
                      </div>
                    </button>
                  )
                )}
              </div>
            )}

            <div className="heatmap-tip">
              <Flame size={18} />

              <div>
                <strong>
                  What does this show?
                </strong>

                <p>
                  Hotter areas indicate campus
                  locations with more lost-item
                  reports.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ==========================================
            SELECTED LOCATION
        ========================================== */}

        {selectedZone && (
          <div className="selected-zone-card">
            <div>
              <div className="heatmap-label">
                SELECTED LOCATION
              </div>

              <h2>
                {selectedZone.name}
              </h2>

              <p>
                {selectedZone.count}
                {" "}
                lost-item report
                {selectedZone.count === 1
                  ? ""
                  : "s"}
              </p>
            </div>

            <div className="selected-zone-items">
              {selectedZone.reports
                .slice(0, 5)
                .map((item) => (
                  <div
                    className="selected-item"
                    key={item.id}
                  >
                    <strong>
                      {item.item_name ||
                        "Unnamed item"}
                    </strong>

                    <span>
                      {item.location}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
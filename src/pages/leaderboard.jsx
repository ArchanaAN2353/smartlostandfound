import React, { useEffect, useState } from 'react';
import { getLeaderboardData } from '../services/leaderboard';

export function Leaderboard() {
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRankings() {
      const data = await getLeaderboardData();
      setLeaders(data);
      setLoading(false);
    }
    fetchRankings();
  }, []);

  if (loading) {
    return (
      <div className="form-page" style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
        <div className="step-card" style={{ textAlign: 'center' }}>
          <h3>Loading top heroes...</h3>
          <p>Analyzing campus recovery records.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="form-page">
      <div className="form-container" style={{ maxWidth: "600px" }}>
        
        {/* Back Context Link */}
        <a href="#/dashboard" className="back-link" style={{ display: "inline-flex", alignItems: "center", gap: "6px", marginBottom: "20px", color: "#8C6D4F", textDecoration: "none", fontWeight: "bold", fontSize: "14px" }}>
          ← Back to Dashboard
        </a>

        {/* Clean Retro Typography Headers */}
        <div className="form-header" style={{ marginBottom: "30px" }}>
          <p className="eyebrow" style={{ color: "#705E4C", letterSpacing: "1.5px" }}>
            COMMUNITY HEROES
          </p>
          <h1 style={{ fontFamily: "serif", fontSize: "32px", color: "#1A110B", margin: "5px 0" }}>
            Top Founders
          </h1>
          <p style={{ color: "#5C4D3E", fontSize: "14px", margin: 0 }}>
            Rankings of students who have reported and returned missing items.
          </p>
        </div>

        {/* The Leaderboard List Container */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {leaders.map((founder, index) => {
            const rank = index + 1;
            
            // Visual badge coloring layout matching rank levels
            const getRankColor = (r) => {
              if (r === 1) return { bg: "#FFF9E6", border: "#F5C242", text: "#8A6D00" }; // Gold
              if (r === 2) return { bg: "#F2F4F7", border: "#D0D5DD", text: "#344054" }; // Silver
              if (r === 3) return { bg: "#FDF4ED", border: "#EAC196", text: "#6E3A00" }; // Bronze
              return { bg: "#FAF9F5", border: "#E3DEC3", text: "#705E4C" }; // Standard
            };

            const styles = getRankColor(rank);

            return (
              <div 
                key={founder.id || index}
                className="step-card"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "16px 20px",
                  backgroundColor: styles.bg,
                  borderColor: styles.border,
                  margin: 0,
                  transition: "transform 0.15s ease",
                }}
              >
                {/* Left Section: Rank Position and Identity Avatar */}
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  
                  {/* Circular Rank Indicator Badge */}
                  <div style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: "bold",
                    fontFamily: "serif",
                    fontSize: "15px",
                    backgroundColor: rank <= 3 ? "transparent" : "#EAE5D3",
                    border: rank <= 3 ? `2px solid ${styles.border}` : "1px solid #C5B49E",
                    color: styles.text
                  }}>
                    {rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : rank}
                  </div>

                  {/* Avatar Letter Box */}
                  <div style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    backgroundColor: "#EAE5D3",
                    border: "1px solid #C5B49E",
                    color: "#5C4D3E",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: "bold",
                    fontFamily: "serif",
                    fontSize: "16px"
                  }}>
                    {founder.name ? founder.name.charAt(5).toUpperCase() : 'U'}
                  </div>

                  {/* Clean formatted User identifier */}
                  <span style={{ 
                    fontFamily: "serif", 
                    fontWeight: "bold", 
                    fontSize: "16px", 
                    color: "#1A110B" 
                  }}>
                    {founder.name}
                  </span>
                </div>

                {/* Right Section: Structured Counter Details */}
                <div style={{ textAlign: "right", fontFamily: "serif" }}>
                  <span style={{ 
                    fontWeight: "bold", 
                    fontSize: "20px", 
                    color: "#8C6D4F",
                    marginRight: "4px"
                  }}>
                    {founder.itemsFound}
                  </span>
                  <span style={{ 
                    fontSize: "13px", 
                    color: "#705E4C", 
                    fontStyle: "italic" 
                  }}>
                    {founder.itemsFound === 1 ? 'item' : 'items'}
                  </span>
                </div>

              </div>
            );
          })}

          {/* Empty State Fallback Screen */}
          {leaders.length === 0 && (
            <div className="step-card" style={{ textAlign: "center", padding: "40px" }}>
              <p style={{ color: "#705E4C", margin: 0 }}>No reports submitted yet. Be the first hero!</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
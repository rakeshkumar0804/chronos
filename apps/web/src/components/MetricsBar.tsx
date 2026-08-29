import React from "react";
import { SolverStats } from "@chronos/solver";
import { Activity, GitBranch, Scissors, Layers, Clock } from "lucide-react";

interface MetricsBarProps {
  metrics: SolverStats;
  totalVariables: number;
}

export const MetricsBar: React.FC<MetricsBarProps> = ({
  metrics,
  totalVariables,
}) => {
  const isBacktracking = (metrics.backtrackCount || 0) > 0;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
        gap: "10px",
        width: "100%",
      }}
    >
      {/* Metric 1: Nodes Explored */}
      <div
        style={{
          background: "#0F1612",
          border: "1px solid #1C2B22",
          borderRadius: "6px",
          padding: "10px 14px",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Instrument Top Tick Marks */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "3px",
            background: "repeating-linear-gradient(90deg, #39FF88 0px, #39FF88 4px, transparent 4px, transparent 8px)",
            opacity: 0.6,
          }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "2px" }}>
          <span style={{ fontSize: "10px", color: "#7A8D80", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            SIG // NODES EXPLORED
          </span>
          <Activity size={13} color="#39FF88" />
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
          <span
            style={{
              fontSize: "20px",
              color: "#39FF88",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              textShadow: "0 0 10px rgba(57, 255, 136, 0.4)",
            }}
          >
            {metrics.nodesExplored.toLocaleString()}
          </span>
          <span style={{ fontSize: "10px", color: "#4B5A50" }}>NODES</span>
        </div>
      </div>

      {/* Metric 2: Backtracks */}
      <div
        style={{
          background: isBacktracking ? "rgba(255, 59, 59, 0.08)" : "#0F1612",
          border: `1px solid ${isBacktracking ? "#FF3B3B" : "#1C2B22"}`,
          borderRadius: "6px",
          padding: "10px 14px",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          position: "relative",
          overflow: "hidden",
          transition: "all 0.2s ease",
          boxShadow: isBacktracking ? "0 0 14px rgba(255, 59, 59, 0.2)" : "none",
        }}
      >
        {/* Instrument Top Tick Marks */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "3px",
            background: isBacktracking
              ? "repeating-linear-gradient(90deg, #FF3B3B 0px, #FF3B3B 4px, transparent 4px, transparent 8px)"
              : "repeating-linear-gradient(90deg, #2A3F33 0px, #2A3F33 4px, transparent 4px, transparent 8px)",
            opacity: 0.8,
          }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "2px" }}>
          <span
            style={{
              fontSize: "10px",
              color: isBacktracking ? "#FF3B3B" : "#7A8D80",
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            REG // BACKTRACKS
          </span>
          <GitBranch size={13} color={isBacktracking ? "#FF3B3B" : "#7A8D80"} />
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
          <span
            style={{
              fontSize: "20px",
              color: isBacktracking ? "#FF3B3B" : "#7A8D80",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              textShadow: isBacktracking ? "0 0 12px rgba(255, 59, 59, 0.6)" : "none",
            }}
          >
            {metrics.backtrackCount.toLocaleString()}
          </span>
          <span style={{ fontSize: "10px", color: isBacktracking ? "#FF8888" : "#4B5A50" }}>
            {isBacktracking ? "UNWOUND" : "OPTIMAL"}
          </span>
        </div>
      </div>

      {/* Metric 3: Domains Pruned */}
      <div
        style={{
          background: "#0F1612",
          border: "1px solid #1C2B22",
          borderRadius: "6px",
          padding: "10px 14px",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "3px",
            background: "repeating-linear-gradient(90deg, #FFB020 0px, #FFB020 4px, transparent 4px, transparent 8px)",
            opacity: 0.6,
          }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "2px" }}>
          <span style={{ fontSize: "10px", color: "#7A8D80", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            FILTER // AC-3 PRUNED
          </span>
          <Scissors size={13} color="#FFB020" />
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
          <span
            style={{
              fontSize: "20px",
              color: "#FFB020",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              textShadow: "0 0 10px rgba(255, 176, 32, 0.3)",
            }}
          >
            {(metrics.domainsPruned || 0).toLocaleString()}
          </span>
          <span style={{ fontSize: "10px", color: "#4B5A50" }}>VALUES</span>
        </div>
      </div>

      {/* Metric 4: Search Depth */}
      <div
        style={{
          background: "#0F1612",
          border: "1px solid #1C2B22",
          borderRadius: "6px",
          padding: "10px 14px",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "3px",
            background: "repeating-linear-gradient(90deg, #39FF88 0px, #39FF88 4px, transparent 4px, transparent 8px)",
            opacity: 0.6,
          }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "2px" }}>
          <span style={{ fontSize: "10px", color: "#7A8D80", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            FRONTIER // DEPTH
          </span>
          <Layers size={13} color="#39FF88" />
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
          <span
            style={{
              fontSize: "20px",
              color: "#EEF8F1",
              fontWeight: 700,
              letterSpacing: "-0.02em",
            }}
          >
            {metrics.maxDepth || 0}
          </span>
          <span style={{ fontSize: "10px", color: "#7A8D80" }}>
            / {totalVariables} SESSIONS
          </span>
        </div>
      </div>

      {/* Metric 5: Execution Duration */}
      <div
        style={{
          background: "#0F1612",
          border: "1px solid #1C2B22",
          borderRadius: "6px",
          padding: "10px 14px",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "3px",
            background: "repeating-linear-gradient(90deg, #39FF88 0px, #39FF88 4px, transparent 4px, transparent 8px)",
            opacity: 0.4,
          }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "2px" }}>
          <span style={{ fontSize: "10px", color: "#7A8D80", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            CHRONO // ELAPSED
          </span>
          <Clock size={13} color="#39FF88" />
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
          <span
            style={{
              fontSize: "20px",
              color: "#EEF8F1",
              fontWeight: 700,
              letterSpacing: "-0.02em",
            }}
          >
            {metrics.timeMs > 0 ? `${metrics.timeMs.toFixed(1)}` : "0.0"}
          </span>
          <span style={{ fontSize: "10px", color: "#7A8D80" }}>MS</span>
        </div>
      </div>
    </div>
  );
};

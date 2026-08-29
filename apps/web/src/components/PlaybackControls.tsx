import React from "react";
import { Play, Pause, SkipForward, RotateCcw, Compass, FastForward } from "lucide-react";

interface PlaybackControlsProps {
  playbackState: "IDLE" | "RUNNING" | "PAUSED" | "COMPLETED" | "UNSATISFIABLE";
  speed: number;
  heuristicMode: "MRV_LCV" | "CHRONOLOGICAL";
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStep: () => void;
  onReset: () => void;
  onSpeedChange: (speed: number) => void;
  onHeuristicChange: (mode: "MRV_LCV" | "CHRONOLOGICAL") => void;
}

const SPEED_OPTIONS = [
  { label: "0.25x", value: 0.25 },
  { label: "1x", value: 1 },
  { label: "5x", value: 5 },
  { label: "20x", value: 20 },
  { label: "Instant", value: -1 },
];

export const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  playbackState,
  speed,
  heuristicMode,
  onStart,
  onPause,
  onResume,
  onStep,
  onReset,
  onSpeedChange,
  onHeuristicChange,
}) => {
  const isRunning = playbackState === "RUNNING";
  const isIdle = playbackState === "IDLE";
  const isDone = playbackState === "COMPLETED" || playbackState === "UNSATISFIABLE";

  return (
    <div
      style={{
        background: "#0F1612",
        border: "1px solid #1C2B22",
        borderRadius: "8px",
        padding: "10px 14px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "14px",
      }}
    >
      {/* Primary Action Buttons */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {isIdle || isDone ? (
          <button
            onClick={onStart}
            style={{
              background: "#39FF88",
              color: "#0A0E0C",
              border: "1px solid #39FF88",
              borderRadius: "6px",
              padding: "7px 16px",
              fontSize: "12px",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: "6px",
              cursor: "pointer",
              boxShadow: "0 0 12px rgba(57, 255, 136, 0.35)",
              transition: "all 0.15s ease",
              letterSpacing: "0.02em",
            }}
          >
            <Play size={14} fill="#0A0E0C" />
            <span>{isDone ? "RE-ARM SOLVER" : "START CSP SOLVER"}</span>
          </button>
        ) : isRunning ? (
          <button
            onClick={onPause}
            style={{
              background: "#FFB020",
              color: "#0A0E0C",
              border: "1px solid #FFB020",
              borderRadius: "6px",
              padding: "7px 16px",
              fontSize: "12px",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: "6px",
              cursor: "pointer",
              boxShadow: "0 0 10px rgba(255, 176, 32, 0.3)",
            }}
          >
            <Pause size={14} fill="#0A0E0C" />
            <span>PAUSE TRACE</span>
          </button>
        ) : (
          <button
            onClick={onResume}
            style={{
              background: "#39FF88",
              color: "#0A0E0C",
              border: "1px solid #39FF88",
              borderRadius: "6px",
              padding: "7px 16px",
              fontSize: "12px",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: "6px",
              cursor: "pointer",
              boxShadow: "0 0 12px rgba(57, 255, 136, 0.35)",
            }}
          >
            <Play size={14} fill="#0A0E0C" />
            <span>RESUME TRACE</span>
          </button>
        )}

        <button
          onClick={onStep}
          disabled={isRunning || isDone}
          style={{
            background: "#15201A",
            color: isRunning || isDone ? "#4B5A50" : "#EEF8F1",
            border: `1px solid ${isRunning || isDone ? "#1C2B22" : "#2A3F33"}`,
            borderRadius: "6px",
            padding: "7px 12px",
            fontSize: "12px",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "5px",
            cursor: isRunning || isDone ? "not-allowed" : "pointer",
          }}
          title="Step forward 1 decision point"
        >
          <SkipForward size={14} />
          <span>STEP</span>
        </button>

        <button
          onClick={onReset}
          disabled={isIdle}
          style={{
            background: "#15201A",
            color: isIdle ? "#4B5A50" : "#FF3B3B",
            border: `1px solid ${isIdle ? "#1C2B22" : "rgba(255, 59, 59, 0.3)"}`,
            borderRadius: "6px",
            padding: "7px 12px",
            fontSize: "12px",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "5px",
            cursor: isIdle ? "not-allowed" : "pointer",
          }}
          title="Reset search state"
        >
          <RotateCcw size={14} />
          <span>RESET</span>
        </button>
      </div>

      {/* Distinct High-Contrast Search Mode Selector */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "4px", color: "#7A8D80", fontSize: "11px", fontWeight: 600, textTransform: "uppercase" }}>
          <Compass size={13} color="#7A8D80" />
          <span>HEURISTIC:</span>
        </div>
        <div
          style={{
            display: "flex",
            background: "#0A0E0C",
            borderRadius: "6px",
            padding: "2px",
            border: "1px solid #1C2B22",
          }}
        >
          <button
            onClick={() => onHeuristicChange("MRV_LCV")}
            disabled={!isIdle && !isDone}
            style={{
              background: heuristicMode === "MRV_LCV" ? "#39FF88" : "transparent",
              color: heuristicMode === "MRV_LCV" ? "#0A0E0C" : "#7A8D80",
              border: heuristicMode === "MRV_LCV" ? "1px solid #39FF88" : "1px solid transparent",
              borderRadius: "4px",
              padding: "4px 10px",
              fontSize: "11px",
              fontWeight: heuristicMode === "MRV_LCV" ? 700 : 500,
              cursor: !isIdle && !isDone ? "not-allowed" : "pointer",
              boxShadow: heuristicMode === "MRV_LCV" ? "0 0 10px rgba(57, 255, 136, 0.3)" : "none",
              transition: "all 0.15s ease",
            }}
          >
            MRV + LCV (SMART)
          </button>
          <button
            onClick={() => onHeuristicChange("CHRONOLOGICAL")}
            disabled={!isIdle && !isDone}
            style={{
              background: heuristicMode === "CHRONOLOGICAL" ? "#FFB020" : "transparent",
              color: heuristicMode === "CHRONOLOGICAL" ? "#0A0E0C" : "#7A8D80",
              border: heuristicMode === "CHRONOLOGICAL" ? "1px solid #FFB020" : "1px solid transparent",
              borderRadius: "4px",
              padding: "4px 10px",
              fontSize: "11px",
              fontWeight: heuristicMode === "CHRONOLOGICAL" ? 700 : 500,
              cursor: !isIdle && !isDone ? "not-allowed" : "pointer",
              boxShadow: heuristicMode === "CHRONOLOGICAL" ? "0 0 10px rgba(255, 176, 32, 0.3)" : "none",
              transition: "all 0.15s ease",
            }}
          >
            CHRONOLOGICAL (NAIVE)
          </button>
        </div>
      </div>

      {/* Oscilloscope Sweep Speed Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "4px", color: "#7A8D80", fontSize: "11px", fontWeight: 600, textTransform: "uppercase" }}>
          <FastForward size={13} color="#7A8D80" />
          <span>PACING:</span>
        </div>
        <div
          style={{
            display: "flex",
            background: "#0A0E0C",
            borderRadius: "6px",
            padding: "2px",
            border: "1px solid #1C2B22",
          }}
        >
          {SPEED_OPTIONS.map((opt) => {
            const isSelected = speed === opt.value;
            return (
              <button
                key={opt.label}
                onClick={() => onSpeedChange(opt.value)}
                style={{
                  background: isSelected ? "#39FF88" : "transparent",
                  color: isSelected ? "#0A0E0C" : "#7A8D80",
                  border: isSelected ? "1px solid #39FF88" : "1px solid transparent",
                  borderRadius: "4px",
                  padding: "4px 8px",
                  fontSize: "10px",
                  fontWeight: isSelected ? 700 : 500,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

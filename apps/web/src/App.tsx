import React, { useState, useEffect, useMemo } from "react";
import { Constraint } from "@chronos/shared";
import { SolverInput } from "@chronos/solver";
import { useSolverWorker } from "./hooks/useSolverWorker.js";
import { AlgorithmVisualizer } from "./components/AlgorithmVisualizer.js";
import { TimetableGrid } from "./components/TimetableGrid.js";
import { MetricsBar } from "./components/MetricsBar.js";
import { PlaybackControls } from "./components/PlaybackControls.js";
import { ConstraintStudio } from "./components/ConstraintStudio.js";
import { CheckCircle, XCircle, GitGraph, Calendar, Activity } from "lucide-react";
import confetti from "canvas-confetti";

export const App: React.FC = () => {
  const [dataset, setDataset] = useState<Omit<SolverInput, "constraints"> | null>(null);
  const [activeConstraints, setActiveConstraints] = useState<Constraint[]>([]);
  const [activeTab, setActiveTab] = useState<"TREE" | "GRID">("TREE");
  const [heuristicMode, setHeuristicMode] = useState<"MRV_LCV" | "CHRONOLOGICAL">("MRV_LCV");
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    playbackState,
    metrics,
    assignments,
    searchTree,
    activeNodeId,
    finalSchedule,
    failureReason,
    speed,
    start,
    pause,
    resume,
    step,
    setSpeed,
    reset,
  } = useSolverWorker();

  const API_BASE = import.meta.env.VITE_API_URL || "";

  // Load institutional dataset from PostgreSQL backend
  useEffect(() => {
    fetch(`${API_BASE}/api/data`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setDataset({
          courses: data.courses,
          faculty: data.faculty,
          facultyCourseAssignments: data.facultyCourseAssignments,
          rooms: data.rooms,
          divisions: data.divisions,
          timeSlots: data.timeSlots,
        });
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load institutional dataset:", err);
        setApiError(err.message || "Failed to connect to backend");
        setIsLoading(false);
      });
  }, []);

  const totalVariables = useMemo(() => {
    if (!dataset) return 46;
    const totalWeeklyHours = dataset.courses.reduce((acc: number, c: { weeklyHours: number }) => acc + c.weeklyHours, 0);
    return totalWeeklyHours * (dataset.divisions.length || 2);
  }, [dataset]);

  const divisionNames = useMemo(() => {
    if (!dataset) return ["5A15-1", "5A15-2"];
    return dataset.divisions.map((d: { name: string }) => d.name);
  }, [dataset]);

  // Victory celebration when solution is found
  useEffect(() => {
    if (playbackState === "COMPLETED") {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#39FF88", "#10b981", "#FFB020", "#38bdf8"],
      });
    }
  }, [playbackState]);

  const handleStartSolve = () => {
    if (!dataset) return;
    const problem: SolverInput = {
      ...dataset,
      constraints: activeConstraints,
    };
    // Use 2,500 backtracks for Naive Chronological mode in browser demo for fast resolution
    const maxBacktracks = heuristicMode === "CHRONOLOGICAL" ? 2500 : 100_000;
    start(problem, { heuristicMode, maxBacktracks });
  };

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "#0A0E0C",
          color: "#EEF8F1",
          fontFamily: "'JetBrains Mono', monospace",
          gap: "16px",
        }}
      >
        <Activity size={36} color="#39FF88" className="animate-spin" />
        <span style={{ fontSize: "14px", fontWeight: 700, color: "#39FF88", letterSpacing: "0.08em" }}>
          INITIALIZING CHRONOS OSCILLOSCOPE ENGINE...
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0A0E0C",
        color: "#EEF8F1",
        fontFamily: "'JetBrains Mono', 'IBM Plex Mono', monospace",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Top Laboratory Header Bar */}
      <header
        style={{
          borderBottom: "1px solid #1C2B22",
          background: "rgba(15, 22, 18, 0.95)",
          backdropFilter: "blur(12px)",
          padding: "10px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              background: "#15201A",
              border: "1px solid #39FF88",
              width: "34px",
              height: "34px",
              borderRadius: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 10px rgba(57, 255, 136, 0.3)",
            }}
          >
            <Activity size={18} color="#39FF88" />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "16px", fontWeight: 800, letterSpacing: "0.04em", color: "#EEF8F1" }}>
                CHRONOS
              </span>
              <span
                style={{
                  fontSize: "10px",
                  background: "rgba(57, 255, 136, 0.12)",
                  color: "#39FF88",
                  padding: "1px 6px",
                  borderRadius: "3px",
                  fontWeight: 700,
                  border: "1px solid rgba(57, 255, 136, 0.3)",
                }}
              >
                CSP // OSCILLOSCOPE v2.0
              </span>
            </div>
            <span style={{ fontSize: "11px", color: "#7A8D80" }}>
              XYZ Institute of Technology // Real-Time Academic CSP Engine
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "#7A8D80" }}>
            <span
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: apiError ? "#FF3B3B" : "#39FF88",
                boxShadow: apiError ? "0 0 6px #FF3B3B" : "0 0 6px #39FF88",
              }}
            />
            <span>{apiError ? "BACKEND OFFLINE" : "DB CONNECTED [POSTGRESQL]"}</span>
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main
        style={{
          flex: 1,
          padding: "18px 24px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
          maxWidth: "1800px",
          margin: "0 auto",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {/* Status Alert Banner */}
        {playbackState === "COMPLETED" && (
          <div
            style={{
              background: "rgba(57, 255, 136, 0.08)",
              border: "1px solid #39FF88",
              borderRadius: "6px",
              padding: "10px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              color: "#39FF88",
              boxShadow: "0 0 14px rgba(57, 255, 136, 0.15)",
              animation: "fadeIn 0.2s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <CheckCircle size={18} color="#39FF88" />
              <span style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.02em" }}>
                FEASIBLE SCHEDULE FOUND // All {finalSchedule.length} session units scheduled across {divisionNames.length} divisions with 0 violations.
              </span>
            </div>
            <span style={{ fontSize: "11px", color: "#EEF8F1" }}>
              Resolved in {metrics.timeMs.toFixed(1)} ms ({metrics.nodesExplored} nodes explored, {metrics.backtrackCount} backtracks)
            </span>
          </div>
        )}

        {playbackState === "UNSATISFIABLE" && (
          <div
            style={{
              background: "rgba(255, 59, 59, 0.08)",
              border: "1px solid #FF3B3B",
              borderRadius: "6px",
              padding: "10px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              color: "#FF3B3B",
              boxShadow: "0 0 14px rgba(255, 59, 59, 0.15)",
              animation: "fadeIn 0.2s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <XCircle size={18} color="#FF3B3B" />
              <span style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.02em" }}>
                BOUNDED SEARCH LIMIT // {failureReason || "All candidate branches exhausted without a legal assignment."}
              </span>
            </div>
            <span style={{ fontSize: "11px", color: "#EEF8F1" }}>
              Explored {metrics.nodesExplored.toLocaleString()} nodes ({metrics.backtrackCount.toLocaleString()} backtracks)
            </span>
          </div>
        )}

        {/* Telemetry Metrics Bar */}
        <MetricsBar
          metrics={metrics}
          totalVariables={totalVariables}
        />

        {/* Playback & Algorithm Controls */}
        <PlaybackControls
          playbackState={playbackState}
          speed={speed}
          heuristicMode={heuristicMode}
          onStart={handleStartSolve}
          onPause={pause}
          onResume={resume}
          onStep={step}
          onReset={reset}
          onSpeedChange={setSpeed}
          onHeuristicChange={setHeuristicMode}
        />

        {/* Split Visualizer & Constraint Studio Layout */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) 390px",
            gap: "14px",
            flex: 1,
            minHeight: "560px",
          }}
        >
          {/* Visualizer Area */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              height: "100%",
            }}
          >
            {/* Tab Selector */}
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => setActiveTab("TREE")}
                style={{
                  background: activeTab === "TREE" ? "#15201A" : "transparent",
                  color: activeTab === "TREE" ? "#39FF88" : "#7A8D80",
                  border: `1px solid ${activeTab === "TREE" ? "#39FF88" : "transparent"}`,
                  borderRadius: "6px",
                  padding: "7px 14px",
                  fontSize: "12px",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  cursor: "pointer",
                  boxShadow: activeTab === "TREE" ? "0 0 10px rgba(57, 255, 136, 0.2)" : "none",
                  transition: "all 0.15s ease",
                }}
              >
                <GitGraph size={14} />
                <span>SEARCH TREE EXPLORER (D3)</span>
              </button>

              <button
                onClick={() => setActiveTab("GRID")}
                style={{
                  background: activeTab === "GRID" ? "#15201A" : "transparent",
                  color: activeTab === "GRID" ? "#39FF88" : "#7A8D80",
                  border: `1px solid ${activeTab === "GRID" ? "#39FF88" : "transparent"}`,
                  borderRadius: "6px",
                  padding: "7px 14px",
                  fontSize: "12px",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  cursor: "pointer",
                  boxShadow: activeTab === "GRID" ? "0 0 10px rgba(57, 255, 136, 0.2)" : "none",
                  transition: "all 0.15s ease",
                }}
              >
                <Calendar size={14} />
                <span>LIVE MATRIX ({assignments.size}/{totalVariables})</span>
              </button>
            </div>

            {/* Tab Content */}
            <div style={{ flex: 1, minHeight: "500px" }}>
              {activeTab === "TREE" ? (
                <AlgorithmVisualizer
                  treeData={searchTree}
                  activeNodeId={activeNodeId}
                  playbackState={playbackState}
                />
              ) : (
                <TimetableGrid
                  assignments={assignments}
                  divisions={divisionNames}
                />
              )}
            </div>
          </div>

          {/* Right Sidebar: Constraint Studio */}
          <div style={{ height: "100%" }}>
            <ConstraintStudio
              constraints={activeConstraints}
              onConstraintsChange={setActiveConstraints}
              disabled={playbackState === "RUNNING"}
            />
          </div>
        </div>
      </main>
    </div>
  );
};
export default App;

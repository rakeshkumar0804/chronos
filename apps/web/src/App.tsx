import React, { useState, useEffect, useMemo } from "react";
import { Constraint } from "@chronos/shared";
import { SolverInput } from "@chronos/solver";
import { useSolverWorker } from "./hooks/useSolverWorker.js";
import { AlgorithmVisualizer } from "./components/AlgorithmVisualizer.js";
import { TimetableGrid } from "./components/TimetableGrid.js";
import { MetricsBar } from "./components/MetricsBar.js";
import { PlaybackControls } from "./components/PlaybackControls.js";
import { ConstraintStudio } from "./components/ConstraintStudio.js";
import { CheckCircle, XCircle, GitGraph, Calendar, Activity, AlertTriangle } from "lucide-react";
import confetti from "canvas-confetti";

import { QuickAddPanel } from "./components/QuickAddPanel.js";
import { FALLBACK_DATASET } from "./data/fallbackDataset.js";
import { getVisitorWorkspaceId, XYZ_INSTITUTE_WORKSPACE } from "./utils/workspace.js";

export const App: React.FC = () => {
  const [workspace, setWorkspace] = useState<"INSTITUTIONAL" | "CUSTOM">("INSTITUTIONAL");
  const [visitorWsId] = useState<string>(() => getVisitorWorkspaceId());

  const [dataset, setDataset] = useState<Omit<SolverInput, "constraints">>(FALLBACK_DATASET);
  const [activeConstraints, setActiveConstraints] = useState<Constraint[]>([]);
  const [activeTab, setActiveTab] = useState<"TREE" | "GRID">("TREE");
  const [heuristicMode, setHeuristicMode] = useState<"MRV_LCV" | "CHRONOLOGICAL">("MRV_LCV");
  const [isLoading, setIsLoading] = useState(false);
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

  const API_BASE = import.meta.env.VITE_API_URL || "https://chronos-p8hf.onrender.com";

  const fetchData = (targetWorkspace: "INSTITUTIONAL" | "CUSTOM" = workspace) => {
    const wsHeader = targetWorkspace === "INSTITUTIONAL" ? XYZ_INSTITUTE_WORKSPACE : visitorWsId;
    fetch(`${API_BASE}/api/data`, {
      headers: {
        "X-Workspace-Id": wsHeader,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setDataset({
          courses: data.courses || [],
          faculty: data.faculty || [],
          facultyCourseAssignments: data.facultyCourseAssignments || [],
          rooms: data.rooms || [],
          divisions: data.divisions || FALLBACK_DATASET.divisions,
          timeSlots: data.timeSlots || FALLBACK_DATASET.timeSlots,
        });
        setApiError(null);
        setIsLoading(false);
      })
      .catch((err) => {
        console.warn("Backend sync pending (Render cold-start or offline):", err.message);
        setApiError(err.message || "Connecting to live backend...");
        setIsLoading(false);
      });
  };

  // Re-fetch and reset tree when active workspace changes
  useEffect(() => {
    const rootName =
      workspace === "INSTITUTIONAL"
        ? "XYZ Institute CSP Root (46 Sessions)"
        : `My Workspace CSP Root (${activeDataset.courses.length} Courses, ${totalVariables} Sessions)`;
    reset(rootName);
    fetchData(workspace);
  }, [workspace]);

  // Active dataset is strictly scoped to the active workspace
  const activeDataset = useMemo(() => {
    if (workspace === "INSTITUTIONAL") {
      return {
        courses: dataset.courses.filter(
          (c: any) => c.workspaceId === XYZ_INSTITUTE_WORKSPACE || (!c.workspaceId && !c.isCustom)
        ),
        faculty: dataset.faculty.filter(
          (f: any) => f.workspaceId === XYZ_INSTITUTE_WORKSPACE || (!f.workspaceId && !f.isCustom)
        ),
        facultyCourseAssignments: dataset.facultyCourseAssignments.filter(
          (a: any) => a.workspaceId === XYZ_INSTITUTE_WORKSPACE || (!a.workspaceId && !a.isCustom)
        ),
        rooms: dataset.rooms.filter(
          (r: any) => r.workspaceId === XYZ_INSTITUTE_WORKSPACE || (!r.workspaceId && !r.isCustom)
        ),
        divisions: dataset.divisions && dataset.divisions.length > 0 ? dataset.divisions : FALLBACK_DATASET.divisions,
        timeSlots: dataset.timeSlots && dataset.timeSlots.length > 0 ? dataset.timeSlots : FALLBACK_DATASET.timeSlots,
      };
    }

    // STRICT ISOLATION FOR VISITOR WORKSPACE
    const customCourses = dataset.courses.filter(
      (c: any) => c.workspaceId === visitorWsId || (c.isCustom && c.workspaceId !== XYZ_INSTITUTE_WORKSPACE)
    );
    const customCourseIds = new Set(customCourses.map((c: any) => c.id));

    const customAssignments = dataset.facultyCourseAssignments.filter(
      (a: any) => a.workspaceId === visitorWsId || customCourseIds.has(a.courseId)
    );
    const assignedFacultyIds = new Set(customAssignments.map((a: any) => a.facultyId));

    const customFaculty = dataset.faculty.filter(
      (f: any) => f.workspaceId === visitorWsId || assignedFacultyIds.has(f.id) || f.isCustom
    );

    const customRooms = dataset.rooms.filter(
      (r: any) => r.workspaceId === visitorWsId || (r.isCustom && r.workspaceId !== XYZ_INSTITUTE_WORKSPACE)
    );

    return {
      courses: customCourses,
      faculty: customFaculty.length > 0 ? customFaculty : dataset.faculty,
      facultyCourseAssignments: customAssignments,
      rooms: customRooms.length > 0 ? customRooms : FALLBACK_DATASET.rooms,
      divisions: dataset.divisions && dataset.divisions.length > 0 ? dataset.divisions : FALLBACK_DATASET.divisions,
      timeSlots: dataset.timeSlots && dataset.timeSlots.length > 0 ? dataset.timeSlots : FALLBACK_DATASET.timeSlots,
    };
  }, [dataset, workspace, visitorWsId]);

  const totalVariables = useMemo(() => {
    const totalWeeklyHours = activeDataset.courses.reduce((acc: number, c: { weeklyHours: number }) => acc + c.weeklyHours, 0);
    return totalWeeklyHours * (activeDataset.divisions.length || 2);
  }, [activeDataset]);

  const divisionNames = useMemo(() => {
    return activeDataset.divisions.map((d: { name: string }) => d.name);
  }, [activeDataset]);

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
    if (activeDataset.courses.length === 0) {
      alert("Your Private Workspace currently has 0 courses! Use the '+ COURSE' panel on the right to inject courses before running the solver.");
      return;
    }

    const rootName =
      workspace === "INSTITUTIONAL"
        ? "XYZ Institute CSP Root (46 Sessions)"
        : `My Workspace CSP Root (${activeDataset.courses.length} Courses, ${totalVariables} Sessions)`;

    const problem: SolverInput = {
      ...activeDataset,
      constraints: activeConstraints,
    };
    // Use 1,000 backtracks cap for Naive Chronological mode (calibrated for exact 2,328 backtracks benchmark limit)
    const maxBacktracks = heuristicMode === "CHRONOLOGICAL" ? 1000 : 100_000;
    start(problem, { heuristicMode, maxBacktracks }, rootName);
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

        {/* Workspace Selector & Status */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {/* Workspace Toggle */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: "#080C0A",
              border: "1px solid #1C2B22",
              borderRadius: "6px",
              padding: "2px",
              gap: "2px",
            }}
          >
            <button
              onClick={() => setWorkspace("INSTITUTIONAL")}
              style={{
                background: workspace === "INSTITUTIONAL" ? "#1A2B20" : "transparent",
                color: workspace === "INSTITUTIONAL" ? "#39FF88" : "#7A8D80",
                border: workspace === "INSTITUTIONAL" ? "1px solid #39FF88" : "1px solid transparent",
                borderRadius: "4px",
                padding: "4px 10px",
                fontSize: "10px",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "5px",
                transition: "all 0.15s ease",
              }}
              title="Official protected institutional benchmark (46 sessions)"
            >
              <span>🏛️ XYZ INSTITUTE</span>
              <span style={{ fontSize: "9px", background: "rgba(57, 255, 136, 0.15)", padding: "1px 4px", borderRadius: "3px" }}>
                BENCHMARK
              </span>
            </button>

            <button
              onClick={() => setWorkspace("CUSTOM")}
              style={{
                background: workspace === "CUSTOM" ? "#1A2B20" : "transparent",
                color: workspace === "CUSTOM" ? "#39FF88" : "#7A8D80",
                border: workspace === "CUSTOM" ? "1px solid #39FF88" : "1px solid transparent",
                borderRadius: "4px",
                padding: "4px 10px",
                fontSize: "10px",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "5px",
                transition: "all 0.15s ease",
              }}
              title={`Private isolated sandbox (${visitorWsId}) containing your custom injected entities`}
            >
              <span>🧪 MY WORKSPACE</span>
              <span style={{ fontSize: "9px", background: "rgba(57, 255, 136, 0.15)", padding: "1px 4px", borderRadius: "3px" }}>
                {totalVariables} SESSIONS
              </span>
            </button>
          </div>

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
        {/* Active Target Banner */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "#0A0E0C",
            border: "1px solid #1C2B22",
            padding: "8px 16px",
            borderRadius: "6px",
            fontSize: "10px",
            color: "#7A8D80",
            flexWrap: "wrap",
            gap: "8px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ color: "#39FF88", fontWeight: 700 }}>● TARGET WORKSPACE:</span>
            <span style={{ color: "#EEF8F1", fontWeight: 800, letterSpacing: "0.02em" }}>
              {workspace === "INSTITUTIONAL" ? "🏛️ XYZ INSTITUTE (PROTECTED BENCHMARK)" : `🧪 MY PRIVATE WORKSPACE (${visitorWsId})`}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "16px", fontSize: "10px" }}>
            <span>COURSES: <strong style={{ color: "#39FF88" }}>{activeDataset.courses.length}</strong></span>
            <span>SCHEDULABLE SESSIONS: <strong style={{ color: "#39FF88" }}>{totalVariables}</strong></span>
            <span>FACULTY: <strong style={{ color: "#39FF88" }}>{activeDataset.faculty.length}</strong></span>
            <span>ROOMS: <strong style={{ color: "#39FF88" }}>{activeDataset.rooms.length}</strong></span>
          </div>
        </div>

        {/* Warning if My Workspace is empty */}
        {workspace === "CUSTOM" && activeDataset.courses.length === 0 && (
          <div
            style={{
              background: "rgba(255, 176, 32, 0.08)",
              border: "1px dashed #FFB020",
              borderRadius: "6px",
              padding: "10px 16px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: "#FFB020",
              fontSize: "10.5px",
              fontWeight: 600,
            }}
          >
            <AlertTriangle size={16} />
            <span>
              MY WORKSPACE HAS 0 COURSES INJECTED (0 SESSIONS). Use the <strong>+ COURSE</strong> panel on the right to inject courses, then click <strong>START CSP SOLVER</strong>.
            </span>
          </div>
        )}

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
          onReset={() => {
            const rootName =
              workspace === "INSTITUTIONAL"
                ? "XYZ Institute CSP Root (46 Sessions)"
                : `My Workspace CSP Root (${activeDataset.courses.length} Courses, ${totalVariables} Sessions)`;
            reset(rootName);
          }}
          onSpeedChange={setSpeed}
          onHeuristicChange={setHeuristicMode}
        />

        {/* Workspace Central Split Layout: Visualizer/Matrix & Studios */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 420px",
            gap: "14px",
            flex: 1,
            minHeight: "600px",
          }}
        >
          {/* Left Column: Tabbed Visualizer & Timetable Matrix */}
          <div
            style={{
              background: "#0F1612",
              border: "1px solid #1C2B22",
              borderRadius: "8px",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* View Tab Selector Bar */}
            <div
              style={{
                borderBottom: "1px solid #1C2B22",
                padding: "8px 16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "rgba(10, 14, 12, 0.6)",
              }}
            >
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  onClick={() => setActiveTab("TREE")}
                  style={{
                    background: activeTab === "TREE" ? "#1A2B20" : "transparent",
                    color: activeTab === "TREE" ? "#39FF88" : "#7A8D80",
                    border: activeTab === "TREE" ? "1px solid #39FF88" : "1px solid transparent",
                    borderRadius: "4px",
                    padding: "5px 12px",
                    fontSize: "11px",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    transition: "all 0.15s ease",
                  }}
                >
                  <GitGraph size={13} />
                  <span>SEARCH TREE VISUALIZER</span>
                </button>

                <button
                  onClick={() => setActiveTab("GRID")}
                  style={{
                    background: activeTab === "GRID" ? "#1A2B20" : "transparent",
                    color: activeTab === "GRID" ? "#39FF88" : "#7A8D80",
                    border: activeTab === "GRID" ? "1px solid #39FF88" : "1px solid transparent",
                    borderRadius: "4px",
                    padding: "5px 12px",
                    fontSize: "11px",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    transition: "all 0.15s ease",
                  }}
                >
                  <Calendar size={13} />
                  <span>TIMETABLE MATRIX</span>
                </button>
              </div>

              <span style={{ fontSize: "10px", color: "#4A5D50" }}>
                {activeTab === "TREE" ? "D3.JS FORCE HIERARCHY" : "PERIODIC GRID VIEW"}
              </span>
            </div>

            {/* Main Visualizer Container */}
            <div style={{ flex: 1, position: "relative", minHeight: "520px" }}>
              {activeTab === "TREE" ? (
                <AlgorithmVisualizer
                  treeData={searchTree}
                  activeNodeId={activeNodeId}
                  playbackState={playbackState}
                />
              ) : (
                <TimetableGrid
                  divisions={divisionNames}
                  assignments={assignments}
                />
              )}
            </div>
          </div>

          {/* Right Column: Natural Language Studio & Quick Add Panel */}
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <ConstraintStudio
              constraints={activeConstraints}
              onConstraintsChange={setActiveConstraints}
              disabled={playbackState === "RUNNING"}
            />

            <QuickAddPanel
              facultyList={activeDataset.faculty}
              roomList={activeDataset.rooms}
              courseList={activeDataset.courses}
              onDataRefreshed={() => fetchData(workspace)}
              disabled={playbackState === "RUNNING"}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;

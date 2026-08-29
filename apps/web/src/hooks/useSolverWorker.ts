import { useEffect, useRef, useState, useCallback } from "react";
import {
  SolverInput,
  SolverOptions,
  SolverStats,
  ScheduleEntry,
  DomainAssignmentValue,
} from "@chronos/solver";
import { WorkerInMessage, WorkerOutMessage } from "../workers/solver.worker.js";

export interface ActiveAssignment {
  variableId: string;
  courseShortCode: string;
  divisionName: string;
  sessionIndex: number;
  value: DomainAssignmentValue;
}

export interface ConflictRecord {
  variableId: string;
  conflictingConstraint: string;
  conflictWith: string;
  timestamp: number;
}

export interface VisualizerNode {
  id: string;
  name: string;
  variableId?: string;
  status: "ACTIVE" | "SUCCESS" | "CONFLICT" | "PRUNED" | "ROOT";
  valueSummary?: string;
  conflictReason?: string;
  children: VisualizerNode[];
  depth: number;
}

export function useSolverWorker() {
  const workerRef = useRef<Worker | null>(null);

  const [playbackState, setPlaybackState] = useState<
    "IDLE" | "RUNNING" | "PAUSED" | "COMPLETED" | "UNSATISFIABLE"
  >("IDLE");

  const [metrics, setMetrics] = useState<SolverStats>({
    nodesExplored: 0,
    backtrackCount: 0,
    domainsPruned: 0,
    maxDepth: 0,
    timeMs: 0,
  });

  const [assignments, setAssignments] = useState<Map<string, ActiveAssignment>>(new Map());
  const [activeConflicts, setActiveConflicts] = useState<ConflictRecord[]>([]);
  const [finalSchedule, setFinalSchedule] = useState<ScheduleEntry[]>([]);
  const [failureReason, setFailureReason] = useState<string | null>(null);
  const [speed, setSpeedState] = useState<number>(1);

  // Persistent Search Tree State
  const treeRootRef = useRef<VisualizerNode>({
    id: "ROOT",
    name: "XYZ Institute CSP Root",
    status: "ROOT",
    depth: 0,
    children: [],
  });
  const activeBranchStackRef = useRef<VisualizerNode[]>([treeRootRef.current]);
  const nodeMapRef = useRef<Map<string, VisualizerNode>>(new Map([["ROOT", treeRootRef.current]]));
  const [searchTree, setSearchTree] = useState<VisualizerNode>(treeRootRef.current);
  const [activeNodeId, setActiveNodeId] = useState<string>("ROOT");

  const resetTree = useCallback((rootName: string = "XYZ Institute CSP Root") => {
    const newRoot: VisualizerNode = {
      id: "ROOT",
      name: rootName,
      status: "ROOT",
      depth: 0,
      children: [],
    };
    treeRootRef.current = newRoot;
    activeBranchStackRef.current = [newRoot];
    nodeMapRef.current = new Map([["ROOT", newRoot]]);
    setSearchTree(newRoot);
    setActiveNodeId("ROOT");
  }, []);

  // Initialize Worker
  useEffect(() => {
    const worker = new Worker(
      new URL("../workers/solver.worker.ts", import.meta.url),
      { type: "module" }
    );
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
      const msg = e.data;

      switch (msg.type) {
        case "STATE_CHANGE": {
          setPlaybackState(msg.state);
          break;
        }

        case "BATCH_EVENTS": {
          setMetrics(msg.metrics);

          // Update Persistent Tree Structure
          const stack = activeBranchStackRef.current;
          const nodeMap = nodeMapRef.current;

          for (const ev of msg.events) {
            if (ev.type === "VARIABLE_SELECTED") {
              const parent = stack[stack.length - 1] || treeRootRef.current;
              const nodeId = `${parent.id}/${ev.variableId}`;

              let existingChild = parent.children.find((c) => c.variableId === ev.variableId);
              if (!existingChild) {
                // Prevent unconstrained horizontal explosion: keep at most 8 branch alternatives per node
                if (parent.children.length < 8) {
                  existingChild = {
                    id: nodeId,
                    name: ev.variableId.replace("VAR_", ""),
                    variableId: ev.variableId,
                    status: "ACTIVE",
                    depth: parent.depth + 1,
                    children: [],
                  };
                  parent.children.push(existingChild);
                  nodeMap.set(nodeId, existingChild);
                }
              }

              if (existingChild) {
                existingChild.status = "ACTIVE";
                stack.push(existingChild);
                setActiveNodeId(existingChild.id);
              }
            } else if (ev.type === "VALUE_TRIED") {
              const curr = stack[stack.length - 1];
              if (curr) {
                curr.valueSummary = `${ev.value.timeSlotDay} ${ev.value.timeSlotStartTime} (Rm ${ev.value.roomNo}, ${ev.value.facultyShortCode})`;
              }
            } else if (ev.type === "ASSIGNMENT_SUCCESS") {
              const curr = stack[stack.length - 1];
              if (curr) {
                curr.status = "SUCCESS";
                curr.valueSummary = `${ev.value.timeSlotDay} ${ev.value.timeSlotStartTime} (Rm ${ev.value.roomNo}, ${ev.value.facultyShortCode})`;
              }
            } else if (ev.type === "CONFLICT_DETECTED") {
              const curr = stack[stack.length - 1];
              if (curr) {
                curr.status = "CONFLICT";
                curr.conflictReason = `${ev.conflictingConstraint} (Collision with ${ev.conflictWith})`;
              }
            } else if (ev.type === "BACKTRACK") {
              const curr = stack[stack.length - 1];
              if (curr) {
                curr.status = "PRUNED";
              }
              if (stack.length > 1) {
                stack.pop();
              }
              const newTop = stack[stack.length - 1];
              if (newTop) {
                setActiveNodeId(newTop.id);
              }
            } else if (ev.type === "SOLUTION_FOUND") {
              for (const node of stack) {
                node.status = "SUCCESS";
              }
            }
          }

          // Trigger tree update
          setSearchTree({ ...treeRootRef.current });

          // Apply state transitions to live assignments
          setAssignments((prev) => {
            const next = new Map(prev);

            for (const ev of msg.events) {
              if (ev.type === "ASSIGNMENT_SUCCESS") {
                const parts = ev.variableId.split("_");
                const div = parts[1] || "";
                const course = parts[2] || "";
                const sIdx = parseInt(parts[3] || "1", 10);

                next.set(ev.variableId, {
                  variableId: ev.variableId,
                  divisionName: div,
                  courseShortCode: course,
                  sessionIndex: sIdx,
                  value: ev.value,
                });
              } else if (ev.type === "BACKTRACK") {
                next.delete(ev.variableId);
              } else if (ev.type === "CONFLICT_DETECTED") {
                setActiveConflicts((cPrev) => [
                  ...cPrev.slice(-20),
                  {
                    variableId: ev.variableId,
                    conflictingConstraint: ev.conflictingConstraint,
                    conflictWith: ev.conflictWith,
                    timestamp: Date.now(),
                  },
                ]);
              }
            }

            return next;
          });
          break;
        }

        case "COMPLETED": {
          setFinalSchedule(msg.result.assignments);
          setMetrics(msg.metrics);
          setPlaybackState("COMPLETED");
          break;
        }

        case "UNSATISFIABLE": {
          setMetrics(msg.metrics);
          setFailureReason(msg.reason || "Search space exhausted without finding a feasible solution.");
          setPlaybackState("UNSATISFIABLE");
          break;
        }

        case "ERROR": {
          console.error("[Solver Worker Error]:", msg.error);
          setFailureReason(msg.error);
          setPlaybackState("IDLE");
          break;
        }
      }
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const start = useCallback((problem: SolverInput, options?: SolverOptions, rootName?: string) => {
    if (!workerRef.current) return;
    resetTree(rootName);
    setAssignments(new Map());
    setActiveConflicts([]);
    setFinalSchedule([]);
    setFailureReason(null);
    setMetrics({ nodesExplored: 0, backtrackCount: 0, domainsPruned: 0, maxDepth: 0, timeMs: 0 });

    const msg: WorkerInMessage = {
      type: "START",
      problem,
      options,
      speed,
    };
    workerRef.current.postMessage(msg);
  }, [speed, resetTree]);

  const pause = useCallback(() => {
    if (!workerRef.current) return;
    workerRef.current.postMessage({ type: "PAUSE" } as WorkerInMessage);
  }, []);

  const resume = useCallback(() => {
    if (!workerRef.current) return;
    workerRef.current.postMessage({ type: "RESUME" } as WorkerInMessage);
  }, []);

  const step = useCallback(() => {
    if (!workerRef.current) return;
    workerRef.current.postMessage({ type: "STEP" } as WorkerInMessage);
  }, []);

  const setSpeed = useCallback((newSpeed: number) => {
    setSpeedState(newSpeed);
    if (!workerRef.current) return;
    workerRef.current.postMessage({ type: "SET_SPEED", speed: newSpeed } as WorkerInMessage);
  }, []);

  const reset = useCallback((rootName?: string) => {
    if (!workerRef.current) return;
    workerRef.current.postMessage({ type: "ABORT" } as WorkerInMessage);
    resetTree(rootName);
    setAssignments(new Map());
    setActiveConflicts([]);
    setFinalSchedule([]);
    setFailureReason(null);
    setMetrics({ nodesExplored: 0, backtrackCount: 0, domainsPruned: 0, maxDepth: 0, timeMs: 0 });
    setPlaybackState("IDLE");
  }, [resetTree]);

  return {
    playbackState,
    metrics,
    assignments,
    searchTree,
    activeNodeId,
    activeConflicts,
    finalSchedule,
    failureReason,
    speed,
    start,
    pause,
    resume,
    step,
    setSpeed,
    reset,
  };
}

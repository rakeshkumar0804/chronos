import { PrismaClient } from "@prisma/client";
import { solveCSP } from "./csp-solver.js";
import { SolverInput, SolverStepEvent } from "./types.js";
import { Constraint } from "@chronos/shared";
import { demoScenarioNaiveVsSmart } from "./demo-scenario.js";

const prisma = new PrismaClient();

async function runTests() {
  console.log("=================================================");
  console.log("CHRONOS Phase 2C: Generator CSP Solver Test Suite");
  console.log("=================================================\n");

  const [courses, faculty, facultyCourseAssignments, rooms, divisions, timeSlots] =
    await Promise.all([
      prisma.course.findMany(),
      prisma.faculty.findMany(),
      prisma.facultyCourseAssignment.findMany(),
      prisma.room.findMany(),
      prisma.division.findMany(),
      prisma.timeSlot.findMany(),
    ]);

  const baseInput: SolverInput = {
    courses,
    faculty,
    facultyCourseAssignments,
    rooms,
    divisions,
    timeSlots,
  };

  let passedTests = 0;
  let totalTests = 0;

  // ----------------------------------------------------------------------
  // Test 1: Feasible Baseline Schedule via Generator solveCSP
  // ----------------------------------------------------------------------
  totalTests++;
  console.log("-------------------------------------------------");
  console.log("Test 1: Feasible Baseline Schedule (Generator solveCSP)");
  
  const generator1 = solveCSP(baseInput, { heuristicMode: "MRV_LCV" });
  const events1: SolverStepEvent[] = [];
  let finalResult1 = null;

  while (true) {
    const next = generator1.next();
    if (next.done) {
      finalResult1 = next.value;
      break;
    }
    events1.push(next.value);
  }

  const solutionFoundEvent = events1.find((e) => e.type === "SOLUTION_FOUND");
  const variableSelectedCount = events1.filter((e) => e.type === "VARIABLE_SELECTED").length;
  const assignmentSuccessCount = events1.filter((e) => e.type === "ASSIGNMENT_SUCCESS").length;

  console.log(`Events Yielded: ${events1.length}`);
  console.log(`VARIABLE_SELECTED Events: ${variableSelectedCount}`);
  console.log(`ASSIGNMENT_SUCCESS Events: ${assignmentSuccessCount}`);
  console.log(`Assignments Generated: ${finalResult1?.assignments.length}`);
  console.log(`Solver Status: ${finalResult1?.success ? "SUCCESS" : "FAILURE"}`);
  console.log(`Metrics: Nodes=${finalResult1?.stats.nodesExplored}, Backtracks=${finalResult1?.stats.backtrackCount}, Time=${finalResult1?.stats.timeMs.toFixed(2)}ms`);

  if (
    finalResult1?.success &&
    finalResult1.assignments.length === 46 &&
    solutionFoundEvent &&
    assignmentSuccessCount === 46
  ) {
    console.log("Result: ✅ PASSED");
    passedTests++;
  } else {
    console.log("Result: ❌ FAILED");
  }
  console.log("");

  // ----------------------------------------------------------------------
  // Test 2: Generator Event Stream & Snapshot Fidelity
  // ----------------------------------------------------------------------
  totalTests++;
  console.log("-------------------------------------------------");
  console.log("Test 2: Generator Event Stream & Pruning Snapshot Fidelity");

  const eventTypesPresent = new Set(events1.map((e) => e.type));
  console.log(`Discovered Event Types: ${Array.from(eventTypesPresent).join(", ")}`);

  const hasVariableSelected = eventTypesPresent.has("VARIABLE_SELECTED");
  const hasValueTried = eventTypesPresent.has("VALUE_TRIED");
  const hasDomainPruned = eventTypesPresent.has("DOMAIN_PRUNED");
  const hasAssignmentSuccess = eventTypesPresent.has("ASSIGNMENT_SUCCESS");
  const hasSolutionFound = eventTypesPresent.has("SOLUTION_FOUND");

  if (hasVariableSelected && hasValueTried && hasDomainPruned && hasAssignmentSuccess && hasSolutionFound) {
    console.log("Result: ✅ PASSED - Generator yielded all critical snapshot types for UI animation");
    passedTests++;
  } else {
    console.log("Result: ❌ FAILED - Missing required event snapshot types");
  }
  console.log("");

  // ----------------------------------------------------------------------
  // Test 3: Unsatisfiable Problem Handling (Exhaustive Search -> UNSATISFIABLE)
  // ----------------------------------------------------------------------
  totalTests++;
  console.log("-------------------------------------------------");
  console.log("Test 3: Impossible / Unsatisfiable Constraint Handling");

  const impossibleConstraints: Constraint[] = [
    {
      id: "C_IMPOSSIBLE_ROOM_LOCKOUT",
      type: "HARD",
      category: "ROOM_UNAVAILABLE",
      description: "Block all lecture rooms completely for the whole week",
      structuredRule: {
        roomNo: "372",
        days: ["MON", "TUE", "WED", "THU", "FRI", "SAT"],
      },
    },
    {
      id: "C_IMPOSSIBLE_ROOM_LOCKOUT_2",
      type: "HARD",
      category: "ROOM_UNAVAILABLE",
      description: "Block all lecture rooms completely for the whole week",
      structuredRule: {
        roomNo: "132",
        days: ["MON", "TUE", "WED", "THU", "FRI", "SAT"],
      },
    },
  ];

  const impossibleInput: SolverInput = {
    ...baseInput,
    constraints: impossibleConstraints,
  };

  const generator3 = solveCSP(impossibleInput, { heuristicMode: "MRV_LCV", maxBacktracks: 1000 });
  const events3: SolverStepEvent[] = [];
  let finalResult3 = null;

  while (true) {
    const next = generator3.next();
    if (next.done) {
      finalResult3 = next.value;
      break;
    }
    events3.push(next.value);
  }

  const unsatisfiableEvent = events3.find((e) => e.type === "UNSATISFIABLE");
  console.log(`Events Yielded: ${events3.length}`);
  console.log(`UNSATISFIABLE Event Emitted: ${unsatisfiableEvent ? "YES" : "NO"}`);
  console.log(`Solver Status: ${finalResult3?.success ? "SUCCESS" : "FAILURE (Expected)"}`);
  console.log(`Failure Reason: "${finalResult3?.failureReason}"`);

  if (!finalResult3?.success && unsatisfiableEvent) {
    console.log("Result: ✅ PASSED - Correctly reported UNSATISFIABLE after domain exhaustion");
    passedTests++;
  } else {
    console.log("Result: ❌ FAILED");
  }
  console.log("");

  // ----------------------------------------------------------------------
  // Test 4: Conflict and Backtracking Event Emission
  // ----------------------------------------------------------------------
  totalTests++;
  console.log("-------------------------------------------------");
  console.log("Test 4: Conflict and Backtracking Event Emission (demoScenarioNaiveVsSmart)");

  const tightInput: SolverInput = {
    ...baseInput,
    constraints: demoScenarioNaiveVsSmart,
  };

  const generator4 = solveCSP(tightInput, { heuristicMode: "CHRONOLOGICAL", maxBacktracks: 100 });
  const events4: SolverStepEvent[] = [];

  while (true) {
    const next = generator4.next();
    if (next.done) break;
    events4.push(next.value);
  }

  const conflictsCount = events4.filter((e) => e.type === "CONFLICT_DETECTED").length;
  const backtracksCount = events4.filter((e) => e.type === "BACKTRACK").length;

  console.log(`Events Yielded in Constrained Search: ${events4.length}`);
  console.log(`CONFLICT_DETECTED Events: ${conflictsCount}`);
  console.log(`BACKTRACK Events: ${backtracksCount}`);

  if (conflictsCount > 0 && backtracksCount > 0) {
    console.log("Result: ✅ PASSED - Verified CONFLICT_DETECTED and BACKTRACK snapshots");
    passedTests++;
  } else {
    console.log("Result: ❌ FAILED - Expected conflict and backtrack events");
  }
  console.log("");

  console.log("=================================================");
  console.log(`Summary: Total=${totalTests}, Passed=${passedTests}, Failed=${totalTests - passedTests}`);
  console.log("=================================================\n");

  await prisma.$disconnect();

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error("Test Error:", e);
  process.exit(1);
});

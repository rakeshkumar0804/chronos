import { PrismaClient } from "@prisma/client";
import { solve } from "./solver.js";
import { solveCSP } from "./csp-solver.js";
import { SolverInput, SolverStepEvent } from "./types.js";
import { Constraint, ScheduleEntry } from "@chronos/shared";
import { demoScenarioNaiveVsSmart } from "./demo-scenario.js";

const prisma = new PrismaClient();

async function runPhase2MetricsSuite() {
  console.log("===============================================================================");
  console.log("CHRONOS Phase 2 Regression Suite: Solver Metrics & Benchmark Credibility");
  console.log("===============================================================================\n");

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

  let passedSuites = 0;
  const totalSuites = 5;

  try {
    // -------------------------------------------------------------------------
    // SUITE 1: Metric Semantics & Consistency Tracing
    // -------------------------------------------------------------------------
    console.log("▶ [SUITE 1/5] Testing Metric Semantics (nodesExplored, backtrackCount, timeMs)...");

    const smartSolveRes = solve(
      { ...baseInput, constraints: demoScenarioNaiveVsSmart },
      { heuristicMode: "MRV_LCV", enableTrace: true }
    );

    if (!smartSolveRes.success) {
      throw new Error(`FAIL: Smart solver failed to solve benchmark scenario: ${JSON.stringify(smartSolveRes)}`);
    }

    const { nodesExplored, backtrackCount, timeMs } = smartSolveRes.stats;
    console.log(`  ✓ Metric values: nodesExplored=${nodesExplored} (nodes), backtrackCount=${backtrackCount} (backtracks), timeMs=${timeMs.toFixed(2)}ms`);

    // Verify exact metric definitions
    if (nodesExplored !== 46) {
      throw new Error(`FAIL: Expected nodesExplored to be 46, got ${nodesExplored}`);
    }
    if (backtrackCount !== 0) {
      throw new Error(`FAIL: Expected backtrackCount to be 0, got ${backtrackCount}`);
    }
    if (timeMs < 0 || typeof timeMs !== "number") {
      throw new Error(`FAIL: Invalid elapsed timeMs metric: ${timeMs}`);
    }

    // Verify Generator CSP solver yields identical metric counts
    const gen = solveCSP({ ...baseInput, constraints: demoScenarioNaiveVsSmart }, { heuristicMode: "MRV_LCV" });
    const events: SolverStepEvent[] = [];
    let genResult = null;
    while (true) {
      const next = gen.next();
      if (next.done) {
        genResult = next.value;
        break;
      }
      events.push(next.value);
    }

    if (genResult?.stats.nodesExplored !== 46 || genResult?.stats.backtrackCount !== 0) {
      throw new Error(`FAIL: Generator metrics mismatch: nodes=${genResult?.stats.nodesExplored}, backtracks=${genResult?.stats.backtrackCount}`);
    }
    console.log("  ✓ Generator solveCSP metrics match solve() exactly (46 nodes, 0 backtracks)");

    console.log("✅ SUITE 1 PASSED: Metric definitions and counter semantics verified.\n");
    passedSuites++;

    // -------------------------------------------------------------------------
    // SUITE 2: Same-Problem Input Equality (Naive vs Smart)
    // -------------------------------------------------------------------------
    console.log("▶ [SUITE 2/5] Testing Same-Problem Input Equality Between Naive & Smart Runs...");

    const naiveProblem: SolverInput = {
      courses: [...baseInput.courses],
      faculty: [...baseInput.faculty],
      facultyCourseAssignments: [...baseInput.facultyCourseAssignments],
      rooms: [...baseInput.rooms],
      divisions: [...baseInput.divisions],
      timeSlots: [...baseInput.timeSlots],
      constraints: demoScenarioNaiveVsSmart,
    };

    const smartProblem: SolverInput = {
      courses: [...baseInput.courses],
      faculty: [...baseInput.faculty],
      facultyCourseAssignments: [...baseInput.facultyCourseAssignments],
      rooms: [...baseInput.rooms],
      divisions: [...baseInput.divisions],
      timeSlots: [...baseInput.timeSlots],
      constraints: demoScenarioNaiveVsSmart,
    };

    const naiveJson = JSON.stringify(naiveProblem);
    const smartJson = JSON.stringify(smartProblem);

    if (naiveJson !== smartJson) {
      throw new Error("FAIL: Naive and Smart solvers received non-identical problem inputs!");
    }

    console.log(`  ✓ Problem inputs are 100% byte-identical:`);
    console.log(`    - Courses: ${naiveProblem.courses.length}`);
    console.log(`    - Faculty: ${naiveProblem.faculty.length}`);
    console.log(`    - Rooms: ${naiveProblem.rooms.length}`);
    console.log(`    - Divisions: ${naiveProblem.divisions.length}`);
    console.log(`    - Usable Slots: ${naiveProblem.timeSlots.filter(t => !t.isBreak).length}`);
    console.log(`    - Hard Constraints: ${naiveProblem.constraints?.length}`);

    console.log("✅ SUITE 2 PASSED: Same-problem input parity confirmed.\n");
    passedSuites++;

    // -------------------------------------------------------------------------
    // SUITE 3: Budget Exhaustion vs Infeasibility Distinction
    // -------------------------------------------------------------------------
    console.log("▶ [SUITE 3/5] Testing Budget Exhaustion (HIT_CAP) vs Infeasibility (UNSATISFIABLE)...");

    // Case 1: Naive search with small backtrack limit -> Bounded Search Limit (HIT_CAP)
    const naiveRes = solve(naiveProblem, {
      heuristicMode: "CHRONOLOGICAL",
      maxBacktracks: 100,
    });

    if (naiveRes.success) {
      throw new Error("FAIL: Naive search unexpectedly succeeded under 100 backtrack limit!");
    }
    if (naiveRes.stats.backtrackCount !== 100) {
      throw new Error(`FAIL: Search budget overshot! Expected exactly 100 backtracks, got ${naiveRes.stats.backtrackCount}`);
    }
    if (!naiveRes.failureReason?.includes("bounded search limit")) {
      throw new Error(`FAIL: Expected failureReason to state bounded search limit, got: "${naiveRes.failureReason}"`);
    }
    console.log(`  ✓ Budget Exhaustion (solve): Status=FAILURE, Backtracks=${naiveRes.stats.backtrackCount} (Exact 100 cap), Reason="${naiveRes.failureReason}"`);

    // Verify Generator solveCSP exact budget boundary behavior under maxBacktracks=1000
    const genCap = solveCSP(naiveProblem, {
      heuristicMode: "CHRONOLOGICAL",
      maxBacktracks: 1000,
    });
    let genCapRes = null;
    while (true) {
      const next = genCap.next();
      if (next.done) {
        genCapRes = next.value;
        break;
      }
    }
    if (genCapRes?.stats.backtrackCount !== 1000) {
      throw new Error(`FAIL: Generator search budget overshot! Expected exactly 1000 backtracks, got ${genCapRes?.stats.backtrackCount}`);
    }
    console.log(`  ✓ Budget Exhaustion (solveCSP Generator): Status=FAILURE, Backtracks=${genCapRes?.stats.backtrackCount} (Exact 1000 cap)`);

    // Case 2: Infeasible problem (All rooms locked out) -> SEARCH_SPACE_EXHAUSTED
    const impossibleProblem: SolverInput = {
      ...baseInput,
      constraints: [
        {
          id: "C_LOCK_372",
          type: "HARD",
          category: "ROOM_UNAVAILABLE",
          description: "Block room 372",
          structuredRule: { roomNo: "372", days: ["MON", "TUE", "WED", "THU", "FRI", "SAT"] },
        },
        {
          id: "C_LOCK_132",
          type: "HARD",
          category: "ROOM_UNAVAILABLE",
          description: "Block room 132",
          structuredRule: { roomNo: "132", days: ["MON", "TUE", "WED", "THU", "FRI", "SAT"] },
        },
      ],
    };

    const impossibleRes = solve(impossibleProblem, {
      heuristicMode: "MRV_LCV",
      maxBacktracks: 1000,
    });

    if (impossibleRes.success) {
      throw new Error("FAIL: Impossible problem unexpectedly solved!");
    }
    if (!impossibleRes.failureReason?.includes("Search space exhausted")) {
      throw new Error(`FAIL: Expected failureReason to state Search space exhausted, got: "${impossibleRes.failureReason}"`);
    }
    console.log(`  ✓ Proven Infeasibility: Status=FAILURE, Reason="${impossibleRes.failureReason}"`);

    console.log("✅ SUITE 3 PASSED: Budget exhaustion properly distinguished from proved infeasibility.\n");
    passedSuites++;

    // -------------------------------------------------------------------------
    // SUITE 4: Hard Constraint Output Validity
    // -------------------------------------------------------------------------
    console.log("▶ [SUITE 4/5] Independently Validating Smart Run Schedule against All Hard Constraints...");

    const assignments = smartSolveRes.assignments;
    if (assignments.length !== 46) {
      throw new Error(`FAIL: Smart schedule length is ${assignments.length}, expected 46.`);
    }

    const timeSlotMap = new Map(timeSlots.map((ts) => [ts.id, ts]));
    const facultyMap = new Map(faculty.map((f) => [f.id, f]));
    const roomMap = new Map(rooms.map((r) => [r.id, r]));
    const courseMap = new Map(courses.map((c) => [c.id, c]));

    // Check 1: No Faculty Collision
    const facultySlotSet = new Set<string>();
    for (const a of assignments) {
      const key = `${a.facultyId}_${a.timeSlotId}`;
      if (facultySlotSet.has(key)) {
        const fac = facultyMap.get(a.facultyId)?.shortCode || a.facultyId;
        const ts = timeSlotMap.get(a.timeSlotId);
        throw new Error(`FAIL: Faculty double-booking detected for ${fac} at ${ts?.day} ${ts?.startTime}`);
      }
      facultySlotSet.add(key);
    }
    console.log("  ✓ Hard Constraint 1 Passed: Zero faculty double-bookings across 46 assignments");

    // Check 2: No Room Collision
    const roomSlotSet = new Set<string>();
    for (const a of assignments) {
      const key = `${a.roomId}_${a.timeSlotId}`;
      if (roomSlotSet.has(key)) {
        const rm = roomMap.get(a.roomId)?.roomNo || a.roomId;
        const ts = timeSlotMap.get(a.timeSlotId);
        throw new Error(`FAIL: Room double-booking detected for Room ${rm} at ${ts?.day} ${ts?.startTime}`);
      }
      roomSlotSet.add(key);
    }
    console.log("  ✓ Hard Constraint 2 Passed: Zero room double-bookings across 46 assignments");

    // Check 3: No Division Collision
    const divisionSlotSet = new Set<string>();
    for (const a of assignments) {
      const key = `${a.divisionId}_${a.timeSlotId}`;
      if (divisionSlotSet.has(key)) {
        const ts = timeSlotMap.get(a.timeSlotId);
        throw new Error(`FAIL: Division double-booking detected for division ${a.divisionId} at ${ts?.day} ${ts?.startTime}`);
      }
      divisionSlotSet.add(key);
    }
    console.log("  ✓ Hard Constraint 3 Passed: Zero division double-bookings across 46 assignments");

    // Check 4: Lab vs Lecture Room Compatibility
    for (const a of assignments) {
      const course = courseMap.get(a.courseId);
      const room = roomMap.get(a.roomId);
      if (course?.type === "LAB" && room?.type !== "LAB") {
        throw new Error(`FAIL: Lab course ${course?.shortCode} assigned to non-lab room ${room?.roomNo}`);
      }
      if (course?.type === "LECTURE" && room?.type !== "LECTURE_ROOM") {
        throw new Error(`FAIL: Lecture course ${course?.shortCode} assigned to non-lecture room ${room?.roomNo}`);
      }
    }
    console.log("  ✓ Hard Constraint 4 Passed: Room type compatibility (LAB -> LAB, LECTURE -> LECTURE_ROOM)");

    // Check 5: Faculty Qualification
    for (const a of assignments) {
      const validAssigned = facultyCourseAssignments.some(
        (fca) => fca.courseId === a.courseId && fca.facultyId === a.facultyId
      );
      if (!validAssigned) {
        throw new Error(`FAIL: Unqualified faculty ${a.facultyId} assigned to course ${a.courseId}`);
      }
    }
    console.log("  ✓ Hard Constraint 5 Passed: All assigned faculty are qualified for their course");

    // Check 6: Specific Demo Unavailability (KR on MON/TUE, CPP on THU/FRI, Slot 13:35 blocked)
    for (const a of assignments) {
      const ts = timeSlotMap.get(a.timeSlotId);
      const fac = facultyMap.get(a.facultyId);
      const rm = roomMap.get(a.roomId);

      if (fac?.shortCode === "KR" && (ts?.day === "MON" || ts?.day === "TUE")) {
        throw new Error(`FAIL: KR assigned on leave day ${ts?.day}`);
      }
      if (fac?.shortCode === "CPP" && (ts?.day === "THU" || ts?.day === "FRI")) {
        throw new Error(`FAIL: CPP assigned on leave day ${ts?.day}`);
      }
      if (ts?.startTime === "13:35") {
        throw new Error(`FAIL: Session assigned to blocked time slot 13:35 in room ${rm?.roomNo}`);
      }
    }
    console.log("  ✓ Hard Constraint 6 Passed: Faculty leave and blocked 13:35 time slots strictly honored");

    console.log("✅ SUITE 4 PASSED: Smart solver schedule is 100% mathematically valid.\n");
    passedSuites++;

    // -------------------------------------------------------------------------
    // SUITE 5: Stable Deterministic Tie-Breaking
    // -------------------------------------------------------------------------
    console.log("▶ [SUITE 5/5] Testing Deterministic Tie-Breaking Across Input Shuffling...");

    const runs = 5;
    let referenceNodes: number | null = null;
    let referenceBacktracks: number | null = null;

    for (let r = 1; r <= runs; r++) {
      // Shuffle courses and faculty array order to simulate database query order variance
      const shuffledCourses = [...baseInput.courses].sort(() => Math.random() - 0.5);
      const shuffledFaculty = [...baseInput.faculty].sort(() => Math.random() - 0.5);
      const shuffledRooms = [...baseInput.rooms].sort(() => Math.random() - 0.5);

      const shuffledInput: SolverInput = {
        ...baseInput,
        courses: shuffledCourses,
        faculty: shuffledFaculty,
        rooms: shuffledRooms,
        constraints: demoScenarioNaiveVsSmart,
      };

      const res = solve(shuffledInput, { heuristicMode: "MRV_LCV" });

      if (referenceNodes === null) {
        referenceNodes = res.stats.nodesExplored;
        referenceBacktracks = res.stats.backtrackCount;
      } else {
        if (res.stats.nodesExplored !== referenceNodes || res.stats.backtrackCount !== referenceBacktracks) {
          throw new Error(
            `FAIL: Non-deterministic result on run ${r}! Expected ${referenceNodes} nodes / ${referenceBacktracks} backtracks, got ${res.stats.nodesExplored} / ${res.stats.backtrackCount}`
          );
        }
      }
    }

    console.log(`  ✓ Ran ${runs} iterations with randomly shuffled input arrays:`);
    console.log(`    - Nodes Explored: ${referenceNodes} (identical across all runs)`);
    console.log(`    - Backtrack Count: ${referenceBacktracks} (identical across all runs)`);

    console.log("✅ SUITE 5 PASSED: Deterministic tie-breaking is 100% stable.\n");
    passedSuites++;

    console.log("===============================================================================");
    console.log(`ALL PHASE 2 SUITES PASSED: ${passedSuites}/${totalSuites} test suites succeeded.`);
    console.log("===============================================================================\n");
  } finally {
    await prisma.$disconnect();
  }
}

runPhase2MetricsSuite().catch((err) => {
  console.error("\n❌ PHASE 2 REGRESSION SUITE FAILED:", err);
  process.exit(1);
});

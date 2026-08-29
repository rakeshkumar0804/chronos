import { PrismaClient } from "@prisma/client";
import { solve } from "./solver.js";
import { solveCSP } from "./csp-solver.js";
import { SolverInput, Constraint } from "./types.js";

const prisma = new PrismaClient();

async function run() {
  console.log("=================================================");
  console.log("Testing Base Dataset + Single KR Mon/Tue Constraint");
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

  const singleKRConstraint: Constraint = {
    id: "C_TEST_KR_MON_TUE",
    type: "HARD",
    category: "FACULTY_UNAVAILABLE",
    description: "Prof. Karan Rathi (KR) is unavailable on MON and TUE.",
    structuredRule: {
      facultyShortCode: "KR",
      days: ["MON", "TUE"],
    },
  };

  const problem: SolverInput = {
    courses,
    faculty,
    facultyCourseAssignments,
    rooms,
    divisions,
    timeSlots,
    constraints: [singleKRConstraint],
  };

  console.log("Constraint Payload:");
  console.log(JSON.stringify(singleKRConstraint, null, 2));
  console.log("\n-------------------------------------------------");
  console.log("1. Running Synchronous solver.ts with MRV_LCV:");
  console.log("-------------------------------------------------");

  const t0 = performance.now();
  const res1 = solve(problem, { heuristicMode: "MRV_LCV" });
  const t1 = performance.now();

  console.log(`Success: ${res1.success}`);
  console.log(`Time: ${(t1 - t0).toFixed(2)} ms`);
  console.log(`Nodes Explored: ${res1.stats.nodesExplored}`);
  console.log(`Backtracks: ${res1.stats.backtrackCount}`);
  console.log(`Assignments: ${res1.assignments.length}`);
  if (!res1.success) console.log(`Failure Reason: ${res1.failureReason}`);

  console.log("\n-------------------------------------------------");
  console.log("2. Running Generator csp-solver.ts with MRV_LCV:");
  console.log("-------------------------------------------------");

  const t2 = performance.now();
  const gen = solveCSP(problem, { heuristicMode: "MRV_LCV" });
  let stepCount = 0;
  let res2 = null;
  while (true) {
    const next = gen.next();
    if (next.done) {
      res2 = next.value;
      break;
    }
    stepCount++;
  }
  const t3 = performance.now();

  console.log(`Success: ${res2.success}`);
  console.log(`Time: ${(t3 - t2).toFixed(2)} ms`);
  console.log(`Events Yielded: ${stepCount}`);
  console.log(`Nodes Explored: ${res2.stats.nodesExplored}`);
  console.log(`Backtracks: ${res2.stats.backtrackCount}`);
  console.log(`Assignments: ${res2.assignments.length}`);
  if (!res2.success) console.log(`Failure Reason: ${res2.failureReason}`);

  console.log("\n-------------------------------------------------");
  console.log("3. Running Generator csp-solver.ts with CHRONOLOGICAL:");
  console.log("-------------------------------------------------");

  const t4 = performance.now();
  const genNaive = solveCSP(problem, { heuristicMode: "CHRONOLOGICAL", maxBacktracks: 1000 });
  let stepCountNaive = 0;
  let res3 = null;
  while (true) {
    const next = genNaive.next();
    if (next.done) {
      res3 = next.value;
      break;
    }
    stepCountNaive++;
  }
  const t5 = performance.now();

  console.log(`Success: ${res3.success}`);
  console.log(`Time: ${(t5 - t4).toFixed(2)} ms`);
  console.log(`Events Yielded: ${stepCountNaive}`);
  console.log(`Nodes Explored: ${res3.stats.nodesExplored}`);
  console.log(`Backtracks: ${res3.stats.backtrackCount}`);
  console.log(`Assignments: ${res3.assignments.length}`);

  await prisma.$disconnect();
}

run().catch(console.error);

import { PrismaClient } from "@prisma/client";
import { solve } from "./solver.js";
import { SolverInput } from "./types.js";
import { demoScenarioNaiveVsSmart } from "./demo-scenario.js";

const prisma = new PrismaClient();

async function main() {
  const [courses, faculty, facultyCourseAssignments, rooms, divisions, timeSlots] =
    await Promise.all([
      prisma.course.findMany({ orderBy: { code: "asc" } }),
      prisma.faculty.findMany({ orderBy: { shortCode: "asc" } }),
      prisma.facultyCourseAssignment.findMany({ orderBy: [{ courseId: "asc" }, { facultyId: "asc" }] }),
      prisma.room.findMany({ orderBy: { roomNo: "asc" } }),
      prisma.division.findMany({ orderBy: { name: "asc" } }),
      prisma.timeSlot.findMany({ orderBy: [{ day: "asc" }, { startTime: "asc" }] }),
    ]);

  const baseInput: SolverInput = {
    courses,
    faculty,
    facultyCourseAssignments,
    rooms,
    divisions,
    timeSlots,
    constraints: demoScenarioNaiveVsSmart,
  };

  const naiveRes = solve(baseInput, { heuristicMode: "CHRONOLOGICAL", enableTrace: true, maxBacktracks: 1_000 });
  const smartRes = solve(baseInput, { heuristicMode: "MRV_LCV", enableTrace: true, maxBacktracks: 100_000 });

  console.log("=== FIRST 10 VARIABLES PROCESSED IN CHRONOLOGICAL (NAIVE) MODE ===");
  naiveRes.trace?.slice(0, 10).forEach((t, i) => {
    console.log(`  [${i + 1}] Variable: ${t.variable} (${t.type.toUpperCase()}) -> ${t.value}`);
  });

  console.log("\n=== FIRST 10 VARIABLES PROCESSED IN MRV_LCV (SMART) MODE ===");
  smartRes.trace?.slice(0, 10).forEach((t, i) => {
    console.log(`  [${i + 1}] Variable: ${t.variable} (${t.type.toUpperCase()}) -> ${t.value}`);
  });

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

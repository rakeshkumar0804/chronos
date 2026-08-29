import { PrismaClient } from "@prisma/client";
import { solve } from "./solver.js";
import { SolverInput, SolverOptions } from "./types.js";
import { Constraint } from "@chronos/shared";

const prisma = new PrismaClient();

async function testVariant(name: string, baseInput: any, constraints: Constraint[], mode: SolverOptions["heuristicMode"] = "CHRONOLOGICAL") {
  console.log(`Running ${name} (Mode: ${mode})...`);
  const res = solve(
    { ...baseInput, constraints },
    { heuristicMode: mode, enableTrace: true, maxBacktracks: 100_000 }
  );
  console.log(
    `${name} Result: Success=${res.success}, Backtracks=${res.stats.backtrackCount}, Nodes=${res.stats.nodesExplored}, Time=${res.stats.timeMs.toFixed(2)}ms, TraceEvents=${res.trace?.length ?? 0}`
  );
  if (!res.success) {
    console.log(`  Outcome: ${res.failureReason}`);
  }
  console.log("");
  return res;
}

async function main() {
  console.log("Testing Variant 5 to 8...\n");

  const [courses, faculty, facultyCourseAssignments, rooms, divisions, timeSlots] =
    await Promise.all([
      prisma.course.findMany(),
      prisma.faculty.findMany(),
      prisma.facultyCourseAssignment.findMany(),
      prisma.room.findMany(),
      prisma.division.findMany(),
      prisma.timeSlot.findMany(),
    ]);

  const baseInput = { courses, faculty, facultyCourseAssignments, rooms, divisions, timeSlots };

  const base30: Constraint[] = [
    {
      id: "C_DAILY_LECTURE_LIMIT",
      type: "HARD",
      category: "DAILY_COURSE_LIMIT",
      description: "At most 1 lecture session of any course per day per division",
      structuredRule: { maxDailySessions: 1 },
    },
    {
      id: "C_BLOCK_1335",
      type: "HARD",
      category: "ROOM_UNAVAILABILITY",
      description: "Slot 13:35 blocked on all days across all rooms (30 slots/week per room)",
      structuredRule: { startTimes: ["13:35"] },
    },
  ];

  // Variant 5: KR (Mon/Tue) + CPP (Fri/Sat) under CHRONOLOGICAL
  await testVariant("Variant 5: KR(Mon/Tue) + CPP(Fri/Sat)", baseInput, [
    ...base30,
    {
      id: "C_KR_MON_TUE",
      type: "HARD",
      category: "FACULTY_UNAVAILABILITY",
      description: "KR on leave Mon, Tue",
      structuredRule: { facultyShortCode: "KR", days: ["MON", "TUE"] },
    },
    {
      id: "C_CPP_FRI_SAT",
      type: "HARD",
      category: "FACULTY_UNAVAILABILITY",
      description: "CPP on leave Fri, Sat",
      structuredRule: { facultyShortCode: "CPP", days: ["FRI", "SAT"] },
    },
  ], "CHRONOLOGICAL");

  // Variant 6: KR (Mon/Tue) + CPP (Wed/Thu) under CHRONOLOGICAL
  await testVariant("Variant 6: KR(Mon/Tue) + CPP(Wed/Thu)", baseInput, [
    ...base30,
    {
      id: "C_KR_MON_TUE",
      type: "HARD",
      category: "FACULTY_UNAVAILABILITY",
      description: "KR on leave Mon, Tue",
      structuredRule: { facultyShortCode: "KR", days: ["MON", "TUE"] },
    },
    {
      id: "C_CPP_WED_THU",
      type: "HARD",
      category: "FACULTY_UNAVAILABILITY",
      description: "CPP on leave Wed, Thu",
      structuredRule: { facultyShortCode: "CPP", days: ["WED", "THU"] },
    },
  ], "CHRONOLOGICAL");

  // Variant 7: Sweep 1 under STATIC_DIFFICULTY
  await testVariant("Variant 7: Sweep 1 under STATIC_DIFFICULTY", baseInput, [
    ...base30,
    {
      id: "C_KR_MON_TUE",
      type: "HARD",
      category: "FACULTY_UNAVAILABILITY",
      description: "KR on leave Mon, Tue",
      structuredRule: { facultyShortCode: "KR", days: ["MON", "TUE"] },
    },
    {
      id: "C_CPP_THU_FRI",
      type: "HARD",
      category: "FACULTY_UNAVAILABILITY",
      description: "CPP on leave Thu, Fri",
      structuredRule: { facultyShortCode: "CPP", days: ["THU", "FRI"] },
    },
  ], "STATIC_DIFFICULTY");

  // Variant 8: KR(Mon/Tue) + CPP(Fri) + Block 12:45 on Thu/Fri/Sat (27-slot week)
  await testVariant("Variant 8: KR(Mon/Tue) + CPP(Fri) + 27-slot week", baseInput, [
    ...base30,
    {
      id: "C_BLOCK_1245_THU_SAT",
      type: "HARD",
      category: "ROOM_UNAVAILABILITY",
      description: "Slot 12:45 blocked on Thu, Fri, Sat",
      structuredRule: { days: ["THU", "FRI", "SAT"], startTimes: ["12:45"] },
    },
    {
      id: "C_KR_MON_TUE",
      type: "HARD",
      category: "FACULTY_UNAVAILABILITY",
      description: "KR on leave Mon, Tue",
      structuredRule: { facultyShortCode: "KR", days: ["MON", "TUE"] },
    },
    {
      id: "C_CPP_FRI",
      type: "HARD",
      category: "FACULTY_UNAVAILABILITY",
      description: "CPP on leave Fri",
      structuredRule: { facultyShortCode: "CPP", days: ["FRI"] },
    },
  ], "CHRONOLOGICAL");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

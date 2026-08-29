import { PrismaClient } from "@prisma/client";
import { solve } from "./solver.js";
import { SolverInput, SolverOptions } from "./types.js";
import { Constraint } from "@chronos/shared";

const prisma = new PrismaClient();

async function runStressedSolverTest(): Promise<void> {
  console.log("=================================================");
  console.log("  CHRONOS - CSP Stressed Solver Benchmark Run");
  console.log("=================================================");

  try {
    // 1. Fetch real seeded dataset
    console.log("Loading real dataset from PostgreSQL via Prisma...");
    const [courses, faculty, facultyCourseAssignments, rooms, divisions, timeSlots] =
      await Promise.all([
        prisma.course.findMany(),
        prisma.faculty.findMany(),
        prisma.facultyCourseAssignment.findMany(),
        prisma.room.findMany(),
        prisma.division.findMany(),
        prisma.timeSlot.findMany(),
      ]);

    console.log(`Loaded base dataset:`);
    console.log(` - Divisions: ${divisions.length}`);
    console.log(` - Courses: ${courses.length}`);
    console.log(` - Faculty: ${faculty.length}`);
    console.log(` - Rooms: ${rooms.length}`);
    console.log(` - Usable TimeSlots: ${timeSlots.filter((t) => !t.isBreak).length}`);

    // 2. Inject realistic stress constraints
    console.log("\nInjecting realistic stress constraints:");
    const stressConstraints: Constraint[] = [
      {
        id: "C_KR_LEAVE",
        type: "HARD",
        category: "FACULTY_UNAVAILABILITY",
        description: "Prof. Karan Rathi (KR) on leave Mon, Tue, Sat (available Wed-Fri: 12 slots for 10 sessions across 2 divisions)",
        structuredRule: {
          facultyShortCode: "KR",
          days: ["MON", "TUE", "SAT"],
        },
      },
      {
        id: "C_CPP_UNAVAILABLE",
        type: "HARD",
        category: "FACULTY_UNAVAILABILITY",
        description: "Prof. Chetan Prasad (CPP) unavailable on Wednesday and Thursday (available Mon, Tue, Fri, Sat)",
        structuredRule: {
          facultyShortCode: "CPP",
          days: ["WED", "THU"],
        },
      },
      {
        id: "C_GKH_LEAVE",
        type: "HARD",
        category: "FACULTY_UNAVAILABILITY",
        description: "Mr. Girish K. Hooda (GKH) on leave Mon, Tue, Sat",
        structuredRule: {
          facultyShortCode: "GKH",
          days: ["MON", "TUE", "SAT"],
        },
      },
      {
        id: "C_ARP_UNAVAILABLE",
        type: "HARD",
        category: "FACULTY_UNAVAILABILITY",
        description: "Ms. Anjali R. Pillai (ARP) unavailable on Tue, Thu, Fri, Sat (available Mon, Wed only for 4 TOC lectures across 2 divisions)",
        structuredRule: {
          facultyShortCode: "ARP",
          days: ["TUE", "THU", "FRI", "SAT"],
        },
      },
      {
        id: "C_MJH_UNAVAILABLE",
        type: "HARD",
        category: "FACULTY_UNAVAILABILITY",
        description: "Mr. Manish J. Hegde (MJH) unavailable on Friday and Saturday (available Mon-Thu)",
        structuredRule: {
          facultyShortCode: "MJH",
          days: ["FRI", "SAT"],
        },
      },
      {
        id: "C_ROOM134_RENOVATION",
        type: "HARD",
        category: "ROOM_UNAVAILABILITY",
        description: "Lab Room 134 closed entirely for semester renovation (single lab room 302 bottleneck for both divisions)",
        structuredRule: {
          roomNo: "134",
          days: ["MON", "TUE", "WED", "THU", "FRI", "SAT"],
        },
      },
      {
        id: "C_DAILY_LECTURE_LIMIT",
        type: "HARD",
        category: "DAILY_COURSE_LIMIT",
        description: "At most 1 lecture session of any course per day per division",
        structuredRule: {
          maxDailySessions: 1,
          courseShortCodes: ["DAA", "TOC", "SE", "EP", "PCE", "DADV", "AF"],
        },
      },
      {
        id: "C_LAB_NO_SATURDAY",
        type: "HARD",
        category: "ROOM_UNAVAILABILITY",
        description: "Lab Room 302 closed on Saturday (forces exactly 20 lab hours across 2 divisions into exactly 20 available slots on Mon-Fri)",
        structuredRule: {
          roomNo: "302",
          days: ["SAT"],
        },
      },
      {
        id: "C_MORNING_ONLY_WINDOW",
        type: "HARD",
        category: "ROOM_UNAVAILABILITY",
        description: "Afternoon slots (12:45, 13:35) blocked on all rooms across all days (compressing schedule to 24 slots/week)",
        structuredRule: {
          startTimes: ["12:45", "13:35"],
        },
      },
    ];

    for (const sc of stressConstraints) {
      console.log(` [+] ${sc.id}: ${sc.description}`);
    }

    const solverInput: SolverInput = {
      courses,
      faculty,
      facultyCourseAssignments,
      rooms,
      divisions,
      timeSlots,
      constraints: stressConstraints,
    };

    // 3. Compare Different Search Heuristic Strategies
    const modes: Array<{ name: string; options: SolverOptions }> = [
      {
        name: "Standard Backtracking + Forward Checking (Chronological Order)",
        options: { heuristicMode: "CHRONOLOGICAL", enableTrace: true, maxBacktracks: 100_000 },
      },
      {
        name: "MRV Variable Ordering Only (Natural Value Order)",
        options: { heuristicMode: "MRV_ONLY", enableTrace: true, maxBacktracks: 100_000 },
      },
      {
        name: "Full CSP Engine (MRV + LCV + Forward Checking)",
        options: { heuristicMode: "MRV_LCV", enableTrace: true, maxBacktracks: 100_000 },
      },
    ];

    for (const mode of modes) {
      console.log(`\n-------------------------------------------------`);
      console.log(`Testing Mode: ${mode.name}`);
      console.log(`-------------------------------------------------`);

      const result = solve(solverInput, mode.options);

      console.log(`Success: ${result.success}`);
      console.log(`Real Execution Time: ${result.stats.timeMs.toFixed(2)} ms`);
      console.log(`Nodes Explored: ${result.stats.nodesExplored}`);
      console.log(`Backtrack Count: ${result.stats.backtrackCount}`);
      console.log(`Trace Events Logged: ${result.trace?.length ?? 0}`);

      if (result.trace) {
        const assignEvents = result.trace.filter((e) => e.type === "assign").length;
        const conflictEvents = result.trace.filter((e) => e.type === "conflict").length;
        const backtrackEvents = result.trace.filter((e) => e.type === "backtrack").length;
        console.log(`Trace Breakdown: ${assignEvents} assigns, ${conflictEvents} conflicts, ${backtrackEvents} backtracks`);
      }

      if (!result.success) {
        console.log(`Search Outcome: ${result.failureReason}`);
      } else {
        console.log(`Schedule Entries Generated: ${result.assignments.length} / 46`);
      }
    }

    console.log("\n=================================================\n");
  } finally {
    await prisma.$disconnect();
  }
}

runStressedSolverTest();

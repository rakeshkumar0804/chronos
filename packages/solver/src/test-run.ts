import { PrismaClient } from "@prisma/client";
import { solve } from "./solver.js";
import { SolverInput } from "./types.js";

const prisma = new PrismaClient();

async function runSolverTest(): Promise<void> {
  console.log("=================================================");
  console.log("  CHRONOS - CSP Backtracking Solver Test Run");
  console.log("=================================================");

  try {
    // 1. Fetch real seeded data from database
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

    console.log(`Loaded dataset:`);
    console.log(` - Divisions: ${divisions.length}`);
    console.log(` - Courses: ${courses.length}`);
    console.log(` - Faculty: ${faculty.length}`);
    console.log(` - Faculty-Course Assignments: ${facultyCourseAssignments.length}`);
    console.log(` - Rooms: ${rooms.length}`);
    console.log(` - TimeSlots: ${timeSlots.length} (Usable: ${timeSlots.filter(t => !t.isBreak).length})`);

    const totalRequiredHours = divisions.length * courses.reduce((sum, c) => sum + c.weeklyHours, 0);
    console.log(`Total session units to schedule: ${totalRequiredHours}`);

    const solverInput: SolverInput = {
      courses,
      faculty,
      facultyCourseAssignments,
      rooms,
      divisions,
      timeSlots,
    };

    // 2. Run solver
    console.log("\nExecuting solve() with MRV, LCV, and Forward Checking...");
    const result = solve(solverInput, { enableTrace: true });

    // 3. Print Results & Real Stats
    console.log("\n------------------ Solver Result ------------------");
    console.log(`Success: ${result.success}`);
    console.log(`Real Execution Time: ${result.stats.timeMs.toFixed(2)} ms`);
    console.log(`Nodes Explored: ${result.stats.nodesExplored}`);
    console.log(`Backtrack Count: ${result.stats.backtrackCount}`);
    console.log(`Trace Events Logged: ${result.trace?.length ?? 0}`);

    if (!result.success) {
      console.error(`\nSolver Failed: ${result.failureReason}`);
      process.exit(1);
    }

    console.log(`Total Schedule Entries Generated: ${result.assignments.length}`);

    // 4. Rigorous Constraint Verification
    console.log("\n------------- Hard Constraint Verification ------------");

    const courseMap = new Map(courses.map((c) => [c.id, c]));
    const facultyMap = new Map(faculty.map((f) => [f.id, f]));
    const roomMap = new Map(rooms.map((r) => [r.id, r]));
    const divisionMap = new Map(divisions.map((d) => [d.id, d]));
    const timeSlotMap = new Map(timeSlots.map((ts) => [ts.id, ts]));

    const facultyTimeMap = new Set<string>();
    const roomTimeMap = new Set<string>();
    const divisionTimeMap = new Set<string>();

    let violations = 0;

    for (const entry of result.assignments) {
      const course = courseMap.get(entry.courseId)!;
      const fac = facultyMap.get(entry.facultyId)!;
      const room = roomMap.get(entry.roomId)!;
      const div = divisionMap.get(entry.divisionId)!;
      const ts = timeSlotMap.get(entry.timeSlotId)!;

      // Check break slot
      if (ts.isBreak) {
        console.error(`VIOLATION: Assigned to break slot (${ts.day} ${ts.startTime})`);
        violations++;
      }

      // Check room type
      if (course.type === "LAB" && room.type !== "LAB") {
        console.error(`VIOLATION: LAB course ${course.shortCode} assigned to non-LAB room ${room.roomNo}`);
        violations++;
      }
      if (course.type === "LECTURE" && room.type !== "LECTURE_ROOM") {
        console.error(`VIOLATION: LECTURE course ${course.shortCode} assigned to non-LECTURE room ${room.roomNo}`);
        violations++;
      }

      // Check faculty qualification
      const isValidFaculty = facultyCourseAssignments.some(
        (fca) => fca.courseId === course.id && fca.facultyId === fac.id
      );
      if (!isValidFaculty) {
        console.error(`VIOLATION: Faculty ${fac.shortCode} is not assigned to course ${course.shortCode}`);
        violations++;
      }

      // Check collisions
      const facKey = `${entry.facultyId}_${entry.timeSlotId}`;
      if (facultyTimeMap.has(facKey)) {
        console.error(`VIOLATION: Faculty ${fac.shortCode} double-booked at ${ts.day} ${ts.startTime}`);
        violations++;
      }
      facultyTimeMap.add(facKey);

      const roomKey = `${entry.roomId}_${entry.timeSlotId}`;
      if (roomTimeMap.has(roomKey)) {
        console.error(`VIOLATION: Room ${room.roomNo} double-booked at ${ts.day} ${ts.startTime}`);
        violations++;
      }
      roomTimeMap.add(roomKey);

      const divKey = `${entry.divisionId}_${entry.timeSlotId}`;
      if (divisionTimeMap.has(divKey)) {
        console.error(`VIOLATION: Division ${div.name} double-booked at ${ts.day} ${ts.startTime}`);
        violations++;
      }
      divisionTimeMap.add(divKey);
    }

    if (violations === 0) {
      console.log("All 6 Hard Constraints VERIFIED: 0 violations detected.");
    } else {
      console.error(`Verification FAILED with ${violations} violations!`);
      process.exit(1);
    }

    // 5. Sample Schedule Output (first 10 entries)
    console.log("\n-------------- Sample Schedule Entries (First 10) --------------");
    for (let i = 0; i < Math.min(10, result.assignments.length); i++) {
      const e = result.assignments[i];
      const course = courseMap.get(e.courseId)!;
      const fac = facultyMap.get(e.facultyId)!;
      const room = roomMap.get(e.roomId)!;
      const div = divisionMap.get(e.divisionId)!;
      const ts = timeSlotMap.get(e.timeSlotId)!;

      console.log(
        `[${ts.day} ${ts.startTime}-${ts.endTime}] Div: ${div.name.padEnd(7)} | Course: ${course.shortCode.padEnd(7)} (${course.type.padEnd(7)}) | Room: ${room.roomNo.padEnd(4)} | Prof: ${fac.shortCode}`
      );
    }
    console.log("=================================================\n");
  } finally {
    await prisma.$disconnect();
  }
}

runSolverTest();

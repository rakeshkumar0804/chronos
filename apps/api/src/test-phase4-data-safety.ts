import { PrismaClient, CourseType, RoomType, DayOfWeek, ConstraintType } from "@prisma/client";
import fs from "fs";
import path from "path";
import { execSync, spawn } from "child_process";
import { solve } from "@chronos/solver";
import { XYZ_INSTITUTE_WORKSPACE } from "./db.js";

const prisma = new PrismaClient();
const SENTINEL_WORKSPACE_ID = "ws-sentinel-phase4-test-data-safety";

interface DbCounts {
  courses: number;
  faculty: number;
  rooms: number;
  assignments: number;
  schedules: number;
  constraints: number;
  timeSlots: number;
  divisions: number;
}

async function getDbRowCounts(): Promise<DbCounts> {
  const [courses, faculty, rooms, assignments, schedules, constraints, timeSlots, divisions] = await Promise.all([
    prisma.course.count(),
    prisma.faculty.count(),
    prisma.room.count(),
    prisma.facultyCourseAssignment.count(),
    prisma.scheduleEntry.count(),
    prisma.constraint.count(),
    prisma.timeSlot.count(),
    prisma.division.count(),
  ]);
  return { courses, faculty, rooms, assignments, schedules, constraints, timeSlots, divisions };
}

async function runPhase4DataSafetyTest(): Promise<void> {
  console.log("=======================================================================");
  console.log("CHRONOS PHASE 4 — DEPLOYMENT DATA-SAFETY & SEED ISOLATION REGRESSION TEST");
  console.log("=======================================================================");

  // SAFETY GUARD: Check for remote database URL
  const dbUrl = process.env.DATABASE_URL || "";
  if (dbUrl.includes("neon.tech") || dbUrl.includes("render.com") || (!dbUrl.includes("localhost") && !dbUrl.includes("127.0.0.1"))) {
    throw new Error(`SAFETY GUARD INTERVENTION: Refusing to run data-preservation test against remote database (${dbUrl}). Local disposable PostgreSQL required.`);
  }

  let sentinelConstraintId: string | null = null;

  try {
    const initialCounts = await getDbRowCounts();
    console.log("\n[INITIAL DB ROW COUNTS]");
    console.log(`  Courses: ${initialCounts.courses} | Faculty: ${initialCounts.faculty} | Rooms: ${initialCounts.rooms}`);
    console.log(`  Assignments: ${initialCounts.assignments} | Schedules: ${initialCounts.schedules} | Constraints: ${initialCounts.constraints}`);
    console.log(`  TimeSlots: ${initialCounts.timeSlots} | Divisions: ${initialCounts.divisions}`);

    // STEP 1: Dockerfile & Seed Static Regression Audit
    console.log("\n[1/6] Auditing Dockerfiles and seed.ts for dangerous operations...");

    const rootDockerfile = fs.readFileSync(path.join(process.cwd(), "Dockerfile"), "utf-8");
    const apiDockerfile = fs.readFileSync(path.join(process.cwd(), "apps/api/Dockerfile"), "utf-8");
    const seedScript = fs.readFileSync(path.join(process.cwd(), "prisma/seed.ts"), "utf-8");

    if (rootDockerfile.includes("--force-reset")) {
      throw new Error("FAIL: Root Dockerfile contains '--force-reset'!");
    }
    if (apiDockerfile.includes("--force-reset")) {
      throw new Error("FAIL: apps/api/Dockerfile contains '--force-reset'!");
    }
    console.log("  ✓ Neither Dockerfile contains '--force-reset'");

    if (rootDockerfile.includes("seed.ts") && rootDockerfile.includes("CMD")) {
      const cmdLine = rootDockerfile.split("\n").find((l) => l.startsWith("CMD")) || "";
      if (cmdLine.includes("seed.ts")) {
        throw new Error("FAIL: Root Dockerfile executes seed.ts on container startup CMD!");
      }
    }
    if (apiDockerfile.includes("seed.ts") && apiDockerfile.includes("CMD")) {
      const cmdLine = apiDockerfile.split("\n").find((l) => l.startsWith("CMD")) || "";
      if (cmdLine.includes("seed.ts")) {
        throw new Error("FAIL: apps/api/Dockerfile executes seed.ts on container startup CMD!");
      }
    }
    console.log("  ✓ Neither Dockerfile executes seed.ts on container startup CMD");

    const deleteManyMatches = seedScript.match(/deleteMany\s*\(\s*\)/g);
    if (deleteManyMatches && deleteManyMatches.length > 0) {
      throw new Error(`FAIL: prisma/seed.ts contains ${deleteManyMatches.length} unscoped deleteMany() calls!`);
    }
    console.log("  ✓ prisma/seed.ts contains NO unscoped deleteMany() calls");

    // STEP 2: Create Sentinel Visitor Sandbox Entities + Constraint Record
    console.log("\n[2/6] Seeding Sentinel Visitor Sandbox entities & Constraint record...");

    // Clean pre-existing sentinel data
    await prisma.scheduleEntry.deleteMany({ where: { workspaceId: SENTINEL_WORKSPACE_ID } });
    await prisma.facultyCourseAssignment.deleteMany({ where: { workspaceId: SENTINEL_WORKSPACE_ID } });
    await prisma.course.deleteMany({ where: { workspaceId: SENTINEL_WORKSPACE_ID } });
    await prisma.faculty.deleteMany({ where: { workspaceId: SENTINEL_WORKSPACE_ID } });
    await prisma.room.deleteMany({ where: { workspaceId: SENTINEL_WORKSPACE_ID } });

    const timeSlot = await prisma.timeSlot.findFirst({
      where: { day: DayOfWeek.MON, startTime: "07:30" },
    });
    const division = await prisma.division.findFirst({ where: { name: "5A15-1" } });

    if (!timeSlot || !division) {
      throw new Error("FAIL: Shared TimeSlot or Division missing from database!");
    }

    const room = await prisma.room.create({
      data: {
        workspaceId: SENTINEL_WORKSPACE_ID,
        roomNo: "SENTINEL-99",
        type: RoomType.LECTURE_ROOM,
        isCustom: true,
      },
    });

    const faculty = await prisma.faculty.create({
      data: {
        workspaceId: SENTINEL_WORKSPACE_ID,
        shortCode: "SNT",
        fullName: "Dr. Sentinel Tester",
        email: "sentinel@test.sandbox",
        isCustom: true,
      },
    });

    const course = await prisma.course.create({
      data: {
        workspaceId: SENTINEL_WORKSPACE_ID,
        code: "SNT-101",
        shortCode: "SNT101",
        name: "Sentinel Data Protection 101",
        type: CourseType.LECTURE,
        weeklyHours: 1,
        isCustom: true,
      },
    });

    const assignment = await prisma.facultyCourseAssignment.create({
      data: {
        workspaceId: SENTINEL_WORKSPACE_ID,
        facultyId: faculty.id,
        courseId: course.id,
        isCustom: true,
      },
    });

    const schedule = await prisma.scheduleEntry.create({
      data: {
        workspaceId: SENTINEL_WORKSPACE_ID,
        courseId: course.id,
        facultyId: faculty.id,
        roomId: room.id,
        divisionId: division.id,
        timeSlotId: timeSlot.id,
      },
    });

    const constraint = await prisma.constraint.create({
      data: {
        type: ConstraintType.HARD,
        category: "FACULTY_UNAVAILABLE",
        description: "Sentinel Faculty SNT unavailable on Friday for testing",
        structuredRule: { facultyShortCode: "SNT", days: ["FRI"] },
      },
    });
    sentinelConstraintId = constraint.id;

    const sentinelSnapshot = {
      room: { id: room.id, roomNo: room.roomNo, type: room.type, workspaceId: room.workspaceId },
      faculty: { id: faculty.id, shortCode: faculty.shortCode, fullName: faculty.fullName, email: faculty.email, workspaceId: faculty.workspaceId },
      course: { id: course.id, code: course.code, shortCode: course.shortCode, name: course.name, workspaceId: course.workspaceId },
      assignment: { facultyId: assignment.facultyId, courseId: assignment.courseId, workspaceId: assignment.workspaceId },
      schedule: { id: schedule.id, courseId: schedule.courseId, facultyId: schedule.facultyId, roomId: schedule.roomId, workspaceId: schedule.workspaceId },
      constraint: {
        id: constraint.id,
        type: constraint.type,
        category: constraint.category,
        description: constraint.description,
        structuredRule: JSON.stringify(constraint.structuredRule),
      },
    };

    console.log(`  ✓ Sentinel Room created (${sentinelSnapshot.room.id})`);
    console.log(`  ✓ Sentinel Faculty created (${sentinelSnapshot.faculty.id})`);
    console.log(`  ✓ Sentinel Course created (${sentinelSnapshot.course.id})`);
    console.log(`  ✓ Sentinel Assignment created (${sentinelSnapshot.assignment.facultyId}-${sentinelSnapshot.assignment.courseId})`);
    console.log(`  ✓ Sentinel Schedule Entry created (${sentinelSnapshot.schedule.id})`);
    console.log(`  ✓ Sentinel Constraint created (${sentinelSnapshot.constraint.id})`);

    const assertSentinelIntegrity = async (stepName: string) => {
      const r = await prisma.room.findUnique({ where: { id: sentinelSnapshot.room.id } });
      const f = await prisma.faculty.findUnique({ where: { id: sentinelSnapshot.faculty.id } });
      const c = await prisma.course.findUnique({ where: { id: sentinelSnapshot.course.id } });
      const a = await prisma.facultyCourseAssignment.findUnique({
        where: { facultyId_courseId: { facultyId: sentinelSnapshot.assignment.facultyId, courseId: sentinelSnapshot.assignment.courseId } },
      });
      const s = await prisma.scheduleEntry.findUnique({ where: { id: sentinelSnapshot.schedule.id } });
      const ct = await prisma.constraint.findUnique({ where: { id: sentinelSnapshot.constraint.id } });

      if (!r || r.roomNo !== sentinelSnapshot.room.roomNo || r.workspaceId !== sentinelSnapshot.room.workspaceId) {
        throw new Error(`FAIL [${stepName}]: Sentinel Room corrupted or deleted!`);
      }
      if (!f || f.shortCode !== sentinelSnapshot.faculty.shortCode || f.workspaceId !== sentinelSnapshot.faculty.workspaceId) {
        throw new Error(`FAIL [${stepName}]: Sentinel Faculty corrupted or deleted!`);
      }
      if (!c || c.code !== sentinelSnapshot.course.code || c.workspaceId !== sentinelSnapshot.course.workspaceId) {
        throw new Error(`FAIL [${stepName}]: Sentinel Course corrupted or deleted!`);
      }
      if (!a || a.workspaceId !== sentinelSnapshot.assignment.workspaceId) {
        throw new Error(`FAIL [${stepName}]: Sentinel Assignment corrupted or deleted!`);
      }
      if (!s || s.workspaceId !== sentinelSnapshot.schedule.workspaceId) {
        throw new Error(`FAIL [${stepName}]: Sentinel Schedule corrupted or deleted!`);
      }
      if (!ct || ct.category !== sentinelSnapshot.constraint.category || JSON.stringify(ct.structuredRule) !== sentinelSnapshot.constraint.structuredRule) {
        throw new Error(`FAIL [${stepName}]: Sentinel Constraint corrupted or deleted!`);
      }

      // Verify Institutional Benchmark totals
      const benchmarkCourses = await prisma.course.count({ where: { workspaceId: XYZ_INSTITUTE_WORKSPACE } });
      const benchmarkFaculty = await prisma.faculty.count({ where: { workspaceId: XYZ_INSTITUTE_WORKSPACE } });
      const benchmarkRooms = await prisma.room.count({ where: { workspaceId: XYZ_INSTITUTE_WORKSPACE } });
      const benchmarkCoursesList = await prisma.course.findMany({ where: { workspaceId: XYZ_INSTITUTE_WORKSPACE } });
      const totalWeeklySessions = benchmarkCoursesList.reduce((sum, item) => sum + item.weeklyHours, 0) * 2; // 2 divisions

      if (benchmarkCourses !== 11 || benchmarkFaculty !== 12 || benchmarkRooms !== 4 || totalWeeklySessions !== 46) {
        throw new Error(`FAIL [${stepName}]: Institutional benchmark altered! Courses=${benchmarkCourses}, Faculty=${benchmarkFaculty}, Rooms=${benchmarkRooms}, Sessions=${totalWeeklySessions}`);
      }

      console.log(`  ✓ Verification [${stepName}]: All 6 sentinel records (Room, Faculty, Course, Assignment, Schedule, Constraint) intact & Benchmark (11/12/4/46) preserved.`);
    };

    // STEP 3: Execute Scoped Benchmark Seed Twice & Assert Integrity
    console.log("\n[3/6] Executing prisma/seed.ts twice (Simulating repeated deployments)...");

    execSync("npx tsx prisma/seed.ts", { stdio: "inherit" });
    await assertSentinelIntegrity("Seed Run #1");

    execSync("npx tsx prisma/seed.ts", { stdio: "inherit" });
    await assertSentinelIntegrity("Seed Run #2");

    // STEP 4: Simulate Production API Process Restart Twice & Assert Integrity
    console.log("\n[4/6] Executing production API process startup twice: \"npx tsx apps/api/src/index.ts\"...");

    for (let restartCycle = 1; restartCycle <= 2; restartCycle++) {
      const testPort = 4010 + restartCycle;
      console.log(`  Starting API process cycle #${restartCycle} on port ${testPort}...`);

      const tsxCli = path.join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
      const child = spawn(process.execPath, [tsxCli, "apps/api/src/index.ts"], {
        env: { ...process.env, NODE_ENV: "production", PORT: String(testPort) },
        stdio: "pipe",
      });

      let childLogs = "";
      child.stdout?.on("data", (d) => { childLogs += d.toString(); });
      child.stderr?.on("data", (d) => { childLogs += d.toString(); });

      let exitCode: number | null = null;
      let exitSignal: string | null = null;
      child.on("exit", (code, signal) => {
        exitCode = code;
        exitSignal = signal;
      });

      let started = false;
      const startTime = Date.now();
      while (Date.now() - startTime < 15000) {
        try {
          const res = await fetch(`http://localhost:${testPort}/api/health`);
          if (res.status === 200) {
            started = true;
            break;
          }
        } catch {
          // Process initializing
        }
        await new Promise((r) => setTimeout(r, 250));
      }

      if (!started) {
        try { child.kill("SIGKILL"); } catch {}
        throw new Error(`FAIL: Production API process failed to respond on port ${testPort} within 15s (exitCode=${exitCode}, exitSignal=${exitSignal}).\nProcess Logs:\n${childLogs}`);
      }

      console.log(`  ✓ API Process cycle #${restartCycle} responded on http://localhost:${testPort}/api/health`);
      try { child.kill("SIGKILL"); } catch {}
      await new Promise((r) => setTimeout(r, 500));
      console.log(`  ✓ Stopped API Process cycle #${restartCycle}`);

      await assertSentinelIntegrity(`API Process Restart #${restartCycle}`);
    }

    // STEP 5: Verify Smart Solver Metrics Against Benchmark
    console.log("\n[5/6] Verifying Smart Solver metrics on benchmark dataset...");

    const benchmarkCourses = await prisma.course.findMany({ where: { workspaceId: XYZ_INSTITUTE_WORKSPACE } });
    const benchmarkFaculty = await prisma.faculty.findMany({ where: { workspaceId: XYZ_INSTITUTE_WORKSPACE } });
    const benchmarkRooms = await prisma.room.findMany({ where: { workspaceId: XYZ_INSTITUTE_WORKSPACE } });
    const benchmarkAssignments = await prisma.facultyCourseAssignment.findMany({ where: { workspaceId: XYZ_INSTITUTE_WORKSPACE } });
    const divisions = await prisma.division.findMany();
    const timeSlots = await prisma.timeSlot.findMany();

    const solveResult = solve(
      {
        courses: benchmarkCourses.map((c) => ({
          id: c.id,
          code: c.code,
          shortCode: c.shortCode,
          name: c.name,
          type: c.type as any,
          weeklyHours: c.weeklyHours,
        })),
        faculty: benchmarkFaculty.map((f) => ({
          id: f.id,
          shortCode: f.shortCode,
          fullName: f.fullName,
          email: f.email,
        })),
        rooms: benchmarkRooms.map((r) => ({
          id: r.id,
          roomNo: r.roomNo,
          type: r.type as any,
        })),
        divisions: divisions.map((d) => ({
          id: d.id,
          name: d.name,
          semester: d.semester,
          program: d.program,
        })),
        timeSlots: timeSlots.map((t) => ({
          id: t.id,
          day: t.day as any,
          startTime: t.startTime,
          endTime: t.endTime,
          isBreak: t.isBreak,
          breakLabel: t.breakLabel,
        })),
        facultyCourseAssignments: benchmarkAssignments.map((a) => ({
          facultyId: a.facultyId,
          courseId: a.courseId,
        })),
      },
      {
        heuristicMode: "MRV_LCV",
        valueOrdering: "LCV",
      }
    );

    console.log(`  Smart Solver Outcome:`);
    console.log(`    - Success: ${solveResult.success}`);
    console.log(`    - Explored Nodes: ${solveResult.stats.nodesExplored} (Expected: 46)`);
    console.log(`    - Backtracks: ${solveResult.stats.backtrackCount} (Expected: 0)`);

    if (!solveResult.success || solveResult.stats.nodesExplored !== 46 || solveResult.stats.backtrackCount !== 0) {
      throw new Error(`FAIL: Smart solver metrics changed! Success=${solveResult.success}, Nodes=${solveResult.stats.nodesExplored}, Backtracks=${solveResult.stats.backtrackCount}`);
    }

    // STEP 6: Final DB Row Count Audit
    const finalCounts = await getDbRowCounts();
    console.log("\n[6/6] Final Database Row Count Audit...");
    console.log(`  Courses: ${finalCounts.courses} | Faculty: ${finalCounts.faculty} | Rooms: ${finalCounts.rooms}`);
    console.log(`  Assignments: ${finalCounts.assignments} | Schedules: ${finalCounts.schedules} | Constraints: ${finalCounts.constraints}`);
    console.log(`  TimeSlots: ${finalCounts.timeSlots} | Divisions: ${finalCounts.divisions}`);

    console.log("\n=======================================================================");
    console.log("SUCCESS: PHASE 4 DEPLOYMENT DATA-SAFETY & SEED ISOLATION VERIFIED 100%");
    console.log("=======================================================================");
  } finally {
    // Guaranteed Teardown: Purge ONLY sentinel data created by this test
    console.log("\n[TEARDOWN] Purging sentinel test records in guaranteed finally block...");
    await prisma.scheduleEntry.deleteMany({ where: { workspaceId: SENTINEL_WORKSPACE_ID } });
    await prisma.facultyCourseAssignment.deleteMany({ where: { workspaceId: SENTINEL_WORKSPACE_ID } });
    await prisma.course.deleteMany({ where: { workspaceId: SENTINEL_WORKSPACE_ID } });
    await prisma.faculty.deleteMany({ where: { workspaceId: SENTINEL_WORKSPACE_ID } });
    await prisma.room.deleteMany({ where: { workspaceId: SENTINEL_WORKSPACE_ID } });
    if (sentinelConstraintId) {
      await prisma.constraint.deleteMany({ where: { id: sentinelConstraintId } });
    }
    await prisma.$disconnect();
    console.log("  ✓ Teardown complete: Sentinel records cleanly removed.");
  }
}

runPhase4DataSafetyTest().catch((err) => {
  console.error("\n[TEST ERROR]", err);
  process.exit(1);
});

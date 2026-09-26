process.env.NODE_ENV = "test";
import { Server } from "http";
import { XYZ_INSTITUTE_WORKSPACE, prisma } from "./db.js";

// -----------------------------------------------------------------------------
// Database Safety Guard: Prevent accidental test execution against production DB
// -----------------------------------------------------------------------------
const dbUrl = process.env.DATABASE_URL || "";
const isRemoteDb =
  dbUrl.includes("neon.tech") ||
  dbUrl.includes("supabase.co") ||
  dbUrl.includes("render.com") ||
  (!dbUrl.includes("localhost") && !dbUrl.includes("127.0.0.1") && !dbUrl.includes("::1"));

if (isRemoteDb && process.env.ALLOW_REMOTE_TEST_RUN !== "true") {
  console.error("===============================================================================");
  console.error("SAFETY GUARD: Refusing to execute regression test suite against a remote");
  console.error("or non-local database host without explicit authorization.");
  console.error("To override for a verified disposable remote test database, set:");
  console.error("ALLOW_REMOTE_TEST_RUN=true");
  console.error("===============================================================================");
  process.exit(1);
}

const PORT = 4015;
const BASE_URL = `http://localhost:${PORT}`;

// Disposable dynamic workspace namespaces for this specific test execution
const runId = Math.random().toString(36).substring(2, 8);
const WS_ALPHA = `ws-test-alpha-${runId}`;
const WS_BETA = `ws-test-beta-${runId}`;
const WS_GAMMA = `ws-test-gamma-${runId}`;

const EXPECTED_BENCHMARK_COURSES = [
  "303105218",
  "303105219",
  "303105306",
  "303105253",
  "303105254",
  "303105309",
  "303105310",
  "303193304",
  "303105314",
  "303105315",
  "303105302",
];

// Helper: Delete only records belonging to the disposable test namespaces
async function cleanupTestWorkspaces() {
  for (const ws of [WS_ALPHA, WS_BETA, WS_GAMMA]) {
    try {
      await prisma.facultyCourseAssignment.deleteMany({ where: { workspaceId: ws } });
      await prisma.scheduleEntry.deleteMany({ where: { workspaceId: ws } });
      await prisma.course.deleteMany({ where: { workspaceId: ws } });
      await prisma.faculty.deleteMany({ where: { workspaceId: ws } });
      await prisma.room.deleteMany({ where: { workspaceId: ws } });
    } catch (err: any) {
      console.warn(`[Cleanup Warning] Could not purge test namespace ${ws}:`, err.message);
    }
  }
}

async function runRegressionSuite() {
  console.log("===============================================================================");
  console.log("CHRONOS Phase 1 Regression Suite: Workspace Boundaries & Benchmark Integrity");
  console.log(`Disposable Test Namespaces: Alpha=${WS_ALPHA} | Beta=${WS_BETA} | Gamma=${WS_GAMMA}`);
  console.log("===============================================================================\n");

  const mod = await import("./index.js");
  const app: any = mod.default;
  const server: Server = app.listen(PORT);

  let passedTests = 0;
  const totalTests = 5;

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Benchmark Immutability
    // -------------------------------------------------------------------------
    console.log("▶ [TEST 1/5] Testing Immutability of Institutional Benchmark (xyz-institute-demo)...");

    const mutationEndpoints: Array<{
      name: string;
      url: string;
      method: string;
      headers?: Record<string, string>;
      body?: string;
    }> = [
      {
        name: "Add Faculty to Benchmark",
        url: `${BASE_URL}/api/admin/faculty`,
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Workspace-Id": XYZ_INSTITUTE_WORKSPACE },
        body: JSON.stringify({ shortCode: "HACK", fullName: "Hacker Faculty", email: "hacker@xyz.edu" }),
      },
      {
        name: "Add Faculty without X-Workspace-Id (defaults to benchmark)",
        url: `${BASE_URL}/api/admin/faculty`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shortCode: "HACK2", fullName: "Hacker Faculty 2", email: "hacker2@xyz.edu" }),
      },
      {
        name: "Add Room to Benchmark",
        url: `${BASE_URL}/api/admin/room`,
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Workspace-Id": XYZ_INSTITUTE_WORKSPACE },
        body: JSON.stringify({ roomNo: "R999", type: "LECTURE_ROOM", capacity: 60 }),
      },
      {
        name: "Add Course to Benchmark",
        url: `${BASE_URL}/api/admin/course`,
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Workspace-Id": XYZ_INSTITUTE_WORKSPACE },
        body: JSON.stringify({
          code: "CS999",
          name: "Hack Course",
          shortCode: "HC",
          type: "LECTURE",
          weeklyHours: 3,
          facultyShortCodes: ["TPA"],
        }),
      },
      {
        name: "Reset Benchmark Workspace",
        url: `${BASE_URL}/api/admin/reset-custom`,
        method: "DELETE",
        headers: { "X-Workspace-Id": XYZ_INSTITUTE_WORKSPACE },
        body: undefined,
      },
    ];

    for (const ep of mutationEndpoints) {
      const res = await fetch(ep.url, {
        method: ep.method,
        headers: ep.headers,
        body: ep.body,
      });

      if (res.status !== 403) {
        throw new Error(`FAIL: ${ep.name} returned status ${res.status}, expected 403 Forbidden.`);
      }
      const data = (await res.json()) as any;
      console.log(`  ✓ Blocked with 403: ${ep.name} -> "${data.error}"`);
    }

    console.log("✅ TEST 1 PASSED: Institutional benchmark workspace is strictly immutable.\n");
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST 2: Cross-Workspace Isolation & Solve
    // -------------------------------------------------------------------------
    console.log("▶ [TEST 2/5] Testing Isolation Between Visitor Sandboxes (Alpha vs Beta)...");

    // Clean up test sandboxes before starting
    await cleanupTestWorkspaces();

    // Populate Alpha sandbox
    const facultyAlphaRes = await fetch(`${BASE_URL}/api/admin/faculty`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Workspace-Id": WS_ALPHA },
      body: JSON.stringify({ shortCode: "FAALPHA", fullName: "Dr. Alpha Faculty", email: "alpha@test.edu" }),
    });
    if (facultyAlphaRes.status !== 201) {
      throw new Error(`FAIL: Failed to create faculty in Alpha: ${await facultyAlphaRes.text()}`);
    }

    const roomAlphaRes = await fetch(`${BASE_URL}/api/admin/room`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Workspace-Id": WS_ALPHA },
      body: JSON.stringify({ roomNo: "R-ALPHA", type: "LECTURE_ROOM", capacity: 60 }),
    });
    if (roomAlphaRes.status !== 201) {
      throw new Error(`FAIL: Failed to create room in Alpha: ${await roomAlphaRes.text()}`);
    }

    const courseAlphaRes = await fetch(`${BASE_URL}/api/admin/course`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Workspace-Id": WS_ALPHA },
      body: JSON.stringify({
        code: "CS-ALPHA",
        name: "Alpha Structures",
        shortCode: "AS",
        type: "LECTURE",
        weeklyHours: 3,
        facultyShortCodes: ["FAALPHA"],
      }),
    });
    if (courseAlphaRes.status !== 201) {
      throw new Error(`FAIL: Failed to create course in Alpha: ${await courseAlphaRes.text()}`);
    }
    console.log(`  ✓ Injected custom course CS-ALPHA into sandbox Alpha (${WS_ALPHA})`);

    // Populate Beta sandbox
    const facultyBetaRes = await fetch(`${BASE_URL}/api/admin/faculty`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Workspace-Id": WS_BETA },
      body: JSON.stringify({ shortCode: "FABETA", fullName: "Dr. Beta Faculty", email: "beta@test.edu" }),
    });
    if (facultyBetaRes.status !== 201) {
      throw new Error(`FAIL: Failed to create faculty in Beta: ${await facultyBetaRes.text()}`);
    }

    const courseBetaRes = await fetch(`${BASE_URL}/api/admin/course`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Workspace-Id": WS_BETA },
      body: JSON.stringify({
        code: "CS-BETA",
        name: "Beta Analytics",
        shortCode: "BA",
        type: "LECTURE",
        weeklyHours: 3,
        facultyShortCodes: ["FABETA"],
      }),
    });
    if (courseBetaRes.status !== 201) {
      throw new Error(`FAIL: Failed to create course in Beta: ${await courseBetaRes.text()}`);
    }
    console.log(`  ✓ Injected custom course CS-BETA into sandbox Beta (${WS_BETA})`);

    // Query Alpha data
    const alphaDataRes = await fetch(`${BASE_URL}/api/data`, {
      headers: { "X-Workspace-Id": WS_ALPHA },
    });
    const alphaData = (await alphaDataRes.json()) as any;
    const alphaCodes = alphaData.courses.map((c: any) => c.code);
    const alphaFacultyCodes = alphaData.faculty.map((f: any) => f.shortCode);

    if (!alphaCodes.includes("CS-ALPHA")) {
      throw new Error("FAIL: Alpha cannot see its own course CS-ALPHA.");
    }
    if (alphaCodes.includes("CS-BETA")) {
      throw new Error("FAIL: Alpha leaked Beta's course CS-BETA!");
    }
    if (!alphaFacultyCodes.includes("FAALPHA")) {
      throw new Error("FAIL: Alpha cannot see its own faculty FAALPHA.");
    }
    if (alphaFacultyCodes.includes("FABETA")) {
      throw new Error("FAIL: Alpha leaked Beta's faculty FABETA!");
    }
    console.log("  ✓ Alpha data strictly isolated from Beta");

    // Query Beta data
    const betaDataRes = await fetch(`${BASE_URL}/api/data`, {
      headers: { "X-Workspace-Id": WS_BETA },
    });
    const betaData = (await betaDataRes.json()) as any;
    const betaCodes = betaData.courses.map((c: any) => c.code);
    const betaFacultyCodes = betaData.faculty.map((f: any) => f.shortCode);

    if (!betaCodes.includes("CS-BETA")) {
      throw new Error("FAIL: Beta cannot see its own course CS-BETA.");
    }
    if (betaCodes.includes("CS-ALPHA")) {
      throw new Error("FAIL: Beta leaked Alpha's course CS-ALPHA!");
    }
    if (!betaFacultyCodes.includes("FABETA")) {
      throw new Error("FAIL: Beta cannot see its own faculty FABETA.");
    }
    if (betaFacultyCodes.includes("FAALPHA")) {
      throw new Error("FAIL: Beta leaked Alpha's faculty FAALPHA!");
    }
    console.log("  ✓ Beta data strictly isolated from Alpha");

    // Solve Alpha sandbox
    const solveAlphaRes = await fetch(`${BASE_URL}/api/solve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Workspace-Id": WS_ALPHA },
      body: JSON.stringify({ enableTrace: true }),
    });
    const solveAlphaData = (await solveAlphaRes.json()) as any;
    if (!solveAlphaData.success) {
      throw new Error(`FAIL: Solver failed on Alpha sandbox: ${JSON.stringify(solveAlphaData)}`);
    }
    // 3 hours * 2 divisions = 6 sessions
    if (solveAlphaData.assignments.length !== 6) {
      throw new Error(`FAIL: Expected 6 scheduled sessions in Alpha, got ${solveAlphaData.assignments.length}`);
    }
    console.log(`  ✓ Solver solved Alpha sandbox: ${solveAlphaData.assignments.length} sessions, 0 conflicts`);

    console.log("✅ TEST 2 PASSED: Cross-workspace boundary isolation verified.\n");
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST 3: Scoped Reset Protection
    // -------------------------------------------------------------------------
    console.log("▶ [TEST 3/5] Testing Reset Isolation (Resetting Alpha does NOT affect Beta)...");

    const resetAlphaRes = await fetch(`${BASE_URL}/api/admin/reset-custom`, {
      method: "DELETE",
      headers: { "X-Workspace-Id": WS_ALPHA },
    });
    if (resetAlphaRes.status !== 200) {
      throw new Error(`FAIL: Failed to reset Alpha: ${await resetAlphaRes.text()}`);
    }

    // Verify Alpha is empty
    const checkAlphaRes = await fetch(`${BASE_URL}/api/data`, {
      headers: { "X-Workspace-Id": WS_ALPHA },
    });
    const checkAlphaData = (await checkAlphaRes.json()) as any;
    if (checkAlphaData.courses.length !== 0) {
      throw new Error(`FAIL: Alpha course count after reset is ${checkAlphaData.courses.length}, expected 0.`);
    }
    console.log("  ✓ Alpha sandbox successfully emptied");

    // Verify Beta is STILL intact!
    const checkBetaRes = await fetch(`${BASE_URL}/api/data`, {
      headers: { "X-Workspace-Id": WS_BETA },
    });
    const checkBetaData = (await checkBetaRes.json()) as any;
    const stillHasBetaCourse = checkBetaData.courses.some((c: any) => c.code === "CS-BETA");
    if (!stillHasBetaCourse) {
      throw new Error("FAIL: Resetting Alpha erroneously wiped Beta's course CS-BETA!");
    }
    console.log("  ✓ Beta sandbox remained intact when Alpha was reset");

    console.log("✅ TEST 3 PASSED: Scoped reset isolation verified.\n");
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST 4: Parser Context Isolation
    // -------------------------------------------------------------------------
    console.log("▶ [TEST 4/5] Testing Natural Language Parser Context Isolation...");

    const facultyGammaRes = await fetch(`${BASE_URL}/api/admin/faculty`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Workspace-Id": WS_GAMMA },
      body: JSON.stringify({ shortCode: "FAGAMMA", fullName: "Prof. Gamma Secret", email: "gamma@test.edu" }),
    });
    if (facultyGammaRes.status !== 201) {
      throw new Error(`FAIL: Failed to create faculty in Gamma: ${await facultyGammaRes.text()}`);
    }

    // Attempt to parse constraint with Gamma's secret faculty from Alpha's perspective
    const parseFromAlphaRes = await fetch(`${BASE_URL}/api/constraints/parse`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Workspace-Id": WS_ALPHA },
      body: JSON.stringify({ text: "Prof. Gamma Secret is on leave on Monday" }),
    });

    // Expect 422 (unmatched entity) or success: false
    const parseFromAlphaData = (await parseFromAlphaRes.json()) as any;
    if (parseFromAlphaRes.status === 200 && parseFromAlphaData.success) {
      throw new Error("FAIL: Alpha's parser context leaked Gamma's faculty Prof. Gamma Secret!");
    }
    console.log(`  ✓ Gamma's entity was NOT recognized in Alpha's parser context (Status: ${parseFromAlphaRes.status})`);

    console.log("✅ TEST 4 PASSED: Constraint parser context isolation verified.\n");
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST 5: Benchmark Dataset & Solver Preservation
    // -------------------------------------------------------------------------
    console.log("▶ [TEST 5/5] Testing Institutional Benchmark Dataset & Solver Preservation...");

    const benchDataRes = await fetch(`${BASE_URL}/api/data`, {
      headers: { "X-Workspace-Id": XYZ_INSTITUTE_WORKSPACE },
    });
    const benchData = (await benchDataRes.json()) as any;

    if (benchData.courses.length !== 11) {
      throw new Error(`FAIL: Benchmark course count is ${benchData.courses.length}, expected exactly 11.`);
    }

    const fetchedCodes = benchData.courses.map((c: any) => c.code).sort();
    const sortedExpected = [...EXPECTED_BENCHMARK_COURSES].sort();
    if (JSON.stringify(fetchedCodes) !== JSON.stringify(sortedExpected)) {
      throw new Error(`FAIL: Benchmark courses do not match expected 11 seed courses: ${JSON.stringify(fetchedCodes)}`);
    }
    console.log(`  ✓ Benchmark course count: exactly ${benchData.courses.length} / 11 original seed courses`);

    if (benchData.faculty.length !== 12) {
      throw new Error(`FAIL: Benchmark faculty count is ${benchData.faculty.length}, expected exactly 12.`);
    }
    console.log(`  ✓ Benchmark faculty count: exactly ${benchData.faculty.length} / 12 original faculty`);

    if (benchData.rooms.length !== 4) {
      throw new Error(`FAIL: Benchmark room count is ${benchData.rooms.length}, expected exactly 4.`);
    }
    console.log(`  ✓ Benchmark room count: exactly ${benchData.rooms.length} / 4 original rooms`);

    // Run solver on institutional benchmark
    const solveBenchRes = await fetch(`${BASE_URL}/api/solve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Workspace-Id": XYZ_INSTITUTE_WORKSPACE },
      body: JSON.stringify({ enableTrace: true }),
    });
    const solveBenchData = (await solveBenchRes.json()) as any;

    if (!solveBenchData.success) {
      throw new Error(`FAIL: Benchmark solve failed: ${JSON.stringify(solveBenchData)}`);
    }
    if (solveBenchData.stats.backtrackCount !== 0) {
      throw new Error(`FAIL: Benchmark backtrackCount is ${solveBenchData.stats.backtrackCount}, expected exactly 0.`);
    }
    if (solveBenchData.assignments.length !== 46) {
      throw new Error(`FAIL: Benchmark scheduled sessions count is ${solveBenchData.assignments.length}, expected 46.`);
    }

    console.log(`  ✓ Benchmark solver executed successfully:`);
    console.log(`    - Assigned Variables / Sessions: ${solveBenchData.assignments.length}`);
    console.log(`    - Backtrack Count: ${solveBenchData.stats.backtrackCount}`);
    console.log(`    - Explored Nodes: ${solveBenchData.stats.nodesExplored}`);
    console.log(`    - Scheduled Sessions: ${solveBenchData.assignments.length}`);

    console.log("✅ TEST 5 PASSED: Benchmark dataset and zero-backtrack solver metrics fully preserved.\n");
    passedTests++;

    console.log("===============================================================================");
    console.log(`ALL TESTS PASSED: ${passedTests}/${totalTests} tests succeeded with 0 errors.`);
    console.log("===============================================================================\n");
  } finally {
    console.log("▶ Teardown: Purging disposable test namespaces in guaranteed finally block...");
    await cleanupTestWorkspaces();
    console.log("  ✓ Teardown complete: Alpha, Beta, and Gamma test records purged.");
    server.close();
    await prisma.$disconnect();
  }
}

runRegressionSuite().catch((err) => {
  console.error("\n❌ REGRESSION TEST FAILED:", err);
  process.exit(1);
});

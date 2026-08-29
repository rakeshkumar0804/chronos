import { solve } from "./solver.js";
import { SolverInput, Course, Faculty, FacultyCourseAssignment, Room, Division, TimeSlot, Constraint } from "./types.js";

/**
 * Large-Scale CSP Multi-Department Stress Benchmark.
 * Simulates 6 Divisions, 30 Faculty, 12 Rooms, and 120 Session Units.
 */
async function runStressBenchmark() {
  console.log("==========================================================================");
  console.log("  CHRONOS - Large-Scale Multi-Division CSP Stress Benchmark");
  console.log("==========================================================================\n");

  // 1. Generate 6 Academic Divisions
  const divisions: Division[] = [
    { id: "DIV_CSA", name: "CS-A", semester: 5, program: "B.Tech CSE" },
    { id: "DIV_CSB", name: "CS-B", semester: 5, program: "B.Tech CSE" },
    { id: "DIV_ITA", name: "IT-A", semester: 5, program: "B.Tech IT" },
    { id: "DIV_ITB", name: "IT-B", semester: 5, program: "B.Tech IT" },
    { id: "DIV_AIA", name: "AI-A", semester: 5, program: "B.Tech AI" },
    { id: "DIV_AIB", name: "AI-B", semester: 5, program: "B.Tech AI" },
  ];

  // 2. Generate 30 Faculty Members
  const faculty: Faculty[] = Array.from({ length: 30 }, (_, i) => {
    const num = i + 1;
    const code = `FAC_${num < 10 ? "0" + num : num}`;
    return {
      id: `F_${code}`,
      shortCode: code,
      fullName: `Dr. Faculty Member ${num}`,
      email: `faculty${num}@xyzinstitute.edu`,
    };
  });

  // 3. Generate 12 Rooms (8 Lecture Halls + 4 Labs)
  const rooms: Room[] = [
    ...Array.from({ length: 8 }, (_, i) => ({
      id: `R_LH_${i + 1}`,
      roomNo: `LH-${101 + i}`,
      type: "LECTURE_ROOM" as const,
      capacity: 60,
    })),
    ...Array.from({ length: 4 }, (_, i) => ({
      id: `R_LAB_${i + 1}`,
      roomNo: `LAB-${201 + i}`,
      type: "LAB" as const,
      capacity: 35,
    })),
  ];

  // 4. Generate 6 Standard Usable Days (Mon-Sat) × 6 Time Slots = 36 Slots/week
  const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const START_TIMES = ["07:30", "08:30", "09:45", "10:45", "12:45", "13:35"];
  const END_TIMES = ["08:30", "09:30", "10:45", "11:45", "13:35", "14:25"];

  const timeSlots: TimeSlot[] = [];
  for (const day of DAYS) {
    for (let t = 0; t < START_TIMES.length; t++) {
      timeSlots.push({
        id: `TS_${day}_${START_TIMES[t]}`,
        day: day as any,
        startTime: START_TIMES[t],
        endTime: END_TIMES[t],
        isBreak: false,
      });
    }
  }

  // 5. Generate 8 Core Courses (Total 20 Weekly Hours per division = 120 Total Units)
  const courses: Course[] = [
    { id: "C_DAA", code: "CS501", shortCode: "DAA", name: "Design & Analysis of Algorithms", weeklyHours: 3, type: "LECTURE" },
    { id: "C_DAAL", code: "CS501L", shortCode: "DAA-L", name: "Algorithms Lab", weeklyHours: 2, type: "LAB" },
    { id: "C_OS", code: "CS502", shortCode: "OS", name: "Operating Systems", weeklyHours: 3, type: "LECTURE" },
    { id: "C_OSL", code: "CS502L", shortCode: "OS-L", name: "Operating Systems Lab", weeklyHours: 2, type: "LAB" },
    { id: "C_DBMS", code: "CS503", shortCode: "DBMS", name: "Database Management Systems", weeklyHours: 3, type: "LECTURE" },
    { id: "C_CN", code: "CS504", shortCode: "CN", name: "Computer Networks", weeklyHours: 3, type: "LECTURE" },
    { id: "C_SE", code: "CS505", shortCode: "SE", name: "Software Engineering", weeklyHours: 2, type: "LECTURE" },
    { id: "C_AI", code: "CS506", shortCode: "AI", name: "Artificial Intelligence", weeklyHours: 2, type: "LECTURE" },
  ];

  // 6. Faculty Assignments (2-3 qualified faculty per course)
  const facultyCourseAssignments: FacultyCourseAssignment[] = [
    { courseId: "C_DAA", facultyId: faculty[0].id },
    { courseId: "C_DAA", facultyId: faculty[1].id },
    { courseId: "C_DAAL", facultyId: faculty[2].id },
    { courseId: "C_DAAL", facultyId: faculty[3].id },
    { courseId: "C_OS", facultyId: faculty[4].id },
    { courseId: "C_OS", facultyId: faculty[5].id },
    { courseId: "C_OSL", facultyId: faculty[6].id },
    { courseId: "C_DBMS", facultyId: faculty[7].id },
    { courseId: "C_DBMS", facultyId: faculty[8].id },
    { courseId: "C_CN", facultyId: faculty[9].id },
    { courseId: "C_CN", facultyId: faculty[10].id },
    { courseId: "C_SE", facultyId: faculty[11].id },
    { courseId: "C_SE", facultyId: faculty[12].id },
    { courseId: "C_AI", facultyId: faculty[13].id },
    { courseId: "C_AI", facultyId: faculty[14].id },
  ];

  // 7. Realistic Hard Constraints:
  // - Daily lecture limits
  // - 5 Key Professors on leave on specific days
  // - 2 Rooms blocked for maintenance
  const constraints: Constraint[] = [
    {
      id: "C_STRESS_DAILY_LIMIT",
      type: "HARD",
      category: "MAX_SESSIONS_PER_DAY",
      description: "Max 1 lecture of any course per day per division",
      structuredRule: { maxDailySessions: 1 },
    },
    {
      id: "C_FAC_01_LEAVE",
      type: "HARD",
      category: "FACULTY_UNAVAILABLE",
      description: "FAC_01 on leave Monday & Tuesday",
      structuredRule: { facultyShortCode: "FAC_01", days: ["MON", "TUE"] },
    },
    {
      id: "C_FAC_05_LEAVE",
      type: "HARD",
      category: "FACULTY_UNAVAILABLE",
      description: "FAC_05 on leave Thursday & Friday",
      structuredRule: { facultyShortCode: "FAC_05", days: ["THU", "FRI"] },
    },
    {
      id: "C_FAC_10_LEAVE",
      type: "HARD",
      category: "FACULTY_UNAVAILABLE",
      description: "FAC_10 on leave Wednesday & Saturday",
      structuredRule: { facultyShortCode: "FAC_10", days: ["WED", "SAT"] },
    },
    {
      id: "C_ROOM_LH101_MAINT",
      type: "HARD",
      category: "ROOM_UNAVAILABLE",
      description: "Room LH-101 blocked on Monday morning",
      structuredRule: { roomNo: "LH-101", days: ["MON"], startTimes: ["07:30", "08:30", "09:45"] },
    },
    {
      id: "C_ROOM_LAB201_MAINT",
      type: "HARD",
      category: "ROOM_UNAVAILABLE",
      description: "Lab LAB-201 blocked on Friday afternoon",
      structuredRule: { roomNo: "LAB-201", days: ["FRI"], startTimes: ["12:45", "13:35"] },
    },
  ];

  const problem: SolverInput = {
    courses,
    faculty,
    facultyCourseAssignments,
    rooms,
    divisions,
    timeSlots,
    constraints,
  };

  const totalSessionUnits = courses.reduce((s, c) => s + c.weeklyHours, 0) * divisions.length;

  console.log(`Problem Scale:`);
  console.log(` - Academic Divisions: ${divisions.length} (${divisions.map((d) => d.name).join(", ")})`);
  console.log(` - Faculty Pool: ${faculty.length} Professors`);
  console.log(` - Physical Rooms: ${rooms.length} (8 Lecture Halls, 4 Labs)`);
  console.log(` - Weekly Slots: ${timeSlots.length} Slots/week per room`);
  console.log(` - Total CSP Variables (Session Units): ${totalSessionUnits} Units`);
  console.log(` - Active Hard Constraints: ${constraints.length} Policies\n`);

  // -------------------------------------------------------------------------
  // Benchmark 1: MRV + Degree + LCV Guided Search (CHRONOS Smart Mode)
  // -------------------------------------------------------------------------
  console.log("--------------------------------------------------------------------------");
  console.log("  Benchmark 1: MRV + Degree + LCV Guided Backtracking (Smart Search)");
  console.log("--------------------------------------------------------------------------");

  const memBefore1 = process.memoryUsage().heapUsed;
  const startSmart = performance.now();
  const smartResult = solve(problem, {
    heuristicMode: "MRV_LCV",
    maxBacktracks: 100_000,
    timeoutMs: 60_000,
  });
  const elapsedSmart = performance.now() - startSmart;
  const memAfter1 = process.memoryUsage().heapUsed;
  const memDelta1 = ((memAfter1 - memBefore1) / (1024 * 1024)).toFixed(2);

  console.log(`Status: ${smartResult.success ? "✅ SOLVED" : "❌ FAILED"}`);
  console.log(`Execution Time: ${elapsedSmart.toFixed(2)} ms`);
  console.log(`Nodes Explored: ${smartResult.stats.nodesExplored.toLocaleString()}`);
  console.log(`Backtrack Count: ${smartResult.stats.backtrackCount.toLocaleString()}`);
  console.log(`Assignments Generated: ${smartResult.assignments.length} / ${totalSessionUnits}`);
  console.log(`Heap Delta: ${memDelta1} MB\n`);

  // -------------------------------------------------------------------------
  // Benchmark 2: Chronological Unguided Search (Naive Baseline)
  // -------------------------------------------------------------------------
  console.log("--------------------------------------------------------------------------");
  console.log("  Benchmark 2: Chronological Unguided Search (Naive Baseline)");
  console.log("--------------------------------------------------------------------------");

  const memBefore2 = process.memoryUsage().heapUsed;
  const startNaive = performance.now();
  const naiveResult = solve(problem, {
    heuristicMode: "CHRONOLOGICAL",
    maxBacktracks: 10_000, // Bounded search limit
    timeoutMs: 15_000,
  });
  const elapsedNaive = performance.now() - startNaive;
  const memAfter2 = process.memoryUsage().heapUsed;
  const memDelta2 = ((memAfter2 - memBefore2) / (1024 * 1024)).toFixed(2);

  console.log(`Status: ${naiveResult.success ? "✅ SOLVED" : "🔍 BOUNDED SEARCH LIMIT REACHED"}`);
  console.log(`Execution Time: ${elapsedNaive.toFixed(2)} ms`);
  console.log(`Nodes Explored: ${naiveResult.stats.nodesExplored.toLocaleString()}`);
  console.log(`Backtrack Count: ${naiveResult.stats.backtrackCount.toLocaleString()}`);
  console.log(`Assignments Generated: ${naiveResult.assignments.length} / ${totalSessionUnits}`);
  console.log(`Heap Delta: ${memDelta2} MB\n`);

  // -------------------------------------------------------------------------
  // Performance Comparative Analysis Table
  // -------------------------------------------------------------------------
  console.log("==========================================================================");
  console.log("  STRESS BENCHMARK COMPARISON SUMMARY (120 Session Units)");
  console.log("==========================================================================");
  console.log(`| Strategy                 | Solved? | Time (ms) | Nodes Explored | Backtracks |`);
  console.log(`|--------------------------|---------|-----------|----------------|------------|`);
  console.log(`| MRV + LCV (CHRONOS Smart)| ${smartResult.success ? "✅ YES  " : "❌ NO   "} | ${elapsedSmart.toFixed(1).padStart(7)} ms | ${smartResult.stats.nodesExplored.toString().padStart(14)} | ${smartResult.stats.backtrackCount.toString().padStart(10)} |`);
  console.log(`| Chronological (Naive)    | ${naiveResult.success ? "✅ YES  " : "🔍 LIMIT"} | ${elapsedNaive.toFixed(1).padStart(7)} ms | ${naiveResult.stats.nodesExplored.toString().padStart(14)} | ${naiveResult.stats.backtrackCount.toString().padStart(10)} |`);
  console.log("==========================================================================\n");

  if (!smartResult.success || smartResult.assignments.length !== 120) {
    throw new Error("Smart solver failed to solve the 120-unit stress problem.");
  }

  console.log("All stress benchmark assertions verified successfully!\n");
}

runStressBenchmark().catch((err) => {
  console.error("Stress Benchmark Error:", err);
  process.exit(1);
});

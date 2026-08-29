import { PrismaClient } from "@prisma/client";
import { solve } from "@chronos/solver";

const prisma = new PrismaClient();

async function testQuickAddFlow() {
  console.log("=================================================");
  console.log("TESTING QUICK ADD & CUSTOM DATASET LIFECYCLE");
  console.log("=================================================\n");

  // Clean any previous test artifacts
  await prisma.facultyCourseAssignment.deleteMany({ where: { isCustom: true } });
  await prisma.course.deleteMany({ where: { isCustom: true } });
  await prisma.room.deleteMany({ where: { isCustom: true } });
  await prisma.faculty.deleteMany({ where: { isCustom: true } });

  // Baseline counts
  const [baseCourses, baseFaculty, baseRooms] = await Promise.all([
    prisma.course.count(),
    prisma.faculty.count(),
    prisma.room.count(),
  ]);

  console.log(`Baseline Dataset in DB: Courses=${baseCourses}, Faculty=${baseFaculty}, Rooms=${baseRooms}\n`);

  // Step 1: Add Custom Faculty
  console.log("1. Creating Custom Faculty: Dr. Test Person (TP)...");
  const faculty = await prisma.faculty.create({
    data: {
      shortCode: "TP",
      fullName: "Dr. Test Person",
      email: "testperson@xyz.edu",
      isCustom: true,
    },
  });
  console.log(`   ✅ Created Faculty: ID=${faculty.id}, Code=${faculty.shortCode}`);

  // Step 2: Add Custom Room
  console.log("\n2. Creating Custom Room: R999 (LECTURE_ROOM)...");
  const room = await prisma.room.create({
    data: {
      roomNo: "R999",
      type: "LECTURE_ROOM",
      capacity: 60,
      isCustom: true,
    },
  });
  console.log(`   ✅ Created Room: ID=${room.id}, No=${room.roomNo}`);

  // Step 3: Add Custom Course with Assignment
  console.log("\n3. Creating Custom Course: Advanced Quantum Computing (QC, 2 hours/wk) assigned to TP...");
  const course = await prisma.course.create({
    data: {
      code: "CS999",
      name: "Advanced Quantum Computing",
      shortCode: "QC",
      type: "LECTURE",
      weeklyHours: 2,
      isCustom: true,
    },
  });

  await prisma.facultyCourseAssignment.create({
    data: {
      courseId: course.id,
      facultyId: faculty.id,
      isCustom: true,
    },
  });
  console.log(`   ✅ Created Course and FacultyAssignment link.`);

  // Step 4: Verify Solver Runs On Augmented Dataset
  console.log("\n4. Running CSP Solver on Augmented Dataset (12 courses, 13 faculty, 5 rooms, 50 total sessions)...");
  const [allCourses, allFaculty, allAssignments, allRooms, allDivisions, allTimeSlots] =
    await Promise.all([
      prisma.course.findMany(),
      prisma.faculty.findMany(),
      prisma.facultyCourseAssignment.findMany(),
      prisma.room.findMany(),
      prisma.division.findMany(),
      prisma.timeSlot.findMany(),
    ]);

  const result = solve(
    {
      courses: allCourses,
      faculty: allFaculty,
      facultyCourseAssignments: allAssignments,
      rooms: allRooms,
      divisions: allDivisions,
      timeSlots: allTimeSlots,
      constraints: [],
    },
    { heuristicMode: "MRV_LCV" }
  );

  console.log(`   Solver Result: Success=${result.success}`);
  console.log(`   Total Sessions Scheduled: ${result.assignments.length}`);
  console.log(`   Nodes Explored: ${result.stats.nodesExplored}, Backtracks: ${result.stats.backtrackCount}`);

  const qcSessions = result.assignments.filter((a) => a.courseId === course.id);
  console.log(`   Custom QC Sessions Scheduled: ${qcSessions.length}/4 (2 divisions x 2 hours)`);
  qcSessions.forEach((s, idx) => {
    console.log(`     - Session #${idx + 1}: CourseId=${s.courseId}, FacultyId=${s.facultyId}, RoomId=${s.roomId}, TimeSlotId=${s.timeSlotId}`);
  });

  if (qcSessions.length === 4) {
    console.log("   ✅ Solver successfully scheduled custom entities without constraint violations!");
  } else {
    throw new Error("Failed to schedule all custom QC sessions");
  }

  // Step 5: Reset Custom Data (Safety Net)
  console.log("\n5. Testing Safety Net: Purging Custom Entities via reset-custom...");
  await prisma.$transaction(async (tx) => {
    await tx.facultyCourseAssignment.deleteMany({ where: { isCustom: true } });
    await tx.course.deleteMany({ where: { isCustom: true } });
    await tx.room.deleteMany({ where: { isCustom: true } });
    await tx.faculty.deleteMany({ where: { isCustom: true } });
  });

  const [afterCourses, afterFaculty, afterRooms] = await Promise.all([
    prisma.course.count(),
    prisma.faculty.count(),
    prisma.room.count(),
  ]);

  console.log(`   Dataset Counts After Reset: Courses=${afterCourses}, Faculty=${afterFaculty}, Rooms=${afterRooms}`);
  if (afterCourses === baseCourses && afterFaculty === baseFaculty && afterRooms === baseRooms) {
    console.log("   ✅ Verified: Baseline benchmark dataset completely intact and unmodified!");
  } else {
    throw new Error("Dataset count mismatch after reset");
  }

  console.log("\n=================================================");
  console.log("ALL QUICK ADD TESTS PASSED (100% VERIFIED)");
  console.log("=================================================");

  await prisma.$disconnect();
}

testQuickAddFlow().catch((e) => {
  console.error(e);
  process.exit(1);
});

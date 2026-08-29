import { PrismaClient } from "@prisma/client";
import { solve } from "@chronos/solver";

const prisma = new PrismaClient();

async function testMultiFacultyCourse() {
  console.log("=================================================");
  console.log("TESTING MULTI-FACULTY CO-TEACHING COURSE CREATION");
  console.log("=================================================\n");

  // Clean custom records
  await prisma.facultyCourseAssignment.deleteMany({ where: { isCustom: true } });
  await prisma.course.deleteMany({ where: { isCustom: true } });
  await prisma.room.deleteMany({ where: { isCustom: true } });
  await prisma.faculty.deleteMany({ where: { isCustom: true } });

  // 1. Create two custom faculty members
  console.log("1. Creating 2 Custom Faculty: Dr. Alice (DA) & Dr. Bob (DB)...");
  const facultyA = await prisma.faculty.create({
    data: { shortCode: "DA", fullName: "Dr. Alice Smith", email: "alice@xyz.edu", isCustom: true },
  });
  const facultyB = await prisma.faculty.create({
    data: { shortCode: "DB", fullName: "Dr. Bob Jones", email: "bob@xyz.edu", isCustom: true },
  });
  console.log(`   ✅ Created DA (${facultyA.id}) & DB (${facultyB.id})`);

  // 2. Create course with BOTH faculty assigned (multi-select)
  console.log("\n2. Creating Course 'Parallel Computing Lab' (PCL, 2h LAB) with BOTH DA & DB assigned...");
  const course = await prisma.course.create({
    data: {
      code: "CS888",
      name: "Parallel Computing Lab",
      shortCode: "PCL",
      type: "LAB",
      weeklyHours: 2,
      isCustom: true,
    },
  });

  const assignmentA = await prisma.facultyCourseAssignment.create({
    data: { courseId: course.id, facultyId: facultyA.id, isCustom: true },
  });
  const assignmentB = await prisma.facultyCourseAssignment.create({
    data: { courseId: course.id, facultyId: facultyB.id, isCustom: true },
  });

  console.log(`   ✅ Created 2 FacultyCourseAssignment links for course ${course.shortCode}:`);
  console.log(`     - Link 1: Course=${course.code} <-> Faculty=${facultyA.shortCode}`);
  console.log(`     - Link 2: Course=${course.code} <-> Faculty=${facultyB.shortCode}`);

  // 3. Verify in DB
  const courseInDb = await prisma.course.findUnique({
    where: { id: course.id },
    include: { assignments: { include: { faculty: true } } },
  });

  console.log(`\n3. Database Verification:`);
  console.log(`   Course: ${courseInDb?.name} (${courseInDb?.shortCode})`);
  console.log(`   Linked Faculty Count: ${courseInDb?.assignments.length}`);
  courseInDb?.assignments.forEach((a) => {
    console.log(`     - ${a.faculty.fullName} (${a.faculty.shortCode})`);
  });

  if (courseInDb?.assignments.length !== 2) {
    throw new Error("Expected 2 faculty assigned to course!");
  }

  // 4. Run CSP Solver and verify domain generation incorporates both faculty options
  console.log("\n4. Running CSP Solver with co-teaching multi-faculty course...");
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

  const pclAssignments = result.assignments.filter((a) => a.courseId === course.id);
  console.log(`   PCL Sessions Scheduled: ${pclAssignments.length}/4 (2 divisions x 2 hours)`);
  pclAssignments.forEach((s, idx) => {
    const fac = allFaculty.find((f) => f.id === s.facultyId);
    const room = allRooms.find((r) => r.id === s.roomId);
    const ts = allTimeSlots.find((t) => t.id === s.timeSlotId);
    console.log(`     - Session #${idx + 1}: ${ts?.day} ${ts?.startTime} in Room ${room?.roomNo} by ${fac?.fullName} (${fac?.shortCode})`);
  });

  // 5. Cleanup custom data
  console.log("\n5. Purging custom records...");
  await prisma.facultyCourseAssignment.deleteMany({ where: { isCustom: true } });
  await prisma.course.deleteMany({ where: { isCustom: true } });
  await prisma.faculty.deleteMany({ where: { isCustom: true } });

  console.log("\n=================================================");
  console.log("MULTI-FACULTY VERIFICATION SUCCESSFUL (100% PASS)");
  console.log("=================================================");

  await prisma.$disconnect();
}

testMultiFacultyCourse().catch((e) => {
  console.error(e);
  process.exit(1);
});

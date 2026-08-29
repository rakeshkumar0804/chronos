import {
  PrismaClient,
  CourseType,
  RoomType,
  DayOfWeek
} from "@prisma/client";

const prisma = new PrismaClient();

// 1. Institute Data
const instituteData = {
  name: "XYZ Institute of Technology",
};

// 2. Divisions Data
const divisionsData = [
  { name: "5A15-1", semester: 5, program: "B.TECH CSE" },
  { name: "5A15-2", semester: 5, program: "B.TECH CSE" },
];

// 3. Rooms Data
const roomsData: Array<{ roomNo: string; type: RoomType }> = [
  { roomNo: "372", type: RoomType.LECTURE_ROOM },
  { roomNo: "132", type: RoomType.LECTURE_ROOM },
  { roomNo: "302", type: RoomType.LAB },
  { roomNo: "134", type: RoomType.LAB },
];

// 4. Faculty Data
const facultyData = [
  { shortCode: "CPP", fullName: "Prof. Chetan Prasad", email: "c.prasad@xyzinstitute.edu" },
  { shortCode: "MNM", fullName: "Ms. Meera N. Mehta", email: "m.mehta@xyzinstitute.edu" },
  { shortCode: "SS", fullName: "Mr. Sameer Sinha", email: "s.sinha@xyzinstitute.edu" },
  { shortCode: "ARP", fullName: "Ms. Anjali R. Pillai", email: "a.pillai@xyzinstitute.edu" },
  { shortCode: "KR", fullName: "Mr. Karan Rathi", email: "k.rathi@xyzinstitute.edu" },
  { shortCode: "GKH", fullName: "Mr. Girish K. Hooda", email: "g.hooda@xyzinstitute.edu" },
  { shortCode: "MJH", fullName: "Mr. Manish J. Hegde", email: "m.hegde@xyzinstitute.edu" },
  { shortCode: "JDD", fullName: "Ms. Juhi D. Desai", email: "j.desai@xyzinstitute.edu" },
  { shortCode: "FM", fullName: "Mr. Farhan Mecwan", email: "f.mecwan@xyzinstitute.edu" },
  { shortCode: "AS", fullName: "Mr. Aman Sharma", email: "a.sharma@xyzinstitute.edu" },
  { shortCode: "BD", fullName: "Ms. Bhavna Dutta", email: "b.dutta@xyzinstitute.edu" },
  { shortCode: "AKG", fullName: "Dr. Ashok K. Ganguly", email: "a.ganguly@xyzinstitute.edu" },
];

// 5. Courses Data
const coursesData: Array<{
  code: string;
  shortCode: string;
  name: string;
  type: CourseType;
  weeklyHours: number;
}> = [
  { code: "303105218", shortCode: "DAA", name: "Design and Analysis of Algorithms", type: CourseType.LECTURE, weeklyHours: 3 },
  { code: "303105219", shortCode: "DAA-L", name: "Design and Analysis of Algorithms Laboratory", type: CourseType.LAB, weeklyHours: 2 },
  { code: "303105306", shortCode: "TOC", name: "Theory of Computation", type: CourseType.LECTURE, weeklyHours: 2 },
  { code: "303105253", shortCode: "SE", name: "Software Engineering", type: CourseType.LECTURE, weeklyHours: 3 },
  { code: "303105254", shortCode: "SE-L", name: "Software Engineering Laboratory", type: CourseType.LAB, weeklyHours: 2 },
  { code: "303105309", shortCode: "EP", name: "Enterprise Programming", type: CourseType.LECTURE, weeklyHours: 2 },
  { code: "303105310", shortCode: "EP-L", name: "Enterprise Programming Laboratory", type: CourseType.LAB, weeklyHours: 2 },
  { code: "303193304", shortCode: "PCE", name: "Professionalism & Corporate Ethics", type: CourseType.LECTURE, weeklyHours: 1 },
  { code: "303105314", shortCode: "DADV", name: "Data Analytics and Data Visualization", type: CourseType.LECTURE, weeklyHours: 2 },
  { code: "303105315", shortCode: "DADV-L", name: "Data Analytics and Data Visualization Laboratory", type: CourseType.LAB, weeklyHours: 2 },
  { code: "303105302", shortCode: "AF", name: "Azure Fundamentals", type: CourseType.LECTURE, weeklyHours: 2 },
];

// 6. Faculty-Course mapping
const facultyCourseMap: Array<{ course: string; faculty: string[] }> = [
  { course: "DAA", faculty: ["CPP"] },
  { course: "DAA-L", faculty: ["MNM", "SS"] },
  { course: "TOC", faculty: ["ARP"] },
  { course: "SE", faculty: ["KR"] },
  { course: "SE-L", faculty: ["KR", "GKH"] },
  { course: "EP", faculty: ["MJH"] },
  { course: "EP-L", faculty: ["MJH", "JDD"] },
  { course: "PCE", faculty: ["FM"] },
  { course: "DADV", faculty: ["AS"] },
  { course: "DADV-L", faculty: ["AS", "BD"] },
  { course: "AF", faculty: ["AKG"] },
];

// 7. TimeSlot template (Mon–Sat)
const timeSlotTemplates: Array<{
  startTime: string;
  endTime: string;
  isBreak: boolean;
  breakLabel?: string | null;
}> = [
  { startTime: "07:30", endTime: "08:30", isBreak: false, breakLabel: null },
  { startTime: "08:30", endTime: "09:30", isBreak: false, breakLabel: null },
  { startTime: "09:30", endTime: "09:45", isBreak: true, breakLabel: "RECESS" },
  { startTime: "09:45", endTime: "10:45", isBreak: false, breakLabel: null },
  { startTime: "10:45", endTime: "11:45", isBreak: false, breakLabel: null },
  { startTime: "11:45", endTime: "12:45", isBreak: true, breakLabel: "LUNCH" },
  { startTime: "12:45", endTime: "13:35", isBreak: false, breakLabel: null },
  { startTime: "13:35", endTime: "14:25", isBreak: false, breakLabel: null },
];

const days: DayOfWeek[] = [
  DayOfWeek.MON,
  DayOfWeek.TUE,
  DayOfWeek.WED,
  DayOfWeek.THU,
  DayOfWeek.FRI,
  DayOfWeek.SAT,
];

async function main(): Promise<void> {
  const existingCourses = await prisma.course.count();
  if (existingCourses > 0) {
    console.log(`CHRONOS database already initialized with ${existingCourses} courses. Preserving all existing records and custom entities.`);
    return;
  }

  console.log("Seeding CHRONOS database with real timetable dataset for the first time...");

  // 1. Clean existing records in reverse order of foreign key dependencies
  await prisma.scheduleEntry.deleteMany();
  await prisma.constraint.deleteMany();
  await prisma.facultyCourseAssignment.deleteMany();
  await prisma.timeSlot.deleteMany();
  await prisma.course.deleteMany();
  await prisma.faculty.deleteMany();
  await prisma.room.deleteMany();
  await prisma.division.deleteMany();
  await prisma.institute.deleteMany();

  // 2. Create Institute
  const institute = await prisma.institute.create({
    data: instituteData,
  });
  console.log(`Created Institute: ${institute.name} (${institute.id})`);

  // 3. Create Divisions
  const divisions = await Promise.all(
    divisionsData.map((div) =>
      prisma.division.create({
        data: {
          ...div,
          instituteId: institute.id,
        },
      })
    )
  );
  console.log(`Created ${divisions.length} Divisions.`);

  // 4. Create Rooms
  const rooms = await Promise.all(
    roomsData.map((room) =>
      prisma.room.create({
        data: {
          ...room,
          instituteId: institute.id,
        },
      })
    )
  );
  console.log(`Created ${rooms.length} Rooms.`);

  // 5. Create Faculty
  const facultyRecords = await Promise.all(
    facultyData.map((fac) =>
      prisma.faculty.create({
        data: {
          ...fac,
          instituteId: institute.id,
        },
      })
    )
  );
  console.log(`Created ${facultyRecords.length} Faculty members.`);

  // Map faculty shortCode -> Faculty record
  const facultyMap = new Map<string, typeof facultyRecords[0]>();
  for (const fac of facultyRecords) {
    facultyMap.set(fac.shortCode, fac);
  }

  // 6. Create Courses
  const courseRecords = await Promise.all(
    coursesData.map((course) =>
      prisma.course.create({
        data: {
          ...course,
          instituteId: institute.id,
        },
      })
    )
  );
  console.log(`Created ${courseRecords.length} Courses.`);

  // Map course shortCode -> Course record
  const courseMap = new Map<string, typeof courseRecords[0]>();
  for (const c of courseRecords) {
    courseMap.set(c.shortCode, c);
  }

  // 7. Create FacultyCourseAssignments
  let assignmentCount = 0;
  for (const mapping of facultyCourseMap) {
    const course = courseMap.get(mapping.course);
    if (!course) {
      throw new Error(`Course shortCode ${mapping.course} not found in seeded courses`);
    }

    for (const facCode of mapping.faculty) {
      const fac = facultyMap.get(facCode);
      if (!fac) {
        throw new Error(`Faculty shortCode ${facCode} not found in seeded faculty`);
      }

      await prisma.facultyCourseAssignment.create({
        data: {
          facultyId: fac.id,
          courseId: course.id,
        },
      });
      assignmentCount++;
    }
  }
  console.log(`Created ${assignmentCount} Faculty-Course Assignments.`);

  // 8. Generate TimeSlots (6 days x 8 slots = 48 slots)
  const timeSlotEntries: Array<{
    day: DayOfWeek;
    startTime: string;
    endTime: string;
    isBreak: boolean;
    breakLabel?: string | null;
  }> = [];

  for (const day of days) {
    for (const slot of timeSlotTemplates) {
      timeSlotEntries.push({
        day,
        startTime: slot.startTime,
        endTime: slot.endTime,
        isBreak: slot.isBreak,
        breakLabel: slot.breakLabel || null,
      });
    }
  }

  await prisma.timeSlot.createMany({
    data: timeSlotEntries,
  });
  console.log(`Created ${timeSlotEntries.length} TimeSlots across Monday to Saturday.`);

  console.log("Seeding completed successfully without errors.");
}

main()
  .catch((e) => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

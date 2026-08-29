import { PrismaClient } from "@prisma/client";
import { parseConstraint } from "./parser.js";
import { ParserContext } from "./types.js";

const prisma = new PrismaClient();
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface TestCase {
  id: number;
  description: string;
  input: string;
  expectedSuccess: boolean;
  expectedCategory?: string;
  expectedType?: "HARD" | "SOFT";
}

const TEST_CASES: TestCase[] = [
  {
    id: 1,
    description: "Valid Faculty Unavailability (Prof. Karan Rathi -> KR, Mon/Tue)",
    input: "Prof. Karan Rathi is on leave on Monday and Tuesday",
    expectedSuccess: true,
    expectedCategory: "FACULTY_UNAVAILABLE",
    expectedType: "HARD",
  },
  {
    id: 2,
    description: "Valid Room Unavailability (Room 132 maintenance Fri morning)",
    input: "Room 132 is undergoing maintenance on Friday morning",
    expectedSuccess: true,
    expectedCategory: "ROOM_UNAVAILABLE",
    expectedType: "HARD",
  },
  {
    id: 3,
    description: "Valid Max Sessions Per Day (DAA, Div 5A15-1, max 1)",
    input: "At most 1 lecture session of DAA per day for division 5A15-1",
    expectedSuccess: true,
    expectedCategory: "MAX_SESSIONS_PER_DAY",
    expectedType: "HARD",
  },
  {
    id: 4,
    description: "Valid Soft Preference (Ms. Anjali Pillai -> ARP, Wed morning)",
    input: "Ms. Anjali Pillai prefers teaching in the morning on Wednesday",
    expectedSuccess: true,
    expectedCategory: "PREFERRED_TIME",
    expectedType: "SOFT",
  },
  {
    id: 5,
    description: "Hallucinated Non-Existent Faculty (Prof. Alex Whitmore)",
    input: "Prof. Alex Whitmore is unavailable on Wednesday",
    expectedSuccess: false,
  },
  {
    id: 6,
    description: "Hallucinated Non-Existent Room (Room 999)",
    input: "Room 999 is blocked on Thursday",
    expectedSuccess: false,
  },
  {
    id: 7,
    description: "Ambiguous / Conversational Non-Actionable Input",
    input: "The campus weather is beautiful today, let's have class outside",
    expectedSuccess: false,
  },
];

async function runTests() {
  console.log("=================================================");
  console.log("CHRONOS Phase 2B: NL Constraint Parser Test Suite");
  console.log("=================================================\n");

  const [courses, faculty, rooms, divisions, timeSlots] = await Promise.all([
    prisma.course.findMany({ orderBy: { code: "asc" } }),
    prisma.faculty.findMany({ orderBy: { shortCode: "asc" } }),
    prisma.room.findMany({ orderBy: { roomNo: "asc" } }),
    prisma.division.findMany({ orderBy: { name: "asc" } }),
    prisma.timeSlot.findMany({ orderBy: [{ day: "asc" }, { startTime: "asc" }] }),
  ]);

  const context: ParserContext = {
    facultyList: faculty.map((f) => ({ shortCode: f.shortCode, fullName: f.fullName, email: f.email })),
    roomList: rooms.map((r) => ({ roomNo: r.roomNo, type: r.type as any })),
    courseList: courses.map((c) => ({ code: c.code, shortCode: c.shortCode, name: c.name, type: c.type as any })),
    divisionList: divisions.map((d) => ({ name: d.name, semester: d.semester, program: d.program })),
    timeSlotList: timeSlots.map((ts) => ({ day: ts.day as any, startTime: ts.startTime, endTime: ts.endTime })),
  };

  console.log(`Loaded Context from Database: ${context.facultyList.length} faculty, ${context.roomList.length} rooms, ${context.courseList.length} courses, ${context.divisionList?.length} divisions.\n`);

  let passedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < TEST_CASES.length; i++) {
    const tc = TEST_CASES[i];
    console.log(`-------------------------------------------------`);
    console.log(`Test Case #${tc.id}: ${tc.description}`);
    console.log(`Input: "${tc.input}"`);

    const result = await parseConstraint(tc.input, context);

    let passed = false;
    let failureDetail = "";

    if (tc.expectedSuccess) {
      if (result.success && result.constraint) {
        const catMatch = !tc.expectedCategory || result.constraint.category === tc.expectedCategory;
        const typeMatch = !tc.expectedType || result.constraint.type === tc.expectedType;
        if (catMatch && typeMatch) {
          passed = true;
        } else {
          failureDetail = `Expected Category=${tc.expectedCategory}, Type=${tc.expectedType}, but got Category=${result.constraint.category}, Type=${result.constraint.type}`;
        }
      } else {
        failureDetail = `Expected success but failed with error: ${result.error}`;
      }
    } else {
      if (!result.success) {
        const errMsg = (result.error || "").toLowerCase();
        const isExpectedRejection =
          errMsg.includes("not found") ||
          errMsg.includes("not a recognized") ||
          errMsg.includes("not recognized") ||
          errMsg.includes("does not exist") ||
          errMsg.includes("ambiguous") ||
          errMsg.includes("conversational") ||
          errMsg.includes("unsupported") ||
          errMsg.includes("cannot identify");

        if (isExpectedRejection) {
          passed = true;
        } else {
          failureDetail = `Unexpected error message format: "${result.error}"`;
        }
      } else {
        failureDetail = `Expected failure but succeeded with constraint: ${JSON.stringify(result.constraint)}`;
      }
    }

    if (passed) {
      passedCount++;
      console.log(`Result: ✅ PASSED`);
      if (result.success) {
        console.log(`Parsed Constraint:`, JSON.stringify(result.constraint, null, 2));
      } else {
        console.log(`Rejected (Expected): "${result.error}"`);
      }
    } else {
      failedCount++;
      console.log(`Result: ❌ FAILED - ${failureDetail}`);
    }
    console.log("");

    if (process.env.GEMINI_API_KEY && i < TEST_CASES.length - 1) {
      console.log(`[Throttling] Waiting 12.5s before next request to respect Gemini Free Tier 5 RPM quota...`);
      await delay(12500);
    }
  }

  console.log("=================================================");
  console.log(`Summary: Total=${TEST_CASES.length}, Passed=${passedCount}, Failed=${failedCount}`);
  console.log("=================================================\n");

  await prisma.$disconnect();

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error("Test Suite Runner Error:", e);
  process.exit(1);
});

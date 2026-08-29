import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMINI_CONSTRAINT_RESPONSE_SCHEMA } from "./schema.js";
import { LLMConstraintOutput, ParserContext, ParserOptions } from "./types.js";

/**
 * Builds system instruction injecting the real institutional context so Gemini maps names to canonical codes.
 */
export function buildSystemPrompt(context: ParserContext): string {
  const facultySummary = context.facultyList
    .map((f) => `- ${f.fullName} (shortCode: "${f.shortCode}", email: ${f.email})`)
    .join("\n");

  const roomSummary = context.roomList
    .map((r) => `- Room ${r.roomNo} (type: ${r.type})`)
    .join("\n");

  const courseSummary = context.courseList
    .map((c) => `- ${c.name} (code: "${c.code}", shortCode: "${c.shortCode}", type: ${c.type})`)
    .join("\n");

  const divisionSummary = context.divisionList
    ? context.divisionList.map((d) => `- Division "${d.name}" (${d.program}, Sem ${d.semester})`).join("\n")
    : "- 5A15-1, 5A15-2";

  return `You are CHRONOS AI, an expert academic timetable constraint parser for XYZ Institute of Technology.
Your job is to convert natural language scheduling requests into strict structured timetable constraints.

INSTITUTIONAL CONTEXT (Use ONLY these exact canonical codes):
1. FACULTY MEMBERS:
${facultySummary}

2. ROOMS:
${roomSummary}

3. COURSES:
${courseSummary}

4. DIVISIONS:
${divisionSummary}

5. TIME SLOTS & DAYS:
- Valid Days: MON, TUE, WED, THU, FRI, SAT
- Valid Standard Slot Times: 07:30, 08:30, 09:45, 10:45, 12:45, 13:35

SUPPORTED CONSTRAINT CATEGORIES:
1. "FACULTY_UNAVAILABLE": When a faculty member cannot teach on specific days or times (e.g. leave, off-duty). (Type: HARD)
2. "ROOM_UNAVAILABLE": When a classroom or lab cannot be used on specific days or times (e.g. maintenance, renovation). (Type: HARD)
3. "MAX_SESSIONS_PER_DAY": Limits daily lecture/lab sessions for a course or division (e.g. "at most 1 lecture of DAA per day"). (Type: HARD)
4. "PREFERRED_TIME": Soft scheduling preference for faculty or courses (e.g. "prefers morning slots"). (Type: SOFT)
5. "UNKNOWN": Input does not map to any actionable timetable constraint, is conversational noise, or is too ambiguous.

CRITICAL RULES:
- Map faculty names to their exact shortCode (e.g., "Professor Karan Rathi" or "Karan" -> "KR", "Prof. Chetan Prasad" -> "CPP").
- If the text references a person, room, or course NOT in the institutional context above, do NOT make up or hallucinate codes. Output the name they mentioned in the appropriate field so validation will reject it, or mark as isSupported=false with ambiguityReason.
- If input is ambiguous, conversational chatter, or outside supported categories, set isSupported=false, category="UNKNOWN", and provide a clear ambiguityReason.`;
}

/**
 * Executes structured completion via Google Gemini API.
 */
export async function queryGemini(
  input: string,
  context: ParserContext,
  options?: ParserOptions
): Promise<LLMConstraintOutput> {
  const apiKey = options?.apiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not configured.");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const modelName = options?.model || process.env.GEMINI_MODEL || "gemini-1.5-flash";
  const systemInstruction = buildSystemPrompt(context);

  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction,
    generationConfig: {
      temperature: options?.temperature ?? 0,
      responseMimeType: "application/json",
      responseSchema: GEMINI_CONSTRAINT_RESPONSE_SCHEMA,
    },
  });

  const result = await model.generateContent(input);
  const rawJson = result.response.text();
  if (!rawJson) {
    throw new Error("Gemini API returned an empty response.");
  }

  return JSON.parse(rawJson) as LLMConstraintOutput;
}

/**
 * Deterministic local parser for offline testing / fallback when no external API key is supplied.
 * Implements the exact same context resolution, schema, and ambiguity detection rules.
 */
export function queryDeterministicFallback(
  input: string,
  context: ParserContext
): LLMConstraintOutput {
  const text = input.trim();
  const lower = text.toLowerCase();

  // 1. Detect nonsensical / out-of-domain queries
  const schedulingKeywords = [
    "not available",
    "unavailable",
    "leave",
    "maintenance",
    "blocked",
    "max",
    "at most",
    "prefer",
    "preference",
    "morning",
    "afternoon",
    "lecture",
    "lab",
    "room",
    "prof",
    "professor",
    "dr.",
    "ms.",
    "mr.",
  ];
  const hasSchedulingKeyword = schedulingKeywords.some((kw) => lower.includes(kw));
  if (!hasSchedulingKeyword && !lower.includes("mon") && !lower.includes("tue") && !lower.includes("wed") && !lower.includes("thu") && !lower.includes("fri") && !lower.includes("sat")) {
    return {
      isSupported: false,
      ambiguityReason: "Input is ambiguous or does not contain actionable scheduling constraint keywords or entities.",
      constraintType: "HARD",
      category: "UNKNOWN",
      description: text,
      structuredRule: {
        facultyShortCode: null,
        roomNo: null,
        courseCode: null,
        courseShortCode: null,
        divisionName: null,
        days: null,
        startTimes: null,
        max: null,
        preferredDays: null,
        preferredStartTimes: null,
      },
    };
  }

  // 2. Extract Days
  const days: string[] = [];
  if (lower.includes("monday") || lower.includes("mon")) days.push("MON");
  if (lower.includes("tuesday") || lower.includes("tue")) days.push("TUE");
  if (lower.includes("wednesday") || lower.includes("wed")) days.push("WED");
  if (lower.includes("thursday") || lower.includes("thu")) days.push("THU");
  if (lower.includes("friday") || lower.includes("fri")) days.push("FRI");
  if (lower.includes("saturday") || lower.includes("sat")) days.push("SAT");

  // 3. Extract Time of Day
  const startTimes: string[] = [];
  if (lower.includes("morning")) {
    startTimes.push("07:30", "08:30", "09:45");
  } else if (lower.includes("afternoon")) {
    startTimes.push("10:45", "12:45", "13:35");
  }

  // 4. Match Faculty
  let matchedFacultyCode: string | null = null;
  for (const fac of context.facultyList) {
    const cleanName = fac.fullName
      .toLowerCase()
      .replace(/^(?:prof(?:essor|\.)?|dr\.|mr\.|ms\.)\s+/i, "");
    const nameTokens = cleanName
      .split(/\s+/)
      .map((t) => t.replace(/[^a-z]/g, ""))
      .filter((t) => t.length > 2 && !["prof", "professor", "dr", "mr", "ms"].includes(t));

    const shortCode = fac.shortCode.toLowerCase();
    const matchesShortCode = new RegExp(`\\b${shortCode}\\b`, "i").test(text);
    const matchesName = nameTokens.some((t) => new RegExp(`\\b${t}\\b`, "i").test(text));

    if (matchesShortCode || matchesName) {
      matchedFacultyCode = fac.shortCode;
      break;
    }
  }

  // Check if text mentions a foreign/hallucinated professor name like "Alex Whitmore" or "Prof. X"
  if (!matchedFacultyCode && (lower.includes("prof") || lower.includes("professor") || lower.includes("dr.") || lower.includes("mr.") || lower.includes("ms."))) {
    const profMatch = text.match(/(?:prof(?:essor|\.)?|dr\.|mr\.|ms\.)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)/i);
    if (profMatch && profMatch[1]) {
      matchedFacultyCode = profMatch[1].trim(); // Will be caught by DB validator as unrecognized
    }
  }

  // 5. Match Room
  let matchedRoomNo: string | null = null;
  for (const r of context.roomList) {
    if (new RegExp(`\\b(?:room\\s*|lab\\s*)?${r.roomNo}\\b`, "i").test(text)) {
      matchedRoomNo = r.roomNo;
      break;
    }
  }
  if (!matchedRoomNo && /room\s+(\d+|[A-Za-z0-9]+)/i.test(text)) {
    const rm = text.match(/room\s+([A-Za-z0-9]+)/i);
    if (rm && rm[1]) matchedRoomNo = rm[1];
  }

  // 6. Match Course
  let matchedCourseCode: string | null = null;
  let matchedCourseShortCode: string | null = null;
  for (const c of context.courseList) {
    if (new RegExp(`\\b${c.shortCode}\\b`, "i").test(text) || lower.includes(c.name.toLowerCase())) {
      matchedCourseCode = c.code;
      matchedCourseShortCode = c.shortCode;
      break;
    }
  }

  // 7. Match Division
  let matchedDivisionName: string | null = null;
  if (context.divisionList) {
    for (const d of context.divisionList) {
      if (new RegExp(`\\b${d.name}\\b`, "i").test(text)) {
        matchedDivisionName = d.name;
        break;
      }
    }
  }

  // 8. Category Resolution
  if (lower.includes("prefer") || lower.includes("preference")) {
    return {
      isSupported: true,
      ambiguityReason: null,
      constraintType: "SOFT",
      category: "PREFERRED_TIME",
      description: text,
      structuredRule: {
        facultyShortCode: matchedFacultyCode,
        roomNo: matchedRoomNo,
        courseCode: matchedCourseCode,
        courseShortCode: matchedCourseShortCode,
        divisionName: matchedDivisionName,
        days: null,
        startTimes: null,
        max: null,
        preferredDays: days.length > 0 ? days : null,
        preferredStartTimes: startTimes.length > 0 ? startTimes : null,
      },
    };
  }

  if (lower.includes("max") || lower.includes("at most") || lower.includes("limit")) {
    const maxMatch = text.match(/(?:at most|max(?:imum)?)\s+(\d+)/i) || text.match(/(\d+)\s+(?:session|lecture|hour)/i);
    const maxVal = maxMatch ? parseInt(maxMatch[1], 10) : 1;
    return {
      isSupported: true,
      ambiguityReason: null,
      constraintType: "HARD",
      category: "MAX_SESSIONS_PER_DAY",
      description: text,
      structuredRule: {
        facultyShortCode: matchedFacultyCode,
        roomNo: matchedRoomNo,
        courseCode: matchedCourseCode,
        courseShortCode: matchedCourseShortCode,
        divisionName: matchedDivisionName,
        days: null,
        startTimes: null,
        max: maxVal,
        preferredDays: null,
        preferredStartTimes: null,
      },
    };
  }

  if (matchedRoomNo && (lower.includes("maintenance") || lower.includes("unavailable") || lower.includes("blocked") || lower.includes("closed"))) {
    return {
      isSupported: true,
      ambiguityReason: null,
      constraintType: "HARD",
      category: "ROOM_UNAVAILABLE",
      description: text,
      structuredRule: {
        facultyShortCode: null,
        roomNo: matchedRoomNo,
        courseCode: null,
        courseShortCode: null,
        divisionName: null,
        days: days.length > 0 ? days : null,
        startTimes: startTimes.length > 0 ? startTimes : null,
        max: null,
        preferredDays: null,
        preferredStartTimes: null,
      },
    };
  }

  if (matchedFacultyCode && (lower.includes("leave") || lower.includes("not available") || lower.includes("unavailable") || lower.includes("off"))) {
    return {
      isSupported: true,
      ambiguityReason: null,
      constraintType: "HARD",
      category: "FACULTY_UNAVAILABLE",
      description: text,
      structuredRule: {
        facultyShortCode: matchedFacultyCode,
        roomNo: null,
        courseCode: null,
        courseShortCode: null,
        divisionName: null,
        days: days.length > 0 ? days : null,
        startTimes: startTimes.length > 0 ? startTimes : null,
        max: null,
        preferredDays: null,
        preferredStartTimes: null,
      },
    };
  }

  return {
    isSupported: false,
    ambiguityReason: "Input is ambiguous or could not be mapped with confidence to a known scheduling constraint category.",
    constraintType: "HARD",
    category: "UNKNOWN",
    description: text,
    structuredRule: {
      facultyShortCode: matchedFacultyCode,
      roomNo: matchedRoomNo,
      courseCode: matchedCourseCode,
      courseShortCode: matchedCourseShortCode,
      divisionName: matchedDivisionName,
      days: days.length > 0 ? days : null,
      startTimes: startTimes.length > 0 ? startTimes : null,
      max: null,
      preferredDays: null,
      preferredStartTimes: null,
    },
  };
}

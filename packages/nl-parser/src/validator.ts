import { Constraint } from "@chronos/shared";
import { LLMConstraintOutput, ParserContext, ValidationResult } from "./types.js";

const VALID_DAYS = new Set(["MON", "TUE", "WED", "THU", "FRI", "SAT"]);

/**
 * Validates LLM structured constraint output against institutional context/database.
 * Ensures zero hallucination and enforces schema integrity before acceptance.
 */
export function validateParsedConstraint(
  output: LLMConstraintOutput,
  context: ParserContext
): ValidationResult {
  // 1. Check if LLM flagged input as unsupported or ambiguous
  if (!output.isSupported || output.category === "UNKNOWN") {
    return {
      valid: false,
      error: output.ambiguityReason || "Input is ambiguous, non-actionable, or outside supported constraint categories.",
    };
  }

  const { category, constraintType, description, structuredRule } = output;
  const cleanedRule: Record<string, unknown> = {};

  // 2. Validate category-specific rules
  switch (category) {
    case "FACULTY_UNAVAILABLE": {
      const code = structuredRule.facultyShortCode;
      if (!code) {
        return {
          valid: false,
          error: "Validation Error: FACULTY_UNAVAILABLE constraint requires a specific facultyShortCode.",
        };
      }

      // Check against real database faculty list
      const matchedFaculty = context.facultyList.find(
        (f) => f.shortCode.toUpperCase() === code.toUpperCase()
      );
      if (!matchedFaculty) {
        return {
          valid: false,
          error: `Validation Error: Faculty code '${code}' does not exist in the institutional database.`,
        };
      }

      cleanedRule.facultyShortCode = matchedFaculty.shortCode;

      // Validate days
      if (structuredRule.days && structuredRule.days.length > 0) {
        const invalidDays = structuredRule.days.filter((d) => !VALID_DAYS.has(d.toUpperCase()));
        if (invalidDays.length > 0) {
          return {
            valid: false,
            error: `Validation Error: Invalid day(s) provided: ${invalidDays.join(", ")}. Must be MON-SAT.`,
          };
        }
        cleanedRule.days = structuredRule.days.map((d) => d.toUpperCase());
      }

      // Validate start times if present
      if (structuredRule.startTimes && structuredRule.startTimes.length > 0) {
        cleanedRule.startTimes = structuredRule.startTimes;
      }

      if (!cleanedRule.days && !cleanedRule.startTimes) {
        return {
          valid: false,
          error: "Validation Error: FACULTY_UNAVAILABLE must specify at least one day or time slot.",
        };
      }
      break;
    }

    case "ROOM_UNAVAILABLE": {
      const roomNo = structuredRule.roomNo;
      if (!roomNo) {
        return {
          valid: false,
          error: "Validation Error: ROOM_UNAVAILABLE constraint requires a specific roomNo.",
        };
      }

      // Check against real database room list
      const matchedRoom = context.roomList.find(
        (r) => r.roomNo.toUpperCase() === roomNo.toUpperCase()
      );
      if (!matchedRoom) {
        return {
          valid: false,
          error: `Validation Error: Room '${roomNo}' does not exist in the institutional database.`,
        };
      }

      cleanedRule.roomNo = matchedRoom.roomNo;

      if (structuredRule.days && structuredRule.days.length > 0) {
        const invalidDays = structuredRule.days.filter((d) => !VALID_DAYS.has(d.toUpperCase()));
        if (invalidDays.length > 0) {
          return {
            valid: false,
            error: `Validation Error: Invalid day(s) provided: ${invalidDays.join(", ")}. Must be MON-SAT.`,
          };
        }
        cleanedRule.days = structuredRule.days.map((d) => d.toUpperCase());
      }

      if (structuredRule.startTimes && structuredRule.startTimes.length > 0) {
        cleanedRule.startTimes = structuredRule.startTimes;
      }

      if (!cleanedRule.days && !cleanedRule.startTimes) {
        return {
          valid: false,
          error: "Validation Error: ROOM_UNAVAILABLE must specify at least one day or time slot.",
        };
      }
      break;
    }

    case "MAX_SESSIONS_PER_DAY": {
      const max = structuredRule.max;
      if (max === null || max === undefined || typeof max !== "number" || max < 1) {
        return {
          valid: false,
          error: "Validation Error: MAX_SESSIONS_PER_DAY requires a valid positive integer 'max'.",
        };
      }
      cleanedRule.maxDailySessions = max;

      if (structuredRule.courseShortCode) {
        const courseCode = structuredRule.courseShortCode;
        const matchedCourse = context.courseList.find(
          (c) =>
            c.shortCode.toUpperCase() === courseCode.toUpperCase() ||
            c.code.toUpperCase() === courseCode.toUpperCase()
        );
        if (!matchedCourse) {
          return {
            valid: false,
            error: `Validation Error: Course '${courseCode}' does not exist in the institutional database.`,
          };
        }
        cleanedRule.courseShortCode = matchedCourse.shortCode;
      }

      if (structuredRule.divisionName && context.divisionList) {
        const divName = structuredRule.divisionName;
        const matchedDiv = context.divisionList.find(
          (d) => d.name.toUpperCase() === divName.toUpperCase()
        );
        if (!matchedDiv) {
          return {
            valid: false,
            error: `Validation Error: Division '${divName}' does not exist in the institutional database.`,
          };
        }
        cleanedRule.divisionName = matchedDiv.name;
      }
      break;
    }

    case "PREFERRED_TIME": {
      if (constraintType !== "SOFT") {
        return {
          valid: false,
          error: "Validation Error: PREFERRED_TIME constraints must be marked as SOFT.",
        };
      }

      if (structuredRule.facultyShortCode) {
        const code = structuredRule.facultyShortCode;
        const matchedFaculty = context.facultyList.find(
          (f) => f.shortCode.toUpperCase() === code.toUpperCase()
        );
        if (!matchedFaculty) {
          return {
            valid: false,
            error: `Validation Error: Faculty code '${code}' does not exist in the institutional database.`,
          };
        }
        cleanedRule.facultyShortCode = matchedFaculty.shortCode;
      }

      if (structuredRule.courseShortCode) {
        const code = structuredRule.courseShortCode;
        const matchedCourse = context.courseList.find(
          (c) =>
            c.shortCode.toUpperCase() === code.toUpperCase() ||
            c.code.toUpperCase() === code.toUpperCase()
        );
        if (!matchedCourse) {
          return {
            valid: false,
            error: `Validation Error: Course '${code}' does not exist in the institutional database.`,
          };
        }
        cleanedRule.courseShortCode = matchedCourse.shortCode;
      }

      if (structuredRule.preferredDays && structuredRule.preferredDays.length > 0) {
        cleanedRule.preferredDays = structuredRule.preferredDays.map((d) => d.toUpperCase());
      }
      if (structuredRule.preferredStartTimes && structuredRule.preferredStartTimes.length > 0) {
        cleanedRule.preferredStartTimes = structuredRule.preferredStartTimes;
      }

      if (!cleanedRule.preferredDays && !cleanedRule.preferredStartTimes) {
        return {
          valid: false,
          error: "Validation Error: PREFERRED_TIME must specify at least one preferred day or time slot.",
        };
      }
      break;
    }

    default:
      return {
        valid: false,
        error: `Validation Error: Unsupported constraint category '${category}'.`,
      };
  }

  const constraint: Constraint = {
    id: `C_PARSED_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    type: constraintType,
    category,
    description: description || "Natural language parsed constraint",
    structuredRule: cleanedRule,
  };

  return {
    valid: true,
    constraint,
  };
}

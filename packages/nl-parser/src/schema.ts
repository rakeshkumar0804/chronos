import { ResponseSchema, SchemaType } from "@google/generative-ai";

/**
 * Google Gemini Structured Outputs Response Schema for Constraint Parsing.
 * Configured with responseMimeType: "application/json" and responseSchema.
 */
export const GEMINI_CONSTRAINT_RESPONSE_SCHEMA: ResponseSchema = {
  type: SchemaType.OBJECT,
  description: "Structured timetable constraint parsed from natural language scheduling requirements.",
  properties: {
    isSupported: {
      type: SchemaType.BOOLEAN,
      description: "True if the user input maps cleanly to a supported constraint category. False if ambiguous, nonsensical, or unsupported.",
    },
    ambiguityReason: {
      type: SchemaType.STRING,
      description: "Clear explanation if the input is ambiguous, non-actionable, or outside the supported categories. Null/empty if supported.",
      nullable: true,
    },
    constraintType: {
      type: SchemaType.STRING,
      format: "enum",
      enum: ["HARD", "SOFT"],
      description: "HARD for non-negotiable restrictions (unavailability, max limits). SOFT for preferences.",
    },
    category: {
      type: SchemaType.STRING,
      format: "enum",
      enum: ["FACULTY_UNAVAILABLE", "ROOM_UNAVAILABLE", "MAX_SESSIONS_PER_DAY", "PREFERRED_TIME", "UNKNOWN"],
      description: "The specific constraint category mapped from natural language.",
    },
    description: {
      type: SchemaType.STRING,
      description: "Clean, standardized human-readable summary of the constraint.",
    },
    structuredRule: {
      type: SchemaType.OBJECT,
      description: "The structured parameters governing this constraint.",
      properties: {
        facultyShortCode: {
          type: SchemaType.STRING,
          description: "The faculty member's exact shortCode (e.g., 'KR', 'CPP') from provided context, or null.",
          nullable: true,
        },
        roomNo: {
          type: SchemaType.STRING,
          description: "The room number (e.g., '132', '372', '302', '134') from provided context, or null.",
          nullable: true,
        },
        courseCode: {
          type: SchemaType.STRING,
          description: "The course code (e.g., '303105218') from provided context, or null.",
          nullable: true,
        },
        courseShortCode: {
          type: SchemaType.STRING,
          description: "The course shortCode (e.g., 'DAA', 'SE', 'TOC') from provided context, or null.",
          nullable: true,
        },
        divisionName: {
          type: SchemaType.STRING,
          description: "The division name (e.g., '5A15-1', '5A15-2') from provided context, or null.",
          nullable: true,
        },
        days: {
          type: SchemaType.ARRAY,
          description: "Days of week affected: MON, TUE, WED, THU, FRI, SAT.",
          items: {
            type: SchemaType.STRING,
            format: "enum",
            enum: ["MON", "TUE", "WED", "THU", "FRI", "SAT"],
          },
          nullable: true,
        },
        startTimes: {
          type: SchemaType.ARRAY,
          description: "Specific start times affected (e.g. ['07:30', '08:30']), or null.",
          items: {
            type: SchemaType.STRING,
          },
          nullable: true,
        },
        max: {
          type: SchemaType.INTEGER,
          description: "Maximum allowed count (e.g., 1 for max sessions per day), or null.",
          nullable: true,
        },
        preferredDays: {
          type: SchemaType.ARRAY,
          description: "Preferred days of week for SOFT preference constraints.",
          items: {
            type: SchemaType.STRING,
            format: "enum",
            enum: ["MON", "TUE", "WED", "THU", "FRI", "SAT"],
          },
          nullable: true,
        },
        preferredStartTimes: {
          type: SchemaType.ARRAY,
          description: "Preferred start times for SOFT preference constraints.",
          items: {
            type: SchemaType.STRING,
          },
          nullable: true,
        },
      },
      required: [
        "facultyShortCode",
        "roomNo",
        "courseCode",
        "courseShortCode",
        "divisionName",
        "days",
        "startTimes",
        "max",
        "preferredDays",
        "preferredStartTimes",
      ],
    },
  },
  required: ["isSupported", "constraintType", "category", "description", "structuredRule"],
};

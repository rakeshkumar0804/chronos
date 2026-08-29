import { Constraint, ConstraintType, Course, Division, Faculty, Room, TimeSlot } from "@chronos/shared";

export type SupportedConstraintCategory =
  | "FACULTY_UNAVAILABLE"
  | "ROOM_UNAVAILABLE"
  | "MAX_SESSIONS_PER_DAY"
  | "PREFERRED_TIME"
  | "UNKNOWN";

export interface ParserContext {
  facultyList: Array<Pick<Faculty, "shortCode" | "fullName" | "email">>;
  roomList: Array<Pick<Room, "roomNo" | "type">>;
  courseList: Array<Pick<Course, "code" | "shortCode" | "name" | "type">>;
  divisionList?: Array<Pick<Division, "name" | "semester" | "program">>;
  timeSlotList?: Array<Pick<TimeSlot, "day" | "startTime" | "endTime">>;
}

export interface LLMStructuredRule {
  facultyShortCode?: string | null;
  roomNo?: string | null;
  courseCode?: string | null;
  courseShortCode?: string | null;
  divisionName?: string | null;
  days?: string[] | null;
  startTimes?: string[] | null;
  max?: number | null;
  preferredDays?: string[] | null;
  preferredStartTimes?: string[] | null;
}

export interface LLMConstraintOutput {
  isSupported: boolean;
  ambiguityReason?: string | null;
  constraintType: ConstraintType;
  category: SupportedConstraintCategory;
  description: string;
  structuredRule: LLMStructuredRule;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  constraint?: Constraint;
}

export interface ParseResult {
  success: boolean;
  constraint?: Constraint;
  rawLLMOutput?: LLMConstraintOutput;
  error?: string;
}

export interface ParserOptions {
  apiKey?: string;
  model?: string;
  temperature?: number;
  useFallbackIfNoKey?: boolean;
}

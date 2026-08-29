import {
  Course,
  Faculty,
  FacultyCourseAssignment,
  Room,
  Division,
  TimeSlot,
  ScheduleEntry,
  Constraint,
  DayOfWeek
} from "@chronos/shared";

export type {
  Course,
  Faculty,
  FacultyCourseAssignment,
  Room,
  Division,
  TimeSlot,
  ScheduleEntry,
  Constraint,
  DayOfWeek
};

export interface SolverInput {
  courses: Course[];
  faculty: Faculty[];
  facultyCourseAssignments: FacultyCourseAssignment[];
  rooms: Room[];
  divisions: Division[];
  timeSlots: TimeSlot[];
  constraints?: Constraint[];
}

export type SchedulingProblem = SolverInput;
export type ScheduleAssignment = ScheduleEntry;
export type SolverMetrics = SolverStats;

export interface SolverOptions {
  enableTrace?: boolean;
  maxBacktracks?: number;
  timeoutMs?: number;
  heuristicMode?: "MRV_LCV" | "MRV_ONLY" | "INTERLEAVED" | "CHRONOLOGICAL" | "STATIC_DIFFICULTY";
  valueOrdering?: "LCV" | "NATURAL" | "DIVISION_OFFSET" | "ROOM_PREFERENCE" | "PREFER_EARLY_SLOTS";
}

export interface SolverStats {
  nodesExplored: number;
  backtrackCount: number;
  timeMs: number;
  domainsPruned?: number;
  maxDepth?: number;
}

export interface SolverTraceEvent {
  type: "assign" | "conflict" | "backtrack";
  variable: string;
  value?: string;
  timestamp: number;
  details?: string;
}

/**
 * Granular step event snapshots yielded by the generator solver for frontend visualization.
 */
export type SolverStepEvent =
  | { type: "VARIABLE_SELECTED"; variableId: string; remainingDomainCount: number }
  | { type: "VALUE_TRIED"; variableId: string; value: DomainAssignmentValue }
  | { type: "DOMAIN_PRUNED"; variableId: string; prunedValue: DomainAssignmentValue; reason: string }
  | { type: "CONFLICT_DETECTED"; variableId: string; conflictingConstraint: string; conflictWith: string }
  | { type: "BACKTRACK"; variableId: string; restoredDomainsCount: number }
  | { type: "ASSIGNMENT_SUCCESS"; variableId: string; value: DomainAssignmentValue }
  | { type: "SOLUTION_FOUND"; schedule: ScheduleEntry[]; metrics: SolverStats }
  | { type: "UNSATISFIABLE"; metrics: SolverStats };

export interface SolverResult {
  success: boolean;
  assignments: ScheduleEntry[];
  stats: SolverStats;
  trace?: SolverTraceEvent[];
  failureReason?: string;
}

/**
 * Internal representation of a CSP Variable (a single session requirement)
 */
export interface SessionVariable {
  id: string; // e.g. "VAR_5A15-1_DAA_1"
  courseId: string;
  courseCode: string;
  courseShortCode: string;
  courseType: "LECTURE" | "LAB";
  divisionId: string;
  divisionName: string;
  sessionIndex: number; // 1-based index up to weeklyHours
}

/**
 * Internal representation of a legal value in a variable's domain
 */
export interface DomainAssignmentValue {
  id: string; // e.g. "VAL_TS1_R1_F1"
  timeSlotId: string;
  roomId: string;
  facultyId: string;
  timeSlotDay: DayOfWeek | string;
  timeSlotStartTime: string;
  roomNo: string;
  facultyShortCode: string;
}

export type DomainValue = DomainAssignmentValue;

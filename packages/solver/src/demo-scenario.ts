import { Constraint } from "@chronos/shared";

/**
 * Fixed, locked demo scenario definitions for Phase 3 visualization.
 * DO NOT re-randomize or alter these definitions.
 */

// Official Loosened Comparison Scenario (Attempt B: 30-slot week + KR Mon/Tue + CPP Fri)
// Solves completely in both CHRONOLOGICAL and MRV_LCV modes.
export const demoScenarioLoosened: Constraint[] = [
  {
    id: "C_DAILY_LECTURE_LIMIT",
    type: "HARD",
    category: "DAILY_COURSE_LIMIT",
    description: "At most 1 lecture session of any course per day per division",
    structuredRule: { maxDailySessions: 1 },
  },
  {
    id: "C_BLOCK_1335",
    type: "HARD",
    category: "ROOM_UNAVAILABILITY",
    description: "Slot 13:35 blocked on all days across all rooms (30 slots/week per room)",
    structuredRule: { startTimes: ["13:35"] },
  },
  {
    id: "C_KR_LEAVE_MON_TUE",
    type: "HARD",
    category: "FACULTY_UNAVAILABILITY",
    description: "Prof. Karan Rathi (KR) on leave Monday & Tuesday (available Wed-Sat)",
    structuredRule: { facultyShortCode: "KR", days: ["MON", "TUE"] },
  },
  {
    id: "C_CPP_LEAVE_FRI",
    type: "HARD",
    category: "FACULTY_UNAVAILABILITY",
    description: "Prof. Chetan Prasad (CPP) on leave Friday only (available Mon-Thu, Sat)",
    structuredRule: { facultyShortCode: "CPP", days: ["FRI"] },
  },
];

// Official Stress Bottleneck Scenario (Sweep 1: 30-slot week + KR Mon/Tue + CPP Thu/Fri)
// CHRONOLOGICAL mode explores deep search tree (101,230 backtracks, 290,330 trace events)
// Demonstrates naive vs smart constraint propagation for Phase 3 side-by-side.
export const demoScenarioNaiveVsSmart: Constraint[] = [
  {
    id: "C_DAILY_LECTURE_LIMIT",
    type: "HARD",
    category: "DAILY_COURSE_LIMIT",
    description: "At most 1 lecture session of any course per day per division",
    structuredRule: { maxDailySessions: 1 },
  },
  {
    id: "C_BLOCK_1335",
    type: "HARD",
    category: "ROOM_UNAVAILABILITY",
    description: "Slot 13:35 blocked on all days across all rooms (30 slots/week per room)",
    structuredRule: { startTimes: ["13:35"] },
  },
  {
    id: "C_KR_LEAVE_MON_TUE",
    type: "HARD",
    category: "FACULTY_UNAVAILABILITY",
    description: "Prof. Karan Rathi (KR) on leave Monday & Tuesday (available Wed-Sat)",
    structuredRule: { facultyShortCode: "KR", days: ["MON", "TUE"] },
  },
  {
    id: "C_CPP_LEAVE_THU_FRI",
    type: "HARD",
    category: "FACULTY_UNAVAILABILITY",
    description: "Prof. Chetan Prasad (CPP) on leave Thursday & Friday (available Mon-Wed, Sat)",
    structuredRule: { facultyShortCode: "CPP", days: ["THU", "FRI"] },
  },
];

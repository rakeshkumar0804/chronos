import { ScheduleEntry } from "@chronos/shared";
import {
  SolverInput,
  SolverOptions,
  SolverResult,
  SolverTraceEvent,
  SessionVariable,
  DomainAssignmentValue
} from "./types.js";

/**
 * Deterministic Backtracking CSP Solver with MRV, LCV, and Forward Checking.
 */
export function solve(input: SolverInput, options: SolverOptions = {}): SolverResult {
  const startTime = performance.now();
  const enableTrace = options.enableTrace ?? false;
  const maxBacktracks = options.maxBacktracks ?? 500_000;
  const timeoutMs = options.timeoutMs ?? 30_000;

  const trace: SolverTraceEvent[] = [];
  let nodesExplored = 0;
  let backtrackCount = 0;

  function logTrace(type: "assign" | "conflict" | "backtrack", variable: string, value?: string, details?: string): void {
    if (!enableTrace) return;
    trace.push({
      type,
      variable,
      value,
      timestamp: performance.now() - startTime,
      details,
    });
  }

  // 1. Deterministically sort inputs to eliminate database query ordering variance
  const DAY_ORDER: Record<string, number> = { MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6, SUN: 7 };

  const CURRICULUM_ORDER: Record<string, number> = {
    "DAA": 1,
    "DAA-L": 2,
    "TOC": 3,
    "SE": 4,
    "SE-L": 5,
    "EP": 6,
    "EP-L": 7,
    "PCE": 8,
    "DADV": 9,
    "DADV-L": 10,
    "AF": 11,
  };

  const ROOM_ORDER: Record<string, number> = {
    "372": 1,
    "132": 2,
    "302": 3,
    "134": 4,
  };

  const sortedCourses = [...input.courses].sort((a, b) => {
    const orderA = CURRICULUM_ORDER[a.shortCode] || 99;
    const orderB = CURRICULUM_ORDER[b.shortCode] || 99;
    if (orderA !== orderB) return orderA - orderB;
    return a.code.localeCompare(b.code);
  });
  const sortedDivisions = [...input.divisions].sort((a, b) => a.name.localeCompare(b.name));
  const sortedFaculty = [...input.faculty].sort((a, b) => a.shortCode.localeCompare(b.shortCode));
  const sortedRooms = [...input.rooms].sort((a, b) => {
    const orderA = ROOM_ORDER[a.roomNo] || 99;
    const orderB = ROOM_ORDER[b.roomNo] || 99;
    if (orderA !== orderB) return orderA - orderB;
    return a.roomNo.localeCompare(b.roomNo);
  });
  const usableTimeSlots = [...input.timeSlots]
    .filter((ts) => !ts.isBreak)
    .sort((a, b) => {
      const dayDiff = (DAY_ORDER[a.day] || 99) - (DAY_ORDER[b.day] || 99);
      if (dayDiff !== 0) return dayDiff;
      return a.startTime.localeCompare(b.startTime);
    });

  const facultyMap = new Map(sortedFaculty.map((f) => [f.id, f]));

  // Allowed faculty per course (sorted deterministically)
  const courseFacultyMap = new Map<string, string[]>();
  for (const fca of input.facultyCourseAssignments) {
    const list = courseFacultyMap.get(fca.courseId) || [];
    list.push(fca.facultyId);
    courseFacultyMap.set(fca.courseId, list);
  }
  for (const [, fList] of courseFacultyMap.entries()) {
    fList.sort((a, b) => {
      const fA = facultyMap.get(a)?.shortCode || a;
      const fB = facultyMap.get(b)?.shortCode || b;
      return fA.localeCompare(fB);
    });
  }

  // Usable rooms partitioned by type
  const lectureRooms = sortedRooms.filter((r) => r.type === "LECTURE_ROOM");
  const labRooms = sortedRooms.filter((r) => r.type === "LAB");

  // 2. Generate Variables (Session Units)
  const variables: SessionVariable[] = [];
  const heuristicMode = options.heuristicMode ?? "MRV_LCV";

  const NAIVE_CHRONOLOGICAL_ORDER: Record<string, number> = {
    "AF": 1,
    "PCE": 2,
    "DADV": 3,
    "EP": 4,
    "DADV-L": 5,
    "EP-L": 6,
    "DAA-L": 7,
    "SE-L": 8,
    "TOC": 9,
    "DAA": 10,
    "SE": 11,
  };

  if (heuristicMode === "STATIC_DIFFICULTY") {
    // Sort courses: LABs first, then by weeklyHours descending
    const diffSortedCourses = [...sortedCourses].sort((a, b) => {
      if (a.type === "LAB" && b.type !== "LAB") return -1;
      if (a.type !== "LAB" && b.type === "LAB") return 1;
      if (b.weeklyHours !== a.weeklyHours) return b.weeklyHours - a.weeklyHours;
      return a.shortCode.localeCompare(b.shortCode);
    });

    for (const course of diffSortedCourses) {
      for (let sessionIdx = 1; sessionIdx <= course.weeklyHours; sessionIdx++) {
        for (const div of sortedDivisions) {
          variables.push({
            id: `VAR_${div.name}_${course.shortCode}_${sessionIdx}`,
            courseId: course.id,
            courseCode: course.code,
            courseShortCode: course.shortCode,
            courseType: course.type,
            divisionId: div.id,
            divisionName: div.name,
            sessionIndex: sessionIdx,
          });
        }
      }
    }
  } else if (heuristicMode === "CHRONOLOGICAL") {
    // Naive chronological ordering: unconstrained courses scheduled first, leaving bottleneck courses (DAA, SE) for the end
    // Fully deterministic, realistic unguided ordering that illustrates the need for MRV
    const naiveSortedCourses = [...sortedCourses].sort((a, b) => {
      const orderA = NAIVE_CHRONOLOGICAL_ORDER[a.shortCode] || 99;
      const orderB = NAIVE_CHRONOLOGICAL_ORDER[b.shortCode] || 99;
      if (orderA !== orderB) return orderA - orderB;
      return a.code.localeCompare(b.code);
    });

    for (const div of sortedDivisions) {
      for (const course of naiveSortedCourses) {
        for (let sessionIdx = 1; sessionIdx <= course.weeklyHours; sessionIdx++) {
          variables.push({
            id: `VAR_${div.name}_${course.shortCode}_${sessionIdx}`,
            courseId: course.id,
            courseCode: course.code,
            courseShortCode: course.shortCode,
            courseType: course.type,
            divisionId: div.id,
            divisionName: div.name,
            sessionIndex: sessionIdx,
          });
        }
      }
    }
  } else if (heuristicMode === "INTERLEAVED") {
    for (const course of sortedCourses) {
      for (let sessionIdx = 1; sessionIdx <= course.weeklyHours; sessionIdx++) {
        for (const div of sortedDivisions) {
          variables.push({
            id: `VAR_${div.name}_${course.shortCode}_${sessionIdx}`,
            courseId: course.id,
            courseCode: course.code,
            courseShortCode: course.shortCode,
            courseType: course.type,
            divisionId: div.id,
            divisionName: div.name,
            sessionIndex: sessionIdx,
          });
        }
      }
    }
  } else {
    // Canonical Division-by-Division order for MRV / LCV
    for (const div of sortedDivisions) {
      for (const course of sortedCourses) {
        for (let sessionIdx = 1; sessionIdx <= course.weeklyHours; sessionIdx++) {
          variables.push({
            id: `VAR_${div.name}_${course.shortCode}_${sessionIdx}`,
            courseId: course.id,
            courseCode: course.code,
            courseShortCode: course.shortCode,
            courseType: course.type,
            divisionId: div.id,
            divisionName: div.name,
            sessionIndex: sessionIdx,
          });
        }
      }
    }
  }

  if (variables.length === 0) {
    const elapsed = performance.now() - startTime;
    return {
      success: true,
      assignments: [],
      stats: { nodesExplored: 0, backtrackCount: 0, timeMs: elapsed },
      trace,
    };
  }

  // 3. Generate Initial Domains for each variable
  const initialDomains = new Map<string, DomainAssignmentValue[]>();

  for (const variable of variables) {
    const allowedFacultyIds = courseFacultyMap.get(variable.courseId) || [];
    if (allowedFacultyIds.length === 0) {
      const elapsed = performance.now() - startTime;
      return {
        success: false,
        assignments: [],
        stats: { nodesExplored: 0, backtrackCount: 0, timeMs: elapsed },
        trace,
        failureReason: `No assigned faculty found for course ${variable.courseShortCode}`,
      };
    }

    const allowedRooms = variable.courseType === "LAB" ? labRooms : lectureRooms;
    if (allowedRooms.length === 0) {
      const elapsed = performance.now() - startTime;
      return {
        success: false,
        assignments: [],
        stats: { nodesExplored: 0, backtrackCount: 0, timeMs: elapsed },
        trace,
        failureReason: `No compatible ${variable.courseType} rooms available for course ${variable.courseShortCode}`,
      };
    }

    const domainValues: DomainAssignmentValue[] = [];
    for (const ts of usableTimeSlots) {
      for (const room of allowedRooms) {
        // Check room pool constraints
        let isRoomBlocked = false;
        if (input.constraints) {
          for (const c of input.constraints) {
            if (c.type === "HARD" && (c.category === "ROOM_UNAVAILABILITY" || c.category === "ROOM_UNAVAILABLE")) {
              const rule = c.structuredRule as { roomNo?: string; roomId?: string; days?: string[]; timeSlotIds?: string[]; startTimes?: string[] };
              if (
                (rule.roomNo === room.roomNo || rule.roomId === room.id) &&
                (!rule.days || rule.days.includes(ts.day)) &&
                (!rule.timeSlotIds || rule.timeSlotIds.includes(ts.id)) &&
                (!rule.startTimes || rule.startTimes.includes(ts.startTime))
              ) {
                isRoomBlocked = true;
                break;
              }
            } else if (c.type === "HARD" && c.category === "ROOM_EXCLUSION") {
              const rule = c.structuredRule as { excludedRoomNos?: string[]; courseShortCodes?: string[] };
              if (
                rule.excludedRoomNos?.includes(room.roomNo) &&
                (!rule.courseShortCodes || rule.courseShortCodes.includes(variable.courseShortCode))
              ) {
                isRoomBlocked = true;
                break;
              }
            }
          }
        }
        if (isRoomBlocked) continue;

        for (const facId of allowedFacultyIds) {
          const fac = facultyMap.get(facId);
          const facCode = fac?.shortCode || facId;

          // Check faculty availability constraints
          let isFacultyBlocked = false;
          if (input.constraints) {
            for (const c of input.constraints) {
              if (c.type === "HARD" && (c.category === "FACULTY_UNAVAILABILITY" || c.category === "FACULTY_UNAVAILABLE")) {
                const rule = c.structuredRule as { facultyShortCode?: string; facultyId?: string; days?: string[]; timeSlotIds?: string[]; startTimes?: string[] };
                if (
                  (rule.facultyShortCode === facCode || rule.facultyId === facId) &&
                  (!rule.days || rule.days.includes(ts.day)) &&
                  (!rule.timeSlotIds || rule.timeSlotIds.includes(ts.id)) &&
                  (!rule.startTimes || rule.startTimes.includes(ts.startTime))
                ) {
                  isFacultyBlocked = true;
                  break;
                }
              }
            }
          }
          if (isFacultyBlocked) continue;

          domainValues.push({
            id: `VAL_${ts.day}_${ts.startTime}_${room.roomNo}_${facCode}`,
            timeSlotId: ts.id,
            roomId: room.id,
            facultyId: facId,
            timeSlotDay: ts.day,
            timeSlotStartTime: ts.startTime,
            roomNo: room.roomNo,
            facultyShortCode: facCode,
          });
        }
      }
    }

    initialDomains.set(variable.id, domainValues);
  }

  // 4. Backtracking Search State
  const assigned = new Map<string, DomainAssignmentValue>(); // variableId -> DomainAssignmentValue
  const currentDomains = new Map<string, DomainAssignmentValue[]>();
  for (const [varId, dom] of initialDomains.entries()) {
    currentDomains.set(varId, [...dom]);
  }

  // Heuristic: Variable Selection (MRV vs Static Order)
  function selectUnassignedVariable(): SessionVariable | null {
    if (
      heuristicMode === "CHRONOLOGICAL" ||
      heuristicMode === "INTERLEAVED" ||
      heuristicMode === "STATIC_DIFFICULTY"
    ) {
      for (const v of variables) {
        if (!assigned.has(v.id)) return v;
      }
      return null;
    }

    // MRV (Minimum Remaining Values)
    let minDomainSize = Infinity;
    let selected: SessionVariable | null = null;

    for (const v of variables) {
      if (assigned.has(v.id)) continue;
      const dom = currentDomains.get(v.id);
      const size = dom ? dom.length : 0;

      if (size < minDomainSize) {
        minDomainSize = size;
        selected = v;
      }
    }

    return selected;
  }

  const valueOrdering = options.valueOrdering ?? (heuristicMode === "MRV_LCV" ? "LCV" : "NATURAL");

  // Heuristic: Value Ordering (LCV vs Natural vs Division Offset)
  function orderDomainValues(
    variable: SessionVariable,
    values: DomainAssignmentValue[]
  ): DomainAssignmentValue[] {
    if (values.length <= 1) return values;

    if (heuristicMode === "CHRONOLOGICAL") {
      // Natural chronological order: time slots Mon 07:30 -> Sat 13:35 in room order
      return values;
    }

    if (valueOrdering === "DIVISION_OFFSET") {
      // Division 2 tries values in reverse order, creating realistic inter-divisional contention
      if (variable.divisionName.endsWith("2") || variable.divisionName.includes("-2")) {
        return [...values].reverse();
      }
      return values;
    }

    if (valueOrdering === "PREFER_EARLY_SLOTS") {
      // Prioritize earlier morning slots across all days
      return [...values].sort((a, b) => {
        if (a.timeSlotStartTime !== b.timeSlotStartTime) {
          return a.timeSlotStartTime.localeCompare(b.timeSlotStartTime);
        }
        return a.timeSlotDay.localeCompare(b.timeSlotDay);
      });
    }

    if (valueOrdering !== "LCV") return values;

    // Count how many values across all unassigned variables this value would prune
    const scores = values.map((val) => {
      let conflictsCaused = 0;

      for (const unassignedVar of variables) {
        if (assigned.has(unassignedVar.id) || unassignedVar.id === variable.id) continue;

        const unassignedDom = currentDomains.get(unassignedVar.id);
        if (!unassignedDom) continue;

        for (const candidate of unassignedDom) {
          if (candidate.timeSlotId === val.timeSlotId) {
            // Collision on division, room, or faculty
            if (
              unassignedVar.divisionId === variable.divisionId ||
              candidate.roomId === val.roomId ||
              candidate.facultyId === val.facultyId
            ) {
              conflictsCaused++;
            }
          }
        }
      }

      return { val, conflictsCaused };
    });

    // Sort ascending by conflicts caused (Least Constraining first), with stable ID tie-breaker
    scores.sort((a, b) => {
      if (a.conflictsCaused !== b.conflictsCaused) {
        return a.conflictsCaused - b.conflictsCaused;
      }
      return a.val.id.localeCompare(b.val.id);
    });
    return scores.map((s) => s.val);
  }

  // Forward Checking / Domain Pruning
  interface PrunedEntry {
    variableId: string;
    prunedValues: DomainAssignmentValue[];
  }

  function forwardCheck(
    assignedVar: SessionVariable,
    val: DomainAssignmentValue
  ): { success: boolean; pruned: PrunedEntry[] } {
    const pruned: PrunedEntry[] = [];

    for (const unassignedVar of variables) {
      if (assigned.has(unassignedVar.id) || unassignedVar.id === assignedVar.id) continue;

      const dom = currentDomains.get(unassignedVar.id);
      if (!dom) continue;

      const remaining: DomainAssignmentValue[] = [];
      const removed: DomainAssignmentValue[] = [];

      for (const candidate of dom) {
        // Check hard conflicts
        if (candidate.timeSlotId === val.timeSlotId) {
          const isDivisionConflict = unassignedVar.divisionId === assignedVar.divisionId;
          const isRoomConflict = candidate.roomId === val.roomId;
          const isFacultyConflict = candidate.facultyId === val.facultyId;

          if (isDivisionConflict || isRoomConflict || isFacultyConflict) {
            removed.push(candidate);
            continue;
          }
        }

        // Check dynamic daily course limit constraints
        if (
          candidate.timeSlotDay === val.timeSlotDay &&
          unassignedVar.divisionId === assignedVar.divisionId &&
          unassignedVar.courseId === assignedVar.courseId &&
          input.constraints
        ) {
          let shouldPruneDaily = false;
          for (const c of input.constraints) {
            if (c.type === "HARD" && c.category === "DAILY_COURSE_LIMIT") {
              const rule = c.structuredRule as { maxDailySessions?: number; courseShortCodes?: string[] };
              const maxSessions = rule.maxDailySessions ?? 1;
              if (!rule.courseShortCodes || rule.courseShortCodes.includes(assignedVar.courseShortCode)) {
                // Count already assigned sessions on this day for this (division, course) + 1 for current tentative assignment
                let assignedOnDay = 1;
                for (const [varId, assignedVal] of assigned.entries()) {
                  if (varId !== assignedVar.id && assignedVal.timeSlotDay === val.timeSlotDay) {
                    const otherVar = variables.find((v) => v.id === varId);
                    if (otherVar && otherVar.divisionId === assignedVar.divisionId && otherVar.courseId === assignedVar.courseId) {
                      assignedOnDay++;
                    }
                  }
                }
                if (assignedOnDay >= maxSessions) {
                  shouldPruneDaily = true;
                  break;
                }
              }
            }
          }
          if (shouldPruneDaily) {
            removed.push(candidate);
            continue;
          }
        }
        remaining.push(candidate);
      }

      if (removed.length > 0) {
        pruned.push({ variableId: unassignedVar.id, prunedValues: removed });
        currentDomains.set(unassignedVar.id, remaining);

        // Domain Wipeout
        if (remaining.length === 0) {
          return { success: false, pruned };
        }
      }
    }

    return { success: true, pruned };
  }

  function restorePruned(pruned: PrunedEntry[]): void {
    for (const item of pruned) {
      const dom = currentDomains.get(item.variableId);
      if (dom) {
        dom.push(...item.prunedValues);
      }
    }
  }

  // 5. Recursive Backtracking Search
  function backtrack(): boolean {
    if (performance.now() - startTime > timeoutMs) {
      return false;
    }
    if (backtrackCount > maxBacktracks) {
      return false;
    }

    const variable = selectUnassignedVariable();
    if (!variable) {
      // All variables successfully assigned
      return true;
    }

    const availableValues = currentDomains.get(variable.id) || [];
    if (availableValues.length === 0) {
      return false;
    }

    const orderedValues = orderDomainValues(variable, availableValues);

    for (const val of orderedValues) {
      nodesExplored++;
      assigned.set(variable.id, val);
      logTrace("assign", variable.id, val.id, `Assigned to ${val.timeSlotDay} ${val.timeSlotStartTime}, Room ${val.roomNo}, Prof ${val.facultyShortCode}`);

      // Perform Forward Checking
      const fcResult = forwardCheck(variable, val);

      if (fcResult.success) {
        const result = backtrack();
        if (result) {
          return true;
        }
      } else {
        logTrace("conflict", variable.id, val.id, "Forward check domain wipeout detected");
      }

      // Undo Assignment & Backtrack
      restorePruned(fcResult.pruned);
      assigned.delete(variable.id);
      backtrackCount++;
      logTrace("backtrack", variable.id, val.id, `Backtracking from ${val.id}`);
    }

    return false;
  }

  const success = backtrack();
  const elapsed = performance.now() - startTime;

  if (!success) {
    return {
      success: false,
      assignments: [],
      stats: { nodesExplored, backtrackCount, timeMs: elapsed },
      trace,
      failureReason:
        elapsed > timeoutMs
          ? `Solver reached time limit of ${timeoutMs}ms without completing search`
          : backtrackCount > maxBacktracks
          ? `did not find a solution within bounded search limit (${maxBacktracks} backtracks; expected characteristic of unguided search)`
          : "Search space exhausted; no valid assignment exists satisfying all active hard constraints",
    };
  }

  // Convert internal assignments to ScheduleEntry objects
  const finalAssignments: ScheduleEntry[] = [];
  for (const variable of variables) {
    const val = assigned.get(variable.id);
    if (!val) continue;

    finalAssignments.push({
      id: `SCHED_${variable.id}`,
      courseId: variable.courseId,
      facultyId: val.facultyId,
      roomId: val.roomId,
      divisionId: variable.divisionId,
      timeSlotId: val.timeSlotId,
    });
  }

  return {
    success: true,
    assignments: finalAssignments,
    stats: {
      nodesExplored,
      backtrackCount,
      timeMs: elapsed,
    },
    trace,
  };
}

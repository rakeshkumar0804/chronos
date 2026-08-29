import { ScheduleEntry } from "@chronos/shared";
import {
  SolverInput,
  SolverOptions,
  SolverResult,
  SolverStepEvent,
  SessionVariable,
  DomainAssignmentValue,
  SolverStats
} from "./types.js";

interface PrunedEntry {
  variableId: string;
  prunedValue: DomainAssignmentValue;
  reason: string;
}

/**
 * Pure, deterministic ES6 Generator Backtracking CSP Solver.
 * Yields granular execution snapshots for real-time frontend visualization.
 */
export function* solveCSP(
  problem: SolverInput,
  options: SolverOptions = {}
): Generator<SolverStepEvent, SolverResult, void> {
  const startTime = performance.now();
  const maxBacktracks = options.maxBacktracks ?? 500_000;
  const timeoutMs = options.timeoutMs ?? Infinity;
  const heuristicMode = options.heuristicMode ?? "MRV_LCV";
  const valueOrdering = options.valueOrdering ?? "LCV";

  let nodesExplored = 0;
  let backtrackCount = 0;
  let domainsPrunedCount = 0;
  let maxDepth = 0;

  // 1. Canonical Deterministic Ordering
  const DAY_ORDER: Record<string, number> = { MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6, SUN: 7 };

  const CURRICULUM_ORDER: Record<string, number> = {
    DAA: 1,
    "DAA-L": 2,
    TOC: 3,
    SE: 4,
    "SE-L": 5,
    EP: 6,
    "EP-L": 7,
    PCE: 8,
    DADV: 9,
    "DADV-L": 10,
    AF: 11,
  };

  const NAIVE_CHRONOLOGICAL_ORDER: Record<string, number> = {
    AF: 1,
    PCE: 2,
    "DADV-L": 3,
    DADV: 4,
    "EP-L": 5,
    EP: 6,
    TOC: 7,
    "SE-L": 8,
    SE: 9,
    "DAA-L": 10,
    DAA: 11,
  };

  const ROOM_ORDER: Record<string, number> = {
    "372": 1,
    "132": 2,
    "302": 3,
    "134": 4,
  };

  const sortedCourses = [...problem.courses].sort((a, b) => {
    const orderA = CURRICULUM_ORDER[a.shortCode] || 99;
    const orderB = CURRICULUM_ORDER[b.shortCode] || 99;
    if (orderA !== orderB) return orderA - orderB;
    return a.code.localeCompare(b.code);
  });
  const sortedDivisions = [...problem.divisions].sort((a, b) => a.name.localeCompare(b.name));
  const sortedFaculty = [...problem.faculty].sort((a, b) => a.shortCode.localeCompare(b.shortCode));
  const sortedRooms = [...problem.rooms].sort((a, b) => {
    const orderA = ROOM_ORDER[a.roomNo] || 99;
    const orderB = ROOM_ORDER[b.roomNo] || 99;
    if (orderA !== orderB) return orderA - orderB;
    return a.roomNo.localeCompare(b.roomNo);
  });
  const usableTimeSlots = [...problem.timeSlots]
    .filter((ts) => !ts.isBreak)
    .sort((a, b) => {
      const dayDiff = (DAY_ORDER[a.day] || 99) - (DAY_ORDER[b.day] || 99);
      if (dayDiff !== 0) return dayDiff;
      return a.startTime.localeCompare(b.startTime);
    });

  const facultyMap = new Map(sortedFaculty.map((f) => [f.id, f]));

  const courseFacultyMap = new Map<string, string[]>();
  for (const fca of problem.facultyCourseAssignments) {
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

  // 2. Parse User-Defined Constraints
  const activeConstraints = problem.constraints || [];
  const facultyUnavailability = new Map<string, Set<string>>(); // facultyShortCode -> Set of "DAY_STARTTIME"
  const roomUnavailability = new Map<string, Set<string>>(); // roomNo -> Set of "DAY_STARTTIME"
  const maxSessionsPerDay = new Map<string, number>(); // "DIV_COURSE" -> max

  for (const c of activeConstraints) {
    if (c.type !== "HARD") continue;
    const rule = c.structuredRule as any;
    if (!rule) continue;

    if ((c.category === "FACULTY_UNAVAILABLE" || c.category === "FACULTY_UNAVAILABILITY") && rule.facultyShortCode) {
      const set = facultyUnavailability.get(rule.facultyShortCode) || new Set<string>();
      if (rule.days && Array.isArray(rule.days)) {
        for (const day of rule.days) {
          if (rule.startTimes && Array.isArray(rule.startTimes) && rule.startTimes.length > 0) {
            for (const st of rule.startTimes) {
              set.add(`${day}_${st}`);
            }
          } else {
            for (const ts of usableTimeSlots) {
              if (ts.day === day) set.add(`${day}_${ts.startTime}`);
            }
          }
        }
      }
      facultyUnavailability.set(rule.facultyShortCode, set);
    }

    if (c.category === "ROOM_UNAVAILABLE" || c.category === "ROOM_UNAVAILABILITY") {
      if (rule.roomNo && rule.days && Array.isArray(rule.days)) {
        const set = roomUnavailability.get(rule.roomNo) || new Set<string>();
        for (const day of rule.days) {
          if (rule.startTimes && Array.isArray(rule.startTimes) && rule.startTimes.length > 0) {
            for (const st of rule.startTimes) {
              set.add(`${day}_${st}`);
            }
          } else {
            for (const ts of usableTimeSlots) {
              if (ts.day === day) set.add(`${day}_${ts.startTime}`);
            }
          }
        }
        roomUnavailability.set(rule.roomNo, set);
      } else if (rule.startTimes && !rule.days) {
        // Block start time across all rooms
        for (const r of sortedRooms) {
          const set = roomUnavailability.get(r.roomNo) || new Set<string>();
          for (const ts of usableTimeSlots) {
            if (rule.startTimes.includes(ts.startTime)) {
              set.add(`${ts.day}_${ts.startTime}`);
            }
          }
          roomUnavailability.set(r.roomNo, set);
        }
      }
    }

    if (c.category === "MAX_SESSIONS_PER_DAY" || c.category === "DAILY_COURSE_LIMIT") {
      const limitVal = rule.maxDailySessions ?? rule.max;
      if (limitVal !== undefined) {
        const key = `${rule.divisionName || "*"}_${rule.courseShortCode || "*"}`;
        maxSessionsPerDay.set(key, limitVal);
      }
    }
  }

  // 3. Generate Variables
  const variables: SessionVariable[] = [];
  for (const division of sortedDivisions) {
    for (const course of sortedCourses) {
      for (let sessionIdx = 1; sessionIdx <= course.weeklyHours; sessionIdx++) {
        variables.push({
          id: `VAR_${division.name}_${course.shortCode}_${sessionIdx}`,
          courseId: course.id,
          courseCode: course.code,
          courseShortCode: course.shortCode,
          courseType: course.type as "LECTURE" | "LAB",
          divisionId: division.id,
          divisionName: division.name,
          sessionIndex: sessionIdx,
        });
      }
    }
  }

  // 4. Build Initial Domains
  const initialDomains = new Map<string, DomainAssignmentValue[]>();
  for (const variable of variables) {
    const assignedFacultyIds = courseFacultyMap.get(variable.courseId) || [];
    const validRooms = sortedRooms.filter((r) => {
      if (variable.courseType === "LAB") return r.type === "LAB";
      return r.type === "LECTURE_ROOM";
    });

    const domain: DomainAssignmentValue[] = [];
    for (const timeSlot of usableTimeSlots) {
      for (const room of validRooms) {
        const roomBlocked = roomUnavailability.get(room.roomNo)?.has(`${timeSlot.day}_${timeSlot.startTime}`);
        if (roomBlocked) continue;

        for (const facultyId of assignedFacultyIds) {
          const faculty = facultyMap.get(facultyId);
          if (!faculty) continue;

          const facBlocked = facultyUnavailability.get(faculty.shortCode)?.has(`${timeSlot.day}_${timeSlot.startTime}`);
          if (facBlocked) continue;

          domain.push({
            id: `VAL_${timeSlot.day}_${timeSlot.startTime}_${room.roomNo}_${faculty.shortCode}`,
            timeSlotId: timeSlot.id,
            roomId: room.id,
            facultyId: faculty.id,
            timeSlotDay: timeSlot.day,
            timeSlotStartTime: timeSlot.startTime,
            roomNo: room.roomNo,
            facultyShortCode: faculty.shortCode,
          });
        }
      }
    }

    initialDomains.set(variable.id, domain);
  }

  const currentDomains = new Map<string, DomainAssignmentValue[]>();
  for (const [vId, dom] of initialDomains.entries()) {
    currentDomains.set(vId, [...dom]);
  }

  const assigned = new Map<string, DomainAssignmentValue>();

  // 5. Variable Selection with MRV & Degree Heuristic
  function selectUnassignedVariable(): SessionVariable | null {
    const unassigned = variables.filter((v) => !assigned.has(v.id));
    if (unassigned.length === 0) return null;

    if (heuristicMode === "CHRONOLOGICAL") {
      const sortedUnassigned = [...unassigned].sort((a, b) => {
        const orderA = NAIVE_CHRONOLOGICAL_ORDER[a.courseShortCode] || 99;
        const orderB = NAIVE_CHRONOLOGICAL_ORDER[b.courseShortCode] || 99;
        if (orderA !== orderB) return orderA - orderB;
        if (a.divisionName !== b.divisionName) return a.divisionName.localeCompare(b.divisionName);
        return a.sessionIndex - b.sessionIndex;
      });
      return sortedUnassigned[0];
    }

    // MRV with Degree Heuristic tie-breaker
    let bestVar: SessionVariable | null = null;
    let minDomainSize = Infinity;
    let maxDegree = -1;

    for (const variable of unassigned) {
      const domainSize = (currentDomains.get(variable.id) || []).length;

      // Degree: count unassigned neighbors that share division or assigned faculty
      const assignedFacIds = courseFacultyMap.get(variable.courseId) || [];
      let degree = 0;
      for (const other of unassigned) {
        if (other.id === variable.id) continue;
        if (other.divisionId === variable.divisionId) degree++;
        else {
          const otherFacIds = courseFacultyMap.get(other.courseId) || [];
          if (assignedFacIds.some((fId) => otherFacIds.includes(fId))) degree++;
        }
      }

      if (domainSize < minDomainSize) {
        minDomainSize = domainSize;
        maxDegree = degree;
        bestVar = variable;
      } else if (domainSize === minDomainSize) {
        if (degree > maxDegree) {
          maxDegree = degree;
          bestVar = variable;
        } else if (degree === maxDegree && bestVar) {
          if (variable.id.localeCompare(bestVar.id) < 0) {
            bestVar = variable;
          }
        }
      }
    }

    return bestVar;
  }

  // 6. Value Ordering with LCV
  function orderDomainValues(
    variable: SessionVariable,
    candidates: DomainAssignmentValue[]
  ): DomainAssignmentValue[] {
    if (valueOrdering === "NATURAL" || candidates.length <= 1) {
      return candidates;
    }

    const unassigned = variables.filter((v) => !assigned.has(v.id) && v.id !== variable.id);

    const scored = candidates.map((val) => {
      let conflicts = 0;
      for (const unassignedVar of unassigned) {
        const dom = currentDomains.get(unassignedVar.id) || [];
        for (const c of dom) {
          if (c.timeSlotId === val.timeSlotId) {
            if (c.facultyId === val.facultyId || c.roomId === val.roomId) {
              conflicts++;
            }
            if (unassignedVar.divisionId === variable.divisionId) {
              conflicts++;
            }
          }
        }
      }
      return { val, conflicts };
    });

    scored.sort((a, b) => {
      if (a.conflicts !== b.conflicts) return a.conflicts - b.conflicts;
      return a.val.id.localeCompare(b.val.id);
    });

    return scored.map((s) => s.val);
  }

  // 7. Forward Checking & Domain Filtering
  function forwardCheck(
    assignedVar: SessionVariable,
    assignedVal: DomainAssignmentValue
  ): { success: boolean; pruned: PrunedEntry[]; conflictReason?: string; conflictWith?: string } {
    const pruned: PrunedEntry[] = [];
    const unassigned = variables.filter((v) => !assigned.has(v.id));

    // Daily limit check
    const specificKey = `${assignedVar.divisionName}_${assignedVar.courseShortCode}`;
    const wildcardKey = `*_${assignedVar.courseShortCode}`;
    const globalKey = "*_*";
    const limit =
      maxSessionsPerDay.get(specificKey) ??
      maxSessionsPerDay.get(wildcardKey) ??
      maxSessionsPerDay.get(globalKey) ??
      Infinity;

    if (limit !== Infinity) {
      let countToday = 0;
      for (const v of variables) {
        if (v.divisionName === assignedVar.divisionName && v.courseShortCode === assignedVar.courseShortCode) {
          const aVal = assigned.get(v.id);
          if (aVal && aVal.timeSlotDay === assignedVal.timeSlotDay) {
            countToday++;
          }
        }
      }

      if (countToday >= limit) {
        for (const unassignedVar of unassigned) {
          if (unassignedVar.divisionName === assignedVar.divisionName && unassignedVar.courseShortCode === assignedVar.courseShortCode) {
            const dom = currentDomains.get(unassignedVar.id) || [];
            const remaining: DomainAssignmentValue[] = [];
            for (const cand of dom) {
              if (cand.timeSlotDay === assignedVal.timeSlotDay) {
                pruned.push({
                  variableId: unassignedVar.id,
                  prunedValue: cand,
                  reason: `Max daily sessions limit (${limit}) reached on ${assignedVal.timeSlotDay}`,
                });
              } else {
                remaining.push(cand);
              }
            }
            currentDomains.set(unassignedVar.id, remaining);
            if (remaining.length === 0) {
              return {
                success: false,
                pruned,
                conflictReason: `Daily session limit exceeded on ${assignedVal.timeSlotDay}`,
                conflictWith: unassignedVar.id,
              };
            }
          }
        }
      }
    }

    // Direct resource collision pruning
    for (const unassignedVar of unassigned) {
      const dom = currentDomains.get(unassignedVar.id) || [];
      const remaining: DomainAssignmentValue[] = [];

      for (const candidate of dom) {
        let isPruned = false;
        let pruneReason = "";

        if (candidate.timeSlotId === assignedVal.timeSlotId) {
          if (candidate.facultyId === assignedVal.facultyId) {
            isPruned = true;
            pruneReason = `Faculty collision: ${assignedVal.facultyShortCode} assigned to ${assignedVar.id}`;
          } else if (candidate.roomId === assignedVal.roomId) {
            isPruned = true;
            pruneReason = `Room collision: Room ${assignedVal.roomNo} assigned to ${assignedVar.id}`;
          } else if (unassignedVar.divisionId === assignedVar.divisionId) {
            isPruned = true;
            pruneReason = `Division overlap: ${assignedVar.divisionName} busy with ${assignedVar.courseShortCode}`;
          }
        }

        if (isPruned) {
          pruned.push({
            variableId: unassignedVar.id,
            prunedValue: candidate,
            reason: pruneReason,
          });
        } else {
          remaining.push(candidate);
        }
      }

      if (remaining.length < dom.length) {
        currentDomains.set(unassignedVar.id, remaining);
        if (remaining.length === 0) {
          return {
            success: false,
            pruned,
            conflictReason: `Domain wipeout on variable ${unassignedVar.id}`,
            conflictWith: unassignedVar.id,
          };
        }
      }
    }

    return { success: true, pruned };
  }

  function restorePruned(pruned: PrunedEntry[]): void {
    for (const item of pruned) {
      const dom = currentDomains.get(item.variableId);
      if (dom) {
        dom.push(item.prunedValue);
      }
    }
  }

  // 8. Recursive Generator Traversal
  function* backtrackGenerator(depth: number): Generator<SolverStepEvent, boolean, void> {
    if (depth > maxDepth) maxDepth = depth;

    if (performance.now() - startTime > timeoutMs || backtrackCount > maxBacktracks) {
      return false;
    }

    const variable = selectUnassignedVariable();
    if (!variable) {
      // All variables successfully assigned!
      return true;
    }

    const availableValues = currentDomains.get(variable.id) || [];
    yield {
      type: "VARIABLE_SELECTED",
      variableId: variable.id,
      remainingDomainCount: availableValues.length,
    };

    if (availableValues.length === 0) {
      return false;
    }

    const orderedValues = orderDomainValues(variable, availableValues);

    for (const val of orderedValues) {
      nodesExplored++;
      assigned.set(variable.id, val);

      yield {
        type: "VALUE_TRIED",
        variableId: variable.id,
        value: val,
      };

      const fcResult = forwardCheck(variable, val);

      // Yield domain pruning snapshots
      for (const p of fcResult.pruned) {
        domainsPrunedCount++;
        yield {
          type: "DOMAIN_PRUNED",
          variableId: p.variableId,
          prunedValue: p.prunedValue,
          reason: p.reason,
        };
      }

      if (fcResult.success) {
        yield {
          type: "ASSIGNMENT_SUCCESS",
          variableId: variable.id,
          value: val,
        };

        const solved = yield* backtrackGenerator(depth + 1);
        if (solved) {
          return true;
        }
      } else {
        yield {
          type: "CONFLICT_DETECTED",
          variableId: variable.id,
          conflictingConstraint: fcResult.conflictReason || "Domain wipeout",
          conflictWith: fcResult.conflictWith || variable.id,
        };
      }

      // Backtrack
      restorePruned(fcResult.pruned);
      assigned.delete(variable.id);
      backtrackCount++;

      yield {
        type: "BACKTRACK",
        variableId: variable.id,
        restoredDomainsCount: fcResult.pruned.length,
      };
    }

    return false;
  }

  const success = yield* backtrackGenerator(0);
  const elapsed = performance.now() - startTime;

  const metrics: SolverStats = {
    nodesExplored,
    backtrackCount,
    domainsPruned: domainsPrunedCount,
    maxDepth,
    timeMs: elapsed,
  };

  if (!success) {
    yield {
      type: "UNSATISFIABLE",
      metrics,
    };

    return {
      success: false,
      assignments: [],
      stats: metrics,
      failureReason:
        elapsed > timeoutMs
          ? `Solver reached time limit of ${timeoutMs}ms without completing search`
          : backtrackCount > maxBacktracks
          ? `Search limit reached (${maxBacktracks} backtracks)`
          : "Search space exhausted; no valid assignment exists satisfying all active hard constraints",
    };
  }

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

  yield {
    type: "SOLUTION_FOUND",
    schedule: finalAssignments,
    metrics,
  };

  return {
    success: true,
    assignments: finalAssignments,
    stats: metrics,
  };
}

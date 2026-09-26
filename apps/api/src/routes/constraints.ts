import { Router, Request, Response } from "express";
import { parseConstraint, ParserContext } from "@chronos/nl-parser";
import { prisma, XYZ_INSTITUTE_WORKSPACE } from "../db.js";
import { extractWorkspaceId } from "../workspace.js";

const router = Router();

/**
 * POST /api/constraints/parse
 * Converts a natural language constraint string into a validated structured Constraint
 * strictly scoped to the requesting workspace context (preventing cross-workspace entity exposure).
 */
router.post("/parse", async (req: Request, res: Response): Promise<void> => {
  try {
    const { text } = req.body || {};

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: "Missing or invalid 'text' field in request body.",
      });
      return;
    }

    let workspaceId = XYZ_INSTITUTE_WORKSPACE;
    try {
      workspaceId = extractWorkspaceId(req);
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: err.message,
      });
      return;
    }

    const isInstitutional = workspaceId === XYZ_INSTITUTE_WORKSPACE;
    // Institutional mode: strictly benchmark entities only
    // Visitor sandbox: visitor's custom entities + baseline institutional entities
    // Strictly excludes any other visitor's sandbox data
    const workspaceFilter = isInstitutional
      ? { workspaceId: XYZ_INSTITUTE_WORKSPACE }
      : { workspaceId: { in: [workspaceId, XYZ_INSTITUTE_WORKSPACE] } };

    // Fetch scoped database context
    const [courses, faculty, rooms, divisions, timeSlots] = await Promise.all([
      prisma.course.findMany({ where: workspaceFilter, orderBy: { code: "asc" } }),
      prisma.faculty.findMany({ where: workspaceFilter, orderBy: { shortCode: "asc" } }),
      prisma.room.findMany({ where: workspaceFilter, orderBy: { roomNo: "asc" } }),
      prisma.division.findMany({ orderBy: { name: "asc" } }),
      prisma.timeSlot.findMany({ orderBy: [{ day: "asc" }, { startTime: "asc" }] }),
    ]);

    // Deduplicate: sandbox entities take precedence over institutional defaults with identical keys
    const facultyMap = new Map<string, (typeof faculty)[0]>();
    faculty.filter((f) => f.workspaceId === XYZ_INSTITUTE_WORKSPACE).forEach((f) => facultyMap.set(f.shortCode, f));
    faculty.filter((f) => f.workspaceId === workspaceId).forEach((f) => facultyMap.set(f.shortCode, f));
    const scopedFaculty = Array.from(facultyMap.values());

    const roomMap = new Map<string, (typeof rooms)[0]>();
    rooms.filter((r) => r.workspaceId === XYZ_INSTITUTE_WORKSPACE).forEach((r) => roomMap.set(r.roomNo, r));
    rooms.filter((r) => r.workspaceId === workspaceId).forEach((r) => roomMap.set(r.roomNo, r));
    const scopedRooms = Array.from(roomMap.values());

    const courseMap = new Map<string, (typeof courses)[0]>();
    courses.filter((c) => c.workspaceId === XYZ_INSTITUTE_WORKSPACE).forEach((c) => courseMap.set(c.code, c));
    courses.filter((c) => c.workspaceId === workspaceId).forEach((c) => courseMap.set(c.code, c));
    const scopedCourses = Array.from(courseMap.values());

    const context: ParserContext = {
      facultyList: scopedFaculty.map((f) => ({
        shortCode: f.shortCode,
        fullName: f.fullName,
        email: f.email,
      })),
      roomList: scopedRooms.map((r) => ({
        roomNo: r.roomNo,
        type: r.type as any,
      })),
      courseList: scopedCourses.map((c) => ({
        code: c.code,
        shortCode: c.shortCode,
        name: c.name,
        type: c.type as any,
      })),
      divisionList: divisions.map((d) => ({
        name: d.name,
        semester: d.semester,
        program: d.program,
      })),
      timeSlotList: timeSlots.map((ts) => ({
        day: ts.day as any,
        startTime: ts.startTime,
        endTime: ts.endTime,
      })),
    };

    const parseResult = await parseConstraint(text, context);

    if (!parseResult.success) {
      res.status(422).json({
        success: false,
        error: parseResult.error,
        rawLLMOutput: parseResult.rawLLMOutput,
      });
      return;
    }

    res.status(200).json({
      success: true,
      constraint: parseResult.constraint,
      rawLLMOutput: parseResult.rawLLMOutput,
    });
  } catch (error: any) {
    console.error("[CHRONOS NL-PARSER API] Error parsing constraint:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error during natural language constraint parsing.",
      details: error?.message,
    });
  }
});

export default router;

import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { parseConstraint, ParserContext } from "@chronos/nl-parser";

const router = Router();
const prisma = new PrismaClient();

/**
 * POST /api/constraints/parse
 * Converts a natural language constraint string into a validated structured Constraint.
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

    // Fetch real institutional database context
    const [courses, faculty, rooms, divisions, timeSlots] = await Promise.all([
      prisma.course.findMany({ orderBy: { code: "asc" } }),
      prisma.faculty.findMany({ orderBy: { shortCode: "asc" } }),
      prisma.room.findMany({ orderBy: { roomNo: "asc" } }),
      prisma.division.findMany({ orderBy: { name: "asc" } }),
      prisma.timeSlot.findMany({ orderBy: [{ day: "asc" }, { startTime: "asc" }] }),
    ]);

    const context: ParserContext = {
      facultyList: faculty.map((f) => ({
        shortCode: f.shortCode,
        fullName: f.fullName,
        email: f.email,
      })),
      roomList: rooms.map((r) => ({
        roomNo: r.roomNo,
        type: r.type as any,
      })),
      courseList: courses.map((c) => ({
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

import { Router, Request, Response } from "express";
import { CourseType, RoomType } from "@prisma/client";
import { prisma, XYZ_INSTITUTE_WORKSPACE } from "../db.js";

const router = Router();

// Helper to extract visitor workspace ID from request
export function getRequestWorkspaceId(req: Request): string {
  const h = (req.headers["x-workspace-id"] as string)?.trim();
  const q = ((req.query.workspaceId || req.query.workspace) as string)?.trim();
  const b = (req.body?.workspaceId as string)?.trim();

  const candidate = h || q || b || "";
  if (!candidate || candidate === "INSTITUTIONAL" || candidate === XYZ_INSTITUTE_WORKSPACE) {
    return XYZ_INSTITUTE_WORKSPACE;
  }
  return candidate;
}

// Middleware: Strict hard protection of XYZ Institute benchmark workspace
function enforceProtectedWorkspaceGuard(req: Request, res: Response, next: () => void) {
  const wsId = getRequestWorkspaceId(req);
  if (wsId === XYZ_INSTITUTE_WORKSPACE || !wsId) {
    return res.status(403).json({
      success: false,
      error: `Forbidden: Cannot mutate or delete protected benchmark workspace "${XYZ_INSTITUTE_WORKSPACE}". Please provide a valid custom X-Workspace-Id header.`,
    });
  }
  next();
}

// 1. POST /api/admin/faculty - Add custom faculty in visitor workspace
router.post("/faculty", enforceProtectedWorkspaceGuard, async (req: Request, res: Response) => {
  try {
    const workspaceId = getRequestWorkspaceId(req);
    const { shortCode, fullName, email } = req.body;

    if (!shortCode?.trim() || !fullName?.trim() || !email?.trim()) {
      return res.status(400).json({
        success: false,
        error: "All fields (shortCode, fullName, email) are required.",
      });
    }

    const cleanShortCode = shortCode.trim().toUpperCase();
    const cleanEmail = email.trim().toLowerCase();
    const cleanFullName = fullName.trim();

    // Check duplicate shortCode in this workspace
    const existingCode = await prisma.faculty.findUnique({
      where: {
        workspaceId_shortCode: {
          workspaceId,
          shortCode: cleanShortCode,
        },
      },
    });
    if (existingCode) {
      return res.status(409).json({
        success: false,
        error: `Faculty with short code "${cleanShortCode}" already exists in your workspace.`,
      });
    }

    // Check duplicate email in this workspace
    const existingEmail = await prisma.faculty.findUnique({
      where: {
        workspaceId_email: {
          workspaceId,
          email: cleanEmail,
        },
      },
    });
    if (existingEmail) {
      return res.status(409).json({
        success: false,
        error: `Faculty with email "${cleanEmail}" already exists in your workspace.`,
      });
    }

    const faculty = await prisma.faculty.create({
      data: {
        workspaceId,
        shortCode: cleanShortCode,
        fullName: cleanFullName,
        email: cleanEmail,
        isCustom: true,
      },
    });

    res.status(201).json({ success: true, faculty });
  } catch (error: any) {
    console.error("Admin add faculty error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to create faculty." });
  }
});

// 2. POST /api/admin/room - Add custom room in visitor workspace
router.post("/room", enforceProtectedWorkspaceGuard, async (req: Request, res: Response) => {
  try {
    const workspaceId = getRequestWorkspaceId(req);
    const { roomNo, type, capacity } = req.body;

    if (!roomNo?.trim()) {
      return res.status(400).json({
        success: false,
        error: "Room number (roomNo) is required.",
      });
    }

    const cleanRoomNo = roomNo.trim();

    if (type !== "LECTURE_ROOM" && type !== "LAB") {
      return res.status(400).json({
        success: false,
        error: 'Room type must be either "LECTURE_ROOM" or "LAB".',
      });
    }

    const existingRoom = await prisma.room.findUnique({
      where: {
        workspaceId_roomNo: {
          workspaceId,
          roomNo: cleanRoomNo,
        },
      },
    });
    if (existingRoom) {
      return res.status(409).json({
        success: false,
        error: `Room "${cleanRoomNo}" already exists in your workspace.`,
      });
    }

    const room = await prisma.room.create({
      data: {
        workspaceId,
        roomNo: cleanRoomNo,
        type: type as RoomType,
        capacity: capacity ? Number(capacity) : 60,
        isCustom: true,
      },
    });

    res.status(201).json({ success: true, room });
  } catch (error: any) {
    console.error("Admin add room error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to create room." });
  }
});

// 3. POST /api/admin/course - Add custom course with faculty assignments in visitor workspace
router.post("/course", enforceProtectedWorkspaceGuard, async (req: Request, res: Response) => {
  try {
    const workspaceId = getRequestWorkspaceId(req);
    const { code, name, shortCode, type, weeklyHours, facultyShortCodes } = req.body;

    if (!code?.trim() || !name?.trim() || !shortCode?.trim()) {
      return res.status(400).json({
        success: false,
        error: "Course code, name, and short code are required.",
      });
    }

    const cleanCode = code.trim();
    const cleanShortCode = shortCode.trim().toUpperCase();
    const cleanName = name.trim();
    const numHours = Number(weeklyHours);

    if (type !== "LECTURE" && type !== "LAB") {
      return res.status(400).json({
        success: false,
        error: 'Course type must be either "LECTURE" or "LAB".',
      });
    }

    if (isNaN(numHours) || numHours < 1 || numHours > 36) {
      return res.status(400).json({
        success: false,
        error: "Weekly hours must be an integer between 1 and 36.",
      });
    }

    if (!Array.isArray(facultyShortCodes) || facultyShortCodes.length === 0) {
      return res.status(400).json({
        success: false,
        error: "At least one qualified faculty member must be assigned to this course.",
      });
    }

    // Check duplicate course code within visitor workspace
    const existingCourse = await prisma.course.findUnique({
      where: {
        workspaceId_code: {
          workspaceId,
          code: cleanCode,
        },
      },
    });
    if (existingCourse) {
      return res.status(409).json({
        success: false,
        error: `Course with code "${cleanCode}" already exists in your workspace.`,
      });
    }

    // Validate faculty in this workspace (or fallback to institutional faculty if none in visitor workspace)
    const upperCodes = facultyShortCodes.map((s: string) => s.trim().toUpperCase());
    const matchedFaculty = await prisma.faculty.findMany({
      where: {
        workspaceId: { in: [workspaceId, XYZ_INSTITUTE_WORKSPACE] },
        shortCode: { in: upperCodes },
      },
    });

    if (matchedFaculty.length === 0) {
      return res.status(400).json({
        success: false,
        error: `None of the assigned faculty (${upperCodes.join(", ")}) exist in the database. Please add them first.`,
      });
    }

    // Create course
    const course = await prisma.course.create({
      data: {
        workspaceId,
        code: cleanCode,
        name: cleanName,
        shortCode: cleanShortCode,
        type: type as CourseType,
        weeklyHours: numHours,
        isCustom: true,
      },
    });

    // Create assignments
    const assignments = await Promise.all(
      matchedFaculty.map((fac) =>
        prisma.facultyCourseAssignment.create({
          data: {
            workspaceId,
            courseId: course.id,
            facultyId: fac.id,
            isCustom: true,
          },
        })
      )
    );

    res.status(201).json({
      success: true,
      course,
      assignmentsCount: assignments.length,
      assignedFaculty: matchedFaculty.map((f) => f.shortCode),
    });
  } catch (error: any) {
    console.error("Admin add course error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to create course." });
  }
});

// 4. DELETE /api/admin/reset-custom - Delete custom entities in visitor workspace
router.delete("/reset-custom", enforceProtectedWorkspaceGuard, async (req: Request, res: Response) => {
  try {
    const workspaceId = getRequestWorkspaceId(req);

    // Delete custom assignments
    const deletedAssignments = await prisma.facultyCourseAssignment.deleteMany({
      where: { workspaceId },
    });

    // Delete custom schedule entries
    const deletedSchedules = await prisma.scheduleEntry.deleteMany({
      where: { workspaceId },
    });

    // Delete custom courses
    const deletedCourses = await prisma.course.deleteMany({
      where: { workspaceId },
    });

    // Delete custom faculty
    const deletedFaculty = await prisma.faculty.deleteMany({
      where: { workspaceId },
    });

    // Delete custom rooms
    const deletedRooms = await prisma.room.deleteMany({
      where: { workspaceId },
    });

    res.status(200).json({
      success: true,
      message: `Reset complete for workspace "${workspaceId}".`,
      purged: {
        assignments: deletedAssignments.count,
        schedules: deletedSchedules.count,
        courses: deletedCourses.count,
        faculty: deletedFaculty.count,
        rooms: deletedRooms.count,
      },
    });
  } catch (error: any) {
    console.error("Admin reset error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to reset custom entities." });
  }
});

export default router;

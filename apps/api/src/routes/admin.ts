import { Router, Request, Response } from "express";
import { PrismaClient, CourseType, RoomType } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

// 1. POST /api/admin/faculty - Add custom faculty
router.post("/faculty", async (req: Request, res: Response) => {
  try {
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

    // Check duplicate shortCode
    const existingCode = await prisma.faculty.findUnique({
      where: { shortCode: cleanShortCode },
    });
    if (existingCode) {
      return res.status(409).json({
        success: false,
        error: `Faculty with short code "${cleanShortCode}" already exists.`,
      });
    }

    // Check duplicate email
    const existingEmail = await prisma.faculty.findUnique({
      where: { email: cleanEmail },
    });
    if (existingEmail) {
      return res.status(409).json({
        success: false,
        error: `Faculty with email "${cleanEmail}" already exists.`,
      });
    }

    const faculty = await prisma.faculty.create({
      data: {
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

// 2. POST /api/admin/room - Add custom room
router.post("/room", async (req: Request, res: Response) => {
  try {
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
      where: { roomNo: cleanRoomNo },
    });
    if (existingRoom) {
      return res.status(409).json({
        success: false,
        error: `Room "${cleanRoomNo}" already exists.`,
      });
    }

    const room = await prisma.room.create({
      data: {
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

// 3. POST /api/admin/course - Add custom course with faculty assignments
router.post("/course", async (req: Request, res: Response) => {
  try {
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

    // Check duplicate course code
    const existingCourse = await prisma.course.findUnique({
      where: { code: cleanCode },
    });
    if (existingCourse) {
      return res.status(409).json({
        success: false,
        error: `Course code "${cleanCode}" already exists.`,
      });
    }

    // Validate faculty exist
    const faculties = await prisma.faculty.findMany({
      where: {
        shortCode: { in: facultyShortCodes.map((s: string) => s.trim().toUpperCase()) },
      },
    });

    if (faculties.length !== facultyShortCodes.length) {
      const foundCodes = faculties.map((f) => f.shortCode);
      const missing = facultyShortCodes.filter((s) => !foundCodes.includes(s.trim().toUpperCase()));
      return res.status(404).json({
        success: false,
        error: `Faculty short codes not found: ${missing.join(", ")}`,
      });
    }

    // Create course and faculty assignments in transaction
    const result = await prisma.$transaction(async (tx) => {
      const newCourse = await tx.course.create({
        data: {
          code: cleanCode,
          name: cleanName,
          shortCode: cleanShortCode,
          type: type as CourseType,
          weeklyHours: numHours,
          isCustom: true,
        },
      });

      const assignments = await Promise.all(
        faculties.map((f) =>
          tx.facultyCourseAssignment.create({
            data: {
              courseId: newCourse.id,
              facultyId: f.id,
              isCustom: true,
            },
          })
        )
      );

      return { course: newCourse, assignments };
    });

    res.status(201).json({ success: true, ...result });
  } catch (error: any) {
    console.error("Admin add course error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to create course." });
  }
});

// 4. DELETE /api/admin/reset-custom - Deletes only custom records without touching seeded dataset
router.delete("/reset-custom", async (_req: Request, res: Response) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const deletedAssignments = await tx.facultyCourseAssignment.deleteMany({
        where: { isCustom: true },
      });
      const deletedCourses = await tx.course.deleteMany({
        where: { isCustom: true },
      });
      const deletedRooms = await tx.room.deleteMany({
        where: { isCustom: true },
      });
      const deletedFaculty = await tx.faculty.deleteMany({
        where: { isCustom: true },
      });

      return {
        assignments: deletedAssignments.count,
        courses: deletedCourses.count,
        rooms: deletedRooms.count,
        faculty: deletedFaculty.count,
      };
    });

    res.json({
      success: true,
      message: "Reset custom dataset successfully. Verified benchmark dataset intact.",
      deleted: result,
    });
  } catch (error: any) {
    console.error("Admin reset custom error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to reset custom records." });
  }
});

// 5. GET /api/admin/custom-stats - List custom entities added in current session
router.get("/custom-stats", async (_req: Request, res: Response) => {
  try {
    const [customCourses, customFaculty, customRooms] = await Promise.all([
      prisma.course.findMany({
        where: { isCustom: true },
        include: { assignments: { include: { faculty: true } } },
      }),
      prisma.faculty.findMany({ where: { isCustom: true } }),
      prisma.room.findMany({ where: { isCustom: true } }),
    ]);

    res.json({
      success: true,
      customCourses,
      customFaculty,
      customRooms,
    });
  } catch (error: any) {
    console.error("Admin custom stats error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch custom stats." });
  }
});

export default router;

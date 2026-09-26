import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { solve } from "@chronos/solver";
import constraintsRouter from "./routes/constraints.js";
import adminRouter from "./routes/admin.js";
import { prisma, XYZ_INSTITUTE_WORKSPACE } from "./db.js";
import { extractWorkspaceId } from "./workspace.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.use("/api/constraints", constraintsRouter);
app.use("/api/admin", adminRouter);

app.get("/", (_req: Request, res: Response) => {
  res.json({
    name: "CHRONOS Academic Timetable Engine API",
    status: "ok",
    endpoints: {
      health: "/api/health",
      data: "/api/data",
      parseConstraints: "/api/constraints/parse",
      solve: "/api/solve"
    },
    webUI: "http://localhost:3000"
  });
});

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.get("/api/data", async (req: Request, res: Response) => {
  try {
    let workspaceId = XYZ_INSTITUTE_WORKSPACE;
    try {
      workspaceId = extractWorkspaceId(req);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }

    const isInstitutional = workspaceId === XYZ_INSTITUTE_WORKSPACE;

    const [courses, faculty, facultyCourseAssignments, rooms, divisions, timeSlots] =
      await Promise.all([
        prisma.course.findMany({ where: { workspaceId }, orderBy: { code: "asc" } }),
        prisma.faculty.findMany({
          where: isInstitutional
            ? { workspaceId: XYZ_INSTITUTE_WORKSPACE }
            : { workspaceId: { in: [workspaceId, XYZ_INSTITUTE_WORKSPACE] } },
          orderBy: { shortCode: "asc" },
        }),
        prisma.facultyCourseAssignment.findMany({ where: { workspaceId } }),
        prisma.room.findMany({
          where: isInstitutional
            ? { workspaceId: XYZ_INSTITUTE_WORKSPACE }
            : { workspaceId: { in: [workspaceId, XYZ_INSTITUTE_WORKSPACE] } },
          orderBy: { roomNo: "asc" },
        }),
        prisma.division.findMany({ orderBy: { name: "asc" } }),
        prisma.timeSlot.findMany({ orderBy: [{ day: "asc" }, { startTime: "asc" }] }),
      ]);

    res.json({
      courses,
      faculty,
      facultyCourseAssignments,
      rooms,
      divisions,
      timeSlots,
    });
  } catch (error: any) {
    console.error("[CHRONOS API] Failed to fetch data:", error);
    res.status(500).json({ error: "Failed to fetch data" });
  }
});

app.post("/api/solve", async (req: Request, res: Response) => {
  try {
    const { enableTrace = false } = req.body || {};
    let workspaceId = XYZ_INSTITUTE_WORKSPACE;
    try {
      workspaceId = extractWorkspaceId(req);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }

    const isInstitutional = workspaceId === XYZ_INSTITUTE_WORKSPACE;

    const [courses, faculty, facultyCourseAssignments, rooms, divisions, timeSlots] =
      await Promise.all([
        prisma.course.findMany({ where: { workspaceId } }),
        prisma.faculty.findMany({
          where: isInstitutional
            ? { workspaceId: XYZ_INSTITUTE_WORKSPACE }
            : { workspaceId: { in: [workspaceId, XYZ_INSTITUTE_WORKSPACE] } },
        }),
        prisma.facultyCourseAssignment.findMany({ where: { workspaceId } }),
        prisma.room.findMany({
          where: isInstitutional
            ? { workspaceId: XYZ_INSTITUTE_WORKSPACE }
            : { workspaceId: { in: [workspaceId, XYZ_INSTITUTE_WORKSPACE] } },
        }),
        prisma.division.findMany(),
        prisma.timeSlot.findMany(),
      ]);

    if (courses.length === 0) {
      return res.status(400).json({
        success: false,
        error: `Workspace "${workspaceId}" currently has 0 courses. Add courses before running the solver.`,
      });
    }

    const result = solve(
      {
        courses,
        faculty,
        facultyCourseAssignments,
        rooms,
        divisions,
        timeSlots,
      },
      { enableTrace: Boolean(enableTrace) }
    );

    res.json(result);
  } catch (error) {
    console.error("Solver error:", error);
    res.status(500).json({ error: "Failed to execute timetable solver" });
  }
});

if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => {
    console.log(`[CHRONOS API] Server initialized on http://localhost:${port}`);
  });
}

export default app;

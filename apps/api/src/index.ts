import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { solve } from "@chronos/solver";
import constraintsRouter from "./routes/constraints.js";
import adminRouter from "./routes/admin.js";
import { prisma, XYZ_INSTITUTE_WORKSPACE } from "./db.js";

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
    const rawWs =
      (req.headers["x-workspace-id"] as string) ||
      (req.query.workspaceId as string) ||
      (req.query.workspace as string);

    const workspaceId =
      rawWs === "INSTITUTIONAL" || rawWs === XYZ_INSTITUTE_WORKSPACE || !rawWs
        ? XYZ_INSTITUTE_WORKSPACE
        : rawWs.trim();

    const [courses, faculty, facultyCourseAssignments, rooms, divisions, timeSlots] =
      await Promise.all([
        prisma.course.findMany({ where: { workspaceId }, orderBy: { code: "asc" } }),
        prisma.faculty.findMany({ where: { workspaceId }, orderBy: { shortCode: "asc" } }),
        prisma.facultyCourseAssignment.findMany({ where: { workspaceId } }),
        prisma.room.findMany({ where: { workspaceId }, orderBy: { roomNo: "asc" } }),
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
    console.error("[CHRONOS API] Failed to fetch institutional data:", error);
    res.status(500).json({ error: "Failed to fetch institutional data" });
  }
});

app.post("/api/solve", async (req: Request, res: Response) => {
  try {
    const { enableTrace = false } = req.body || {};
    const rawWs =
      (req.headers["x-workspace-id"] as string) ||
      (req.body?.workspaceId as string);

    const workspaceId =
      rawWs === "INSTITUTIONAL" || rawWs === XYZ_INSTITUTE_WORKSPACE || !rawWs
        ? XYZ_INSTITUTE_WORKSPACE
        : rawWs.trim();

    const [courses, faculty, facultyCourseAssignments, rooms, divisions, timeSlots] =
      await Promise.all([
        prisma.course.findMany({ where: { workspaceId } }),
        prisma.faculty.findMany({ where: { workspaceId } }),
        prisma.facultyCourseAssignment.findMany({ where: { workspaceId } }),
        prisma.room.findMany({ where: { workspaceId } }),
        prisma.division.findMany(),
        prisma.timeSlot.findMany(),
      ]);

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

app.listen(port, () => {
  console.log(`[CHRONOS API] Server initialized on http://localhost:${port}`);
});

export default app;

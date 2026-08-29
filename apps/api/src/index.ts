import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { solve } from "@chronos/solver";
import constraintsRouter from "./routes/constraints.js";

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.use("/api/constraints", constraintsRouter);

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

app.get("/api/data", async (_req: Request, res: Response) => {
  try {
    const [courses, faculty, facultyCourseAssignments, rooms, divisions, timeSlots] =
      await Promise.all([
        prisma.course.findMany({ orderBy: { code: "asc" } }),
        prisma.faculty.findMany({ orderBy: { shortCode: "asc" } }),
        prisma.facultyCourseAssignment.findMany(),
        prisma.room.findMany({ orderBy: { roomNo: "asc" } }),
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

    const [courses, faculty, facultyCourseAssignments, rooms, divisions, timeSlots] =
      await Promise.all([
        prisma.course.findMany(),
        prisma.faculty.findMany(),
        prisma.facultyCourseAssignment.findMany(),
        prisma.room.findMany(),
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

if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => {
    console.log(`[CHRONOS API] Server running on http://localhost:${port}`);
  });
}

export default app;

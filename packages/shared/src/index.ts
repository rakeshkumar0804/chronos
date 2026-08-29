export type CourseType = "LECTURE" | "LAB";

export type RoomType = "LECTURE_ROOM" | "LAB";

export type DayOfWeek = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT";

export type ConstraintType = "HARD" | "SOFT";

export interface Institute {
  id: string;
  name: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Course {
  id: string;
  code: string;
  name: string;
  shortCode: string;
  type: CourseType;
  weeklyHours: number;
  instituteId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Faculty {
  id: string;
  shortCode: string;
  fullName: string;
  email: string;
  instituteId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface FacultyCourseAssignment {
  facultyId: string;
  courseId: string;
  assignedAt?: Date;
}

export interface Room {
  id: string;
  roomNo: string;
  type: RoomType;
  capacity?: number | null;
  instituteId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Division {
  id: string;
  name: string; // e.g. "5A15-1"
  semester: number;
  program: string;
  instituteId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TimeSlot {
  id: string;
  day: DayOfWeek;
  startTime: string; // HH:mm format e.g. "09:00"
  endTime: string;   // HH:mm format e.g. "10:00"
  isBreak: boolean;
  breakLabel?: string | null; // e.g. "RECESS", "LUNCH"
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ScheduleEntry {
  id: string;
  courseId: string;
  facultyId: string;
  roomId: string;
  divisionId: string;
  timeSlotId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Constraint {
  id: string;
  type: ConstraintType;
  category: string;
  description: string;
  structuredRule: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

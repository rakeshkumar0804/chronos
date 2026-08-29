import { PrismaClient } from "@prisma/client";

export const XYZ_INSTITUTE_WORKSPACE = "xyz-institute-demo";

const MUTATION_OPERATIONS = new Set([
  "create",
  "createMany",
  "update",
  "updateMany",
  "delete",
  "deleteMany",
  "upsert",
]);

function enforceWorkspaceImmutability(modelName: string, operation: string, args: any) {
  // Only the official seed script is allowed to mutate xyz-institute-demo
  if (process.env.CHRONOS_ALLOW_SEED_MUTATION === "true") {
    return;
  }

  // Allow read operations (findMany, findUnique, findFirst, count)
  if (!MUTATION_OPERATIONS.has(operation)) {
    return;
  }

  // Check data payload for creates and updates
  const data = args?.data;
  if (data) {
    if (Array.isArray(data)) {
      for (const item of data) {
        if (item?.workspaceId === XYZ_INSTITUTE_WORKSPACE) {
          throw new Error(
            `[DATABASE IMMUTABILITY GUARD] Attempted unauthorized INSERT into protected benchmark workspace "${XYZ_INSTITUTE_WORKSPACE}" on model "${modelName}". Operation rejected.`
          );
        }
      }
    } else if (data.workspaceId === XYZ_INSTITUTE_WORKSPACE) {
      throw new Error(
        `[DATABASE IMMUTABILITY GUARD] Attempted unauthorized INSERT/UPDATE into protected benchmark workspace "${XYZ_INSTITUTE_WORKSPACE}" on model "${modelName}". Operation rejected.`
      );
    }
  }

  // Check where clause for updates and deletes
  const where = args?.where;
  if (where) {
    if (where.workspaceId === XYZ_INSTITUTE_WORKSPACE) {
      throw new Error(
        `[DATABASE IMMUTABILITY GUARD] Attempted unauthorized ${operation.toUpperCase()} on protected benchmark workspace "${XYZ_INSTITUTE_WORKSPACE}" on model "${modelName}". Operation rejected.`
      );
    }
  }
}

export function getProtectedPrismaClient() {
  const basePrisma = new PrismaClient();

  return basePrisma.$extends({
    query: {
      course: {
        async $allOperations({ operation, args, query }) {
          enforceWorkspaceImmutability("Course", operation, args);
          return query(args);
        },
      },
      faculty: {
        async $allOperations({ operation, args, query }) {
          enforceWorkspaceImmutability("Faculty", operation, args);
          return query(args);
        },
      },
      room: {
        async $allOperations({ operation, args, query }) {
          enforceWorkspaceImmutability("Room", operation, args);
          return query(args);
        },
      },
      facultyCourseAssignment: {
        async $allOperations({ operation, args, query }) {
          enforceWorkspaceImmutability("FacultyCourseAssignment", operation, args);
          return query(args);
        },
      },
      scheduleEntry: {
        async $allOperations({ operation, args, query }) {
          enforceWorkspaceImmutability("ScheduleEntry", operation, args);
          return query(args);
        },
      },
    },
  });
}

export const prisma = getProtectedPrismaClient();
export type ProtectedPrismaClient = typeof prisma;

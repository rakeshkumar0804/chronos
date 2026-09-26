import { Request } from "express";
import { XYZ_INSTITUTE_WORKSPACE } from "./db.js";

export const VISITOR_WS_REGEX = /^ws-[a-zA-Z0-9_-]{6,64}$/;

/**
 * TRUST BOUNDARY & AUTHORIZATION MODEL:
 * Workspace filtering partitions data across unauthenticated browser sessions ("Visitor Sandboxes").
 * It is NOT an authorization, privacy, or cryptographic access-control boundary:
 * - Any unauthenticated caller who knows or guesses a valid visitor workspace ID (`ws-<id>`) can
 *   query, solve, or mutate entities within that specific visitor sandbox.
 * - This partition prevents accidental cross-session contamination and isolates anonymous browser
 *   experiments from each other and from the protected institutional benchmark ("xyz-institute-demo").
 * - It does NOT provide authenticated confidentiality or tenant isolation against adversarial callers
 *   who possess the workspace ID.
 *
 * Extracts and strictly validates the workspace ID for incoming requests.
 * Header 'x-workspace-id' takes precedence, followed by query param and body.
 * Returns XYZ_INSTITUTE_WORKSPACE ("xyz-institute-demo") or a validated visitor sandbox ID.
 * Throws an error if a malformed workspace ID is supplied.
 */
export function extractWorkspaceId(req: Request): string {
  const h = (req.headers["x-workspace-id"] as string)?.trim();
  const q = ((req.query.workspaceId || req.query.workspace) as string)?.trim();
  const b = (req.body?.workspaceId as string)?.trim();

  const candidate = h || q || b || "";

  if (!candidate || candidate === "INSTITUTIONAL" || candidate === XYZ_INSTITUTE_WORKSPACE) {
    return XYZ_INSTITUTE_WORKSPACE;
  }

  if (!VISITOR_WS_REGEX.test(candidate)) {
    throw new Error(
      `Invalid workspace ID "${candidate}". Must be "${XYZ_INSTITUTE_WORKSPACE}" or follow format "ws-<id>" with 6-64 alphanumeric characters, underscores, or dashes.`
    );
  }

  return candidate;
}

export const WORKSPACE_STORAGE_KEY = "chronos_visitor_workspace_id";
export const XYZ_INSTITUTE_WORKSPACE = "xyz-institute-demo";

/**
 * Returns or initializes a unique persistent UUID for the current visitor's workspace.
 * Stored locally in browser localStorage so it survives page reloads without requiring user login.
 */
export function getVisitorWorkspaceId(): string {
  if (typeof window === "undefined") {
    return "ws-visitor-default";
  }

  let wsId = localStorage.getItem(WORKSPACE_STORAGE_KEY);
  if (!wsId) {
    wsId = `ws-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem(WORKSPACE_STORAGE_KEY, wsId);
  }
  return wsId;
}

export function resetVisitorWorkspaceId(): string {
  if (typeof window === "undefined") {
    return "ws-visitor-default";
  }
  const newId = `ws-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  localStorage.setItem(WORKSPACE_STORAGE_KEY, newId);
  return newId;
}

import { RECEIPTS_ENABLED } from "./features";
export type Role = "ADMIN" | "OPERATOR" | "DATA_ENTRY" | "VIEWER";

export type Permission =
  | "view"          // view and search families / members / voter list
  | "edit"          // add / edit families and members
  | "delete"        // delete families / members
  | "upload"        // upload forms and verify AI extraction
  | "approve"       // confirm panth, approve KYC
  | "export"        // Excel / PDF exports
  | "receipts"      // create / cancel contribution receipts
  | "viewAadhaar"   // see full Aadhaar number and scan
  | "users"         // manage users
  | "settings"      // election date, Sangh details
  | "restore";      // see and restore soft-deleted users, families, members

const MATRIX: Record<Role, Permission[]> = {
  ADMIN: ["view", "edit", "delete", "upload", "approve", "export", "receipts", "viewAadhaar", "users", "settings", "restore"],
  OPERATOR: ["view", "edit", "delete", "upload", "approve", "export", "receipts", "viewAadhaar"],
  DATA_ENTRY: ["view", "edit", "upload"],
  VIEWER: ["view"],
};

export function can(role: Role | undefined | null, p: Permission): boolean {
  if (p === "receipts" && !RECEIPTS_ENABLED) return false; // phase 2
  return !!role && MATRIX[role]?.includes(p);
}

export const ROLES: Role[] = ["ADMIN", "OPERATOR", "DATA_ENTRY", "VIEWER"];

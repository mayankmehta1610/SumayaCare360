import { hasPermission, Session } from "../api/client";

const WRITE_ROLES = new Set([
  "SUPER_ADMIN",
  "TENANT_ADMIN",
  "DOCTOR",
  "NURSE",
  "RECEPTIONIST",
  "BILLING",
  "PHARMACIST",
  "LAB_TECH",
  "RADIOLOGIST",
]);

const READ_ONLY_ROLES = new Set(["PATIENT", "VIEWER", "AUDITOR"]);

export function canWrite(session: Session | null, resource = "masters"): boolean {
  if (!session) return false;
  if (session.permissions.includes("*")) return true;
  if (WRITE_ROLES.has(session.role_code)) return true;
  if (READ_ONLY_ROLES.has(session.role_code)) return false;
  return (
    hasPermission(session, `${resource}:*`) ||
    hasPermission(session, "encounters:*") ||
    hasPermission(session, "patients:*") ||
    hasPermission(session, "billing:*") ||
    hasPermission(session, "appointments:*")
  );
}

export function canDelete(session: Session | null): boolean {
  if (!session) return false;
  if (session.role_code === "SUPER_ADMIN" || session.role_code === "TENANT_ADMIN") return true;
  return hasPermission(session, "masters:*") || hasPermission(session, "*");
}

export function canExport(_session: Session | null): boolean {
  return true;
}

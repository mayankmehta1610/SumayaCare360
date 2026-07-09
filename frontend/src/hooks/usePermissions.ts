import { hasPermission, Session } from "../api/client";

export function canWrite(session: Session | null, resource = "masters"): boolean {
  if (!session) return false;
  if (session.permissions.includes("*")) return true;
  if (session.role_code === "PATIENT") return false;
  return (
    hasPermission(session, `${resource}:*`) ||
    hasPermission(session, "clinical:*")
  );
}

export function canDelete(session: Session | null, resource = "masters"): boolean {
  if (!session) return false;
  if (session.permissions.includes("*")) return true;
  if (session.role_code === "PATIENT") return false;
  return hasPermission(session, `${resource}:*`) || hasPermission(session, "patients:*");
}

export function canExport(session: Session | null): boolean {
  return !!session && session.role_code !== "PATIENT";
}

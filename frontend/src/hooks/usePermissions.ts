import { hasPermission, Session } from "../api/client";

const ADMIN_ROLES = new Set(["TENANT_ADMIN", "SUPER_ADMIN", "BRANCH_ADMIN"]);
const READ_ONLY_ACTIONS = new Set(["read", "self", "join"]);

function hasWriteOnResource(session: Session, resource: string): boolean {
  if (hasPermission(session, `${resource}:*`)) return true;
  const prefix = `${resource}:`;
  return session.permissions.some((p) => {
    if (!p.startsWith(prefix)) return false;
    const action = p.slice(prefix.length);
    return action !== "*" && !READ_ONLY_ACTIONS.has(action);
  });
}

/** True when the role may create/edit records for a resource (not read-only). */
export function canWrite(session: Session | null, resource = "masters"): boolean {
  if (!session) return false;
  if (session.permissions.includes("*")) return true;
  if (session.role_code === "PATIENT") return false;
  if (ADMIN_ROLES.has(session.role_code)) return true;
  return hasWriteOnResource(session, resource);
}

/** Platform module desks — tenant/branch admins and anyone with masters write. */
export function canWriteWorkspace(session: Session | null): boolean {
  if (!session) return false;
  if (session.role_code === "PATIENT") return false;
  if (ADMIN_ROLES.has(session.role_code)) return true;
  return canWrite(session, "masters") || canWrite(session, "encounters") || canWrite(session, "billing");
}

/** Order labs/imaging from clinical roles (doctor) or department staff. */
export function canOrderClinical(session: Session | null, resource: string): boolean {
  if (!session) return false;
  if (session.role_code === "PATIENT") return false;
  if (ADMIN_ROLES.has(session.role_code)) return true;
  return canWrite(session, resource) || canWrite(session, "encounters") || canWrite(session, "prescriptions");
}

export function canDelete(session: Session | null, resource = "masters"): boolean {
  if (!session) return false;
  if (session.permissions.includes("*")) return true;
  if (session.role_code === "PATIENT") return false;
  if (ADMIN_ROLES.has(session.role_code)) return true;
  return hasPermission(session, `${resource}:*`) || hasPermission(session, "patients:*");
}

export function canExport(session: Session | null): boolean {
  return !!session && session.role_code !== "PATIENT";
}

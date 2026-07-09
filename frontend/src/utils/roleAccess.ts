import { hasPermission, Session } from "../api/client";

/** Route (no tenant prefix) → minimum permission to view */
export const ROUTE_PERMISSIONS: Record<string, string | null> = {
  "/dashboard": null,
  "/demo-tour": null,
  "/portal": "PATIENT_ONLY",
  "/patients": "patients:read",
  "/providers": "providers:read",
  "/appointments": "appointments:read",
  "/care-journey": "encounters:read",
  "/encounters": "encounters:read",
  "/telemedicine": "telemedicine:read",
  "/billing": "billing:read",
  "/masters": "masters:read",
  "/audit": "audit:read",
  "/administration": "users:read",
  "/identity-security": "users:read",
  "/rooms-facilities": "masters:read",
  "/documents": "masters:read",
  "/location-services": "masters:read",
  "/clinical-hub": "clinical:read",
  "/laboratory": "laboratory:read",
  "/radiology": "radiology:read",
  "/pharmacy": "pharmacy:read",
  "/insurance-claims": "billing:read",
  "/pathways": "clinical:read",
  "/inpatient": "clinical:read",
  "/nursing": "clinical:read",
  "/emergency": "clinical:read",
  "/operation-theatre": "clinical:read",
  "/revenue-cycle": "billing:read",
  "/inventory": "masters:read",
  "/chronic-care": "clinical:read",
  "/physiotherapy": "clinical:read",
  "/post-treatment": "clinical:read",
  "/womens-child-care": "clinical:read",
  "/ambulance": "clinical:read",
  "/diet-housekeeping": "masters:read",
  "/integrations": "config:read",
  "/data-governance": "audit:read",
  "/provider-marketplace": "providers:read",
  "/mobile-apps": "config:read",
  "/reports": "reports:read",
  "/notifications": "masters:read",
  "/settings/mfa": null,
  "/engineering": "config:read",
  "/module-map": "masters:read",
  "/tenants": "SUPER_ADMIN_ONLY",
};

export function stripTenantPrefix(pathname: string, tenantCode?: string | null): string {
  if (!tenantCode) return pathname;
  const prefix = `/${tenantCode}`;
  if (pathname.startsWith(prefix)) {
    const rest = pathname.slice(prefix.length);
    return rest || "/dashboard";
  }
  return pathname;
}

export function canAccessRoute(session: Session | null, route: string): boolean {
  if (!session) return false;
  const norm = route.split("?")[0].replace(/\/$/, "") || "/dashboard";
  if (session.role_code === "SUPER_ADMIN" || session.permissions.includes("*")) return true;

  if (session.role_code === "PATIENT") {
    return norm === "/portal" || norm.startsWith("/settings");
  }

  const needed = ROUTE_PERMISSIONS[norm];
  if (needed === "SUPER_ADMIN_ONLY") return false;
  if (needed === "PATIENT_ONLY") return false;
  if (!needed) return true;

  if (hasPermission(session, needed)) return true;
  const resource = needed.split(":")[0];
  if (resource === "clinical" && hasPermission(session, "encounters:read")) return true;
  return hasPermission(session, `${resource}:*`);
}

export function homeRouteForRole(session: Session | null): string {
  if (!session) return "/login";
  if (session.role_code === "PATIENT") return "/portal";
  if (session.role_code === "LAB_TECH") return "/laboratory";
  if (session.role_code === "RADIOLOGIST") return "/radiology";
  if (session.role_code === "PHARMACIST") return "/pharmacy";
  if (session.role_code === "BILLING_STAFF") return "/billing";
  return "/dashboard";
}

export function filterNavRoutes(session: Session | null, route: string): boolean {
  if (route.startsWith("/hubs/") || route.startsWith("/engineering/")) {
    return canAccessRoute(session, "/clinical-hub");
  }
  if (route.startsWith("/modules/")) {
    return canAccessRoute(session, "/module-map");
  }
  return canAccessRoute(session, route);
}

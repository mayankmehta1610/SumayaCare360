import { Session } from "../api/client";

export type NavModule = {
  code: string;
  name: string;
  route: string;
  is_dedicated?: boolean;
};

export type NavPhase = {
  id: string;
  name: string;
  hub_route: string;
  icon: string;
  modules: NavModule[];
  module_count: number;
  hub_visible?: boolean;
};

export type RoleNavigation = {
  phases: NavPhase[];
  allowed_routes: string[];
  home_route: string;
  top_links: { to: string; label: string }[];
  role_code: string;
  total_modules?: number;
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

export function normalizeRoute(route: string): string {
  const path = (route || "/dashboard").split("?")[0].replace(/\/$/, "");
  return path || "/dashboard";
}

export function canAccessRoute(nav: RoleNavigation | null, route: string): boolean {
  if (!nav) return false;
  const norm = normalizeRoute(route);
  if (norm.startsWith("/modules/") || norm.startsWith("/engineering")) {
    return nav.role_code === "TENANT_ADMIN" || nav.role_code === "SUPER_ADMIN";
  }
  return nav.allowed_routes.includes(norm);
}

export function homeRouteForRole(nav: RoleNavigation | null): string {
  return nav?.home_route || "/dashboard";
}

const ROLE_HOME: Record<string, string> = {
  SUPER_ADMIN: "/dashboard",
  TENANT_ADMIN: "/dashboard",
  BRANCH_ADMIN: "/dashboard",
  DOCTOR: "/dashboard",
  NURSE: "/dashboard",
  RECEPTIONIST: "/dashboard",
  BILLING_STAFF: "/billing",
  PHARMACIST: "/pharmacy",
  LAB_TECH: "/laboratory",
  RADIOLOGIST: "/radiology",
  PATIENT: "/portal",
};

export function homeRouteForRoleCode(roleCode: string): string {
  return ROLE_HOME[roleCode] || "/dashboard";
}

export function canAccessRouteSession(session: Session | null, nav: RoleNavigation | null, route: string): boolean {
  if (!session || !nav) return false;
  if (session.role_code === "SUPER_ADMIN" && normalizeRoute(route) === "/tenants") return true;
  return canAccessRoute(nav, route);
}

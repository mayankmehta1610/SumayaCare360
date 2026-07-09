"""
Strict per-role screen access — each role sees only the routes listed here.
TENANT_ADMIN / SUPER_ADMIN get full access.
"""

from __future__ import annotations

# Every routable screen in the tenant app (excludes /tenants — super-admin only)
ALL_TENANT_ROUTES: frozenset[str] = frozenset({
    "/dashboard", "/demo-tour", "/module-map", "/care-journey",
    "/patients", "/providers", "/appointments", "/encounters", "/telemedicine",
    "/billing", "/masters", "/audit", "/administration", "/identity-security",
    "/rooms-facilities", "/documents", "/location-services", "/clinical-hub",
    "/laboratory", "/radiology", "/pharmacy", "/insurance-claims", "/pathways",
    "/inpatient", "/nursing", "/emergency", "/operation-theatre", "/revenue-cycle",
    "/inventory", "/chronic-care", "/physiotherapy", "/post-treatment",
    "/womens-child-care", "/ambulance", "/diet-housekeeping", "/integrations",
    "/data-governance", "/provider-marketplace", "/mobile-apps", "/reports",
    "/notifications", "/portal", "/settings/mfa", "/engineering",
    "/hubs/platform", "/hubs/front-office", "/hubs/clinical", "/hubs/diagnostics",
    "/hubs/inpatient", "/hubs/finance", "/hubs/care-programs", "/hubs/operations",
    "/hubs/engagement", "/hubs/analytics",
})

ROLE_HOME_ROUTE: dict[str, str] = {
    "SUPER_ADMIN": "/dashboard",
    "TENANT_ADMIN": "/dashboard",
    "BRANCH_ADMIN": "/dashboard",
    "DOCTOR": "/dashboard",
    "NURSE": "/dashboard",
    "RECEPTIONIST": "/dashboard",
    "BILLING_STAFF": "/billing",
    "PHARMACIST": "/pharmacy",
    "LAB_TECH": "/laboratory",
    "RADIOLOGIST": "/radiology",
    "PATIENT": "/portal",
}

# Explicit allow-list per role — no wildcards, no inference
ROLE_ALLOWED_ROUTES: dict[str, frozenset[str]] = {
    "BRANCH_ADMIN": frozenset({
        "/dashboard", "/patients", "/providers", "/appointments",
        "/billing", "/reports", "/masters", "/settings/mfa",
    }),
    "DOCTOR": frozenset({
        "/dashboard", "/patients", "/appointments", "/encounters", "/telemedicine",
        "/care-journey", "/laboratory", "/radiology", "/pharmacy", "/settings/mfa",
    }),
    "NURSE": frozenset({
        "/dashboard", "/patients", "/encounters", "/nursing", "/inpatient",
        "/care-journey", "/settings/mfa",
    }),
    "RECEPTIONIST": frozenset({
        "/dashboard", "/patients", "/appointments", "/emergency", "/providers", "/settings/mfa",
    }),
    "BILLING_STAFF": frozenset({
        "/dashboard", "/patients", "/billing", "/insurance-claims",
        "/revenue-cycle", "/reports", "/settings/mfa",
    }),
    "PHARMACIST": frozenset({
        "/dashboard", "/pharmacy", "/patients", "/settings/mfa",
    }),
    "LAB_TECH": frozenset({
        "/laboratory", "/patients", "/settings/mfa",
    }),
    "RADIOLOGIST": frozenset({
        "/radiology", "/patients", "/settings/mfa",
    }),
    "PATIENT": frozenset({"/portal", "/settings/mfa"}),
}

ROLE_TOP_LINKS: dict[str, list[dict[str, str]]] = {
    "TENANT_ADMIN": [
        {"to": "/dashboard", "label": "Dashboard"},
        {"to": "/demo-tour", "label": "Demo tour"},
        {"to": "/module-map", "label": "Module map"},
    ],
    "BRANCH_ADMIN": [
        {"to": "/dashboard", "label": "Dashboard"},
        {"to": "/reports", "label": "Reports"},
    ],
    "DOCTOR": [
        {"to": "/dashboard", "label": "Dashboard"},
        {"to": "/care-journey", "label": "Care journey"},
    ],
    "NURSE": [
        {"to": "/dashboard", "label": "Dashboard"},
        {"to": "/care-journey", "label": "Care journey"},
    ],
    "RECEPTIONIST": [
        {"to": "/dashboard", "label": "Dashboard"},
    ],
    "BILLING_STAFF": [
        {"to": "/dashboard", "label": "Dashboard"},
        {"to": "/reports", "label": "Reports"},
    ],
    "PHARMACIST": [
        {"to": "/pharmacy", "label": "Pharmacy"},
    ],
    "LAB_TECH": [
        {"to": "/laboratory", "label": "Laboratory"},
    ],
    "RADIOLOGIST": [
        {"to": "/radiology", "label": "Radiology"},
    ],
    "PATIENT": [
        {"to": "/portal", "label": "My portal"},
    ],
}


def normalize_route(route: str) -> str:
    path = (route or "/dashboard").split("?")[0].rstrip("/")
    return path or "/dashboard"


def has_full_access(role_code: str, is_super_admin: bool = False) -> bool:
    return is_super_admin or role_code in ("SUPER_ADMIN", "TENANT_ADMIN")


def allowed_routes_for(role_code: str, is_super_admin: bool = False) -> frozenset[str]:
    if has_full_access(role_code, is_super_admin):
        routes = set(ALL_TENANT_ROUTES)
        if is_super_admin or role_code == "SUPER_ADMIN":
            routes.add("/tenants")
        return frozenset(routes)
    return ROLE_ALLOWED_ROUTES.get(role_code, frozenset({"/dashboard", "/settings/mfa"}))


def home_route_for(role_code: str) -> str:
    return ROLE_HOME_ROUTE.get(role_code, "/dashboard")


def can_access_route(role_code: str, route: str, is_super_admin: bool = False) -> bool:
    norm = normalize_route(route)
    if norm.startswith("/modules/"):
        return has_full_access(role_code, is_super_admin)
    if norm.startswith("/engineering"):
        return has_full_access(role_code, is_super_admin)
    if norm == "/tenants":
        return is_super_admin or role_code == "SUPER_ADMIN"
    allowed = allowed_routes_for(role_code, is_super_admin)
    return norm in allowed


def filter_module_flow(flow: dict, role_code: str, is_super_admin: bool = False) -> dict:
    """Return only phases/modules the role may see."""
    allowed = allowed_routes_for(role_code, is_super_admin)
    full = has_full_access(role_code, is_super_admin)

    filtered_phases = []
    for phase in flow.get("phases", []):
        hub_route = phase.get("hub_route", "")
        modules = [
            m for m in phase.get("modules", [])
            if full or m.get("route") in allowed
        ]
        if not full and hub_route not in allowed and not modules:
            continue
        phase_out = {
            **phase,
            "modules": modules,
            "module_count": len(modules),
            "hub_visible": full or hub_route in allowed,
        }
        if modules or phase_out["hub_visible"]:
            filtered_phases.append(phase_out)

    top_links = ROLE_TOP_LINKS.get(role_code, [{"to": "/dashboard", "label": "Dashboard"}])
    if full:
        top_links = ROLE_TOP_LINKS.get("TENANT_ADMIN", top_links)

    return {
        "phases": filtered_phases,
        "total_modules": sum(p["module_count"] for p in filtered_phases),
        "catalog_modules": flow.get("catalog_modules"),
        "allowed_routes": sorted(allowed),
        "home_route": home_route_for(role_code),
        "top_links": top_links,
        "role_code": role_code,
    }


def build_navigation(role_code: str, is_super_admin: bool = False) -> dict:
    from app.data.module_flow import build_module_flow_response
    flow = build_module_flow_response()
    return filter_module_flow(flow, role_code, is_super_admin)

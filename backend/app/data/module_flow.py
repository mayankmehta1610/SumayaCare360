"""Logical care & operations flow — all 36 modules in interconnected phases."""

from app.data.module_catalog import MODULE_CATALOG

# phase_id → ordered journey stage
CARE_PHASES = [
    {
        "id": "platform",
        "order": 1,
        "name": "1 · Platform & setup",
        "description": "Tenant config, security, masters, governance",
        "hub_route": "/hubs/platform",
        "icon": "⚙️",
    },
    {
        "id": "front-office",
        "order": 2,
        "name": "2 · Front office",
        "description": "Register patients, providers, appointments, triage",
        "hub_route": "/hubs/front-office",
        "icon": "🏥",
    },
    {
        "id": "clinical",
        "order": 3,
        "name": "3 · Clinical care",
        "description": "OPD encounter, telemedicine, end-to-end journey",
        "hub_route": "/hubs/clinical",
        "icon": "🩺",
    },
    {
        "id": "diagnostics",
        "order": 4,
        "name": "4 · Diagnostics & pharmacy",
        "description": "Lab, radiology, dispensing linked to encounters",
        "hub_route": "/hubs/diagnostics",
        "icon": "🔬",
    },
    {
        "id": "inpatient",
        "order": 5,
        "name": "5 · Inpatient",
        "description": "Admission, nursing, OT, ward management",
        "hub_route": "/hubs/inpatient",
        "icon": "🛏️",
    },
    {
        "id": "finance",
        "order": 6,
        "name": "6 · Finance & RCM",
        "description": "Estimates, invoices, insurance, revenue cycle",
        "hub_route": "/hubs/finance",
        "icon": "💳",
    },
    {
        "id": "care-programs",
        "order": 7,
        "name": "7 · Care programs",
        "description": "Pathways, chronic care, rehab, specialty programs",
        "hub_route": "/hubs/care-programs",
        "icon": "📋",
    },
    {
        "id": "operations",
        "order": 8,
        "name": "8 · Operations",
        "description": "Ambulance, catering, inventory, marketplace, GPS",
        "hub_route": "/hubs/operations",
        "icon": "🚑",
    },
    {
        "id": "engagement",
        "order": 9,
        "name": "9 · Engagement",
        "description": "Notifications, patient portal, mobile apps",
        "hub_route": "/hubs/engagement",
        "icon": "📱",
    },
    {
        "id": "analytics",
        "order": 10,
        "name": "10 · Analytics & compliance",
        "description": "Reports, audit, engineering APIs",
        "hub_route": "/hubs/analytics",
        "icon": "📊",
    },
]

# module_code → flow metadata
MODULE_FLOW: dict[str, dict] = {
    "super-admin-and-saas-control": {
        "phase": "platform", "order": 1, "next": ["identity-rbac-and-security"],
        "super_only": True,
        "links": [{"label": "Tenant list", "route": "/tenants", "super_only": True}],
    },
    "identity-rbac-and-security": {
        "phase": "platform", "order": 2, "next": ["hospital-clinic-administration"],
        "links": [{"label": "MFA settings", "route": "/settings/mfa"}],
    },
    "hospital-clinic-administration": {
        "phase": "platform", "order": 3, "next": ["rooms-and-facilities"],
        "links": [{"label": "Administration hub", "route": "/administration"}],
    },
    "rooms-and-facilities": {
        "phase": "platform", "order": 4, "next": ["document-forms-and-templates"],
        "links": [{"label": "Bed master", "route": "/masters"}],
    },
    "document-forms-and-templates": {
        "phase": "platform", "order": 5, "next": ["data-governance-and-platform-ops"],
        "links": [{"label": "Upload document", "route": "/modules/document-forms-and-templates"}],
    },
    "data-governance-and-platform-ops": {
        "phase": "platform", "order": 6, "next": ["integrations-and-interoperability"],
    },
    "integrations-and-interoperability": {
        "phase": "platform", "order": 7, "next": ["patient-registration-and-crm"],
    },
    "audit-trail-and-governance": {
        "phase": "analytics", "order": 2, "next": ["reports-bi-and-analytics"],
        "links": [{"label": "Audit viewer", "route": "/audit"}],
    },
    "patient-registration-and-crm": {
        "phase": "front-office", "order": 1, "next": ["doctor-and-provider-management"],
        "links": [
            {"label": "Register patient", "route": "/patients"},
            {"label": "Start care journey", "route": "/care-journey"},
        ],
    },
    "doctor-and-provider-management": {
        "phase": "front-office", "order": 2, "next": ["appointment-and-queue-management"],
        "links": [{"label": "Providers", "route": "/providers"}],
    },
    "appointment-and-queue-management": {
        "phase": "front-office", "order": 3, "next": ["emergency-and-triage"],
        "links": [{"label": "Appointments & queue", "route": "/appointments"}],
    },
    "emergency-and-triage": {
        "phase": "front-office", "order": 4, "next": ["opd-clinical-workflow"],
        "links": [{"label": "Triage module", "route": "/modules/emergency-and-triage"}],
    },
    "opd-clinical-workflow": {
        "phase": "clinical", "order": 2, "next": ["telemedicine-and-virtual-care"],
        "links": [
            {"label": "Encounters", "route": "/encounters"},
            {"label": "Care journey", "route": "/care-journey"},
        ],
    },
    "telemedicine-and-virtual-care": {
        "phase": "clinical", "order": 3, "next": ["laboratory-and-diagnostics"],
        "links": [{"label": "Telemedicine room", "route": "/telemedicine"}],
    },
    "laboratory-and-diagnostics": {
        "phase": "diagnostics", "order": 1, "next": ["radiology-and-imaging"],
        "links": [{"label": "Order lab (clinical hub)", "route": "/clinical-hub"}],
    },
    "radiology-and-imaging": {
        "phase": "diagnostics", "order": 2, "next": ["pharmacy-management"],
        "links": [{"label": "Radiology module", "route": "/modules/radiology-and-imaging"}],
    },
    "pharmacy-management": {
        "phase": "diagnostics", "order": 3, "next": ["ipd-admission-and-ward-management"],
        "links": [{"label": "Pharmacy module", "route": "/modules/pharmacy-management"}],
    },
    "ipd-admission-and-ward-management": {
        "phase": "inpatient", "order": 1, "next": ["nursing-and-care-plans"],
        "links": [{"label": "Admit patient", "route": "/clinical-hub"}],
    },
    "nursing-and-care-plans": {
        "phase": "inpatient", "order": 2, "next": ["operation-theatre-and-procedures"],
    },
    "operation-theatre-and-procedures": {
        "phase": "inpatient", "order": 3, "next": ["billing-tariff-and-payments"],
    },
    "billing-tariff-and-payments": {
        "phase": "finance", "order": 1, "next": ["insurance-and-claims"],
        "links": [{"label": "Billing desk", "route": "/billing"}],
    },
    "insurance-and-claims": {
        "phase": "finance", "order": 2, "next": ["revenue-cycle-management"],
        "links": [{"label": "Submit claim", "route": "/clinical-hub"}],
    },
    "revenue-cycle-management": {
        "phase": "finance", "order": 3, "next": ["disease-and-care-pathways"],
    },
    "disease-and-care-pathways": {
        "phase": "care-programs", "order": 1, "next": ["chronic-disease-programs"],
    },
    "chronic-disease-programs": {
        "phase": "care-programs", "order": 2, "next": ["physiotherapy-and-rehab"],
    },
    "physiotherapy-and-rehab": {
        "phase": "care-programs", "order": 3, "next": ["post-treatment-patient-care"],
    },
    "post-treatment-patient-care": {
        "phase": "care-programs", "order": 4, "next": ["women-child-and-specialty-care"],
        "links": [{"label": "Patient portal follow-up", "route": "/portal"}],
    },
    "women-child-and-specialty-care": {
        "phase": "care-programs", "order": 5, "next": ["ambulance-and-transport"],
    },
    "ambulance-and-transport": {
        "phase": "operations", "order": 1, "next": ["diet-catering-and-housekeeping"],
    },
    "diet-catering-and-housekeeping": {
        "phase": "operations", "order": 2, "next": ["inventory-procurement-and-stores"],
    },
    "inventory-procurement-and-stores": {
        "phase": "operations", "order": 3, "next": ["provider-marketplace"],
    },
    "provider-marketplace": {
        "phase": "operations", "order": 4, "next": ["location-services"],
    },
    "location-services": {
        "phase": "operations", "order": 5, "next": ["notifications-and-engagement"],
    },
    "notifications-and-engagement": {
        "phase": "engagement", "order": 1, "next": ["mobile-apps"],
        "links": [{"label": "Notifications outbox", "route": "/notifications"}],
    },
    "mobile-apps": {
        "phase": "engagement", "order": 3, "next": ["reports-bi-and-analytics"],
    },
    "reports-bi-and-analytics": {
        "phase": "analytics", "order": 1, "next": ["audit-trail-and-governance"],
        "links": [{"label": "Reports", "route": "/reports"}],
    },
}

# Virtual modules (not in MODULE_CATALOG but part of flow UI)
VIRTUAL_MODULES = [
    {"code": "_care-journey", "name": "Care Journey (E2E)", "route": "/care-journey", "phase": "clinical", "order": 1,
     "next": ["opd-clinical-workflow"], "links": []},
    {"code": "_masters", "name": "Configuration Masters", "route": "/masters", "phase": "platform", "order": 8,
     "next": ["patient-registration-and-crm"], "links": []},
    {"code": "_clinical-hub", "name": "Clinical Operations Hub", "route": "/clinical-hub", "phase": "diagnostics", "order": 0,
     "next": ["laboratory-and-diagnostics"], "links": []},
    {"code": "_portal", "name": "Patient Portal", "route": "/portal", "phase": "engagement", "order": 2,
     "next": ["mobile-apps"], "links": []},
    {"code": "_engineering", "name": "Engineering APIs", "route": "/engineering", "phase": "analytics", "order": 3,
     "next": [], "links": []},
    {"code": "_administration", "name": "Administration Hub", "route": "/administration", "phase": "platform", "order": 0,
     "next": ["hospital-clinic-administration"], "links": []},
]

_CATALOG_BY_CODE = {m["code"]: m for m in MODULE_CATALOG}


def resolve_route(module_code: str) -> str:
    if module_code.startswith("_"):
        for v in VIRTUAL_MODULES:
            if v["code"] == module_code:
                return v["route"]
    cat = _CATALOG_BY_CODE.get(module_code)
    if not cat:
        return f"/modules/{module_code}"
    if cat.get("dedicated"):
        return cat["route"]
    return cat.get("route") or f"/modules/{module_code}"


def build_module_flow_response() -> dict:
    phases_out = []
    for phase in CARE_PHASES:
        modules_in_phase = []
        for item in MODULE_CATALOG:
            meta = MODULE_FLOW.get(item["code"], {})
            if meta.get("phase") != phase["id"]:
                continue
            modules_in_phase.append(_module_entry(item["code"], item, meta))
        for v in VIRTUAL_MODULES:
            if v.get("phase") == phase["id"]:
                modules_in_phase.append({
                    "code": v["code"],
                    "name": v["name"],
                    "route": v["route"],
                    "order": v.get("order", 99),
                    "is_dedicated": True,
                    "is_virtual": True,
                    "next_modules": [_module_ref(c) for c in v.get("next", [])],
                    "quick_links": v.get("links", []),
                    "submodules": [],
                })
        modules_in_phase.sort(key=lambda x: x["order"])
        phases_out.append({
            **phase,
            "modules": modules_in_phase,
            "module_count": len(modules_in_phase),
        })

    return {
        "phases": phases_out,
        "total_modules": len(MODULE_CATALOG) + len(VIRTUAL_MODULES),
        "catalog_modules": len(MODULE_CATALOG),
    }


def _module_ref(code: str) -> dict:
    if code.startswith("_"):
        for v in VIRTUAL_MODULES:
            if v["code"] == code:
                return {"code": code, "name": v["name"], "route": v["route"]}
    cat = _CATALOG_BY_CODE.get(code)
    return {
        "code": code,
        "name": cat["name"] if cat else code,
        "route": resolve_route(code),
    }


def _module_entry(code: str, catalog_item: dict, meta: dict) -> dict:
    next_codes = meta.get("next", [])
    prev = None
    for c, m in MODULE_FLOW.items():
        if code in m.get("next", []):
            prev = c
            break
    return {
        "code": code,
        "name": catalog_item["name"],
        "route": resolve_route(code),
        "order": meta.get("order", 99),
        "is_dedicated": catalog_item.get("dedicated", False),
        "is_virtual": False,
        "category": catalog_item.get("category"),
        "submodules": catalog_item.get("submodules", []),
        "next_modules": [_module_ref(c) for c in next_codes],
        "prev_module": _module_ref(prev) if prev else None,
        "quick_links": meta.get("links", []),
        "super_only": meta.get("super_only", False),
    }


def flow_for_module(module_code: str) -> dict | None:
    if module_code.startswith("_"):
        for v in VIRTUAL_MODULES:
            if v["code"] == module_code:
                return {"module": v, "phase": next(p for p in CARE_PHASES if p["id"] == v["phase"])}
    cat = _CATALOG_BY_CODE.get(module_code)
    if not cat:
        return None
    meta = MODULE_FLOW.get(module_code, {})
    phase_id = meta.get("phase", "platform")
    phase = next((p for p in CARE_PHASES if p["id"] == phase_id), CARE_PHASES[0])
    return {
        "module": _module_entry(module_code, cat, meta),
        "phase": phase,
    }

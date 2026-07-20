"""Per-module lifecycle definitions for dedicated domain desks (not generic ModulePage)."""

from app.data.module_catalog import MODULE_CATALOG

# module_code -> config
DOMAIN_MODULES: dict[str, dict] = {
    "inventory-procurement-and-stores": {
        "api_prefix": "/dedicated/inventory-procurement-and-stores",
        "initial_status": "draft",
        "transitions": {
            "draft": {"submitted"},
            "submitted": {"approved", "rejected"},
            "approved": {"ordered"},
            "ordered": {"received"},
            "received": {"closed"},
            "rejected": set(),
            "closed": set(),
        },
    },
    "chronic-disease-programs": {
        "api_prefix": "/dedicated/chronic-disease-programs",
        "initial_status": "enrolled",
        "transitions": {
            "enrolled": {"active"},
            "active": {"review_due", "completed"},
            "review_due": {"active", "completed"},
            "completed": set(),
        },
    },
    "physiotherapy-and-rehab": {
        "api_prefix": "/dedicated/physiotherapy-and-rehab",
        "initial_status": "assessed",
        "transitions": {
            "assessed": {"planned"},
            "planned": {"in_session"},
            "in_session": {"completed"},
            "completed": set(),
        },
    },
    "post-treatment-patient-care": {
        "api_prefix": "/dedicated/post-treatment-patient-care",
        "initial_status": "planned",
        "transitions": {
            "planned": {"scheduled"},
            "scheduled": {"in_progress"},
            "in_progress": {"completed", "escalated"},
            "escalated": {"in_progress", "completed"},
            "completed": set(),
        },
    },
    "women-child-and-specialty-care": {
        "api_prefix": "/dedicated/women-child-and-specialty-care",
        "initial_status": "registered",
        "transitions": {
            "registered": {"scheduled"},
            "scheduled": {"in_visit"},
            "in_visit": {"follow_up", "closed"},
            "follow_up": {"scheduled", "closed"},
            "closed": set(),
        },
    },
    "ambulance-and-transport": {
        "api_prefix": "/dedicated/ambulance-and-transport",
        "initial_status": "requested",
        "transitions": {
            "requested": {"dispatched"},
            "dispatched": {"en_route"},
            "en_route": {"on_scene"},
            "on_scene": {"transporting"},
            "transporting": {"handover"},
            "handover": {"closed"},
            "closed": set(),
        },
    },
    "diet-catering-and-housekeeping": {
        "api_prefix": "/dedicated/diet-catering-and-housekeeping",
        "initial_status": "ordered",
        "transitions": {
            "ordered": {"preparing"},
            "preparing": {"delivered"},
            "delivered": {"closed"},
            "closed": set(),
        },
    },
    "integrations-and-interoperability": {
        "api_prefix": "/dedicated/integrations-and-interoperability",
        "initial_status": "draft",
        "transitions": {
            "draft": {"testing"},
            "testing": {"active", "failed"},
            "active": {"suspended"},
            "failed": {"draft"},
            "suspended": {"active"},
        },
    },
    "data-governance-and-platform-ops": {
        "api_prefix": "/dedicated/data-governance-and-platform-ops",
        "initial_status": "proposed",
        "transitions": {
            "proposed": {"approved"},
            "approved": {"active"},
            "active": {"archived"},
            "archived": set(),
        },
    },
    "provider-marketplace": {
        "api_prefix": "/dedicated/provider-marketplace",
        "initial_status": "onboarding",
        "transitions": {
            "onboarding": {"contracted"},
            "contracted": {"active"},
            "active": {"suspended", "terminated"},
            "suspended": {"active", "terminated"},
            "terminated": set(),
        },
    },
    "mobile-apps": {
        "api_prefix": "/dedicated/mobile-apps",
        "initial_status": "draft",
        "transitions": {
            "draft": {"beta"},
            "beta": {"released"},
            "released": {"deprecated"},
            "deprecated": set(),
        },
    },
    "rooms-and-facilities": {
        "api_prefix": "/dedicated/rooms-and-facilities",
        "initial_status": "pending",
        "transitions": {
            "pending": {"in_progress"},
            "in_progress": {"completed"},
            "completed": set(),
        },
    },
}

_CATALOG_BY_CODE = {m["code"]: m for m in MODULE_CATALOG}


def get_domain_meta(module_code: str) -> dict | None:
    cfg = DOMAIN_MODULES.get(module_code)
    cat = _CATALOG_BY_CODE.get(module_code)
    if not cfg or not cat:
        return None
    statuses = set(cfg["transitions"].keys())
    for targets in cfg["transitions"].values():
        statuses |= targets
    from app.data.domain_fields import DOMAIN_FIELD_SCHEMAS, PATIENT_LINKED_MODULES
    return {
        "module_code": module_code,
        "name": cat["name"],
        "category": cat["category"],
        "submodules": cat["submodules"],
        "api_prefix": cfg["api_prefix"],
        "initial_status": cfg["initial_status"],
        "statuses": sorted(statuses),
        "transitions": {k: sorted(v) for k, v in cfg["transitions"].items()},
        "fields_by_submodule": DOMAIN_FIELD_SCHEMAS.get(module_code, {}),
        "requires_patient": module_code in PATIENT_LINKED_MODULES,
    }


def allowed_next(module_code: str, current: str) -> list[str]:
    cfg = DOMAIN_MODULES.get(module_code)
    if not cfg:
        return []
    return sorted(cfg["transitions"].get(current, set()))


def validate_transition(module_code: str, current: str, target: str) -> None:
    from fastapi import HTTPException
    allowed = DOMAIN_MODULES.get(module_code, {}).get("transitions", {}).get(current, set())
    if target not in allowed:
        raise HTTPException(
            400,
            f"Invalid transition for {module_code}: {current} → {target}. Allowed: {sorted(allowed) or 'none'}",
        )

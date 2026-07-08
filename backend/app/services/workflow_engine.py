"""Workflow transition validation using WorkflowDefinition from DB."""
from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models import entities as m

# Fallback transitions when DB definition has no transitions configured.
DEFAULT_TRANSITIONS: dict[str, list[dict[str, str]]] = {
    "insurance-and-claims": [
        {"from": "draft", "to": "submitted"},
        {"from": "submitted", "to": "under_review"},
        {"from": "under_review", "to": "approved"},
        {"from": "under_review", "to": "denied"},
        {"from": "approved", "to": "paid"},
        {"from": "denied", "to": "draft"},
    ],
    "disease-and-care-pathways": [
        {"from": "active", "to": "paused"},
        {"from": "active", "to": "completed"},
        {"from": "active", "to": "withdrawn"},
        {"from": "paused", "to": "active"},
        {"from": "paused", "to": "withdrawn"},
    ],
}


def _load_transitions(
    db: Session,
    module_code: str,
    tenant_id: Optional[UUID],
) -> list[dict[str, str]]:
    wf = (
        db.query(m.WorkflowDefinition)
        .filter(
            m.WorkflowDefinition.module_code == module_code,
            m.WorkflowDefinition.is_deleted == False,
            or_(
                m.WorkflowDefinition.tenant_id == tenant_id,
                m.WorkflowDefinition.tenant_id.is_(None),
            ),
        )
        .all()
    )
    if wf:
        tenant_wf = next((w for w in wf if w.tenant_id == tenant_id), None)
        global_wf = next((w for w in wf if w.tenant_id is None), None)
        chosen = tenant_wf or global_wf
        if chosen and chosen.transitions:
            return list(chosen.transitions)
    return list(DEFAULT_TRANSITIONS.get(module_code, []))


def validate_transition(
    db: Session,
    module_code: str,
    from_status: str,
    to_status: str,
    *,
    tenant_id: Optional[UUID] = None,
    allow_same: bool = False,
) -> None:
    """Raise HTTP 400 if transition is not allowed for the module workflow."""
    if from_status == to_status:
        if allow_same:
            return
        raise HTTPException(400, f"Status already '{from_status}'")

    transitions = _load_transitions(db, module_code, tenant_id)
    if not transitions:
        return

    allowed = {t["to"] for t in transitions if t.get("from") == from_status}
    if to_status not in allowed:
        raise HTTPException(
            400,
            f"Invalid status transition for {module_code}: {from_status} → {to_status}. "
            f"Allowed: {sorted(allowed) or ['any (no rules)']}",
        )


def allowed_next_statuses(
    db: Session,
    module_code: str,
    from_status: str,
    *,
    tenant_id: Optional[UUID] = None,
) -> list[str]:
    transitions = _load_transitions(db, module_code, tenant_id)
    return sorted({t["to"] for t in transitions if t.get("from") == from_status})

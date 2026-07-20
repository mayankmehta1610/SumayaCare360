"""Emergency & triage domain — ESI assessment lifecycle."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import entities as m
from app.services.audit import write_audit

TRIAGE_STATUSES = ("arrived", "triaged", "treatment", "disposition")
TRIAGE_TRANSITIONS: dict[str, set[str]] = {
    "arrived": {"triaged"},
    "triaged": {"treatment"},
    "treatment": {"disposition"},
    "disposition": set(),
}


def _assert_transition(current: str, target: str):
    allowed = TRIAGE_TRANSITIONS.get(current, set())
    if target not in allowed:
        raise HTTPException(
            400,
            f"Invalid triage transition: {current} → {target}. Allowed: {sorted(allowed) or 'none'}",
        )


def _triage_no(db: Session, tenant_id: UUID) -> str:
    n = db.query(m.TriageAssessment).filter(m.TriageAssessment.tenant_id == tenant_id).count() + 1
    return f"TRI-{n:06d}"


def serialize_triage(row: m.TriageAssessment) -> dict:
    return {
        "id": str(row.id),
        "triage_no": row.triage_no,
        "patient_id": str(row.patient_id),
        "chief_complaint": row.chief_complaint,
        "esi_level": row.esi_level,
        "status": row.status,
        "disposition": row.disposition,
        "notes": row.notes,
        "clinical_profile": row.clinical_profile or {},
        "arrived_at": row.arrived_at,
        "triaged_at": row.triaged_at,
        "disposition_at": row.disposition_at,
    }


def list_triages(db: Session, tenant_id: UUID, *, status: Optional[str] = None) -> list[m.TriageAssessment]:
    q = db.query(m.TriageAssessment).filter(
        m.TriageAssessment.tenant_id == tenant_id,
        m.TriageAssessment.is_deleted == False,
    )
    if status:
        q = q.filter(m.TriageAssessment.status == status)
    return q.order_by(m.TriageAssessment.arrived_at.desc()).limit(200).all()


def get_triage(db: Session, tenant_id: UUID, triage_id: UUID) -> m.TriageAssessment:
    row = db.query(m.TriageAssessment).filter(
        m.TriageAssessment.id == triage_id,
        m.TriageAssessment.tenant_id == tenant_id,
        m.TriageAssessment.is_deleted == False,
    ).first()
    if not row:
        raise HTTPException(404, "Triage assessment not found")
    return row


def create_triage(
    db: Session,
    *,
    tenant_id: UUID,
    patient_id: UUID,
    chief_complaint: str,
    esi_level: int,
    notes: str = "",
    clinical_profile: dict,
    actor_id: UUID,
    correlation_id: Optional[str] = None,
) -> m.TriageAssessment:
    patient = db.query(m.Patient).filter(
        m.Patient.id == patient_id, m.Patient.tenant_id == tenant_id, m.Patient.is_deleted == False
    ).first()
    if not patient:
        raise HTTPException(404, "Patient not found")
    if esi_level < 1 or esi_level > 5:
        raise HTTPException(400, "ESI level must be 1–5")
    row = m.TriageAssessment(
        tenant_id=tenant_id,
        patient_id=patient_id,
        triage_no=_triage_no(db, tenant_id),
        chief_complaint=chief_complaint,
        esi_level=esi_level,
        notes=notes,
        clinical_profile=clinical_profile,
        status="arrived",
    )
    db.add(row)
    db.flush()
    write_audit(db, tenant_id=tenant_id, actor_user_id=actor_id, action="triage.create", entity_type="triage", entity_id=row.id, correlation_id=correlation_id)
    return row


def transition_triage(
    db: Session,
    row: m.TriageAssessment,
    target: str,
    *,
    disposition: Optional[str] = None,
    actor_id: UUID,
    correlation_id: Optional[str] = None,
) -> m.TriageAssessment:
    _assert_transition(row.status, target)
    now = datetime.now(timezone.utc)
    row.status = target
    if target == "triaged":
        row.triaged_at = now
    if target == "disposition":
        row.disposition_at = now
        if disposition:
            row.disposition = disposition
    write_audit(db, tenant_id=row.tenant_id, actor_user_id=actor_id, action=f"triage.{target}", entity_type="triage", entity_id=row.id, correlation_id=correlation_id)
    return row

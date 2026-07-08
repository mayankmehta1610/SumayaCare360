"""Operation theatre & procedures domain."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import entities as m
from app.services.audit import write_audit

OT_STATUSES = ("scheduled", "pre_op", "in_progress", "completed", "cancelled")
OT_TRANSITIONS: dict[str, set[str]] = {
    "scheduled": {"pre_op", "cancelled"},
    "pre_op": {"in_progress", "cancelled"},
    "in_progress": {"completed"},
    "completed": set(),
    "cancelled": set(),
}


def _assert_transition(current: str, target: str):
    allowed = OT_TRANSITIONS.get(current, set())
    if target not in allowed:
        raise HTTPException(
            400,
            f"Invalid OT transition: {current} → {target}. Allowed: {sorted(allowed) or 'none'}",
        )


def _procedure_no(db: Session, tenant_id: UUID) -> str:
    n = db.query(m.OtProcedure).filter(m.OtProcedure.tenant_id == tenant_id).count() + 1
    return f"OT-{n:06d}"


def serialize_ot(row: m.OtProcedure) -> dict:
    return {
        "id": str(row.id),
        "procedure_no": row.procedure_no,
        "patient_id": str(row.patient_id),
        "procedure_code": row.procedure_code,
        "procedure_name": row.procedure_name,
        "surgeon_id": str(row.surgeon_id) if row.surgeon_id else None,
        "theatre_code": row.theatre_code,
        "status": row.status,
        "scheduled_at": row.scheduled_at,
        "pre_op_checklist": row.pre_op_checklist or {},
        "intra_op_notes": row.intra_op_notes,
        "implant_tracking": row.implant_tracking or [],
    }


def list_ot_procedures(db: Session, tenant_id: UUID, *, status: Optional[str] = None) -> list[m.OtProcedure]:
    q = db.query(m.OtProcedure).filter(
        m.OtProcedure.tenant_id == tenant_id,
        m.OtProcedure.is_deleted == False,
    )
    if status:
        q = q.filter(m.OtProcedure.status == status)
    return q.order_by(m.OtProcedure.scheduled_at.desc().nullslast()).limit(200).all()


def get_ot_procedure(db: Session, tenant_id: UUID, procedure_id: UUID) -> m.OtProcedure:
    row = db.query(m.OtProcedure).filter(
        m.OtProcedure.id == procedure_id,
        m.OtProcedure.tenant_id == tenant_id,
        m.OtProcedure.is_deleted == False,
    ).first()
    if not row:
        raise HTTPException(404, "OT procedure not found")
    return row


def create_ot_procedure(
    db: Session,
    *,
    tenant_id: UUID,
    patient_id: UUID,
    procedure_code: str,
    procedure_name: str,
    theatre_code: str = "",
    surgeon_id: Optional[UUID] = None,
    scheduled_at: Optional[datetime] = None,
    actor_id: UUID,
    correlation_id: Optional[str] = None,
) -> m.OtProcedure:
    patient = db.query(m.Patient).filter(
        m.Patient.id == patient_id, m.Patient.tenant_id == tenant_id, m.Patient.is_deleted == False
    ).first()
    if not patient:
        raise HTTPException(404, "Patient not found")
    row = m.OtProcedure(
        tenant_id=tenant_id,
        patient_id=patient_id,
        procedure_no=_procedure_no(db, tenant_id),
        procedure_code=procedure_code,
        procedure_name=procedure_name,
        theatre_code=theatre_code,
        surgeon_id=surgeon_id,
        scheduled_at=scheduled_at,
        status="scheduled",
        pre_op_checklist={"consent": False, "labs_ok": False, "npo": False},
    )
    db.add(row)
    db.flush()
    write_audit(db, tenant_id=tenant_id, actor_user_id=actor_id, action="ot.create", entity_type="ot_procedure", entity_id=row.id, correlation_id=correlation_id)
    return row


def update_pre_op_checklist(
    db: Session,
    row: m.OtProcedure,
    checklist: dict[str, Any],
    *,
    actor_id: UUID,
    correlation_id: Optional[str] = None,
) -> m.OtProcedure:
    merged = dict(row.pre_op_checklist or {})
    merged.update(checklist)
    row.pre_op_checklist = merged
    write_audit(db, tenant_id=row.tenant_id, actor_user_id=actor_id, action="ot.pre_op_update", entity_type="ot_procedure", entity_id=row.id, correlation_id=correlation_id)
    return row


def transition_ot(
    db: Session,
    row: m.OtProcedure,
    target: str,
    *,
    intra_op_notes: Optional[str] = None,
    actor_id: UUID,
    correlation_id: Optional[str] = None,
) -> m.OtProcedure:
    _assert_transition(row.status, target)
    if target == "pre_op":
        checklist = row.pre_op_checklist or {}
        if not all(checklist.get(k) for k in ("consent", "labs_ok", "npo")):
            raise HTTPException(400, "Complete pre-op checklist before advancing to pre_op")
    row.status = target
    if intra_op_notes:
        row.intra_op_notes = intra_op_notes
    write_audit(db, tenant_id=row.tenant_id, actor_user_id=actor_id, action=f"ot.{target}", entity_type="ot_procedure", entity_id=row.id, correlation_id=correlation_id)
    return row

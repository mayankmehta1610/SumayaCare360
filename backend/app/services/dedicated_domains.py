"""Dedicated domain work items — lifecycle-enforced records per module."""
from __future__ import annotations

from typing import Any, Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.data.domain_lifecycles import DOMAIN_MODULES, get_domain_meta, validate_transition
from app.models import entities as m
from app.services.audit import write_audit


def _ref_no(db: Session, tenant_id: UUID, module_code: str) -> str:
    prefix = "".join(p[0].upper() for p in module_code.split("-")[:3])[:6]
    n = db.query(m.ModuleRecord).filter(
        m.ModuleRecord.tenant_id == tenant_id,
        m.ModuleRecord.module_code == module_code,
    ).count() + 1
    return f"{prefix}-{n:06d}"


def serialize_record(row: m.ModuleRecord, *, module_code: str) -> dict[str, Any]:
    from app.data.domain_lifecycles import allowed_next
    return {
        "id": str(row.id),
        "module_code": row.module_code,
        "submodule": row.submodule,
        "reference_no": row.reference_no,
        "title": row.title,
        "status": row.status,
        "payload": row.payload or {},
        "patient_id": str(row.patient_id) if row.patient_id else None,
        "provider_id": str(row.provider_id) if row.provider_id else None,
        "allowed_next_statuses": allowed_next(module_code, row.status),
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def list_records(
    db: Session,
    tenant_id: UUID,
    module_code: str,
    *,
    submodule: Optional[str] = None,
    status: Optional[str] = None,
) -> list[m.ModuleRecord]:
    if module_code not in DOMAIN_MODULES:
        raise HTTPException(404, f"No dedicated domain config for {module_code}")
    q = db.query(m.ModuleRecord).filter(
        m.ModuleRecord.tenant_id == tenant_id,
        m.ModuleRecord.module_code == module_code,
        m.ModuleRecord.is_deleted == False,
    )
    if submodule:
        q = q.filter(m.ModuleRecord.submodule == submodule)
    if status:
        q = q.filter(m.ModuleRecord.status == status)
    return q.order_by(m.ModuleRecord.created_at.desc()).limit(200).all()


def create_record(
    db: Session,
    *,
    tenant_id: UUID,
    module_code: str,
    submodule: str,
    title: str,
    payload: dict[str, Any],
    patient_id: Optional[UUID] = None,
    provider_id: Optional[UUID] = None,
    actor_id: UUID,
    correlation_id: Optional[str] = None,
) -> m.ModuleRecord:
    meta = get_domain_meta(module_code)
    if not meta:
        raise HTTPException(404, f"Unknown dedicated module: {module_code}")
    if submodule not in meta["submodules"]:
        raise HTTPException(400, f"Invalid submodule. Use: {meta['submodules']}")
    if patient_id:
        p = db.query(m.Patient).filter(m.Patient.id == patient_id, m.Patient.tenant_id == tenant_id).first()
        if not p:
            raise HTTPException(404, "Patient not found")
    row = m.ModuleRecord(
        tenant_id=tenant_id,
        module_code=module_code,
        submodule=submodule,
        reference_no=_ref_no(db, tenant_id, module_code),
        title=title,
        status=meta["initial_status"],
        payload=payload,
        patient_id=patient_id,
        provider_id=provider_id,
        created_by=actor_id,
        updated_by=actor_id,
        correlation_id=correlation_id,
    )
    db.add(row)
    db.flush()
    write_audit(
        db, tenant_id=tenant_id, actor_user_id=actor_id, action="dedicated.create",
        entity_type=module_code, entity_id=row.id,
        new_values={"reference_no": row.reference_no, "submodule": submodule, "title": title},
        correlation_id=correlation_id,
    )
    return row


def get_record(db: Session, tenant_id: UUID, module_code: str, record_id: UUID) -> m.ModuleRecord:
    row = db.query(m.ModuleRecord).filter(
        m.ModuleRecord.id == record_id,
        m.ModuleRecord.tenant_id == tenant_id,
        m.ModuleRecord.module_code == module_code,
        m.ModuleRecord.is_deleted == False,
    ).first()
    if not row:
        raise HTTPException(404, "Record not found")
    return row


def transition_record(
    db: Session,
    row: m.ModuleRecord,
    target: str,
    *,
    actor_id: UUID,
    correlation_id: Optional[str] = None,
) -> m.ModuleRecord:
    validate_transition(row.module_code, row.status, target)
    old = row.status
    row.status = target
    row.updated_by = actor_id
    write_audit(
        db, tenant_id=row.tenant_id, actor_user_id=actor_id, action="dedicated.status",
        entity_type=row.module_code, entity_id=row.id,
        old_values={"status": old}, new_values={"status": target},
        correlation_id=correlation_id,
    )
    return row

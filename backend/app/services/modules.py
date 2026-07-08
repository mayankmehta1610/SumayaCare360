from typing import Any, Optional
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.models import entities as m
from app.services.audit import write_audit
from app.services.workflow_engine import validate_transition
from app.data.module_catalog import MODULE_CATALOG, DEFAULT_STATUSES, DEFAULT_RECORD_FIELDS


def sync_platform_modules(db: Session, actor_id: Optional[UUID] = None):
    for item in MODULE_CATALOG:
        row = db.query(m.PlatformModule).filter(m.PlatformModule.code == item["code"]).first()
        if not row:
            row = m.PlatformModule(
                code=item["code"],
                name=item["name"],
                category=item["category"],
                route=item["route"],
                api_slug=item["code"],
                submodules=item.get("submodules", []),
                fields_schema=DEFAULT_RECORD_FIELDS,
                statuses=DEFAULT_STATUSES,
                is_dedicated=item.get("dedicated", False),
                created_by=actor_id,
                updated_by=actor_id,
            )
            db.add(row)
        else:
            row.name = item["name"]
            row.category = item["category"]
            row.route = item["route"]
            row.submodules = item.get("submodules", [])
            row.is_dedicated = item.get("dedicated", False)
            row.updated_by = actor_id


def next_reference(db: Session, tenant_id: UUID, module_code: str) -> str:
    n = db.query(m.ModuleRecord).filter(
        m.ModuleRecord.tenant_id == tenant_id,
        m.ModuleRecord.module_code == module_code,
    ).count() + 1
    prefix = module_code.split("-")[0][:4].upper()
    return f"{prefix}-{n:06d}"


def list_records(
    db: Session,
    tenant_id: UUID,
    module_code: str,
    query: str = "",
    status: Optional[str] = None,
    submodule: Optional[str] = None,
    limit: int = 200,
) -> list[m.ModuleRecord]:
    q = db.query(m.ModuleRecord).filter(
        m.ModuleRecord.tenant_id == tenant_id,
        m.ModuleRecord.module_code == module_code,
        m.ModuleRecord.is_deleted == False,
    )
    if status:
        q = q.filter(m.ModuleRecord.status == status)
    if submodule:
        q = q.filter(m.ModuleRecord.submodule == submodule)
    if query:
        like = f"%{query}%"
        q = q.filter(or_(m.ModuleRecord.title.ilike(like), m.ModuleRecord.reference_no.ilike(like)))
    return q.order_by(m.ModuleRecord.created_at.desc()).limit(limit).all()


def create_record(
    db: Session,
    *,
    tenant_id: UUID,
    module_code: str,
    submodule: str,
    title: str,
    status: str,
    payload: dict[str, Any],
    actor_id: UUID,
    branch_id: Optional[UUID] = None,
    patient_id: Optional[UUID] = None,
    provider_id: Optional[UUID] = None,
    correlation_id: Optional[str] = None,
) -> m.ModuleRecord:
    row = m.ModuleRecord(
        tenant_id=tenant_id,
        branch_id=branch_id,
        module_code=module_code,
        submodule=submodule,
        reference_no=next_reference(db, tenant_id, module_code),
        title=title,
        status=status or "draft",
        payload=payload,
        patient_id=patient_id,
        provider_id=provider_id,
        created_by=actor_id,
        updated_by=actor_id,
        correlation_id=correlation_id,
    )
    db.add(row)
    write_audit(
        db, tenant_id=tenant_id, actor_user_id=actor_id, action="CREATE",
        entity_type=module_code, entity_id=None,
        new_values={"reference_no": row.reference_no, "title": title, "submodule": submodule},
        correlation_id=correlation_id,
    )
    return row


def update_record_status(
    db: Session,
    row: m.ModuleRecord,
    status: str,
    actor_id: UUID,
    correlation_id: Optional[str] = None,
):
    old = row.status
    validate_transition(
        db, row.module_code, old, status, tenant_id=row.tenant_id,
    )
    row.status = status
    row.updated_by = actor_id
    write_audit(
        db, tenant_id=row.tenant_id, actor_user_id=actor_id, action="STATUS_CHANGE",
        entity_type=row.module_code, entity_id=str(row.id),
        old_values={"status": old}, new_values={"status": status},
        correlation_id=correlation_id,
    )


def get_record(db: Session, tenant_id: UUID, module_code: str, record_id: UUID) -> Optional[m.ModuleRecord]:
    return db.query(m.ModuleRecord).filter(
        m.ModuleRecord.id == record_id,
        m.ModuleRecord.tenant_id == tenant_id,
        m.ModuleRecord.module_code == module_code,
        m.ModuleRecord.is_deleted == False,
    ).first()


def update_record(
    db: Session,
    row: m.ModuleRecord,
    *,
    title: Optional[str],
    status: Optional[str],
    payload: Optional[dict[str, Any]],
    actor_id: UUID,
    correlation_id: Optional[str] = None,
) -> m.ModuleRecord:
    old = {"title": row.title, "status": row.status}
    if title is not None:
        row.title = title
    if status is not None:
        row.status = status
    if payload is not None:
        row.payload = {**(row.payload or {}), **payload}
    row.updated_by = actor_id
    write_audit(
        db, tenant_id=row.tenant_id, actor_user_id=actor_id, action="UPDATE",
        entity_type=row.module_code, entity_id=str(row.id),
        old_values=old, new_values={"title": row.title, "status": row.status},
        correlation_id=correlation_id,
    )
    return row


def soft_delete_record(
    db: Session, row: m.ModuleRecord, actor_id: UUID, correlation_id: Optional[str] = None
):
    row.is_deleted = True
    row.updated_by = actor_id
    write_audit(
        db, tenant_id=row.tenant_id, actor_user_id=actor_id, action="DELETE",
        entity_type=row.module_code, entity_id=str(row.id),
        correlation_id=correlation_id,
    )


def export_records(rows: list[m.ModuleRecord]) -> dict:
    return {
        "format": "json",
        "count": len(rows),
        "records": [
            {
                "id": str(r.id),
                "reference_no": r.reference_no,
                "submodule": r.submodule,
                "title": r.title,
                "status": r.status,
                "payload": r.payload,
            }
            for r in rows
        ],
    }

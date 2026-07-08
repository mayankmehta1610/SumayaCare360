from typing import Any, Optional
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.models import entities as m
from app.services.audit import write_audit


def next_reference(db: Session, tenant_id: UUID, area_code: str, resource_code: str) -> str:
    n = db.query(m.ExpandedResource).filter(
        m.ExpandedResource.tenant_id == tenant_id,
        m.ExpandedResource.area_code == area_code,
        m.ExpandedResource.resource_code == resource_code,
    ).count() + 1
    prefix = area_code.split("-")[0][:3].upper()
    return f"{prefix}-{n:06d}"


def list_resources(
    db: Session,
    tenant_id: UUID,
    area_code: str,
    resource_code: str,
    query: str = "",
    status: Optional[str] = None,
    limit: int = 200,
) -> list[m.ExpandedResource]:
    q = db.query(m.ExpandedResource).filter(
        m.ExpandedResource.tenant_id == tenant_id,
        m.ExpandedResource.area_code == area_code,
        m.ExpandedResource.resource_code == resource_code,
        m.ExpandedResource.is_deleted == False,
    )
    if status:
        q = q.filter(m.ExpandedResource.status == status)
    if query:
        like = f"%{query}%"
        q = q.filter(or_(m.ExpandedResource.title.ilike(like), m.ExpandedResource.reference_no.ilike(like)))
    return q.order_by(m.ExpandedResource.created_at.desc()).limit(limit).all()


def get_resource(
    db: Session, tenant_id: UUID, area_code: str, resource_code: str, record_id: UUID
) -> Optional[m.ExpandedResource]:
    return db.query(m.ExpandedResource).filter(
        m.ExpandedResource.id == record_id,
        m.ExpandedResource.tenant_id == tenant_id,
        m.ExpandedResource.area_code == area_code,
        m.ExpandedResource.resource_code == resource_code,
        m.ExpandedResource.is_deleted == False,
    ).first()


def create_resource(
    db: Session,
    *,
    tenant_id: UUID,
    area_code: str,
    resource_code: str,
    title: str,
    status: str,
    payload: dict[str, Any],
    actor_id: UUID,
    branch_id: Optional[UUID] = None,
    correlation_id: Optional[str] = None,
) -> m.ExpandedResource:
    row = m.ExpandedResource(
        tenant_id=tenant_id,
        branch_id=branch_id,
        area_code=area_code,
        resource_code=resource_code,
        reference_no=next_reference(db, tenant_id, area_code, resource_code),
        title=title,
        status=status or "draft",
        payload=payload,
        created_by=actor_id,
        updated_by=actor_id,
        correlation_id=correlation_id,
    )
    db.add(row)
    write_audit(
        db, tenant_id=tenant_id, actor_user_id=actor_id, action="CREATE",
        entity_type=f"{area_code}/{resource_code}", entity_id=None,
        new_values={"reference_no": row.reference_no, "title": title},
        correlation_id=correlation_id,
    )
    return row


def update_resource(
    db: Session,
    row: m.ExpandedResource,
    *,
    title: Optional[str],
    status: Optional[str],
    payload: Optional[dict[str, Any]],
    actor_id: UUID,
    correlation_id: Optional[str] = None,
) -> m.ExpandedResource:
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
        entity_type=f"{row.area_code}/{row.resource_code}", entity_id=str(row.id),
        old_values=old, new_values={"title": row.title, "status": row.status},
        correlation_id=correlation_id,
    )
    return row


def soft_delete_resource(
    db: Session, row: m.ExpandedResource, actor_id: UUID, correlation_id: Optional[str] = None
):
    row.is_deleted = True
    row.updated_by = actor_id
    write_audit(
        db, tenant_id=row.tenant_id, actor_user_id=actor_id, action="DELETE",
        entity_type=f"{row.area_code}/{row.resource_code}", entity_id=str(row.id),
        correlation_id=correlation_id,
    )


def export_resources(rows: list[m.ExpandedResource]) -> dict:
    return {
        "format": "json",
        "count": len(rows),
        "records": [
            {
                "id": str(r.id),
                "reference_no": r.reference_no,
                "title": r.title,
                "status": r.status,
                "payload": r.payload,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
    }

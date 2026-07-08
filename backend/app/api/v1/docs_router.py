from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.deps import AuthContext, require_tenant
from app.models import entities as m
from app.services.audit import write_audit
import hashlib
import secrets
from datetime import datetime, timezone, timedelta

router = APIRouter(prefix="/docs", tags=["documents"])


class DocumentUploadMeta(BaseModel):
    entity_type: str
    entity_id: UUID | None = None
    file_name: str
    content_type: str = "application/octet-stream"
    size_bytes: int = 0


@router.post("/upload-metadata")
def register_document(
    payload: DocumentUploadMeta,
    ctx: AuthContext = Depends(require_tenant),
    db: Session = Depends(get_db),
):
    tenant_code = ctx.tenant_code or "global"
    key = f"{tenant_code}/{payload.entity_type}/{secrets.token_hex(8)}/{payload.file_name}"
    row = m.DocumentMetadata(
        tenant_id=ctx.tenant_id,
        branch_id=ctx.user.branch_id,
        entity_type=payload.entity_type,
        entity_id=payload.entity_id,
        file_name=payload.file_name,
        content_type=payload.content_type,
        storage_key=key,
        size_bytes=payload.size_bytes,
        created_by=ctx.user.id,
        updated_by=ctx.user.id,
    )
    db.add(row)
    write_audit(
        db, tenant_id=ctx.tenant_id, actor_user_id=ctx.user.id,
        action="DOCUMENT_REGISTER", entity_type=payload.entity_type,
        entity_id=str(payload.entity_id) if payload.entity_id else None,
        new_values={"file_name": payload.file_name, "storage_key": key},
        correlation_id=ctx.correlation_id,
    )
    db.commit()
    db.refresh(row)
    return {
        "id": str(row.id),
        "storage_key": key,
        "upload_url": f"/api/v1/docs/signed-url/{row.id}",
        "status": "pending_upload",
    }


@router.get("/signed-url/{doc_id}")
def signed_url(doc_id: UUID, ctx: AuthContext = Depends(require_tenant), db: Session = Depends(get_db)):
    row = db.query(m.DocumentMetadata).filter(
        m.DocumentMetadata.id == doc_id,
        m.DocumentMetadata.tenant_id == ctx.tenant_id,
    ).first()
    if not row:
        raise HTTPException(404, "Document not found")
    token = hashlib.sha256(f"{row.storage_key}:{ctx.tenant_id}".encode()).hexdigest()[:32]
    return {
        "document_id": str(row.id),
        "storage_key": row.storage_key,
        "signed_token": token,
        "expires_in_seconds": 3600,
        "method": "PUT",
    }


@router.get("/")
def list_documents(
    entity_type: str = "",
    ctx: AuthContext = Depends(require_tenant),
    db: Session = Depends(get_db),
):
    q = db.query(m.DocumentMetadata).filter(
        m.DocumentMetadata.tenant_id == ctx.tenant_id, m.DocumentMetadata.is_deleted == False
    )
    if entity_type:
        q = q.filter(m.DocumentMetadata.entity_type == entity_type)
    rows = q.order_by(m.DocumentMetadata.created_at.desc()).limit(100).all()
    return [
        {
            "id": str(r.id),
            "file_name": r.file_name,
            "entity_type": r.entity_type,
            "entity_id": str(r.entity_id) if r.entity_id else None,
            "status": r.status,
        }
        for r in rows
    ]

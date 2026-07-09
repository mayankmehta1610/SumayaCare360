"""Dedicated domain APIs — lifecycle-enforced module desks."""
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.deps import AuthContext, require_tenant
from app.data.domain_lifecycles import DOMAIN_MODULES, get_domain_meta
from app.db.session import get_db
from app.services import dedicated_domains as dom
from app.services import features as feat_svc

router = APIRouter(prefix="/dedicated", tags=["dedicated-domains"])


class DomainRecordCreate(BaseModel):
    submodule: str
    title: str
    payload: dict[str, Any] = Field(default_factory=dict)
    patient_id: Optional[UUID] = None
    provider_id: Optional[UUID] = None


class DomainRecordUpdate(BaseModel):
    title: Optional[str] = None
    payload: Optional[dict[str, Any]] = None


def _check_module(module_code: str) -> str:
    if module_code not in DOMAIN_MODULES:
        raise HTTPException(404, f"No dedicated domain for module: {module_code}")
    return module_code


@router.get("/registry")
def list_dedicated_registry(ctx: AuthContext = Depends(require_tenant)):
    return [get_domain_meta(code) for code in DOMAIN_MODULES if get_domain_meta(code)]


@router.get("/{module_code}/meta")
def get_module_meta(module_code: str, ctx: AuthContext = Depends(require_tenant)):
    meta = get_domain_meta(_check_module(module_code))
    return meta


@router.get("/{module_code}/records")
def list_domain_records(
    module_code: str,
    submodule: Optional[str] = None,
    status: Optional[str] = None,
    query: str = "",
    ctx: AuthContext = Depends(require_tenant),
    db: Session = Depends(get_db),
):
    code = _check_module(module_code)
    rows = dom.list_records(db, ctx.tenant_id, code, submodule=submodule, status=status, query=query)
    return [dom.serialize_record(r, module_code=code) for r in rows]


@router.get("/{module_code}/records/{record_id}")
def get_domain_record(
    module_code: str,
    record_id: UUID,
    ctx: AuthContext = Depends(require_tenant),
    db: Session = Depends(get_db),
):
    code = _check_module(module_code)
    row = dom.get_record(db, ctx.tenant_id, code, record_id)
    return dom.serialize_record(row, module_code=code)


@router.post("/{module_code}/records")
def create_domain_record(
    module_code: str,
    payload: DomainRecordCreate,
    ctx: AuthContext = Depends(require_tenant),
    db: Session = Depends(get_db),
):
    code = _check_module(module_code)
    row = dom.create_record(
        db,
        tenant_id=ctx.tenant_id,
        module_code=code,
        submodule=payload.submodule,
        title=payload.title,
        payload=payload.payload,
        patient_id=payload.patient_id,
        provider_id=payload.provider_id,
        actor_id=ctx.user.id,
        correlation_id=ctx.correlation_id,
    )
    db.commit()
    db.refresh(row)
    feat_svc.mark_stage_implemented(db, code, "create")
    return dom.serialize_record(row, module_code=code)


@router.patch("/{module_code}/records/{record_id}")
def patch_domain_record(
    module_code: str,
    record_id: UUID,
    payload: DomainRecordUpdate,
    ctx: AuthContext = Depends(require_tenant),
    db: Session = Depends(get_db),
):
    code = _check_module(module_code)
    row = dom.get_record(db, ctx.tenant_id, code, record_id)
    dom.update_record(
        db, row, title=payload.title, payload=payload.payload,
        actor_id=ctx.user.id, correlation_id=ctx.correlation_id,
    )
    db.commit()
    db.refresh(row)
    feat_svc.mark_stage_implemented(db, code, "update")
    return dom.serialize_record(row, module_code=code)


@router.delete("/{module_code}/records/{record_id}")
def delete_domain_record(
    module_code: str,
    record_id: UUID,
    ctx: AuthContext = Depends(require_tenant),
    db: Session = Depends(get_db),
):
    code = _check_module(module_code)
    row = dom.get_record(db, ctx.tenant_id, code, record_id)
    dom.soft_delete_record(db, row, actor_id=ctx.user.id, correlation_id=ctx.correlation_id)
    db.commit()
    return {"deleted": True, "id": str(record_id)}


@router.post("/{module_code}/records/{record_id}/approve")
def approve_domain_record(
    module_code: str,
    record_id: UUID,
    ctx: AuthContext = Depends(require_tenant),
    db: Session = Depends(get_db),
):
    code = _check_module(module_code)
    row = dom.get_record(db, ctx.tenant_id, code, record_id)
    dom.transition_record(db, row, "approved", actor_id=ctx.user.id, correlation_id=ctx.correlation_id)
    db.commit()
    db.refresh(row)
    feat_svc.mark_stage_implemented(db, code, "approve")
    return dom.serialize_record(row, module_code=code)


@router.post("/{module_code}/records/{record_id}/reject")
def reject_domain_record(
    module_code: str,
    record_id: UUID,
    ctx: AuthContext = Depends(require_tenant),
    db: Session = Depends(get_db),
):
    code = _check_module(module_code)
    row = dom.get_record(db, ctx.tenant_id, code, record_id)
    dom.transition_record(db, row, "rejected", actor_id=ctx.user.id, correlation_id=ctx.correlation_id)
    db.commit()
    db.refresh(row)
    return dom.serialize_record(row, module_code=code)


@router.post("/{module_code}/export")
def export_domain_records(
    module_code: str,
    submodule: Optional[str] = None,
    ctx: AuthContext = Depends(require_tenant),
    db: Session = Depends(get_db),
):
    code = _check_module(module_code)
    rows = dom.list_records(db, ctx.tenant_id, code, submodule=submodule)
    feat_svc.mark_stage_implemented(db, code, "report")
    db.commit()
    return dom.export_records(rows)


@router.patch("/{module_code}/records/{record_id}/status")
def patch_domain_status(
    module_code: str,
    record_id: UUID,
    status: str = Query(...),
    ctx: AuthContext = Depends(require_tenant),
    db: Session = Depends(get_db),
):
    code = _check_module(module_code)
    row = dom.get_record(db, ctx.tenant_id, code, record_id)
    dom.transition_record(db, row, status, actor_id=ctx.user.id, correlation_id=ctx.correlation_id)
    db.commit()
    db.refresh(row)
    feat_svc.mark_stage_implemented(db, code, "workflow")
    return dom.serialize_record(row, module_code=code)

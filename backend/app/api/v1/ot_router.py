"""Operation theatre & procedures APIs."""
from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.deps import AuthContext, require_tenant
from app.db.session import get_db
from app.services import ot_domains as ot

router = APIRouter(prefix="/ot", tags=["operation-theatre"])


class OtCreate(BaseModel):
    patient_id: UUID
    procedure_code: str
    procedure_name: str
    theatre_code: str = ""
    surgeon_id: Optional[UUID] = None
    scheduled_at: Optional[datetime] = None


class PreOpUpdate(BaseModel):
    checklist: dict[str, Any] = Field(default_factory=dict)


@router.get("/procedures")
def list_procedures(
    status: Optional[str] = None,
    ctx: AuthContext = Depends(require_tenant),
    db: Session = Depends(get_db),
):
    rows = ot.list_ot_procedures(db, ctx.tenant_id, status=status)
    return [ot.serialize_ot(r) for r in rows]


@router.post("/procedures")
def create_procedure(
    payload: OtCreate,
    ctx: AuthContext = Depends(require_tenant),
    db: Session = Depends(get_db),
):
    row = ot.create_ot_procedure(
        db,
        tenant_id=ctx.tenant_id,
        patient_id=payload.patient_id,
        procedure_code=payload.procedure_code,
        procedure_name=payload.procedure_name,
        theatre_code=payload.theatre_code,
        surgeon_id=payload.surgeon_id,
        scheduled_at=payload.scheduled_at,
        actor_id=ctx.user.id,
        correlation_id=ctx.correlation_id,
    )
    db.commit()
    db.refresh(row)
    return ot.serialize_ot(row)


@router.get("/procedures/{procedure_id}")
def get_procedure(
    procedure_id: UUID,
    ctx: AuthContext = Depends(require_tenant),
    db: Session = Depends(get_db),
):
    row = ot.get_ot_procedure(db, ctx.tenant_id, procedure_id)
    return ot.serialize_ot(row)


@router.patch("/procedures/{procedure_id}/pre-op")
def patch_pre_op(
    procedure_id: UUID,
    payload: PreOpUpdate,
    ctx: AuthContext = Depends(require_tenant),
    db: Session = Depends(get_db),
):
    row = ot.get_ot_procedure(db, ctx.tenant_id, procedure_id)
    ot.update_pre_op_checklist(
        db, row, payload.checklist,
        actor_id=ctx.user.id,
        correlation_id=ctx.correlation_id,
    )
    db.commit()
    db.refresh(row)
    return ot.serialize_ot(row)


@router.patch("/procedures/{procedure_id}/status")
def patch_procedure_status(
    procedure_id: UUID,
    status: str = Query(...),
    intra_op_notes: Optional[str] = Query(None),
    ctx: AuthContext = Depends(require_tenant),
    db: Session = Depends(get_db),
):
    row = ot.get_ot_procedure(db, ctx.tenant_id, procedure_id)
    ot.transition_ot(
        db, row, status,
        intra_op_notes=intra_op_notes,
        actor_id=ctx.user.id,
        correlation_id=ctx.correlation_id,
    )
    db.commit()
    db.refresh(row)
    return ot.serialize_ot(row)

"""Operation theatre & procedures APIs."""
from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.deps import AuthContext, require_tenant
from app.data.clinical_profiles import validate_clinical_profile
from app.db.session import get_db
from app.services import ot_domains as ot
from app.models import entities as m

router = APIRouter(prefix="/ot", tags=["operation-theatre"])


class OtCreate(BaseModel):
    patient_id: UUID
    procedure_tariff_id: UUID
    theatre_id: UUID
    surgeon_id: Optional[UUID] = None
    scheduled_at: Optional[datetime] = None
    procedure_profile: dict[str, Any]


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
    profile = validate_clinical_profile("operation_theatre", payload.procedure_profile)
    tariff = db.query(m.Tariff).filter(m.Tariff.id == payload.procedure_tariff_id, m.Tariff.tenant_id == ctx.tenant_id, m.Tariff.is_deleted == False).first()
    theatre = db.query(m.FacilityLocation).filter(m.FacilityLocation.id == payload.theatre_id, m.FacilityLocation.tenant_id == ctx.tenant_id, m.FacilityLocation.location_type == "room", m.FacilityLocation.is_deleted == False).first()
    if not tariff or tariff.category not in {"procedure", "surgery"}:
        raise HTTPException(400, "Select a valid procedure / surgery tariff master")
    if not theatre or (theatre.attributes or {}).get("service_type") != "operation_theatre":
        raise HTTPException(400, "Select a room designated as an operation theatre")
    row = ot.create_ot_procedure(
        db,
        tenant_id=ctx.tenant_id,
        patient_id=payload.patient_id,
        procedure_tariff_id=tariff.id, procedure_code=tariff.code, procedure_name=tariff.name,
        theatre_id=theatre.id, theatre_code=theatre.code,
        surgeon_id=payload.surgeon_id,
        scheduled_at=payload.scheduled_at,
        procedure_profile=profile,
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

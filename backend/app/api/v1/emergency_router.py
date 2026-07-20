"""Emergency & triage APIs."""
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.deps import AuthContext, require_tenant
from app.data.clinical_profiles import validate_clinical_profile
from app.db.session import get_db
from app.services import emergency_domains as er

router = APIRouter(prefix="/emergency", tags=["emergency"])


class TriageCreate(BaseModel):
    patient_id: UUID
    chief_complaint: str
    esi_level: int = Field(ge=1, le=5, default=3)
    notes: str = ""
    clinical_profile: dict[str, Any]


class TriageStatusUpdate(BaseModel):
    status: str
    disposition: Optional[str] = None


@router.get("/triage")
def list_triage(
    status: Optional[str] = None,
    ctx: AuthContext = Depends(require_tenant),
    db: Session = Depends(get_db),
):
    rows = er.list_triages(db, ctx.tenant_id, status=status)
    return [er.serialize_triage(r) for r in rows]


@router.post("/triage")
def create_triage(
    payload: TriageCreate,
    ctx: AuthContext = Depends(require_tenant),
    db: Session = Depends(get_db),
):
    profile = validate_clinical_profile("emergency", payload.clinical_profile)
    row = er.create_triage(
        db,
        tenant_id=ctx.tenant_id,
        patient_id=payload.patient_id,
        chief_complaint=payload.chief_complaint,
        esi_level=payload.esi_level,
        notes=payload.notes,
        actor_id=ctx.user.id,
        clinical_profile=profile,
        correlation_id=ctx.correlation_id,
    )
    db.commit()
    db.refresh(row)
    return er.serialize_triage(row)


@router.get("/triage/{triage_id}")
def get_triage(
    triage_id: UUID,
    ctx: AuthContext = Depends(require_tenant),
    db: Session = Depends(get_db),
):
    row = er.get_triage(db, ctx.tenant_id, triage_id)
    return er.serialize_triage(row)


@router.patch("/triage/{triage_id}/status")
def patch_triage_status(
    triage_id: UUID,
    status: str = Query(...),
    disposition: Optional[str] = Query(None),
    ctx: AuthContext = Depends(require_tenant),
    db: Session = Depends(get_db),
):
    row = er.get_triage(db, ctx.tenant_id, triage_id)
    er.transition_triage(
        db, row, status,
        disposition=disposition,
        actor_id=ctx.user.id,
        correlation_id=ctx.correlation_id,
    )
    db.commit()
    db.refresh(row)
    return er.serialize_triage(row)

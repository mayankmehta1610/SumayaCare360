from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.deps import AuthContext, require_permission
from app.data.clinical_profiles import validate_clinical_profile
from app.db.session import get_db
from app.models import entities as m
from app.services import finance_domains as fin
from app.services.workflow_engine import allowed_next_statuses

router = APIRouter(prefix="/finance", tags=["finance"])


class ClaimCreate(BaseModel):
    patient_id: UUID
    payer_code: str
    amount: float
    policy_no: str = ""
    notes: str = ""
    claim_profile: dict[str, object]


class ClaimStatusUpdate(BaseModel):
    status: str
    reason: Optional[str] = None


class PreAuthCheckRequest(BaseModel):
    patient_id: UUID
    payer_code: str
    amount: float
    policy_no: str = ""
    procedure_codes: list[str] = Field(default_factory=list)


class RefundCreate(BaseModel):
    payment_id: UUID
    amount: float
    reason: str = ""


@router.get("/claims")
def list_claims(
    status: Optional[str] = None,
    ctx: AuthContext = Depends(require_permission("billing:read")),
    db: Session = Depends(get_db),
):
    rows = fin.list_claims(db, ctx.tenant_id, status=status)
    out = []
    for r in rows:
        item = fin.serialize_claim(r)
        item["allowed_next_statuses"] = allowed_next_statuses(
            db, fin.CLAIM_MODULE, r.status, tenant_id=ctx.tenant_id,
        )
        out.append(item)
    return out


@router.post("/claims")
def create_claim(
    payload: ClaimCreate,
    ctx: AuthContext = Depends(require_permission("billing:*")),
    db: Session = Depends(get_db),
):
    profile = validate_clinical_profile("insurance_claim", payload.claim_profile)
    row = fin.create_claim(
        db, tenant_id=ctx.tenant_id, patient_id=payload.patient_id,
        payer_code=payload.payer_code, amount=payload.amount,
        policy_no=payload.policy_no, notes=payload.notes,
        claim_profile=profile,
        actor_id=ctx.user.id, correlation_id=ctx.correlation_id,
    )
    db.commit()
    db.refresh(row)
    return fin.serialize_claim(row)


@router.get("/claims/{claim_id}")
def get_claim_detail(
    claim_id: UUID,
    ctx: AuthContext = Depends(require_permission("billing:read")),
    db: Session = Depends(get_db),
):
    row = fin.get_claim(db, ctx.tenant_id, claim_id)
    detail = fin.serialize_claim(row)
    patient = db.query(m.Patient).filter(m.Patient.id == row.patient_id).first()
    if patient:
        detail["patient"] = {
            "id": str(patient.id),
            "mrn": patient.mrn,
            "name": f"{patient.first_name} {patient.last_name}",
        }
    payer = db.query(m.InsurancePayer).filter(
        m.InsurancePayer.tenant_id == ctx.tenant_id,
        m.InsurancePayer.code == row.payer_code,
    ).first()
    if payer:
        detail["payer"] = {"code": payer.code, "name": payer.name, "tpa_name": payer.tpa_name}
    detail["allowed_next_statuses"] = allowed_next_statuses(
        db, fin.CLAIM_MODULE, row.status, tenant_id=ctx.tenant_id,
    )
    return detail


@router.patch("/claims/{claim_id}/status")
def patch_claim_status(
    claim_id: UUID,
    payload: ClaimStatusUpdate,
    ctx: AuthContext = Depends(require_permission("billing:*")),
    db: Session = Depends(get_db),
):
    row = fin.get_claim(db, ctx.tenant_id, claim_id)
    fin.update_claim_status(
        db, row, payload.status,
        actor_id=ctx.user.id, correlation_id=ctx.correlation_id, reason=payload.reason,
    )
    db.commit()
    return fin.serialize_claim(row)


@router.post("/claims/pre-auth-check")
def pre_auth_check(
    payload: PreAuthCheckRequest,
    ctx: AuthContext = Depends(require_permission("billing:*")),
    db: Session = Depends(get_db),
):
    return fin.pre_auth_check_stub(
        db, tenant_id=ctx.tenant_id, patient_id=payload.patient_id,
        payer_code=payload.payer_code, amount=payload.amount,
        policy_no=payload.policy_no, procedure_codes=payload.procedure_codes,
    )


@router.get("/ar-aging")
def ar_aging(
    ctx: AuthContext = Depends(require_permission("billing:read")),
    db: Session = Depends(get_db),
):
    return fin.compute_ar_aging(db, ctx.tenant_id)


@router.post("/refunds")
def create_refund(
    payload: RefundCreate,
    ctx: AuthContext = Depends(require_permission("billing:*")),
    db: Session = Depends(get_db),
):
    result = fin.create_refund_stub(
        db, tenant_id=ctx.tenant_id, payment_id=payload.payment_id,
        amount=payload.amount, reason=payload.reason,
        actor_id=ctx.user.id, correlation_id=ctx.correlation_id,
    )
    db.commit()
    return result

from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.deps import AuthContext, require_tenant
from app.models import entities as m
from app.services.audit import write_audit

router = APIRouter(prefix="/portal", tags=["patient-portal"])


def _require_patient(ctx: AuthContext):
    if ctx.role_code not in ("PATIENT", "TENANT_ADMIN", "DOCTOR", "RECEPTION", "RECEPTIONIST"):
        raise HTTPException(403, "Patient portal access required")


class PortalAppointmentRequest(BaseModel):
    provider_id: UUID
    scheduled_at: str
    reason: str = ""
    mode: str = "in_person"


class PortalPaymentRequest(BaseModel):
    invoice_id: UUID
    amount: float
    gateway_token_ref: str
    masked_last4: str = "4242"


@router.get("/appointments")
def portal_appointments(ctx: AuthContext = Depends(require_tenant), db: Session = Depends(get_db)):
    _require_patient(ctx)
    q = db.query(m.Appointment).filter(
        m.Appointment.tenant_id == ctx.tenant_id, m.Appointment.is_deleted == False
    )
    if ctx.role_code == "PATIENT":
        patient = db.query(m.Patient).filter(
            m.Patient.tenant_id == ctx.tenant_id, m.Patient.email == ctx.user.email
        ).first()
        if patient:
            q = q.filter(m.Appointment.patient_id == patient.id)
    rows = q.order_by(m.Appointment.scheduled_at.desc()).limit(50).all()
    return [
        {
            "id": str(r.id),
            "scheduled_at": r.scheduled_at,
            "status": r.status,
            "queue_token": r.queue_token,
            "provider_id": str(r.provider_id) if r.provider_id else None,
            "patient_id": str(r.patient_id),
            "mode": r.mode,
        }
        for r in rows
    ]


@router.post("/appointments")
def portal_request_appointment(
    payload: PortalAppointmentRequest,
    ctx: AuthContext = Depends(require_tenant),
    db: Session = Depends(get_db),
):
    _require_patient(ctx)
    from datetime import datetime
    patient = db.query(m.Patient).filter(
        m.Patient.tenant_id == ctx.tenant_id, m.Patient.email == ctx.user.email
    ).first()
    if not patient and ctx.role_code == "PATIENT":
        raise HTTPException(404, "Patient profile not linked to this account")
    if not patient:
        patient = db.query(m.Patient).filter(m.Patient.tenant_id == ctx.tenant_id).first()
    if not patient:
        raise HTTPException(400, "No patient record available")
    provider = db.query(m.Provider).filter(
        m.Provider.id == payload.provider_id, m.Provider.tenant_id == ctx.tenant_id
    ).first()
    if not provider:
        raise HTTPException(404, "Provider not found")
    token_n = db.query(m.Appointment).filter(m.Appointment.tenant_id == ctx.tenant_id).count() + 1
    scheduled = datetime.fromisoformat(payload.scheduled_at.replace("Z", "+00:00"))
    row = m.Appointment(
        tenant_id=ctx.tenant_id,
        patient_id=patient.id,
        provider_id=provider.id,
        scheduled_at=scheduled,
        mode=payload.mode,
        reason=payload.reason,
        queue_token=f"T{token_n:04d}",
        status="scheduled",
        created_by=ctx.user.id,
        updated_by=ctx.user.id,
    )
    db.add(row)
    db.flush()
    write_audit(
        db, tenant_id=ctx.tenant_id, actor_user_id=ctx.user.id, action="CREATE",
        entity_type="appointment", entity_id=str(row.id),
        new_values={"source": "patient_portal", "queue_token": row.queue_token},
        correlation_id=ctx.correlation_id,
    )
    db.commit()
    return {"id": str(row.id), "queue_token": row.queue_token, "status": row.status}


@router.get("/providers")
def portal_providers(ctx: AuthContext = Depends(require_tenant), db: Session = Depends(get_db)):
    _require_patient(ctx)
    rows = db.query(m.Provider).filter(
        m.Provider.tenant_id == ctx.tenant_id, m.Provider.is_deleted == False
    ).all()
    return [{"id": str(r.id), "full_name": r.full_name, "specialty_code": r.specialty_code} for r in rows]


@router.get("/bills")
def portal_bills(ctx: AuthContext = Depends(require_tenant), db: Session = Depends(get_db)):
    _require_patient(ctx)
    rows = db.query(m.Invoice).filter(
        m.Invoice.tenant_id == ctx.tenant_id, m.Invoice.is_deleted == False
    ).order_by(m.Invoice.created_at.desc()).limit(50).all()
    return [
        {
            "id": str(r.id),
            "invoice_no": r.invoice_no,
            "status": r.status,
            "total_amount": float(r.total or 0),
            "patient_id": str(r.patient_id) if r.patient_id else None,
        }
        for r in rows
    ]


@router.post("/bills/pay")
def portal_pay_bill(
    payload: PortalPaymentRequest,
    ctx: AuthContext = Depends(require_tenant),
    db: Session = Depends(get_db),
):
    _require_patient(ctx)
    inv = db.query(m.Invoice).filter(
        m.Invoice.id == payload.invoice_id, m.Invoice.tenant_id == ctx.tenant_id
    ).first()
    if not inv:
        raise HTTPException(404, "Invoice not found")
    pay = m.Payment(
        tenant_id=ctx.tenant_id,
        invoice_id=inv.id,
        amount=payload.amount,
        gateway="portal",
        gateway_token_ref=payload.gateway_token_ref,
        masked_last4=payload.masked_last4,
        status="succeeded",
        created_by=ctx.user.id,
        updated_by=ctx.user.id,
    )
    db.add(pay)
    inv.status = "paid"
    write_audit(
        db, tenant_id=ctx.tenant_id, actor_user_id=ctx.user.id, action="PAYMENT",
        entity_type="payment", new_values={"invoice_id": str(inv.id), "amount": payload.amount},
        correlation_id=ctx.correlation_id,
    )
    db.commit()
    return {"payment_id": str(pay.id), "invoice_status": inv.status}


@router.get("/telemedicine/sessions")
def portal_tele_sessions(ctx: AuthContext = Depends(require_tenant), db: Session = Depends(get_db)):
    _require_patient(ctx)
    rows = db.query(m.TelemedicineSession).filter(
        m.TelemedicineSession.tenant_id == ctx.tenant_id
    ).order_by(m.TelemedicineSession.created_at.desc()).limit(30).all()
    return [
        {
            "id": str(r.id),
            "session_code": r.room_id,
            "status": r.status,
            "patient_id": str(r.patient_id),
            "join_url": f"/telemedicine?session={r.room_id}",
        }
        for r in rows
    ]


@router.get("/visit-summaries")
def portal_summaries(ctx: AuthContext = Depends(require_tenant), db: Session = Depends(get_db)):
    _require_patient(ctx)
    rows = db.query(m.Encounter).filter(
        m.Encounter.tenant_id == ctx.tenant_id, m.Encounter.is_deleted == False
    ).order_by(m.Encounter.created_at.desc()).limit(30).all()
    return [
        {
            "id": str(r.id),
            "encounter_no": str(r.id)[:8],
            "status": r.status,
            "patient_id": str(r.patient_id),
            "started_at": r.started_at,
        }
        for r in rows
    ]


@router.post("/consent")
def portal_consent(
    purpose: str,
    session_id: UUID | None = None,
    ctx: AuthContext = Depends(require_tenant),
    db: Session = Depends(get_db),
):
    _require_patient(ctx)
    write_audit(
        db, tenant_id=ctx.tenant_id, actor_user_id=ctx.user.id,
        action="CONSENT", entity_type="consent", entity_id=str(session_id) if session_id else None,
        new_values={"purpose": purpose, "granted": True},
        correlation_id=ctx.correlation_id,
    )
    db.commit()
    return {"consent_id": str(ctx.correlation_id), "purpose": purpose, "status": "granted"}

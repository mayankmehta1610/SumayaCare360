from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.deps import AuthContext, require_tenant, require_permission
from app.models import entities as m

router = APIRouter(prefix="/portal", tags=["patient-portal"])


def _require_patient(ctx: AuthContext):
    if ctx.role_code not in ("PATIENT", "TENANT_ADMIN", "DOCTOR", "RECEPTION"):
        raise HTTPException(403, "Patient portal access required")


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
            "provider_id": str(r.provider_id) if r.provider_id else None,
            "patient_id": str(r.patient_id),
        }
        for r in rows
    ]


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
            "total_amount": float(r.total_amount or 0),
            "patient_id": str(r.patient_id) if r.patient_id else None,
        }
        for r in rows
    ]


@router.get("/telemedicine/sessions")
def portal_tele_sessions(ctx: AuthContext = Depends(require_tenant), db: Session = Depends(get_db)):
    _require_patient(ctx)
    rows = db.query(m.TelemedicineSession).filter(
        m.TelemedicineSession.tenant_id == ctx.tenant_id
    ).order_by(m.TelemedicineSession.created_at.desc()).limit(30).all()
    return [
        {
            "id": str(r.id),
            "session_code": r.session_code,
            "status": r.status,
            "patient_id": str(r.patient_id),
            "join_url": f"/telemedicine?session={r.session_code}",
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
            "encounter_no": r.encounter_no,
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
    from app.services.audit import write_audit
    write_audit(
        db, tenant_id=ctx.tenant_id, actor_user_id=ctx.user.id,
        action="CONSENT", entity_type="consent", entity_id=str(session_id) if session_id else None,
        new_values={"purpose": purpose, "granted": True},
        correlation_id=ctx.correlation_id,
    )
    db.commit()
    return {"consent_id": str(ctx.correlation_id), "purpose": purpose, "status": "granted"}

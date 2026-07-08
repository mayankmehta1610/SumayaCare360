"""End-to-end care journey — discharge closes clinical chart and raises billing."""
from datetime import datetime, timezone
from uuid import UUID
from typing import Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models import entities as m
from app.services.audit import write_audit
from app.services.billing import build_invoice, tariff_lines_for_opd_discharge


def encounter_detail(db: Session, tenant_id: UUID, encounter_id: UUID) -> dict:
    enc = db.query(m.Encounter).filter(
        m.Encounter.id == encounter_id, m.Encounter.tenant_id == tenant_id, m.Encounter.is_deleted == False
    ).first()
    if not enc:
        raise HTTPException(404, "Encounter not found")
    patient = db.query(m.Patient).filter(m.Patient.id == enc.patient_id).first()
    provider = db.query(m.Provider).filter(m.Provider.id == enc.provider_id).first()
    vitals = db.query(m.Vital).filter(m.Vital.encounter_id == enc.id, m.Vital.is_deleted == False).all()
    notes = db.query(m.ClinicalNote).filter(m.ClinicalNote.encounter_id == enc.id, m.ClinicalNote.is_deleted == False).all()
    diagnoses = db.query(m.EncounterDiagnosis).filter(m.EncounterDiagnosis.encounter_id == enc.id).all()
    prescriptions = db.query(m.Prescription).filter(m.Prescription.encounter_id == enc.id, m.Prescription.is_deleted == False).all()
    rx_details = []
    for rx in prescriptions:
        lines = db.query(m.PrescriptionLine).filter(m.PrescriptionLine.prescription_id == rx.id).all()
        rx_details.append({
            "id": str(rx.id), "status": rx.status, "notes": rx.notes,
            "lines": [{"medicine_code": l.medicine_code, "medicine_name": l.medicine_name,
                       "dose": l.dose, "frequency": l.frequency, "duration": l.duration} for l in lines],
        })
    invoice = db.query(m.Invoice).filter(
        m.Invoice.encounter_id == enc.id, m.Invoice.tenant_id == tenant_id, m.Invoice.is_deleted == False
    ).order_by(m.Invoice.created_at.desc()).first()
    return {
        "id": str(enc.id),
        "status": enc.status,
        "encounter_type": enc.encounter_type,
        "chief_complaint": enc.chief_complaint,
        "assessment": enc.assessment,
        "plan": enc.plan,
        "patient": {"id": str(patient.id), "name": f"{patient.first_name} {patient.last_name}", "mrn": patient.mrn} if patient else None,
        "provider": {"id": str(provider.id), "name": provider.full_name} if provider else None,
        "vitals": [{"id": str(v.id), "bp": f"{v.bp_systolic}/{v.bp_diastolic}", "pulse": v.pulse, "spo2": v.spo2, "temp": float(v.temperature_c) if v.temperature_c else None} for v in vitals],
        "notes": [{"id": str(n.id), "content": n.content, "note_type": n.note_type} for n in notes],
        "diagnoses": [{"disease_code": d.disease_code, "disease_name": d.disease_name, "is_primary": d.is_primary} for d in diagnoses],
        "prescriptions": rx_details,
        "invoice": {"id": str(invoice.id), "invoice_no": invoice.invoice_no, "total": float(invoice.total or 0), "status": invoice.status} if invoice else None,
    }


def discharge_encounter(
    db: Session,
    *,
    tenant_id: UUID,
    tenant_code: str,
    encounter_id: UUID,
    actor_id: UUID,
    assessment: str = "",
    plan: str = "",
    correlation_id: Optional[str] = None,
) -> dict:
    enc = db.query(m.Encounter).filter(m.Encounter.id == encounter_id, m.Encounter.tenant_id == tenant_id).first()
    if not enc:
        raise HTTPException(404, "Encounter not found")
    if enc.status == "closed":
        existing = db.query(m.Invoice).filter(m.Invoice.encounter_id == enc.id).first()
        if existing:
            return {"encounter_id": str(enc.id), "status": enc.status, "invoice": {"id": str(existing.id), "invoice_no": existing.invoice_no, "total": float(existing.total or 0), "status": existing.status}}
        lines = tariff_lines_for_opd_discharge(db, tenant_id, enc)
        inv = build_invoice(
            db, tenant_id=tenant_id, tenant_code=tenant_code, patient_id=enc.patient_id,
            actor_id=actor_id, tariff_lines=lines, encounter_id=enc.id,
            correlation_id=correlation_id,
        )
        return {"encounter_id": str(enc.id), "status": enc.status, "invoice": {"id": str(inv.id), "invoice_no": inv.invoice_no, "total": float(inv.total or 0), "status": inv.status}}

    vitals_count = db.query(m.Vital).filter(m.Vital.encounter_id == enc.id).count()
    if vitals_count == 0:
        raise HTTPException(400, "Record vitals before discharge")

    enc.status = "closed"
    enc.assessment = assessment or enc.assessment or "Assessed"
    enc.plan = plan or enc.plan or "Follow plan"
    enc.closed_at = datetime.now(timezone.utc)
    enc.updated_by = actor_id

    if enc.appointment_id:
        appt = db.query(m.Appointment).filter(m.Appointment.id == enc.appointment_id).first()
        if appt:
            appt.status = "completed"
            appt.updated_by = actor_id

    lines = tariff_lines_for_opd_discharge(db, tenant_id, enc)
    inv = build_invoice(
        db, tenant_id=tenant_id, tenant_code=tenant_code, patient_id=enc.patient_id,
        actor_id=actor_id, tariff_lines=lines, encounter_id=enc.id,
        correlation_id=correlation_id,
    )
    write_audit(db, tenant_id=tenant_id, actor_user_id=actor_id, action="DISCHARGE",
                entity_type="encounter", entity_id=str(enc.id),
                new_values={"invoice_no": inv.invoice_no, "total": float(inv.total or 0)},
                correlation_id=correlation_id)
    db.flush()
    return {
        "encounter_id": str(enc.id),
        "status": enc.status,
        "invoice": {"id": str(inv.id), "invoice_no": inv.invoice_no, "total": float(inv.total or 0), "status": inv.status},
    }


def discharge_ipd(
    db: Session,
    *,
    tenant_id: UUID,
    tenant_code: str,
    admission_id: UUID,
    actor_id: UUID,
    correlation_id: Optional[str] = None,
) -> dict:
    adm = db.query(m.IpdAdmission).filter(m.IpdAdmission.id == admission_id, m.IpdAdmission.tenant_id == tenant_id).first()
    if not adm:
        raise HTTPException(404, "Admission not found")
    if adm.status == "discharged":
        raise HTTPException(400, "Already discharged")
    adm.status = "discharged"
    adm.discharged_at = datetime.now(timezone.utc)
    adm.updated_by = actor_id
    bed = db.query(m.Bed).filter(m.Bed.tenant_id == tenant_id, m.Bed.bed_code == adm.bed_code).first()
    if bed:
        bed.status = "available"
        bed.updated_by = actor_id
    lines = [{"tariff_code": "IPD_DAY", "qty": 1}, {"tariff_code": "OPD_CONSULT", "qty": 1}]
    inv = build_invoice(
        db, tenant_id=tenant_id, tenant_code=tenant_code, patient_id=adm.patient_id,
        actor_id=actor_id, tariff_lines=lines, encounter_id=None,
        correlation_id=correlation_id,
    )
    write_audit(db, tenant_id=tenant_id, actor_user_id=actor_id, action="IPD_DISCHARGE",
                entity_type="ipd_admission", entity_id=str(adm.id),
                new_values={"invoice_no": inv.invoice_no}, correlation_id=correlation_id)
    return {
        "admission_id": str(adm.id),
        "status": adm.status,
        "invoice": {"id": str(inv.id), "invoice_no": inv.invoice_no, "total": float(inv.total or 0), "status": inv.status},
    }


def patient_chart(db: Session, tenant_id: UUID, patient_id: UUID) -> dict:
    patient = db.query(m.Patient).filter(
        m.Patient.id == patient_id, m.Patient.tenant_id == tenant_id, m.Patient.is_deleted == False
    ).first()
    if not patient:
        raise HTTPException(404, "Patient not found")
    appointments = db.query(m.Appointment).filter(
        m.Appointment.tenant_id == tenant_id, m.Appointment.patient_id == patient_id
    ).order_by(m.Appointment.scheduled_at.desc()).limit(20).all()
    encounters = db.query(m.Encounter).filter(
        m.Encounter.tenant_id == tenant_id, m.Encounter.patient_id == patient_id, m.Encounter.is_deleted == False
    ).order_by(m.Encounter.created_at.desc()).limit(20).all()
    invoices = db.query(m.Invoice).filter(
        m.Invoice.tenant_id == tenant_id, m.Invoice.patient_id == patient_id, m.Invoice.is_deleted == False
    ).order_by(m.Invoice.created_at.desc()).limit(20).all()
    ipd = db.query(m.IpdAdmission).filter(
        m.IpdAdmission.tenant_id == tenant_id, m.IpdAdmission.patient_id == patient_id
    ).order_by(m.IpdAdmission.created_at.desc()).limit(10).all()
    return {
        "patient": {"id": str(patient.id), "mrn": patient.mrn, "name": f"{patient.first_name} {patient.last_name}"},
        "appointments": [{"id": str(a.id), "queue_token": a.queue_token, "status": a.status, "scheduled_at": a.scheduled_at.isoformat() if a.scheduled_at else None, "mode": a.mode} for a in appointments],
        "encounters": [{"id": str(e.id), "status": e.status, "chief_complaint": e.chief_complaint, "encounter_type": e.encounter_type} for e in encounters],
        "invoices": [{"id": str(i.id), "invoice_no": i.invoice_no, "total": float(i.total or 0), "status": i.status, "encounter_id": str(i.encounter_id) if i.encounter_id else None} for i in invoices],
        "ipd_admissions": [{"id": str(a.id), "admission_no": a.admission_no, "bed_code": a.bed_code, "status": a.status} for a in ipd],
    }

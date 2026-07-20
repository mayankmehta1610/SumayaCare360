"""Patient-centred operational views across hospital domains."""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from app.models import entities as m


def _iso(value):
    return value.isoformat() if value else None


def patient_board(db: Session, tenant_id: UUID, query: str = "", limit: int = 100) -> dict:
    pq = db.query(m.Patient).filter(m.Patient.tenant_id == tenant_id, m.Patient.is_deleted == False)
    if query:
        from sqlalchemy import or_
        like = f"%{query.strip()}%"
        pq = pq.filter(or_(m.Patient.mrn.ilike(like), m.Patient.first_name.ilike(like),
                           m.Patient.last_name.ilike(like), m.Patient.phone.ilike(like)))
    patients = pq.order_by(m.Patient.updated_at.desc()).limit(min(limit, 500)).all()
    ids = [p.id for p in patients]
    if not ids:
        return {"summary": {}, "patients": [], "generated_at": datetime.now(timezone.utc).isoformat()}

    def grouped(model, order_col=None):
        q = db.query(model).filter(model.tenant_id == tenant_id, model.patient_id.in_(ids))
        if hasattr(model, "is_deleted"):
            q = q.filter(model.is_deleted == False)
        if order_col is not None:
            q = q.order_by(order_col.desc())
        out = defaultdict(list)
        for row in q.all():
            out[row.patient_id].append(row)
        return out

    appointments = grouped(m.Appointment, m.Appointment.scheduled_at)
    encounters = grouped(m.Encounter, m.Encounter.started_at)
    triages = grouped(m.TriageAssessment, m.TriageAssessment.arrived_at)
    admissions = grouped(m.IpdAdmission, m.IpdAdmission.admitted_at)
    labs = grouped(m.LabOrder, m.LabOrder.created_at)
    radiology = grouped(m.RadiologyOrder, m.RadiologyOrder.created_at)
    nursing = grouped(m.NursingTask, m.NursingTask.created_at)
    invoices = grouped(m.Invoice, m.Invoice.created_at)

    board = []
    for p in patients:
        active_adm = next((x for x in admissions[p.id] if x.status != "discharged"), None)
        active_ed = next((x for x in triages[p.id] if x.status not in ("disposition", "closed")), None)
        open_enc = next((x for x in encounters[p.id] if x.status == "open"), None)
        checked_in = next((x for x in appointments[p.id] if x.status == "checked_in"), None)
        upcoming = next((x for x in appointments[p.id] if x.status in ("scheduled", "confirmed")), None)
        if active_adm:
            stage, label, route, next_action = "inpatient", "Admitted", "/inpatient", "Complete nursing plan and discharge readiness"
        elif active_ed:
            stage, label, route, next_action = "emergency", f"ED - ESI {active_ed.esi_level}", "/emergency", "Advance triage, treatment and disposition"
        elif open_enc:
            stage, label, route, next_action = "clinical", "In consultation", "/care-journey", "Complete orders, prescription and clinical closure"
        elif checked_in:
            stage, label, route, next_action = "checked_in", "Checked in", "/appointments", "Capture vitals and start encounter"
        elif upcoming:
            stage, label, route, next_action = "scheduled", "Appointment booked", "/appointments", "Confirm arrival and check in"
        else:
            stage, label, route, next_action = "registered", "Registered", "/care-journey", "Book appointment or register walk-in"
        pending_orders = sum(1 for x in labs[p.id] if x.status not in ("verified", "completed")) + sum(
            1 for x in radiology[p.id] if x.status not in ("reported", "critical"))
        open_tasks = sum(1 for x in nursing[p.id] if x.status != "completed")
        outstanding = sum(float(x.total or 0) for x in invoices[p.id] if x.status not in ("paid", "cancelled", "void"))
        dates = [x for x in [appointments[p.id][0].scheduled_at if appointments[p.id] else None,
                             encounters[p.id][0].started_at if encounters[p.id] else None,
                             admissions[p.id][0].admitted_at if admissions[p.id] else None,
                             triages[p.id][0].arrived_at if triages[p.id] else None] if x]
        board.append({
            "id": str(p.id), "mrn": p.mrn, "name": f"{p.first_name} {p.last_name}".strip(),
            "date_of_birth": p.date_of_birth, "gender": p.gender_code, "phone": p.phone,
            "blood_group": p.blood_group, "stage": stage, "stage_label": label, "route": route,
            "next_action": next_action, "active_admission": active_adm.admission_no if active_adm else None,
            "bed": active_adm.bed_code if active_adm else None, "pending_orders": pending_orders,
            "open_tasks": open_tasks, "outstanding": round(outstanding, 2),
            "last_activity": _iso(max(dates)) if dates else _iso(p.updated_at),
        })
    stages = defaultdict(int)
    for item in board:
        stages[item["stage"]] += 1
    return {"summary": {
        "patients": len(board), "registered": stages["registered"], "scheduled": stages["scheduled"],
        "checked_in": stages["checked_in"], "clinical": stages["clinical"], "emergency": stages["emergency"],
        "inpatient": stages["inpatient"], "pending_orders": sum(x["pending_orders"] for x in board),
        "open_tasks": sum(x["open_tasks"] for x in board), "outstanding": round(sum(x["outstanding"] for x in board), 2),
    }, "patients": board, "generated_at": datetime.now(timezone.utc).isoformat()}


def patient_journey(db: Session, tenant_id: UUID, patient_id: UUID) -> dict | None:
    patient = db.query(m.Patient).filter(m.Patient.id == patient_id, m.Patient.tenant_id == tenant_id,
                                         m.Patient.is_deleted == False).first()
    if not patient:
        return None
    events = []
    sources = [
        (m.Appointment, "Appointment", "scheduled_at", lambda x: x.status, lambda x: x.reason or x.mode),
        (m.Encounter, "Encounter", "started_at", lambda x: x.status, lambda x: x.chief_complaint),
        (m.TriageAssessment, "Emergency", "arrived_at", lambda x: x.status, lambda x: f"ESI {x.esi_level} - {x.chief_complaint or ''}"),
        (m.IpdAdmission, "Inpatient", "admitted_at", lambda x: x.status, lambda x: f"{x.admission_no} - Bed {x.bed_code or 'TBA'}"),
        (m.LabOrder, "Laboratory", "created_at", lambda x: x.status, lambda x: f"{x.order_no} - {x.test_code}"),
        (m.RadiologyOrder, "Radiology", "created_at", lambda x: x.status, lambda x: f"{x.order_no} - {x.study_code}"),
        (m.PharmacyDispense, "Pharmacy", "created_at", lambda x: x.status, lambda x: f"{x.dispense_no} - {x.medicine_code}"),
        (m.NursingTask, "Nursing", "created_at", lambda x: x.status, lambda x: x.description or x.task_type),
        (m.Invoice, "Billing", "created_at", lambda x: x.status, lambda x: f"{x.invoice_no} - INR {float(x.total or 0):,.2f}"),
    ]
    for model, event_type, date_attr, status_fn, detail_fn in sources:
        q = db.query(model).filter(model.tenant_id == tenant_id, model.patient_id == patient_id)
        if hasattr(model, "is_deleted"):
            q = q.filter(model.is_deleted == False)
        for row in q.all():
            events.append({"id": str(row.id), "type": event_type, "status": status_fn(row),
                           "detail": detail_fn(row), "occurred_at": _iso(getattr(row, date_attr, None) or row.created_at)})
    events.sort(key=lambda x: x["occurred_at"] or "", reverse=True)
    return {"patient": {"id": str(patient.id), "mrn": patient.mrn,
                         "name": f"{patient.first_name} {patient.last_name}".strip(),
                         "date_of_birth": patient.date_of_birth, "gender": patient.gender_code,
                         "phone": patient.phone, "email": patient.email, "blood_group": patient.blood_group,
                         "address": patient.address, "emergency_contact": patient.emergency_contact or {}},
            "events": events}

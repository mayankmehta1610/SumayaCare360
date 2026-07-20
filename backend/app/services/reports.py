"""Run report definitions against live PostgreSQL data."""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import entities as m
from app.services.export_util import records_to_csv


# The reporting catalogue is product configuration, while report results always
# come from tenant-scoped transactional tables. Keeping it here also makes new
# installations and already-seeded databases expose the same complete suite.
REPORT_CATALOG = [
    {"code": "executive", "name": "Executive Hospital Overview", "audience": "Leadership", "module_code": "reports-bi-and-analytics", "category": "Leadership"},
    {"code": "patient-registry", "name": "Patient Registry & Demographics", "audience": "Patient Administration", "module_code": "patient-registration-and-crm", "category": "Patient Administration"},
    {"code": "appointment-utilization", "name": "Appointment Utilization & No-shows", "audience": "Front Office", "module_code": "appointment-and-queue-management", "category": "Patient Administration"},
    {"code": "opd-dashboard", "name": "OPD Throughput Dashboard", "audience": "Clinical Operations", "module_code": "opd-clinical-workflow", "category": "Clinical Operations"},
    {"code": "emergency-triage", "name": "Emergency Triage & Disposition", "audience": "Emergency", "module_code": "emergency-and-triage", "category": "Clinical Operations"},
    {"code": "ipd-occupancy", "name": "IPD Census & Bed Occupancy", "audience": "Hospital Administration", "module_code": "ipd-admission-and-ward-management", "category": "Inpatient"},
    {"code": "nursing-workload", "name": "Nursing Workload & Completion", "audience": "Nursing", "module_code": "nursing-and-care-plans", "category": "Inpatient"},
    {"code": "lab-tat", "name": "Laboratory TAT & Critical Results", "audience": "Laboratory", "module_code": "laboratory-and-diagnostics", "category": "Diagnostics"},
    {"code": "radiology-tat", "name": "Radiology Workflow & Reporting", "audience": "Radiology", "module_code": "radiology-and-pacs", "category": "Diagnostics"},
    {"code": "pharmacy-dispense", "name": "Pharmacy Dispensing & Pending Queue", "audience": "Pharmacy", "module_code": "pharmacy-and-medication-management", "category": "Clinical Support"},
    {"code": "ot-utilization", "name": "Operation Theatre Schedule & Utilization", "audience": "OT Management", "module_code": "operation-theatre-and-procedures", "category": "Clinical Operations"},
    {"code": "telemedicine", "name": "Telemedicine Sessions & Completion", "audience": "Virtual Care", "module_code": "telemedicine-and-virtual-care", "category": "Clinical Operations"},
    {"code": "revenue", "name": "Revenue, Collections & Outstanding", "audience": "Finance", "module_code": "billing-tariff-and-payments", "category": "Finance"},
    {"code": "claims-aging", "name": "Insurance Claims & Aging", "audience": "Insurance Desk", "module_code": "insurance-and-claims", "category": "Finance"},
    {"code": "care-pathways", "name": "Care Pathway Enrollments & Outcomes", "audience": "Care Management", "module_code": "disease-and-care-pathways", "category": "Care Management"},
    {"code": "discharge-followup", "name": "Discharge & Follow-up Worklist", "audience": "Care Coordination", "module_code": "post-treatment-patient-care", "category": "Care Management"},
    {"code": "audit-trail", "name": "Audit, Access & Governance", "audience": "Compliance", "module_code": "audit-trail-and-governance", "category": "Governance"},
    {"code": "inventory-operations", "name": "Inventory, Procurement & Stock Control", "audience": "Stores and Procurement", "module_code": "inventory-procurement-and-stores", "category": "Operations"},
    {"code": "chronic-care", "name": "Chronic Disease Registry & Outcomes", "audience": "Care Management", "module_code": "chronic-disease-management", "category": "Care Management"},
    {"code": "rehabilitation", "name": "Physiotherapy & Rehabilitation Outcomes", "audience": "Rehabilitation", "module_code": "physiotherapy-and-rehabilitation", "category": "Clinical Support"},
    {"code": "women-child-care", "name": "Women & Child Health Programme", "audience": "Women and Child Services", "module_code": "women-and-child-care", "category": "Clinical Operations"},
    {"code": "ambulance-operations", "name": "Ambulance Dispatch, Fleet & Handover", "audience": "Emergency Transport", "module_code": "ambulance-and-transport", "category": "Operations"},
    {"code": "support-services", "name": "Diet, Housekeeping & Infection Control", "audience": "Support Services", "module_code": "diet-housekeeping-and-support-services", "category": "Operations"},
    {"code": "integration-health", "name": "Integration Interface Health", "audience": "Digital Health", "module_code": "integrations-and-interoperability", "category": "Technology"},
    {"code": "data-governance", "name": "Data Governance, Backup & Release Controls", "audience": "Compliance and IT", "module_code": "data-governance-and-platform-controls", "category": "Governance"},
    {"code": "provider-marketplace", "name": "Provider Marketplace Contracts & SLA", "audience": "Network Operations", "module_code": "provider-marketplace", "category": "Operations"},
    {"code": "mobile-adoption", "name": "Mobile Application Adoption & Releases", "audience": "Digital Product", "module_code": "mobile-applications", "category": "Technology"},
]


def list_report_catalog() -> list[dict]:
    return REPORT_CATALOG


def _parse_date(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        try:
            return datetime.strptime(s, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except ValueError:
            return None


def _iso(value) -> str | None:
    return value.isoformat() if value else None


def _profile_value(row, attribute: str, key: str):
    return (getattr(row, attribute, None) or {}).get(key)



def _date_filter(q, col, date_from: datetime | None, date_to: datetime | None):
    if date_from:
        q = q.filter(col >= date_from)
    if date_to:
        q = q.filter(col <= date_to)
    return q


def run_report(
    db: Session,
    tenant_id: UUID,
    report_code: str,
    *,
    date_from: str | None = None,
    date_to: str | None = None,
    branch_id: UUID | None = None,
    export_format: str = "json",
) -> dict:
    definition = next((r for r in REPORT_CATALOG if r["code"] == report_code), None)
    row = db.query(m.ReportDefinition).filter(
        m.ReportDefinition.code == report_code, m.ReportDefinition.is_deleted == False,
    ).first()
    if not definition and not row:
        raise HTTPException(404, f"Report not found: {report_code}")

    df = _parse_date(date_from)
    dt = _parse_date(date_to)
    if dt and not dt.hour:
        dt = dt.replace(hour=23, minute=59, second=59)

    metrics: dict = {"generated_at": datetime.now(timezone.utc).isoformat(), "filters": {
        "date_from": date_from, "date_to": date_to, "branch_id": str(branch_id) if branch_id else None,
    }}
    detail_rows: list[dict] = []

    if report_code in ("opd-dashboard", "appointment-utilization"):
        aq = db.query(m.Appointment).filter(
            m.Appointment.tenant_id == tenant_id, m.Appointment.is_deleted == False
        )
        if branch_id:
            aq = aq.filter(m.Appointment.branch_id == branch_id)
        aq = _date_filter(aq, m.Appointment.scheduled_at, df, dt)
        appts = aq.order_by(m.Appointment.scheduled_at.desc()).limit(500).all()
        metrics["appointments_total"] = len(appts)
        metrics["checked_in"] = sum(1 for a in appts if a.status == "checked_in")
        metrics["no_show"] = sum(1 for a in appts if a.status == "no_show")
        metrics["completed"] = sum(1 for a in appts if a.status == "completed")
        metrics["utilization_pct"] = round(100 * metrics["completed"] / len(appts), 1) if appts else 0
        detail_rows = [
            {"id": str(a.id), "patient_id": str(a.patient_id), "status": a.status,
             "scheduled_at": a.scheduled_at.isoformat() if a.scheduled_at else None}
            for a in appts
        ]
    elif report_code == "patient-registry":
        pq = db.query(m.Patient).filter(m.Patient.tenant_id == tenant_id, m.Patient.is_deleted == False)
        pq = _date_filter(pq, m.Patient.created_at, df, dt)
        patients = pq.order_by(m.Patient.created_at.desc()).limit(1000).all()
        metrics["registered_patients"] = len(patients)
        metrics["active"] = sum(1 for p in patients if p.status == "active")
        metrics["with_mobile"] = sum(1 for p in patients if p.phone)
        detail_rows = [{"mrn": p.mrn, "name": f"{p.first_name} {p.last_name}", "gender": p.gender_code,
                        "date_of_birth": p.date_of_birth, "phone": p.phone, "status": p.status} for p in patients]
    elif report_code == "emergency-triage":
        tq = db.query(m.TriageAssessment).filter(m.TriageAssessment.tenant_id == tenant_id, m.TriageAssessment.is_deleted == False)
        tq = _date_filter(tq, m.TriageAssessment.arrived_at, df, dt)
        triage = tq.order_by(m.TriageAssessment.arrived_at.desc()).limit(500).all()
        metrics["arrivals"] = len(triage)
        metrics["high_acuity"] = sum(1 for x in triage if x.esi_level in (1, 2))
        metrics["admitted"] = sum(1 for x in triage if x.disposition == "admit")
        metrics["pending_disposition"] = sum(1 for x in triage if not x.disposition)
        detail_rows = [{"triage_no": x.triage_no, "patient_id": str(x.patient_id), "esi": x.esi_level,
                        "status": x.status, "disposition": x.disposition, "chief_complaint": x.chief_complaint,
                        "arrival_mode": _profile_value(x, "clinical_profile", "arrival_mode"), "pain_score": _profile_value(x, "clinical_profile", "pain_score"),
                        "spo2_pct": _profile_value(x, "clinical_profile", "spo2_pct")} for x in triage]
    elif report_code == "ipd-occupancy":
        total_beds = db.query(m.Bed).filter(m.Bed.tenant_id == tenant_id).count()
        occupied = db.query(m.Bed).filter(m.Bed.tenant_id == tenant_id, m.Bed.status == "occupied").count()
        metrics["beds_total"] = total_beds
        metrics["beds_occupied"] = occupied
        metrics["occupancy_pct"] = round(100 * occupied / total_beds, 1) if total_beds else 0
        adm_q = db.query(m.IpdAdmission).filter(
            m.IpdAdmission.tenant_id == tenant_id, m.IpdAdmission.status == "admitted"
        )
        adm_q = _date_filter(adm_q, m.IpdAdmission.admitted_at, df, dt)
        admissions = adm_q.all()
        metrics["active_admissions"] = len(admissions)
        detail_rows = [
            {"admission_no": a.admission_no, "bed_code": a.bed_code, "patient_id": str(a.patient_id), "status": a.status,
             "admission_type": _profile_value(a, "admission_profile", "admission_type"), "acuity": _profile_value(a, "admission_profile", "acuity"),
             "expected_stay_days": _profile_value(a, "admission_profile", "expected_length_of_stay_days")}
            for a in admissions
        ]
    elif report_code == "nursing-workload":
        nq = db.query(m.NursingTask).filter(m.NursingTask.tenant_id == tenant_id, m.NursingTask.is_deleted == False)
        nq = _date_filter(nq, m.NursingTask.created_at, df, dt)
        tasks = nq.order_by(m.NursingTask.created_at.desc()).limit(500).all()
        metrics["tasks"] = len(tasks)
        metrics["pending"] = sum(1 for x in tasks if x.status == "pending")
        metrics["in_progress"] = sum(1 for x in tasks if x.status == "in_progress")
        metrics["completed"] = sum(1 for x in tasks if x.status == "completed")
        metrics["completion_pct"] = round(100 * metrics["completed"] / len(tasks), 1) if tasks else 0
        detail_rows = [{"patient_id": str(x.patient_id), "task_type": x.task_type, "status": x.status,
                        "due_at": _iso(x.due_at), "description": x.description, "priority": _profile_value(x, "care_profile", "priority"),
                        "shift": _profile_value(x, "care_profile", "shift"), "frequency": _profile_value(x, "care_profile", "frequency")} for x in tasks]
    elif report_code == "lab-tat":
        oq = db.query(m.LabOrder).filter(m.LabOrder.tenant_id == tenant_id, m.LabOrder.is_deleted == False)
        oq = _date_filter(oq, m.LabOrder.created_at, df, dt)
        orders = oq.order_by(m.LabOrder.created_at.desc()).limit(500).all()
        metrics["orders_total"] = len(orders)
        metrics["completed"] = sum(1 for o in orders if o.status in ("completed", "verified", "result_entered"))
        metrics["critical"] = sum(1 for o in orders if o.critical_flag)
        metrics["pending"] = sum(1 for o in orders if o.status in ("ordered", "sample_collected", "processing"))
        detail_rows = [
            {"order_no": o.order_no, "test_code": o.test_code, "status": o.status,
             "critical": o.critical_flag, "patient_id": str(o.patient_id), "priority": _profile_value(o, "order_profile", "priority"),
             "specimen_type": _profile_value(o, "order_profile", "specimen_type"), "collection_location": _profile_value(o, "order_profile", "collection_location")}
            for o in orders
        ]
    elif report_code == "radiology-tat":
        rq = db.query(m.RadiologyOrder).filter(m.RadiologyOrder.tenant_id == tenant_id, m.RadiologyOrder.is_deleted == False)
        rq = _date_filter(rq, m.RadiologyOrder.created_at, df, dt)
        orders = rq.order_by(m.RadiologyOrder.created_at.desc()).limit(500).all()
        metrics["orders"] = len(orders)
        metrics["reported"] = sum(1 for x in orders if x.status in ("reported", "critical"))
        metrics["pending"] = sum(1 for x in orders if x.status not in ("reported", "critical"))
        metrics["critical"] = sum(1 for x in orders if x.critical_flag)
        detail_rows = [{"order_no": x.order_no, "patient_id": str(x.patient_id), "study": x.study_code,
                        "status": x.status, "critical": x.critical_flag, "priority": _profile_value(x, "order_profile", "priority"),
                        "body_part": _profile_value(x, "order_profile", "body_part"), "contrast": _profile_value(x, "order_profile", "contrast_required")} for x in orders]
    elif report_code == "pharmacy-dispense":
        pq = db.query(m.PharmacyDispense).filter(m.PharmacyDispense.tenant_id == tenant_id, m.PharmacyDispense.is_deleted == False)
        pq = _date_filter(pq, m.PharmacyDispense.created_at, df, dt)
        items = pq.order_by(m.PharmacyDispense.created_at.desc()).limit(500).all()
        metrics["dispense_lines"] = len(items)
        metrics["dispensed"] = sum(1 for x in items if x.status == "dispensed")
        metrics["pending"] = sum(1 for x in items if x.status != "dispensed")
        detail_rows = [{"dispense_no": x.dispense_no, "patient_id": str(x.patient_id), "medicine": x.medicine_code,
                        "qty": float(x.qty or 0), "status": x.status, "dose": _profile_value(x, "dispense_profile", "dose"),
                        "frequency": _profile_value(x, "dispense_profile", "frequency"), "batch_no": _profile_value(x, "dispense_profile", "batch_no")} for x in items]
    elif report_code == "ot-utilization":
        oq = db.query(m.OtProcedure).filter(m.OtProcedure.tenant_id == tenant_id, m.OtProcedure.is_deleted == False)
        oq = _date_filter(oq, m.OtProcedure.scheduled_at, df, dt)
        cases = oq.order_by(m.OtProcedure.scheduled_at.desc()).limit(500).all()
        metrics["cases"] = len(cases)
        metrics["completed"] = sum(1 for x in cases if x.status == "completed")
        metrics["scheduled"] = sum(1 for x in cases if x.status == "scheduled")
        metrics["cancelled"] = sum(1 for x in cases if x.status == "cancelled")
        detail_rows = [{"procedure_no": x.procedure_no, "patient_id": str(x.patient_id), "procedure": x.procedure_name,
                        "theatre": x.theatre_code, "status": x.status, "scheduled_at": _iso(x.scheduled_at),
                        "case_type": _profile_value(x, "procedure_profile", "case_type"), "anaesthesia": _profile_value(x, "procedure_profile", "anaesthesia_type")} for x in cases]
    elif report_code == "telemedicine":
        tq = db.query(m.TelemedicineSession).filter(m.TelemedicineSession.tenant_id == tenant_id)
        tq = _date_filter(tq, m.TelemedicineSession.created_at, df, dt)
        sessions = tq.order_by(m.TelemedicineSession.created_at.desc()).limit(500).all()
        metrics["sessions"] = len(sessions)
        metrics["completed"] = sum(1 for x in sessions if x.status == "completed")
        metrics["waiting"] = sum(1 for x in sessions if x.status == "waiting")
        metrics["recording_consented"] = sum(1 for x in sessions if x.recording_consent_id)
        detail_rows = [{"room_id": x.room_id, "patient_id": str(x.patient_id), "provider_id": str(x.provider_id),
                        "status": x.status, "started_at": _iso(x.started_at), "ended_at": _iso(x.ended_at)} for x in sessions]
    elif report_code == "revenue":
        iq = db.query(m.Invoice).filter(m.Invoice.tenant_id == tenant_id, m.Invoice.is_deleted == False)
        iq = _date_filter(iq, m.Invoice.created_at, df, dt)
        invoices = iq.order_by(m.Invoice.created_at.desc()).limit(500).all()
        metrics["invoices_total"] = len(invoices)
        metrics["issued"] = sum(float(i.total or 0) for i in invoices if i.status == "issued")
        metrics["paid"] = sum(float(i.total or 0) for i in invoices if i.status == "paid")
        metrics["outstanding"] = sum(float(i.total or 0) for i in invoices if i.status not in ("paid", "cancelled", "void"))
        detail_rows = [
            {"invoice_no": i.invoice_no, "status": i.status, "total": float(i.total or 0),
             "patient_id": str(i.patient_id)}
            for i in invoices
        ]
    elif report_code == "claims-aging":
        cq = db.query(m.InsuranceClaim).filter(m.InsuranceClaim.tenant_id == tenant_id, m.InsuranceClaim.is_deleted == False)
        cq = _date_filter(cq, m.InsuranceClaim.created_at, df, dt)
        claims = cq.order_by(m.InsuranceClaim.created_at.desc()).limit(500).all()
        metrics["claims"] = len(claims)
        metrics["claimed_amount"] = round(sum(float(x.amount or 0) for x in claims), 2)
        metrics["open"] = sum(1 for x in claims if x.status not in ("settled", "rejected"))
        metrics["settled"] = sum(1 for x in claims if x.status == "settled")
        detail_rows = [{"claim_no": x.claim_no, "patient_id": str(x.patient_id), "payer": x.payer_code,
                        "amount": float(x.amount or 0), "status": x.status, "pre_auth_no": x.pre_auth_no,
                        "claim_type": _profile_value(x, "claim_profile", "claim_type"), "document_status": _profile_value(x, "claim_profile", "document_status")} for x in claims]
    elif report_code == "care-pathways":
        eq = db.query(m.PathwayEnrollment).filter(m.PathwayEnrollment.tenant_id == tenant_id, m.PathwayEnrollment.is_deleted == False)
        eq = _date_filter(eq, m.PathwayEnrollment.enrolled_at, df, dt)
        enrollments = eq.order_by(m.PathwayEnrollment.enrolled_at.desc()).limit(500).all()
        metrics["enrollments"] = len(enrollments)
        metrics["active"] = sum(1 for x in enrollments if x.status == "active")
        metrics["completed"] = sum(1 for x in enrollments if x.status == "completed")
        detail_rows = [{"patient_id": str(x.patient_id), "pathway_id": str(x.pathway_id), "status": x.status,
                        "milestone": x.current_milestone, "enrolled_at": _iso(x.enrolled_at)} for x in enrollments]
    elif report_code == "discharge-followup":
        aq = db.query(m.IpdAdmission).filter(m.IpdAdmission.tenant_id == tenant_id, m.IpdAdmission.status == "discharged")
        aq = _date_filter(aq, m.IpdAdmission.discharged_at, df, dt)
        discharged = aq.order_by(m.IpdAdmission.discharged_at.desc()).limit(500).all()
        followups = db.query(m.ModuleRecord).filter(m.ModuleRecord.tenant_id == tenant_id,
            m.ModuleRecord.module_code == "post-treatment-patient-care", m.ModuleRecord.is_deleted == False).all()
        followup_patients = {x.patient_id for x in followups if x.patient_id}
        metrics["discharges"] = len(discharged)
        metrics["followup_created"] = sum(1 for x in discharged if x.patient_id in followup_patients)
        metrics["followup_gap"] = metrics["discharges"] - metrics["followup_created"]
        detail_rows = [{"admission_no": x.admission_no, "patient_id": str(x.patient_id), "ward": x.ward_code,
                        "discharged_at": _iso(x.discharged_at), "followup": "Created" if x.patient_id in followup_patients else "Required"} for x in discharged]
    elif report_code == "audit-trail":
        aq = db.query(m.AuditLog).filter(m.AuditLog.tenant_id == tenant_id)
        aq = _date_filter(aq, m.AuditLog.created_at, df, dt)
        logs = aq.order_by(m.AuditLog.created_at.desc()).limit(500).all()
        metrics["audit_events"] = len(logs)
        metrics["api_calls"] = db.query(m.ApiAuditLog).filter(m.ApiAuditLog.tenant_id == tenant_id).count()
        detail_rows = [
            {"action": l.action, "entity_type": l.entity_type, "entity_id": l.entity_id,
             "created_at": l.created_at.isoformat() if l.created_at else None}
            for l in logs
        ]
    elif report_code == "executive":
        metrics["patients"] = db.query(m.Patient).filter(m.Patient.tenant_id == tenant_id).count()
        metrics["encounters_open"] = db.query(m.Encounter).filter(
            m.Encounter.tenant_id == tenant_id, m.Encounter.status == "open"
        ).count()
        metrics["claims"] = db.query(m.InsuranceClaim).filter(m.InsuranceClaim.tenant_id == tenant_id).count()
        metrics["tele_sessions"] = db.query(m.TelemedicineSession).filter(
            m.TelemedicineSession.tenant_id == tenant_id
        ).count()
        metrics["active_ipd"] = db.query(m.IpdAdmission).filter(m.IpdAdmission.tenant_id == tenant_id, m.IpdAdmission.status != "discharged").count()
        metrics["open_ed"] = db.query(m.TriageAssessment).filter(m.TriageAssessment.tenant_id == tenant_id,
            m.TriageAssessment.status.notin_(("disposition", "closed"))).count()
        metrics["outstanding_inr"] = round(sum(float(x.total or 0) for x in db.query(m.Invoice).filter(
            m.Invoice.tenant_id == tenant_id, m.Invoice.status.notin_(("paid", "cancelled", "void"))).all()), 2)
        detail_rows = [{"metric": k, "value": v} for k, v in metrics.items() if k != "generated_at" and k != "filters"]
    else:
        module_code = definition["module_code"] if definition else row.module_code
        rq = db.query(m.ModuleRecord).filter(
            m.ModuleRecord.tenant_id == tenant_id,
            m.ModuleRecord.module_code == module_code,
            m.ModuleRecord.is_deleted == False,
        )
        rq = _date_filter(rq, m.ModuleRecord.created_at, df, dt)
        recs = rq.order_by(m.ModuleRecord.created_at.desc()).limit(500).all()
        metrics["records"] = len(recs)
        metrics["open"] = sum(1 for r in recs if r.status not in ("completed", "closed", "cancelled", "retired"))
        metrics["completed"] = sum(1 for r in recs if r.status in ("completed", "closed", "retired"))
        metrics["with_patient"] = sum(1 for r in recs if r.patient_id)
        metrics["submodules"] = len({r.submodule for r in recs})
        detail_rows = []
        for record in recs:
            detail = {
                "reference_no": record.reference_no, "title": record.title, "status": record.status,
                "submodule": record.submodule, "patient_id": str(record.patient_id) if record.patient_id else None,
                "created_at": _iso(record.created_at),
            }
            for key, value in (record.payload or {}).items():
                if len(detail) >= 18:
                    break
                detail[key] = value if isinstance(value, (str, int, float, bool)) or value is None else str(value)
            detail_rows.append(detail)

    result = {
        "code": report_code,
        "name": definition["name"] if definition else row.name,
        "module_code": definition["module_code"] if definition else row.module_code,
        "audience": definition["audience"] if definition else row.audience,
        "category": definition.get("category") if definition else "Other",
        "metrics": metrics,
        "rows": detail_rows,
        "row_count": len(detail_rows),
    }
    if export_format == "csv" and detail_rows:
        result["csv"] = records_to_csv(detail_rows)
    return result

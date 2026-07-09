"""Run report definitions against live PostgreSQL data."""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import entities as m
from app.services.export_util import records_to_csv


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
    row = db.query(m.ReportDefinition).filter(
        m.ReportDefinition.code == report_code,
        m.ReportDefinition.is_deleted == False,
    ).first()
    if not row:
        raise HTTPException(404, f"Report not found: {report_code}")

    df = _parse_date(date_from)
    dt = _parse_date(date_to)
    if dt and not dt.hour:
        dt = dt.replace(hour=23, minute=59, second=59)

    metrics: dict = {"generated_at": datetime.now(timezone.utc).isoformat(), "filters": {
        "date_from": date_from, "date_to": date_to, "branch_id": str(branch_id) if branch_id else None,
    }}
    detail_rows: list[dict] = []

    if report_code == "opd-dashboard":
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
        detail_rows = [
            {"id": str(a.id), "patient_id": str(a.patient_id), "status": a.status,
             "scheduled_at": a.scheduled_at.isoformat() if a.scheduled_at else None}
            for a in appts
        ]
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
            {"admission_no": a.admission_no, "bed_code": a.bed_code, "patient_id": str(a.patient_id), "status": a.status}
            for a in admissions
        ]
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
             "critical": o.critical_flag, "patient_id": str(o.patient_id)}
            for o in orders
        ]
    elif report_code == "revenue":
        iq = db.query(m.Invoice).filter(m.Invoice.tenant_id == tenant_id, m.Invoice.is_deleted == False)
        iq = _date_filter(iq, m.Invoice.created_at, df, dt)
        invoices = iq.order_by(m.Invoice.created_at.desc()).limit(500).all()
        metrics["invoices_total"] = len(invoices)
        metrics["issued"] = sum(float(i.total or 0) for i in invoices if i.status == "issued")
        metrics["paid"] = sum(float(i.total or 0) for i in invoices if i.status == "paid")
        metrics["outstanding"] = metrics["issued"]
        detail_rows = [
            {"invoice_no": i.invoice_no, "status": i.status, "total": float(i.total or 0),
             "patient_id": str(i.patient_id)}
            for i in invoices
        ]
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
        detail_rows = [{"metric": k, "value": v} for k, v in metrics.items() if k != "generated_at" and k != "filters"]
    else:
        rq = db.query(m.ModuleRecord).filter(
            m.ModuleRecord.tenant_id == tenant_id,
            m.ModuleRecord.module_code == row.module_code,
            m.ModuleRecord.is_deleted == False,
        )
        rq = _date_filter(rq, m.ModuleRecord.created_at, df, dt)
        recs = rq.order_by(m.ModuleRecord.created_at.desc()).limit(500).all()
        metrics["records"] = len(recs)
        detail_rows = [
            {"reference_no": r.reference_no, "title": r.title, "status": r.status, "submodule": r.submodule}
            for r in recs
        ]

    result = {
        "code": row.code,
        "name": row.name,
        "module_code": row.module_code,
        "audience": row.audience,
        "metrics": metrics,
        "rows": detail_rows,
        "row_count": len(detail_rows),
    }
    if export_format == "csv" and detail_rows:
        result["csv"] = records_to_csv(detail_rows)
    return result

"""Run report definitions against live PostgreSQL data."""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import entities as m


def run_report(
    db: Session,
    tenant_id: UUID,
    report_code: str,
    *,
    date_from: str | None = None,
    date_to: str | None = None,
    branch_id: UUID | None = None,
) -> dict:
    row = db.query(m.ReportDefinition).filter(
        m.ReportDefinition.code == report_code,
        m.ReportDefinition.is_deleted == False,
    ).first()
    if not row:
        raise HTTPException(404, f"Report not found: {report_code}")

    metrics: dict = {"generated_at": datetime.now(timezone.utc).isoformat(), "filters": {
        "date_from": date_from, "date_to": date_to, "branch_id": str(branch_id) if branch_id else None,
    }}

    if report_code == "opd-dashboard":
        metrics["appointments_total"] = db.query(m.Appointment).filter(
            m.Appointment.tenant_id == tenant_id, m.Appointment.is_deleted == False
        ).count()
        metrics["checked_in"] = db.query(m.Appointment).filter(
            m.Appointment.tenant_id == tenant_id, m.Appointment.status == "checked_in"
        ).count()
        metrics["no_show"] = db.query(m.Appointment).filter(
            m.Appointment.tenant_id == tenant_id, m.Appointment.status == "no_show"
        ).count()
    elif report_code == "ipd-occupancy":
        total_beds = db.query(m.Bed).filter(m.Bed.tenant_id == tenant_id).count()
        occupied = db.query(m.Bed).filter(m.Bed.tenant_id == tenant_id, m.Bed.status == "occupied").count()
        metrics["beds_total"] = total_beds
        metrics["beds_occupied"] = occupied
        metrics["occupancy_pct"] = round(100 * occupied / total_beds, 1) if total_beds else 0
        metrics["active_admissions"] = db.query(m.IpdAdmission).filter(
            m.IpdAdmission.tenant_id == tenant_id, m.IpdAdmission.status == "admitted"
        ).count()
    elif report_code == "lab-tat":
        orders = db.query(m.LabOrder).filter(m.LabOrder.tenant_id == tenant_id).all()
        metrics["orders_total"] = len(orders)
        metrics["completed"] = sum(1 for o in orders if o.status in ("completed", "verified"))
        metrics["critical"] = sum(1 for o in orders if o.critical_flag)
        metrics["pending"] = sum(1 for o in orders if o.status in ("ordered", "collected", "processing"))
    elif report_code == "revenue":
        invoices = db.query(m.Invoice).filter(
            m.Invoice.tenant_id == tenant_id, m.Invoice.is_deleted == False
        ).all()
        metrics["invoices_total"] = len(invoices)
        metrics["issued"] = sum(float(i.total or 0) for i in invoices if i.status == "issued")
        metrics["paid"] = sum(float(i.total or 0) for i in invoices if i.status == "paid")
        metrics["outstanding"] = metrics["issued"]
    elif report_code == "audit-trail":
        metrics["audit_events"] = db.query(m.AuditLog).filter(m.AuditLog.tenant_id == tenant_id).count()
        metrics["api_calls"] = db.query(m.ApiAuditLog).filter(m.ApiAuditLog.tenant_id == tenant_id).count()
    elif report_code == "executive":
        metrics["patients"] = db.query(m.Patient).filter(m.Patient.tenant_id == tenant_id).count()
        metrics["encounters_open"] = db.query(m.Encounter).filter(
            m.Encounter.tenant_id == tenant_id, m.Encounter.status == "open"
        ).count()
        metrics["claims"] = db.query(m.InsuranceClaim).filter(m.InsuranceClaim.tenant_id == tenant_id).count()
        metrics["tele_sessions"] = db.query(m.TelemedicineSession).filter(
            m.TelemedicineSession.tenant_id == tenant_id
        ).count()
    else:
        metrics["records"] = db.query(m.ModuleRecord).filter(
            m.ModuleRecord.tenant_id == tenant_id,
            m.ModuleRecord.module_code == row.module_code,
        ).count()

    return {
        "code": row.code,
        "name": row.name,
        "module_code": row.module_code,
        "audience": row.audience,
        "metrics": metrics,
        "rows": [],
    }

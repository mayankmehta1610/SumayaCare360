"""Billing helpers — tariff-driven invoices from PostgreSQL masters."""
from typing import Optional
from uuid import UUID
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models import entities as m
from app.services.audit import write_audit


def build_invoice(
    db: Session,
    *,
    tenant_id: UUID,
    tenant_code: str,
    patient_id: UUID,
    actor_id: UUID,
    tariff_lines: list[dict],
    encounter_id: Optional[UUID] = None,
    status: str = "issued",
    correlation_id: Optional[str] = None,
) -> m.Invoice:
    prefix = "EST" if status == "estimate" else "INV"
    count = db.query(m.Invoice).filter(m.Invoice.tenant_id == tenant_id).count() + 1
    inv_no = f"{prefix}-{tenant_code.upper()}-{count:06d}"
    subtotal = 0.0
    inv = m.Invoice(
        tenant_id=tenant_id,
        patient_id=patient_id,
        encounter_id=encounter_id,
        invoice_no=inv_no,
        status=status,
        created_by=actor_id,
        updated_by=actor_id,
    )
    db.add(inv)
    db.flush()
    for line in tariff_lines:
        code = line.get("tariff_code")
        tariff = db.query(m.Tariff).filter(m.Tariff.tenant_id == tenant_id, m.Tariff.code == code).first()
        if not tariff:
            raise HTTPException(400, f"Unknown tariff {code} — configure in tariff master")
        qty = float(line.get("qty", 1))
        amount = float(tariff.amount) * qty
        subtotal += amount
        db.add(m.InvoiceLine(
            tenant_id=tenant_id, invoice_id=inv.id,
            tariff_code=tariff.code, description=tariff.name,
            qty=qty, unit_price=tariff.amount, amount=amount,
            created_by=actor_id, updated_by=actor_id,
        ))
    inv.subtotal = subtotal
    inv.tax = 0
    inv.total = subtotal
    write_audit(
        db, tenant_id=tenant_id, actor_user_id=actor_id, action="CREATE",
        entity_type="invoice", entity_id=str(inv.id),
        new_values={"invoice_no": inv_no, "total": subtotal, "encounter_id": str(encounter_id) if encounter_id else None},
        correlation_id=correlation_id,
    )
    return inv


def tariff_lines_for_opd_discharge(db: Session, tenant_id: UUID, enc: m.Encounter) -> list[dict]:
    lines = [{"tariff_code": "OPD_CONSULT", "qty": 1}]
    if enc.appointment_id:
        appt = db.query(m.Appointment).filter(m.Appointment.id == enc.appointment_id).first()
        if appt and appt.mode == "telemedicine":
            lines = [{"tariff_code": "TELE_CONSULT", "qty": 1}]
    prior = db.query(m.Encounter).filter(
        m.Encounter.tenant_id == tenant_id,
        m.Encounter.patient_id == enc.patient_id,
        m.Encounter.id != enc.id,
    ).count()
    if prior == 0:
        lines.append({"tariff_code": "REG_FEE", "qty": 1})
    lab_count = db.query(m.LabOrder).filter(
        m.LabOrder.tenant_id == tenant_id,
        m.LabOrder.patient_id == enc.patient_id,
        m.LabOrder.encounter_id == enc.id,
    ).count()
    if lab_count == 0:
        lab_count = db.query(m.LabOrder).filter(
            m.LabOrder.tenant_id == tenant_id, m.LabOrder.patient_id == enc.patient_id
        ).count()
    for _ in range(min(lab_count, 5)):
        test_tariff = db.query(m.Tariff).filter(
            m.Tariff.tenant_id == tenant_id, m.Tariff.category == "lab"
        ).first()
        if test_tariff:
            lines.append({"tariff_code": test_tariff.code, "qty": 1})
            break
    return lines

"""Production clinical domain services — lab, radiology, pharmacy, nursing."""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import entities as m
from app.services.audit import write_audit

# ── Lifecycle definitions ──

LAB_STATUSES = ("ordered", "sample_collected", "result_entered", "verified", "critical_alert")
LAB_TRANSITIONS: dict[str, set[str]] = {
    "ordered": {"sample_collected"},
    "sample_collected": {"result_entered"},
    "result_entered": {"verified", "critical_alert"},
    "verified": set(),
    "critical_alert": set(),
}

RADIOLOGY_STATUSES = ("ordered", "scheduled", "acquired", "reported", "critical")
RADIOLOGY_TRANSITIONS: dict[str, set[str]] = {
    "ordered": {"scheduled"},
    "scheduled": {"acquired"},
    "acquired": {"reported", "critical"},
    "reported": set(),
    "critical": set(),
}

DISPENSE_STATUSES = ("queued", "verified", "dispensed")
DISPENSE_TRANSITIONS: dict[str, set[str]] = {
    "queued": {"verified"},
    "pending": {"verified"},  # legacy alias
    "verified": {"dispensed"},
    "dispensed": set(),
}

NURSING_STATUSES = ("pending", "in_progress", "completed", "cancelled")
NURSING_TRANSITIONS: dict[str, set[str]] = {
    "pending": {"in_progress", "cancelled"},
    "in_progress": {"completed", "cancelled"},
    "completed": set(),
    "cancelled": set(),
}


def _assert_transition(current: str, target: str, transitions: dict[str, set[str]], entity: str):
    allowed = transitions.get(current, set())
    if target not in allowed:
        raise HTTPException(
            400,
            f"Invalid {entity} status transition: {current} → {target}. Allowed: {sorted(allowed) or 'none'}",
        )


def _next_no(db: Session, tenant_id: UUID, model, prefix: str) -> str:
    n = db.query(model).filter(model.tenant_id == tenant_id).count() + 1
    return f"{prefix}-{n:06d}"


def _patient_or_404(db: Session, tenant_id: UUID, patient_id: UUID) -> m.Patient:
    row = db.query(m.Patient).filter(
        m.Patient.id == patient_id, m.Patient.tenant_id == tenant_id, m.Patient.is_deleted == False
    ).first()
    if not row:
        raise HTTPException(404, "Patient not found")
    return row


def _medicine_or_400(db: Session, tenant_id: UUID, medicine_code: str) -> m.Medicine:
    med = db.query(m.Medicine).filter(
        m.Medicine.tenant_id == tenant_id,
        m.Medicine.code == medicine_code,
        m.Medicine.is_deleted == False,
    ).first()
    if not med:
        raise HTTPException(400, f"Unknown medicine '{medicine_code}' — select from medicine master")
    if med.status != "active":
        raise HTTPException(400, f"Medicine '{medicine_code}' is not active")
    return med


def check_medicine_stock(med: m.Medicine, qty: Decimal) -> None:
    available = Decimal(str(med.stock_qty or 0))
    if available < qty:
        raise HTTPException(
            400,
            f"Insufficient stock for {med.code}: requested {qty}, available {available}",
        )


# ── Serializers ──

def serialize_lab_order(row: m.LabOrder) -> dict:
    return {
        "id": str(row.id),
        "order_no": row.order_no,
        "patient_id": str(row.patient_id),
        "provider_id": str(row.provider_id) if row.provider_id else None,
        "encounter_id": str(row.encounter_id) if row.encounter_id else None,
        "test_code": row.test_code,
        "status": row.status,
        "result_value": row.result_value,
        "result_notes": row.result_notes,
        "results": row.results or {},
        "critical_flag": row.critical_flag,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def serialize_radiology_order(row: m.RadiologyOrder) -> dict:
    return {
        "id": str(row.id),
        "order_no": row.order_no,
        "patient_id": str(row.patient_id),
        "provider_id": str(row.provider_id) if row.provider_id else None,
        "encounter_id": str(row.encounter_id) if row.encounter_id else None,
        "study_code": row.study_code,
        "status": row.status,
        "report_text": row.report_text,
        "pacs_link": row.pacs_link,
        "critical_flag": row.critical_flag,
        "scheduled_at": row.scheduled_at,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def serialize_pharmacy_dispense(row: m.PharmacyDispense) -> dict:
    return {
        "id": str(row.id),
        "dispense_no": row.dispense_no,
        "patient_id": str(row.patient_id),
        "prescription_id": str(row.prescription_id) if row.prescription_id else None,
        "prescription_line_id": str(row.prescription_line_id) if row.prescription_line_id else None,
        "encounter_id": str(row.encounter_id) if row.encounter_id else None,
        "medicine_code": row.medicine_code,
        "qty": float(row.qty or 0),
        "status": row.status,
        "substitution_code": row.substitution_code,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def serialize_nursing_task(row: m.NursingTask) -> dict:
    return {
        "id": str(row.id),
        "patient_id": str(row.patient_id),
        "admission_id": str(row.admission_id) if row.admission_id else None,
        "task_type": row.task_type,
        "description": row.description,
        "status": row.status,
        "due_at": row.due_at,
        "completed_at": row.completed_at,
        "assigned_to": str(row.assigned_to) if row.assigned_to else None,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


# ── Lab orders ──

def list_lab_orders(
    db: Session, tenant_id: UUID, *, status: Optional[str] = None, patient_id: Optional[UUID] = None
) -> list[m.LabOrder]:
    q = db.query(m.LabOrder).filter(m.LabOrder.tenant_id == tenant_id, m.LabOrder.is_deleted == False)
    if status:
        q = q.filter(m.LabOrder.status == status)
    if patient_id:
        q = q.filter(m.LabOrder.patient_id == patient_id)
    return q.order_by(m.LabOrder.created_at.desc()).limit(200).all()


def get_lab_order(db: Session, tenant_id: UUID, order_id: UUID) -> m.LabOrder:
    row = db.query(m.LabOrder).filter(
        m.LabOrder.id == order_id, m.LabOrder.tenant_id == tenant_id, m.LabOrder.is_deleted == False
    ).first()
    if not row:
        raise HTTPException(404, "Lab order not found")
    return row


def create_lab_order(
    db: Session,
    *,
    tenant_id: UUID,
    patient_id: UUID,
    test_code: str,
    actor_id: UUID,
    encounter_id: Optional[UUID] = None,
    provider_id: Optional[UUID] = None,
    correlation_id: Optional[str] = None,
) -> m.LabOrder:
    _patient_or_404(db, tenant_id, patient_id)
    test = db.query(m.LabTest).filter(
        m.LabTest.tenant_id == tenant_id, m.LabTest.code == test_code, m.LabTest.is_deleted == False
    ).first()
    if not test:
        raise HTTPException(400, "Unknown test — select from lab test master")
    if encounter_id:
        enc = db.query(m.Encounter).filter(
            m.Encounter.id == encounter_id, m.Encounter.tenant_id == tenant_id
        ).first()
        if not enc:
            raise HTTPException(400, "Encounter not found")
    row = m.LabOrder(
        tenant_id=tenant_id,
        patient_id=patient_id,
        provider_id=provider_id,
        encounter_id=encounter_id,
        order_no=_next_no(db, tenant_id, m.LabOrder, "LAB"),
        test_code=test_code,
        status="ordered",
        created_by=actor_id,
        updated_by=actor_id,
        correlation_id=correlation_id,
    )
    db.add(row)
    write_audit(
        db, tenant_id=tenant_id, actor_user_id=actor_id, action="CREATE",
        entity_type="lab_order", entity_id=None,
        new_values={"order_no": row.order_no, "test_code": test_code, "patient_id": str(patient_id)},
        correlation_id=correlation_id,
    )
    return row


def transition_lab_order_status(
    db: Session,
    row: m.LabOrder,
    status: str,
    actor_id: UUID,
    correlation_id: Optional[str] = None,
) -> m.LabOrder:
    if status not in LAB_STATUSES:
        raise HTTPException(400, f"Invalid status. Choose from: {LAB_STATUSES}")
    _assert_transition(row.status, status, LAB_TRANSITIONS, "lab order")
    old = row.status
    row.status = status
    if status == "critical_alert":
        row.critical_flag = True
    row.updated_by = actor_id
    write_audit(
        db, tenant_id=row.tenant_id, actor_user_id=actor_id, action="STATUS_CHANGE",
        entity_type="lab_order", entity_id=str(row.id),
        old_values={"status": old}, new_values={"status": status},
        correlation_id=correlation_id,
    )
    return row


def enter_lab_results(
    db: Session,
    row: m.LabOrder,
    results: dict[str, Any],
    actor_id: UUID,
    *,
    result_value: Optional[str] = None,
    result_notes: Optional[str] = None,
    critical_flag: bool = False,
    correlation_id: Optional[str] = None,
) -> m.LabOrder:
    if row.status not in ("sample_collected", "result_entered"):
        raise HTTPException(400, "Results can only be entered after sample collection")
    row.results = {**(row.results or {}), **results}
    if result_value is not None:
        row.result_value = result_value
    if result_notes is not None:
        row.result_notes = result_notes
    row.critical_flag = critical_flag
    if row.status == "sample_collected":
        row.status = "result_entered"
    if critical_flag and row.status == "result_entered":
        row.status = "critical_alert"
    row.updated_by = actor_id
    write_audit(
        db, tenant_id=row.tenant_id, actor_user_id=actor_id, action="RESULTS_ENTERED",
        entity_type="lab_order", entity_id=str(row.id),
        new_values={"status": row.status, "critical_flag": critical_flag, "results_keys": list(results.keys())},
        correlation_id=correlation_id,
    )
    return row


# ── Radiology orders ──

def list_radiology_orders(
    db: Session, tenant_id: UUID, *, status: Optional[str] = None, patient_id: Optional[UUID] = None
) -> list[m.RadiologyOrder]:
    q = db.query(m.RadiologyOrder).filter(
        m.RadiologyOrder.tenant_id == tenant_id, m.RadiologyOrder.is_deleted == False
    )
    if status:
        q = q.filter(m.RadiologyOrder.status == status)
    if patient_id:
        q = q.filter(m.RadiologyOrder.patient_id == patient_id)
    return q.order_by(m.RadiologyOrder.created_at.desc()).limit(200).all()


def get_radiology_order(db: Session, tenant_id: UUID, order_id: UUID) -> m.RadiologyOrder:
    row = db.query(m.RadiologyOrder).filter(
        m.RadiologyOrder.id == order_id,
        m.RadiologyOrder.tenant_id == tenant_id,
        m.RadiologyOrder.is_deleted == False,
    ).first()
    if not row:
        raise HTTPException(404, "Radiology order not found")
    return row


def create_radiology_order(
    db: Session,
    *,
    tenant_id: UUID,
    patient_id: UUID,
    study_code: str,
    actor_id: UUID,
    encounter_id: Optional[UUID] = None,
    provider_id: Optional[UUID] = None,
    scheduled_at: Optional[datetime] = None,
    correlation_id: Optional[str] = None,
) -> m.RadiologyOrder:
    _patient_or_404(db, tenant_id, patient_id)
    row = m.RadiologyOrder(
        tenant_id=tenant_id,
        patient_id=patient_id,
        provider_id=provider_id,
        encounter_id=encounter_id,
        order_no=_next_no(db, tenant_id, m.RadiologyOrder, "RAD"),
        study_code=study_code,
        status="scheduled" if scheduled_at else "ordered",
        scheduled_at=scheduled_at,
        created_by=actor_id,
        updated_by=actor_id,
        correlation_id=correlation_id,
    )
    db.add(row)
    write_audit(
        db, tenant_id=tenant_id, actor_user_id=actor_id, action="CREATE",
        entity_type="radiology_order", entity_id=None,
        new_values={"order_no": row.order_no, "study_code": study_code},
        correlation_id=correlation_id,
    )
    return row


def update_radiology_order(
    db: Session,
    row: m.RadiologyOrder,
    actor_id: UUID,
    *,
    study_code: Optional[str] = None,
    report_text: Optional[str] = None,
    pacs_link: Optional[str] = None,
    scheduled_at: Optional[datetime] = None,
    correlation_id: Optional[str] = None,
) -> m.RadiologyOrder:
    if study_code is not None:
        row.study_code = study_code
    if report_text is not None:
        row.report_text = report_text
    if pacs_link is not None:
        row.pacs_link = pacs_link
    if scheduled_at is not None:
        row.scheduled_at = scheduled_at
    row.updated_by = actor_id
    write_audit(
        db, tenant_id=row.tenant_id, actor_user_id=actor_id, action="UPDATE",
        entity_type="radiology_order", entity_id=str(row.id),
        new_values={"study_code": row.study_code},
        correlation_id=correlation_id,
    )
    return row


def transition_radiology_status(
    db: Session,
    row: m.RadiologyOrder,
    status: str,
    actor_id: UUID,
    *,
    report_text: Optional[str] = None,
    pacs_link: Optional[str] = None,
    critical_flag: bool = False,
    correlation_id: Optional[str] = None,
) -> m.RadiologyOrder:
    if status not in RADIOLOGY_STATUSES:
        raise HTTPException(400, f"Invalid status. Choose from: {RADIOLOGY_STATUSES}")
    _assert_transition(row.status, status, RADIOLOGY_TRANSITIONS, "radiology order")
    old = row.status
    row.status = status
    if report_text is not None:
        row.report_text = report_text
    if pacs_link is not None:
        row.pacs_link = pacs_link
    if status == "critical" or critical_flag:
        row.critical_flag = True
        row.status = "critical"
    row.updated_by = actor_id
    write_audit(
        db, tenant_id=row.tenant_id, actor_user_id=actor_id, action="STATUS_CHANGE",
        entity_type="radiology_order", entity_id=str(row.id),
        old_values={"status": old}, new_values={"status": row.status, "critical_flag": row.critical_flag},
        correlation_id=correlation_id,
    )
    return row


def soft_delete_radiology_order(
    db: Session, row: m.RadiologyOrder, actor_id: UUID, correlation_id: Optional[str] = None
):
    row.is_deleted = True
    row.updated_by = actor_id
    write_audit(
        db, tenant_id=row.tenant_id, actor_user_id=actor_id, action="DELETE",
        entity_type="radiology_order", entity_id=str(row.id),
        correlation_id=correlation_id,
    )


# ── Pharmacy dispense ──

def list_pharmacy_dispenses(
    db: Session, tenant_id: UUID, *, status: Optional[str] = None, patient_id: Optional[UUID] = None
) -> list[m.PharmacyDispense]:
    q = db.query(m.PharmacyDispense).filter(
        m.PharmacyDispense.tenant_id == tenant_id, m.PharmacyDispense.is_deleted == False
    )
    if status:
        q = q.filter(m.PharmacyDispense.status == status)
    if patient_id:
        q = q.filter(m.PharmacyDispense.patient_id == patient_id)
    return q.order_by(m.PharmacyDispense.created_at.desc()).limit(200).all()


def get_pharmacy_dispense(db: Session, tenant_id: UUID, dispense_id: UUID) -> m.PharmacyDispense:
    row = db.query(m.PharmacyDispense).filter(
        m.PharmacyDispense.id == dispense_id,
        m.PharmacyDispense.tenant_id == tenant_id,
        m.PharmacyDispense.is_deleted == False,
    ).first()
    if not row:
        raise HTTPException(404, "Pharmacy dispense not found")
    return row


def create_pharmacy_dispense(
    db: Session,
    *,
    tenant_id: UUID,
    patient_id: UUID,
    medicine_code: str,
    qty: Decimal,
    actor_id: UUID,
    prescription_id: Optional[UUID] = None,
    prescription_line_id: Optional[UUID] = None,
    encounter_id: Optional[UUID] = None,
    substitution_code: Optional[str] = None,
    correlation_id: Optional[str] = None,
) -> m.PharmacyDispense:
    _patient_or_404(db, tenant_id, patient_id)
    med = _medicine_or_400(db, tenant_id, medicine_code)
    check_medicine_stock(med, qty)

    if prescription_id:
        rx = db.query(m.Prescription).filter(
            m.Prescription.id == prescription_id,
            m.Prescription.tenant_id == tenant_id,
            m.Prescription.is_deleted == False,
        ).first()
        if not rx:
            raise HTTPException(400, "Prescription not found")
        patient_id = rx.patient_id
        encounter_id = encounter_id or rx.encounter_id
        if prescription_line_id:
            line = db.query(m.PrescriptionLine).filter(
                m.PrescriptionLine.id == prescription_line_id,
                m.PrescriptionLine.prescription_id == prescription_id,
            ).first()
            if not line:
                raise HTTPException(400, "Prescription line not found")
            medicine_code = line.medicine_code

    row = m.PharmacyDispense(
        tenant_id=tenant_id,
        prescription_id=prescription_id,
        prescription_line_id=prescription_line_id,
        encounter_id=encounter_id,
        patient_id=patient_id,
        dispense_no=_next_no(db, tenant_id, m.PharmacyDispense, "RX"),
        medicine_code=medicine_code,
        qty=qty,
        status="queued",
        substitution_code=substitution_code,
        created_by=actor_id,
        updated_by=actor_id,
        correlation_id=correlation_id,
    )
    db.add(row)
    write_audit(
        db, tenant_id=tenant_id, actor_user_id=actor_id, action="CREATE",
        entity_type="pharmacy_dispense", entity_id=None,
        new_values={"dispense_no": row.dispense_no, "medicine_code": medicine_code, "qty": float(qty)},
        correlation_id=correlation_id,
    )
    return row


def create_dispenses_from_prescription(
    db: Session,
    *,
    tenant_id: UUID,
    prescription_id: UUID,
    actor_id: UUID,
    correlation_id: Optional[str] = None,
) -> list[m.PharmacyDispense]:
    rx = db.query(m.Prescription).filter(
        m.Prescription.id == prescription_id,
        m.Prescription.tenant_id == tenant_id,
        m.Prescription.is_deleted == False,
    ).first()
    if not rx:
        raise HTTPException(404, "Prescription not found")
    lines = db.query(m.PrescriptionLine).filter(
        m.PrescriptionLine.prescription_id == prescription_id,
        m.PrescriptionLine.tenant_id == tenant_id,
    ).all()
    if not lines:
        raise HTTPException(400, "Prescription has no lines")
    rows = []
    for line in lines:
        row = create_pharmacy_dispense(
            db,
            tenant_id=tenant_id,
            patient_id=rx.patient_id,
            medicine_code=line.medicine_code,
            qty=Decimal("1"),
            actor_id=actor_id,
            prescription_id=prescription_id,
            prescription_line_id=line.id,
            encounter_id=rx.encounter_id,
            correlation_id=correlation_id,
        )
        rows.append(row)
    return rows


def transition_pharmacy_status(
    db: Session,
    row: m.PharmacyDispense,
    status: str,
    actor_id: UUID,
    correlation_id: Optional[str] = None,
) -> m.PharmacyDispense:
    if status not in DISPENSE_STATUSES:
        raise HTTPException(400, f"Invalid status. Choose from: {DISPENSE_STATUSES}")
    current = "queued" if row.status == "pending" else row.status
    _assert_transition(current, status, DISPENSE_TRANSITIONS, "pharmacy dispense")

    if status == "dispensed":
        med = _medicine_or_400(db, row.tenant_id, row.medicine_code)
        check_medicine_stock(med, Decimal(str(row.qty or 0)))
        med.stock_qty = Decimal(str(med.stock_qty or 0)) - Decimal(str(row.qty or 0))
        med.updated_by = actor_id

    old = row.status
    row.status = status
    row.updated_by = actor_id

    if status == "dispensed" and row.prescription_id:
        rx = db.query(m.Prescription).filter(m.Prescription.id == row.prescription_id).first()
        if rx:
            line_count = db.query(m.PrescriptionLine).filter(
                m.PrescriptionLine.prescription_id == rx.id
            ).count()
            dispensed = db.query(m.PharmacyDispense).filter(
                m.PharmacyDispense.prescription_id == rx.id,
                m.PharmacyDispense.status == "dispensed",
                m.PharmacyDispense.is_deleted == False,
            ).count()
            rx.status = "dispensed" if dispensed >= line_count else "partial"
            rx.updated_by = actor_id
    write_audit(
        db, tenant_id=row.tenant_id, actor_user_id=actor_id, action="STATUS_CHANGE",
        entity_type="pharmacy_dispense", entity_id=str(row.id),
        old_values={"status": old}, new_values={"status": status},
        correlation_id=correlation_id,
    )
    return row


# ── Nursing tasks ──

def list_nursing_tasks(
    db: Session,
    tenant_id: UUID,
    *,
    status: Optional[str] = None,
    patient_id: Optional[UUID] = None,
    admission_id: Optional[UUID] = None,
) -> list[m.NursingTask]:
    q = db.query(m.NursingTask).filter(
        m.NursingTask.tenant_id == tenant_id, m.NursingTask.is_deleted == False
    )
    if status:
        q = q.filter(m.NursingTask.status == status)
    if patient_id:
        q = q.filter(m.NursingTask.patient_id == patient_id)
    if admission_id:
        q = q.filter(m.NursingTask.admission_id == admission_id)
    return q.order_by(m.NursingTask.due_at.asc(), m.NursingTask.created_at.desc()).limit(200).all()


def get_nursing_task(db: Session, tenant_id: UUID, task_id: UUID) -> m.NursingTask:
    row = db.query(m.NursingTask).filter(
        m.NursingTask.id == task_id,
        m.NursingTask.tenant_id == tenant_id,
        m.NursingTask.is_deleted == False,
    ).first()
    if not row:
        raise HTTPException(404, "Nursing task not found")
    return row


def create_nursing_task(
    db: Session,
    *,
    tenant_id: UUID,
    patient_id: UUID,
    task_type: str,
    actor_id: UUID,
    admission_id: Optional[UUID] = None,
    description: Optional[str] = None,
    due_at: Optional[datetime] = None,
    assigned_to: Optional[UUID] = None,
    correlation_id: Optional[str] = None,
) -> m.NursingTask:
    _patient_or_404(db, tenant_id, patient_id)
    if admission_id:
        adm = db.query(m.IpdAdmission).filter(
            m.IpdAdmission.id == admission_id, m.IpdAdmission.tenant_id == tenant_id
        ).first()
        if not adm:
            raise HTTPException(400, "Admission not found")
    row = m.NursingTask(
        tenant_id=tenant_id,
        patient_id=patient_id,
        admission_id=admission_id,
        task_type=task_type,
        description=description,
        status="pending",
        due_at=due_at,
        assigned_to=assigned_to,
        created_by=actor_id,
        updated_by=actor_id,
        correlation_id=correlation_id,
    )
    db.add(row)
    write_audit(
        db, tenant_id=tenant_id, actor_user_id=actor_id, action="CREATE",
        entity_type="nursing_task", entity_id=None,
        new_values={"task_type": task_type, "patient_id": str(patient_id)},
        correlation_id=correlation_id,
    )
    return row


def update_nursing_task(
    db: Session,
    row: m.NursingTask,
    actor_id: UUID,
    *,
    task_type: Optional[str] = None,
    description: Optional[str] = None,
    due_at: Optional[datetime] = None,
    assigned_to: Optional[UUID] = None,
    correlation_id: Optional[str] = None,
) -> m.NursingTask:
    if task_type is not None:
        row.task_type = task_type
    if description is not None:
        row.description = description
    if due_at is not None:
        row.due_at = due_at
    if assigned_to is not None:
        row.assigned_to = assigned_to
    row.updated_by = actor_id
    write_audit(
        db, tenant_id=row.tenant_id, actor_user_id=actor_id, action="UPDATE",
        entity_type="nursing_task", entity_id=str(row.id),
        correlation_id=correlation_id,
    )
    return row


def transition_nursing_status(
    db: Session,
    row: m.NursingTask,
    status: str,
    actor_id: UUID,
    correlation_id: Optional[str] = None,
) -> m.NursingTask:
    if status not in NURSING_STATUSES:
        raise HTTPException(400, f"Invalid status. Choose from: {NURSING_STATUSES}")
    _assert_transition(row.status, status, NURSING_TRANSITIONS, "nursing task")
    old = row.status
    row.status = status
    if status == "completed":
        row.completed_at = datetime.now(timezone.utc)
    row.updated_by = actor_id
    write_audit(
        db, tenant_id=row.tenant_id, actor_user_id=actor_id, action="STATUS_CHANGE",
        entity_type="nursing_task", entity_id=str(row.id),
        old_values={"status": old}, new_values={"status": status},
        correlation_id=correlation_id,
    )
    return row


def soft_delete_nursing_task(
    db: Session, row: m.NursingTask, actor_id: UUID, correlation_id: Optional[str] = None
):
    row.is_deleted = True
    row.updated_by = actor_id
    write_audit(
        db, tenant_id=row.tenant_id, actor_user_id=actor_id, action="DELETE",
        entity_type="nursing_task", entity_id=str(row.id),
        correlation_id=correlation_id,
    )

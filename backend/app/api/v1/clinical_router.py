"""Dedicated clinical domain APIs — lab, radiology, pharmacy, nursing."""
from datetime import datetime
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.deps import AuthContext, require_tenant
from app.db.session import get_db
from app.models import entities as m
from app.services import clinical_domains as clinical
from app.services.pagination import page_response

router = APIRouter(prefix="/clinical", tags=["clinical"])


# ── Request models ──

class LabOrderCreate(BaseModel):
    patient_id: UUID
    test_code: str
    encounter_id: Optional[UUID] = None
    provider_id: Optional[UUID] = None


class LabResultsPayload(BaseModel):
    results: dict[str, Any] = Field(default_factory=dict)
    result_value: Optional[str] = None
    result_notes: Optional[str] = None
    critical_flag: bool = False


class RadiologyOrderCreate(BaseModel):
    patient_id: UUID
    study_code: str
    encounter_id: Optional[UUID] = None
    provider_id: Optional[UUID] = None
    scheduled_at: Optional[datetime] = None


class RadiologyOrderUpdate(BaseModel):
    study_code: Optional[str] = None
    report_text: Optional[str] = None
    pacs_link: Optional[str] = None
    scheduled_at: Optional[datetime] = None


class RadiologyStatusPayload(BaseModel):
    status: str
    report_text: Optional[str] = None
    pacs_link: Optional[str] = None
    critical_flag: bool = False


class PharmacyDispenseCreate(BaseModel):
    patient_id: UUID
    medicine_code: str
    qty: Decimal = Decimal("1")
    prescription_id: Optional[UUID] = None
    prescription_line_id: Optional[UUID] = None
    encounter_id: Optional[UUID] = None
    substitution_code: Optional[str] = None


class PrescriptionDispenseCreate(BaseModel):
    prescription_id: UUID


class NursingTaskCreate(BaseModel):
    patient_id: UUID
    task_type: str
    admission_id: Optional[UUID] = None
    description: Optional[str] = None
    due_at: Optional[datetime] = None
    assigned_to: Optional[UUID] = None


class NursingTaskUpdate(BaseModel):
    task_type: Optional[str] = None
    description: Optional[str] = None
    due_at: Optional[datetime] = None
    assigned_to: Optional[UUID] = None


# ── Lab orders ──

@router.get("/lab-orders")
def list_lab_orders(
    status: Optional[str] = None,
    patient_id: Optional[UUID] = None,
    query: str = "",
    page: int = 1,
    page_size: int = 25,
    ctx: AuthContext = Depends(require_tenant),
    db: Session = Depends(get_db),
):
    rows, total = clinical.list_lab_orders_paginated(
        db, ctx.tenant_id, status=status, patient_id=patient_id, query=query, page=page, page_size=page_size,
    )
    return page_response([clinical.serialize_lab_order(r) for r in rows], total, page, page_size)


@router.post("/lab-orders")
def create_lab_order(
    payload: LabOrderCreate,
    ctx: AuthContext = Depends(require_tenant),
    db: Session = Depends(get_db),
):
    row = clinical.create_lab_order(
        db,
        tenant_id=ctx.tenant_id,
        patient_id=payload.patient_id,
        test_code=payload.test_code,
        encounter_id=payload.encounter_id,
        provider_id=payload.provider_id,
        actor_id=ctx.user.id,
        correlation_id=ctx.correlation_id,
    )
    db.commit()
    db.refresh(row)
    return clinical.serialize_lab_order(row)


@router.get("/lab-orders/{order_id}")
def get_lab_order(
    order_id: UUID,
    ctx: AuthContext = Depends(require_tenant),
    db: Session = Depends(get_db),
):
    row = clinical.get_lab_order(db, ctx.tenant_id, order_id)
    return clinical.serialize_lab_order(row)


@router.patch("/lab-orders/{order_id}/status")
def update_lab_order_status(
    order_id: UUID,
    status: str = Query(...),
    ctx: AuthContext = Depends(require_tenant),
    db: Session = Depends(get_db),
):
    row = clinical.get_lab_order(db, ctx.tenant_id, order_id)
    clinical.transition_lab_order_status(
        db, row, status, ctx.user.id, correlation_id=ctx.correlation_id
    )
    db.commit()
    db.refresh(row)
    return clinical.serialize_lab_order(row)


@router.post("/lab-orders/{order_id}/results")
def enter_lab_results(
    order_id: UUID,
    payload: LabResultsPayload,
    ctx: AuthContext = Depends(require_tenant),
    db: Session = Depends(get_db),
):
    row = clinical.get_lab_order(db, ctx.tenant_id, order_id)
    clinical.enter_lab_results(
        db, row, payload.results, ctx.user.id,
        result_value=payload.result_value,
        result_notes=payload.result_notes,
        critical_flag=payload.critical_flag,
        correlation_id=ctx.correlation_id,
    )
    db.commit()
    db.refresh(row)
    return clinical.serialize_lab_order(row)


# ── Radiology orders ──

@router.get("/radiology-orders")
def list_radiology_orders(
    status: Optional[str] = None,
    patient_id: Optional[UUID] = None,
    query: str = "",
    page: int = 1,
    page_size: int = 25,
    ctx: AuthContext = Depends(require_tenant),
    db: Session = Depends(get_db),
):
    rows, total = clinical.list_radiology_orders_paginated(
        db, ctx.tenant_id, status=status, patient_id=patient_id, query=query, page=page, page_size=page_size,
    )
    return page_response([clinical.serialize_radiology_order(r) for r in rows], total, page, page_size)


@router.post("/radiology-orders")
def create_radiology_order(
    payload: RadiologyOrderCreate,
    ctx: AuthContext = Depends(require_tenant),
    db: Session = Depends(get_db),
):
    row = clinical.create_radiology_order(
        db,
        tenant_id=ctx.tenant_id,
        patient_id=payload.patient_id,
        study_code=payload.study_code,
        encounter_id=payload.encounter_id,
        provider_id=payload.provider_id,
        scheduled_at=payload.scheduled_at,
        actor_id=ctx.user.id,
        correlation_id=ctx.correlation_id,
    )
    db.commit()
    db.refresh(row)
    return clinical.serialize_radiology_order(row)


@router.get("/radiology-orders/{order_id}")
def get_radiology_order(
    order_id: UUID,
    ctx: AuthContext = Depends(require_tenant),
    db: Session = Depends(get_db),
):
    row = clinical.get_radiology_order(db, ctx.tenant_id, order_id)
    return clinical.serialize_radiology_order(row)


@router.patch("/radiology-orders/{order_id}")
def patch_radiology_order(
    order_id: UUID,
    payload: RadiologyOrderUpdate,
    ctx: AuthContext = Depends(require_tenant),
    db: Session = Depends(get_db),
):
    row = clinical.get_radiology_order(db, ctx.tenant_id, order_id)
    clinical.update_radiology_order(
        db, row, ctx.user.id,
        study_code=payload.study_code,
        report_text=payload.report_text,
        pacs_link=payload.pacs_link,
        scheduled_at=payload.scheduled_at,
        correlation_id=ctx.correlation_id,
    )
    db.commit()
    db.refresh(row)
    return clinical.serialize_radiology_order(row)


@router.patch("/radiology-orders/{order_id}/status")
def update_radiology_status(
    order_id: UUID,
    payload: RadiologyStatusPayload,
    ctx: AuthContext = Depends(require_tenant),
    db: Session = Depends(get_db),
):
    row = clinical.get_radiology_order(db, ctx.tenant_id, order_id)
    clinical.transition_radiology_status(
        db, row, payload.status, ctx.user.id,
        report_text=payload.report_text,
        pacs_link=payload.pacs_link,
        critical_flag=payload.critical_flag,
        correlation_id=ctx.correlation_id,
    )
    db.commit()
    db.refresh(row)
    return clinical.serialize_radiology_order(row)


@router.delete("/radiology-orders/{order_id}")
def delete_radiology_order(
    order_id: UUID,
    ctx: AuthContext = Depends(require_tenant),
    db: Session = Depends(get_db),
):
    row = clinical.get_radiology_order(db, ctx.tenant_id, order_id)
    clinical.soft_delete_radiology_order(db, row, ctx.user.id, correlation_id=ctx.correlation_id)
    db.commit()
    return {"deleted": True, "id": str(order_id)}


# ── Prescription queue (pharmacy workflow helper) ──

def _serialize_prescription_queue(rx: m.Prescription, db: Session, tenant_id) -> dict:
    lines = db.query(m.PrescriptionLine).filter(m.PrescriptionLine.prescription_id == rx.id).all()
    dispensed = db.query(m.PharmacyDispense).filter(
        m.PharmacyDispense.tenant_id == tenant_id,
        m.PharmacyDispense.prescription_id == rx.id,
        m.PharmacyDispense.status == "dispensed",
        m.PharmacyDispense.is_deleted == False,
    ).count()
    return {
        "id": str(rx.id),
        "patient_id": str(rx.patient_id),
        "encounter_id": str(rx.encounter_id),
        "status": rx.status,
        "notes": rx.notes,
        "lines": [
            {
                "id": str(ln.id),
                "medicine_code": ln.medicine_code,
                "medicine_name": ln.medicine_name,
                "dose": ln.dose,
                "frequency": ln.frequency,
                "duration": ln.duration,
            }
            for ln in lines
        ],
        "dispensed_count": dispensed,
        "line_count": len(lines),
    }


@router.get("/prescriptions")
def list_prescription_queue(ctx: AuthContext = Depends(require_tenant), db: Session = Depends(get_db)):
    rows = db.query(m.Prescription).filter(
        m.Prescription.tenant_id == ctx.tenant_id,
        m.Prescription.is_deleted == False,
        m.Prescription.status.in_(["issued", "partial"]),
    ).order_by(m.Prescription.created_at.desc()).all()
    return [_serialize_prescription_queue(r, db, ctx.tenant_id) for r in rows]


# ── Pharmacy dispense ──

@router.get("/pharmacy-dispenses")
def list_pharmacy_dispenses(
    status: Optional[str] = None,
    patient_id: Optional[UUID] = None,
    query: str = "",
    page: int = 1,
    page_size: int = 25,
    ctx: AuthContext = Depends(require_tenant),
    db: Session = Depends(get_db),
):
    rows, total = clinical.list_pharmacy_dispenses_paginated(
        db, ctx.tenant_id, status=status, patient_id=patient_id, query=query, page=page, page_size=page_size,
    )
    return page_response([clinical.serialize_pharmacy_dispense(r) for r in rows], total, page, page_size)


@router.post("/pharmacy-dispenses")
def create_pharmacy_dispense(
    payload: PharmacyDispenseCreate,
    ctx: AuthContext = Depends(require_tenant),
    db: Session = Depends(get_db),
):
    row = clinical.create_pharmacy_dispense(
        db,
        tenant_id=ctx.tenant_id,
        patient_id=payload.patient_id,
        medicine_code=payload.medicine_code,
        qty=payload.qty,
        prescription_id=payload.prescription_id,
        prescription_line_id=payload.prescription_line_id,
        encounter_id=payload.encounter_id,
        substitution_code=payload.substitution_code,
        actor_id=ctx.user.id,
        correlation_id=ctx.correlation_id,
    )
    db.commit()
    db.refresh(row)
    return clinical.serialize_pharmacy_dispense(row)


@router.post("/pharmacy-dispenses/from-prescription")
def dispense_from_prescription(
    payload: PrescriptionDispenseCreate,
    ctx: AuthContext = Depends(require_tenant),
    db: Session = Depends(get_db),
):
    rows = clinical.create_dispenses_from_prescription(
        db,
        tenant_id=ctx.tenant_id,
        prescription_id=payload.prescription_id,
        actor_id=ctx.user.id,
        correlation_id=ctx.correlation_id,
    )
    db.commit()
    for r in rows:
        db.refresh(r)
    return [clinical.serialize_pharmacy_dispense(r) for r in rows]


@router.get("/pharmacy-dispenses/{dispense_id}")
def get_pharmacy_dispense(
    dispense_id: UUID,
    ctx: AuthContext = Depends(require_tenant),
    db: Session = Depends(get_db),
):
    row = clinical.get_pharmacy_dispense(db, ctx.tenant_id, dispense_id)
    return clinical.serialize_pharmacy_dispense(row)


@router.patch("/pharmacy-dispenses/{dispense_id}/status")
def update_pharmacy_status(
    dispense_id: UUID,
    status: str = Query(...),
    ctx: AuthContext = Depends(require_tenant),
    db: Session = Depends(get_db),
):
    row = clinical.get_pharmacy_dispense(db, ctx.tenant_id, dispense_id)
    clinical.transition_pharmacy_status(
        db, row, status, ctx.user.id, correlation_id=ctx.correlation_id
    )
    db.commit()
    db.refresh(row)
    return clinical.serialize_pharmacy_dispense(row)


# ── Nursing tasks ──

@router.get("/nursing-tasks")
def list_nursing_tasks(
    status: Optional[str] = None,
    patient_id: Optional[UUID] = None,
    admission_id: Optional[UUID] = None,
    query: str = "",
    page: int = 1,
    page_size: int = 25,
    ctx: AuthContext = Depends(require_tenant),
    db: Session = Depends(get_db),
):
    rows, total = clinical.list_nursing_tasks_paginated(
        db, ctx.tenant_id, status=status, patient_id=patient_id, admission_id=admission_id,
        query=query, page=page, page_size=page_size,
    )
    return page_response([clinical.serialize_nursing_task(r) for r in rows], total, page, page_size)


@router.post("/nursing-tasks")
def create_nursing_task(
    payload: NursingTaskCreate,
    ctx: AuthContext = Depends(require_tenant),
    db: Session = Depends(get_db),
):
    row = clinical.create_nursing_task(
        db,
        tenant_id=ctx.tenant_id,
        patient_id=payload.patient_id,
        task_type=payload.task_type,
        admission_id=payload.admission_id,
        description=payload.description,
        due_at=payload.due_at,
        assigned_to=payload.assigned_to,
        actor_id=ctx.user.id,
        correlation_id=ctx.correlation_id,
    )
    db.commit()
    db.refresh(row)
    return clinical.serialize_nursing_task(row)


@router.get("/nursing-tasks/{task_id}")
def get_nursing_task(
    task_id: UUID,
    ctx: AuthContext = Depends(require_tenant),
    db: Session = Depends(get_db),
):
    row = clinical.get_nursing_task(db, ctx.tenant_id, task_id)
    return clinical.serialize_nursing_task(row)


@router.patch("/nursing-tasks/{task_id}")
def patch_nursing_task(
    task_id: UUID,
    payload: NursingTaskUpdate,
    ctx: AuthContext = Depends(require_tenant),
    db: Session = Depends(get_db),
):
    row = clinical.get_nursing_task(db, ctx.tenant_id, task_id)
    clinical.update_nursing_task(
        db, row, ctx.user.id,
        task_type=payload.task_type,
        description=payload.description,
        due_at=payload.due_at,
        assigned_to=payload.assigned_to,
        correlation_id=ctx.correlation_id,
    )
    db.commit()
    db.refresh(row)
    return clinical.serialize_nursing_task(row)


@router.patch("/nursing-tasks/{task_id}/status")
def update_nursing_status(
    task_id: UUID,
    status: str = Query(...),
    ctx: AuthContext = Depends(require_tenant),
    db: Session = Depends(get_db),
):
    row = clinical.get_nursing_task(db, ctx.tenant_id, task_id)
    clinical.transition_nursing_status(
        db, row, status, ctx.user.id, correlation_id=ctx.correlation_id
    )
    db.commit()
    db.refresh(row)
    return clinical.serialize_nursing_task(row)


@router.delete("/nursing-tasks/{task_id}")
def delete_nursing_task(
    task_id: UUID,
    ctx: AuthContext = Depends(require_tenant),
    db: Session = Depends(get_db),
):
    row = clinical.get_nursing_task(db, ctx.tenant_id, task_id)
    clinical.soft_delete_nursing_task(db, row, ctx.user.id, correlation_id=ctx.correlation_id)
    db.commit()
    return {"deleted": True, "id": str(task_id)}


@router.post("/lab-orders/export")
def export_lab_orders(
    format: str = Query("json", alias="format"),
    status: Optional[str] = None,
    query: str = "",
    ctx: AuthContext = Depends(require_tenant),
    db: Session = Depends(get_db),
):
    rows, _ = clinical.list_lab_orders_paginated(
        db, ctx.tenant_id, status=status, query=query, page=1, page_size=10000,
    )
    records = [clinical.serialize_lab_order(r) for r in rows]
    if format == "csv":
        from app.services.export_util import records_to_csv
        return {"format": "csv", "count": len(records), "csv": records_to_csv(records)}
    return {"format": "json", "count": len(records), "records": records}


@router.post("/radiology-orders/export")
def export_radiology_orders(
    format: str = Query("json", alias="format"),
    status: Optional[str] = None,
    query: str = "",
    ctx: AuthContext = Depends(require_tenant),
    db: Session = Depends(get_db),
):
    rows, _ = clinical.list_radiology_orders_paginated(
        db, ctx.tenant_id, status=status, query=query, page=1, page_size=10000,
    )
    records = [clinical.serialize_radiology_order(r) for r in rows]
    if format == "csv":
        from app.services.export_util import records_to_csv
        return {"format": "csv", "count": len(records), "csv": records_to_csv(records)}
    return {"format": "json", "count": len(records), "records": records}

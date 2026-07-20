from typing import Any, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.db.session import get_db
from app.core.deps import AuthContext, require_tenant, resolve_tenant_context, get_current_context, require_permission
from app.core.security import hash_password
from app.schemas.schemas import UserCreate
from app.models import entities as m
from app.services import modules as mod_svc
from app.services.pagination import paginate, page_response
from app.services.care_journey import discharge_ipd
from app.data.module_catalog import MODULE_CATALOG
from app.data.clinical_profiles import validate_clinical_profile
from app.data.slug_aliases import normalize_slug, SLUG_ALIASES
from app.api.v1.facility_router import serialize_bed, _ancestor, _location

router = APIRouter(tags=["modules"])

_CANONICAL_MODULES = {x["code"] for x in MODULE_CATALOG}
MODULE_CODES = set(_CANONICAL_MODULES) | set(SLUG_ALIASES.keys())
RESERVED = {
    "health", "auth", "super-admin", "admin", "masters", "patients", "providers",
    "appointments", "encounters", "telemedicine", "location", "billing", "audit",
    "dashboard", "platform", "modules", "clinical", "video", "docs", "openapi.json",
}


class ModuleRecordCreate(BaseModel):
    submodule: str
    title: str
    status: str = "draft"
    payload: dict[str, Any] = Field(default_factory=dict)
    branch_id: Optional[UUID] = None
    patient_id: Optional[UUID] = None
    provider_id: Optional[UUID] = None


class ModuleRecordUpdate(BaseModel):
    title: Optional[str] = None
    status: Optional[str] = None
    payload: Optional[dict[str, Any]] = None


class IpdAdmissionCreate(BaseModel):
    patient_id: UUID
    bed_id: UUID
    diagnosis_id: Optional[UUID] = None
    admission_profile: dict[str, Any] = Field(default_factory=dict)



def _serialize_record(r: m.ModuleRecord) -> dict:
    return {
        "id": str(r.id),
        "module_code": r.module_code,
        "submodule": r.submodule,
        "reference_no": r.reference_no,
        "title": r.title,
        "status": r.status,
        "payload": r.payload or {},
        "patient_id": str(r.patient_id) if r.patient_id else None,
        "provider_id": str(r.provider_id) if r.provider_id else None,
        "created_at": r.created_at,
        "updated_at": r.updated_at,
    }


def _validate_module(module_code: str):
    canonical = normalize_slug(module_code)
    if canonical not in _CANONICAL_MODULES:
        raise HTTPException(404, f"Unknown module: {module_code}")
    return canonical


@router.get("/platform/modules")
def list_platform_modules(ctx: AuthContext = Depends(get_current_context), db: Session = Depends(get_db)):
    rows = db.query(m.PlatformModule).filter(m.PlatformModule.active == True, m.PlatformModule.is_deleted == False).order_by(
        m.PlatformModule.category, m.PlatformModule.name
    ).all()
    if not rows:
        mod_svc.sync_platform_modules(db, ctx.user.id)
        db.commit()
        rows = db.query(m.PlatformModule).filter(m.PlatformModule.active == True).all()
    return [
        {
            "code": r.code,
            "name": r.name,
            "category": r.category,
            "route": r.route,
            "api_slug": r.api_slug,
            "submodules": r.submodules,
            "fields_schema": r.fields_schema,
            "statuses": r.statuses,
            "is_dedicated": r.is_dedicated,
        }
        for r in rows
    ]


@router.get("/platform/workflows")
def list_workflows(ctx: AuthContext = Depends(resolve_tenant_context), db: Session = Depends(get_db)):
    from app.data.hospital_workflows import HOSPITAL_WORKFLOWS
    return HOSPITAL_WORKFLOWS


@router.get("/platform/reports")
def list_reports(ctx: AuthContext = Depends(resolve_tenant_context), db: Session = Depends(get_db)):
    from app.services.reports import list_report_catalog
    return list_report_catalog()


@router.get("/platform/module-flow")
def get_module_flow(ctx: AuthContext = Depends(get_current_context)):
    from app.data.module_flow import build_module_flow_response
    from app.data.role_navigation import filter_module_flow
    raw = build_module_flow_response()
    return filter_module_flow(raw, ctx.role_code, ctx.user.is_super_admin)


@router.get("/platform/module-flow/{module_code}")
def get_module_flow_detail(module_code: str, ctx: AuthContext = Depends(get_current_context)):
    from app.data.module_flow import flow_for_module
    detail = flow_for_module(module_code)
    if not detail:
        raise HTTPException(404, "Module not in flow catalog")
    return detail


@router.get("/modules/{module_code}")
def list_module_records(
    module_code: str,
    query: str = "",
    status: Optional[str] = None,
    submodule: Optional[str] = None,
    page: int = 1,
    page_size: int = 25,
    ctx: AuthContext = Depends(resolve_tenant_context),
    db: Session = Depends(get_db),
):
    module_code = _validate_module(module_code)
    rows, total = mod_svc.list_records_paginated(
        db, ctx.tenant_id, module_code, query, status, submodule, page, page_size,
    )
    return page_response([_serialize_record(r) for r in rows], total, page, page_size)


@router.get("/modules/{module_code}/{record_id}")
def get_module_record(
    module_code: str,
    record_id: UUID,
    ctx: AuthContext = Depends(resolve_tenant_context),
    db: Session = Depends(get_db),
):
    module_code = _validate_module(module_code)
    row = mod_svc.get_record(db, ctx.tenant_id, module_code, record_id)
    if not row:
        raise HTTPException(404, "Record not found")
    return _serialize_record(row)


@router.post("/modules/{module_code}")
def create_module_record(
    module_code: str,
    payload: ModuleRecordCreate,
    ctx: AuthContext = Depends(resolve_tenant_context),
    db: Session = Depends(get_db),
):
    module_code = _validate_module(module_code)
    if payload.payload.get("action") == "export":
        rows = mod_svc.list_records(db, ctx.tenant_id, module_code)
        return mod_svc.export_records(rows)
    mod = db.query(m.PlatformModule).filter(m.PlatformModule.code == module_code).first()
    if mod and payload.submodule not in (mod.submodules or []):
        raise HTTPException(400, f"Invalid submodule. Choose from: {mod.submodules}")
    row = mod_svc.create_record(
        db, tenant_id=ctx.tenant_id, module_code=module_code,
        submodule=payload.submodule, title=payload.title, status=payload.status,
        payload=payload.payload, actor_id=ctx.user.id, branch_id=payload.branch_id or ctx.user.branch_id,
        patient_id=payload.patient_id, provider_id=payload.provider_id,
        correlation_id=ctx.correlation_id,
    )
    db.commit()
    db.refresh(row)
    return _serialize_record(row)


@router.patch("/modules/{module_code}/{record_id}/status")
def update_module_status(
    module_code: str,
    record_id: UUID,
    status: str = Query(...),
    ctx: AuthContext = Depends(resolve_tenant_context),
    db: Session = Depends(get_db),
):
    module_code = _validate_module(module_code)
    row = db.query(m.ModuleRecord).filter(
        m.ModuleRecord.id == record_id,
        m.ModuleRecord.tenant_id == ctx.tenant_id,
        m.ModuleRecord.module_code == module_code,
    ).first()
    if not row:
        raise HTTPException(404, "Record not found")
    mod_svc.update_record_status(db, row, status, ctx.user.id, ctx.correlation_id)
    db.commit()
    return _serialize_record(row)


@router.patch("/modules/{module_code}/{record_id}")
def patch_module_record(
    module_code: str,
    record_id: UUID,
    payload: ModuleRecordUpdate,
    ctx: AuthContext = Depends(resolve_tenant_context),
    db: Session = Depends(get_db),
):
    module_code = _validate_module(module_code)
    row = mod_svc.get_record(db, ctx.tenant_id, module_code, record_id)
    if not row:
        raise HTTPException(404, "Record not found")
    mod_svc.update_record(
        db, row, title=payload.title, status=payload.status, payload=payload.payload,
        actor_id=ctx.user.id, correlation_id=ctx.correlation_id,
    )
    db.commit()
    return _serialize_record(row)


@router.delete("/modules/{module_code}/{record_id}")
def delete_module_record(
    module_code: str,
    record_id: UUID,
    ctx: AuthContext = Depends(resolve_tenant_context),
    db: Session = Depends(get_db),
):
    module_code = _validate_module(module_code)
    row = mod_svc.get_record(db, ctx.tenant_id, module_code, record_id)
    if not row:
        raise HTTPException(404, "Record not found")
    mod_svc.soft_delete_record(db, row, ctx.user.id, ctx.correlation_id)
    db.commit()
    return {"deleted": True, "id": str(record_id)}


@router.post("/modules/{module_code}/{record_id}/approve")
def approve_module_record(
    module_code: str,
    record_id: UUID,
    ctx: AuthContext = Depends(resolve_tenant_context),
    db: Session = Depends(get_db),
):
    module_code = _validate_module(module_code)
    row = mod_svc.get_record(db, ctx.tenant_id, module_code, record_id)
    if not row:
        raise HTTPException(404, "Record not found")
    mod_svc.update_record_status(db, row, "approved", ctx.user.id, ctx.correlation_id)
    db.commit()
    return _serialize_record(row)


@router.post("/modules/{module_code}/{record_id}/reject")
def reject_module_record(
    module_code: str,
    record_id: UUID,
    ctx: AuthContext = Depends(resolve_tenant_context),
    db: Session = Depends(get_db),
):
    module_code = _validate_module(module_code)
    row = mod_svc.get_record(db, ctx.tenant_id, module_code, record_id)
    if not row:
        raise HTTPException(404, "Record not found")
    mod_svc.update_record_status(db, row, "rejected", ctx.user.id, ctx.correlation_id)
    db.commit()
    return _serialize_record(row)


@router.post("/modules/{module_code}/export")
def export_module_records(
    module_code: str,
    format: str = Query("json", alias="format"),
    submodule: Optional[str] = None,
    query: str = "",
    status: Optional[str] = None,
    ctx: AuthContext = Depends(resolve_tenant_context),
    db: Session = Depends(get_db),
):
    module_code = _validate_module(module_code)
    rows, _ = mod_svc.list_records_paginated(
        db, ctx.tenant_id, module_code, query, status, submodule, page=1, page_size=10000,
    )
    return mod_svc.export_records(rows, fmt=format)


@router.get("/{module_code}")
def api_backlog_list(
    module_code: str,
    query: str = "",
    page: int = 1,
    page_size: int = 25,
    ctx: AuthContext = Depends(resolve_tenant_context),
    db: Session = Depends(get_db),
):
    if module_code in RESERVED or module_code not in MODULE_CODES:
        raise HTTPException(404, "Not found")
    canonical = normalize_slug(module_code)
    rows, total = mod_svc.list_records_paginated(db, ctx.tenant_id, canonical, query, page=page, page_size=page_size)
    return page_response([_serialize_record(r) for r in rows], total, page, page_size)


@router.post("/{module_code}")
def api_backlog_create(module_code: str, payload: ModuleRecordCreate, ctx: AuthContext = Depends(resolve_tenant_context), db: Session = Depends(get_db)):
    if module_code in RESERVED or module_code not in MODULE_CODES:
        raise HTTPException(404, "Not found")
    canonical = normalize_slug(module_code)
    row = mod_svc.create_record(
        db, tenant_id=ctx.tenant_id, module_code=canonical,
        submodule=payload.submodule, title=payload.title, status=payload.status,
        payload=payload.payload, actor_id=ctx.user.id,
        correlation_id=ctx.correlation_id,
    )
    db.commit()
    db.refresh(row)
    return _serialize_record(row)


# ── Specialized clinical entities (IPD, claims; domain APIs → clinical_router) ──

@router.get("/clinical/ipd-admissions")
def list_ipd(ctx: AuthContext = Depends(resolve_tenant_context), db: Session = Depends(get_db)):
    rows = db.query(m.IpdAdmission).filter(m.IpdAdmission.tenant_id == ctx.tenant_id).all()
    return [{"id": str(r.id), "admission_no": r.admission_no,
             "bed_id": str(r.bed_id) if r.bed_id else None, "bed_code": r.bed_code,
             "ward_id": str(r.ward_id) if r.ward_id else None,
             "ward_code": r.ward_code, "diagnosis_code": r.diagnosis_code, "status": r.status,
             "patient_id": str(r.patient_id), "admission_profile": r.admission_profile or {}} for r in rows]


@router.post("/clinical/ipd-admissions")
def admit_ipd(
    payload: IpdAdmissionCreate,
    ctx: AuthContext = Depends(resolve_tenant_context),
    db: Session = Depends(get_db),
):
    profile = validate_clinical_profile("ipd", payload.admission_profile)
    patient = db.query(m.Patient).filter(
        m.Patient.id == payload.patient_id, m.Patient.tenant_id == ctx.tenant_id,
        m.Patient.is_deleted == False,
    ).first()
    if not patient:
        raise HTTPException(400, "Select a valid patient")
    bed = db.query(m.Bed).filter(
        m.Bed.id == payload.bed_id, m.Bed.tenant_id == ctx.tenant_id,
        m.Bed.is_deleted == False, m.Bed.status == "available",
    ).first()
    if not bed:
        raise HTTPException(400, "Selected bed is not available")
    if not bed.room_id:
        raise HTTPException(400, "Bed must be linked to a room master before admission")
    room = _location(db, ctx.tenant_id, bed.room_id, expected_type="room")
    ward = _ancestor(db, ctx.tenant_id, room, "ward")
    if not ward:
        raise HTTPException(400, "Bed room must be linked through the facility hierarchy to a ward")
    diagnosis = None
    if payload.diagnosis_id:
        diagnosis = db.query(m.Disease).filter(
            m.Disease.id == payload.diagnosis_id,
            or_(m.Disease.tenant_id == ctx.tenant_id, m.Disease.tenant_id.is_(None)),
            m.Disease.is_deleted == False,
        ).first()
        if not diagnosis:
            raise HTTPException(400, "Select a valid diagnosis master")
    n = db.query(m.IpdAdmission).filter(m.IpdAdmission.tenant_id == ctx.tenant_id).count() + 1
    row = m.IpdAdmission(
        tenant_id=ctx.tenant_id, patient_id=payload.patient_id, admission_no=f"IPD-{n:06d}",
        bed_id=bed.id, ward_id=ward.id, bed_code=bed.bed_code, ward_code=ward.code,
        diagnosis_code=(diagnosis.icd_code or diagnosis.code) if diagnosis else None,
        admission_profile=profile,
        created_by=ctx.user.id, updated_by=ctx.user.id,
    )
    bed.status = "occupied"
    db.add(row)
    db.commit()
    return {"id": str(row.id), "admission_no": row.admission_no}


@router.post("/clinical/ipd-admissions/{admission_id}/discharge")
def discharge_ipd_admission(
    admission_id: UUID,
    ctx: AuthContext = Depends(resolve_tenant_context),
    db: Session = Depends(get_db),
):
    tenant = db.query(m.Tenant).filter(m.Tenant.id == ctx.tenant_id).first()
    result = discharge_ipd(
        db, tenant_id=ctx.tenant_id, tenant_code=tenant.tenant_code if tenant else "TENANT",
        admission_id=admission_id, actor_id=ctx.user.id, correlation_id=ctx.correlation_id,
    )
    db.commit()
    return result


def _serialize_claim(r: m.InsuranceClaim) -> dict:
    return {
        "id": str(r.id),
        "claim_no": r.claim_no,
        "payer_code": r.payer_code,
        "status": r.status,
        "amount": float(r.amount or 0),
        "patient_id": str(r.patient_id),
        "policy_no": r.policy_no,
    }


@router.get("/clinical/insurance-claims")
def list_claims(ctx: AuthContext = Depends(resolve_tenant_context), db: Session = Depends(get_db)):
    rows = db.query(m.InsuranceClaim).filter(m.InsuranceClaim.tenant_id == ctx.tenant_id).order_by(m.InsuranceClaim.created_at.desc()).all()
    return [_serialize_claim(r) for r in rows]


@router.post("/clinical/insurance-claims")
def create_claim(
    patient_id: UUID,
    payer_code: str,
    amount: float,
    policy_no: str = "",
    ctx: AuthContext = Depends(resolve_tenant_context),
    db: Session = Depends(get_db),
):
    payer = db.query(m.InsurancePayer).filter(m.InsurancePayer.tenant_id == ctx.tenant_id, m.InsurancePayer.code == payer_code).first()
    if not payer:
        raise HTTPException(400, "Unknown payer — configure insurance payer master")
    n = db.query(m.InsuranceClaim).filter(m.InsuranceClaim.tenant_id == ctx.tenant_id).count() + 1
    row = m.InsuranceClaim(
        tenant_id=ctx.tenant_id, patient_id=patient_id, payer_code=payer_code,
        claim_no=f"CLM-{n:06d}", amount=amount, policy_no=policy_no,
        created_by=ctx.user.id, updated_by=ctx.user.id,
    )
    db.add(row)
    db.commit()
    return _serialize_claim(row)


@router.patch("/clinical/insurance-claims/{claim_id}/status")
def update_claim_status(
    claim_id: UUID,
    status: str = Query(...),
    ctx: AuthContext = Depends(resolve_tenant_context),
    db: Session = Depends(get_db),
):
    row = db.query(m.InsuranceClaim).filter(
        m.InsuranceClaim.id == claim_id, m.InsuranceClaim.tenant_id == ctx.tenant_id
    ).first()
    if not row:
        raise HTTPException(404, "Claim not found")
    allowed = {"draft", "submitted", "under_review", "approved", "denied", "paid"}
    if status not in allowed:
        raise HTTPException(400, f"Invalid status. Use: {sorted(allowed)}")
    row.status = status
    row.updated_by = ctx.user.id
    db.commit()
    return _serialize_claim(row)


@router.get("/admin/users")
def list_users(ctx: AuthContext = Depends(resolve_tenant_context), db: Session = Depends(get_db)):
    rows = db.query(m.User).filter(m.User.tenant_id == ctx.tenant_id, m.User.is_deleted == False).all()
    return [{"id": str(r.id), "email": r.email, "full_name": r.full_name, "role_code": r.role_code, "status": r.status} for r in rows]


@router.get("/admin/room-categories")
def list_room_categories(ctx: AuthContext = Depends(resolve_tenant_context), db: Session = Depends(get_db)):
    rows = db.query(m.RoomCategory).filter(m.RoomCategory.tenant_id == ctx.tenant_id).all()
    return [{"id": str(r.id), "code": r.code, "name": r.name, "tariff_class": r.tariff_class, "status": r.status} for r in rows]


@router.get("/admin/beds")
def list_beds(ctx: AuthContext = Depends(resolve_tenant_context), db: Session = Depends(get_db)):
    rows = db.query(m.Bed).filter(m.Bed.tenant_id == ctx.tenant_id).all()
    return [serialize_bed(db, ctx.tenant_id, r) for r in rows]


@router.patch("/admin/beds/{bed_id}")
def patch_bed(
    bed_id: UUID,
    status: str = Query(...),
    ctx: AuthContext = Depends(require_permission("masters:*")),
    db: Session = Depends(get_db),
):
    row = db.query(m.Bed).filter(m.Bed.id == bed_id, m.Bed.tenant_id == ctx.tenant_id).first()
    if not row:
        raise HTTPException(404, "Bed not found")
    allowed = {"available", "occupied", "reserved", "maintenance", "housekeeping", "blocked"}
    if status not in allowed:
        raise HTTPException(400, f"Status must be one of: {sorted(allowed)}")
    if status == "occupied" and row.status != "occupied":
        raise HTTPException(400, "Bed occupancy is set only by the admission workflow")
    if row.status == "occupied" and status != "occupied":
        active = db.query(m.IpdAdmission).filter(
            m.IpdAdmission.tenant_id == ctx.tenant_id,
            m.IpdAdmission.bed_id == row.id,
            m.IpdAdmission.status != "discharged",
        ).first()
        if active:
            raise HTTPException(409, "Bed has an active admission; discharge or transfer the patient first")
    row.status = status
    row.updated_by = ctx.user.id
    db.commit()
    return {"id": str(row.id), "bed_code": row.bed_code, "status": row.status}


@router.post("/admin/users")
def create_user(
    payload: UserCreate,
    ctx: AuthContext = Depends(require_permission("users:*")),
    db: Session = Depends(get_db),
):
    existing = db.query(m.User).filter(
        m.User.tenant_id == ctx.tenant_id, m.User.email == payload.email, m.User.is_deleted == False
    ).first()
    if existing:
        raise HTTPException(400, "Email already registered")
    row = m.User(
        tenant_id=ctx.tenant_id,
        branch_id=payload.branch_id or ctx.user.branch_id,
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
        role_code=payload.role_code,
        status="active",
        created_by=ctx.user.id,
        updated_by=ctx.user.id,
    )
    db.add(row)
    db.commit()
    return {"id": str(row.id), "email": row.email, "full_name": row.full_name, "role_code": row.role_code, "status": row.status}

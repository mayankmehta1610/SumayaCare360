"""Care pathway templates and patient enrollments."""
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.deps import AuthContext, require_permission
from app.db.session import get_db
from app.models import entities as m
from app.services.audit import write_audit
from app.services.workflow_engine import validate_transition

router = APIRouter(prefix="/pathways", tags=["pathways"])
PATHWAY_MODULE = "disease-and-care-pathways"


class PathwayTemplateCreate(BaseModel):
    code: str
    name: str
    disease_code: str
    milestones: list[dict[str, Any]] = Field(default_factory=list)
    status: str = "active"


class PathwayTemplateUpdate(BaseModel):
    name: Optional[str] = None
    disease_code: Optional[str] = None
    milestones: Optional[list[dict[str, Any]]] = None
    status: Optional[str] = None


class EnrollmentCreate(BaseModel):
    patient_id: UUID
    pathway_id: UUID
    status: str = "active"


class EnrollmentUpdate(BaseModel):
    status: Optional[str] = None
    current_milestone: Optional[str] = None


def _serialize_template(row: m.CarePathwayTemplate) -> dict:
    return {
        "id": str(row.id),
        "code": row.code,
        "name": row.name,
        "disease_code": row.disease_code,
        "milestones": row.milestones or [],
        "status": row.status,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def _serialize_enrollment(row: m.PathwayEnrollment, template: Optional[m.CarePathwayTemplate] = None) -> dict:
    out = {
        "id": str(row.id),
        "patient_id": str(row.patient_id),
        "pathway_id": str(row.pathway_id),
        "status": row.status,
        "current_milestone": row.current_milestone,
        "enrolled_at": row.enrolled_at,
        "completed_at": row.completed_at,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }
    if template:
        out["pathway"] = {"code": template.code, "name": template.name, "milestones": template.milestones or []}
    return out


def _get_template(db: Session, tenant_id: UUID, template_id: UUID) -> m.CarePathwayTemplate:
    row = db.query(m.CarePathwayTemplate).filter(
        m.CarePathwayTemplate.id == template_id,
        m.CarePathwayTemplate.tenant_id == tenant_id,
        m.CarePathwayTemplate.is_deleted == False,
    ).first()
    if not row:
        raise HTTPException(404, "Pathway template not found")
    return row


def _get_enrollment(db: Session, tenant_id: UUID, enrollment_id: UUID) -> m.PathwayEnrollment:
    row = db.query(m.PathwayEnrollment).filter(
        m.PathwayEnrollment.id == enrollment_id,
        m.PathwayEnrollment.tenant_id == tenant_id,
        m.PathwayEnrollment.is_deleted == False,
    ).first()
    if not row:
        raise HTTPException(404, "Enrollment not found")
    return row


@router.get("/templates")
def list_templates(
    ctx: AuthContext = Depends(require_permission("encounters:read")),
    db: Session = Depends(get_db),
):
    rows = db.query(m.CarePathwayTemplate).filter(
        m.CarePathwayTemplate.tenant_id == ctx.tenant_id,
        m.CarePathwayTemplate.is_deleted == False,
    ).order_by(m.CarePathwayTemplate.name).all()
    return [_serialize_template(r) for r in rows]


@router.post("/templates")
def create_template(
    payload: PathwayTemplateCreate,
    ctx: AuthContext = Depends(require_permission("encounters:*")),
    db: Session = Depends(get_db),
):
    if db.query(m.CarePathwayTemplate).filter(
        m.CarePathwayTemplate.tenant_id == ctx.tenant_id,
        m.CarePathwayTemplate.code == payload.code,
        m.CarePathwayTemplate.is_deleted == False,
    ).first():
        raise HTTPException(409, "Pathway code already exists")
    row = m.CarePathwayTemplate(
        tenant_id=ctx.tenant_id,
        code=payload.code,
        name=payload.name,
        disease_code=payload.disease_code,
        milestones=payload.milestones,
        status=payload.status,
        created_by=ctx.user.id,
        updated_by=ctx.user.id,
    )
    db.add(row)
    write_audit(
        db, tenant_id=ctx.tenant_id, actor_user_id=ctx.user.id, action="CREATE",
        entity_type="care_pathway_template", entity_id=None,
        new_values=payload.model_dump(), correlation_id=ctx.correlation_id,
    )
    db.commit()
    db.refresh(row)
    return _serialize_template(row)


@router.get("/templates/{template_id}")
def get_template(
    template_id: UUID,
    ctx: AuthContext = Depends(require_permission("encounters:read")),
    db: Session = Depends(get_db),
):
    return _serialize_template(_get_template(db, ctx.tenant_id, template_id))


@router.patch("/templates/{template_id}")
def update_template(
    template_id: UUID,
    payload: PathwayTemplateUpdate,
    ctx: AuthContext = Depends(require_permission("encounters:*")),
    db: Session = Depends(get_db),
):
    row = _get_template(db, ctx.tenant_id, template_id)
    old = {"name": row.name, "disease_code": row.disease_code, "status": row.status}
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, field, value)
    row.updated_by = ctx.user.id
    write_audit(
        db, tenant_id=ctx.tenant_id, actor_user_id=ctx.user.id, action="UPDATE",
        entity_type="care_pathway_template", entity_id=str(row.id),
        old_values=old, new_values=payload.model_dump(exclude_unset=True),
        correlation_id=ctx.correlation_id,
    )
    db.commit()
    db.refresh(row)
    return _serialize_template(row)


@router.delete("/templates/{template_id}")
def delete_template(
    template_id: UUID,
    ctx: AuthContext = Depends(require_permission("encounters:*")),
    db: Session = Depends(get_db),
):
    row = _get_template(db, ctx.tenant_id, template_id)
    row.is_deleted = True
    row.updated_by = ctx.user.id
    write_audit(
        db, tenant_id=ctx.tenant_id, actor_user_id=ctx.user.id, action="DELETE",
        entity_type="care_pathway_template", entity_id=str(row.id),
        correlation_id=ctx.correlation_id,
    )
    db.commit()
    return {"deleted": True, "id": str(template_id)}


@router.get("/enrollments")
def list_enrollments(
    patient_id: Optional[UUID] = None,
    ctx: AuthContext = Depends(require_permission("encounters:read")),
    db: Session = Depends(get_db),
):
    q = db.query(m.PathwayEnrollment).filter(
        m.PathwayEnrollment.tenant_id == ctx.tenant_id,
        m.PathwayEnrollment.is_deleted == False,
    )
    if patient_id:
        q = q.filter(m.PathwayEnrollment.patient_id == patient_id)
    rows = q.order_by(m.PathwayEnrollment.created_at.desc()).limit(200).all()
    result = []
    for r in rows:
        tmpl = db.query(m.CarePathwayTemplate).filter(m.CarePathwayTemplate.id == r.pathway_id).first()
        result.append(_serialize_enrollment(r, tmpl))
    return result


@router.post("/enrollments")
def create_enrollment(
    payload: EnrollmentCreate,
    ctx: AuthContext = Depends(require_permission("encounters:*")),
    db: Session = Depends(get_db),
):
    template = _get_template(db, ctx.tenant_id, payload.pathway_id)
    patient = db.query(m.Patient).filter(
        m.Patient.id == payload.patient_id,
        m.Patient.tenant_id == ctx.tenant_id,
        m.Patient.is_deleted == False,
    ).first()
    if not patient:
        raise HTTPException(404, "Patient not found")

    milestones = template.milestones or []
    first_milestone = milestones[0].get("code", milestones[0].get("name", "")) if milestones else ""

    row = m.PathwayEnrollment(
        tenant_id=ctx.tenant_id,
        patient_id=payload.patient_id,
        pathway_id=template.id,
        status=payload.status,
        current_milestone=first_milestone,
        created_by=ctx.user.id,
        updated_by=ctx.user.id,
    )
    db.add(row)
    write_audit(
        db, tenant_id=ctx.tenant_id, actor_user_id=ctx.user.id, action="CREATE",
        entity_type="pathway_enrollment", entity_id=None,
        new_values={"pathway_code": template.code, "patient_id": str(payload.patient_id)},
        correlation_id=ctx.correlation_id,
    )
    db.commit()
    db.refresh(row)
    return _serialize_enrollment(row, template)


@router.get("/enrollments/{enrollment_id}")
def get_enrollment(
    enrollment_id: UUID,
    ctx: AuthContext = Depends(require_permission("encounters:read")),
    db: Session = Depends(get_db),
):
    row = _get_enrollment(db, ctx.tenant_id, enrollment_id)
    tmpl = db.query(m.CarePathwayTemplate).filter(m.CarePathwayTemplate.id == row.pathway_id).first()
    return _serialize_enrollment(row, tmpl)


@router.patch("/enrollments/{enrollment_id}")
def update_enrollment(
    enrollment_id: UUID,
    payload: EnrollmentUpdate,
    ctx: AuthContext = Depends(require_permission("encounters:*")),
    db: Session = Depends(get_db),
):
    row = _get_enrollment(db, ctx.tenant_id, enrollment_id)
    old = {"status": row.status, "current_milestone": row.current_milestone}
    if payload.status is not None and payload.status != row.status:
        validate_transition(
            db, PATHWAY_MODULE, row.status, payload.status, tenant_id=ctx.tenant_id,
        )
        row.status = payload.status
        if payload.status == "completed":
            from datetime import datetime, timezone
            row.completed_at = datetime.now(timezone.utc)
    if payload.current_milestone is not None:
        row.current_milestone = payload.current_milestone
    row.updated_by = ctx.user.id
    write_audit(
        db, tenant_id=ctx.tenant_id, actor_user_id=ctx.user.id, action="UPDATE",
        entity_type="pathway_enrollment", entity_id=str(row.id),
        old_values=old, new_values=payload.model_dump(exclude_unset=True),
        correlation_id=ctx.correlation_id,
    )
    db.commit()
    db.refresh(row)
    tmpl = db.query(m.CarePathwayTemplate).filter(m.CarePathwayTemplate.id == row.pathway_id).first()
    return _serialize_enrollment(row, tmpl)


@router.post("/enrollments/{enrollment_id}/advance")
def advance_milestone(
    enrollment_id: UUID,
    ctx: AuthContext = Depends(require_permission("encounters:*")),
    db: Session = Depends(get_db),
):
    row = _get_enrollment(db, ctx.tenant_id, enrollment_id)
    template = _get_template(db, ctx.tenant_id, row.pathway_id)
    milestones = template.milestones or []
    if not milestones:
        raise HTTPException(400, "Pathway has no milestones defined")

    codes = [
        (m.get("code") or m.get("name") or str(i))
        for i, m in enumerate(milestones)
    ]
    current = row.current_milestone or codes[0]
    try:
        idx = codes.index(current)
    except ValueError:
        idx = 0

    if idx >= len(codes) - 1:
        from datetime import datetime, timezone
        old_status = row.status
        row.status = "completed"
        row.current_milestone = codes[-1]
        row.completed_at = datetime.now(timezone.utc)
        validate_transition(db, PATHWAY_MODULE, old_status, "completed", tenant_id=ctx.tenant_id)
    else:
        row.current_milestone = codes[idx + 1]

    row.updated_by = ctx.user.id
    write_audit(
        db, tenant_id=ctx.tenant_id, actor_user_id=ctx.user.id, action="ADVANCE",
        entity_type="pathway_enrollment", entity_id=str(row.id),
        new_values={"current_milestone": row.current_milestone, "status": row.status},
        correlation_id=ctx.correlation_id,
    )
    db.commit()
    db.refresh(row)
    return _serialize_enrollment(row, template)

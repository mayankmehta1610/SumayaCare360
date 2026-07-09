from typing import Any, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.deps import AuthContext, require_tenant
from app.data.expanded_api_manifest import (
    EXPANDED_API_AREAS,
    EXPANDED_AREA_CODES,
    TOTAL_EXPANDED_ENDPOINTS,
)
from app.services import expanded as exp_svc

router = APIRouter(tags=["expanded-api"])


class ExpandedRecordCreate(BaseModel):
    title: str
    status: str = "draft"
    payload: dict[str, Any] = Field(default_factory=dict)


class ExpandedRecordUpdate(BaseModel):
    title: Optional[str] = None
    status: Optional[str] = None
    payload: Optional[dict[str, Any]] = None


def _serialize(row) -> dict:
    return {
        "id": str(row.id),
        "area_code": row.area_code,
        "resource_code": row.resource_code,
        "reference_no": row.reference_no,
        "title": row.title,
        "status": row.status,
        "payload": row.payload or {},
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def _validate_area_resource(area: str, resource: str):
    if area not in EXPANDED_AREA_CODES:
        raise HTTPException(404, f"Unknown expanded API area: {area}")
    if resource not in EXPANDED_API_AREAS[area]["resources"]:
        raise HTTPException(404, f"Unknown resource '{resource}' in area '{area}'")


@router.get("/platform/expanded-api")
def list_expanded_api_catalog(ctx: AuthContext = Depends(require_tenant)):
    return {
        "total_endpoints": TOTAL_EXPANDED_ENDPOINTS,
        "areas": [
            {
                "code": code,
                "name": meta["name"],
                "resources": meta["resources"],
                "base_path": f"/api/v1/{code}",
            }
            for code, meta in EXPANDED_API_AREAS.items()
        ],
    }


@router.get("/platform/requirements-coverage")
def requirements_coverage(ctx: AuthContext = Depends(require_tenant), db: Session = Depends(get_db)):
    from app.models import entities as m
    from app.data.module_catalog import MODULE_CATALOG
    from app.services import features as feat_svc

    module_records = db.query(m.ModuleRecord).filter(
        m.ModuleRecord.tenant_id == ctx.tenant_id, m.ModuleRecord.is_deleted == False
    ).count()
    expanded_records = db.query(m.ExpandedResource).filter(
        m.ExpandedResource.tenant_id == ctx.tenant_id, m.ExpandedResource.is_deleted == False
    ).count()
    cov = feat_svc.coverage_summary(db)
    return {
        "feature_backlog_total": cov.get("target_total", 3210),
        "feature_backlog_implemented": cov["implemented"],
        "feature_backlog_percent": cov["percent"],
        "feature_backlog_must_have": cov["must_have"],
        "feature_backlog_must_have_implemented": cov["must_have_implemented"],
        "expanded_api_endpoints": TOTAL_EXPANDED_ENDPOINTS,
        "api_backlog_services": 34,
        "platform_modules": len(MODULE_CATALOG),
        "tenant_module_records": module_records,
        "tenant_expanded_records": expanded_records,
        "implementation_model": "dedicated_domain_desks + clinical_lifecycle_apis + feature_catalog",
        "coverage_note": "3,210 Excel features tracked in PostgreSQL; core workflow stages wired to live APIs.",
    }


def _register_resource_routes(area: str, resource: str):
    """Register standard CRUD routes for one expanded resource."""

    @router.get(f"/{area}/{resource}", name=f"list_{area}_{resource}")
    def list_records(
        query: str = "",
        status: Optional[str] = None,
        ctx: AuthContext = Depends(require_tenant),
        db: Session = Depends(get_db),
    ):
        _validate_area_resource(area, resource)
        rows = exp_svc.list_resources(db, ctx.tenant_id, area, resource, query, status)
        return [_serialize(r) for r in rows]

    @router.post(f"/{area}/{resource}", name=f"create_{area}_{resource}")
    def create_record(
        payload: ExpandedRecordCreate,
        ctx: AuthContext = Depends(require_tenant),
        db: Session = Depends(get_db),
    ):
        _validate_area_resource(area, resource)
        if payload.payload.get("action") == "export":
            rows = exp_svc.list_resources(db, ctx.tenant_id, area, resource)
            return exp_svc.export_resources(rows)
        row = exp_svc.create_resource(
            db, tenant_id=ctx.tenant_id, area_code=area, resource_code=resource,
            title=payload.title, status=payload.status, payload=payload.payload,
            actor_id=ctx.user.id, branch_id=ctx.user.branch_id, correlation_id=ctx.correlation_id,
        )
        db.commit()
        db.refresh(row)
        return _serialize(row)

    @router.put(f"/{area}/{resource}", name=f"bulk_update_{area}_{resource}")
    def bulk_update(
        payload: ExpandedRecordUpdate,
        record_id: UUID = Query(..., description="Record to update"),
        ctx: AuthContext = Depends(require_tenant),
        db: Session = Depends(get_db),
    ):
        _validate_area_resource(area, resource)
        row = exp_svc.get_resource(db, ctx.tenant_id, area, resource, record_id)
        if not row:
            raise HTTPException(404, "Record not found")
        exp_svc.update_resource(
            db, row, title=payload.title, status=payload.status, payload=payload.payload,
            actor_id=ctx.user.id, correlation_id=ctx.correlation_id,
        )
        db.commit()
        return _serialize(row)

    @router.get(f"/{area}/{resource}/{{record_id}}", name=f"detail_{area}_{resource}")
    def get_record(
        record_id: UUID,
        ctx: AuthContext = Depends(require_tenant),
        db: Session = Depends(get_db),
    ):
        _validate_area_resource(area, resource)
        row = exp_svc.get_resource(db, ctx.tenant_id, area, resource, record_id)
        if not row:
            raise HTTPException(404, "Record not found")
        return _serialize(row)

    @router.patch(f"/{area}/{resource}/{{record_id}}", name=f"patch_{area}_{resource}")
    def patch_record(
        record_id: UUID,
        payload: ExpandedRecordUpdate,
        ctx: AuthContext = Depends(require_tenant),
        db: Session = Depends(get_db),
    ):
        _validate_area_resource(area, resource)
        row = exp_svc.get_resource(db, ctx.tenant_id, area, resource, record_id)
        if not row:
            raise HTTPException(404, "Record not found")
        exp_svc.update_resource(
            db, row, title=payload.title, status=payload.status, payload=payload.payload,
            actor_id=ctx.user.id, correlation_id=ctx.correlation_id,
        )
        db.commit()
        return _serialize(row)

    @router.delete(f"/{area}/{resource}/{{record_id}}", name=f"delete_{area}_{resource}")
    def delete_record(
        record_id: UUID,
        ctx: AuthContext = Depends(require_tenant),
        db: Session = Depends(get_db),
    ):
        _validate_area_resource(area, resource)
        row = exp_svc.get_resource(db, ctx.tenant_id, area, resource, record_id)
        if not row:
            raise HTTPException(404, "Record not found")
        exp_svc.soft_delete_resource(db, row, ctx.user.id, ctx.correlation_id)
        db.commit()
        return {"deleted": True, "id": str(record_id)}

    @router.post(f"/{area}/{resource}/{{record_id}}/approve", name=f"approve_{area}_{resource}")
    def approve_record(
        record_id: UUID,
        ctx: AuthContext = Depends(require_tenant),
        db: Session = Depends(get_db),
    ):
        _validate_area_resource(area, resource)
        row = exp_svc.get_resource(db, ctx.tenant_id, area, resource, record_id)
        if not row:
            raise HTTPException(404, "Record not found")
        exp_svc.update_resource(db, row, title=None, status="approved", payload=None,
                                actor_id=ctx.user.id, correlation_id=ctx.correlation_id)
        db.commit()
        return _serialize(row)

    @router.post(f"/{area}/{resource}/{{record_id}}/reject", name=f"reject_{area}_{resource}")
    def reject_record(
        record_id: UUID,
        ctx: AuthContext = Depends(require_tenant),
        db: Session = Depends(get_db),
    ):
        _validate_area_resource(area, resource)
        row = exp_svc.get_resource(db, ctx.tenant_id, area, resource, record_id)
        if not row:
            raise HTTPException(404, "Record not found")
        exp_svc.update_resource(db, row, title=None, status="rejected", payload=None,
                                actor_id=ctx.user.id, correlation_id=ctx.correlation_id)
        db.commit()
        return _serialize(row)

    @router.post(f"/{area}/{resource}/export", name=f"export_{area}_{resource}")
    def export_records(
        ctx: AuthContext = Depends(require_tenant),
        db: Session = Depends(get_db),
    ):
        _validate_area_resource(area, resource)
        rows = exp_svc.list_resources(db, ctx.tenant_id, area, resource)
        return exp_svc.export_resources(rows)


for _area, _meta in EXPANDED_API_AREAS.items():
    for _res in _meta["resources"]:
        _register_resource_routes(_area, _res)

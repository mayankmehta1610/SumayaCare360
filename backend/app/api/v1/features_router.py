"""Feature backlog API — Excel-aligned coverage tracking."""
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.deps import AuthContext, get_current_context, require_tenant
from app.db.session import get_db
from app.services import features as feat_svc
from app.services.reports import run_report

router = APIRouter(tags=["features"])


class ReportRunRequest(BaseModel):
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    format: Optional[str] = "json"


@router.get("/platform/features/coverage")
def feature_coverage(
    module_code: Optional[str] = None,
    ctx: AuthContext = Depends(get_current_context),
    db: Session = Depends(get_db),
):
    return feat_svc.coverage_summary(db, module_code)


@router.get("/platform/features")
def list_features(
    module_code: Optional[str] = None,
    submodule: Optional[str] = None,
    stage: Optional[str] = None,
    ctx: AuthContext = Depends(get_current_context),
    db: Session = Depends(get_db),
):
    if not module_code:
        from app.data.module_catalog import MODULE_CATALOG
        return [
            {
                "module_code": m["code"],
                "module_name": m["name"],
                **feat_svc.coverage_summary(db, m["code"]),
            }
            for m in MODULE_CATALOG
        ]
    rows = feat_svc.list_module_features(db, module_code, submodule=submodule, stage=stage)
    return [
        {
            "feature_id": r.feature_id,
            "module_code": r.module_code,
            "submodule": r.submodule,
            "workflow_stage": r.workflow_stage,
            "feature_name": r.feature_name,
            "platform": r.platform,
            "priority": r.priority,
            "api_route": r.api_route,
            "implemented": r.implemented,
        }
        for r in rows
    ]


@router.post("/platform/reports/{report_code}/run")
def execute_report(
    report_code: str,
    payload: ReportRunRequest = ReportRunRequest(),
    ctx: AuthContext = Depends(require_tenant),
    db: Session = Depends(get_db),
):
    return run_report(
        db, ctx.tenant_id, report_code,
        date_from=payload.date_from, date_to=payload.date_to,
        export_format=payload.format or "json",
    )


@router.post("/platform/features/sync")
def sync_features(ctx: AuthContext = Depends(get_current_context), db: Session = Depends(get_db)):
    added = feat_svc.sync_feature_catalog(db, ctx.user.id if ctx.user else None)
    db.commit()
    return {"added": added, **feat_svc.coverage_summary(db)}

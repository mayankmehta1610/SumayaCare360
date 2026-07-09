"""Feature backlog sync and coverage metrics."""
from __future__ import annotations

from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.data.feature_catalog import FEATURE_ROWS, FEATURE_TOTAL, IMPLEMENTED_STAGES
from app.models import entities as m


def sync_feature_catalog(db: Session, actor_id: Optional[UUID] = None) -> int:
    existing = db.query(m.FeatureRequirement).count()
    if existing >= FEATURE_TOTAL * 0.95:
        return existing
    added = 0
    for row in FEATURE_ROWS:
        if db.query(m.FeatureRequirement).filter(m.FeatureRequirement.feature_id == row["feature_id"]).first():
            continue
        db.add(m.FeatureRequirement(
            feature_id=row["feature_id"],
            module_code=row["module_code"],
            submodule=row["submodule"],
            workflow_stage=row["workflow_stage"],
            feature_name=row["feature_name"],
            platform=row["platform"],
            priority=row["priority"],
            api_route=row["api_route"],
            implemented=row["implemented"],
            created_by=actor_id,
            updated_by=actor_id,
        ))
        added += 1
    return added


def coverage_summary(db: Session, module_code: Optional[str] = None) -> dict:
    q = db.query(m.FeatureRequirement).filter(m.FeatureRequirement.is_deleted == False)
    if module_code:
        q = q.filter(m.FeatureRequirement.module_code == module_code)
    total = q.count()
    implemented = q.filter(m.FeatureRequirement.implemented == True).count()
    must_have = q.filter(m.FeatureRequirement.priority == "Must Have").count()
    must_impl = q.filter(
        m.FeatureRequirement.priority == "Must Have",
        m.FeatureRequirement.implemented == True,
    ).count()
    return {
        "total": total,
        "implemented": implemented,
        "must_have": must_have,
        "must_have_implemented": must_impl,
        "percent": round(100 * implemented / total, 1) if total else 0,
        "target_total": FEATURE_TOTAL,
    }


def list_module_features(
    db: Session,
    module_code: str,
    *,
    submodule: Optional[str] = None,
    stage: Optional[str] = None,
    limit: int = 500,
) -> list[m.FeatureRequirement]:
    q = db.query(m.FeatureRequirement).filter(
        m.FeatureRequirement.module_code == module_code,
        m.FeatureRequirement.is_deleted == False,
    )
    if submodule:
        q = q.filter(m.FeatureRequirement.submodule == submodule)
    if stage:
        q = q.filter(m.FeatureRequirement.workflow_stage == stage)
    return q.order_by(m.FeatureRequirement.feature_id).limit(limit).all()


def mark_stage_implemented(db: Session, module_code: str, workflow_stage: str) -> int:
    rows = db.query(m.FeatureRequirement).filter(
        m.FeatureRequirement.module_code == module_code,
        m.FeatureRequirement.workflow_stage == workflow_stage,
        m.FeatureRequirement.implemented == False,
    ).all()
    for r in rows:
        r.implemented = True
    return len(rows)

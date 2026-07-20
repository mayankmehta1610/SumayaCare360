"""Masters write API — tenant-scoped POST for reference data."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import AuthContext, require_tenant, has_permission
from app.db.session import get_db
from app.models import entities as m
from app.schemas.schemas import MasterItemCreate
from app.services.audit import write_audit

router = APIRouter(tags=["masters"])


def _build_master_row(resource: str, payload: MasterItemCreate, ctx: AuthContext):
    """Return a new ORM row for the given master resource."""
    extra = payload.extra or {}
    creators = {
        "specialties": lambda: m.Specialty(
            tenant_id=ctx.tenant_id, code=payload.code, name=payload.name, status=payload.status,
        ),
      "tariffs": lambda: m.Tariff(
          tenant_id=ctx.tenant_id, code=payload.code, name=payload.name,
          category=extra.get("category", "service"),
          amount=extra.get("amount", 0),
          currency=extra.get("currency", "INR"),
          status=payload.status,
      ),
      "medicines": lambda: m.Medicine(
          tenant_id=ctx.tenant_id, code=payload.code, name=payload.name,
          form=extra.get("form"), strength=extra.get("strength"),
          status=payload.status,
      ),
      "lab-tests": lambda: m.LabTest(
          tenant_id=ctx.tenant_id, code=payload.code, name=payload.name,
          sample_type=extra.get("sample_type"),
          status=payload.status,
      ),
      "diseases": lambda: m.Disease(
          tenant_id=ctx.tenant_id, code=payload.code, name=payload.name,
          icd_code=extra.get("icd_code"),
          status=payload.status,
      ),
      "insurance-payers": lambda: m.InsurancePayer(
          tenant_id=ctx.tenant_id, code=payload.code, name=payload.name,
          tpa_name=extra.get("tpa_name"),
          api_endpoint=extra.get("api_endpoint"),
          claim_rules=extra.get("claim_rules", {}),
          status=payload.status,
      ),
      "room-categories": lambda: m.RoomCategory(
          tenant_id=ctx.tenant_id, code=payload.code, name=payload.name,
          tariff_class=extra.get("tariff_class"),
          nursing_station=extra.get("nursing_station"),
          branch_id=extra.get("branch_id"),
          status=payload.status,
      ),
      "beds": lambda: m.Bed(
          tenant_id=ctx.tenant_id, room_code=extra.get("room_code", "GEN"),
          bed_code=payload.code, category_code=extra.get("category_code"),
          branch_id=extra.get("branch_id"),
          isolation_flag=bool(extra.get("isolation_flag", False)),
          equipment_tags=extra.get("equipment_tags", []),
          status=payload.status or extra.get("status", "available"),
      ),
      "clinical-templates": lambda: m.ClinicalTemplate(
          tenant_id=ctx.tenant_id, code=payload.code, name=payload.name,
          template_type=extra.get("template_type", "progress"),
          body=extra.get("body", {}),
          status=payload.status,
      ),
      "notification-templates": lambda: m.NotificationTemplate(
          tenant_id=ctx.tenant_id, code=payload.code,
          channel=extra.get("channel", "email"),
          subject=extra.get("subject", payload.name),
          body=extra.get("body", payload.name),
          status=payload.status,
      ),
    }
    if resource not in creators:
        raise HTTPException(400, f"Create not supported for master: {resource}")
    return creators[resource]()


def _serialize_master_row(resource: str, row) -> dict:
    base = {"id": str(row.id), "code": getattr(row, "code", None), "name": getattr(row, "name", None)}
    if resource == "beds":
        base.update({
            "bed_code": row.bed_code,
            "room_code": row.room_code,
            "category_code": row.category_code,
            "status": row.status,
        })
    elif resource == "notification-templates":
        base = {"id": str(row.id), "code": row.code, "subject": row.subject, "channel": row.channel, "status": row.status}
    elif resource == "clinical-templates":
        base.update({"template_type": row.template_type, "status": row.status})
    elif resource == "tariffs":
        base.update({
            "category": row.category,
            "amount": float(row.amount or 0),
            "currency": row.currency,
            "status": row.status,
        })
    else:
        base["status"] = getattr(row, "status", "active")
    return base


@router.post("/masters/{resource}")
def create_master(
    resource: str,
    payload: MasterItemCreate,
    ctx: AuthContext = Depends(require_tenant),
    db: Session = Depends(get_db),
):
    if not has_permission(ctx.permissions, "masters:*"):
        raise HTTPException(403, "Missing permission: masters:*")
    if resource == "beds":
        raise HTTPException(400, "Create beds through the facility hierarchy so every bed is linked to a room")
    row = _build_master_row(resource, payload, ctx)
    row.created_by = ctx.user.id
    row.updated_by = ctx.user.id
    db.add(row)
    write_audit(
        db, tenant_id=ctx.tenant_id, actor_user_id=ctx.user.id, action="CREATE",
        entity_type=resource, new_values=payload.model_dump(),
        correlation_id=ctx.correlation_id,
    )
    db.commit()
    db.refresh(row)
    return _serialize_master_row(resource, row)

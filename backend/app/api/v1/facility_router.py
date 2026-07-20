"""Governed hospital structure, locations, rooms and beds."""
from __future__ import annotations

from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.deps import AuthContext, require_permission, require_tenant
from app.db.session import get_db
from app.models import entities as m
from app.services.audit import write_audit

router = APIRouter(tags=["facility-master"])

LOCATION_PARENT = {
    "building": None,
    "wing": "building",
    "floor": "wing",
    "ward": "floor",
    "room": "ward",
}
LOCATION_TYPES = tuple(LOCATION_PARENT)
LOCATION_STATUSES = {"active", "inactive"}
OPERATIONAL_STATUSES = {"operational", "closed", "maintenance", "housekeeping"}
BED_STATUSES = {"available", "occupied", "reserved", "maintenance", "housekeeping", "blocked"}


MASTER_DATA_CATALOG = [
    {"domain": "Organization", "master": "Branch / campus", "depends_on": "Tenant", "used_by": "Users, departments, providers, appointments, facilities"},
    {"domain": "Organization", "master": "Department", "depends_on": "Branch / campus", "used_by": "Providers, services, wards, appointments, cost centres"},
    {"domain": "Facility", "master": "Building", "depends_on": "Branch / campus", "used_by": "Wings and service locations"},
    {"domain": "Facility", "master": "Wing", "depends_on": "Building", "used_by": "Floors"},
    {"domain": "Facility", "master": "Floor", "depends_on": "Wing", "used_by": "Wards"},
    {"domain": "Facility", "master": "Ward", "depends_on": "Floor + department", "used_by": "Rooms, nursing, admissions"},
    {"domain": "Facility", "master": "Room", "depends_on": "Ward + room category", "used_by": "Beds, theatres, diagnostics, appointments"},
    {"domain": "Facility", "master": "Bed", "depends_on": "Room + room category", "used_by": "Admissions, transfers, housekeeping, occupancy"},
    {"domain": "Workforce", "master": "Provider", "depends_on": "Branch + department + specialty + location", "used_by": "Appointments, encounters, orders, procedures"},
    {"domain": "Workforce", "master": "Provider schedule", "depends_on": "Provider + location", "used_by": "Slot availability and booking"},
    {"domain": "Clinical", "master": "Specialty", "depends_on": "Organization policy", "used_by": "Departments and provider roles"},
    {"domain": "Clinical", "master": "Disease / diagnosis", "depends_on": "ICD code set", "used_by": "Encounters, admissions, claims, reports"},
    {"domain": "Clinical", "master": "Procedure / service", "depends_on": "Department + tariff", "used_by": "Orders, OT, billing, claims"},
    {"domain": "Diagnostics", "master": "Laboratory test", "depends_on": "Specimen type + department + tariff", "used_by": "Orders, results, billing"},
    {"domain": "Diagnostics", "master": "Radiology study", "depends_on": "Modality + body site + tariff", "used_by": "Orders, scheduling, PACS, billing"},
    {"domain": "Pharmacy", "master": "Medicine", "depends_on": "Form + strength + route", "used_by": "Prescription, dispensing, stock"},
    {"domain": "Pharmacy", "master": "Inventory batch", "depends_on": "Medicine + store", "used_by": "Batch, expiry and stock issue"},
    {"domain": "Revenue", "master": "Tariff", "depends_on": "Service + payer class", "used_by": "Estimates, billing, claims"},
    {"domain": "Revenue", "master": "Insurance payer / TPA", "depends_on": "Contracts and claim rules", "used_by": "Registration, pre-auth, claims"},
    {"domain": "Patient", "master": "Country / gender / relationship / ID type", "depends_on": "Approved code sets", "used_by": "Registration and identity"},
    {"domain": "Governance", "master": "Consent and clinical templates", "depends_on": "Version and effective dates", "used_by": "Documentation and compliance"},
]


class FacilityLocationCreate(BaseModel):
    branch_id: UUID
    location_type: str
    code: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=2, max_length=255)
    parent_id: Optional[UUID] = None
    department_id: Optional[UUID] = None
    room_category_id: Optional[UUID] = None
    operational_status: str = "operational"
    attributes: dict[str, Any] = Field(default_factory=dict)


class FacilityLocationUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=255)
    department_id: Optional[UUID] = None
    room_category_id: Optional[UUID] = None
    status: Optional[str] = None
    operational_status: Optional[str] = None
    attributes: Optional[dict[str, Any]] = None


class BedCreate(BaseModel):
    room_id: UUID
    bed_code: str = Field(min_length=1, max_length=64)
    room_category_id: Optional[UUID] = None
    isolation_flag: bool = False
    equipment_tags: list[str] = Field(default_factory=list)


def _branch(db: Session, tenant_id, branch_id):
    row = db.query(m.Branch).filter(
        m.Branch.id == branch_id, m.Branch.tenant_id == tenant_id, m.Branch.is_deleted == False,
    ).first()
    if not row:
        raise HTTPException(400, "Select a valid branch / campus master")
    return row


def _location(db: Session, tenant_id, location_id, *, expected_type: str | None = None):
    row = db.query(m.FacilityLocation).filter(
        m.FacilityLocation.id == location_id,
        m.FacilityLocation.tenant_id == tenant_id,
        m.FacilityLocation.is_deleted == False,
    ).first()
    if not row:
        raise HTTPException(400, "Select a valid facility location master")
    if expected_type and row.location_type != expected_type:
        raise HTTPException(400, f"Selected location must be a {expected_type}")
    return row


def _ancestor(db: Session, tenant_id, row, location_type: str):
    current = row
    seen = set()
    while current and current.id not in seen:
        seen.add(current.id)
        if current.location_type == location_type:
            return current
        current = _location(db, tenant_id, current.parent_id) if current.parent_id else None
    return None


def _path(db: Session, tenant_id, row) -> list[dict[str, str]]:
    result, current, seen = [], row, set()
    while current and current.id not in seen:
        seen.add(current.id)
        result.append({"id": str(current.id), "type": current.location_type, "code": current.code, "name": current.name})
        current = _location(db, tenant_id, current.parent_id) if current.parent_id else None
    return list(reversed(result))


def serialize_location(db: Session, tenant_id, row) -> dict[str, Any]:
    path = _path(db, tenant_id, row)
    return {
        "id": str(row.id), "branch_id": str(row.branch_id),
        "parent_id": str(row.parent_id) if row.parent_id else None,
        "department_id": str(row.department_id) if row.department_id else None,
        "room_category_id": str(row.room_category_id) if row.room_category_id else None,
        "location_type": row.location_type, "code": row.code, "name": row.name,
        "status": row.status, "operational_status": row.operational_status,
        "attributes": row.attributes or {}, "path": path,
        "path_label": " / ".join(x["name"] for x in path),
    }


def serialize_bed(db: Session, tenant_id, row) -> dict[str, Any]:
    room = _location(db, tenant_id, row.room_id) if row.room_id else None
    ward = _ancestor(db, tenant_id, room, "ward") if room else None
    return {
        "id": str(row.id), "bed_code": row.bed_code, "status": row.status,
        "branch_id": str(row.branch_id) if row.branch_id else None,
        "room_id": str(row.room_id) if row.room_id else None,
        "room_code": room.code if room else row.room_code,
        "room_name": room.name if room else row.room_code,
        "ward_id": str(ward.id) if ward else None,
        "ward_code": ward.code if ward else None,
        "room_category_id": str(row.room_category_id) if row.room_category_id else None,
        "category_code": row.category_code,
        "isolation_flag": row.isolation_flag,
        "equipment_tags": row.equipment_tags or [],
        "location_path": _path(db, tenant_id, room) if room else [],
        "location_label": " / ".join(x["name"] for x in _path(db, tenant_id, room)) if room else row.room_code,
    }


@router.get("/admin/master-data-catalog")
def master_data_catalog(ctx: AuthContext = Depends(require_tenant)):
    return {"principle": "Select governed records; type only genuinely transactional narrative.", "items": MASTER_DATA_CATALOG}


@router.get("/admin/facility-locations")
def list_facility_locations(
    branch_id: Optional[UUID] = None,
    location_type: Optional[str] = Query(default=None, alias="type"),
    parent_id: Optional[UUID] = None,
    ctx: AuthContext = Depends(require_tenant), db: Session = Depends(get_db),
):
    q = db.query(m.FacilityLocation).filter(
        m.FacilityLocation.tenant_id == ctx.tenant_id, m.FacilityLocation.is_deleted == False,
    )
    if branch_id:
        q = q.filter(m.FacilityLocation.branch_id == branch_id)
    if location_type:
        if location_type not in LOCATION_TYPES:
            raise HTTPException(400, f"Location type must be one of: {LOCATION_TYPES}")
        q = q.filter(m.FacilityLocation.location_type == location_type)
    if parent_id:
        q = q.filter(m.FacilityLocation.parent_id == parent_id)
    return [serialize_location(db, ctx.tenant_id, x) for x in q.order_by(m.FacilityLocation.location_type, m.FacilityLocation.name).all()]


@router.post("/admin/facility-locations")
def create_facility_location(
    payload: FacilityLocationCreate,
    ctx: AuthContext = Depends(require_permission("masters:*")), db: Session = Depends(get_db),
):
    kind = payload.location_type.strip().lower()
    if kind not in LOCATION_TYPES:
        raise HTTPException(400, f"Location type must be one of: {LOCATION_TYPES}")
    if payload.operational_status not in OPERATIONAL_STATUSES:
        raise HTTPException(400, "Invalid operational status")
    _branch(db, ctx.tenant_id, payload.branch_id)
    required_parent = LOCATION_PARENT[kind]
    parent = None
    if required_parent:
        if not payload.parent_id:
            raise HTTPException(400, f"A {kind} must be linked to a {required_parent}")
        parent = _location(db, ctx.tenant_id, payload.parent_id, expected_type=required_parent)
        if parent.branch_id != payload.branch_id:
            raise HTTPException(400, "Parent location belongs to another branch / campus")
    elif payload.parent_id:
        raise HTTPException(400, "A building is linked directly to the branch / campus")
    if payload.department_id:
        department = db.query(m.Department).filter(
            m.Department.id == payload.department_id, m.Department.tenant_id == ctx.tenant_id,
            m.Department.is_deleted == False,
        ).first()
        if not department or (department.branch_id and department.branch_id != payload.branch_id):
            raise HTTPException(400, "Select a department from the same branch / campus")
    category_code = None
    if payload.room_category_id:
        if kind != "room":
            raise HTTPException(400, "Room category can only be assigned to a room")
        category = db.query(m.RoomCategory).filter(
            m.RoomCategory.id == payload.room_category_id,
            m.RoomCategory.tenant_id == ctx.tenant_id,
            m.RoomCategory.is_deleted == False,
        ).first()
        if not category:
            raise HTTPException(400, "Select a valid room category master")
        category_code = category.code
    code = payload.code.strip().upper()
    duplicate = db.query(m.FacilityLocation).filter(
        m.FacilityLocation.tenant_id == ctx.tenant_id,
        m.FacilityLocation.branch_id == payload.branch_id,
        m.FacilityLocation.code == code,
        m.FacilityLocation.is_deleted == False,
    ).first()
    if duplicate:
        raise HTTPException(409, "Location code already exists in this branch / campus")
    row = m.FacilityLocation(
        tenant_id=ctx.tenant_id, branch_id=payload.branch_id, parent_id=payload.parent_id,
        department_id=payload.department_id, room_category_id=payload.room_category_id,
        location_type=kind, code=code, name=payload.name.strip(),
        operational_status=payload.operational_status, attributes=payload.attributes,
        created_by=ctx.user.id, updated_by=ctx.user.id,
    )
    db.add(row)
    db.flush()
    write_audit(db, tenant_id=ctx.tenant_id, actor_user_id=ctx.user.id, action="CREATE",
                entity_type="facility_location", entity_id=row.id,
                new_values={**payload.model_dump(mode="json"), "location_type": kind, "category_code": category_code},
                correlation_id=ctx.correlation_id)
    db.commit()
    db.refresh(row)
    return serialize_location(db, ctx.tenant_id, row)


@router.patch("/admin/facility-locations/{location_id}")
def update_facility_location(
    location_id: UUID, payload: FacilityLocationUpdate,
    ctx: AuthContext = Depends(require_permission("masters:*")), db: Session = Depends(get_db),
):
    row = _location(db, ctx.tenant_id, location_id)
    changes = payload.model_dump(exclude_unset=True)
    if "status" in changes and changes["status"] not in LOCATION_STATUSES:
        raise HTTPException(400, "Invalid master status")
    if "operational_status" in changes and changes["operational_status"] not in OPERATIONAL_STATUSES:
        raise HTTPException(400, "Invalid operational status")
    if changes.get("room_category_id") and row.location_type != "room":
        raise HTTPException(400, "Room category can only be assigned to a room")
    for key, value in changes.items():
        setattr(row, key, value)
    row.updated_by = ctx.user.id
    write_audit(db, tenant_id=ctx.tenant_id, actor_user_id=ctx.user.id, action="UPDATE",
                entity_type="facility_location", entity_id=row.id, new_values=changes,
                correlation_id=ctx.correlation_id)
    db.commit()
    return serialize_location(db, ctx.tenant_id, row)


@router.get("/admin/facility-tree")
def facility_tree(branch_id: Optional[UUID] = None, ctx: AuthContext = Depends(require_tenant), db: Session = Depends(get_db)):
    rows = db.query(m.FacilityLocation).filter(
        m.FacilityLocation.tenant_id == ctx.tenant_id, m.FacilityLocation.is_deleted == False,
        *([m.FacilityLocation.branch_id == branch_id] if branch_id else []),
    ).order_by(m.FacilityLocation.name).all()
    nodes = {str(x.id): {**serialize_location(db, ctx.tenant_id, x), "children": [], "beds": []} for x in rows}
    roots = []
    for row in rows:
        node = nodes[str(row.id)]
        if row.parent_id and str(row.parent_id) in nodes:
            nodes[str(row.parent_id)]["children"].append(node)
        else:
            roots.append(node)
    beds = db.query(m.Bed).filter(m.Bed.tenant_id == ctx.tenant_id, m.Bed.is_deleted == False).all()
    for bed in beds:
        if bed.room_id and str(bed.room_id) in nodes:
            nodes[str(bed.room_id)]["beds"].append(serialize_bed(db, ctx.tenant_id, bed))
    return roots


@router.post("/admin/beds")
def create_bed(
    payload: BedCreate,
    ctx: AuthContext = Depends(require_permission("masters:*")), db: Session = Depends(get_db),
):
    room = _location(db, ctx.tenant_id, payload.room_id, expected_type="room")
    if room.status != "active" or room.operational_status != "operational":
        raise HTTPException(400, "Beds can only be added to an active, operational room")
    category_id = payload.room_category_id or room.room_category_id
    if not category_id:
        raise HTTPException(400, "Assign a room category master to the room or bed")
    category = db.query(m.RoomCategory).filter(
        m.RoomCategory.id == category_id, m.RoomCategory.tenant_id == ctx.tenant_id,
        m.RoomCategory.is_deleted == False,
    ).first()
    if not category:
        raise HTTPException(400, "Select a valid room category master")
    bed_code = payload.bed_code.strip().upper()
    duplicate = db.query(m.Bed).filter(
        m.Bed.tenant_id == ctx.tenant_id, m.Bed.bed_code == bed_code, m.Bed.is_deleted == False,
    ).first()
    if duplicate:
        raise HTTPException(409, "Bed code already exists")
    row = m.Bed(
        tenant_id=ctx.tenant_id, branch_id=room.branch_id, room_id=room.id,
        room_category_id=category.id, room_code=room.code, bed_code=bed_code,
        category_code=category.code, status="available", isolation_flag=payload.isolation_flag,
        equipment_tags=payload.equipment_tags, created_by=ctx.user.id, updated_by=ctx.user.id,
    )
    db.add(row)
    db.flush()
    write_audit(db, tenant_id=ctx.tenant_id, actor_user_id=ctx.user.id, action="CREATE",
                entity_type="bed", entity_id=row.id, new_values=payload.model_dump(mode="json"),
                correlation_id=ctx.correlation_id)
    db.commit()
    db.refresh(row)
    return serialize_bed(db, ctx.tenant_id, row)

"""Idempotent facility hierarchy bootstrap for legacy room/bed codes."""
from sqlalchemy.orm import Session

from app.models import entities as m


def _get_or_create(db: Session, tenant_id, branch_id, kind, code, name, parent_id=None, **extra):
    row = db.query(m.FacilityLocation).filter(
        m.FacilityLocation.tenant_id == tenant_id,
        m.FacilityLocation.branch_id == branch_id,
        m.FacilityLocation.code == code,
        m.FacilityLocation.is_deleted == False,
    ).first()
    if row:
        return row
    row = m.FacilityLocation(
        tenant_id=tenant_id, branch_id=branch_id, parent_id=parent_id,
        location_type=kind, code=code, name=name, **extra,
    )
    db.add(row)
    db.flush()
    return row

def _ensure_demo_ot(db: Session, tenant_id, branch_id, floor) -> None:
    tenant = db.query(m.Tenant).filter(m.Tenant.id == tenant_id).first()
    if not tenant or tenant.tenant_code != "demo":
        return
    department = db.query(m.Department).filter(
        m.Department.tenant_id == tenant_id, m.Department.branch_id == branch_id,
        m.Department.code == "OT", m.Department.is_deleted == False,
    ).first()
    if not department:
        department = m.Department(tenant_id=tenant_id, branch_id=branch_id, code="OT", name="Operation Theatre")
        db.add(department); db.flush()
    category = db.query(m.RoomCategory).filter(
        m.RoomCategory.tenant_id == tenant_id, m.RoomCategory.is_deleted == False,
    ).first()
    ward = _get_or_create(db, tenant_id, branch_id, "ward", "WARD-OT", "Operation Theatre Suite", floor.id, department_id=department.id)
    theatre = _get_or_create(db, tenant_id, branch_id, "room", "OT-1", "Main Operation Theatre", ward.id, department_id=department.id, room_category_id=category.id if category else None, attributes={"service_type": "operation_theatre"})
    if (theatre.attributes or {}).get("service_type") != "operation_theatre":
        theatre.attributes = {**(theatre.attributes or {}), "service_type": "operation_theatre"}
    tariff = db.query(m.Tariff).filter(m.Tariff.tenant_id == tenant_id, m.Tariff.code == "APPEND", m.Tariff.is_deleted == False).first()
    if not tariff:
        db.add(m.Tariff(tenant_id=tenant_id, branch_id=branch_id, code="APPEND", name="Appendectomy", category="procedure", amount=25000, currency="INR"))

def ensure_facility_hierarchy(db: Session) -> int:
    """Backfill linked locations for existing beds without changing their visible codes."""
    changed = 0
    branches = db.query(m.Branch).filter(m.Branch.is_deleted == False).all()
    for branch in branches:
        building = _get_or_create(
            db, branch.tenant_id, branch.id, "building", f"{branch.code}-BLDG",
            f"{branch.name} Building",
        )
        wing = _get_or_create(
            db, branch.tenant_id, branch.id, "wing", f"{branch.code}-WING-A",
            "Main Wing", building.id,
        )
        floor = _get_or_create(
            db, branch.tenant_id, branch.id, "floor", f"{branch.code}-FLOOR-01",
            "First Floor", wing.id,
        )
        _ensure_demo_ot(db, branch.tenant_id, branch.id, floor)
        beds = db.query(m.Bed).filter(
            m.Bed.tenant_id == branch.tenant_id, m.Bed.branch_id == branch.id,
            m.Bed.is_deleted == False,
        ).all()
        for bed in beds:
            category = None
            if bed.category_code:
                category = db.query(m.RoomCategory).filter(
                    m.RoomCategory.tenant_id == branch.tenant_id,
                    m.RoomCategory.code == bed.category_code,
                    m.RoomCategory.is_deleted == False,
                ).first()
            ward_code = f"WARD-{(bed.category_code or 'GEN').upper()}"
            ward_name = category.name if category else "General Ward"
            ward = _get_or_create(
                db, branch.tenant_id, branch.id, "ward", ward_code, ward_name, floor.id,
            )
            room_code = (bed.room_code or f"ROOM-{bed.bed_code}").upper()
            room = _get_or_create(
                db, branch.tenant_id, branch.id, "room", room_code, room_code, ward.id,
                room_category_id=category.id if category else None,
            )
            if not (room.attributes or {}).get("service_type"):
                room.attributes = {**(room.attributes or {}), "service_type": "patient_room"}
                changed += 1
            if bed.room_id != room.id or (category and bed.room_category_id != category.id):
                bed.room_id = room.id
                bed.room_category_id = category.id if category else bed.room_category_id
                changed += 1
        default_department = db.query(m.Department).filter(
            m.Department.tenant_id == branch.tenant_id,
            m.Department.branch_id == branch.id,
            m.Department.is_deleted == False,
        ).order_by(m.Department.name).first()
        room_candidates = db.query(m.FacilityLocation).filter(
            m.FacilityLocation.tenant_id == branch.tenant_id,
            m.FacilityLocation.branch_id == branch.id,
            m.FacilityLocation.location_type == "room",
            m.FacilityLocation.is_deleted == False,
        ).order_by(m.FacilityLocation.name).all()
        default_room = next(
            (room for room in room_candidates if (room.attributes or {}).get("service_type") in {"consultation", "patient_room"}),
            room_candidates[0] if room_candidates else None,
        )
        providers = db.query(m.Provider).filter(
            m.Provider.tenant_id == branch.tenant_id,
            m.Provider.branch_id == branch.id,
            m.Provider.is_deleted == False,
        ).all()
        for provider in providers:
            if not provider.department_id and default_department:
                provider.department_id = default_department.id
                changed += 1
            if not provider.primary_location_id and default_room:
                provider.primary_location_id = default_room.id
                changed += 1
    db.flush()
    return changed

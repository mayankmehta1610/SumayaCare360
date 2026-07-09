"""Ensure all system roles and demo users exist (idempotent)."""
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.data.demo_credentials import DEMO_ROLE_USERS, ROLE_DEFINITIONS
from app.models import entities as m


def ensure_roles(db: Session) -> None:
    for code, name, perms in ROLE_DEFINITIONS:
        row = db.query(m.Role).filter(m.Role.code == code, m.Role.tenant_id.is_(None)).first()
        if not row:
            db.add(m.Role(code=code, name=name, permissions=perms, is_system=True, tenant_id=None))
        else:
            row.permissions = perms
            row.name = name


def ensure_demo_users(db: Session, tenant_code: str = "demo") -> int:
    tenant = db.query(m.Tenant).filter(m.Tenant.tenant_code == tenant_code, m.Tenant.is_deleted == False).first()
    if not tenant:
        return 0
    admin = db.query(m.User).filter(m.User.tenant_id == tenant.id, m.User.role_code == "TENANT_ADMIN").first()
    actor_id = admin.id if admin else None
    branch = db.query(m.Branch).filter(m.Branch.tenant_id == tenant.id).first()
    added = 0
    for email, name, role, pwd, _desc in DEMO_ROLE_USERS:
        existing = db.query(m.User).filter(
            m.User.tenant_id == tenant.id, m.User.email == email, m.User.is_deleted == False,
        ).first()
        if existing:
            existing.role_code = role
            existing.full_name = name
            existing.hashed_password = hash_password(pwd)
            existing.status = "active"
            continue
        db.add(m.User(
            tenant_id=tenant.id,
            branch_id=branch.id if branch else None,
            email=email,
            full_name=name,
            hashed_password=hash_password(pwd),
            role_code=role,
            status="active",
            created_by=actor_id,
            updated_by=actor_id,
        ))
        added += 1
    return added


def link_patient_portal_user(db: Session, tenant_id) -> None:
    """Associate patient@demo user with first demo patient for portal self-access."""
    user = db.query(m.User).filter(
        m.User.tenant_id == tenant_id, m.User.email == "patient@demo.sumaya", m.User.is_deleted == False,
    ).first()
    if not user:
        return
    patient = db.query(m.Patient).filter(
        m.Patient.tenant_id == tenant_id, m.Patient.is_deleted == False,
    ).order_by(m.Patient.created_at).first()
    if patient and patient.email != user.email:
        patient.email = user.email


def bootstrap_roles_and_demo_users(db: Session) -> dict:
    ensure_roles(db)
    added = ensure_demo_users(db)
    tenant = db.query(m.Tenant).filter(m.Tenant.tenant_code == "demo").first()
    if tenant:
        link_patient_portal_user(db, tenant.id)
    return {"users_added": added, "roles": len(ROLE_DEFINITIONS)}

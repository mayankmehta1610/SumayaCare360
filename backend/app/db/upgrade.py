"""Upgrade seed data for existing databases."""
import os
import sqlalchemy as sa
from app.db.session import SessionLocal
from app.models import entities as m
from app.services.modules import sync_platform_modules
from app.db.schema_patches import apply_schema_patches
import app.models.entities  # noqa


def upgrade():
    print("Applying schema patches...")
    apply_schema_patches()

    db = SessionLocal()
    try:
        # Bootstrap fresh database
        tenant = db.query(m.Tenant).filter(m.Tenant.tenant_code == "demo").first()
        if not tenant:
            print("No demo tenant — running full seed")
            db.close()
            from app.db.seed import seed
            seed()
            db = SessionLocal()
            tenant = db.query(m.Tenant).filter(m.Tenant.tenant_code == "demo").first()

        if not tenant:
            print("ERROR: seed did not create demo tenant")
            return

        sync_platform_modules(db, None)

        admin = db.query(m.User).filter(m.User.is_super_admin == True).first()
        aid = admin.id if admin else None
        branch = db.query(m.Branch).filter(m.Branch.tenant_id == tenant.id).first()

        role = db.query(m.Role).filter(m.Role.code == "TENANT_ADMIN", m.Role.tenant_id.is_(None)).first()
        if role and "config:*" not in (role.permissions or []):
            role.permissions = list(role.permissions or []) + ["config:*", "vitals:*", "prescriptions:*"]

        if db.query(m.Bed).filter(m.Bed.tenant_id == tenant.id).count() == 0:
            for room, bed in [("R101", "B101"), ("R101", "B102"), ("R201", "B201"), ("ICU1", "ICU-B1")]:
                db.add(m.Bed(
                    tenant_id=tenant.id, branch_id=branch.id if branch else None,
                    room_code=room, bed_code=bed, category_code="ICU" if "ICU" in room else "GEN",
                    status="available", created_by=aid, updated_by=aid,
                ))

        if db.query(m.InsurancePayer).filter(m.InsurancePayer.tenant_id == tenant.id).count() == 0:
            for code, name in [("STAR", "Star Health"), ("ICICI", "ICICI Lombard")]:
                db.add(m.InsurancePayer(
                    tenant_id=tenant.id, code=code, name=name,
                    created_by=aid, updated_by=aid,
                ))

        for code, name, cat, amt in [
            ("IPD_DAY", "IPD Daily Charge", "inpatient", 2500),
            ("LAB_CBC", "CBC Lab Test", "lab", 350),
        ]:
            if not db.query(m.Tariff).filter(m.Tariff.tenant_id == tenant.id, m.Tariff.code == code).first():
                db.add(m.Tariff(
                    tenant_id=tenant.id, code=code, name=name, category=cat, amount=amt,
                    created_by=aid, updated_by=aid,
                ))

        if db.query(m.ReportDefinition).filter(m.ReportDefinition.tenant_id == tenant.id).count() == 0 and aid:
            db.add(m.ReportDefinition(
                tenant_id=tenant.id, code="opd-dashboard", name="OPD Dashboard",
                audience="Operations", module_code="appointment-and-queue-management",
                created_by=aid, updated_by=aid,
            ))

        db.commit()

        try:
            from app.db.demo_data import seed_demo_replay
            force = os.getenv("DEMO_REPLAY_FORCE", "").lower() in ("1", "true", "yes")
            seed_demo_replay(db, force=force)
        except Exception as exc:
            import traceback
            print(f"Demo replay warning: {exc}")
            traceback.print_exc()

        print("Upgrade complete")
    except Exception as exc:
        import traceback
        print(f"Upgrade failed: {exc}")
        traceback.print_exc()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    upgrade()

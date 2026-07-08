"""Upgrade seed data for existing databases."""
import os
import sqlalchemy as sa
from app.db.session import SessionLocal, engine, Base
from app.models import entities as m
from app.services.modules import sync_platform_modules
import app.models.entities  # noqa


def _sqlite_add_column_if_missing(conn, table: str, column: str, col_type: str):
    rows = conn.execute(sa.text(f"PRAGMA table_info({table})")).fetchall()
    if not any(r[1] == column for r in rows):
        conn.execute(sa.text(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}"))


def upgrade():
    Base.metadata.create_all(bind=engine)
    with engine.begin() as conn:
        if engine.dialect.name == "sqlite":
            _sqlite_add_column_if_missing(conn, "users", "mfa_enabled", "BOOLEAN DEFAULT 0")
            _sqlite_add_column_if_missing(conn, "users", "mfa_secret", "VARCHAR(255)")
            _sqlite_add_column_if_missing(conn, "medicines", "stock_qty", "NUMERIC DEFAULT 0")
            _sqlite_add_column_if_missing(conn, "lab_orders", "results", "JSON")
            _sqlite_add_column_if_missing(conn, "radiology_orders", "encounter_id", "VARCHAR(36)")
            _sqlite_add_column_if_missing(conn, "radiology_orders", "critical_flag", "BOOLEAN DEFAULT 0")
            _sqlite_add_column_if_missing(conn, "radiology_orders", "scheduled_at", "DATETIME")
            _sqlite_add_column_if_missing(conn, "pharmacy_dispenses", "prescription_line_id", "VARCHAR(36)")
            _sqlite_add_column_if_missing(conn, "pharmacy_dispenses", "encounter_id", "VARCHAR(36)")

    db = SessionLocal()
    try:
        sync_platform_modules(db, None)
        tenant = db.query(m.Tenant).filter(m.Tenant.tenant_code == "demo").first()
        if not tenant:
            print("No demo tenant — run full seed first")
            db.commit()
            return

        admin = db.query(m.User).filter(m.User.is_super_admin == True).first()
        aid = admin.id if admin else None
        branch = db.query(m.Branch).filter(m.Branch.tenant_id == tenant.id).first()

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

        # Load full demo replay dataset (patients, clinical, finance, all modules)
        try:
            from app.db.demo_data import seed_demo_replay
            force = os.getenv("DEMO_REPLAY_FORCE", "").lower() in ("1", "true", "yes")
            seed_demo_replay(db, force=force)
        except Exception as exc:
            import traceback
            print(f"Demo replay warning: {exc}")
            traceback.print_exc()

        print("Upgrade complete")
    finally:
        db.close()


if __name__ == "__main__":
    upgrade()

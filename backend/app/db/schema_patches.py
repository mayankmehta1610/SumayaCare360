"""Apply incremental schema patches for existing databases (SQLite + PostgreSQL)."""
from __future__ import annotations

import sqlalchemy as sa
from app.db.session import engine, Base
import app.models.entities  # noqa: F401 — register models

# (table, column, sqlite_type, postgres_type)
SCHEMA_PATCHES: list[tuple[str, str, str, str]] = [
    ("users", "mfa_enabled", "BOOLEAN DEFAULT 0", "BOOLEAN NOT NULL DEFAULT FALSE"),
    ("users", "mfa_secret", "VARCHAR(128)", "VARCHAR(128)"),
    ("users", "correlation_id", "VARCHAR(64)", "VARCHAR(64)"),
    ("users", "row_version", "INTEGER DEFAULT 1", "INTEGER NOT NULL DEFAULT 1"),
    ("medicines", "stock_qty", "NUMERIC DEFAULT 0", "NUMERIC DEFAULT 0"),
    ("lab_orders", "results", "JSON", "JSONB DEFAULT '{}'::jsonb"),
    ("lab_orders", "result_value", "VARCHAR(255)", "VARCHAR(255)"),
    ("lab_orders", "result_notes", "TEXT", "TEXT"),
    ("lab_orders", "critical_flag", "BOOLEAN DEFAULT 0", "BOOLEAN DEFAULT FALSE"),
    ("radiology_orders", "encounter_id", "VARCHAR(36)", "UUID"),
    ("radiology_orders", "critical_flag", "BOOLEAN DEFAULT 0", "BOOLEAN DEFAULT FALSE"),
    ("radiology_orders", "scheduled_at", "TIMESTAMP", "TIMESTAMP WITH TIME ZONE"),
    ("radiology_orders", "pacs_link", "VARCHAR(512)", "VARCHAR(512)"),
    ("pharmacy_dispenses", "prescription_line_id", "VARCHAR(36)", "UUID"),
    ("pharmacy_dispenses", "encounter_id", "VARCHAR(36)", "UUID"),
    ("pharmacy_dispenses", "substitution_code", "VARCHAR(64)", "VARCHAR(64)"),
    ("nursing_tasks", "completed_at", "TIMESTAMP", "TIMESTAMP WITH TIME ZONE"),
    ("nursing_tasks", "assigned_to", "VARCHAR(36)", "UUID"),
    ("insurance_claims", "pre_auth_no", "VARCHAR(128)", "VARCHAR(128)"),
    ("insurance_claims", "policy_no", "VARCHAR(128)", "VARCHAR(128)"),
    ("insurance_claims", "notes", "TEXT", "TEXT"),
]


def _sqlite_has_column(conn, table: str, column: str) -> bool:
    rows = conn.execute(sa.text(f"PRAGMA table_info({table})")).fetchall()
    return any(r[1] == column for r in rows)


def _postgres_has_column(conn, table: str, column: str) -> bool:
    row = conn.execute(
        sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = :t AND column_name = :c"
        ),
        {"t": table, "c": column},
    ).first()
    return row is not None


def apply_schema_patches() -> None:
    """Create missing tables then add any missing columns on existing tables."""
    Base.metadata.create_all(bind=engine)
    dialect = engine.dialect.name

    with engine.begin() as conn:
        for table, column, sqlite_type, pg_type in SCHEMA_PATCHES:
            try:
                if dialect == "sqlite":
                    if not _sqlite_has_column(conn, table, column):
                        conn.execute(sa.text(f"ALTER TABLE {table} ADD COLUMN {column} {sqlite_type}"))
                        print(f"  + sqlite {table}.{column}")
                elif dialect == "postgresql":
                    tbl = conn.execute(
                        sa.text(
                            "SELECT 1 FROM information_schema.tables "
                            "WHERE table_schema = 'public' AND table_name = :t"
                        ),
                        {"t": table},
                    ).first()
                    if tbl and not _postgres_has_column(conn, table, column):
                        conn.execute(
                            sa.text(f'ALTER TABLE "{table}" ADD COLUMN IF NOT EXISTS "{column}" {pg_type}')
                        )
                        print(f"  + postgres {table}.{column}")
            except Exception as exc:
                print(f"  ! patch {table}.{column} skipped: {exc}")

    print(f"Schema patches applied ({dialect})")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import get_settings
from app.api.v1.router import router as api_router
from app.api.v1.modules_router import router as modules_router
from app.api.v1.expanded_router import router as expanded_router
from app.api.v1.portal_router import router as portal_router
from app.api.v1.docs_router import router as docs_router
from app.api.v1.clinical_router import router as clinical_router
from app.api.v1.finance_router import router as finance_router
from app.api.v1.pathways_router import router as pathways_router
from app.api.v1.masters_router import router as masters_router
from app.api.v1.emergency_router import router as emergency_router
from app.api.v1.ot_router import router as ot_router
from app.api.v1.dedicated_router import router as dedicated_router
from app.api.v1.features_router import router as features_router
from app.api.v1.patient_admin_router import router as patient_admin_router
from app.middleware.api_audit import ApiAuditMiddleware
from app.db.session import Base, engine
from app.models import entities as m
import app.models.entities  # noqa: F401 — register models

settings = get_settings()

app = FastAPI(
    title="SUMAYA Care 360 API",
    description="Multi-tenant Hospital, Clinic & Telemedicine Platform",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list + ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(ApiAuditMiddleware)

app.include_router(api_router, prefix="/api/v1")
app.include_router(masters_router, prefix="/api/v1")
app.include_router(finance_router, prefix="/api/v1")
app.include_router(pathways_router, prefix="/api/v1")
app.include_router(expanded_router, prefix="/api/v1")
app.include_router(portal_router, prefix="/api/v1")
app.include_router(docs_router, prefix="/api/v1")
app.include_router(modules_router, prefix="/api/v1")
app.include_router(clinical_router, prefix="/api/v1")
app.include_router(emergency_router, prefix="/api/v1")
app.include_router(ot_router, prefix="/api/v1")
app.include_router(dedicated_router, prefix="/api/v1")
app.include_router(features_router, prefix="/api/v1")
app.include_router(patient_admin_router, prefix="/api/v1")


@app.on_event("startup")
def on_startup():
    from app.db.schema_patches import apply_schema_patches
    apply_schema_patches()
    from app.db.session import SessionLocal
    from app.services.modules import sync_platform_modules
    from app.db.demo_data import ensure_demo_data
    db = SessionLocal()
    try:
        sync_platform_modules(db, None)
        db.commit()
        from app.services.features import sync_feature_catalog
        sync_feature_catalog(db, None)
        db.commit()
        tenant = db.query(m.Tenant).filter(m.Tenant.tenant_code == "demo").first()
        if tenant:
            ensure_demo_data(db)
    except Exception as exc:
        import traceback
        print(f"Startup seed warning: {exc}")
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import get_settings
from app.api.v1.router import router as api_router
from app.api.v1.modules_router import router as modules_router
from app.middleware.api_audit import ApiAuditMiddleware
from app.db.session import Base, engine
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
app.include_router(modules_router, prefix="/api/v1")


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    from app.db.session import SessionLocal
    from app.services.modules import sync_platform_modules
    db = SessionLocal()
    try:
        sync_platform_modules(db, None)
        db.commit()
    finally:
        db.close()

"""Unified patient administration APIs."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.deps import AuthContext, require_tenant
from app.db.session import get_db
from app.services.patient_administration import patient_board, patient_journey

router = APIRouter(prefix="/patient-administration", tags=["patient-administration"])


@router.get("/board")
def get_patient_board(query: str = "", limit: int = Query(100, ge=1, le=500),
                      ctx: AuthContext = Depends(require_tenant), db: Session = Depends(get_db)):
    return patient_board(db, ctx.tenant_id, query=query, limit=limit)


@router.get("/patients/{patient_id}/journey")
def get_patient_journey(patient_id: UUID, ctx: AuthContext = Depends(require_tenant),
                        db: Session = Depends(get_db)):
    result = patient_journey(db, ctx.tenant_id, patient_id)
    if not result:
        raise HTTPException(404, "Patient not found")
    return result

"""Finance domain services — insurance claims lifecycle, AR aging, refunds."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import entities as m
from app.services.audit import write_audit
from app.services.workflow_engine import validate_transition

CLAIM_MODULE = "insurance-and-claims"
CLAIM_STATUSES = ("draft", "submitted", "under_review", "approved", "denied", "paid")


def _claim_no(db: Session, tenant_id: UUID) -> str:
    n = db.query(m.InsuranceClaim).filter(m.InsuranceClaim.tenant_id == tenant_id).count() + 1
    return f"CLM-{n:06d}"


def list_claims(db: Session, tenant_id: UUID, *, status: Optional[str] = None) -> list[m.InsuranceClaim]:
    q = db.query(m.InsuranceClaim).filter(
        m.InsuranceClaim.tenant_id == tenant_id,
        m.InsuranceClaim.is_deleted == False,
    )
    if status:
        q = q.filter(m.InsuranceClaim.status == status)
    return q.order_by(m.InsuranceClaim.created_at.desc()).limit(200).all()


def get_claim(db: Session, tenant_id: UUID, claim_id: UUID) -> m.InsuranceClaim:
    row = db.query(m.InsuranceClaim).filter(
        m.InsuranceClaim.id == claim_id,
        m.InsuranceClaim.tenant_id == tenant_id,
        m.InsuranceClaim.is_deleted == False,
    ).first()
    if not row:
        raise HTTPException(404, "Claim not found")
    return row


def serialize_claim(row: m.InsuranceClaim, *, include_patient: bool = False) -> dict[str, Any]:
    out: dict[str, Any] = {
        "id": str(row.id),
        "claim_no": row.claim_no,
        "patient_id": str(row.patient_id),
        "payer_code": row.payer_code,
        "status": row.status,
        "amount": float(row.amount or 0),
        "pre_auth_no": row.pre_auth_no,
        "policy_no": row.policy_no,
        "notes": row.notes,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }
    return out


def create_claim(
    db: Session,
    *,
    tenant_id: UUID,
    patient_id: UUID,
    payer_code: str,
    amount: float,
    policy_no: str = "",
    notes: str = "",
    actor_id: UUID,
    correlation_id: Optional[str] = None,
) -> m.InsuranceClaim:
    patient = db.query(m.Patient).filter(
        m.Patient.id == patient_id, m.Patient.tenant_id == tenant_id, m.Patient.is_deleted == False
    ).first()
    if not patient:
        raise HTTPException(404, "Patient not found")
    payer = db.query(m.InsurancePayer).filter(
        m.InsurancePayer.tenant_id == tenant_id, m.InsurancePayer.code == payer_code
    ).first()
    if not payer:
        raise HTTPException(400, "Unknown payer — configure insurance payer master")

    row = m.InsuranceClaim(
        tenant_id=tenant_id,
        patient_id=patient_id,
        payer_code=payer_code,
        claim_no=_claim_no(db, tenant_id),
        amount=amount,
        policy_no=policy_no,
        notes=notes,
        status="draft",
        created_by=actor_id,
        updated_by=actor_id,
    )
    db.add(row)
    db.flush()
    write_audit(
        db, tenant_id=tenant_id, actor_user_id=actor_id, action="CREATE",
        entity_type="insurance_claim", entity_id=str(row.id),
        new_values={"claim_no": row.claim_no, "amount": amount, "payer_code": payer_code},
        correlation_id=correlation_id,
    )
    return row


def update_claim_status(
    db: Session,
    row: m.InsuranceClaim,
    new_status: str,
    *,
    actor_id: UUID,
    correlation_id: Optional[str] = None,
    reason: Optional[str] = None,
) -> m.InsuranceClaim:
    if new_status not in CLAIM_STATUSES:
        raise HTTPException(400, f"Invalid claim status. Allowed: {CLAIM_STATUSES}")
    validate_transition(
        db, CLAIM_MODULE, row.status, new_status, tenant_id=row.tenant_id,
    )
    old = row.status
    row.status = new_status
    row.updated_by = actor_id
    write_audit(
        db, tenant_id=row.tenant_id, actor_user_id=actor_id, action="STATUS_CHANGE",
        entity_type="insurance_claim", entity_id=str(row.id),
        old_values={"status": old}, new_values={"status": new_status},
        reason=reason, correlation_id=correlation_id,
    )
    return row


def pre_auth_check_stub(
    db: Session,
    *,
    tenant_id: UUID,
    patient_id: UUID,
    payer_code: str,
    amount: float,
    policy_no: str = "",
    procedure_codes: Optional[list[str]] = None,
) -> dict[str, Any]:
    """Stub pre-authorization eligibility check — returns synthetic approval."""
    payer = db.query(m.InsurancePayer).filter(
        m.InsurancePayer.tenant_id == tenant_id, m.InsurancePayer.code == payer_code
    ).first()
    if not payer:
        raise HTTPException(400, "Unknown payer — configure insurance payer master")
    patient = db.query(m.Patient).filter(
        m.Patient.id == patient_id, m.Patient.tenant_id == tenant_id
    ).first()
    if not patient:
        raise HTTPException(404, "Patient not found")

    rules = payer.claim_rules or {}
    preauth_required = bool(rules.get("preauth_required", amount > 5000))
    approved = amount <= float(rules.get("preauth_limit", 100000))
    pre_auth_no = f"PA-{payer_code[:4].upper()}-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M')}"

    return {
        "eligible": True,
        "preauth_required": preauth_required,
        "approved": approved,
        "pre_auth_no": pre_auth_no if approved else None,
        "payer_code": payer_code,
        "policy_no": policy_no,
        "requested_amount": amount,
        "approved_amount": amount if approved else 0,
        "procedure_codes": procedure_codes or [],
        "message": "Pre-auth approved (stub)" if approved else "Pre-auth denied — amount exceeds limit (stub)",
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }


def compute_ar_aging(db: Session, tenant_id: UUID) -> dict[str, Any]:
    """Group outstanding invoices by status and age bucket."""
    now = datetime.now(timezone.utc)
    invoices = db.query(m.Invoice).filter(
        m.Invoice.tenant_id == tenant_id,
        m.Invoice.is_deleted == False,
        m.Invoice.status.in_(("issued", "partial", "overdue")),
    ).all()

    buckets = {
        "current_0_30": {"label": "0–30 days", "count": 0, "amount": 0.0, "invoices": []},
        "days_31_60": {"label": "31–60 days", "count": 0, "amount": 0.0, "invoices": []},
        "days_61_90": {"label": "61–90 days", "count": 0, "amount": 0.0, "invoices": []},
        "over_90": {"label": "90+ days", "count": 0, "amount": 0.0, "invoices": []},
    }
    by_status: dict[str, dict[str, Any]] = {}

    for inv in invoices:
        total = float(inv.total or 0)
        paid = sum(
            float(p.amount or 0)
            for p in db.query(m.Payment).filter(
                m.Payment.invoice_id == inv.id, m.Payment.status == "succeeded"
            ).all()
        )
        balance = max(total - paid, 0)
        if balance <= 0:
            continue

        created = inv.created_at
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        age_days = (now - created).days

        if age_days <= 30:
            bucket_key = "current_0_30"
        elif age_days <= 60:
            bucket_key = "days_31_60"
        elif age_days <= 90:
            bucket_key = "days_61_90"
        else:
            bucket_key = "over_90"

        inv_summary = {
            "id": str(inv.id),
            "invoice_no": inv.invoice_no,
            "patient_id": str(inv.patient_id),
            "status": inv.status,
            "total": total,
            "balance": balance,
            "age_days": age_days,
        }
        buckets[bucket_key]["count"] += 1
        buckets[bucket_key]["amount"] += balance
        buckets[bucket_key]["invoices"].append(inv_summary)

        st = inv.status
        if st not in by_status:
            by_status[st] = {"count": 0, "amount": 0.0}
        by_status[st]["count"] += 1
        by_status[st]["amount"] += balance

    total_outstanding = sum(b["amount"] for b in buckets.values())
    return {
        "as_of": now.isoformat(),
        "total_outstanding": round(total_outstanding, 2),
        "by_status": by_status,
        "by_age": buckets,
    }


def create_refund_stub(
    db: Session,
    *,
    tenant_id: UUID,
    payment_id: UUID,
    amount: float,
    reason: str = "",
    actor_id: UUID,
    correlation_id: Optional[str] = None,
) -> dict[str, Any]:
    """Stub refund — records intent and returns synthetic gateway reference."""
    payment = db.query(m.Payment).filter(
        m.Payment.id == payment_id, m.Payment.tenant_id == tenant_id
    ).first()
    if not payment:
        raise HTTPException(404, "Payment not found")
    if amount <= 0 or amount > float(payment.amount or 0):
        raise HTTPException(400, "Refund amount must be positive and not exceed payment amount")

    inv = db.query(m.Invoice).filter(m.Invoice.id == payment.invoice_id).first()
    gateway_ref = f"RFND-{payment.id.hex[:8].upper()}"

    refund = m.PaymentRefund(
        tenant_id=tenant_id,
        payment_id=payment.id,
        invoice_id=payment.invoice_id,
        amount=amount,
        reason=reason,
        status="pending",
        gateway_ref=gateway_ref,
        created_by=actor_id,
        updated_by=actor_id,
    )
    db.add(refund)
    db.flush()

    if inv and inv.status == "paid" and amount >= float(payment.amount or 0):
        inv.status = "refunded"
        inv.updated_by = actor_id

    write_audit(
        db, tenant_id=tenant_id, actor_user_id=actor_id, action="REFUND",
        entity_type="payment_refund", entity_id=str(refund.id),
        new_values={"payment_id": str(payment_id), "amount": amount, "gateway_ref": gateway_ref},
        correlation_id=correlation_id,
    )
    return {
        "id": str(refund.id),
        "payment_id": str(payment_id),
        "invoice_id": str(payment.invoice_id),
        "amount": amount,
        "status": refund.status,
        "gateway_ref": gateway_ref,
        "message": "Refund queued (stub gateway)",
    }

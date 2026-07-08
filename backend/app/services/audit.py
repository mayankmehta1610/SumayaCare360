from __future__ import annotations
import uuid
from typing import Any, Optional
from sqlalchemy.orm import Session
from app.models.entities import AuditLog, ApiAuditLog


SENSITIVE_KEYS = {
    "password", "hashed_password", "token", "access_token", "refresh_token",
    "card_number", "cvv", "s3_secret_key", "secret", "authorization"
}


def mask_payload(data: Any) -> Any:
    if isinstance(data, dict):
        out = {}
        for k, v in data.items():
            if k.lower() in SENSITIVE_KEYS or "password" in k.lower() or "secret" in k.lower():
                out[k] = "***MASKED***"
            else:
                out[k] = mask_payload(v)
        return out
    if isinstance(data, list):
        return [mask_payload(i) for i in data]
    return data


def write_audit(
    db: Session,
    *,
    tenant_id: Optional[uuid.UUID],
    actor_user_id: Optional[uuid.UUID],
    action: str,
    entity_type: str,
    entity_id: Optional[str] = None,
    old_values: Any = None,
    new_values: Any = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    reason: Optional[str] = None,
    correlation_id: Optional[str] = None,
) -> AuditLog:
    row = AuditLog(
        tenant_id=tenant_id,
        actor_user_id=actor_user_id,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id else None,
        old_values=mask_payload(old_values) if old_values is not None else None,
        new_values=mask_payload(new_values) if new_values is not None else None,
        ip_address=ip_address,
        user_agent=user_agent,
        reason=reason,
        correlation_id=correlation_id,
        created_by=actor_user_id,
        updated_by=actor_user_id,
    )
    db.add(row)
    return row


def write_api_audit(
    db: Session,
    *,
    tenant_id: Optional[uuid.UUID],
    actor_user_id: Optional[uuid.UUID],
    method: str,
    path: str,
    status_code: int,
    latency_ms: int,
    request_body: Any = None,
    response_summary: Any = None,
    ip_address: Optional[str] = None,
    correlation_id: Optional[str] = None,
) -> ApiAuditLog:
    row = ApiAuditLog(
        tenant_id=tenant_id,
        actor_user_id=actor_user_id,
        method=method,
        path=path,
        status_code=status_code,
        latency_ms=latency_ms,
        request_body_masked=mask_payload(request_body) if request_body is not None else None,
        response_summary=response_summary,
        ip_address=ip_address,
        correlation_id=correlation_id,
    )
    db.add(row)
    return row

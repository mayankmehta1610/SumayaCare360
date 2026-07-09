from dataclasses import dataclass
from typing import Optional
from uuid import UUID
from fastapi import Depends, Header, HTTPException, status, Request
from jose import JWTError
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import decode_token
from app.models.entities import Tenant, User, Role


ROLE_PERMISSIONS = {
    "SUPER_ADMIN": ["*"],
    "TENANT_ADMIN": [
        "tenants:read", "branches:*", "users:*", "masters:*", "patients:*",
        "providers:*", "appointments:*", "encounters:*", "telemedicine:*",
        "billing:*", "audit:read", "config:*", "vitals:*", "prescriptions:*",
        "reports:read", "clinical:*", "laboratory:*", "radiology:*", "pharmacy:*",
    ],
    "BRANCH_ADMIN": [
        "branches:read", "masters:*", "patients:*", "providers:*",
        "appointments:*", "encounters:read", "billing:read", "audit:read", "reports:read",
    ],
    "DOCTOR": [
        "patients:read", "appointments:*", "encounters:*", "prescriptions:*",
        "telemedicine:*", "masters:read", "vitals:*", "clinical:read", "clinical:*",
        "laboratory:read", "radiology:read", "pharmacy:read",
    ],
    "NURSE": [
        "patients:read", "appointments:read", "encounters:*", "vitals:*",
        "masters:read", "clinical:read", "clinical:*",
    ],
    "RECEPTIONIST": [
        "patients:*", "appointments:*", "queue:*", "masters:read", "billing:read",
    ],
    "BILLING_STAFF": [
        "patients:read", "billing:*", "tariffs:read", "masters:read", "reports:read",
    ],
    "PHARMACIST": [
        "patients:read", "masters:read", "clinical:read", "pharmacy:*",
    ],
    "LAB_TECH": [
        "patients:read", "masters:read", "clinical:read", "laboratory:*",
    ],
    "RADIOLOGIST": [
        "patients:read", "masters:read", "clinical:read", "radiology:*",
    ],
    "PATIENT": [
        "appointments:self", "telemedicine:join", "patients:self", "billing:self",
    ],
}


@dataclass
class AuthContext:
    user: User
    tenant: Optional[Tenant]
    tenant_id: Optional[UUID]
    tenant_code: Optional[str]
    role_code: str
    permissions: list[str]
    correlation_id: str


def permissions_for_role(role_code: str, db: Session, tenant_id: Optional[UUID]) -> list[str]:
    role = (
        db.query(Role)
        .filter(Role.code == role_code, Role.is_deleted == False)
        .filter((Role.tenant_id == tenant_id) | (Role.tenant_id.is_(None)))
        .first()
    )
    if role and role.permissions:
        return list(role.permissions)
    return list(ROLE_PERMISSIONS.get(role_code, []))


def has_permission(perms: list[str], needed: str) -> bool:
    if "*" in perms:
        return True
    if needed in perms:
        return True
    resource = needed.split(":")[0]
    if f"{resource}:*" in perms:
        return True
    return False


def get_current_context(
    request: Request,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(default=None),
    x_tenant_code: Optional[str] = Header(default=None, alias="X-Tenant-Code"),
    x_correlation_id: Optional[str] = Header(default=None, alias="X-Correlation-Id"),
) -> AuthContext:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1]
    try:
        payload = decode_token(token)
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == user_id, User.is_deleted == False).first()
    if not user or user.status != "active":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User inactive")

    tenant = None
    tenant_code = x_tenant_code or payload.get("tenant_code")
    if user.is_super_admin:
        if tenant_code:
            tenant = db.query(Tenant).filter(Tenant.tenant_code == tenant_code, Tenant.is_deleted == False).first()
    else:
        if not tenant_code:
            raise HTTPException(status_code=400, detail="X-Tenant-Code required")
        tenant = db.query(Tenant).filter(Tenant.tenant_code == tenant_code, Tenant.is_deleted == False).first()
        if not tenant or (user.tenant_id and user.tenant_id != tenant.id):
            raise HTTPException(status_code=403, detail="Cross-tenant access denied")

    perms = permissions_for_role(user.role_code, db, tenant.id if tenant else None)
    corr = x_correlation_id or request.headers.get("X-Request-Id") or str(payload.get("jti") or user.id)[:36]
    return AuthContext(
        user=user,
        tenant=tenant,
        tenant_id=tenant.id if tenant else None,
        tenant_code=tenant.tenant_code if tenant else tenant_code,
        role_code=user.role_code,
        permissions=perms,
        correlation_id=corr,
    )


def require_permission(permission: str):
    def _dep(ctx: AuthContext = Depends(get_current_context)) -> AuthContext:
        if not has_permission(ctx.permissions, permission):
            raise HTTPException(status_code=403, detail=f"Missing permission: {permission}")
        return ctx
    return _dep


def require_tenant(ctx: AuthContext = Depends(get_current_context)) -> AuthContext:
    if not ctx.tenant_id:
        raise HTTPException(status_code=400, detail="Tenant context required")
    return ctx


def resolve_tenant_context(
    ctx: AuthContext = Depends(get_current_context),
    db: Session = Depends(get_db),
) -> AuthContext:
    """MUT: resolve tenant for multi-tenant APIs. Super admin without tenant uses demo."""
    if ctx.tenant_id:
        return ctx
    if ctx.user.is_super_admin:
        demo = db.query(Tenant).filter(Tenant.tenant_code == "demo", Tenant.is_deleted == False).first()
        if demo:
            perms = permissions_for_role(ctx.user.role_code, db, demo.id)
            return AuthContext(
                user=ctx.user,
                tenant=demo,
                tenant_id=demo.id,
                tenant_code=demo.tenant_code,
                role_code=ctx.role_code,
                permissions=perms,
                correlation_id=ctx.correlation_id,
            )
    raise HTTPException(status_code=400, detail="Tenant context required — log in with tenant code (e.g. demo)")

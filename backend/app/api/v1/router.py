from datetime import datetime, timezone
from uuid import uuid4, UUID
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.db.session import get_db
from app.core.security import hash_password, verify_password, create_access_token, decode_token
from app.core.deps import (
    AuthContext, get_current_context, require_permission, require_tenant, permissions_for_role
)
from app.services.audit import write_audit
from app.services.care_journey import encounter_detail, discharge_encounter, patient_chart
from app.schemas.schemas import *
from app.models import entities as m

router = APIRouter()


def _client_meta(request: Request):
    return request.client.host if request.client else None, request.headers.get("user-agent")


@router.get("/health")
def health():
    return {"status": "ok", "service": "sumayacare360-api", "time": datetime.now(timezone.utc).isoformat()}


# ───────────────────────── Auth ─────────────────────────
@router.post("/auth/login", response_model=TokenResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    tenant = None
    if payload.tenant_code:
        tenant = db.query(m.Tenant).filter(
            m.Tenant.tenant_code == payload.tenant_code, m.Tenant.is_deleted == False
        ).first()
        if not tenant:
            raise HTTPException(404, "Tenant not found")

    q = db.query(m.User).filter(m.User.email == payload.email, m.User.is_deleted == False)
    if tenant:
        q = q.filter(or_(m.User.tenant_id == tenant.id, m.User.is_super_admin == True))
    else:
        q = q.filter(m.User.is_super_admin == True)

    user = q.first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(401, "Invalid credentials")

    tenant_code = tenant.tenant_code if tenant else None
    perms = permissions_for_role(user.role_code, db, tenant.id if tenant else None)
    token = create_access_token({
        "sub": str(user.id),
        "tenant_code": tenant_code,
        "role": user.role_code,
        "jti": str(uuid4()),
    })
    ip, ua = _client_meta(request)
    write_audit(
        db, tenant_id=tenant.id if tenant else None, actor_user_id=user.id,
        action="LOGIN", entity_type="user", entity_id=str(user.id),
        ip_address=ip, user_agent=ua,
    )
    db.commit()
    return TokenResponse(
        access_token=token,
        tenant_code=tenant_code,
        role_code=user.role_code,
        full_name=user.full_name,
        permissions=perms,
    )


@router.get("/auth/me")
def me(ctx: AuthContext = Depends(get_current_context)):
    return {
        "id": str(ctx.user.id),
        "email": ctx.user.email,
        "full_name": ctx.user.full_name,
        "role_code": ctx.role_code,
        "tenant_code": ctx.tenant_code,
        "permissions": ctx.permissions,
        "is_super_admin": ctx.user.is_super_admin,
    }


@router.post("/auth/refresh", response_model=TokenResponse)
def refresh_token(payload: RefreshRequest, db: Session = Depends(get_db)):
    try:
        data = decode_token(payload.access_token)
    except Exception:
        raise HTTPException(401, "Invalid or expired token")
    user = db.query(m.User).filter(m.User.id == data.get("sub"), m.User.is_deleted == False).first()
    if not user:
        raise HTTPException(401, "User not found")
    tenant_code = data.get("tenant_code")
    tenant = None
    if tenant_code:
        tenant = db.query(m.Tenant).filter(m.Tenant.tenant_code == tenant_code).first()
    perms = permissions_for_role(user.role_code, db, tenant.id if tenant else None)
    token = create_access_token({
        "sub": str(user.id),
        "tenant_code": tenant_code,
        "role": user.role_code,
        "jti": str(uuid4()),
    })
    return TokenResponse(
        access_token=token,
        tenant_code=tenant_code,
        role_code=user.role_code,
        full_name=user.full_name,
        permissions=perms,
    )


@router.post("/auth/logout")
def logout(request: Request, ctx: AuthContext = Depends(get_current_context), db: Session = Depends(get_db)):
    ip, ua = _client_meta(request)
    write_audit(
        db, tenant_id=ctx.tenant_id, actor_user_id=ctx.user.id,
        action="LOGOUT", entity_type="user", entity_id=str(ctx.user.id),
        ip_address=ip, user_agent=ua, correlation_id=ctx.correlation_id,
    )
    db.commit()
    return {"message": "Logged out"}


@router.post("/auth/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    import hashlib
    import secrets
    from datetime import timedelta

    q = db.query(m.User).filter(m.User.email == payload.email, m.User.is_deleted == False)
    if payload.tenant_code:
        tenant = db.query(m.Tenant).filter(m.Tenant.tenant_code == payload.tenant_code).first()
        if tenant:
            q = q.filter(m.User.tenant_id == tenant.id)
    user = q.first()
    if not user:
        return {"message": "If the account exists, a reset link has been queued"}
    raw = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw.encode()).hexdigest()
    from datetime import datetime, timezone
    row = m.PasswordResetToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        created_by=user.id,
        updated_by=user.id,
    )
    db.add(row)
    if user.tenant_id:
        outbox = m.NotificationOutbox(
            tenant_id=user.tenant_id,
            channel="email",
            recipient=payload.email,
            subject="SUMAYA Care 360 — Password reset",
            body=f"Reset token (dev): {raw}",
            status="pending",
            created_by=user.id,
            updated_by=user.id,
        )
        db.add(outbox)
    db.commit()
    return {"message": "If the account exists, a reset link has been queued"}


@router.post("/auth/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    import hashlib
    from datetime import datetime, timezone

    token_hash = hashlib.sha256(payload.token.encode()).hexdigest()
    row = db.query(m.PasswordResetToken).filter(
        m.PasswordResetToken.token_hash == token_hash,
        m.PasswordResetToken.used == False,
        m.PasswordResetToken.expires_at > datetime.now(timezone.utc),
    ).first()
    if not row:
        raise HTTPException(400, "Invalid or expired reset token")
    user = db.query(m.User).filter(m.User.id == row.user_id).first()
    if not user:
        raise HTTPException(400, "User not found")
    user.hashed_password = hash_password(payload.new_password)
    row.used = True
    db.commit()
    return {"message": "Password updated"}


@router.get("/auth/mfa/status")
def mfa_status(ctx: AuthContext = Depends(get_current_context)):
    return {"mfa_enabled": bool(ctx.user.mfa_enabled)}


@router.post("/auth/mfa/setup", response_model=MfaSetupResponse)
def mfa_setup(ctx: AuthContext = Depends(get_current_context), db: Session = Depends(get_db)):
    import secrets
    secret = secrets.token_hex(16)
    ctx.user.mfa_secret = secret
    ctx.user.mfa_enabled = False
    db.commit()
    label = ctx.user.email
    return MfaSetupResponse(
        secret=secret,
        otpauth_url=f"otpauth://totp/SUMAYA:{label}?secret={secret}&issuer=SUMAYACare360",
    )


@router.post("/auth/mfa/verify")
def mfa_verify(payload: MfaVerifyRequest, ctx: AuthContext = Depends(get_current_context), db: Session = Depends(get_db)):
    if not ctx.user.mfa_secret:
        raise HTTPException(400, "MFA not initialized — call /auth/mfa/setup first")
    import hmac
    import struct
    import time

    def _totp(secret_hex: str, window: int = 0) -> str:
        key = bytes.fromhex(secret_hex)
        counter = int(time.time()) // 30 + window
        msg = struct.pack(">Q", counter)
        digest = hmac.new(key, msg, "sha1").digest()
        offset = digest[-1] & 0x0F
        code = (struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF) % 1000000
        return f"{code:06d}"

    ok = any(hmac.compare_digest(payload.code, _totp(ctx.user.mfa_secret, w)) for w in (0, -1, 1))
    if not ok:
        raise HTTPException(401, "Invalid MFA code")
    ctx.user.mfa_enabled = True
    db.commit()
    return {"mfa_enabled": True}


# ───────────────────────── Super Admin Tenants ─────────────────────────
@router.get("/super-admin/tenants")
def list_tenants(ctx: AuthContext = Depends(require_permission("*")), db: Session = Depends(get_db)):
    rows = db.query(m.Tenant).filter(m.Tenant.is_deleted == False).order_by(m.Tenant.name).all()
    return [TenantOut.model_validate(r) for r in rows]


@router.post("/super-admin/tenants", response_model=TenantOut)
def create_tenant(payload: TenantCreate, request: Request, ctx: AuthContext = Depends(require_permission("*")), db: Session = Depends(get_db)):
    if db.query(m.Tenant).filter(m.Tenant.tenant_code == payload.tenant_code).first():
        raise HTTPException(409, "tenant_code already exists")
    tenant = m.Tenant(
        tenant_code=payload.tenant_code.lower(),
        name=payload.name,
        plan_code=payload.plan_code,
        modules=payload.modules,
        branding={"primary_color": "#0B6E4F", "app_name": payload.name},
        created_by=ctx.user.id,
        updated_by=ctx.user.id,
    )
    db.add(tenant)
    db.flush()
    branch = m.Branch(
        tenant_id=tenant.id, code="MAIN", name=payload.branch_name,
        status="active", created_by=ctx.user.id, updated_by=ctx.user.id,
    )
    db.add(branch)
    db.flush()
    admin = m.User(
        tenant_id=tenant.id, branch_id=branch.id,
        email=payload.admin_email, full_name=payload.admin_full_name,
        hashed_password=hash_password(payload.admin_password),
        role_code="TENANT_ADMIN", created_by=ctx.user.id, updated_by=ctx.user.id,
    )
    db.add(admin)
    _seed_tenant_defaults(db, tenant.id, ctx.user.id)
    ip, ua = _client_meta(request)
    write_audit(
        db, tenant_id=tenant.id, actor_user_id=ctx.user.id, action="CREATE",
        entity_type="tenant", entity_id=str(tenant.id),
        new_values={"tenant_code": tenant.tenant_code, "name": tenant.name},
        ip_address=ip, user_agent=ua, correlation_id=ctx.correlation_id,
    )
    db.commit()
    db.refresh(tenant)
    return TenantOut.model_validate(tenant)


@router.post("/super-admin/tenants/{tenant_id}/activate")
def activate_tenant(tenant_id: str, request: Request, ctx: AuthContext = Depends(require_permission("*")), db: Session = Depends(get_db)):
    tenant = db.query(m.Tenant).filter(m.Tenant.id == tenant_id, m.Tenant.is_deleted == False).first()
    if not tenant:
        raise HTTPException(404, "Tenant not found")
    tenant.status = "active"
    tenant.updated_by = ctx.user.id
    ip, ua = _client_meta(request)
    write_audit(
        db, tenant_id=tenant.id, actor_user_id=ctx.user.id, action="ACTIVATE",
        entity_type="tenant", entity_id=str(tenant.id),
        new_values={"status": "active"}, ip_address=ip, user_agent=ua,
        correlation_id=ctx.correlation_id,
    )
    db.commit()
    return {"id": str(tenant.id), "status": tenant.status}


def _seed_tenant_defaults(db: Session, tenant_id, user_id):
    defaults = [
        ("OPD_CONSULT", "OPD Consultation", "consultation", 500),
        ("TELE_CONSULT", "Telemedicine Consultation", "consultation", 400),
        ("REG_FEE", "Registration Fee", "registration", 100),
        ("IPD_DAY", "IPD Daily Charge", "inpatient", 2500),
        ("LAB_CBC", "CBC Lab Test", "lab", 350),
    ]
    for code, name, cat, amt in defaults:
        db.add(m.Tariff(
            tenant_id=tenant_id, code=code, name=name, category=cat,
            amount=amt, created_by=user_id, updated_by=user_id,
        ))
    for code, name, form, strength in [
        ("PARA500", "Paracetamol", "Tablet", "500mg"),
        ("AMOX250", "Amoxicillin", "Capsule", "250mg"),
    ]:
        db.add(m.Medicine(
            tenant_id=tenant_id, code=code, name=name, form=form,
            strength=strength, created_by=user_id, updated_by=user_id,
        ))
    db.add(m.LabTest(
        tenant_id=tenant_id, code="CBC", name="Complete Blood Count",
        sample_type="Blood", created_by=user_id, updated_by=user_id,
    ))
    db.add(m.ClinicalTemplate(
        tenant_id=tenant_id, code="SOAP", name="SOAP Note",
        template_type="progress",
        body={"sections": ["Subjective", "Objective", "Assessment", "Plan"]},
        created_by=user_id, updated_by=user_id,
    ))
    db.add(m.NotificationTemplate(
        tenant_id=tenant_id, code="APPT_REMINDER", channel="email",
        subject="Appointment Reminder",
        body="Dear {{patient_name}}, your appointment is at {{time}}.",
        created_by=user_id, updated_by=user_id,
    ))
    db.add(m.ConsentTemplate(
        tenant_id=tenant_id, code="VIDEO_REC", name="Video Recording Consent",
        purpose="telemedicine_recording", version="1.0",
        body="I consent to recording of this telemedicine consultation.",
        created_by=user_id, updated_by=user_id,
    ))
    db.add(m.TenantVideoConfig(
        tenant_id=tenant_id, provider_code="twilio",
        config={"mode": "sandbox"}, recording_enabled=True, retention_days=90,
        created_by=user_id, updated_by=user_id,
    ))


# ───────────────────────── Branches ─────────────────────────
@router.get("/admin/branches", response_model=list[BranchOut])
def list_branches(ctx: AuthContext = Depends(require_tenant), db: Session = Depends(get_db)):
    rows = db.query(m.Branch).filter(m.Branch.tenant_id == ctx.tenant_id, m.Branch.is_deleted == False).all()
    return rows


@router.post("/admin/branches", response_model=BranchOut)
def create_branch(payload: BranchCreate, ctx: AuthContext = Depends(require_permission("branches:*")), db: Session = Depends(get_db)):
    if not ctx.tenant_id:
        raise HTTPException(400, "Tenant required")
    row = m.Branch(
        tenant_id=ctx.tenant_id, code=payload.code, name=payload.name,
        address=payload.address, city=payload.city,
        created_by=ctx.user.id, updated_by=ctx.user.id,
    )
    db.add(row)
    write_audit(db, tenant_id=ctx.tenant_id, actor_user_id=ctx.user.id, action="CREATE",
                entity_type="branch", entity_id=None, new_values=payload.model_dump(),
                correlation_id=ctx.correlation_id)
    db.commit()
    db.refresh(row)
    return row


@router.get("/admin/departments", response_model=list[DepartmentOut])
def list_departments(ctx: AuthContext = Depends(require_tenant), db: Session = Depends(get_db)):
    rows = db.query(m.Department).filter(
        m.Department.tenant_id == ctx.tenant_id, m.Department.is_deleted == False
    ).order_by(m.Department.name).all()
    return rows


@router.post("/admin/departments", response_model=DepartmentOut)
def create_department(payload: DepartmentCreate, ctx: AuthContext = Depends(require_permission("config:*")), db: Session = Depends(get_db)):
    row = m.Department(
        tenant_id=ctx.tenant_id, branch_id=payload.branch_id,
        code=payload.code, name=payload.name,
        created_by=ctx.user.id, updated_by=ctx.user.id,
    )
    db.add(row)
    write_audit(db, tenant_id=ctx.tenant_id, actor_user_id=ctx.user.id, action="CREATE",
                entity_type="department", new_values=payload.model_dump(), correlation_id=ctx.correlation_id)
    db.commit()
    db.refresh(row)
    return row


# ───────────────────────── Masters ─────────────────────────
@router.get("/masters/{resource}")
def list_masters(resource: str, ctx: AuthContext = Depends(require_tenant), db: Session = Depends(get_db)):
    mapping = {
        "countries": (m.Country, False),
        "genders": (m.Gender, False),
        "specialties": (m.Specialty, True),
        "diseases": (m.Disease, True),
        "medicines": (m.Medicine, True),
        "lab-tests": (m.LabTest, True),
        "tariffs": (m.Tariff, True),
        "clinical-templates": (m.ClinicalTemplate, True),
        "notification-templates": (m.NotificationTemplate, True),
        "consent-templates": (m.ConsentTemplate, True),
        "video-providers": (m.VideoProvider, False),
        "location-purposes": (m.LocationPurpose, True),
        "ui-actions": (m.UIActionRegistry, False),
        "insurance-payers": (m.InsurancePayer, True),
        "room-categories": (m.RoomCategory, True),
        "beds": (m.Bed, True),
    }
    if resource not in mapping:
        raise HTTPException(404, f"Unknown master: {resource}")
    model, tenant_scoped = mapping[resource]
    q = db.query(model).filter(model.is_deleted == False)
    if tenant_scoped and hasattr(model, "tenant_id"):
        q = q.filter(or_(model.tenant_id == ctx.tenant_id, model.tenant_id.is_(None)))
    rows = q.order_by(getattr(model, "name", getattr(model, "code"))).all()
    result = []
    for r in rows:
        item = {"id": str(r.id), "code": getattr(r, "code", None), "name": getattr(r, "name", None), "status": getattr(r, "status", "active")}
        for extra in ("amount", "category", "currency", "form", "strength", "icd_code", "channel", "purpose", "version", "capabilities", "permission", "module", "route", "dial_code", "sample_type", "template_type", "body"):
            if hasattr(r, extra):
                val = getattr(r, extra)
                item[extra] = float(val) if extra == "amount" and val is not None else val
        result.append(item)
    return result


# ───────────────────────── Patients ─────────────────────────
@router.get("/patients", response_model=list[PatientOut])
def search_patients(
    query: str = "",
    ctx: AuthContext = Depends(require_permission("patients:read")),
    db: Session = Depends(get_db),
):
    q = db.query(m.Patient).filter(m.Patient.tenant_id == ctx.tenant_id, m.Patient.is_deleted == False)
    if query:
        like = f"%{query}%"
        q = q.filter(or_(
            m.Patient.first_name.ilike(like), m.Patient.last_name.ilike(like),
            m.Patient.phone.ilike(like), m.Patient.mrn.ilike(like),
        ))
    return q.order_by(m.Patient.created_at.desc()).limit(100).all()


@router.post("/patients", response_model=PatientOut)
def create_patient(payload: PatientCreate, request: Request, ctx: AuthContext = Depends(require_permission("patients:*")), db: Session = Depends(get_db)):
    count = db.query(m.Patient).filter(m.Patient.tenant_id == ctx.tenant_id).count() + 1
    mrn = f"{ctx.tenant_code.upper()}-{count:06d}"
    row = m.Patient(
        tenant_id=ctx.tenant_id, branch_id=payload.branch_id or ctx.user.branch_id,
        mrn=mrn, first_name=payload.first_name, last_name=payload.last_name,
        date_of_birth=payload.date_of_birth, gender_code=payload.gender_code,
        phone=payload.phone, email=str(payload.email) if payload.email else None,
        address=payload.address, blood_group=payload.blood_group,
        national_id=payload.national_id, emergency_contact=payload.emergency_contact,
        created_by=ctx.user.id, updated_by=ctx.user.id,
    )
    db.add(row)
    db.flush()
    ip, ua = _client_meta(request)
    write_audit(db, tenant_id=ctx.tenant_id, actor_user_id=ctx.user.id, action="CREATE",
                entity_type="patient", entity_id=str(row.id),
                new_values={"mrn": mrn, "name": f"{payload.first_name} {payload.last_name}"},
                ip_address=ip, user_agent=ua, correlation_id=ctx.correlation_id)
    db.commit()
    db.refresh(row)
    return row


@router.get("/patients/{patient_id}", response_model=PatientOut)
def get_patient(patient_id: str, ctx: AuthContext = Depends(require_permission("patients:read")), db: Session = Depends(get_db)):
    row = db.query(m.Patient).filter(
        m.Patient.id == patient_id, m.Patient.tenant_id == ctx.tenant_id, m.Patient.is_deleted == False
    ).first()
    if not row:
        raise HTTPException(404, "Patient not found")
    write_audit(db, tenant_id=ctx.tenant_id, actor_user_id=ctx.user.id, action="VIEW",
                entity_type="patient", entity_id=str(row.id), correlation_id=ctx.correlation_id)
    db.commit()
    return row


@router.patch("/patients/{patient_id}", response_model=PatientOut)
def update_patient(patient_id: str, payload: PatientUpdate, ctx: AuthContext = Depends(require_permission("patients:*")), db: Session = Depends(get_db)):
    row = db.query(m.Patient).filter(
        m.Patient.id == patient_id, m.Patient.tenant_id == ctx.tenant_id, m.Patient.is_deleted == False
    ).first()
    if not row:
        raise HTTPException(404, "Patient not found")
    old = {"first_name": row.first_name, "last_name": row.last_name, "phone": row.phone, "status": row.status}
    for field, value in payload.model_dump(exclude_unset=True).items():
        if field == "email" and value is not None:
            value = str(value)
        setattr(row, field, value)
    row.updated_by = ctx.user.id
    write_audit(db, tenant_id=ctx.tenant_id, actor_user_id=ctx.user.id, action="UPDATE",
                entity_type="patient", entity_id=str(row.id),
                old_values=old, new_values=payload.model_dump(exclude_unset=True),
                correlation_id=ctx.correlation_id)
    db.commit()
    db.refresh(row)
    return row


# ───────────────────────── Providers ─────────────────────────
@router.get("/providers", response_model=list[ProviderOut])
def list_providers(ctx: AuthContext = Depends(require_tenant), db: Session = Depends(get_db)):
    return db.query(m.Provider).filter(m.Provider.tenant_id == ctx.tenant_id, m.Provider.is_deleted == False).all()


@router.post("/providers", response_model=ProviderOut)
def create_provider(payload: ProviderCreate, ctx: AuthContext = Depends(require_permission("providers:*")), db: Session = Depends(get_db)):
    row = m.Provider(
        tenant_id=ctx.tenant_id, branch_id=payload.branch_id,
        code=payload.code, full_name=payload.full_name,
        specialty_code=payload.specialty_code, license_no=payload.license_no,
        consultation_fee_code=payload.consultation_fee_code,
        created_by=ctx.user.id, updated_by=ctx.user.id,
    )
    db.add(row)
    write_audit(db, tenant_id=ctx.tenant_id, actor_user_id=ctx.user.id, action="CREATE",
                entity_type="provider", new_values=payload.model_dump(), correlation_id=ctx.correlation_id)
    db.commit()
    db.refresh(row)
    return row


@router.get("/providers/{provider_id}/schedules")
def list_schedules(provider_id: str, ctx: AuthContext = Depends(require_tenant), db: Session = Depends(get_db)):
    rows = db.query(m.ProviderSchedule).filter(
        m.ProviderSchedule.provider_id == provider_id,
        m.ProviderSchedule.tenant_id == ctx.tenant_id,
        m.ProviderSchedule.is_deleted == False,
    ).all()
    return [
        {
            "id": str(r.id), "day_of_week": r.day_of_week,
            "start_time": r.start_time, "end_time": r.end_time,
            "slot_minutes": r.slot_minutes, "mode": r.mode,
        }
        for r in rows
    ]


@router.post("/providers/{provider_id}/schedules")
def add_schedule(provider_id: str, payload: ScheduleCreate, ctx: AuthContext = Depends(require_permission("providers:*")), db: Session = Depends(get_db)):
    prov = db.query(m.Provider).filter(m.Provider.id == provider_id, m.Provider.tenant_id == ctx.tenant_id).first()
    if not prov:
        raise HTTPException(404, "Provider not found")
    row = m.ProviderSchedule(
        tenant_id=ctx.tenant_id, provider_id=prov.id, **payload.model_dump(),
        created_by=ctx.user.id, updated_by=ctx.user.id,
    )
    db.add(row)
    db.commit()
    return {"id": str(row.id), "message": "Schedule added"}


# ───────────────────────── Appointments & Queue ─────────────────────────
@router.get("/appointments", response_model=list[AppointmentOut])
def list_appointments(ctx: AuthContext = Depends(require_permission("appointments:read")), db: Session = Depends(get_db)):
    return (
        db.query(m.Appointment)
        .filter(m.Appointment.tenant_id == ctx.tenant_id, m.Appointment.is_deleted == False)
        .order_by(m.Appointment.scheduled_at.desc()).limit(200).all()
    )


@router.post("/appointments", response_model=AppointmentOut)
def create_appointment(payload: AppointmentCreate, ctx: AuthContext = Depends(require_permission("appointments:*")), db: Session = Depends(get_db)):
    patient = db.query(m.Patient).filter(m.Patient.id == payload.patient_id, m.Patient.tenant_id == ctx.tenant_id).first()
    provider = db.query(m.Provider).filter(m.Provider.id == payload.provider_id, m.Provider.tenant_id == ctx.tenant_id).first()
    if not patient or not provider:
        raise HTTPException(404, "Patient or provider not found in tenant")
    token_n = db.query(m.Appointment).filter(m.Appointment.tenant_id == ctx.tenant_id).count() + 1
    row = m.Appointment(
        tenant_id=ctx.tenant_id, branch_id=payload.branch_id,
        patient_id=payload.patient_id, provider_id=payload.provider_id,
        scheduled_at=payload.scheduled_at, mode=payload.mode, reason=payload.reason,
        queue_token=f"T{token_n:04d}", status="scheduled",
        created_by=ctx.user.id, updated_by=ctx.user.id,
    )
    db.add(row)
    db.flush()
    write_audit(db, tenant_id=ctx.tenant_id, actor_user_id=ctx.user.id, action="CREATE",
                entity_type="appointment", entity_id=str(row.id),
                new_values={"mode": payload.mode, "queue_token": row.queue_token},
                correlation_id=ctx.correlation_id)
    if payload.mode == "telemedicine":
        # auto prepare tele session shell
        room = f"room-{ctx.tenant_code}-{row.id.hex[:8]}"
        db.add(m.TelemedicineSession(
            tenant_id=ctx.tenant_id, appointment_id=row.id,
            patient_id=patient.id, provider_id=provider.id,
            room_id=room, status="scheduled",
            join_token_patient=f"pt-{uuid4().hex}",
            join_token_provider=f"dr-{uuid4().hex}",
            created_by=ctx.user.id, updated_by=ctx.user.id,
        ))
    db.add(m.NotificationOutbox(
        tenant_id=ctx.tenant_id, channel="email",
        recipient=patient.email or "noreply@sumayacare360.local",
        subject="Appointment Confirmed",
        body=f"Appointment {row.queue_token} scheduled at {payload.scheduled_at.isoformat()}",
        created_by=ctx.user.id, updated_by=ctx.user.id,
    ))
    db.commit()
    db.refresh(row)
    return row


@router.post("/appointments/{appointment_id}/start-encounter")
def start_encounter_from_appointment(
    appointment_id: str,
    ctx: AuthContext = Depends(require_permission("encounters:*")),
    db: Session = Depends(get_db),
):
    appt = db.query(m.Appointment).filter(
        m.Appointment.id == appointment_id, m.Appointment.tenant_id == ctx.tenant_id
    ).first()
    if not appt:
        raise HTTPException(404, "Appointment not found")
    existing = db.query(m.Encounter).filter(
        m.Encounter.appointment_id == appt.id, m.Encounter.tenant_id == ctx.tenant_id, m.Encounter.is_deleted == False
    ).first()
    if existing:
        return {"id": str(existing.id), "status": existing.status, "message": "Encounter already exists"}
    enc = m.Encounter(
        tenant_id=ctx.tenant_id, branch_id=appt.branch_id,
        patient_id=appt.patient_id, provider_id=appt.provider_id,
        appointment_id=appt.id, encounter_type="opd",
        chief_complaint=appt.reason or "Follow-up",
        created_by=ctx.user.id, updated_by=ctx.user.id,
    )
    db.add(enc)
    appt.status = "in_progress"
    appt.updated_by = ctx.user.id
    write_audit(db, tenant_id=ctx.tenant_id, actor_user_id=ctx.user.id, action="CREATE",
                entity_type="encounter", entity_id=None,
                new_values={"appointment_id": str(appt.id)}, correlation_id=ctx.correlation_id)
    db.commit()
    db.refresh(enc)
    return {"id": str(enc.id), "status": enc.status, "appointment_id": str(appt.id)}


@router.patch("/appointments/{appointment_id}/status")
def update_appointment_status(appointment_id: str, status: str = Query(...), ctx: AuthContext = Depends(require_permission("appointments:*")), db: Session = Depends(get_db)):
    row = db.query(m.Appointment).filter(
        m.Appointment.id == appointment_id, m.Appointment.tenant_id == ctx.tenant_id
    ).first()
    if not row:
        raise HTTPException(404, "Appointment not found")
    old = row.status
    row.status = status
    row.updated_by = ctx.user.id
    write_audit(db, tenant_id=ctx.tenant_id, actor_user_id=ctx.user.id, action="STATUS_CHANGE",
                entity_type="appointment", entity_id=str(row.id),
                old_values={"status": old}, new_values={"status": status},
                correlation_id=ctx.correlation_id)
    db.commit()
    return {"id": str(row.id), "status": row.status}


@router.post("/queue/tokens")
def create_queue_token(payload: QueueTokenCreate, ctx: AuthContext = Depends(require_permission("queue:*")), db: Session = Depends(get_db)):
    row = db.query(m.Appointment).filter(
        m.Appointment.id == payload.appointment_id, m.Appointment.tenant_id == ctx.tenant_id
    ).first()
    if not row:
        raise HTTPException(404, "Appointment not found")
    if not row.queue_token:
        token_n = db.query(m.Appointment).filter(m.Appointment.tenant_id == ctx.tenant_id).count() + 1
        row.queue_token = f"T{token_n:04d}"
        row.updated_by = ctx.user.id
    write_audit(db, tenant_id=ctx.tenant_id, actor_user_id=ctx.user.id, action="CREATE",
                entity_type="queue_token", entity_id=str(row.id),
                new_values={"queue_token": row.queue_token}, correlation_id=ctx.correlation_id)
    db.commit()
    return {"appointment_id": str(row.id), "queue_token": row.queue_token, "status": row.status}


@router.patch("/queue/tokens/{appointment_id}/status")
def update_queue_status(appointment_id: str, status: str = Query(...), ctx: AuthContext = Depends(require_permission("queue:*")), db: Session = Depends(get_db)):
    row = db.query(m.Appointment).filter(
        m.Appointment.id == appointment_id, m.Appointment.tenant_id == ctx.tenant_id
    ).first()
    if not row:
        raise HTTPException(404, "Queue token not found")
    old = row.status
    row.status = status
    row.updated_by = ctx.user.id
    write_audit(db, tenant_id=ctx.tenant_id, actor_user_id=ctx.user.id, action="STATUS_CHANGE",
                entity_type="queue_token", entity_id=str(row.id),
                old_values={"status": old}, new_values={"status": status},
                correlation_id=ctx.correlation_id)
    db.commit()
    return {"id": str(row.id), "queue_token": row.queue_token, "status": row.status}


# ───────────────────────── Encounters / OPD ─────────────────────────
@router.post("/encounters")
def create_encounter(payload: EncounterCreate, ctx: AuthContext = Depends(require_permission("encounters:*")), db: Session = Depends(get_db)):
    row = m.Encounter(
        tenant_id=ctx.tenant_id, branch_id=payload.branch_id,
        patient_id=payload.patient_id, provider_id=payload.provider_id,
        appointment_id=payload.appointment_id, encounter_type=payload.encounter_type,
        chief_complaint=payload.chief_complaint,
        created_by=ctx.user.id, updated_by=ctx.user.id,
    )
    db.add(row)
    write_audit(db, tenant_id=ctx.tenant_id, actor_user_id=ctx.user.id, action="CREATE",
                entity_type="encounter", correlation_id=ctx.correlation_id)
    db.commit()
    db.refresh(row)
    return {"id": str(row.id), "status": row.status}


@router.get("/encounters")
def list_encounters(ctx: AuthContext = Depends(require_permission("encounters:read")), db: Session = Depends(get_db)):
    rows = (
        db.query(m.Encounter)
        .filter(m.Encounter.tenant_id == ctx.tenant_id, m.Encounter.is_deleted == False)
        .order_by(m.Encounter.created_at.desc()).limit(100).all()
    )
    return [
        {
            "id": str(r.id), "patient_id": str(r.patient_id), "provider_id": str(r.provider_id),
            "status": r.status, "encounter_type": r.encounter_type,
            "chief_complaint": r.chief_complaint, "started_at": r.started_at,
        }
        for r in rows
    ]


@router.get("/encounters/{encounter_id}")
def get_encounter(encounter_id: str, ctx: AuthContext = Depends(require_permission("encounters:read")), db: Session = Depends(get_db)):
    return encounter_detail(db, ctx.tenant_id, encounter_id)


@router.post("/encounters/{encounter_id}/vitals")
def add_vitals(encounter_id: str, payload: VitalCreate, ctx: AuthContext = Depends(require_permission("vitals:*")), db: Session = Depends(get_db)):
    enc = db.query(m.Encounter).filter(m.Encounter.id == encounter_id, m.Encounter.tenant_id == ctx.tenant_id).first()
    if not enc:
        raise HTTPException(404, "Encounter not found")
    row = m.Vital(
        tenant_id=ctx.tenant_id, encounter_id=enc.id, patient_id=enc.patient_id,
        **payload.model_dump(), created_by=ctx.user.id, updated_by=ctx.user.id,
    )
    db.add(row)
    db.commit()
    return {"id": str(row.id), "message": "Vitals recorded"}


@router.post("/encounters/{encounter_id}/notes")
def add_note(encounter_id: str, payload: NoteCreate, ctx: AuthContext = Depends(require_permission("encounters:*")), db: Session = Depends(get_db)):
    enc = db.query(m.Encounter).filter(m.Encounter.id == encounter_id, m.Encounter.tenant_id == ctx.tenant_id).first()
    if not enc:
        raise HTTPException(404, "Encounter not found")
    row = m.ClinicalNote(
        tenant_id=ctx.tenant_id, encounter_id=enc.id,
        content=payload.content, note_type=payload.note_type, template_code=payload.template_code,
        created_by=ctx.user.id, updated_by=ctx.user.id,
    )
    db.add(row)
    write_audit(db, tenant_id=ctx.tenant_id, actor_user_id=ctx.user.id, action="CREATE",
                entity_type="clinical_note", entity_id=None, correlation_id=ctx.correlation_id)
    db.commit()
    return {"id": str(row.id), "message": "Note saved"}


@router.post("/encounters/{encounter_id}/diagnoses")
def add_diagnosis(encounter_id: str, payload: DiagnosisCreate, ctx: AuthContext = Depends(require_permission("encounters:*")), db: Session = Depends(get_db)):
    enc = db.query(m.Encounter).filter(m.Encounter.id == encounter_id, m.Encounter.tenant_id == ctx.tenant_id).first()
    if not enc:
        raise HTTPException(404, "Encounter not found")
    disease = db.query(m.Disease).filter(
        m.Disease.code == payload.disease_code,
        or_(m.Disease.tenant_id == ctx.tenant_id, m.Disease.tenant_id.is_(None)),
    ).first()
    name = disease.name if disease else payload.disease_name
    row = m.EncounterDiagnosis(
        tenant_id=ctx.tenant_id, encounter_id=enc.id,
        disease_code=payload.disease_code, disease_name=name, is_primary=payload.is_primary,
        created_by=ctx.user.id, updated_by=ctx.user.id,
    )
    db.add(row)
    db.commit()
    return {"id": str(row.id), "disease_name": name}


@router.post("/encounters/{encounter_id}/prescriptions")
def create_prescription(encounter_id: str, payload: PrescriptionCreate, ctx: AuthContext = Depends(require_permission("prescriptions:*")), db: Session = Depends(get_db)):
    enc = db.query(m.Encounter).filter(m.Encounter.id == encounter_id, m.Encounter.tenant_id == ctx.tenant_id).first()
    if not enc:
        raise HTTPException(404, "Encounter not found")
    rx = m.Prescription(
        tenant_id=ctx.tenant_id, encounter_id=enc.id, patient_id=enc.patient_id,
        provider_id=enc.provider_id, notes=payload.notes, status="issued",
        created_by=ctx.user.id, updated_by=ctx.user.id,
    )
    db.add(rx)
    db.flush()
    for line in payload.lines:
        db.add(m.PrescriptionLine(
            tenant_id=ctx.tenant_id, prescription_id=rx.id,
            medicine_code=line.get("medicine_code", ""),
            medicine_name=line.get("medicine_name", ""),
            dose=line.get("dose"), frequency=line.get("frequency"),
            duration=line.get("duration"), instructions=line.get("instructions"),
            created_by=ctx.user.id, updated_by=ctx.user.id,
        ))
    write_audit(db, tenant_id=ctx.tenant_id, actor_user_id=ctx.user.id, action="CREATE",
                entity_type="prescription", entity_id=str(rx.id),
                new_values={"lines": payload.lines}, correlation_id=ctx.correlation_id)
    db.commit()
    return {"id": str(rx.id), "status": rx.status}


@router.post("/encounters/{encounter_id}/discharge")
def discharge_opd(
    encounter_id: str,
    payload: DischargeCreate,
    ctx: AuthContext = Depends(require_permission("encounters:*")),
    db: Session = Depends(get_db),
):
    result = discharge_encounter(
        db, tenant_id=ctx.tenant_id, tenant_code=ctx.tenant_code or "TENANT",
        encounter_id=encounter_id, actor_id=ctx.user.id,
        assessment=payload.assessment, plan=payload.plan,
        correlation_id=ctx.correlation_id,
    )
    db.commit()
    return result


@router.patch("/encounters/{encounter_id}/close")
def close_encounter(
    encounter_id: str,
    assessment: str = "",
    plan: str = "",
    ctx: AuthContext = Depends(require_permission("encounters:*")),
    db: Session = Depends(get_db),
):
    result = discharge_encounter(
        db, tenant_id=ctx.tenant_id, tenant_code=ctx.tenant_code or "TENANT",
        encounter_id=encounter_id, actor_id=ctx.user.id,
        assessment=assessment, plan=plan,
        correlation_id=ctx.correlation_id,
    )
    db.commit()
    return result


@router.get("/patients/{patient_id}/chart")
def get_patient_chart(patient_id: UUID, ctx: AuthContext = Depends(require_permission("patients:read")), db: Session = Depends(get_db)):
    return patient_chart(db, ctx.tenant_id, patient_id)


# ───────────────────────── Telemedicine ─────────────────────────
@router.post("/telemedicine/sessions")
def create_tele_session(payload: TeleSessionCreate, ctx: AuthContext = Depends(require_permission("telemedicine:*")), db: Session = Depends(get_db)):
    appt = db.query(m.Appointment).filter(
        m.Appointment.id == payload.appointment_id, m.Appointment.tenant_id == ctx.tenant_id
    ).first()
    if not appt:
        raise HTTPException(404, "Appointment not found")
    existing = db.query(m.TelemedicineSession).filter(
        m.TelemedicineSession.appointment_id == appt.id, m.TelemedicineSession.is_deleted == False
    ).first()
    if existing:
        return {"id": str(existing.id), "room_id": existing.room_id, "status": existing.status}
    cfg = db.query(m.TenantVideoConfig).filter(m.TenantVideoConfig.tenant_id == ctx.tenant_id).first()
    provider_code = cfg.provider_code if cfg else "twilio"
    room = f"room-{ctx.tenant_code}-{appt.id.hex[:8]}"
    row = m.TelemedicineSession(
        tenant_id=ctx.tenant_id, appointment_id=appt.id,
        patient_id=appt.patient_id, provider_id=appt.provider_id,
        provider_code=provider_code, room_id=room, status="waiting",
        join_token_patient=f"pt-{uuid4().hex}",
        join_token_provider=f"dr-{uuid4().hex}",
        created_by=ctx.user.id, updated_by=ctx.user.id,
    )
    db.add(row)
    write_audit(db, tenant_id=ctx.tenant_id, actor_user_id=ctx.user.id, action="CREATE",
                entity_type="telemedicine_session", entity_id=str(row.id),
                correlation_id=ctx.correlation_id)
    db.commit()
    db.refresh(row)
    return {"id": str(row.id), "room_id": row.room_id, "status": row.status}


@router.get("/telemedicine/sessions")
def list_tele_sessions(ctx: AuthContext = Depends(require_permission("telemedicine:*")), db: Session = Depends(get_db)):
    rows = db.query(m.TelemedicineSession).filter(
        m.TelemedicineSession.tenant_id == ctx.tenant_id, m.TelemedicineSession.is_deleted == False
    ).order_by(m.TelemedicineSession.created_at.desc()).limit(100).all()
    return [
        {
            "id": str(r.id), "appointment_id": str(r.appointment_id), "status": r.status,
            "room_id": r.room_id, "provider_code": r.provider_code,
            "patient_id": str(r.patient_id), "provider_id": str(r.provider_id),
        }
        for r in rows
    ]


@router.post("/telemedicine/sessions/{session_id}/join")
def join_tele_session(session_id: str, as_role: str = Query("patient"), ctx: AuthContext = Depends(require_tenant), db: Session = Depends(get_db)):
    row = db.query(m.TelemedicineSession).filter(
        m.TelemedicineSession.id == session_id, m.TelemedicineSession.tenant_id == ctx.tenant_id
    ).first()
    if not row:
        raise HTTPException(404, "Session not found")
    if row.status in ("scheduled", "waiting"):
        row.status = "in_progress"
        row.started_at = datetime.now(timezone.utc)
    token = row.join_token_provider if as_role == "provider" else row.join_token_patient
    write_audit(db, tenant_id=ctx.tenant_id, actor_user_id=ctx.user.id, action="JOIN",
                entity_type="telemedicine_session", entity_id=str(row.id),
                correlation_id=ctx.correlation_id)
    db.commit()
    return {
        "session_id": str(row.id),
        "room_id": row.room_id,
        "join_token": token,
        "provider": row.provider_code,
        "status": row.status,
        "recording_allowed": bool(row.recording_consent_id),
    }


@router.post("/telemedicine/waiting-room")
def waiting_room(payload: WaitingRoomAction, ctx: AuthContext = Depends(require_permission("telemedicine:*")), db: Session = Depends(get_db)):
    row = db.query(m.TelemedicineSession).filter(
        m.TelemedicineSession.id == payload.session_id, m.TelemedicineSession.tenant_id == ctx.tenant_id
    ).first()
    if not row:
        raise HTTPException(404, "Session not found")
    if payload.action == "admit":
        row.status = "in_progress"
        row.started_at = datetime.now(timezone.utc)
    else:
        row.status = "waiting"
    row.updated_by = ctx.user.id
    db.commit()
    return {"session_id": str(row.id), "status": row.status}


@router.post("/telemedicine/in-call/notes")
def in_call_note(payload: InCallNoteCreate, ctx: AuthContext = Depends(require_permission("telemedicine:*")), db: Session = Depends(get_db)):
    row = db.query(m.TelemedicineSession).filter(
        m.TelemedicineSession.id == payload.session_id, m.TelemedicineSession.tenant_id == ctx.tenant_id
    ).first()
    if not row:
        raise HTTPException(404, "Session not found")
    note_line = f"[{payload.note_type}] {payload.content}"
    row.post_call_summary = (row.post_call_summary or "") + ("\n" if row.post_call_summary else "") + note_line
    row.updated_by = ctx.user.id
    write_audit(db, tenant_id=ctx.tenant_id, actor_user_id=ctx.user.id, action="CREATE",
                entity_type="telemedicine_session", entity_id=str(row.id),
                new_values={"in_call_note": payload.content}, correlation_id=ctx.correlation_id)
    db.commit()
    return {"session_id": str(row.id), "note": payload.content}


@router.get("/telemedicine/recordings/{session_id}")
def get_recording(session_id: str, ctx: AuthContext = Depends(require_permission("telemedicine:*")), db: Session = Depends(get_db)):
    row = db.query(m.TelemedicineSession).filter(
        m.TelemedicineSession.id == session_id, m.TelemedicineSession.tenant_id == ctx.tenant_id
    ).first()
    if not row:
        raise HTTPException(404, "Session not found")
    if not row.recording_consent_id:
        raise HTTPException(400, "Recording consent required")
    return {
        "session_id": str(row.id),
        "recording_id": f"rec-{row.id.hex[:12]}",
        "status": "stored",
        "storage_key": f"tenant/{ctx.tenant_code}/recordings/{row.id}.mp4",
        "retention_days": 90,
    }


@router.post("/telemedicine/recording-consent")
def recording_consent(payload: ConsentCreate, ctx: AuthContext = Depends(require_tenant), db: Session = Depends(get_db)):
    row = m.ConsentCapture(
        tenant_id=ctx.tenant_id, patient_id=payload.patient_id,
        template_code=payload.template_code, purpose=payload.purpose,
        version=payload.version, granted=payload.granted,
        metadata_json=payload.metadata_json,
        created_by=ctx.user.id, updated_by=ctx.user.id,
    )
    db.add(row)
    db.flush()
    write_audit(db, tenant_id=ctx.tenant_id, actor_user_id=ctx.user.id, action="CONSENT",
                entity_type="consent_capture", entity_id=str(row.id),
                new_values={"purpose": payload.purpose, "granted": payload.granted},
                correlation_id=ctx.correlation_id)
    db.commit()
    return {"id": str(row.id), "granted": row.granted}


@router.post("/telemedicine/sessions/{session_id}/link-consent")
def link_consent(session_id: str, consent_id: str, ctx: AuthContext = Depends(require_permission("telemedicine:*")), db: Session = Depends(get_db)):
    row = db.query(m.TelemedicineSession).filter(
        m.TelemedicineSession.id == session_id, m.TelemedicineSession.tenant_id == ctx.tenant_id
    ).first()
    consent = db.query(m.ConsentCapture).filter(
        m.ConsentCapture.id == consent_id, m.ConsentCapture.tenant_id == ctx.tenant_id, m.ConsentCapture.granted == True
    ).first()
    if not row or not consent:
        raise HTTPException(404, "Session or valid consent not found")
    row.recording_consent_id = consent.id
    db.commit()
    return {"message": "Consent linked", "session_id": session_id}


@router.post("/telemedicine/sessions/{session_id}/post-call-summary")
def post_call_summary(session_id: str, summary: str = "", ctx: AuthContext = Depends(require_permission("telemedicine:*")), db: Session = Depends(get_db)):
    row = db.query(m.TelemedicineSession).filter(
        m.TelemedicineSession.id == session_id, m.TelemedicineSession.tenant_id == ctx.tenant_id
    ).first()
    if not row:
        raise HTTPException(404, "Session not found")
    row.post_call_summary = summary
    row.status = "completed"
    row.ended_at = datetime.now(timezone.utc)
    db.commit()
    return {"id": str(row.id), "status": row.status}


@router.get("/video/providers")
def video_providers(ctx: AuthContext = Depends(require_tenant), db: Session = Depends(get_db)):
    rows = db.query(m.VideoProvider).filter(m.VideoProvider.is_deleted == False).all()
    cfg = db.query(m.TenantVideoConfig).filter(m.TenantVideoConfig.tenant_id == ctx.tenant_id).first()
    return {
        "providers": [{"code": r.code, "name": r.name, "capabilities": r.capabilities} for r in rows],
        "tenant_config": {
            "provider_code": cfg.provider_code if cfg else None,
            "recording_enabled": cfg.recording_enabled if cfg else False,
            "retention_days": cfg.retention_days if cfg else None,
        },
    }


# ───────────────────────── Location ─────────────────────────
@router.post("/location/events")
def create_location_event(payload: LocationEventCreate, ctx: AuthContext = Depends(require_tenant), db: Session = Depends(get_db)):
    purpose = db.query(m.LocationPurpose).filter(
        m.LocationPurpose.code == payload.purpose_code,
        or_(m.LocationPurpose.tenant_id == ctx.tenant_id, m.LocationPurpose.tenant_id.is_(None)),
    ).first()
    if not purpose:
        raise HTTPException(400, "Unknown location purpose — configure in masters")
    if purpose.requires_consent and not payload.consent_id:
        raise HTTPException(400, "consent_id required for this purpose")
    row = m.LocationEvent(
        tenant_id=ctx.tenant_id, patient_id=payload.patient_id,
        purpose_code=payload.purpose_code, consent_id=payload.consent_id,
        latitude=payload.latitude, longitude=payload.longitude, accuracy_m=payload.accuracy_m,
        created_by=ctx.user.id, updated_by=ctx.user.id,
    )
    db.add(row)
    write_audit(db, tenant_id=ctx.tenant_id, actor_user_id=ctx.user.id, action="CREATE",
                entity_type="location_event", correlation_id=ctx.correlation_id)
    db.commit()
    return {"id": str(row.id)}


@router.get("/location/events")
def list_location_events(
    purpose_code: str = "",
    ctx: AuthContext = Depends(require_tenant),
    db: Session = Depends(get_db),
):
    q = db.query(m.LocationEvent).filter(
        m.LocationEvent.tenant_id == ctx.tenant_id,
        m.LocationEvent.is_deleted == False,
    )
    if purpose_code:
        q = q.filter(m.LocationEvent.purpose_code == purpose_code)
    rows = q.order_by(m.LocationEvent.created_at.desc()).limit(100).all()
    return [
        {
            "id": str(r.id),
            "patient_id": str(r.patient_id) if r.patient_id else None,
            "purpose_code": r.purpose_code,
            "latitude": float(r.latitude) if r.latitude is not None else None,
            "longitude": float(r.longitude) if r.longitude is not None else None,
            "accuracy_m": r.accuracy_m,
            "created_at": r.created_at,
        }
        for r in rows
    ]


# ───────────────────────── Billing stubs ─────────────────────────
@router.post("/billing/estimates")
def create_estimate(payload: InvoiceCreate, ctx: AuthContext = Depends(require_permission("billing:*")), db: Session = Depends(get_db)):
    count = db.query(m.Invoice).filter(m.Invoice.tenant_id == ctx.tenant_id).count() + 1
    est_no = f"EST-{ctx.tenant_code.upper()}-{count:06d}"
    subtotal = 0.0
    inv = m.Invoice(
        tenant_id=ctx.tenant_id, patient_id=payload.patient_id,
        encounter_id=payload.encounter_id, invoice_no=est_no, status="estimate",
        created_by=ctx.user.id, updated_by=ctx.user.id,
    )
    db.add(inv)
    db.flush()
    for line in payload.lines:
        tariff = db.query(m.Tariff).filter(
            m.Tariff.tenant_id == ctx.tenant_id, m.Tariff.code == line.get("tariff_code")
        ).first()
        if not tariff:
            raise HTTPException(400, f"Unknown tariff {line.get('tariff_code')}")
        qty = float(line.get("qty", 1))
        amount = float(tariff.amount) * qty
        subtotal += amount
        db.add(m.InvoiceLine(
            tenant_id=ctx.tenant_id, invoice_id=inv.id,
            tariff_code=tariff.code, description=tariff.name,
            qty=qty, unit_price=tariff.amount, amount=amount,
            created_by=ctx.user.id, updated_by=ctx.user.id,
        ))
    inv.subtotal = subtotal
    inv.total = subtotal
    write_audit(db, tenant_id=ctx.tenant_id, actor_user_id=ctx.user.id, action="CREATE",
                entity_type="billing_estimate", entity_id=str(inv.id),
                new_values={"estimate_no": est_no, "total": subtotal},
                correlation_id=ctx.correlation_id)
    db.commit()
    return {"id": str(inv.id), "estimate_no": est_no, "total": subtotal, "status": "estimate"}


@router.post("/billing/invoices")
def create_invoice(payload: InvoiceCreate, ctx: AuthContext = Depends(require_permission("billing:*")), db: Session = Depends(get_db)):
    count = db.query(m.Invoice).filter(m.Invoice.tenant_id == ctx.tenant_id).count() + 1
    inv_no = f"INV-{ctx.tenant_code.upper()}-{count:06d}"
    subtotal = 0.0
    inv = m.Invoice(
        tenant_id=ctx.tenant_id, patient_id=payload.patient_id,
        encounter_id=payload.encounter_id, invoice_no=inv_no, status="issued",
        created_by=ctx.user.id, updated_by=ctx.user.id,
    )
    db.add(inv)
    db.flush()
    for line in payload.lines:
        tariff = db.query(m.Tariff).filter(
            m.Tariff.tenant_id == ctx.tenant_id, m.Tariff.code == line.get("tariff_code")
        ).first()
        if not tariff:
            raise HTTPException(400, f"Unknown tariff {line.get('tariff_code')} — load from master")
        qty = float(line.get("qty", 1))
        amount = float(tariff.amount) * qty
        subtotal += amount
        db.add(m.InvoiceLine(
            tenant_id=ctx.tenant_id, invoice_id=inv.id,
            tariff_code=tariff.code, description=tariff.name,
            qty=qty, unit_price=tariff.amount, amount=amount,
            created_by=ctx.user.id, updated_by=ctx.user.id,
        ))
    inv.subtotal = subtotal
    inv.tax = 0
    inv.total = subtotal
    write_audit(db, tenant_id=ctx.tenant_id, actor_user_id=ctx.user.id, action="CREATE",
                entity_type="invoice", entity_id=str(inv.id),
                new_values={"invoice_no": inv_no, "total": subtotal},
                correlation_id=ctx.correlation_id)
    db.commit()
    return {"id": str(inv.id), "invoice_no": inv_no, "total": subtotal}


@router.get("/billing/invoices")
def list_invoices(ctx: AuthContext = Depends(require_permission("billing:read")), db: Session = Depends(get_db)):
    rows = db.query(m.Invoice).filter(m.Invoice.tenant_id == ctx.tenant_id, m.Invoice.is_deleted == False).all()
    return [
        {"id": str(r.id), "invoice_no": r.invoice_no, "patient_id": str(r.patient_id),
         "encounter_id": str(r.encounter_id) if r.encounter_id else None,
         "status": r.status, "total": float(r.total or 0), "currency": r.currency}
        for r in rows
    ]


@router.post("/billing/payments")
def create_payment(payload: PaymentCreate, ctx: AuthContext = Depends(require_permission("billing:*")), db: Session = Depends(get_db)):
    inv = db.query(m.Invoice).filter(m.Invoice.id == payload.invoice_id, m.Invoice.tenant_id == ctx.tenant_id).first()
    if not inv:
        raise HTTPException(404, "Invoice not found")
    # PCI: never accept raw card data — token ref only
    if any(k in payload.gateway_token_ref.lower() for k in ("card", "cvv")) and len(payload.gateway_token_ref) < 10:
        raise HTTPException(400, "Provide gateway token reference only; raw card data forbidden")
    pay = m.Payment(
        tenant_id=ctx.tenant_id, invoice_id=inv.id, amount=payload.amount,
        gateway=payload.gateway, gateway_token_ref=payload.gateway_token_ref,
        masked_last4=payload.masked_last4, status="succeeded",
        created_by=ctx.user.id, updated_by=ctx.user.id,
    )
    db.add(pay)
    inv.status = "paid"
    write_audit(db, tenant_id=ctx.tenant_id, actor_user_id=ctx.user.id, action="PAYMENT",
                entity_type="payment",
                new_values={"amount": payload.amount, "masked_last4": payload.masked_last4, "gateway": payload.gateway},
                correlation_id=ctx.correlation_id)
    db.commit()
    return {"id": str(pay.id), "status": pay.status, "invoice_status": inv.status}


# ───────────────────────── Audit ─────────────────────────
@router.get("/audit/logs")
def audit_logs(ctx: AuthContext = Depends(require_permission("audit:read")), db: Session = Depends(get_db), limit: int = 100):
    q = db.query(m.AuditLog).order_by(m.AuditLog.created_at.desc())
    if ctx.tenant_id and not ctx.user.is_super_admin:
        q = q.filter(m.AuditLog.tenant_id == ctx.tenant_id)
    rows = q.limit(limit).all()
    return [
        {
            "id": str(r.id), "action": r.action, "entity_type": r.entity_type,
            "entity_id": r.entity_id, "actor_user_id": str(r.actor_user_id) if r.actor_user_id else None,
            "created_at": r.created_at, "new_values": r.new_values,
        }
        for r in rows
    ]


@router.get("/audit/api-logs")
def api_audit_logs(ctx: AuthContext = Depends(require_permission("audit:read")), db: Session = Depends(get_db), limit: int = 100):
    q = db.query(m.ApiAuditLog).order_by(m.ApiAuditLog.created_at.desc())
    if ctx.tenant_id and not ctx.user.is_super_admin:
        q = q.filter(m.ApiAuditLog.tenant_id == ctx.tenant_id)
    rows = q.limit(limit).all()
    return [
        {
            "id": str(r.id), "method": r.method, "path": r.path,
            "status_code": r.status_code, "latency_ms": r.latency_ms,
            "created_at": r.created_at, "correlation_id": r.correlation_id,
        }
        for r in rows
    ]


@router.get("/audit/clinical-access")
def clinical_access_logs(ctx: AuthContext = Depends(require_permission("audit:read")), db: Session = Depends(get_db), limit: int = 100):
    clinical_types = ("patient", "encounter", "prescription", "telemedicine_session", "clinical_note")
    clinical_actions = ("VIEW", "CREATE", "UPDATE", "JOIN", "STATUS_CHANGE")
    q = db.query(m.AuditLog).filter(
        m.AuditLog.entity_type.in_(clinical_types),
        m.AuditLog.action.in_(clinical_actions),
    ).order_by(m.AuditLog.created_at.desc())
    if ctx.tenant_id and not ctx.user.is_super_admin:
        q = q.filter(m.AuditLog.tenant_id == ctx.tenant_id)
    rows = q.limit(limit).all()
    return [
        {
            "id": str(r.id), "action": r.action, "entity_type": r.entity_type,
            "entity_id": r.entity_id, "actor_user_id": str(r.actor_user_id) if r.actor_user_id else None,
            "created_at": r.created_at,
        }
        for r in rows
    ]


# ───────────────────────── Notifications ─────────────────────────
@router.post("/notifications/outbox")
def queue_notification(payload: NotificationOutboxCreate, ctx: AuthContext = Depends(require_tenant), db: Session = Depends(get_db)):
    row = m.NotificationOutbox(
        tenant_id=ctx.tenant_id, channel=payload.channel,
        recipient=payload.recipient, subject=payload.subject, body=payload.body,
        created_by=ctx.user.id, updated_by=ctx.user.id,
    )
    db.add(row)
    write_audit(db, tenant_id=ctx.tenant_id, actor_user_id=ctx.user.id, action="CREATE",
                entity_type="notification", new_values={"channel": payload.channel, "recipient": payload.recipient},
                correlation_id=ctx.correlation_id)
    db.commit()
    return {"id": str(row.id), "status": "pending"}


@router.get("/notifications/outbox")
def list_notifications(
    status: str = "",
    ctx: AuthContext = Depends(require_tenant),
    db: Session = Depends(get_db),
):
    q = db.query(m.NotificationOutbox).filter(
        m.NotificationOutbox.tenant_id == ctx.tenant_id,
        m.NotificationOutbox.is_deleted == False,
    )
    if status:
        q = q.filter(m.NotificationOutbox.status == status)
    rows = q.order_by(m.NotificationOutbox.created_at.desc()).limit(100).all()
    return [
        {
            "id": str(r.id),
            "channel": r.channel,
            "recipient": r.recipient,
            "subject": r.subject,
            "body": r.body,
            "status": r.status,
            "sent_at": r.sent_at,
            "created_at": r.created_at,
        }
        for r in rows
    ]


# ───────────────────────── Dashboard KPIs ─────────────────────────
@router.get("/dashboard/summary")
def dashboard_summary(ctx: AuthContext = Depends(require_tenant), db: Session = Depends(get_db)):
    patients = db.query(m.Patient).filter(m.Patient.tenant_id == ctx.tenant_id, m.Patient.is_deleted == False).count()
    appts = db.query(m.Appointment).filter(m.Appointment.tenant_id == ctx.tenant_id, m.Appointment.is_deleted == False).count()
    open_enc = db.query(m.Encounter).filter(m.Encounter.tenant_id == ctx.tenant_id, m.Encounter.status == "open").count()
    tele = db.query(m.TelemedicineSession).filter(m.TelemedicineSession.tenant_id == ctx.tenant_id).count()
    invoices = db.query(m.Invoice).filter(m.Invoice.tenant_id == ctx.tenant_id).count()
    ipd = db.query(m.IpdAdmission).filter(m.IpdAdmission.tenant_id == ctx.tenant_id, m.IpdAdmission.status == "admitted").count()
    lab = db.query(m.LabOrder).filter(m.LabOrder.tenant_id == ctx.tenant_id).count()
    rad = db.query(m.RadiologyOrder).filter(m.RadiologyOrder.tenant_id == ctx.tenant_id).count()
    rx = db.query(m.PharmacyDispense).filter(m.PharmacyDispense.tenant_id == ctx.tenant_id).count()
    claims = db.query(m.InsuranceClaim).filter(m.InsuranceClaim.tenant_id == ctx.tenant_id).count()
    triage = db.query(m.TriageAssessment).filter(m.TriageAssessment.tenant_id == ctx.tenant_id).count()
    ot = db.query(m.OtProcedure).filter(m.OtProcedure.tenant_id == ctx.tenant_id).count()
    nursing = db.query(m.NursingTask).filter(m.NursingTask.tenant_id == ctx.tenant_id).count()
    pathways = db.query(m.PathwayEnrollment).filter(m.PathwayEnrollment.tenant_id == ctx.tenant_id).count()
    beds_avail = db.query(m.Bed).filter(m.Bed.tenant_id == ctx.tenant_id, m.Bed.status == "available").count()
    modules_active = db.query(m.PlatformModule).filter(m.PlatformModule.active == True).count()
    domain_records = db.query(m.ModuleRecord).filter(m.ModuleRecord.tenant_id == ctx.tenant_id).count()
    return {
        "kpis": [
            {"code": "patients", "label": "Patients", "value": patients, "drilldown": "/patients"},
            {"code": "appointments", "label": "Appointments", "value": appts, "drilldown": "/appointments"},
            {"code": "checked_in", "label": "Checked In", "value": db.query(m.Appointment).filter(m.Appointment.tenant_id == ctx.tenant_id, m.Appointment.status == "checked_in").count(), "drilldown": "/appointments"},
            {"code": "open_encounters", "label": "Open Encounters", "value": open_enc, "drilldown": "/encounters"},
            {"code": "telemedicine", "label": "Tele Sessions", "value": tele, "drilldown": "/telemedicine"},
            {"code": "triage", "label": "ED Triage", "value": triage, "drilldown": "/emergency"},
            {"code": "ipd", "label": "IPD Active", "value": ipd, "drilldown": "/inpatient"},
            {"code": "nursing", "label": "Nursing Tasks", "value": nursing, "drilldown": "/nursing"},
            {"code": "ot", "label": "OT Cases", "value": ot, "drilldown": "/operation-theatre"},
            {"code": "lab", "label": "Lab Orders", "value": lab, "drilldown": "/laboratory"},
            {"code": "radiology", "label": "Radiology", "value": rad, "drilldown": "/radiology"},
            {"code": "pharmacy", "label": "Pharmacy Queue", "value": rx, "drilldown": "/pharmacy"},
            {"code": "pathways", "label": "Pathway Enrollments", "value": pathways, "drilldown": "/pathways"},
            {"code": "claims", "label": "Insurance Claims", "value": claims, "drilldown": "/insurance-claims"},
            {"code": "beds", "label": "Beds Available", "value": beds_avail, "drilldown": "/rooms-facilities"},
            {"code": "invoices", "label": "Invoices", "value": invoices, "drilldown": "/billing"},
            {"code": "domain_records", "label": "Module Work Items", "value": domain_records, "drilldown": "/module-map"},
            {"code": "modules", "label": "Platform Modules", "value": modules_active, "drilldown": "/module-map"},
        ]
    }

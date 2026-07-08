from datetime import datetime, timezone
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.db.session import get_db
from app.core.security import hash_password, verify_password, create_access_token
from app.core.deps import (
    AuthContext, get_current_context, require_permission, require_tenant, permissions_for_role
)
from app.services.audit import write_audit
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


def _seed_tenant_defaults(db: Session, tenant_id, user_id):
    defaults = [
        ("OPD_CONSULT", "OPD Consultation", "consultation", 500),
        ("TELE_CONSULT", "Telemedicine Consultation", "consultation", 400),
        ("REG_FEE", "Registration Fee", "registration", 100),
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


@router.post("/masters/{resource}")
def create_master(resource: str, payload: MasterItemCreate, ctx: AuthContext = Depends(require_permission("masters:*")), db: Session = Depends(get_db)):
    creators = {
        "specialties": lambda: m.Specialty(tenant_id=ctx.tenant_id, code=payload.code, name=payload.name),
        "diseases": lambda: m.Disease(tenant_id=ctx.tenant_id, code=payload.code, name=payload.name, icd_code=payload.extra.get("icd_code")),
        "medicines": lambda: m.Medicine(tenant_id=ctx.tenant_id, code=payload.code, name=payload.name, form=payload.extra.get("form"), strength=payload.extra.get("strength")),
        "lab-tests": lambda: m.LabTest(tenant_id=ctx.tenant_id, code=payload.code, name=payload.name, sample_type=payload.extra.get("sample_type")),
        "tariffs": lambda: m.Tariff(tenant_id=ctx.tenant_id, code=payload.code, name=payload.name, category=payload.extra.get("category", "service"), amount=payload.extra.get("amount", 0)),
    }
    if resource not in creators:
        raise HTTPException(400, "Create not supported for this master via MVP endpoint")
    row = creators[resource]()
    row.created_by = ctx.user.id
    row.updated_by = ctx.user.id
    db.add(row)
    write_audit(db, tenant_id=ctx.tenant_id, actor_user_id=ctx.user.id, action="CREATE",
                entity_type=resource, new_values=payload.model_dump(), correlation_id=ctx.correlation_id)
    db.commit()
    db.refresh(row)
    return {"id": str(row.id), "code": row.code, "name": row.name}


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


@router.patch("/encounters/{encounter_id}/close")
def close_encounter(encounter_id: str, assessment: str = "", plan: str = "", ctx: AuthContext = Depends(require_permission("encounters:*")), db: Session = Depends(get_db)):
    enc = db.query(m.Encounter).filter(m.Encounter.id == encounter_id, m.Encounter.tenant_id == ctx.tenant_id).first()
    if not enc:
        raise HTTPException(404, "Encounter not found")
    enc.status = "closed"
    enc.assessment = assessment or enc.assessment
    enc.plan = plan or enc.plan
    enc.closed_at = datetime.now(timezone.utc)
    enc.updated_by = ctx.user.id
    db.commit()
    return {"id": str(enc.id), "status": enc.status}


# ───────────────────────── Telemedicine ─────────────────────────
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


# ───────────────────────── Billing stubs ─────────────────────────
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


# ───────────────────────── Dashboard KPIs ─────────────────────────
@router.get("/dashboard/summary")
def dashboard_summary(ctx: AuthContext = Depends(require_tenant), db: Session = Depends(get_db)):
    patients = db.query(m.Patient).filter(m.Patient.tenant_id == ctx.tenant_id, m.Patient.is_deleted == False).count()
    appts = db.query(m.Appointment).filter(m.Appointment.tenant_id == ctx.tenant_id, m.Appointment.is_deleted == False).count()
    open_enc = db.query(m.Encounter).filter(m.Encounter.tenant_id == ctx.tenant_id, m.Encounter.status == "open").count()
    tele = db.query(m.TelemedicineSession).filter(m.TelemedicineSession.tenant_id == ctx.tenant_id).count()
    invoices = db.query(m.Invoice).filter(m.Invoice.tenant_id == ctx.tenant_id).count()
    return {
        "kpis": [
            {"code": "patients", "label": "Patients", "value": patients, "drilldown": "/patients"},
            {"code": "appointments", "label": "Appointments", "value": appts, "drilldown": "/appointments"},
            {"code": "open_encounters", "label": "Open Encounters", "value": open_enc, "drilldown": "/encounters"},
            {"code": "telemedicine", "label": "Tele Sessions", "value": tele, "drilldown": "/telemedicine"},
            {"code": "invoices", "label": "Invoices", "value": invoices, "drilldown": "/billing"},
        ]
    }

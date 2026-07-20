import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Boolean, Column, DateTime, ForeignKey, Integer, Numeric,
    String, Text, UniqueConstraint, JSON, Index
)
from app.db.types import GUID
from sqlalchemy.orm import relationship
from app.db.session import Base


def utcnow():
    return datetime.now(timezone.utc)


class AuditedMixin:
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)
    created_by = Column(GUID(), nullable=True)
    updated_by = Column(GUID(), nullable=True)
    is_deleted = Column(Boolean, default=False, nullable=False)
    row_version = Column(Integer, default=1, nullable=False)
    correlation_id = Column(String(64), nullable=True)


class Tenant(Base, AuditedMixin):
    __tablename__ = "tenants"
    tenant_code = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    status = Column(String(32), default="active", nullable=False)
    plan_code = Column(String(64), default="standard")
    branding = Column(JSON, default=dict)
    modules = Column(JSON, default=dict)
    settings = Column(JSON, default=dict)


class Branch(Base, AuditedMixin):
    __tablename__ = "branches"
    tenant_id = Column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    code = Column(String(50), nullable=False)
    name = Column(String(255), nullable=False)
    address = Column(Text)
    city = Column(String(100))
    status = Column(String(32), default="active")
    __table_args__ = (UniqueConstraint("tenant_id", "code", name="uq_branch_tenant_code"),)


class Department(Base, AuditedMixin):
    __tablename__ = "departments"
    tenant_id = Column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    branch_id = Column(GUID(), ForeignKey("branches.id"), nullable=True)
    code = Column(String(50), nullable=False)
    name = Column(String(255), nullable=False)
    status = Column(String(32), default="active")


class FacilityLocation(Base, AuditedMixin):
    """Governed physical-location hierarchy below a hospital branch/campus."""
    __tablename__ = "facility_locations"
    tenant_id = Column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    branch_id = Column(GUID(), ForeignKey("branches.id"), nullable=False, index=True)
    parent_id = Column(GUID(), ForeignKey("facility_locations.id"), nullable=True, index=True)
    department_id = Column(GUID(), ForeignKey("departments.id"), nullable=True)
    room_category_id = Column(GUID(), ForeignKey("room_categories.id"), nullable=True)
    location_type = Column(String(32), nullable=False, index=True)
    code = Column(String(64), nullable=False)
    name = Column(String(255), nullable=False)
    status = Column(String(32), default="active", nullable=False)
    operational_status = Column(String(32), default="operational", nullable=False)
    attributes = Column(JSON, default=dict)
    __table_args__ = (
        UniqueConstraint("tenant_id", "branch_id", "code", name="uq_facility_location_code"),
        Index("ix_facility_location_tree", "tenant_id", "branch_id", "parent_id", "location_type"),
    )


class Role(Base, AuditedMixin):
    __tablename__ = "roles"
    tenant_id = Column(GUID(), ForeignKey("tenants.id"), nullable=True, index=True)
    code = Column(String(64), nullable=False)
    name = Column(String(128), nullable=False)
    permissions = Column(JSON, default=list)
    is_system = Column(Boolean, default=False)
    __table_args__ = (UniqueConstraint("tenant_id", "code", name="uq_role_tenant_code"),)


class User(Base, AuditedMixin):
    __tablename__ = "users"
    tenant_id = Column(GUID(), ForeignKey("tenants.id"), nullable=True, index=True)
    branch_id = Column(GUID(), ForeignKey("branches.id"), nullable=True)
    email = Column(String(255), nullable=False, index=True)
    full_name = Column(String(255), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role_code = Column(String(64), nullable=False)
    phone = Column(String(32))
    status = Column(String(32), default="active")
    is_super_admin = Column(Boolean, default=False)
    mfa_enabled = Column(Boolean, default=False, nullable=False)
    mfa_secret = Column(String(128), nullable=True)
    __table_args__ = (UniqueConstraint("tenant_id", "email", name="uq_user_tenant_email"),)


class Country(Base, AuditedMixin):
    __tablename__ = "countries"
    code = Column(String(8), unique=True, nullable=False)
    name = Column(String(128), nullable=False)
    dial_code = Column(String(8))
    status = Column(String(32), default="active")


class Gender(Base, AuditedMixin):
    __tablename__ = "genders"
    code = Column(String(16), unique=True, nullable=False)
    name = Column(String(64), nullable=False)
    status = Column(String(32), default="active")


class Specialty(Base, AuditedMixin):
    __tablename__ = "specialties"
    tenant_id = Column(GUID(), ForeignKey("tenants.id"), nullable=True, index=True)
    code = Column(String(64), nullable=False)
    name = Column(String(255), nullable=False)
    status = Column(String(32), default="active")


class Disease(Base, AuditedMixin):
    __tablename__ = "diseases"
    tenant_id = Column(GUID(), ForeignKey("tenants.id"), nullable=True, index=True)
    code = Column(String(64), nullable=False)
    name = Column(String(255), nullable=False)
    icd_code = Column(String(32))
    status = Column(String(32), default="active")


class Medicine(Base, AuditedMixin):
    __tablename__ = "medicines"
    tenant_id = Column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    code = Column(String(64), nullable=False)
    name = Column(String(255), nullable=False)
    form = Column(String(64))
    strength = Column(String(64))
    stock_qty = Column(Numeric(12, 2), default=0)
    status = Column(String(32), default="active")


class LabTest(Base, AuditedMixin):
    __tablename__ = "lab_tests"
    tenant_id = Column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    code = Column(String(64), nullable=False)
    name = Column(String(255), nullable=False)
    sample_type = Column(String(64))
    status = Column(String(32), default="active")


class Tariff(Base, AuditedMixin):
    __tablename__ = "tariffs"
    tenant_id = Column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    branch_id = Column(GUID(), ForeignKey("branches.id"), nullable=True)
    code = Column(String(64), nullable=False)
    name = Column(String(255), nullable=False)
    category = Column(String(64), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    currency = Column(String(8), default="INR")
    status = Column(String(32), default="active")


class ClinicalTemplate(Base, AuditedMixin):
    __tablename__ = "clinical_templates"
    tenant_id = Column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    code = Column(String(64), nullable=False)
    name = Column(String(255), nullable=False)
    template_type = Column(String(64), nullable=False)
    body = Column(JSON, default=dict)
    status = Column(String(32), default="active")


class NotificationTemplate(Base, AuditedMixin):
    __tablename__ = "notification_templates"
    tenant_id = Column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    code = Column(String(64), nullable=False)
    channel = Column(String(32), nullable=False)
    subject = Column(String(255))
    body = Column(Text, nullable=False)
    status = Column(String(32), default="active")


class ConsentTemplate(Base, AuditedMixin):
    __tablename__ = "consent_templates"
    tenant_id = Column(GUID(), ForeignKey("tenants.id"), nullable=True, index=True)
    code = Column(String(64), nullable=False)
    name = Column(String(255), nullable=False)
    purpose = Column(String(128), nullable=False)
    version = Column(String(32), default="1.0")
    body = Column(Text, nullable=False)
    status = Column(String(32), default="active")


class VideoProvider(Base, AuditedMixin):
    __tablename__ = "video_providers"
    code = Column(String(64), unique=True, nullable=False)
    name = Column(String(128), nullable=False)
    capabilities = Column(JSON, default=dict)
    status = Column(String(32), default="active")


class TenantVideoConfig(Base, AuditedMixin):
    __tablename__ = "tenant_video_configs"
    tenant_id = Column(GUID(), ForeignKey("tenants.id"), nullable=False, unique=True)
    provider_code = Column(String(64), nullable=False)
    config = Column(JSON, default=dict)
    recording_enabled = Column(Boolean, default=False)
    retention_days = Column(Integer, default=90)


class LocationPurpose(Base, AuditedMixin):
    __tablename__ = "location_purposes"
    tenant_id = Column(GUID(), ForeignKey("tenants.id"), nullable=True)
    code = Column(String(64), nullable=False)
    name = Column(String(255), nullable=False)
    requires_consent = Column(Boolean, default=True)
    status = Column(String(32), default="active")


class UIActionRegistry(Base, AuditedMixin):
    __tablename__ = "ui_action_registry"
    code = Column(String(128), unique=True, nullable=False)
    label = Column(String(255), nullable=False)
    module = Column(String(128), nullable=False)
    permission = Column(String(128), nullable=False)
    route = Column(String(255))
    status = Column(String(32), default="active")


class Patient(Base, AuditedMixin):
    __tablename__ = "patients"
    tenant_id = Column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    branch_id = Column(GUID(), ForeignKey("branches.id"), nullable=True)
    mrn = Column(String(64), nullable=False)
    first_name = Column(String(128), nullable=False)
    last_name = Column(String(128), nullable=False)
    date_of_birth = Column(String(32))
    gender_code = Column(String(32))
    phone = Column(String(32))
    email = Column(String(255))
    address = Column(Text)
    blood_group = Column(String(8))
    national_id = Column(String(64))
    emergency_contact = Column(JSON, default=dict)
    registration_profile = Column(JSON, default=dict)
    status = Column(String(32), default="active")
    __table_args__ = (
        UniqueConstraint("tenant_id", "mrn", name="uq_patient_tenant_mrn"),
        Index("ix_patient_search", "tenant_id", "first_name", "last_name", "phone"),
    )


class Provider(Base, AuditedMixin):
    __tablename__ = "providers"
    tenant_id = Column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    branch_id = Column(GUID(), ForeignKey("branches.id"), nullable=True)
    department_id = Column(GUID(), ForeignKey("departments.id"), nullable=True)
    primary_location_id = Column(GUID(), ForeignKey("facility_locations.id"), nullable=True)
    user_id = Column(GUID(), ForeignKey("users.id"), nullable=True)
    code = Column(String(64), nullable=False)
    full_name = Column(String(255), nullable=False)
    specialty_code = Column(String(64))
    license_no = Column(String(128))
    consultation_fee_code = Column(String(64))
    status = Column(String(32), default="active")


class ProviderSchedule(Base, AuditedMixin):
    __tablename__ = "provider_schedules"
    tenant_id = Column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    provider_id = Column(GUID(), ForeignKey("providers.id"), nullable=False)
    day_of_week = Column(Integer, nullable=False)
    start_time = Column(String(8), nullable=False)
    end_time = Column(String(8), nullable=False)
    slot_minutes = Column(Integer, default=15)
    mode = Column(String(32), default="in_person")  # in_person | telemedicine | both


class Appointment(Base, AuditedMixin):
    __tablename__ = "appointments"
    tenant_id = Column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    branch_id = Column(GUID(), ForeignKey("branches.id"), nullable=True)
    patient_id = Column(GUID(), ForeignKey("patients.id"), nullable=False)
    provider_id = Column(GUID(), ForeignKey("providers.id"), nullable=False)
    scheduled_at = Column(DateTime(timezone=True), nullable=False)
    mode = Column(String(32), default="in_person")
    status = Column(String(32), default="scheduled")
    reason = Column(Text)
    queue_token = Column(String(32))
    notes = Column(Text)
    booking_profile = Column(JSON, default=dict)


class Encounter(Base, AuditedMixin):
    __tablename__ = "encounters"
    tenant_id = Column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    branch_id = Column(GUID(), ForeignKey("branches.id"), nullable=True)
    patient_id = Column(GUID(), ForeignKey("patients.id"), nullable=False)
    provider_id = Column(GUID(), ForeignKey("providers.id"), nullable=False)
    appointment_id = Column(GUID(), ForeignKey("appointments.id"), nullable=True)
    encounter_type = Column(String(32), default="opd")
    status = Column(String(32), default="open")
    chief_complaint = Column(Text)
    assessment = Column(Text)
    plan = Column(Text)
    started_at = Column(DateTime(timezone=True), default=utcnow)
    closed_at = Column(DateTime(timezone=True), nullable=True)


class Vital(Base, AuditedMixin):
    __tablename__ = "vitals"
    tenant_id = Column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    encounter_id = Column(GUID(), ForeignKey("encounters.id"), nullable=False)
    patient_id = Column(GUID(), ForeignKey("patients.id"), nullable=False)
    bp_systolic = Column(Integer)
    bp_diastolic = Column(Integer)
    pulse = Column(Integer)
    temperature_c = Column(Numeric(5, 2))
    spo2 = Column(Integer)
    weight_kg = Column(Numeric(6, 2))
    height_cm = Column(Numeric(6, 2))
    recorded_at = Column(DateTime(timezone=True), default=utcnow)


class ClinicalNote(Base, AuditedMixin):
    __tablename__ = "clinical_notes"
    tenant_id = Column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    encounter_id = Column(GUID(), ForeignKey("encounters.id"), nullable=False)
    note_type = Column(String(64), default="progress")
    content = Column(Text, nullable=False)
    template_code = Column(String(64))


class EncounterDiagnosis(Base, AuditedMixin):
    __tablename__ = "encounter_diagnoses"
    tenant_id = Column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    encounter_id = Column(GUID(), ForeignKey("encounters.id"), nullable=False)
    disease_code = Column(String(64), nullable=False)
    disease_name = Column(String(255), nullable=False)
    is_primary = Column(Boolean, default=True)


class Prescription(Base, AuditedMixin):
    __tablename__ = "prescriptions"
    tenant_id = Column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    encounter_id = Column(GUID(), ForeignKey("encounters.id"), nullable=False)
    patient_id = Column(GUID(), ForeignKey("patients.id"), nullable=False)
    provider_id = Column(GUID(), ForeignKey("providers.id"), nullable=False)
    status = Column(String(32), default="draft")
    notes = Column(Text)


class PrescriptionLine(Base, AuditedMixin):
    __tablename__ = "prescription_lines"
    tenant_id = Column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    prescription_id = Column(GUID(), ForeignKey("prescriptions.id"), nullable=False)
    medicine_code = Column(String(64), nullable=False)
    medicine_name = Column(String(255), nullable=False)
    dose = Column(String(64))
    frequency = Column(String(64))
    duration = Column(String(64))
    instructions = Column(Text)


class TelemedicineSession(Base, AuditedMixin):
    __tablename__ = "telemedicine_sessions"
    tenant_id = Column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    appointment_id = Column(GUID(), ForeignKey("appointments.id"), nullable=False)
    patient_id = Column(GUID(), ForeignKey("patients.id"), nullable=False)
    provider_id = Column(GUID(), ForeignKey("providers.id"), nullable=False)
    provider_code = Column(String(64), default="twilio")
    room_id = Column(String(128), nullable=False)
    status = Column(String(32), default="waiting")
    join_token_patient = Column(String(512))
    join_token_provider = Column(String(512))
    recording_consent_id = Column(GUID(), nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    ended_at = Column(DateTime(timezone=True), nullable=True)
    post_call_summary = Column(Text)


class ConsentCapture(Base, AuditedMixin):
    __tablename__ = "consent_captures"
    tenant_id = Column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    patient_id = Column(GUID(), ForeignKey("patients.id"), nullable=False)
    template_code = Column(String(64), nullable=False)
    purpose = Column(String(128), nullable=False)
    version = Column(String(32), nullable=False)
    granted = Column(Boolean, nullable=False)
    captured_at = Column(DateTime(timezone=True), default=utcnow)
    metadata_json = Column(JSON, default=dict)


class LocationEvent(Base, AuditedMixin):
    __tablename__ = "location_events"
    tenant_id = Column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    patient_id = Column(GUID(), ForeignKey("patients.id"), nullable=True)
    purpose_code = Column(String(64), nullable=False)
    consent_id = Column(GUID(), ForeignKey("consent_captures.id"), nullable=True)
    latitude = Column(Numeric(10, 7))
    longitude = Column(Numeric(10, 7))
    accuracy_m = Column(Numeric(10, 2))
    captured_at = Column(DateTime(timezone=True), default=utcnow)


class Invoice(Base, AuditedMixin):
    __tablename__ = "invoices"
    tenant_id = Column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    branch_id = Column(GUID(), ForeignKey("branches.id"), nullable=True)
    patient_id = Column(GUID(), ForeignKey("patients.id"), nullable=False)
    encounter_id = Column(GUID(), ForeignKey("encounters.id"), nullable=True)
    invoice_no = Column(String(64), nullable=False)
    status = Column(String(32), default="draft")
    subtotal = Column(Numeric(12, 2), default=0)
    tax = Column(Numeric(12, 2), default=0)
    total = Column(Numeric(12, 2), default=0)
    currency = Column(String(8), default="INR")
    __table_args__ = (UniqueConstraint("tenant_id", "invoice_no", name="uq_invoice_tenant_no"),)


class InvoiceLine(Base, AuditedMixin):
    __tablename__ = "invoice_lines"
    tenant_id = Column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    invoice_id = Column(GUID(), ForeignKey("invoices.id"), nullable=False)
    tariff_code = Column(String(64), nullable=False)
    description = Column(String(255), nullable=False)
    qty = Column(Numeric(10, 2), default=1)
    unit_price = Column(Numeric(12, 2), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)


class Payment(Base, AuditedMixin):
    __tablename__ = "payments"
    tenant_id = Column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    invoice_id = Column(GUID(), ForeignKey("invoices.id"), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    currency = Column(String(8), default="INR")
    gateway = Column(String(64), default="stub")
    gateway_token_ref = Column(String(255), nullable=False)
    masked_last4 = Column(String(4))
    status = Column(String(32), default="succeeded")
    paid_at = Column(DateTime(timezone=True), default=utcnow)


class AuditLog(Base, AuditedMixin):
    __tablename__ = "audit_logs"
    tenant_id = Column(GUID(), nullable=True, index=True)
    actor_user_id = Column(GUID(), nullable=True)
    action = Column(String(64), nullable=False)
    entity_type = Column(String(128), nullable=False)
    entity_id = Column(String(64), nullable=True)
    old_values = Column(JSON)
    new_values = Column(JSON)
    ip_address = Column(String(64))
    user_agent = Column(String(512))
    reason = Column(Text)


class ApiAuditLog(Base, AuditedMixin):
    __tablename__ = "api_audit_logs"
    tenant_id = Column(GUID(), nullable=True, index=True)
    actor_user_id = Column(GUID(), nullable=True)
    method = Column(String(16), nullable=False)
    path = Column(String(512), nullable=False)
    status_code = Column(Integer)
    latency_ms = Column(Integer)
    request_body_masked = Column(JSON)
    response_summary = Column(JSON)
    ip_address = Column(String(64))


class NotificationOutbox(Base, AuditedMixin):
    __tablename__ = "notification_outbox"
    tenant_id = Column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    channel = Column(String(32), nullable=False)
    recipient = Column(String(255), nullable=False)
    subject = Column(String(255))
    body = Column(Text, nullable=False)
    status = Column(String(32), default="pending")
    sent_at = Column(DateTime(timezone=True), nullable=True)


class PlatformModule(Base, AuditedMixin):
    __tablename__ = "platform_modules"
    code = Column(String(128), unique=True, nullable=False)
    name = Column(String(255), nullable=False)
    category = Column(String(64), nullable=False)
    route = Column(String(255), nullable=False)
    api_slug = Column(String(128), nullable=False)
    submodules = Column(JSON, default=list)
    fields_schema = Column(JSON, default=list)
    statuses = Column(JSON, default=list)
    is_dedicated = Column(Boolean, default=False)
    active = Column(Boolean, default=True)


class ModuleRecord(Base, AuditedMixin):
    __tablename__ = "module_records"
    tenant_id = Column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    branch_id = Column(GUID(), ForeignKey("branches.id"), nullable=True)
    module_code = Column(String(128), nullable=False, index=True)
    submodule = Column(String(128), nullable=False)
    reference_no = Column(String(64), nullable=False)
    title = Column(String(255), nullable=False)
    status = Column(String(32), default="draft")
    patient_id = Column(GUID(), ForeignKey("patients.id"), nullable=True)
    provider_id = Column(GUID(), ForeignKey("providers.id"), nullable=True)
    payload = Column(JSON, default=dict)
    __table_args__ = (
        UniqueConstraint("tenant_id", "module_code", "reference_no", name="uq_module_record_ref"),
        Index("ix_module_record_search", "tenant_id", "module_code", "status"),
    )


class RoomCategory(Base, AuditedMixin):
    __tablename__ = "room_categories"
    tenant_id = Column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    branch_id = Column(GUID(), ForeignKey("branches.id"), nullable=True)
    code = Column(String(64), nullable=False)
    name = Column(String(255), nullable=False)
    tariff_class = Column(String(64))
    nursing_station = Column(String(128))
    status = Column(String(32), default="active")


class Bed(Base, AuditedMixin):
    __tablename__ = "beds"
    tenant_id = Column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    branch_id = Column(GUID(), ForeignKey("branches.id"), nullable=True)
    room_id = Column(GUID(), ForeignKey("facility_locations.id"), nullable=True, index=True)
    room_category_id = Column(GUID(), ForeignKey("room_categories.id"), nullable=True)
    room_code = Column(String(64), nullable=False)
    bed_code = Column(String(64), nullable=False)
    category_code = Column(String(64))
    status = Column(String(32), default="available")
    isolation_flag = Column(Boolean, default=False)
    equipment_tags = Column(JSON, default=list)


class InsurancePayer(Base, AuditedMixin):
    __tablename__ = "insurance_payers"
    tenant_id = Column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    code = Column(String(64), nullable=False)
    name = Column(String(255), nullable=False)
    tpa_name = Column(String(255))
    api_endpoint = Column(String(512))
    claim_rules = Column(JSON, default=dict)
    status = Column(String(32), default="active")


class InsuranceClaim(Base, AuditedMixin):
    __tablename__ = "insurance_claims"
    tenant_id = Column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    patient_id = Column(GUID(), ForeignKey("patients.id"), nullable=False)
    payer_code = Column(String(64), nullable=False)
    claim_no = Column(String(64), nullable=False)
    status = Column(String(32), default="draft")
    amount = Column(Numeric(12, 2), default=0)
    pre_auth_no = Column(String(128))
    policy_no = Column(String(128))
    notes = Column(Text)
    claim_profile = Column(JSON, default=dict)


class LabOrder(Base, AuditedMixin):
    __tablename__ = "lab_orders"
    tenant_id = Column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    patient_id = Column(GUID(), ForeignKey("patients.id"), nullable=False)
    provider_id = Column(GUID(), ForeignKey("providers.id"), nullable=True)
    encounter_id = Column(GUID(), ForeignKey("encounters.id"), nullable=True)
    order_no = Column(String(64), nullable=False)
    test_code = Column(String(64), nullable=False)
    status = Column(String(32), default="ordered")
    result_value = Column(String(255))
    result_notes = Column(Text)
    results = Column(JSON, default=dict)
    critical_flag = Column(Boolean, default=False)
    order_profile = Column(JSON, default=dict)


class RadiologyOrder(Base, AuditedMixin):
    __tablename__ = "radiology_orders"
    tenant_id = Column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    patient_id = Column(GUID(), ForeignKey("patients.id"), nullable=False)
    provider_id = Column(GUID(), ForeignKey("providers.id"), nullable=True)
    encounter_id = Column(GUID(), ForeignKey("encounters.id"), nullable=True)
    order_no = Column(String(64), nullable=False)
    study_code = Column(String(64), nullable=False)
    status = Column(String(32), default="ordered")
    report_text = Column(Text)
    pacs_link = Column(String(512))
    critical_flag = Column(Boolean, default=False)
    scheduled_at = Column(DateTime(timezone=True), nullable=True)
    order_profile = Column(JSON, default=dict)


class PharmacyDispense(Base, AuditedMixin):
    __tablename__ = "pharmacy_dispenses"
    tenant_id = Column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    prescription_id = Column(GUID(), ForeignKey("prescriptions.id"), nullable=True)
    prescription_line_id = Column(GUID(), ForeignKey("prescription_lines.id"), nullable=True)
    encounter_id = Column(GUID(), ForeignKey("encounters.id"), nullable=True)
    patient_id = Column(GUID(), ForeignKey("patients.id"), nullable=False)
    dispense_no = Column(String(64), nullable=False)
    medicine_code = Column(String(64), nullable=False)
    qty = Column(Numeric(10, 2), default=1)
    status = Column(String(32), default="queued")
    substitution_code = Column(String(64))
    dispense_profile = Column(JSON, default=dict)


class NursingTask(Base, AuditedMixin):
    __tablename__ = "nursing_tasks"
    tenant_id = Column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    patient_id = Column(GUID(), ForeignKey("patients.id"), nullable=False)
    admission_id = Column(GUID(), ForeignKey("ipd_admissions.id"), nullable=True)
    task_type = Column(String(64), nullable=False)
    description = Column(Text)
    status = Column(String(32), default="pending")
    due_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    assigned_to = Column(GUID(), ForeignKey("users.id"), nullable=True)
    care_profile = Column(JSON, default=dict)
    __table_args__ = (
        Index("ix_nursing_task_search", "tenant_id", "admission_id", "status", "due_at"),
    )


class IpdAdmission(Base, AuditedMixin):
    __tablename__ = "ipd_admissions"
    tenant_id = Column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    patient_id = Column(GUID(), ForeignKey("patients.id"), nullable=False)
    bed_id = Column(GUID(), ForeignKey("beds.id"), nullable=True, index=True)
    ward_id = Column(GUID(), ForeignKey("facility_locations.id"), nullable=True)
    admission_no = Column(String(64), nullable=False)
    bed_code = Column(String(64))
    ward_code = Column(String(64))
    status = Column(String(32), default="admitted")
    admitted_at = Column(DateTime(timezone=True), default=utcnow)
    discharged_at = Column(DateTime(timezone=True), nullable=True)
    diagnosis_code = Column(String(64))
    admission_profile = Column(JSON, default=dict)


class WorkflowDefinition(Base, AuditedMixin):
    __tablename__ = "workflow_definitions"
    tenant_id = Column(GUID(), ForeignKey("tenants.id"), nullable=True, index=True)
    workflow_code = Column(String(64), nullable=False)
    name = Column(String(255), nullable=False)
    module_code = Column(String(128))
    steps = Column(JSON, default=list)
    transitions = Column(JSON, default=list)
    status = Column(String(32), default="active")


class ReportDefinition(Base, AuditedMixin):
    __tablename__ = "report_definitions"
    tenant_id = Column(GUID(), ForeignKey("tenants.id"), nullable=True, index=True)
    code = Column(String(64), nullable=False)
    name = Column(String(255), nullable=False)
    audience = Column(String(128))
    filters = Column(JSON, default=list)
    metrics = Column(JSON, default=list)
    module_code = Column(String(128))
    status = Column(String(32), default="active")


class KpiDefinition(Base, AuditedMixin):
    __tablename__ = "kpi_definitions"
    tenant_id = Column(GUID(), ForeignKey("tenants.id"), nullable=True, index=True)
    code = Column(String(64), nullable=False)
    label = Column(String(255), nullable=False)
    module_code = Column(String(128))
    drilldown_route = Column(String(255))
    query_hint = Column(String(255))
    status = Column(String(32), default="active")


class ExpandedResource(Base, AuditedMixin):
    __tablename__ = "expanded_resources"
    tenant_id = Column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    branch_id = Column(GUID(), ForeignKey("branches.id"), nullable=True)
    area_code = Column(String(128), nullable=False, index=True)
    resource_code = Column(String(128), nullable=False, index=True)
    reference_no = Column(String(64), nullable=False)
    title = Column(String(255), nullable=False)
    status = Column(String(32), default="draft")
    payload = Column(JSON, default=dict)
    __table_args__ = (
        UniqueConstraint("tenant_id", "area_code", "resource_code", "reference_no", name="uq_expanded_ref"),
        Index("ix_expanded_search", "tenant_id", "area_code", "resource_code", "status"),
    )


class PasswordResetToken(Base, AuditedMixin):
    __tablename__ = "password_reset_tokens"
    user_id = Column(GUID(), ForeignKey("users.id"), nullable=False, index=True)
    token_hash = Column(String(128), nullable=False, unique=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used = Column(Boolean, default=False, nullable=False)


class CarePathwayTemplate(Base, AuditedMixin):
    __tablename__ = "care_pathway_templates"
    tenant_id = Column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    code = Column(String(64), nullable=False)
    name = Column(String(255), nullable=False)
    disease_code = Column(String(64), nullable=False)
    milestones = Column(JSON, default=list)
    status = Column(String(32), default="active")
    __table_args__ = (UniqueConstraint("tenant_id", "code", name="uq_pathway_template_tenant_code"),)


class PathwayEnrollment(Base, AuditedMixin):
    __tablename__ = "pathway_enrollments"
    tenant_id = Column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    patient_id = Column(GUID(), ForeignKey("patients.id"), nullable=False, index=True)
    pathway_id = Column(GUID(), ForeignKey("care_pathway_templates.id"), nullable=False, index=True)
    status = Column(String(32), default="active")
    current_milestone = Column(String(128), default="")
    enrolled_at = Column(DateTime(timezone=True), default=utcnow)
    completed_at = Column(DateTime(timezone=True), nullable=True)


class PaymentRefund(Base, AuditedMixin):
    __tablename__ = "payment_refunds"
    tenant_id = Column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    payment_id = Column(GUID(), ForeignKey("payments.id"), nullable=False)
    invoice_id = Column(GUID(), ForeignKey("invoices.id"), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    reason = Column(Text)
    status = Column(String(32), default="pending")
    gateway_ref = Column(String(255))


class DocumentMetadata(Base, AuditedMixin):
    __tablename__ = "document_metadata"
    tenant_id = Column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    branch_id = Column(GUID(), ForeignKey("branches.id"), nullable=True)
    entity_type = Column(String(128), nullable=False)
    entity_id = Column(GUID(), nullable=True)
    file_name = Column(String(255), nullable=False)
    content_type = Column(String(128))
    storage_key = Column(String(512), nullable=False)
    size_bytes = Column(Integer, default=0)
    status = Column(String(32), default="active")


class TriageAssessment(Base, AuditedMixin):
    __tablename__ = "triage_assessments"
    tenant_id = Column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    patient_id = Column(GUID(), ForeignKey("patients.id"), nullable=False, index=True)
    triage_no = Column(String(64), nullable=False)
    chief_complaint = Column(Text)
    esi_level = Column(Integer, default=3)
    status = Column(String(32), default="arrived")
    disposition = Column(String(64))
    notes = Column(Text)
    arrived_at = Column(DateTime(timezone=True), default=utcnow)
    triaged_at = Column(DateTime(timezone=True), nullable=True)
    disposition_at = Column(DateTime(timezone=True), nullable=True)
    clinical_profile = Column(JSON, default=dict)
    __table_args__ = (
        Index("ix_triage_search", "tenant_id", "status", "esi_level", "arrived_at"),
    )


class OtProcedure(Base, AuditedMixin):
    __tablename__ = "ot_procedures"
    tenant_id = Column(GUID(), ForeignKey("tenants.id"), nullable=False, index=True)
    patient_id = Column(GUID(), ForeignKey("patients.id"), nullable=False, index=True)
    procedure_tariff_id = Column(GUID(), ForeignKey("tariffs.id"), nullable=True)
    theatre_id = Column(GUID(), ForeignKey("facility_locations.id"), nullable=True)
    procedure_no = Column(String(64), nullable=False)
    procedure_code = Column(String(64), nullable=False)
    procedure_name = Column(String(255), nullable=False)
    surgeon_id = Column(GUID(), ForeignKey("providers.id"), nullable=True)
    theatre_code = Column(String(64))
    status = Column(String(32), default="scheduled")
    scheduled_at = Column(DateTime(timezone=True), nullable=True)
    pre_op_checklist = Column(JSON, default=dict)
    intra_op_notes = Column(Text)
    implant_tracking = Column(JSON, default=list)
    procedure_profile = Column(JSON, default=dict)
    __table_args__ = (
        Index("ix_ot_search", "tenant_id", "status", "scheduled_at"),
    )


class FeatureRequirement(Base, AuditedMixin):
    """Excel feature backlog row — synced from module catalog × workflow stages."""
    __tablename__ = "feature_requirements"
    feature_id = Column(String(32), unique=True, nullable=False, index=True)
    module_code = Column(String(128), nullable=False, index=True)
    submodule = Column(String(128), nullable=False)
    workflow_stage = Column(String(64), nullable=False)
    feature_name = Column(String(255), nullable=False)
    platform = Column(String(32), default="Web")
    priority = Column(String(32), default="Must Have")
    api_route = Column(String(512))
    implemented = Column(Boolean, default=False, nullable=False)
    __table_args__ = (
        Index("ix_feature_module", "module_code", "submodule", "workflow_stage"),
    )

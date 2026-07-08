from datetime import datetime
from typing import Any, Optional
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    tenant_code: Optional[str] = None
    role_code: str
    full_name: str
    permissions: list[str] = []


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    tenant_code: Optional[str] = None


class RefreshRequest(BaseModel):
    access_token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr
    tenant_code: Optional[str] = None


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8)


class MfaSetupResponse(BaseModel):
    secret: str
    otpauth_url: str


class MfaVerifyRequest(BaseModel):
    code: str


class DepartmentCreate(BaseModel):
    code: str
    name: str
    branch_id: Optional[UUID] = None


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str
    role_code: str
    password: str = Field(min_length=8)
    branch_id: Optional[UUID] = None


class DepartmentOut(BaseModel):
    id: UUID
    code: str
    name: str
    branch_id: Optional[UUID]
    status: str

    class Config:
        from_attributes = True


class PatientUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    gender_code: Optional[str] = None
    address: Optional[str] = None
    status: Optional[str] = None


class QueueTokenCreate(BaseModel):
    appointment_id: UUID


class WaitingRoomAction(BaseModel):
    session_id: UUID
    action: str = Field(pattern="^(admit|hold)$")


class InCallNoteCreate(BaseModel):
    session_id: UUID
    content: str
    note_type: str = "progress"


class NotificationOutboxCreate(BaseModel):
    channel: str = "email"
    recipient: str
    subject: str = ""
    body: str


class TenantCreate(BaseModel):
    tenant_code: str = Field(min_length=2, max_length=50)
    name: str
    plan_code: str = "standard"
    admin_email: EmailStr
    admin_password: str = Field(min_length=8)
    admin_full_name: str
    branch_name: str = "Main Branch"
    modules: dict[str, bool] = Field(default_factory=lambda: {
        "patients": True, "appointments": True, "opd": True,
        "telemedicine": True, "billing": True, "masters": True
    })


class TenantOut(BaseModel):
    id: UUID
    tenant_code: str
    name: str
    status: str
    plan_code: str
    modules: dict[str, Any]
    branding: dict[str, Any]

    class Config:
        from_attributes = True


class BranchCreate(BaseModel):
    code: str
    name: str
    address: Optional[str] = None
    city: Optional[str] = None


class BranchOut(BaseModel):
    id: UUID
    code: str
    name: str
    address: Optional[str]
    city: Optional[str]
    status: str

    class Config:
        from_attributes = True


class MasterItemCreate(BaseModel):
    code: str
    name: str
    status: str = "active"
    extra: dict[str, Any] = Field(default_factory=dict)


class PatientCreate(BaseModel):
    first_name: str
    last_name: str
    date_of_birth: Optional[str] = None
    gender_code: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    blood_group: Optional[str] = None
    national_id: Optional[str] = None
    branch_id: Optional[UUID] = None
    emergency_contact: dict[str, Any] = Field(default_factory=dict)


class PatientOut(BaseModel):
    id: UUID
    mrn: str
    first_name: str
    last_name: str
    date_of_birth: Optional[str]
    gender_code: Optional[str]
    phone: Optional[str]
    email: Optional[str]
    status: str

    class Config:
        from_attributes = True


class ProviderCreate(BaseModel):
    code: str
    full_name: str
    specialty_code: Optional[str] = None
    license_no: Optional[str] = None
    branch_id: Optional[UUID] = None
    consultation_fee_code: Optional[str] = None


class ProviderOut(BaseModel):
    id: UUID
    code: str
    full_name: str
    specialty_code: Optional[str]
    status: str

    class Config:
        from_attributes = True


class ScheduleCreate(BaseModel):
    day_of_week: int = Field(ge=0, le=6)
    start_time: str
    end_time: str
    slot_minutes: int = 15
    mode: str = "both"


class AppointmentCreate(BaseModel):
    patient_id: UUID
    provider_id: UUID
    scheduled_at: datetime
    mode: str = "in_person"
    reason: Optional[str] = None
    branch_id: Optional[UUID] = None


class AppointmentOut(BaseModel):
    id: UUID
    patient_id: UUID
    provider_id: UUID
    scheduled_at: datetime
    mode: str
    status: str
    queue_token: Optional[str]
    reason: Optional[str]

    class Config:
        from_attributes = True


class EncounterCreate(BaseModel):
    patient_id: UUID
    provider_id: UUID
    appointment_id: Optional[UUID] = None
    encounter_type: str = "opd"
    chief_complaint: Optional[str] = None
    branch_id: Optional[UUID] = None


class VitalCreate(BaseModel):
    bp_systolic: Optional[int] = None
    bp_diastolic: Optional[int] = None
    pulse: Optional[int] = None
    temperature_c: Optional[float] = None
    spo2: Optional[int] = None
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None


class NoteCreate(BaseModel):
    content: str
    note_type: str = "progress"
    template_code: Optional[str] = None


class DiagnosisCreate(BaseModel):
    disease_code: str
    disease_name: str
    is_primary: bool = True


class PrescriptionCreate(BaseModel):
    notes: Optional[str] = None
    lines: list[dict[str, Any]] = Field(default_factory=list)


class DischargeCreate(BaseModel):
    assessment: str = ""
    plan: str = ""


class TeleSessionCreate(BaseModel):
    appointment_id: UUID


class ConsentCreate(BaseModel):
    patient_id: UUID
    template_code: str
    purpose: str
    version: str = "1.0"
    granted: bool = True
    metadata_json: dict[str, Any] = Field(default_factory=dict)


class LocationEventCreate(BaseModel):
    purpose_code: str
    patient_id: Optional[UUID] = None
    consent_id: Optional[UUID] = None
    latitude: float
    longitude: float
    accuracy_m: Optional[float] = None


class InvoiceCreate(BaseModel):
    patient_id: UUID
    encounter_id: Optional[UUID] = None
    lines: list[dict[str, Any]]


class PaymentCreate(BaseModel):
    invoice_id: UUID
    amount: float
    gateway_token_ref: str
    masked_last4: Optional[str] = None
    gateway: str = "stub"


class MessageOut(BaseModel):
    message: str
    id: Optional[UUID] = None

# SUMAYA Care 360 - BUILD SPEC (MVP + Phase 1 Foundation)

> Synthesized from `SUMAYA_Care_360_Enterprise_Requirements_Audit_Telemedicine_Expanded.xlsx` and `requirements_dump.md` on 2026-07-08. Feature Backlog module counts verified from **all 3,210 rows** via Excel extraction.

---

## 1. Executive summary

SUMAYA Care 360 is a **multi-tenant healthcare SaaS** for hospitals, clinics, and telemedicine. The platform must be **database-driven** (no dummy data, no hard-coded masters), **tenant-isolated**, **audited end-to-end**, and **responsive** on web and mobile.

**MVP goal:** End-to-end flow for **tenant onboarding -> auth/RBAC -> patients -> providers -> appointments/queue -> OPD/teleconsult -> basic EHR (encounter, vitals, notes, eRx stub) -> billing stubs -> super/tenant admin**, with audit, API logging, telemedicine video abstraction, and location consent hooks.

**Scale reference (workbook):** 3,210 feature rows; 2,303 Must Have; 500 expanded API rows; 900 Cursor prompts.

---

## 2. Technology stack (Architecture sheet)

| Layer | Technology | Requirement |
| --- | --- | --- |
| Web Frontend | React + TypeScript | Responsive hospital/admin/doctor/patient portals; API-driven configuration; no hardcoded masters |
| Mobile | React Native or Flutter | Patient, doctor, nurse, physiotherapist, caregiver; secure token storage; push notifications |
| Backend | FastAPI | Modular services; tenant middleware; RBAC; audit logging; validation; async jobs; OpenAPI |
| Database | PostgreSQL | `tenant_id` isolation; RLS where suitable; migrations; indexed transactions |
| Cache/Queue | Redis + Celery/RQ | Notifications, reports, claim retries, telemedicine events, integration retries |
| Storage | S3-compatible | Documents, lab reports, consent, images; tenant-scoped paths; signed URLs |
| Auth | JWT/OAuth2 + MFA | Super admin, tenant admin, branch admin, provider, patient, caregiver |
| Telemedicine | WebRTC / managed video | Video, chat, waiting room, consent, recording per tenant policy |
| Integration | REST / FHIR / HL7 | Insurance, payments, WhatsApp/SMS/email, accounting, PACS, labs |
| DevOps | Docker Compose -> K8s-ready | Migrations; seed **configuration templates only**; CI/CD; monitoring |
| Security | Encryption + audit + secrets | PHI/PII protection; least privilege; rate limits; activity logs |
| Security Architecture | PCI-aware healthcare controls | No raw card data in DB; hosted payment fields; tokenized refs; MFA; RBAC |
| Responsive UX | React design system | 100% responsive; accessibility; cross-browser |
| Dashboard & KPI | Role-aware drill-down | Every KPI clickable with tenant/branch/date/role filters |
| Data Integrity | DB-driven only | All dropdowns, tariffs, workflows, templates from PostgreSQL |
| Release Quality Gate | Automated + manual QA | No broken buttons/links; smoke tests before production |

**Dashboard one-liner:** React Web + React Native or Flutter + FastAPI + PostgreSQL + Docker.

---

## 3. Multi-tenant model

| Concept | Rule |
| --- | --- |
| URL pattern | `https://sumayacare360.com/{tenant-code}` |
| Resolution | `tenant_code` in URL + JWT claims must match; middleware rejects cross-tenant access |
| Row scope | Every transaction carries `tenant_id`, `tenant_code`, `branch_id` (where applicable) |
| Audit metadata | `created_by`, `updated_by`, timestamps, `correlation_id`, IP/device/session on sensitive actions |
| Files / video | Tenant-scoped object keys; signed URLs; no cross-tenant bucket paths |
| Super Admin | Global tenants/plans/masters; **no** cross-tenant clinical/billing data access |
| Branch | Hospital/clinic branch under tenant; departments, rooms, beds, rosters |
| Plans / modules | Tenant onboarding activates modules per subscription (Roadmap Phase 1) |

**Implementation:** FastAPI dependency `get_tenant_context()` from host/path + JWT; repository base class enforcing `tenant_id` filter; automated isolation tests (Quality Gate).

---

## 4. Global standards (mandatory for all tables/APIs/UI)

| ID | Area | Mandatory standard |
| --- | --- | --- |
| STD-001 | Audit fields | Standard column set on every business table (UUID PK, tenant/branch, created/updated/deleted, `row_version`, `correlation_id`, etc.) |
| STD-002 | Immutable audit log | Append-only `audit_log` for CRUD/view/export/payment/claim/video/config |
| STD-003 | API audit | `api_audit_log` with masked payloads, latency, status, correlation ID |
| STD-004 | No dummy data | All business values from PostgreSQL masters/config |
| STD-005 | Responsive UI | 360px / 768px / 1024px / desktop |
| STD-006 | Clickable KPIs | KPI metadata -> filtered drill-down routes |
| STD-007 | Every button works | UI action registry: permission, handler, audit |
| STD-008 | PCI safety | Tokenized payments only; masked last4 |
| STD-009 | Clinical privacy | PHI encryption, RBAC, consent, access audit |
| STD-010 | Tenant isolation | Enforced in every query/API/file/report |
| STD-011 | Video recording consent | No recording without versioned consent |
| STD-012 | Location consent | Purpose-based GPS with `consent_id` |

---

## 5. Phase 1 masters & configuration entities

### 5.1 Core masters (`Masters` sheet - all populated rows)

| Master area | Entity | Scope | Managed by |
| --- | --- | --- | --- |
| Global | `country_master` | Global | Super Admin |
| Global | `specialty_master` | Global | Super Admin |
| Global | `disease_master` | Global / tenant override | Super Admin / Tenant Admin |
| Tenant | `tenant_master` | Global | Super Admin |
| Tenant | `branch_master` | Tenant | Tenant Admin |
| Tenant | `department_master` | Tenant / branch | Branch Admin |
| Tenant | `room_category_master` | Tenant / branch | Branch Admin |
| Tenant | `bed_master` | Tenant / branch | Branch Admin |
| Tenant | `tariff_master` | Tenant / branch / payer | Billing Admin |
| Tenant | `insurance_payer_master` | Tenant | Insurance Desk |
| Tenant | `clinical_template_master` | Tenant / provider | Doctor Admin |
| Tenant | `notification_template_master` | Tenant | Tenant Admin |
| Tenant | `medicine_master` | Tenant | Pharmacy Admin |
| Tenant | `lab_test_master` | Tenant | Lab Admin |
| Tenant | `service_provider_master` | Tenant / branch | Operations |

### 5.2 Expanded masters (Phase 1 engineering  param($m) switch -regex ($m.Value) { '–|—' { '-' } '…' { '...' } default { '-' } }  implement with platform)

| ID | Master / config | Scope |
| --- | --- | --- |
| M-AUD-001 | Audit Action Master | Global + tenant override |
| M-AUD-002 | Audit Field Masking Rules | Global + tenant |
| M-API-001 | API Registry | Global |
| M-LOC-001 | Location Purpose Master | Global + tenant |
| M-LOC-002 | Google Maps Configuration | Tenant (secret refs) |
| M-VID-001 | Video Provider Master | Global |
| M-VID-002 | Tenant Video Provider Config | Tenant |
| M-VID-003 | Recording Retention Policy | Global + tenant |
| M-CONS-001 | Consent Template Master | Global + tenant |
| M-QA-001 | UI Action Registry | Global |

### 5.3 Phase 1 platform tables (derived from standards + audit matrix)

- `users`, `roles`, `permissions`, `role_permissions`, `user_roles`, `user_branches`
- `plans`, `tenant_modules`, `tenant_branding`
- `workflow_definition`, `workflow_step`, `workflow_transition` (DB-driven states)
- `audit_log`, `api_audit_log`, `clinical_access_log`
- `consent_capture`, `location_event` (consent-gated stub)
- `kpi_definition` (for future dashboards; seed metadata only)

---

## 6. MVP core modules (end-to-end scope)

Aligned with **Roadmap Phase 1 + Phase 2 minimum** and user-requested MVP:

| # | Module | MVP capability |
| --- | --- | --- |
| 1 | **Identity, RBAC & Security** | Login, refresh, MFA hook, password policy, session control, permission checks |
| 2 | **Super Admin & SaaS Control** | Create tenant, plan, URL code, module flags, global masters CRUD |
| 3 | **Hospital/Clinic Administration** | Tenant settings, branding, branches, departments |
| 4 | **Patient Registration & CRM** | Register/search patient, demographics, identifiers, branch assignment |
| 5 | **Doctor & Provider Management** | Provider profile, specialty, schedule template, branch linkage |
| 6 | **Appointment & Queue Management** | Book slot, token/queue, status workflow, reminders stub |
| 7 | **OPD Clinical Workflow** | Encounter, vitals, clinical notes, diagnosis link to `disease_master`, orders stub |
| 8 | **Telemedicine & Virtual Care** | Session, waiting room, provider adapter, consent, join tokens, post-call summary stub |
| 9 | **Document, Forms & Templates** | Clinical template render; consent PDF capture |
| 10 | **Billing, Tariff & Payments (stubs)** | Estimate/invoice draft from `tariff_master`; payment intent via gateway token (no raw card) |
| 11 | **Notifications & Engagement (stub)** | Template-driven email/SMS queue via worker |
| 12 | **Audit Trail & Governance** | Audit viewer, API log viewer, masking rules |
| 13 | **API Observability** | Correlation ID, request/response logging middleware |

**Explicitly post-MVP (Phase 3+):** IPD, pharmacy dispense, lab/radiology workflows, insurance claims production, disease pathways (360 features), marketplace.

---

## 7. Roles & access (MVP enforcement)

| Role | MVP focus |
| --- | --- |
| Super Admin | Tenants, plans, global masters, API registry |
| Tenant Admin | Branches, users, templates, video/maps config |
| Branch Admin | Departments, room categories, beds (readiness for Phase 3) |
| Doctor | Appointments, OPD encounter, teleconsult, eRx stub |
| Nurse | Vitals capture (OPD) |
| Receptionist | Registration, appointment, queue |
| Billing Staff | Tariff lookup, invoice stub |
| Patient | Book appointment, join teleconsult, view summary (portal) |
| Security & Compliance Gate | Cross-cutting policy enforcement (meta-role in workbook) |

All roles: **no cross-tenant access**; matrix stored in DB.

---

## 8. Key workflows (first 80 rows  param($m) switch -regex ($m.Value) { '–|—' { '-' } '…' { '...' } default { '-' } }  unique names + sample steps)

| Workflow | First steps (from workbook) |
| --- | --- |
| Tenant Onboarding | Create tenant -> Assign plan and URL code -> Configure branding and branches -> Create admin users -> Activate modules |
| Patient OPD Visit | Register patient -> Book appointment/token -> Capture vitals -> Doctor consultation |
| Teleconsultation | Book tele-slot -> Collect consent/payment -> Start video/chat -> Record notes/eRx |
| Lab Diagnostics | Doctor order -> Sample collection -> Barcode tracking -> Result entry |
| Pharmacy Dispensing | Prescription received -> Stock check -> Substitution approval -> Dispense |
| IPD Admission | Admission request -> Insurance eligibility -> Bed allocation -> Initial assessment |
| Room/Bed Transfer | Transfer request -> Availability check -> Nursing approval -> Billing tariff change |
| Insurance Claim | Capture policy -> Eligibility check -> Pre-authorization -> Document collection |
| Physiotherapy Program | Assessment -> Plan creation -> Session schedule -> Exercise assignment |
| Post Treatment Care | Discharge plan -> Reminder schedule -> Home monitoring -> Escalation |

**System rule (all workflows):** Status transitions, SLA, audit, notifications, exceptions are **database-driven**.

---

## 9. Telemedicine video setup (MVP)

| ID | Capability | MVP API |
| --- | --- | --- |
| TV-001 | Provider abstraction (Teams/Zoom/Meet/ACS/Twilio) | `GET/PUT /api/v1/video/providers`, tenant config |
| TV-002 | Secure consultation room | `POST /api/v1/telemedicine/sessions`, join token |
| TV-003 | Recording consent | `POST /api/v1/telemedicine/recording-consent` |
| TV-004 | Recording metadata | `GET /api/v1/telemedicine/recordings/{id}` (storage integration stub) |
| TV-006 | Virtual waiting room | `POST /api/v1/telemedicine/waiting-room`, admit |
| TV-007 | In-call notes / eRx stub | `POST /api/v1/telemedicine/in-call/notes` |
| TV-008 | Post-call summary | `POST /api/v1/telemedicine/post-call-summary` |

---

## 10. Location services (MVP hooks)

| ID | Use case | MVP |
| --- | --- | --- |
| LOC-001 | Telemedicine check-in location | Consent + `location_event` on appointment check-in |
| LOC-010 | Privacy controls | Tenant policy: which roles/workflows may collect/view location |

Full ambulance/home-visit tracking: Phase 3+.

---

## 11. Compliance & quality gates (MVP)

**Compliance areas (all 16 populated rows):** Tenant isolation; healthcare privacy; consent; auditability; insurance compliance (rules in DB); clinical safety alerts (engine stub); availability; backup/recovery; data export controls; localization; PCI; PHI/PII; secure dashboards; responsive compliance; no dummy/hard-code rule; functional QA gate.

**Quality gates (release blockers):** Tenant isolation, RBAC, PCI, PHI, responsive web, clickable KPIs (where dashboards exist), no dummy data, no broken buttons, API reliability, audit completeness, security scanning, performance (core flows), backup/recovery.

---

## 12. Audit matrix (implement in Phase 1)

| Audit ID | Focus |
| --- | --- |
| AUD-001 | Base entity audit columns on all tables |
| AUD-002 | Patient record view logging |
| AUD-003 | Prescription change old/new JSON |
| AUD-004 | Billing/payment lifecycle (PCI masked) |
| AUD-005 | Insurance claim history (stub tables) |
| AUD-006 | Telemedicine session lifecycle |
| AUD-007 | Location events with consent |
| AUD-008 | RBAC change with reason |
| AUD-009 | Master data change history |
| AUD-010 | Safe API error logging |

---

## 13. Docker Compose services (local dev)

```yaml
# Logical services  param($m) switch -regex ($m.Value) { '–|—' { '-' } '…' { '...' } default { '-' } }  implement as docker-compose.yml
services:
  postgres:      # PostgreSQL 15+
  redis:         # Cache + Celery broker
  api:           # FastAPI (uvicorn), hot reload
  worker:        # Celery/RQ background jobs
  web:           # React (Vite) dev server or nginx static
  minio:         # S3-compatible object storage (documents, consents)
  mailhog:       # Dev email capture (optional)
  migrate:       # Alembic one-shot migration runner
```

**Environment:** `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `S3_*`, payment gateway keys (vault refs), `GOOGLE_MAPS_SECRET_REF`, video provider secrets per tenant.

---

## 14. Database schema outline (MVP tables)

### 14.1 Tenancy & auth

- `tenants`, `tenant_plans`, `tenant_modules`, `tenant_branding`
- `branches`, `departments`
- `users`, `roles`, `permissions`, `role_permissions`, `user_roles`, `user_branch_assignments`
- `refresh_tokens` / `sessions` (hashed), `mfa_factors`

### 14.2 Masters (Phase 1)

- `countries`, `specialties`, `diseases` (+ optional `tenant_disease_overrides`)
- `room_categories`, `beds` (structure ready)
- `tariffs`, `tariff_versions`
- `insurance_payers`
- `medicines`, `lab_tests`
- `clinical_templates`, `notification_templates`
- `audit_actions`, `audit_field_masks`, `api_registry`, `ui_action_registry`
- `location_purposes`, `tenant_google_maps_config`
- `video_providers`, `tenant_video_configs`, `recording_retention_policies`
- `consent_templates`

### 14.3 Clinical & operations (MVP transactions)

- `patients`, `patient_identifiers`, `patient_branch_registrations`
- `providers`, `provider_specialties`, `provider_schedules`
- `appointments`, `appointment_slots`, `queue_tokens`
- `encounters`, `vitals`, `clinical_notes`, `encounter_diagnoses`
- `prescriptions`, `prescription_lines` (stub)
- `telemedicine_sessions`, `telemedicine_participants`, `waiting_room_entries`
- `recording_consents`, `video_recordings` (metadata)
- `documents` (metadata + storage key)

### 14.4 Billing (stubs)

- `billing_estimates`, `invoices`, `invoice_lines`
- `payments` (gateway_token_ref, masked_last4, status only)

### 14.5 Audit & observability

- `audit_log`, `api_audit_log`, `clinical_access_log`, `master_data_history`
- `location_events`, `consent_captures`

### 14.6 Config engine

- `workflow_definitions`, `workflow_steps`, `workflow_transitions`
- `kpi_definitions` (seed for future dashboards)

**Every table:** extend `AuditedTenantBase` per STD-001.

---

## 15. MVP API routes

Base: `/api/v1/{tenant_code}/...` **or** `/api/v1/...` with `X-Tenant-Code` + JWT (choose one pattern; workbook uses `/api/v1/{module}` with tenant from JWT).

### 15.1 Platform

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/api/v1/auth/login` | Login |
| POST | `/api/v1/auth/refresh` | Refresh token |
| POST | `/api/v1/auth/logout` | Revoke session |
| GET | `/api/v1/auth/me` | Current user + permissions |
| GET/POST | `/api/v1/super-admin/tenants` | Tenant CRUD (super admin) |
| POST | `/api/v1/super-admin/tenants/{id}/activate` | Activate modules |

### 15.2 Masters (tenant-scoped unless global)

| Resource | Pattern |
| --- | --- |
| Countries, specialties, diseases | `/api/v1/masters/{resource}` |
| Branches, departments | `/api/v1/admin/branches`, `/api/v1/admin/departments` |
| Room categories, beds | `/api/v1/masters/room-categories`, `/api/v1/masters/beds` |
| Tariffs, payers, templates | `/api/v1/masters/tariffs`, `.../payers`, `.../clinical-templates`, `.../notification-templates` |
| Audit/API/UI registry | `/api/v1/platform/audit-actions`, `.../api-registry`, `.../ui-actions` |
| Video/maps/consent config | `/api/v1/platform/video-providers`, `.../tenant-video-config`, `.../location-purposes`, `.../consent-templates` |

### 15.3 Patients & providers

| Method | Route |
| --- | --- |
| CRUD | `/api/v1/patients`, `/api/v1/patients/{id}` |
| Search | `GET /api/v1/patients?query=&branch_id=` |
| CRUD | `/api/v1/providers`, `/api/v1/providers/{id}/schedules` |

### 15.4 Appointments & queue

| Method | Route |
| --- | --- |
| CRUD | `/api/v1/appointments` |
| Queue | `POST /api/v1/queue/tokens`, `PATCH /api/v1/queue/tokens/{id}/status` |

### 15.5 OPD / EHR basics

| Method | Route |
| --- | --- |
| Encounter | `/api/v1/encounters` |
| Vitals | `/api/v1/encounters/{id}/vitals` |
| Notes | `/api/v1/encounters/{id}/notes` |
| Diagnosis | `/api/v1/encounters/{id}/diagnoses` |
| eRx stub | `/api/v1/prescriptions` |

### 15.6 Telemedicine

| Method | Route |
| --- | --- |
| Sessions | `/api/v1/telemedicine/sessions` |
| Waiting room | `/api/v1/telemedicine/waiting-room` |
| Join | `POST /api/v1/telemedicine/sessions/{id}/join` |
| Consent | `/api/v1/telemedicine/recording-consent` |
| Post-call | `/api/v1/telemedicine/post-call-summary` |
| Providers | `/api/v1/video/providers` |

### 15.7 Billing stubs

| Method | Route |
| --- | --- |
| Estimates/invoices | `/api/v1/billing/estimates`, `/api/v1/billing/invoices` |
| Payments | `POST /api/v1/billing/payments` (tokenized) |

### 15.8 Audit & logs

| Method | Route |
| --- | --- |
| Audit | `GET /api/v1/audit/logs` |
| API audit | `GET /api/v1/audit/api-logs` |
| Clinical access | `GET /api/v1/audit/clinical-access` |

### 15.9 Module-level patterns (full product  param($m) switch -regex ($m.Value) { '–|—' { '-' } '…' { '...' } default { '-' } }  `API Backlog` sheet)

Each clinical module has a REST namespace, e.g.:

- `/api/v1/appointment-and-queue-management`
- `/api/v1/patient-registration-and-crm`
- `/api/v1/telemedicine-and-virtual-care`
- `/api/v1/identity,-rbac-and-security`
-  param($m) switch -regex ($m.Value) { '–|—' { '-' } '…' { '...' } default { '-' } }  (34 services total in API Backlog)

MVP implements **focused routes above**; expand toward module patterns as features land.

### 15.10 Expanded API backlog (first 100 rows  param($m) switch -regex ($m.Value) { '–|—' { '-' } '…' { '...' } default { '-' } }  pattern)

Two engineering areas in rows 1-100:

**`audit-trail-and-governance`:** `database-audit-fields`, `immutable-action-log`, `clinical-access-log`, `billing-audit`, `insurance-audit`, `master-data-audit`, `rbac-change-audit`, `export`, `print`, `consent-audit`  param($m) switch -regex ($m.Value) { '–|—' { '-' } '…' { '...' } default { '-' } }  each supports `GET/POST/PUT/GET {id}/POST export`.

**`api-observability-and-traceability`:** `api-request-logging`, `api-response-logging`, `latency-tracking`, `correlation-id-propagation`, `masked-payload-storage`, `error-diagnostics`, `retry-tracking`, `rate-limit-audit`, `webhook-audit`, `api-security-event-log`.

---

## 16. MVP frontend pages (React)

Route prefix: `/{tenant-code}/...`

| Area | Pages |
| --- | --- |
| Auth | Login, MFA challenge, forgot password |
| Super Admin | Tenant list, tenant create wizard, global masters, API registry |
| Tenant Admin | Dashboard, branches, users & roles, branding, module settings, video/maps config |
| Reception | Patient search/register, appointment book, queue board |
| Doctor | Schedule, appointment list, OPD encounter workspace, teleconsult room |
| Patient portal | Appointments, join teleconsult, consent, visit summary, bills (read) |
| Billing (stub) | Tariff browser, create estimate/invoice, record payment (hosted fields) |
| Clinical admin | Template editor, consent templates |
| Compliance | Audit log viewer, API log viewer, consent records |
| Shared | Profile, branch switcher, notifications inbox (stub) |

**UX rules:** responsive layouts; all selects from master APIs; hide actions without permission; KPI placeholders wired to `kpi_definitions` in Phase 2.

---

## 17. Reports & analytics (names  param($m) switch -regex ($m.Value) { '–|—' { '-' } '…' { '...' } default { '-' } }  full list from workbook)

- Ambulance utilization
- API integration error report
- Audit trail report
- Billing & Insurance Dashboard
- Branch operations dashboard
- Caterer SLA dashboard
- Clinical Operations Dashboard
- Data quality report
- Disease pathway outcomes
- Doctor productivity
- Executive hospital dashboard
- Executive KPI Drill-down Dashboard
- Insurance claims dashboard
- IPD occupancy dashboard
- Lab TAT dashboard
- Nursing task compliance
- OPD appointment dashboard
- OT utilization
- Patient satisfaction/NPS
- Pharmacy stock and expiry
- Physiotherapy progress
- Post-discharge follow-up
- Radiology TAT dashboard
- Revenue dashboard
- Security & Compliance Dashboard
- Tenant billing/subscription report

**MVP:** OPD appointment dashboard + audit trail report + API error report (minimal SQL + drill-down stub).

---

## 18. Feature backlog  param($m) switch -regex ($m.Value) { '–|—' { '-' } '…' { '...' } default { '-' } }  module distribution (all 3,210 rows)

### Top modules by total features

| Module | Total features |
| --- | ---: |
| Disease & Care Pathways | 360 |
| Insurance & Claims | 108 |
| Security, PCI & PHI Protection | 90 |
| Compliance & Retention | 90 |
| Telemedicine & Remote Consultation | 90 |
| API Observability & Traceability | 90 |
| GPS & Google Location Services | 90 |
| Dashboard Drill-down & KPI | 90 |
| Service Provider Integration | 90 |
| Audit Trail & Governance | 90 |
| Responsive UX & Quality Gates | 90 |
| Video Calling & Recording | 90 |
| (Most clinical modules) | 60 each |

### Top modules by Must Have count (sample)

| Module | Must Have |
| --- | ---: |
| Disease & Care Pathways | 179 |
| Dashboard Drill-down & KPI | 90 |
| Service Provider Integration | 90 |
| Audit Trail & Governance | 90 |
| Compliance & Retention | 90 |
| Video Calling & Recording | 90 |
| Telemedicine & Remote Consultation | 90 |
| Security, PCI & PHI Protection | 90 |
| API Observability & Traceability | 90 |
| GPS & Google Location Services | 90 |
| Insurance & Claims | 80 |
| Patient Registration & CRM | 35 |
| Appointment & Queue Management | 35 |
| Identity, RBAC & Security | 31 |
| Super Admin & SaaS Control | 33 |

---

## 19. API backlog  param($m) switch -regex ($m.Value) { '–|—' { '-' } '…' { '...' } default { '-' } }  unique services (34)

Ambulance & Transport; Appointment & Queue Management; Billing, Tariff & Payments; Chronic Disease Programs; Data Governance & Platform Ops; Diet, Catering & Housekeeping; Disease & Care Pathways; Doctor & Provider Management; Document, Forms & Templates; Emergency & Triage; Hospital/Clinic Administration; Identity, RBAC & Security; Insurance & Claims; Integrations & Interoperability; Inventory, Procurement & Stores; IPD Admission & Ward Management; Laboratory & Diagnostics; Mobile Apps; Notifications & Engagement; Nursing & Care Plans; OPD Clinical Workflow; Operation Theatre & Procedures; Patient Registration & CRM; Pharmacy Management; Physiotherapy & Rehab; Post Treatment Patient Care; Provider Marketplace; Radiology & Imaging; Reports, BI & Analytics; Revenue Cycle Management; Rooms & Facilities; Super Admin & SaaS Control; Telemedicine & Virtual Care; Women, Child & Specialty Care.

**Sample endpoint pattern (each service):**  
`GET, POST, PUT/PATCH, DELETE` on `/api/v1/{slug}` with tenant JWT, e.g. `/api/v1/patient-registration-and-crm`.

---

## 20. Roadmap alignment

| Phase | Timeline | Scope |
| --- | --- | --- |
| Phase 0 | 2-3 weeks | UX, architecture, ERD, API contract |
| Phase 1 | 6-8 weeks | Tenant onboarding, auth, RBAC, masters, branch admin, patient, provider |
| Phase 2 | 8-10 weeks | Appointments, queue, OPD, telemedicine, eRx, basic billing |
| Phase 3 | 10-12 weeks | IPD, pharmacy, lab, radiology, insurance |
| Phase 4 | 8-10 weeks | Chronic care, post-treatment, providers, analytics |
| Phase 5 | 6-8 weeks | Mobile hardening, integrations, compliance, performance |

**This BUILD SPEC targets Phase 1 foundation + MVP slice of Phase 2.**

---

## 21. Cursor implementation order (from Cursor Prompts sheet)

1. Phase 1: Tenant, auth, RBAC, global/tenant/branch masters, configuration engine  
2. Phase 2: Patient, provider, appointment/queue, OPD, telemedicine, e-prescription  
3. Phase 3: IPD, room/bed, nursing, billing, pharmacy, lab/radiology, claims  
4. Phase 4: Physiotherapy, chronic care, post-treatment, marketplace, reports  
5. Phase 5: Mobile apps, analytics, monitoring, compliance hardening  

Use modular prompts: Backend (router/service/repo/RBAC/audit), Frontend (responsive API-driven), Database (migrations), Testing, DevOps (Compose), Security, Dashboard KPI, Quality Gate.

---

## 22. Appendix  param($m) switch -regex ($m.Value) { '–|—' { '-' } '…' { '...' } default { '-' } }  Dashboard sheet (complete)

| Field | Value |
| --- | --- |
| Prepared For | SUMAYA Tech / SUMAYA Care 360 |
| Architecture | React Web + React Native or Flutter Mobile + FastAPI + PostgreSQL + Docker |
| Multi-Tenant URL Pattern | https://sumayacare360.com/{tenant-code} |
| Total Feature Rows | 3210 |
| Must Have Count | 2303 |
| Web + Mobile Features | 1418 |
| Backend/API Features | 465 |
| Database Rule | No dummy data; all masters/rules/tariffs/workflows/templates from PostgreSQL |
| Tenant Rule | tenant_id, tenant_code, branch_id, created_by/updated_by on transactions |
| Latest Expansion | Audit, API traceability, GPS, telemedicine, video recording |
| Feature Backlog Rows | 3,211 (incl. 900 new mandatory engineering requirements) |
| Prompt Rows | 900 implementation prompts |
| Expanded API Rows | 500 |
| Mandatory Audit | Every table/API/action audited |
| Location | Google Maps with consent, geocoding, geofencing, tracking |
| Video | Teams/Zoom/Meet/ACS/Twilio abstraction + recording/retention |
| Quality Rule | No dummy data, no hard-coded values, no broken buttons, 100% responsive |
| Updated On | 2026-07-08 15:29 UTC |

(Module feature counts per module: 60 each for listed clinical modules except Disease & Care Pathways 360, Insurance 108, RCM 48, Provider Marketplace 24, Rooms 24.)

---

## 23. Build verification checklist (MVP done)

- [ ] Tenant A cannot read Tenant B patient (automated test)
- [ ] All dropdowns load from API masters
- [ ] OPD: register -> appoint -> encounter -> note saved with audit
- [ ] Teleconsult: book -> consent -> session join -> post-call summary
- [ ] Invoice stub from tariff master; payment uses token only
- [ ] `audit_log` + `api_audit_log` populated on writes and sensitive reads
- [ ] Responsive smoke on login, registration, queue, encounter, teleconsult
- [ ] Docker Compose brings up full stack with migrations

---

*End of BUILD_SPEC*

# SUMAYA Care 360

Multi-tenant Hospital, Clinic & Telemedicine platform built from the enterprise requirements workbook.

## Stack

- **Web:** React + TypeScript (Vite)
- **API:** FastAPI
- **DB:** PostgreSQL 16
- **Cache/Queue:** Redis + worker
- **Storage:** MinIO (S3)
- **Mail (dev):** MailHog
- **Orchestration:** Docker Compose

## Quick start

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/mayankmehta1610/SumayaCare360)

### Local (Docker)

```bash
docker compose up --build -d
```

### Docker not starting? (HP / Windows)

If Docker Desktop shows **"Virtualization support not detected"**, BIOS virtualization must be enabled manually (F10 → enable **SVM Mode** on HP 245 G7). That cannot be changed from Windows.

**Run without Docker instead** (works now on this machine):

```powershell
cd C:\Code\SumayaCare360
.\scripts\run-native.ps1
```

Uses Python + SQLite + Vite (no virtualization required). For full Docker stack after BIOS fix:

| Service | URL |
|--------|-----|
| Web UI | http://localhost:3000 |
| API docs | http://localhost:8000/docs |
| Health | http://localhost:8000/api/v1/health |
| MinIO | http://localhost:9001 |
| MailHog | http://localhost:8025 |

### Demo logins

| Role | Email | Password | Tenant |
|------|-------|----------|--------|
| Super Admin | superadmin@sumayacare360.com | SuperAdmin@360 | *(blank)* |
| Tenant Admin | admin@demo.sumaya | TenantAdmin@360 | `demo` |
| Doctor | doctor@demo.sumaya | Doctor@360 | `demo` |
| Reception | reception@demo.sumaya | Reception@360 | `demo` |
| Billing | billing@demo.sumaya | Billing@360 | `demo` |

## Requirements coverage (MVP)

Implemented end-to-end from `BUILD_SPEC.md` / Excel:

- Multi-tenant isolation (`tenant_id` + `X-Tenant-Code`)
- Auth + RBAC from DB roles
- Masters from PostgreSQL (no hard-coded tariffs/diseases/medicines/video providers)
- Patients → Appointments/Queue → OPD Encounter (vitals, notes, diagnosis, eRx)
- Telemedicine sessions with consent + video provider abstraction
- Billing stubs (tariff invoices + tokenized payments)
- Audit log + API audit middleware
- Clickable dashboard KPIs
- Docker Compose full stack

## Project layout

```
backend/     FastAPI app, models, seed, worker
frontend/    React portal
docker-compose.yml
BUILD_SPEC.md
SUMAYA_Care_360_Enterprise_Requirements_Audit_Telemedicine_Expanded.xlsx
```

## Production (Render)

| Service | URL |
|--------|-----|
| Web UI | https://sumayacare360-web.onrender.com |
| API | https://sumayacare360-api.onrender.com |
| API docs | https://sumayacare360-api.onrender.com/docs |
| Health | https://sumayacare360-api.onrender.com/api/v1/health |

Deploy from `main` via [Render Blueprint](render.yaml) or `.\scripts\deploy-render.ps1` (requires `RENDER_API_KEY`). Pushes to `main` auto-deploy when the Render GitHub integration is enabled.

## Quality rules enforced

- No dummy clinical seed data beyond configuration templates + demo users/providers/tariffs
- Dropdowns load from `/api/v1/masters/*`
- PCI: payments store gateway token + masked last4 only
- Recording requires consent capture before link
- Every mutating clinical/admin action writes `audit_logs`

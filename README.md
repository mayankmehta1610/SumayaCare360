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

If Docker Desktop shows **"Virtualization support not detected"**:

1. **Enable virtualization in BIOS** (required on this machine — firmware currently reports disabled):
   - Reboot → press **F10** (HP 245 G7)
   - **Advanced** → **System Options** (or **Configuration**)
   - Enable **SVM Mode** / **AMD-V** / **Virtualization Technology**
   - Save (F10) and reboot

2. **Run admin setup script** (WSL + Windows features):
   ```powershell
   # Right-click PowerShell -> Run as administrator
   cd C:\Code\SumayaCare360
   .\scripts\enable-docker-prereqs.ps1
   ```
   Approve the UAC prompt if it appears.

3. **Reboot**, open **Docker Desktop**, wait until engine is running.

4. **Start the stack**:
   ```powershell
   cd C:\Code\SumayaCare360
   docker compose up --build -d
   .\scripts\smoke.ps1
   ```

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

## Quality rules enforced

- No dummy clinical seed data beyond configuration templates + demo users/providers/tariffs
- Dropdowns load from `/api/v1/masters/*`
- PCI: payments store gateway token + masked last4 only
- Recording requires consent capture before link
- Every mutating clinical/admin action writes `audit_logs`

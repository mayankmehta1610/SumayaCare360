# SUMAYA Care 360 — Demo Login Credentials

**Tenant code:** `demo`  
**Login URL:** `/demo/login`

## Super Admin (no tenant)

| Email | Password | Role |
|-------|----------|------|
| superadmin@sumayacare360.com | SuperAdmin@360 | SUPER_ADMIN |

## Demo tenant users

| Role | Email | Password | What they see |
|------|-------|----------|---------------|
| Tenant Admin | admin@demo.sumaya | TenantAdmin@360 | Full hospital — all modules & KPIs |
| Branch Admin | branch@demo.sumaya | BranchAdmin@360 | Front office, patients, appointments |
| Doctor | doctor@demo.sumaya | Doctor@360 | Clinical: encounters, tele, orders |
| Nurse | nurse@demo.sumaya | Nurse@360 | Nursing, IPD, encounters |
| Receptionist | reception@demo.sumaya | Reception@360 | Patients, appointments, queue |
| Billing Staff | billing@demo.sumaya | Billing@360 | Invoices, claims, reports |
| Pharmacist | pharmacist@demo.sumaya | Pharmacist@360 | Pharmacy dispense queue |
| Lab Technician | labtech@demo.sumaya | LabTech@360 | Laboratory orders & results |
| Radiologist | radiologist@demo.sumaya | Radiologist@360 | Imaging orders & reports |
| Patient | patient@demo.sumaya | Patient@360 | Patient portal only |

Credentials are also listed on the login page via `GET /api/v1/auth/demo-credentials`.

## Role-wise demo video

`docs/SUMAYA_Care_360_Roles_Demo.mp4` — generated with:

```bash
cd scripts/demo-video
npx playwright install chromium
FORCE=1 DEMO_BASE_URL=http://localhost:3000 node generate-by-role.mjs
```

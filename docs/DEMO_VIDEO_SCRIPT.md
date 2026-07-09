# SUMAYA Care 360 — Full Demo Video Script (Voice-Over)

**Duration:** ~25 minutes · **Scenes:** 33 · **Platform:** https://sumayacare360-web.onrender.com

## Recording setup

1. **Resolution:** 1920×1080, record browser at 100% zoom
2. **Login before recording:**
   - URL: `https://sumayacare360-web.onrender.com/demo/login`
   - Tenant: `demo`
   - Email: `admin@demo.sumaya`
   - Password: `TenantAdmin@360`
3. **First action:** Dashboard → **Load demo data now** (if patients &lt; 5)
4. **Alternative:** Use in-app **Demo tour (voice)** at `/demo/demo-tour` — plays narration automatically

---

## Scene 1 — Login (0:00)

**VOICE:**  
Welcome to SUMAYA Care 360, a multi-tenant hospital, clinic, and telemedicine platform. This demo walks through all thirty-six modules in ten logical phases. Every dropdown and tariff loads from PostgreSQL — no hard-coded dummy data. Sign in with tenant code demo, admin at demo dot sumaya, password Tenant Admin at three sixty.

**ON SCREEN:** Login page → enter credentials → land on Dashboard

---

## Scene 2 — Dashboard & demo data (0:45)

**VOICE:**  
The dashboard shows live KPIs: nine patients, appointments, lab orders, triage, and forty-eight module work items. Click Load demo data to replay the full dataset — eight patients DEMO-001 through DEMO-008, clinical transactions, and records for every module. Feature coverage tracks three thousand two hundred ten Excel requirements.

**ON SCREEN:** KPI tiles → click patients drill-down → return → Load demo data button

**DEMO DATA:** Rajesh Kumar DEMO-001, Priya Sharma DEMO-002, … Kavita Nair DEMO-008

---

## Scene 3 — Module map (1:35)

**VOICE:**  
The module map shows all thirty-six modules by phase. Each card opens a dedicated desk with submodule tabs, search, create, edit, and lifecycle actions.

**ON SCREEN:** Module map → click Laboratory, Chronic care, Inventory

---

## Scene 4 — Masters (2:10)

**VOICE:**  
Masters drive the entire platform. Tariffs, medicines, lab tests, and templates come from PostgreSQL. When billing, you select OPD consult at five hundred rupees or CBC lab at three fifty — never free-text prices.

**ON SCREEN:** Masters → Tariffs tab → Medicines → Lab tests

**DEMO DATA:** OPD_CONSULT ₹500, PARA500 Paracetamol, CBC lab test

---

## Scene 5 — Patients (2:50)

**VOICE:**  
Search patients by name or MRN. Select Rajesh Kumar DEMO-001 to open the chart — appointments, encounters, invoices, lab orders linked. To register new: first name, last name, phone, gender from master, date of birth. MRN auto-generates.

**ON SCREEN:** Patients → search DEMO-001 → chart panel → create form (optional)

---

## Scene 6 — Appointments & queue (3:35)

**VOICE:**  
Book appointment: patient, provider, datetime, in-person or telemedicine. Telemedicine auto-creates video session. Queue tokens T101 to T105 are loaded. Flow: Check in → Call next → Start encounter → Complete.

**ON SCREEN:** Appointments → queue actions on row → book new telemedicine appointment

---

## Scene 7 — Encounters & care journey (4:25)

**VOICE:**  
Open encounters for OPD workflow — vitals, SOAP notes, diagnosis, prescription, discharge. Care journey links the full pipeline from patient to payment in order.

**ON SCREEN:** Encounters → open encounter → add vitals → Care journey page

---

## Scene 8 — Telemedicine (5:10)

**VOICE:**  
Create session from telemedicine appointment. Capture recording consent. Join virtual room — Twilio adapter. Waiting room admit, in-call notes, post-call summary. Demo TELE-DEMO-001 completed for Priya Sharma.

**ON SCREEN:** Telemedicine → create session → join → end summary

---

## Scene 9 — Laboratory (5:60)

**VOICE:**  
Lab orders: ordered → sample → result → verified → critical alert. Five demo CBC orders; LAB-000005 is critical low hemoglobin.

**ON SCREEN:** Laboratory → order list → enter result → verify

---

## Scene 10 — Radiology & Pharmacy (6:40)

**VOICE:**  
Radiology: CXR orders through scheduled, acquired, reported. Pharmacy: queued, verified, dispensed — medicine PARA500 from master.

**ON SCREEN:** Radiology → Pharmacy queues

---

## Scene 11 — Emergency & Inpatient (7:20)

**VOICE:**  
Emergency triage with ESI levels — chest pain ESI two, cardiac arrest ESI one. IPD admission ADM-000001 Vikram Singh on bed B201. Nursing tasks: vitals done, meds in progress.

**ON SCREEN:** Emergency → Inpatient → Nursing

---

## Scene 12 — OT & Billing (8:10)

**VOICE:**  
OT appendectomy cases through pre-op checklist. Billing invoice INV-DEMO-000001 nine hundred fifty rupees — partial payment via gateway token, PCI-safe.

**ON SCREEN:** Operation Theatre → Billing → pay invoice

---

## Scene 13 — Insurance & RCM (8:55)

**VOICE:**  
Five claims draft through paid — payers STAR and ICICI from master. Revenue cycle desks for charge capture and AR aging.

**ON SCREEN:** Insurance claims → Revenue cycle submodule tabs

---

## Scene 14 — Pathways & chronic care (9:35)

**VOICE:**  
DM2 diabetes pathway enrolled for Sunita Patel at three-month review. Chronic care desk — enrollment, coordinator, monitoring tabs with full CRUD.

**ON SCREEN:** Pathways → Chronic care → create record

---

## Scene 15 — Operations (10:15)

**VOICE:**  
Inventory procurement lifecycle. Ambulance dispatch requested to closed. Location GPS event for home visit in Mumbai with consent.

**ON SCREEN:** Inventory → Ambulance → Location services

---

## Scene 16 — Notifications & portal (10:55)

**VOICE:**  
Notifications: email, SMS, WhatsApp from templates. Patient portal: request appointment, pay bill with token, join teleconsult.

**ON SCREEN:** Notifications → Patient portal → book + pay

---

## Scene 17 — Reports & audit (11:35)

**VOICE:**  
Run live reports — OPD dashboard, IPD occupancy, lab TAT, revenue. Audit trail: business events, API latency, clinical PHI access with filters.

**ON SCREEN:** Reports → run OPD dashboard → Audit tabs

---

## Scene 18 — Closing (12:15)

**VOICE:**  
SUMAYA Care 360 organizes data by tenant in PostgreSQL: clinical tables for patients and encounters, order tables for lab and radiology, finance for invoices and claims, module records for cross-cutting workflows. Demo replay loads eight patients and forty-eight domain items. Explore any module from the sidebar ten-phase navigation. Thank you.

**ON SCREEN:** Dashboard KPI summary → Module map → fade out

---

## Demo data reference (quick lookup)

| Area | Demo records |
|------|----------------|
| Patients | DEMO-001 Rajesh Kumar … DEMO-008 Kavita Nair |
| Appointments | T101–T105, mixed statuses |
| Encounters | 4 OPD, 1 open |
| Lab | LAB-000001–005, 1 critical |
| Radiology | RAD-000001–004 |
| Pharmacy | RX-000001–003 |
| IPD | ADM-000001 Vikram on B201 |
| Triage | TRI-000001–004, ESI 1–4 |
| OT | OT-000001–004 appendectomy |
| Billing | INV-DEMO-000001 ₹950 |
| Claims | CLM-000001–005 |
| Pathways | DM2-PATH enrollment |
| Telemedicine | TELE-DEMO-001 |
| Module records | 48 cross-module work items |
| Notifications | 3 sent (email/SMS/WhatsApp) |

---

*Generated for SUMAYA Care 360 · Use with OBS/Loom and this script, or the in-app voice tour at `/demo/demo-tour`*

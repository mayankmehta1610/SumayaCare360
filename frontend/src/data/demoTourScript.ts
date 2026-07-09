export type DemoTourStep = {
  id: string;
  phaseId: string;
  phaseName: string;
  title: string;
  route: string;
  durationSec: number;
  narration: string;
  navigate: string[];
  enterData: string[];
  demoData: string[];
};

export const DEMO_LOGIN = {
  url: "https://sumayacare360-web.onrender.com/demo/login",
  email: "admin@demo.sumaya",
  password: "TenantAdmin@360",
  tenant: "demo",
};

export const DEMO_TOUR_STEPS: DemoTourStep[] = [
  {
    id: "intro",
    phaseId: "start",
    phaseName: "Introduction",
    title: "Welcome to SUMAYA Care 360",
    route: "/login",
    durationSec: 45,
    narration:
      "Welcome to SUMAYA Care 360, a multi-tenant hospital, clinic, and telemedicine platform. " +
      "This guided demo shows how all thirty-six modules connect in ten logical phases. " +
      "Every dropdown, tariff, and workflow loads from PostgreSQL — there is no hard-coded dummy data in the UI. " +
      "Use tenant code demo, email admin at demo dot sumaya, and password Tenant Admin at three sixty to sign in.",
    navigate: ["Open the login page", "Enter tenant code: demo", "Sign in with admin credentials"],
    enterData: [],
    demoData: ["Demo tenant with MAIN branch", "Tariffs, medicines, lab tests, and notification templates pre-seeded"],
  },
  {
    id: "dashboard",
    phaseId: "start",
    phaseName: "Introduction",
    title: "Operations dashboard & demo dataset",
    route: "/dashboard",
    durationSec: 50,
    narration:
      "The dashboard shows live KPIs from PostgreSQL. You should see nine demo patients, appointments, lab orders, triage cases, and forty-eight module work items. " +
      "If counts are low, click Load demo data now — this replays the full dataset: eight patients DEMO dash zero zero one through zero zero eight, clinical transactions, and records for every module. " +
      "Notice the Excel feature coverage percentage — three thousand two hundred ten requirements tracked in the database.",
    navigate: ["Go to Dashboard from the sidebar", "Click any KPI tile to drill down", "Use Load demo data if patients count is below five"],
    enterData: ["Click Load demo data now if prompted"],
    demoData: [
      "8 patients: Rajesh Kumar DEMO-001 through Kavita Nair DEMO-008",
      "6 appointments with queue tokens T101–T105",
      "KPIs: lab 5, triage 4, OT 4, claims 5, domain records 48",
    ],
  },
  {
    id: "module-map",
    phaseId: "start",
    phaseName: "Introduction",
    title: "Module map — all 36 modules",
    route: "/module-map",
    durationSec: 35,
    narration:
      "The module map displays all thirty-six platform modules organized by phase. Each module has a dedicated route and API. " +
      "Click any module card to open its desk. Modules marked dedicated have full lifecycle backends or interactive desks.",
    navigate: ["Open Module map from Overview menu", "Click a module card to jump to its page"],
    enterData: [],
    demoData: ["36 platform modules synced from the requirements workbook"],
  },
  {
    id: "masters",
    phaseId: "platform",
    phaseName: "1 · Platform & setup",
    title: "Masters — database-driven configuration",
    route: "/masters",
    durationSec: 40,
    narration:
      "Masters is the foundation. Tariffs, medicines, lab tests, specialties, insurance payers, and notification templates all come from PostgreSQL. " +
      "When you create an invoice or prescription, you select from these masters — never from hard-coded lists.",
    navigate: ["Overview → Masters", "Browse tariffs, medicines, lab tests tabs"],
    enterData: ["Add a new tariff or medicine if testing create flows"],
    demoData: ["OPD_CONSULT ₹500", "TELE_CONSULT ₹400", "LAB_CBC ₹350", "PARA500 and AMOX250 medicines"],
  },
  {
    id: "administration",
    phaseId: "platform",
    phaseName: "1 · Platform & setup",
    title: "Hospital administration",
    route: "/administration",
    durationSec: 40,
    narration:
      "Hospital administration covers branches, departments, and organization profile. " +
      "Create a new branch or department using the forms on the left. All changes write to audit log.",
    navigate: ["Platform hub → Hospital/Clinic Administration", "Create branch or department"],
    enterData: ["Branch code and name", "Department code linked to branch"],
    demoData: ["MAIN branch pre-configured for demo tenant"],
  },
  {
    id: "identity",
    phaseId: "platform",
    phaseName: "1 · Platform & setup",
    title: "Identity, RBAC & security",
    route: "/identity-security",
    durationSec: 40,
    narration:
      "Identity and RBAC manages users, roles, and permissions. Add a user with email, full name, and role code. " +
      "MFA settings are under Settings MFA in the menu. Every login and permission change is audited.",
    navigate: ["Open Identity & Security", "Add user form on the left", "Settings → MFA for two-factor setup"],
    enterData: ["New user email, name, role TENANT_ADMIN or DOCTOR", "Password on create"],
    demoData: ["Tenant admin, doctor, and nurse demo users seeded"],
  },
  {
    id: "rooms",
    phaseId: "platform",
    phaseName: "1 · Platform & setup",
    title: "Rooms & facilities",
    route: "/rooms-facilities",
    durationSec: 35,
    narration:
      "Rooms and facilities shows bed inventory and room categories. Update bed status to available, occupied, maintenance, or housekeeping. " +
      "Demo data includes three beds — one occupied by IPD patient Vikram Singh.",
    navigate: ["Open Rooms & Facilities", "Select bed → change status"],
    enterData: ["Bed status dropdown", "Room category if creating new"],
    demoData: ["Bed B201 occupied by IPD admission ADM-000001", "3 beds available in KPI"],
  },
  {
    id: "documents",
    phaseId: "platform",
    phaseName: "1 · Platform & setup",
    title: "Documents & templates",
    route: "/documents",
    durationSec: 30,
    narration:
      "Documents desk manages clinical templates, consent forms, and uploads. Demo includes consent_demo_001 dot pdf linked to patient Rajesh Kumar.",
    navigate: ["Open Documents module", "Switch submodule tabs", "Create a new document record"],
    enterData: ["Title and template type in the create form"],
    demoData: ["Document metadata for consent PDF on DEMO-001"],
  },
  {
    id: "patients",
    phaseId: "front-office",
    phaseName: "2 · Front office",
    title: "Patient registration & CRM",
    route: "/patients",
    durationSec: 45,
    narration:
      "Register and search patients. Demo patients DEMO dash zero zero one through zero zero eight are pre-loaded with demographics and phone numbers. " +
      "Select a patient to view their chart — appointments, encounters, invoices, and lab orders in one panel. " +
      "Create a new patient: enter first name, last name, phone, gender from master, and date of birth. MRN is auto-generated.",
    navigate: ["Front office → Patients", "Search by name or MRN", "Click row to open chart", "Use create form for new registration"],
    enterData: ["First name, last name, phone, gender, date of birth"],
    demoData: ["Rajesh Kumar DEMO-001 — fever case", "Priya Sharma DEMO-002 — telemedicine", "Ananya Reddy DEMO-006 — pediatric"],
  },
  {
    id: "providers",
    phaseId: "front-office",
    phaseName: "2 · Front office",
    title: "Doctor & provider management",
    route: "/providers",
    durationSec: 40,
    narration:
      "Manage providers and their schedules. Select a provider and add schedule slots — day of week, start and end time, slot length, and mode in-person or telemedicine. " +
      "Specialties load from the specialty master.",
    navigate: ["Open Providers", "Add provider form", "Click Schedules on a provider row", "Add weekly slot"],
    enterData: ["Provider code, full name, specialty from dropdown", "Schedule: day 1 equals Monday, times, 15-minute slots"],
    demoData: ["Demo provider linked to all appointments and encounters"],
  },
  {
    id: "appointments",
    phaseId: "front-office",
    phaseName: "2 · Front office",
    title: "Appointments & queue",
    route: "/appointments",
    durationSec: 50,
    narration:
      "Book appointments and manage the token queue. Select patient and provider, pick date time, choose in-person or telemedicine mode. " +
      "Telemedicine bookings auto-create a video session. Use Check in, Call next, Start encounter, Complete, Cancel, or No show on each row. " +
      "Demo tokens T101 through T105 are already loaded.",
    navigate: ["Open Appointments", "Book appointment form left panel", "Queue actions on each row"],
    enterData: ["Patient, provider, datetime, mode, reason", "Queue: Check in then Call next then Start encounter"],
    demoData: ["5 appointments — checked in, completed, scheduled, no-show statuses", "Telemedicine appointment creates TELE session"],
  },
  {
    id: "emergency",
    phaseId: "front-office",
    phaseName: "2 · Front office",
    title: "Emergency & triage",
    route: "/emergency",
    durationSec: 40,
    narration:
      "Emergency triage uses ESI levels one through five. Demo has four triage cases — chest pain ESI two, cardiac arrest ESI one. " +
      "Create new triage: select patient, chief complaint, ESI level. Advance status through arrived, triaged, treatment, disposition.",
    navigate: ["Open Emergency", "View triage list", "Create or advance triage status"],
    enterData: ["Patient, chief complaint, ESI level 1-5"],
    demoData: ["TRI-000001 chest pain ESI 2", "TRI-000004 cardiac arrest ESI 1 disposition admit"],
  },
  {
    id: "encounters",
    phaseId: "clinical",
    phaseName: "3 · Clinical care",
    title: "OPD clinical workflow",
    route: "/encounters",
    durationSec: 45,
    narration:
      "OPD encounters link to appointments. Open encounters show vitals, clinical notes, diagnoses, and prescriptions. " +
      "Add vitals with blood pressure, pulse, temperature. Add SOAP notes and diagnosis from disease master. Discharge closes the encounter and triggers billing.",
    navigate: ["Open Encounters", "Select open encounter", "Add vitals, notes, diagnosis", "Discharge when complete"],
    enterData: ["Vitals: BP 120/80, pulse 78", "Note content", "Disease code from master", "Prescription medicine lines"],
    demoData: ["4 encounters — 1 open for Rajesh Kumar fever", "Diagnoses URI, HTN, LBP, DM2 on demo cases"],
  },
  {
    id: "care-journey",
    phaseId: "clinical",
    phaseName: "3 · Clinical care",
    title: "End-to-end care journey",
    route: "/care-journey",
    durationSec: 40,
    narration:
      "Care journey is the guided end-to-end path: patient, appointment, encounter, vitals, orders, discharge, billing, payment. " +
      "Follow the step links to move through the clinical pipeline without losing context.",
    navigate: ["Open Care journey from Overview", "Follow step-by-step links", "Complete each stage in order"],
    enterData: ["Work through one patient from registration to payment"],
    demoData: ["Pre-linked journey for DEMO-001 Rajesh Kumar through invoice INV-DEMO-000001"],
  },
  {
    id: "telemedicine",
    phaseId: "clinical",
    phaseName: "3 · Clinical care",
    title: "Telemedicine & virtual care",
    route: "/telemedicine",
    durationSec: 50,
    narration:
      "Telemedicine supports video sessions via Twilio, Zoom, or Teams adapters. Create a session from a telemedicine appointment, capture recording consent, join the virtual room. " +
      "Use waiting room admit, in-call notes, and post-call summary. Demo session TELE-DEMO-001 is completed for Priya Sharma.",
    navigate: ["Open Telemedicine", "Create session from appointment dropdown", "Select patient for consent → Join", "End and save summary"],
    enterData: ["Select telemedicine appointment", "Recording consent for patient", "Post-call summary text"],
    demoData: ["TELE-DEMO-001 completed session with post-call summary", "Video provider twilio configured"],
  },
  {
    id: "laboratory",
    phaseId: "diagnostics",
    phaseName: "4 · Diagnostics & pharmacy",
    title: "Laboratory & diagnostics",
    route: "/laboratory",
    durationSec: 40,
    narration:
      "Lab orders move through ordered, sample collected, result entered, verified, and critical alert. " +
      "Demo has five CBC orders including one critical alert. Create order: pick patient, test code CBC from master, advance status.",
    navigate: ["Clinical hub or Laboratory", "Create lab order", "Enter result → verify or flag critical"],
    enterData: ["Patient, test code CBC", "Result value e.g. 12.5 g/dL", "Result notes"],
    demoData: ["LAB-000001 through LAB-000005", "Critical alert on LAB-000005 low hemoglobin"],
  },
  {
    id: "radiology",
    phaseId: "diagnostics",
    phaseName: "4 · Diagnostics & pharmacy",
    title: "Radiology & imaging",
    route: "/radiology",
    durationSec: 35,
    narration:
      "Radiology orders progress from ordered to scheduled, acquired, reported. Add PACS link and report text on completion. Four demo chest X-ray orders exist.",
    navigate: ["Open Radiology", "Create imaging order study CXR", "Schedule → acquire → dictate report"],
    enterData: ["Patient, study code CXR", "PACS link URL", "Report text"],
    demoData: ["RAD-000001 to RAD-000004 various statuses", "Reported: No acute findings"],
  },
  {
    id: "pharmacy",
    phaseId: "diagnostics",
    phaseName: "4 · Diagnostics & pharmacy",
    title: "Pharmacy management",
    route: "/pharmacy",
    durationSec: 35,
    narration:
      "Pharmacy queue handles dispensing from prescriptions. Statuses: queued, verified, dispensed. Medicine codes come from medicine master PARA500 Paracetamol.",
    navigate: ["Open Pharmacy", "Process dispense queue", "Advance to verified then dispensed"],
    enterData: ["Medicine code from master", "Quantity"],
    demoData: ["RX-000001 queued, RX-000002 verified, RX-000003 dispensed"],
  },
  {
    id: "inpatient",
    phaseId: "inpatient",
    phaseName: "5 · Inpatient",
    title: "IPD admission & ward",
    route: "/inpatient",
    durationSec: 40,
    narration:
      "Inpatient admissions allocate beds and track ward status. Demo admission ADM-000001 for Vikram Singh on bed B201. Admit patient: select patient, available bed code, ward GEN, diagnosis.",
    navigate: ["Open Inpatient", "View active admission", "Admit new patient or discharge"],
    enterData: ["Patient, bed code B201, ward GEN, diagnosis DM2"],
    demoData: ["1 active IPD — Vikram Singh DEMO-005 on bed B201", "Discharge triggers billing hook"],
  },
  {
    id: "nursing",
    phaseId: "inpatient",
    phaseName: "5 · Inpatient",
    title: "Nursing & care plans",
    route: "/nursing",
    durationSec: 35,
    narration:
      "Nursing tasks include vitals check, medication administration, and wound care. Demo has three tasks — completed, in progress, and pending — for the IPD patient.",
    navigate: ["Open Nursing", "View task list", "Complete or assign tasks"],
    enterData: ["Task type, description, assign nurse", "Mark complete"],
    demoData: ["3 nursing tasks linked to IPD admission", "vitals_check completed, medication_admin in progress"],
  },
  {
    id: "ot",
    phaseId: "inpatient",
    phaseName: "5 · Inpatient",
    title: "Operation theatre",
    route: "/operation-theatre",
    durationSec: 35,
    narration:
      "OT procedures track scheduling through pre-op, intra-op, and completion. Demo appendectomy cases OT-000001 to OT-000004. Pre-op checklist includes consent, labs, and NPO.",
    navigate: ["Open Operation Theatre", "Create procedure", "Advance pre_op → in_progress → completed"],
    enterData: ["Patient, procedure code APPEND", "Theatre OT-1", "Pre-op checklist items"],
    demoData: ["4 OT procedures various stages", "Implant tracking in payload"],
  },
  {
    id: "billing",
    phaseId: "finance",
    phaseName: "6 · Finance & RCM",
    title: "Billing & payments",
    route: "/billing",
    durationSec: 45,
    narration:
      "Billing uses tariff master for line items. Create estimate or invoice — select patient and tariff OPD consult or lab CBC. Payments use gateway tokens only, never raw card data. " +
      "Demo invoice INV-DEMO-000001 for Rajesh Kumar total nine hundred fifty rupees with partial payment recorded.",
    navigate: ["Open Billing", "Create invoice form", "Pay button on issued invoice"],
    enterData: ["Patient, tariff code", "Payment token ref and masked last four"],
    demoData: ["INV-DEMO-000001 ₹950 issued with ₹500 paid", "INV-DEMO-000002 ₹2500 outstanding for AR"],
  },
  {
    id: "claims",
    phaseId: "finance",
    phaseName: "6 · Finance & RCM",
    title: "Insurance & claims",
    route: "/insurance-claims",
    durationSec: 40,
    narration:
      "Insurance claims move from draft through submitted, under review, approved, to paid. Payer codes STAR and ICICI come from insurance payer master. Five demo claims cover the full lifecycle.",
    navigate: ["Open Insurance Claims", "Create claim with payer and policy", "Advance status through workflow"],
    enterData: ["Patient, payer STAR or ICICI", "Amount, policy number", "Pre-auth number"],
    demoData: ["CLM-000001 draft through CLM-000005 paid", "Amounts ₹5000 to ₹9000"],
  },
  {
    id: "rcm",
    phaseId: "finance",
    phaseName: "6 · Finance & RCM",
    title: "Revenue cycle management",
    route: "/revenue-cycle",
    durationSec: 35,
    narration:
      "Revenue cycle covers charge capture, AR aging, denials, and collections. Demo work items show charge capture and AR aging submodule records.",
    navigate: ["Open Revenue Cycle", "Submodule tabs: charge capture, AR aging", "Create and advance records"],
    enterData: ["Title, payer reference in extras", "Status workflow buttons"],
    demoData: ["Module records for RCM submodules in demo replay"],
  },
  {
    id: "pathways",
    phaseId: "care-programs",
    phaseName: "7 · Care programs",
    title: "Disease & care pathways",
    route: "/pathways",
    durationSec: 40,
    narration:
      "Care pathways define templates and patient enrollments. Demo DM2-PATH diabetes pathway enrolled for Sunita Patel at milestone three-month review. Create template, then enroll patient.",
    navigate: ["Open Pathways", "Templates tab → Enrollments tab", "Enroll patient in DM2 pathway"],
    enterData: ["Pathway code DM2-PATH", "Patient, milestone tracking"],
    demoData: ["DM2-PATH template with 4 milestones", "1 active enrollment on DEMO-004 Sunita Patel"],
  },
  {
    id: "chronic-care",
    phaseId: "care-programs",
    phaseName: "7 · Care programs",
    title: "Chronic disease programs",
    route: "/chronic-care",
    durationSec: 30,
    narration:
      "Chronic care desk manages program enrollment, coordinator assignment, and monitoring. Each submodule tab has create, search, edit, and lifecycle buttons. Demo records exist per submodule.",
    navigate: ["Open Chronic Care", "Switch tabs: enrollment, coordinator, monitoring", "Create record with patient link"],
    enterData: ["Title, program type diabetes or HTN", "Patient from dropdown"],
    demoData: ["DEMO records for chronic care submodules", "Linked to demo patients"],
  },
  {
    id: "inventory",
    phaseId: "operations",
    phaseName: "8 · Operations",
    title: "Inventory & procurement",
    route: "/inventory",
    durationSec: 35,
    narration:
      "Inventory tracks stock master through purchase request, GRN, and issue. Lifecycle: draft, submitted, approved, ordered, received, closed. Enter SKU and quantity in extras.",
    navigate: ["Open Inventory", "Submodule: purchase request", "Create → submit → approve workflow"],
    enterData: ["Title, SKU item code, quantity", "Advance through procurement lifecycle"],
    demoData: ["Demo procurement records per submodule", "48 total domain records across modules"],
  },
  {
    id: "ambulance",
    phaseId: "operations",
    phaseName: "8 · Operations",
    title: "Ambulance & transport",
    route: "/ambulance",
    durationSec: 30,
    narration:
      "Ambulance dispatch flows from requested through dispatched, en route, on scene, transporting, handover, to closed. Enter pickup and destination in the form.",
    navigate: ["Open Ambulance", "Create dispatch request", "Advance through en route → handover"],
    enterData: ["Patient, pickup location, destination", "Title for dispatch"],
    demoData: ["Demo ambulance records with patient linkage"],
  },
  {
    id: "location",
    phaseId: "operations",
    phaseName: "8 · Operations",
    title: "GPS & location services",
    route: "/location-services",
    durationSec: 30,
    narration:
      "Location services capture GPS events with purpose codes from master and consent where required. Demo home visit event for Rajesh Kumar in Mumbai coordinates.",
    navigate: ["Open Location Services", "Log location event", "Select purpose HOME_VISIT"],
    enterData: ["Patient, latitude longitude, purpose code", "Consent ID if required"],
    demoData: ["1 location event 19.0760, 72.8777 for DEMO-001", "Purpose HOME_VISIT"],
  },
  {
    id: "notifications",
    phaseId: "engagement",
    phaseName: "9 · Engagement",
    title: "Notifications & engagement",
    route: "/notifications",
    durationSec: 35,
    narration:
      "Send SMS, email, WhatsApp, or push notifications. Templates load from notification template master — click Use template to pre-fill. Outbox shows sent demo messages to rajesh dot k at demo dot in.",
    navigate: ["Open Notifications", "Pick template APPT_REMINDER", "Queue send with recipient"],
    enterData: ["Channel, recipient phone or email", "Subject and body"],
    demoData: ["3 sent notifications: email reminder, SMS lab result, WhatsApp discharge"],
  },
  {
    id: "portal",
    phaseId: "engagement",
    phaseName: "9 · Engagement",
    title: "Patient portal",
    route: "/portal",
    durationSec: 40,
    narration:
      "Patient portal lets patients request appointments, view bills, pay with tokenized gateway, and join teleconsult sessions. Book appointment: select provider, datetime, telemedicine mode. Pay bill uses gateway token — no raw card storage.",
    navigate: ["Open Patient portal", "Request appointment form", "Pay now on unpaid invoice"],
    enterData: ["Provider, datetime, mode", "Payment token for bill pay"],
    demoData: ["Shows demo appointments and bills", "Teleconsult link to telemedicine page"],
  },
  {
    id: "reports",
    phaseId: "analytics",
    phaseName: "10 · Analytics & compliance",
    title: "Reports & BI",
    route: "/reports",
    durationSec: 40,
    narration:
      "Click any report card to run live metrics from PostgreSQL — OPD dashboard, IPD occupancy, lab TAT, revenue, audit trail, executive summary. Set date filters then run. Drill-down links jump to source modules.",
    navigate: ["Open Reports", "Click report card to run", "Review metrics table", "Drill-down to module"],
    enterData: ["Optional date from and date to filters"],
    demoData: ["Reports pull live counts from demo dataset", "Workflow definitions shown below"],
  },
  {
    id: "audit",
    phaseId: "analytics",
    phaseName: "10 · Analytics & compliance",
    title: "Audit & compliance",
    route: "/audit",
    durationSec: 35,
    narration:
      "Audit trail shows business events, API latency logs, and clinical PHI access. Filter by entity type patient or path billing. Expand View to see old and new values. Every create, update, and login is logged.",
    navigate: ["Open Audit", "Switch Business, API, Clinical tabs", "Filter and refresh"],
    enterData: [],
    demoData: ["DEMO_SEED audit event", "API logs from all module actions"],
  },
  {
    id: "closing",
    phaseId: "end",
    phaseName: "Summary",
    title: "Demo complete — data organization summary",
    route: "/dashboard",
    durationSec: 55,
    narration:
      "You have toured SUMAYA Care 360 across ten phases and thirty-six modules. Data is organized by tenant and branch in PostgreSQL: patients and encounters in clinical tables, orders in lab and radiology, finance in invoices and claims, and cross-cutting workflows in module records. " +
      "Demo replay loads eight patients, full clinical pipelines, and forty-eight domain work items. Re-run Load demo data anytime from the dashboard. Thank you for watching this SUMAYA Care 360 demonstration.",
    navigate: ["Return to Dashboard", "Explore any module again", "Share login: demo tenant, admin at demo dot sumaya"],
    enterData: [],
    demoData: [
      "Organized by: tenant_id on every table",
      "Phases 1-10 in sidebar navigation",
      "Clinical → Diagnostics → Inpatient → Finance flow",
      "Module records for platform and operations desks",
    ],
  },
];

export const DEMO_TOUR_PHASES = Array.from(
  new Map(DEMO_TOUR_STEPS.map((s) => [s.phaseId, { id: s.phaseId, name: s.phaseName }])).values()
);

export const totalTourDurationMin = Math.ceil(
  DEMO_TOUR_STEPS.reduce((sum, s) => sum + s.durationSec, 0) / 60
);

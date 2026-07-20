"""Canonical end-to-end hospital workflows shown across the product."""

HOSPITAL_WORKFLOWS = [
    {"code": "patient-administration", "name": "Patient Administration - Complete Visit", "module_code": "patient-registration-and-crm",
     "steps": ["Identify or register", "Verify demographics and consent", "Create visit", "Check in", "Clinical handoff", "Disposition", "Financial clearance", "Follow-up"]},
    {"code": "opd-visit", "name": "Outpatient Visit", "module_code": "opd-clinical-workflow",
     "steps": ["Appointment or walk-in", "Queue token", "Vitals", "Consultation", "Diagnosis", "Orders and prescription", "Checkout", "Follow-up"]},
    {"code": "emergency-care", "name": "Emergency & Casualty", "module_code": "emergency-and-triage",
     "steps": ["Arrival", "Rapid registration", "ESI triage", "Stabilization", "Investigations", "Treatment", "Disposition", "Admit, transfer or discharge"]},
    {"code": "ipd-stay", "name": "Inpatient Admission to Discharge", "module_code": "ipd-admission-and-ward-management",
     "steps": ["Admission request", "Eligibility and estimate", "Bed allocation", "Admission assessment", "Orders and care plan", "Daily rounds", "Discharge readiness", "Summary and reconciliation", "Follow-up"]},
    {"code": "diagnostics", "name": "Diagnostics Order to Verified Result", "module_code": "laboratory-and-diagnostics",
     "steps": ["Clinical order", "Scheduling or collection", "Accession", "Processing or acquisition", "Result entry", "Verification", "Critical alert", "Clinical acknowledgement"]},
    {"code": "medication", "name": "Medication Order to Administration", "module_code": "pharmacy-and-medication-management",
     "steps": ["Prescription", "Pharmacist validation", "Stock and interaction check", "Dispense", "Administration", "Medication reconciliation", "Discharge medicines"]},
    {"code": "surgery", "name": "Surgical & OT Journey", "module_code": "operation-theatre-and-procedures",
     "steps": ["Procedure request", "Pre-anaesthesia check", "Consent", "Scheduling", "Safety checklist", "Procedure", "Recovery", "Post-op orders", "Implant and billing reconciliation"]},
    {"code": "revenue-cycle", "name": "Hospital Revenue Cycle", "module_code": "revenue-cycle-management",
     "steps": ["Eligibility", "Estimate", "Pre-authorization", "Charge capture", "Coding", "Invoice", "Payment or claim", "Denial follow-up", "Settlement"]},
    {"code": "discharge-continuity", "name": "Discharge & Continuity of Care", "module_code": "post-treatment-patient-care",
     "steps": ["Readiness assessment", "Pending order clearance", "Medication reconciliation", "Discharge summary", "Patient education", "Financial clearance", "Follow-up booking", "Post-discharge monitoring"]},
    {"code": "teleconsult", "name": "Teleconsultation", "module_code": "telemedicine-and-virtual-care",
     "steps": ["Book slot", "Identity and consent", "Payment", "Virtual waiting room", "Consultation", "ePrescription and orders", "Summary", "Follow-up"]},
]

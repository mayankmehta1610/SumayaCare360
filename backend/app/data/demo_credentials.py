"""Demo tenant login catalog — synced to database via role_bootstrap."""

DEMO_TENANT_CODE = "demo"

# (email, full_name, role_code, password, description)
DEMO_ROLE_USERS: list[tuple[str, str, str, str, str]] = [
    ("admin@demo.sumaya", "Demo Tenant Admin", "TENANT_ADMIN", "TenantAdmin@360", "Full hospital admin — all modules"),
    ("branch@demo.sumaya", "Branch Manager", "BRANCH_ADMIN", "BranchAdmin@360", "Branch operations — front office + read billing"),
    ("doctor@demo.sumaya", "Dr. Asha Mehta", "DOCTOR", "Doctor@360", "OPD, encounters, prescriptions, telemedicine"),
    ("nurse@demo.sumaya", "Nurse Priya", "NURSE", "Nurse@360", "Vitals, nursing tasks, inpatient, encounters"),
    ("reception@demo.sumaya", "Reception Desk", "RECEPTIONIST", "Reception@360", "Patients, appointments, queue"),
    ("billing@demo.sumaya", "Billing Desk", "BILLING_STAFF", "Billing@360", "Invoices, payments, claims read"),
    ("pharmacist@demo.sumaya", "Pharmacy Lead", "PHARMACIST", "Pharmacist@360", "Pharmacy dispense queue"),
    ("labtech@demo.sumaya", "Lab Technician", "LAB_TECH", "LabTech@360", "Laboratory orders and results"),
    ("radiologist@demo.sumaya", "Dr. Radiology", "RADIOLOGIST", "Radiologist@360", "Imaging orders and reports"),
    ("patient@demo.sumaya", "Rajesh Kumar (Patient)", "PATIENT", "Patient@360", "Patient portal — appointments & bills"),
]

ROLE_DEFINITIONS: list[tuple[str, str, list[str]]] = [
    ("SUPER_ADMIN", "Super Admin", ["*"]),
    ("TENANT_ADMIN", "Tenant Admin", [
        "tenants:read", "branches:*", "users:*", "masters:*", "patients:*",
        "providers:*", "appointments:*", "encounters:*", "telemedicine:*",
        "billing:*", "audit:read", "config:*", "vitals:*", "prescriptions:*",
        "reports:read", "laboratory:*", "radiology:*", "pharmacy:*", "nursing:*",
    ]),
    ("BRANCH_ADMIN", "Branch Admin", [
        "branches:read", "masters:*", "patients:*", "providers:*",
        "appointments:*", "billing:read", "reports:read",
    ]),
    ("DOCTOR", "Doctor", [
        "patients:read", "appointments:*", "encounters:*", "prescriptions:*",
        "telemedicine:*", "vitals:*", "laboratory:read", "radiology:read", "pharmacy:read",
    ]),
    ("NURSE", "Nurse", [
        "patients:read", "appointments:read", "encounters:*", "vitals:*",
        "nursing:*", "inpatient:read",
    ]),
    ("RECEPTIONIST", "Receptionist", [
        "patients:*", "appointments:*", "queue:*", "providers:read",
    ]),
    ("BILLING_STAFF", "Billing Staff", [
        "patients:read", "billing:*", "tariffs:read", "reports:read",
    ]),
    ("PHARMACIST", "Pharmacist", [
        "patients:read", "pharmacy:*",
    ]),
    ("LAB_TECH", "Lab Technician", [
        "patients:read", "laboratory:*",
    ]),
    ("RADIOLOGIST", "Radiologist", [
        "patients:read", "radiology:*",
    ]),
    ("PATIENT", "Patient", [
        "appointments:self", "telemedicine:join", "patients:self", "billing:self",
    ]),
]

# KPI code → permission required to view
KPI_PERMISSIONS: dict[str, str] = {
    "patients": "patients:read",
    "appointments": "appointments:read",
    "checked_in": "appointments:read",
    "open_encounters": "encounters:read",
    "telemedicine": "telemedicine:read",
    "triage": "encounters:read",
    "ipd": "inpatient:read",
    "nursing": "nursing:read",
    "ot": "encounters:read",
    "lab": "laboratory:read",
    "radiology": "radiology:read",
    "pharmacy": "pharmacy:read",
    "pathways": "encounters:read",
    "claims": "billing:read",
    "beds": "masters:read",
    "invoices": "billing:read",
    "domain_records": "masters:read",
    "modules": "masters:read",
}

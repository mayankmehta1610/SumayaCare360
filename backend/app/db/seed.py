"""Seed configuration masters and demo tenant — no fake clinical transactions."""
from app.db.session import engine, SessionLocal, Base
from app.core.security import hash_password
from app.models import entities as m


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(m.User).filter(m.User.is_super_admin == True).first():
            print("Seed skipped — already initialized")
            return

        # Global roles
        for code, name, perms in [
            ("SUPER_ADMIN", "Super Admin", ["*"]),
            ("TENANT_ADMIN", "Tenant Admin", [
                "tenants:read", "branches:*", "users:*", "masters:*", "patients:*",
                "providers:*", "appointments:*", "encounters:*", "telemedicine:*",
                "billing:*", "audit:read", "config:*", "vitals:*", "prescriptions:*"
            ]),
            ("DOCTOR", "Doctor", [
                "patients:read", "appointments:*", "encounters:*", "prescriptions:*",
                "telemedicine:*", "masters:read", "vitals:*"
            ]),
            ("NURSE", "Nurse", ["patients:read", "appointments:read", "encounters:*", "vitals:*", "masters:read"]),
            ("RECEPTIONIST", "Receptionist", ["patients:*", "appointments:*", "queue:*", "masters:read", "billing:read"]),
            ("BILLING_STAFF", "Billing Staff", ["patients:read", "billing:*", "tariffs:read", "masters:read"]),
            ("PATIENT", "Patient", ["appointments:self", "telemedicine:join", "patients:self", "billing:self"]),
        ]:
            db.add(m.Role(code=code, name=name, permissions=perms, is_system=True, tenant_id=None))

        for code, name, dial in [("IN", "India", "+91"), ("AE", "United Arab Emirates", "+971"), ("US", "United States", "+1")]:
            db.add(m.Country(code=code, name=name, dial_code=dial))

        for code, name in [("M", "Male"), ("F", "Female"), ("O", "Other"), ("U", "Unknown")]:
            db.add(m.Gender(code=code, name=name))

        for code, name in [
            ("GENMED", "General Medicine"), ("CARDIO", "Cardiology"),
            ("ORTHO", "Orthopedics"), ("PEDS", "Pediatrics"), ("DERM", "Dermatology"),
        ]:
            db.add(m.Specialty(code=code, name=name, tenant_id=None))

        for code, name, icd in [
            ("HTN", "Hypertension", "I10"), ("DM2", "Type 2 Diabetes Mellitus", "E11"),
            ("URI", "Upper Respiratory Infection", "J06.9"), ("LBP", "Low Back Pain", "M54.5"),
        ]:
            db.add(m.Disease(code=code, name=name, icd_code=icd, tenant_id=None))

        for code, name, caps in [
            ("twilio", "Twilio Video", {"recording": True, "waiting_room": True}),
            ("acs", "Azure Communication Services", {"recording": True}),
            ("zoom", "Zoom", {"recording": True}),
            ("teams", "Microsoft Teams", {"recording": False}),
            ("meet", "Google Meet", {"recording": False}),
        ]:
            db.add(m.VideoProvider(code=code, name=name, capabilities=caps))

        for code, name in [
            ("TELE_CHECKIN", "Telemedicine Check-in Location"),
            ("HOME_VISIT", "Home Visit Tracking"),
            ("AMBULANCE", "Ambulance Tracking"),
        ]:
            db.add(m.LocationPurpose(code=code, name=name, requires_consent=True, tenant_id=None))

        for code, label, module, perm, route in [
            ("CREATE_PATIENT", "Create Patient", "patients", "patients:*", "/patients"),
            ("BOOK_APPOINTMENT", "Book Appointment", "appointments", "appointments:*", "/appointments"),
            ("START_ENCOUNTER", "Start Encounter", "opd", "encounters:*", "/encounters"),
            ("JOIN_TELE", "Join Teleconsult", "telemedicine", "telemedicine:*", "/telemedicine"),
            ("CREATE_INVOICE", "Create Invoice", "billing", "billing:*", "/billing"),
        ]:
            db.add(m.UIActionRegistry(code=code, label=label, module=module, permission=perm, route=route))

        db.add(m.ConsentTemplate(
            tenant_id=None, code="LOCATION", name="Location Consent",
            purpose="location_capture", version="1.0",
            body="I consent to location capture for the stated clinical purpose.",
        ))

        # Super admin
        super_admin = m.User(
            email="superadmin@sumayacare360.com",
            full_name="SUMAYA Super Admin",
            hashed_password=hash_password("SuperAdmin@360"),
            role_code="SUPER_ADMIN",
            is_super_admin=True,
            tenant_id=None,
        )
        db.add(super_admin)
        db.flush()

        # Demo tenant
        tenant = m.Tenant(
            tenant_code="demo",
            name="SUMAYA Demo Hospital",
            plan_code="enterprise",
            modules={"patients": True, "appointments": True, "opd": True, "telemedicine": True, "billing": True, "masters": True},
            branding={"primary_color": "#0B6E4F", "app_name": "SUMAYA Demo Hospital", "logo_text": "SC360"},
            created_by=super_admin.id, updated_by=super_admin.id,
        )
        db.add(tenant)
        db.flush()

        branch = m.Branch(
            tenant_id=tenant.id, code="MAIN", name="Main Campus",
            address="1 Care Avenue", city="Mumbai",
            created_by=super_admin.id, updated_by=super_admin.id,
        )
        db.add(branch)
        db.flush()

        users = [
            ("admin@demo.sumaya", "Demo Tenant Admin", "TENANT_ADMIN", "TenantAdmin@360"),
            ("doctor@demo.sumaya", "Dr. Asha Mehta", "DOCTOR", "Doctor@360"),
            ("nurse@demo.sumaya", "Nurse Priya", "NURSE", "Nurse@360"),
            ("reception@demo.sumaya", "Reception Desk", "RECEPTIONIST", "Reception@360"),
            ("billing@demo.sumaya", "Billing Desk", "BILLING_STAFF", "Billing@360"),
        ]
        doctor_user = None
        for email, name, role, pwd in users:
            u = m.User(
                tenant_id=tenant.id, branch_id=branch.id, email=email, full_name=name,
                hashed_password=hash_password(pwd), role_code=role,
                created_by=super_admin.id, updated_by=super_admin.id,
            )
            db.add(u)
            if role == "DOCTOR":
                doctor_user = u
        db.flush()

        for code, name, cat, amt in [
            ("OPD_CONSULT", "OPD Consultation", "consultation", 500),
            ("TELE_CONSULT", "Telemedicine Consultation", "consultation", 400),
            ("REG_FEE", "Registration Fee", "registration", 100),
            ("IPD_DAY", "IPD Daily Charge", "inpatient", 2500),
            ("LAB_CBC", "CBC Lab Test", "lab", 350),
            ("XRAY-CHEST", "Chest X-Ray", "radiology", 800),
            ("USG-ABD", "USG Abdomen", "radiology", 1200),
            ("CT-HEAD", "CT Head", "radiology", 4500),
            ("MRI-SPINE", "MRI Spine", "radiology", 8500),
            ("MAMMO-SCREEN", "Mammography Screening", "radiology", 2200),
        ]:
            db.add(m.Tariff(tenant_id=tenant.id, code=code, name=name, category=cat, amount=amt,
                            created_by=super_admin.id, updated_by=super_admin.id))

        for code, name, form, strength in [
            ("PARA500", "Paracetamol", "Tablet", "500mg"),
            ("AMOX250", "Amoxicillin", "Capsule", "250mg"),
        ]:
            db.add(m.Medicine(tenant_id=tenant.id, code=code, name=name, form=form, strength=strength,
                              stock_qty=500, created_by=super_admin.id, updated_by=super_admin.id))

        db.add(m.LabTest(tenant_id=tenant.id, code="CBC", name="Complete Blood Count", sample_type="Blood",
                         created_by=super_admin.id, updated_by=super_admin.id))
        db.add(m.ClinicalTemplate(
            tenant_id=tenant.id, code="SOAP", name="SOAP Note", template_type="progress",
            body={"sections": ["Subjective", "Objective", "Assessment", "Plan"]},
            created_by=super_admin.id, updated_by=super_admin.id,
        ))
        db.add(m.NotificationTemplate(
            tenant_id=tenant.id, code="APPT_REMINDER", channel="email",
            subject="Appointment Reminder",
            body="Dear {{patient_name}}, your appointment is at {{time}}.",
            created_by=super_admin.id, updated_by=super_admin.id,
        ))
        for code, ch, subj, body in [
            ("LAB_READY", "sms", "Lab Result", "Your lab result for {{test}} is ready."),
            ("DISCHARGE", "whatsapp", "Discharge", "Discharge summary available in patient portal."),
            ("PAYMENT_RCPT", "email", "Payment Receipt", "Payment of ₹{{amount}} received. Thank you."),
        ]:
            db.add(m.NotificationTemplate(
                tenant_id=tenant.id, code=code, channel=ch, subject=subj, body=body,
                created_by=super_admin.id, updated_by=super_admin.id,
            ))
        db.add(m.ConsentTemplate(
            tenant_id=tenant.id, code="VIDEO_REC", name="Video Recording Consent",
            purpose="telemedicine_recording", version="1.0",
            body="I consent to recording of this telemedicine consultation.",
            created_by=super_admin.id, updated_by=super_admin.id,
        ))
        db.add(m.TenantVideoConfig(
            tenant_id=tenant.id, provider_code="twilio", config={"mode": "sandbox"},
            recording_enabled=True, retention_days=90,
            created_by=super_admin.id, updated_by=super_admin.id,
        ))

        provider = m.Provider(
            tenant_id=tenant.id, branch_id=branch.id,
            user_id=doctor_user.id if doctor_user else None,
            code="DR-ASHA", full_name="Dr. Asha Mehta", specialty_code="GENMED",
            license_no="MH-DOC-1001", consultation_fee_code="OPD_CONSULT",
            created_by=super_admin.id, updated_by=super_admin.id,
        )
        db.add(provider)
        db.flush()
        for dow in range(0, 5):
            db.add(m.ProviderSchedule(
                tenant_id=tenant.id, provider_id=provider.id, day_of_week=dow,
                start_time="09:00", end_time="13:00", slot_minutes=15, mode="both",
                created_by=super_admin.id, updated_by=super_admin.id,
            ))

        for code, name in [("OPD", "Outpatient"), ("ER", "Emergency"), ("LAB", "Laboratory")]:
            db.add(m.Department(
                tenant_id=tenant.id, branch_id=branch.id, code=code, name=name,
                created_by=super_admin.id, updated_by=super_admin.id,
            ))

        for code, name, tclass in [
            ("GEN", "General Ward", "standard"),
            ("PVT", "Private Room", "premium"),
            ("ICU", "Intensive Care", "critical"),
        ]:
            db.add(m.RoomCategory(
                tenant_id=tenant.id, branch_id=branch.id, code=code, name=name,
                tariff_class=tclass, nursing_station=f"NS-{code}",
                created_by=super_admin.id, updated_by=super_admin.id,
            ))
        for i, (room, bed) in enumerate([("R101", "B101"), ("R101", "B102"), ("R201", "B201"), ("ICU1", "ICU-B1")], 1):
            db.add(m.Bed(
                tenant_id=tenant.id, branch_id=branch.id, room_code=room, bed_code=bed,
                category_code="ICU" if "ICU" in room else "GEN",
                status="available", created_by=super_admin.id, updated_by=super_admin.id,
            ))
        for code, name, tpa in [
            ("STAR", "Star Health", "Star TPA"),
            ("ICICI", "ICICI Lombard", "ICICI TPA"),
        ]:
            db.add(m.InsurancePayer(
                tenant_id=tenant.id, code=code, name=name, tpa_name=tpa,
                claim_rules={"preauth_required": True},
                created_by=super_admin.id, updated_by=super_admin.id,
            ))

        from app.services.modules import sync_platform_modules
        sync_platform_modules(db, super_admin.id)

        _claim_transitions = [
            {"from": "draft", "to": "submitted"},
            {"from": "submitted", "to": "under_review"},
            {"from": "under_review", "to": "approved"},
            {"from": "under_review", "to": "denied"},
            {"from": "approved", "to": "paid"},
            {"from": "denied", "to": "draft"},
        ]
        _pathway_transitions = [
            {"from": "active", "to": "paused"},
            {"from": "active", "to": "completed"},
            {"from": "active", "to": "withdrawn"},
            {"from": "paused", "to": "active"},
            {"from": "paused", "to": "withdrawn"},
        ]
        for wf_code, wf_name, mod, steps, transitions in [
            ("patient-opd", "Patient OPD Visit", "opd-clinical-workflow",
             ["Register", "Book appointment", "Vitals", "Consultation", "Billing"], []),
            ("teleconsult", "Teleconsultation", "telemedicine-and-virtual-care",
             ["Book slot", "Consent", "Video session", "Notes", "Follow-up"], []),
            ("ipd-admit", "IPD Admission", "ipd-admission-and-ward-management",
             ["Request", "Eligibility", "Bed allocation", "Assessment", "Discharge"], []),
            ("lab-dx", "Lab Diagnostics", "laboratory-and-diagnostics",
             ["Order", "Sample", "Processing", "Result", "Notification"], []),
            ("insurance-claim", "Insurance Claim", "insurance-and-claims",
             ["Policy capture", "Eligibility", "Pre-auth", "Submission", "Settlement"],
             _claim_transitions),
            ("care-pathway", "Care Pathway Enrollment", "disease-and-care-pathways",
             ["Enroll", "Milestone 1", "Milestone 2", "Outcome", "Close"],
             _pathway_transitions),
        ]:
            db.add(m.WorkflowDefinition(
                tenant_id=tenant.id, workflow_code=wf_code, name=wf_name,
                module_code=mod, steps=steps, transitions=transitions,
                created_by=super_admin.id, updated_by=super_admin.id,
            ))

        for code, name, aud, mod in [
            ("opd-dashboard", "OPD Appointment Dashboard", "Operations", "appointment-and-queue-management"),
            ("ipd-occupancy", "IPD Occupancy Dashboard", "Admin", "ipd-admission-and-ward-management"),
            ("lab-tat", "Lab TAT Dashboard", "Lab", "laboratory-and-diagnostics"),
            ("revenue", "Revenue Dashboard", "Finance", "billing-tariff-and-payments"),
            ("audit-trail", "Audit Trail Report", "Compliance", "audit-trail-and-governance"),
            ("executive", "Executive Hospital Dashboard", "Leadership", "reports-bi-and-analytics"),
        ]:
            db.add(m.ReportDefinition(
                tenant_id=tenant.id, code=code, name=name, audience=aud,
                module_code=mod, filters=["date", "branch"], metrics=["count", "amount"],
                created_by=super_admin.id, updated_by=super_admin.id,
            ))

        for code, label, mod, route in [
            ("patients", "Patients", "patient-registration-and-crm", "/patients"),
            ("appointments", "Appointments", "appointment-and-queue-management", "/appointments"),
            ("ipd", "IPD Admissions", "ipd-admission-and-ward-management", "/clinical-hub"),
            ("lab", "Lab Orders", "laboratory-and-diagnostics", "/clinical-hub"),
            ("claims", "Insurance Claims", "insurance-and-claims", "/clinical-hub"),
        ]:
            db.add(m.KpiDefinition(
                tenant_id=tenant.id, code=code, label=label,
                module_code=mod, drilldown_route=route,
                created_by=super_admin.id, updated_by=super_admin.id,
            ))

        db.commit()
        from app.db.role_bootstrap import bootstrap_roles_and_demo_users
        bootstrap_roles_and_demo_users(db)
        db.commit()
        print("Seed complete: superadmin@sumayacare360.com / SuperAdmin@360 | tenant=demo")

        from app.db.demo_data import seed_demo_replay
        seed_demo_replay(db)
    finally:
        db.close()


if __name__ == "__main__":
    seed()

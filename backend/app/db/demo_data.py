"""Demo replay dataset — loads realistic transactions for every module (PostgreSQL)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.data.domain_lifecycles import DOMAIN_MODULES, get_domain_meta
from app.data.module_catalog import MODULE_CATALOG
from app.models import entities as m

NOW = datetime.now(timezone.utc)
DEMO_PATIENT_MRN = "DEMO-001"


def _aid(db: Session, tenant_id: UUID) -> UUID:
    u = db.query(m.User).filter(m.User.tenant_id == tenant_id, m.User.role_code == "TENANT_ADMIN").first()
    if u:
        return u.id
    sa = db.query(m.User).filter(m.User.is_super_admin == True).first()
    return sa.id if sa else tenant_id


def is_demo_loaded(db: Session, tenant_id: UUID) -> bool:
    return db.query(m.Patient).filter(
        m.Patient.tenant_id == tenant_id,
        m.Patient.mrn == DEMO_PATIENT_MRN,
        m.Patient.is_deleted == False,
    ).first() is not None


def seed_demo_replay(db: Session, *, force: bool = False) -> None:
    tenant = db.query(m.Tenant).filter(m.Tenant.tenant_code == "demo").first()
    if not tenant:
        print("Demo replay skipped — no demo tenant")
        return
    if not force and is_demo_loaded(db, tenant.id):
        print("Demo replay skipped — already loaded")
        return

    if force:
        _clear_demo_clinical(db, tenant.id)

    actor = _aid(db, tenant.id)
    branch = db.query(m.Branch).filter(m.Branch.tenant_id == tenant.id).first()
    provider = db.query(m.Provider).filter(m.Provider.tenant_id == tenant.id).first()
    doctor = db.query(m.User).filter(m.User.tenant_id == tenant.id, m.User.role_code == "DOCTOR").first()
    nurse = db.query(m.User).filter(m.User.tenant_id == tenant.id, m.User.role_code == "NURSE").first()

    if not provider or not branch:
        print("Demo replay skipped — missing provider/branch")
        return

    # ── Patients ──
    patients_data = [
        ("DEMO-001", "Rajesh", "Kumar", "M", "1985-03-12", "9876500001", "rajesh.k@demo.in"),
        ("DEMO-002", "Priya", "Sharma", "F", "1990-07-22", "9876500002", "priya.s@demo.in"),
        ("DEMO-003", "Ahmed", "Hassan", "M", "1978-11-05", "9876500003", "ahmed.h@demo.in"),
        ("DEMO-004", "Sunita", "Patel", "F", "1995-01-18", "9876500004", "sunita.p@demo.in"),
        ("DEMO-005", "Vikram", "Singh", "M", "1982-09-30", "9876500005", "vikram.s@demo.in"),
        ("DEMO-006", "Ananya", "Reddy", "F", "2018-04-08", "9876500006", "ananya.r@demo.in"),
        ("DEMO-007", "Mohammed", "Ali", "M", "1965-12-01", "9876500007", "mali@demo.in"),
        ("DEMO-008", "Kavita", "Nair", "F", "1988-06-15", "9876500008", "kavita.n@demo.in"),
    ]
    patients: list[m.Patient] = []
    for mrn, fn, ln, g, dob, phone, email in patients_data:
        p = m.Patient(
            tenant_id=tenant.id, branch_id=branch.id, mrn=mrn,
            first_name=fn, last_name=ln, gender_code=g, date_of_birth=dob,
            phone=phone, email=email, blood_group="O+", status="active",
            address="Mumbai, Maharashtra", created_by=actor, updated_by=actor,
        )
        db.add(p)
        patients.append(p)
    db.flush()

    # ── Appointments ──
    appts: list[m.Appointment] = []
    for i, p in enumerate(patients[:5]):
        a = m.Appointment(
            tenant_id=tenant.id, branch_id=branch.id,
            patient_id=p.id, provider_id=provider.id,
            scheduled_at=NOW + timedelta(days=i - 2, hours=10),
            mode="in_person" if i % 2 == 0 else "telemedicine",
            status=["scheduled", "checked_in", "completed", "scheduled", "no_show"][i],
            reason=["Fever", "Follow-up HTN", "Back pain", "Diabetes review", "Skin rash"][i],
            queue_token=f"T{i+101:03d}",
            created_by=actor, updated_by=actor,
        )
        db.add(a)
        appts.append(a)
    db.flush()

    # ── Encounters + vitals + notes ──
    encounters: list[m.Encounter] = []
    for i, p in enumerate(patients[:4]):
        enc = m.Encounter(
            tenant_id=tenant.id, branch_id=branch.id,
            patient_id=p.id, provider_id=provider.id,
            appointment_id=appts[i].id if i < len(appts) else None,
            encounter_type="opd", status="open" if i == 0 else "closed",
            chief_complaint=["Fever 3 days", "BP follow-up", "Lower back pain", "DM review"][i],
            assessment=["Viral URI likely", "Controlled HTN", "Mechanical LBP", "DM2 stable"][i],
            plan=["Paracetamol, fluids", "Continue amlodipine", "Physio referral", "HbA1c in 3mo"][i],
            started_at=NOW - timedelta(days=1, hours=i),
            closed_at=None if i == 0 else NOW - timedelta(hours=12),
            created_by=actor, updated_by=actor,
        )
        db.add(enc)
        encounters.append(enc)
    db.flush()

    for enc in encounters:
        db.add(m.Vital(
            tenant_id=tenant.id, encounter_id=enc.id, patient_id=enc.patient_id,
            bp_systolic=120, bp_diastolic=80, pulse=78, temperature_c=37.1,
            spo2=98, weight_kg=72, height_cm=170, recorded_at=NOW,
            created_by=actor, updated_by=actor,
        ))
        db.add(m.ClinicalNote(
            tenant_id=tenant.id, encounter_id=enc.id,
            note_type="progress", content=f"Clinical note for encounter {enc.id}",
            template_code="SOAP", created_by=actor, updated_by=actor,
        ))
        db.add(m.EncounterDiagnosis(
            tenant_id=tenant.id, encounter_id=enc.id,
            disease_code=["URI", "HTN", "LBP", "DM2"][encounters.index(enc)],
            disease_name=["Upper Respiratory Infection", "Hypertension", "Low Back Pain", "Type 2 Diabetes"][encounters.index(enc)],
            is_primary=True, created_by=actor, updated_by=actor,
        ))

    # ── Lab orders (mixed statuses) ──
    lab_statuses = ["ordered", "sample_collected", "result_entered", "verified", "critical_alert"]
    for i, p in enumerate(patients[:5]):
        db.add(m.LabOrder(
            tenant_id=tenant.id, patient_id=p.id, provider_id=provider.id,
            encounter_id=encounters[i].id if i < len(encounters) else None,
            order_no=f"LAB-{i+1:06d}", test_code="CBC", status=lab_statuses[i],
            result_value="12.5 g/dL" if lab_statuses[i] in ("result_entered", "verified", "critical_alert") else None,
            result_notes="Within range" if i < 3 else "Critical low Hb",
            critical_flag=(lab_statuses[i] == "critical_alert"),
            created_by=actor, updated_by=actor,
        ))

    # ── Radiology ──
    rad_statuses = ["ordered", "scheduled", "acquired", "reported"]
    for i, st in enumerate(rad_statuses):
        db.add(m.RadiologyOrder(
            tenant_id=tenant.id, patient_id=patients[i].id, provider_id=provider.id,
            order_no=f"RAD-{i+1:06d}", study_code="CXR", status=st,
            report_text="No acute findings" if st == "reported" else None,
            scheduled_at=NOW + timedelta(hours=2) if st == "scheduled" else None,
            created_by=actor, updated_by=actor,
        ))

    # ── Pharmacy dispenses ──
    for i, st in enumerate(["queued", "verified", "dispensed"]):
        db.add(m.PharmacyDispense(
            tenant_id=tenant.id, patient_id=patients[i].id,
            dispense_no=f"RX-{i+1:06d}", medicine_code="PARA500", qty=10,
            status=st, created_by=actor, updated_by=actor,
        ))

    # ── IPD + nursing ──
    bed = db.query(m.Bed).filter(m.Bed.tenant_id == tenant.id, m.Bed.status == "available").first()
    if bed:
        bed.status = "occupied"
    ipd = m.IpdAdmission(
        tenant_id=tenant.id, patient_id=patients[4].id,
        admission_no="ADM-000001", bed_code=bed.bed_code if bed else "B201",
        ward_code="GEN", status="admitted", diagnosis_code="DM2",
        admitted_at=NOW - timedelta(days=2),
        created_by=actor, updated_by=actor,
    )
    db.add(ipd)
    db.flush()
    for task_type, st in [("vitals_check", "completed"), ("medication_admin", "in_progress"), ("wound_care", "pending")]:
        db.add(m.NursingTask(
            tenant_id=tenant.id, patient_id=patients[4].id, admission_id=ipd.id,
            task_type=task_type, status=st, description=f"Demo {task_type}",
            assigned_to=nurse.id if nurse else None,
            created_by=actor, updated_by=actor,
        ))

    # ── Emergency triage ──
    for i, (esi, st) in enumerate([(2, "treatment"), (3, "triaged"), (4, "arrived"), (1, "disposition")]):
        db.add(m.TriageAssessment(
            tenant_id=tenant.id, patient_id=patients[i].id,
            triage_no=f"TRI-{i+1:06d}",
            chief_complaint=["Chest pain", "Abdominal pain", "Minor laceration", "Cardiac arrest"][i],
            esi_level=esi, status=st,
            disposition="admit" if st == "disposition" else None,
            arrived_at=NOW - timedelta(hours=i + 1),
            created_by=actor, updated_by=actor,
        ))

    # ── OT procedures ──
    for i, st in enumerate(["scheduled", "pre_op", "in_progress", "completed"]):
        db.add(m.OtProcedure(
            tenant_id=tenant.id, patient_id=patients[i].id,
            procedure_no=f"OT-{i+1:06d}", procedure_code="APPEND",
            procedure_name="Appendectomy", theatre_code="OT-1", status=st,
            scheduled_at=NOW + timedelta(days=i),
            pre_op_checklist={"consent": True, "labs_ok": True, "npo": st != "scheduled"},
            created_by=actor, updated_by=actor,
        ))

    # ── Billing ──
    inv = m.Invoice(
        tenant_id=tenant.id, patient_id=patients[0].id,
        encounter_id=encounters[0].id if encounters else None,
        invoice_no="INV-DEMO-000001", status="issued", total=Decimal("950"),
        created_by=actor, updated_by=actor,
    )
    db.add(inv)
    db.flush()
    db.add(m.InvoiceLine(
        tenant_id=tenant.id, invoice_id=inv.id,
        tariff_code="OPD_CONSULT", description="OPD Consultation", qty=1, unit_price=500, amount=500,
        created_by=actor, updated_by=actor,
    ))
    db.add(m.InvoiceLine(
        tenant_id=tenant.id, invoice_id=inv.id,
        tariff_code="LAB_CBC", description="CBC Lab Test", qty=1, unit_price=350, amount=350,
        created_by=actor, updated_by=actor,
    ))
    db.add(m.Payment(
        tenant_id=tenant.id, invoice_id=inv.id,
        amount=Decimal("500"), gateway="upi", gateway_token_ref="UPI-DEMO-001",
        status="succeeded", paid_at=NOW,
        created_by=actor, updated_by=actor,
    ))

    inv2 = m.Invoice(
        tenant_id=tenant.id, patient_id=patients[1].id,
        invoice_no="INV-DEMO-000002", status="issued", total=Decimal("2500"),
        created_at=NOW - timedelta(days=45),
        created_by=actor, updated_by=actor,
    )
    db.add(inv2)

    # ── Insurance claims ──
    claim_statuses = ["draft", "submitted", "under_review", "approved", "paid"]
    for i, st in enumerate(claim_statuses):
        db.add(m.InsuranceClaim(
            tenant_id=tenant.id, patient_id=patients[i].id,
            payer_code="STAR" if i % 2 == 0 else "ICICI",
            claim_no=f"CLM-{i+1:06d}", status=st,
            amount=Decimal(str(5000 + i * 1000)),
            policy_no=f"POL-DEMO-{i+1:04d}",
            pre_auth_no=f"PA-{i+1:06d}" if st != "draft" else None,
            created_by=actor, updated_by=actor,
        ))

    # ── Care pathways ──
    pathway = db.query(m.CarePathwayTemplate).filter(
        m.CarePathwayTemplate.tenant_id == tenant.id, m.CarePathwayTemplate.code == "DM2-PATH"
    ).first()
    if not pathway:
        pathway = m.CarePathwayTemplate(
            tenant_id=tenant.id, code="DM2-PATH", name="Type 2 Diabetes Pathway",
            disease_code="DM2",
            milestones=["Enrollment", "Baseline labs", "3-month review", "6-month outcome"],
            created_by=actor, updated_by=actor,
        )
        db.add(pathway)
        db.flush()
    db.add(m.PathwayEnrollment(
        tenant_id=tenant.id, patient_id=patients[3].id, pathway_id=pathway.id,
        status="active", current_milestone="3-month review",
        created_by=actor, updated_by=actor,
    ))

    tele_appt = next((a for a in appts if a.mode == "telemedicine"), appts[1] if len(appts) > 1 else appts[0])
    db.add(m.TelemedicineSession(
        tenant_id=tenant.id, appointment_id=tele_appt.id,
        patient_id=patients[1].id, provider_id=provider.id,
        room_id="TELE-DEMO-001", status="completed",
        started_at=NOW - timedelta(days=1, hours=1),
        ended_at=NOW - timedelta(days=1, minutes=30),
        post_call_summary="Teleconsult completed — BP discussed, continue medication.",
        created_by=actor, updated_by=actor,
    ))

    # ── Dedicated domain module records ──
    for code in DOMAIN_MODULES:
        meta = get_domain_meta(code)
        if not meta:
            continue
        subs = meta["submodules"]
        statuses = meta["statuses"]
        for j, sub in enumerate(subs[:2]):
            st = statuses[min(j + 1, len(statuses) - 1)] if j else meta["initial_status"]
            db.add(m.ModuleRecord(
                tenant_id=tenant.id, module_code=code, submodule=sub,
                reference_no=f"DEMO-{code[:6].upper()}-{j+1:03d}",
                title=f"Demo — {sub}", status=st,
                patient_id=patients[j % len(patients)].id,
                payload={"description": f"Replay data for {meta['name']}", "priority": "medium"},
                created_by=actor, updated_by=actor,
            ))

    # ── Platform modules not in DOMAIN_MODULES (identity etc.) — one record each ──
    domain_codes = set(DOMAIN_MODULES.keys())
    for item in MODULE_CATALOG:
        code = item["code"]
        if code in domain_codes:
            continue
        if db.query(m.ModuleRecord).filter(
            m.ModuleRecord.tenant_id == tenant.id, m.ModuleRecord.module_code == code
        ).count() > 0:
            continue
        sub = (item.get("submodules") or ["General"])[0]
        db.add(m.ModuleRecord(
            tenant_id=tenant.id, module_code=code, submodule=sub,
            reference_no=f"PLAT-{code[:8].upper()}-001",
            title=f"Demo workflow — {item['name']}", status="in_progress",
            payload={"description": f"Platform demo for {item['name']}"},
            created_by=actor, updated_by=actor,
        ))

    # ── Location, documents, notifications ──
    db.add(m.LocationEvent(
        tenant_id=tenant.id, patient_id=patients[0].id,
        purpose_code="HOME_VISIT", latitude=19.0760, longitude=72.8777, accuracy_m=15,
        created_by=actor, updated_by=actor,
    ))
    db.add(m.DocumentMetadata(
        tenant_id=tenant.id, entity_type="consent", entity_id=patients[0].id,
        file_name="consent_demo_001.pdf", content_type="application/pdf",
        storage_key=f"demo/{tenant.id}/consent/consent_demo_001.pdf", size_bytes=45000,
        created_by=actor, updated_by=actor,
    ))
    for ch, subj, recip in [
        ("email", "Appointment Reminder", "rajesh.k@demo.in"),
        ("sms", "Lab result ready", "9876500001"),
        ("whatsapp", "Discharge summary", "9876500002"),
    ]:
        db.add(m.NotificationOutbox(
            tenant_id=tenant.id, channel=ch, recipient=recip,
            subject=subj, body=f"Demo notification — {subj}", status="sent",
            created_by=actor, updated_by=actor,
        ))

    # ── Expanded API sample resources ──
    for area in ["audit-trail-and-governance", "api-observability-and-traceability"]:
        db.add(m.ExpandedResource(
            tenant_id=tenant.id, area_code=area, resource_code="database-audit-fields",
            reference_no=f"EXP-DEMO-{area[:4].upper()}",
            title=f"Demo expanded resource — {area}",
            status="active", payload={"demo": True},
            created_by=actor, updated_by=actor,
        ))

    db.add(m.AuditLog(
        tenant_id=tenant.id, actor_user_id=actor, action="DEMO_SEED",
        entity_type="tenant", entity_id=str(tenant.id),
        new_values={"message": "Demo replay dataset loaded"},
    ))

    db.commit()
    print(f"Demo replay loaded: {len(patients)} patients, full module coverage for tenant=demo")


def _clear_demo_clinical(db: Session, tenant_id: UUID) -> None:
    """Remove prior demo patients (MRN prefix DEMO-) and linked rows."""
    demo_ids = [
        p.id for p in db.query(m.Patient).filter(
            m.Patient.tenant_id == tenant_id, m.Patient.mrn.like("DEMO-%")
        ).all()
    ]
    if not demo_ids:
        return
    for model, col in [
        (m.Appointment, "patient_id"), (m.Encounter, "patient_id"),
        (m.LabOrder, "patient_id"), (m.RadiologyOrder, "patient_id"),
        (m.PharmacyDispense, "patient_id"), (m.IpdAdmission, "patient_id"),
        (m.NursingTask, "patient_id"), (m.TriageAssessment, "patient_id"),
        (m.OtProcedure, "patient_id"), (m.InsuranceClaim, "patient_id"),
        (m.TelemedicineSession, "patient_id"), (m.PathwayEnrollment, "patient_id"),
        (m.Invoice, "patient_id"), (m.LocationEvent, "patient_id"),
    ]:
        db.query(model).filter(getattr(model, col).in_(demo_ids)).delete(synchronize_session=False)
    db.query(m.ModuleRecord).filter(
        m.ModuleRecord.tenant_id == tenant_id,
        m.ModuleRecord.reference_no.like("DEMO-%"),
    ).delete(synchronize_session=False)
    db.query(m.Patient).filter(m.Patient.id.in_(demo_ids)).delete(synchronize_session=False)
    db.flush()

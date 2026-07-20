"""Referential-integrity tests for campus → room → bed → admission."""
from fastapi.testclient import TestClient

from app.core.security import hash_password
from app.db.session import Base, SessionLocal, engine
from app.main import app
from app.models import entities as m

client = TestClient(app)


def _setup():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    tenant = db.query(m.Tenant).filter(m.Tenant.tenant_code == "facility-a").first()
    if not tenant:
        tenant = m.Tenant(tenant_code="facility-a", name="Facility Test Hospital", status="active")
        db.add(tenant); db.flush()
        branch = m.Branch(tenant_id=tenant.id, code="MAIN", name="Main Campus")
        db.add(branch); db.flush()
        department = m.Department(tenant_id=tenant.id, branch_id=branch.id, code="IPD", name="Inpatient")
        category = m.RoomCategory(tenant_id=tenant.id, branch_id=branch.id, code="GEN", name="General", tariff_class="standard")
        patient = m.Patient(tenant_id=tenant.id, mrn="FAC-001", first_name="Test", last_name="Patient", status="active")
        disease = m.Disease(tenant_id=tenant.id, code="HTN-FAC", name="Hypertension", icd_code="I10")
        user = m.User(tenant_id=tenant.id, branch_id=branch.id, email="admin@facility.example.com", full_name="Facility Admin", hashed_password=hash_password("TestAdmin@360"), role_code="TENANT_ADMIN", status="active")
        db.add_all([department, category, patient, disease, user]); db.commit()
    user = db.query(m.User).filter(m.User.tenant_id == tenant.id).first()
    user.email = "admin@facility.example.com"
    db.commit()
    branch = db.query(m.Branch).filter(m.Branch.tenant_id == tenant.id).first()
    department = db.query(m.Department).filter(m.Department.tenant_id == tenant.id).first()
    category = db.query(m.RoomCategory).filter(m.RoomCategory.tenant_id == tenant.id).first()
    patient = db.query(m.Patient).filter(m.Patient.tenant_id == tenant.id).first()
    disease = db.query(m.Disease).filter(m.Disease.tenant_id == tenant.id).first()
    result = {"branch": str(branch.id), "department": str(department.id), "category": str(category.id), "patient": str(patient.id), "disease": str(disease.id)}
    db.close()
    return result


def _headers():
    response = client.post("/api/v1/auth/login", json={"email": "admin@facility.example.com", "password": "TestAdmin@360", "tenant_code": "facility-a"})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}", "X-Tenant-Code": "facility-a"}


def test_linked_facility_hierarchy_and_admission():
    refs, headers = _setup(), _headers()
    parent_id = None
    created = {}
    for kind, code, name in [
        ("building", "BLDG-T", "Test Building"), ("wing", "WING-T", "Test Wing"),
        ("floor", "FLOOR-T", "Test Floor"), ("ward", "WARD-T", "Test Ward"),
        ("room", "ROOM-T", "Test Room"),
    ]:
        existing = client.get(f"/api/v1/admin/facility-locations?type={kind}", headers=headers).json()
        row = next((x for x in existing if x["code"] == code), None)
        if not row:
            payload = {"branch_id": refs["branch"], "location_type": kind, "code": code, "name": name, "parent_id": parent_id}
            if kind in ("ward", "room"):
                payload["department_id"] = refs["department"]
            if kind == "room":
                payload["room_category_id"] = refs["category"]
            response = client.post("/api/v1/admin/facility-locations", headers=headers, json=payload)
            assert response.status_code == 200, response.text
            row = response.json()
        created[kind] = row
        parent_id = row["id"]
    assert created["room"]["path_label"] == "Test Building / Test Wing / Test Floor / Test Ward / Test Room"

    beds = client.get("/api/v1/admin/beds", headers=headers).json()
    bed = next((x for x in beds if x["bed_code"] == "BED-T"), None)
    if not bed:
        response = client.post("/api/v1/admin/beds", headers=headers, json={"room_id": created["room"]["id"], "bed_code": "BED-T"})
        assert response.status_code == 200, response.text
        bed = response.json()
    assert bed["ward_code"] == "WARD-T"
    loose = client.post("/api/v1/masters/beds", headers=headers, json={"code": "LOOSE", "name": "Loose Bed", "extra": {}})
    assert loose.status_code == 400
    if bed["status"] == "occupied":
        admissions = client.get("/api/v1/clinical/ipd-admissions", headers=headers).json()
        admission = next(x for x in admissions if x["bed_id"] == bed["id"] and x["status"] != "discharged")
        assert admission["ward_code"] == "WARD-T" and admission["diagnosis_code"] == "I10"
        release = client.patch(f"/api/v1/admin/beds/{bed['id']}?status=available", headers=headers)
        assert release.status_code == 409
        return
    manual_occupancy = client.patch(f"/api/v1/admin/beds/{bed['id']}?status=occupied", headers=headers)
    assert manual_occupancy.status_code == 400

    profile = {
        "admission_type": "planned", "admitting_provider": "on_call", "admission_reason": "Observation",
        "acuity": "stable", "diet_order": "regular", "fall_risk": "low", "isolation_requirement": "none",
        "attendant_name": "Attendant", "attendant_phone": "9999999999", "payer_type": "self_pay",
        "consent_status": "obtained", "expected_length_of_stay_days": 1,
    }
    response = client.post("/api/v1/clinical/ipd-admissions", headers=headers, json={
        "patient_id": refs["patient"], "bed_id": bed["id"], "diagnosis_id": refs["disease"], "admission_profile": profile,
    })
    assert response.status_code == 200, response.text
    admissions = client.get("/api/v1/clinical/ipd-admissions", headers=headers).json()
    admission = next(x for x in admissions if x["id"] == response.json()["id"])
    assert admission["ward_code"] == "WARD-T"
    assert admission["bed_code"] == "BED-T"
    assert admission["diagnosis_code"] == "I10"

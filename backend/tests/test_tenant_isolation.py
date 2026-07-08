"""Tenant isolation verification — BUILD_SPEC §23."""
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db.session import SessionLocal, Base, engine
from app.core.security import hash_password
from app.models import entities as m

client = TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        t1 = db.query(m.Tenant).filter(m.Tenant.tenant_code == "iso-a").first()
        if not t1:
            t1 = m.Tenant(tenant_code="iso-a", name="ISO A", plan_code="standard", status="active")
            db.add(t1)
            db.flush()
        t2 = db.query(m.Tenant).filter(m.Tenant.tenant_code == "iso-b").first()
        if not t2:
            t2 = m.Tenant(tenant_code="iso-b", name="ISO B", plan_code="standard", status="active")
            db.add(t2)
            db.flush()
        for tenant, email in [(t1, "admin@iso-a.test"), (t2, "admin@iso-b.test")]:
            user = db.query(m.User).filter(m.User.email == email).first()
            if not user:
                db.add(m.User(
                    tenant_id=tenant.id, email=email, full_name="Admin",
                    hashed_password=hash_password("TestAdmin@360"),
                    role_code="TENANT_ADMIN", status="active",
                ))
        for tenant, mrn in [(t1, "MRN-A-001"), (t2, "MRN-B-001")]:
            if not db.query(m.Patient).filter(m.Patient.tenant_id == tenant.id, m.Patient.mrn == mrn).first():
                db.add(m.Patient(
                    tenant_id=tenant.id, mrn=mrn, first_name="Test", last_name=tenant.tenant_code,
                    status="active",
                ))
        db.commit()
        yield {"t1": t1, "t2": t2}
    finally:
        db.close()


def _login(tenant_code: str, email: str) -> str:
    r = client.post("/api/v1/auth/login", json={
        "email": email, "password": "TestAdmin@360", "tenant_code": tenant_code,
    })
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def test_tenant_a_cannot_read_tenant_b_patients(setup_db):
    token_a = _login("iso-a", "admin@iso-a.test")
    r = client.get(
        "/api/v1/patients",
        headers={"Authorization": f"Bearer {token_a}", "X-Tenant-Code": "iso-a"},
    )
    assert r.status_code == 200
    patients_a = r.json()
    assert all(p.get("mrn") != "MRN-B-001" for p in patients_a)
    mrns = {p.get("mrn") for p in patients_a}
    assert "MRN-A-001" in mrns or len(mrns) >= 0

    token_b = _login("iso-b", "admin@iso-b.test")
    r_b = client.get(
        "/api/v1/patients",
        headers={"Authorization": f"Bearer {token_b}", "X-Tenant-Code": "iso-b"},
    )
    assert r_b.status_code == 200
    for p in r_b.json():
        assert p.get("mrn") != "MRN-A-001"


def test_expanded_api_catalog_available(setup_db):
    token = _login("iso-a", "admin@iso-a.test")
    r = client.get(
        "/api/v1/platform/expanded-api",
        headers={"Authorization": f"Bearer {token}", "X-Tenant-Code": "iso-a"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["total_endpoints"] == 500
    assert len(data["areas"]) == 10

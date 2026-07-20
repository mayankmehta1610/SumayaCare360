"""Live smoke validation for field-complete clinical transaction workflows."""
from __future__ import annotations

import json
import sys
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from app.data.demo_clinical_profiles import demo_clinical_profile
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))



BASE = sys.argv[1].rstrip("/") if len(sys.argv) > 1 else "http://127.0.0.1:8012/api/v1"


def request(path: str, *, method: str = "GET", body: dict | None = None, token: str | None = None):
    headers = {"Content-Type": "application/json", "X-Tenant-Code": "demo"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = Request(f"{BASE}{path}", data=json.dumps(body).encode() if body is not None else None, headers=headers, method=method)
    try:
        with urlopen(req, timeout=30) as response:
            return response.status, json.loads(response.read().decode() or "null")
    except HTTPError as error:
        data = json.loads(error.read().decode() or "null")
        return error.code, data


def first_items(response):
    return response.get("items", []) if isinstance(response, dict) else response


def main() -> int:
    status, login = request("/auth/login", method="POST", body={
        "email": "admin@demo.sumaya", "password": "TenantAdmin@360", "tenant_code": "demo",
    })
    if status != 200:
        raise RuntimeError(f"Login failed: {status} {login}")
    token = login["access_token"]

    _, patient_response = request("/patients?page=1&page_size=20", token=token)
    patient = first_items(patient_response)[0]
    _, providers = request("/providers", token=token)
    provider = providers[0]
    _, beds = request("/admin/beds", token=token)
    bed = next(item for item in beds if item["status"] == "available")
    _, tests = request("/masters/lab-tests", token=token)
    _, medicines = request("/masters/medicines", token=token)
    _, payers = request("/masters/insurance-payers", token=token)

    workflows = {
        "emergency": ("/emergency/triage", {
            "patient_id": patient["id"], "chief_complaint": "Acute chest discomfort", "esi_level": 2,
            "notes": "Live workflow validation", "clinical_profile": demo_clinical_profile("emergency"),
        }),
        "ipd": ("/clinical/ipd-admissions", {
            "patient_id": patient["id"], "bed_code": bed["bed_code"], "ward_code": "GEN",
            "diagnosis_code": "R07.9", "admission_profile": demo_clinical_profile("ipd"),
        }),
        "nursing": ("/clinical/nursing-tasks", {
            "patient_id": patient["id"], "task_type": "vitals_check", "description": "Four-hour observation",
            "care_profile": demo_clinical_profile("nursing"),
        }),
        "laboratory": ("/clinical/lab-orders", {
            "patient_id": patient["id"], "provider_id": provider["id"], "test_code": tests[0]["code"],
            "order_profile": demo_clinical_profile("laboratory"),
        }),
        "radiology": ("/clinical/radiology-orders", {
            "patient_id": patient["id"], "provider_id": provider["id"], "study_code": "XRAY-CHEST",
            "order_profile": demo_clinical_profile("radiology"),
        }),
        "pharmacy": ("/clinical/pharmacy-dispenses", {
            "patient_id": patient["id"], "medicine_code": medicines[0]["code"], "qty": 1,
            "dispense_profile": demo_clinical_profile("pharmacy"),
        }),
        "operation_theatre": ("/ot/procedures", {
            "patient_id": patient["id"], "procedure_code": "APPEND", "procedure_name": "Appendectomy",
            "theatre_code": "OT-1", "surgeon_id": provider["id"],
            "procedure_profile": demo_clinical_profile("operation_theatre"),
        }),
        "insurance_claim": ("/finance/claims", {
            "patient_id": patient["id"], "payer_code": payers[0]["code"], "amount": 5000,
            "policy_no": "LIVE-VALIDATION-001", "claim_profile": demo_clinical_profile("insurance_claim"),
        }),
    }

    failures: list[str] = []
    for name, (path, payload) in workflows.items():
        incomplete = dict(payload)
        incomplete.pop(next(key for key in payload if key.endswith("_profile")))
        rejected_status, _ = request(path, method="POST", body=incomplete, token=token)
        created_status, created = request(path, method="POST", body=payload, token=token)
        print(f"{name}: incomplete={rejected_status}, complete={created_status}")
        if rejected_status != 422 or created_status not in (200, 201):
            failures.append(f"{name}: rejected={rejected_status}, created={created_status}, response={created}")

    if failures:
        print("\n".join(failures), file=sys.stderr)
        return 1
    print(f"Validated {len(workflows)} field-complete clinical workflows.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

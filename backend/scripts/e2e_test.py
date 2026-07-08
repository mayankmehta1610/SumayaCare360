"""End-to-end care journey API test."""
import sys
from datetime import datetime, timedelta, timezone

import httpx

BASE = "http://localhost:8000/api/v1"


def main():
    with httpx.Client(timeout=30) as c:
        try:
            c.get(f"{BASE}/health", timeout=2)
        except Exception as e:
            print("API not running:", e)
            return 1

        login = c.post(
            f"{BASE}/auth/login",
            json={"email": "admin@demo.sumaya", "password": "TenantAdmin@360", "tenant_code": "demo"},
        ).json()
        H = {
            "Authorization": "Bearer " + login["access_token"],
            "X-Tenant-Code": "demo",
            "Content-Type": "application/json",
        }

        patient = c.post(
            f"{BASE}/patients",
            headers=H,
            json={"first_name": "E2E", "last_name": "Flow", "phone": "8888888888", "gender_code": "M"},
        ).json()
        provider = c.get(f"{BASE}/providers", headers=H).json()[0]
        appt = c.post(
            f"{BASE}/appointments",
            headers=H,
            json={
                "patient_id": patient["id"],
                "provider_id": provider["id"],
                "scheduled_at": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
                "mode": "in_person",
                "reason": "E2E test",
            },
        ).json()
        enc = c.post(f"{BASE}/appointments/{appt['id']}/start-encounter", headers=H).json()
        eid = enc["id"]

        c.post(
            f"{BASE}/encounters/{eid}/vitals",
            headers=H,
            json={"bp_systolic": 120, "bp_diastolic": 80, "pulse": 72, "temperature_c": 36.8, "spo2": 98},
        )
        c.post(
            f"{BASE}/encounters/{eid}/notes",
            headers=H,
            json={"content": "Stable patient", "note_type": "progress", "template_code": "SOAP"},
        )
        meds = c.get(f"{BASE}/masters/medicines", headers=H).json()
        if meds:
            c.post(
                f"{BASE}/encounters/{eid}/prescriptions",
                headers=H,
                json={
                    "notes": "Rx",
                    "lines": [
                        {
                            "medicine_code": meds[0]["code"],
                            "medicine_name": meds[0]["name"],
                            "dose": "500mg",
                            "frequency": "BD",
                            "duration": "5d",
                        }
                    ],
                },
            )

        detail = c.get(f"{BASE}/encounters/{eid}", headers=H).json()
        assert len(detail["vitals"]) >= 1, "vitals not saved"
        assert len(detail["notes"]) >= 1, "notes not saved"
        assert len(detail["prescriptions"]) >= 1, "rx not saved"

        dis = c.post(
            f"{BASE}/encounters/{eid}/discharge",
            headers=H,
            json={"assessment": "Stable", "plan": "Follow-up"},
        ).json()
        assert dis["invoice"]["total"] > 0, "no invoice"

        detail2 = c.get(f"{BASE}/encounters/{eid}", headers=H).json()
        assert detail2["status"] == "closed"
        assert detail2["invoice"] is not None

        c.get(f"{BASE}/patients/{patient['id']}/chart", headers=H).json()
        print("E2E OK", dis["invoice"]["invoice_no"], "total", dis["invoice"]["total"])
        return 0


if __name__ == "__main__":
    sys.exit(main())

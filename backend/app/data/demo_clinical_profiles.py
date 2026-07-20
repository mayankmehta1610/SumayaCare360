"""Field-complete clinical replay profiles for the demonstration hospital."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone


def demo_clinical_profile(profile_type: str, sequence: int = 0) -> dict:
    now = datetime.now(timezone.utc)
    profiles = {
        "emergency": {
            "arrival_mode": "ambulance" if sequence == 0 else "walk_in",
            "symptom_onset": (now - timedelta(hours=sequence + 2)).isoformat(),
            "pain_score": min(10, sequence + 3), "airway": "patent", "breathing": "normal",
            "circulation": "stable", "consciousness": "alert", "infection_risk": "none",
            "allergies": "None known", "temperature_c": 37.1, "pulse_bpm": 82 + sequence,
            "spo2_pct": 98, "bp_systolic": 122, "bp_diastolic": 80,
            "next_of_kin_phone": f"9876598{sequence:03d}",
        },
        "ipd": {
            "admission_type": "emergency", "admitting_provider": "Dr. Asha Mehta",
            "admission_reason": "Requires inpatient observation and treatment",
            "acuity": "moderate", "diet_order": "diabetic", "fall_risk": "medium",
            "isolation_requirement": "none", "attendant_name": "Family attendant",
            "attendant_phone": "9876599000", "payer_type": "self_pay",
            "consent_status": "captured", "expected_length_of_stay_days": 3,
        },
        "nursing": {
            "priority": "routine" if sequence else "urgent", "shift": "morning",
            "frequency": "four_hourly", "care_plan_goal": "Maintain stable observations and comfort",
            "safety_risk": "fall", "baseline_observation": "Alert, oriented, needs assistance when mobilising",
            "escalation_instruction": "Escalate deterioration to duty medical officer immediately",
        },
        "laboratory": {
            "priority": "urgent" if sequence == 0 else "routine", "clinical_indication": "Diagnostic assessment and treatment monitoring",
            "specimen_type": "blood", "fasting_status": "not_required", "collection_location": "outpatient",
            "infection_risk": "none", "billing_status": "cleared",
        },
        "radiology": {
            "priority": "routine", "clinical_indication": "Confirm working diagnosis", "body_part": "Requested anatomical region",
            "laterality": "not_applicable", "contrast_required": "no", "pregnancy_status": "not_applicable",
            "renal_risk": "none", "sedation_required": "no", "transport_mode": "walking",
        },
        "pharmacy": {
            "prescription_source": "electronic", "dose": "500 mg", "frequency": "three times daily",
            "duration_days": 5, "route": "oral", "batch_no": f"PCM26{sequence:03d}",
            "expiry_date": (now + timedelta(days=365)).date().isoformat(), "allergy_review": "completed_no_conflict",
            "pharmacist_check": "completed", "counselling_status": "completed",
        },
        "operation_theatre": {
            "case_type": "elective", "anaesthesia_type": "general", "pre_op_diagnosis": "Acute appendicitis",
            "laterality": "not_applicable", "expected_duration_minutes": 90, "blood_requirement": "group_and_save",
            "implant_planned": "no", "infection_risk": "standard", "consent_status": "signed",
        },
        "insurance_claim": {
            "claim_type": "cashless", "diagnosis_codes": "ICD-10 E11.9", "procedure_codes": "CONSULT, LAB-CBC",
            "service_from": (now - timedelta(days=2)).date().isoformat(), "service_to": now.date().isoformat(),
            "preauth_required": "yes", "document_status": "complete",
            "submission_deadline": (now + timedelta(days=7)).date().isoformat(), "claim_contact_phone": "9876599111",
        },
    }
    return dict(profiles[profile_type])

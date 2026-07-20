"""Required operational profiles for high-risk hospital transactions."""
from __future__ import annotations

from typing import Any

from fastapi import HTTPException


CLINICAL_PROFILE_REQUIREMENTS: dict[str, tuple[str, ...]] = {
    "emergency": (
        "arrival_mode", "symptom_onset", "pain_score", "airway", "breathing",
        "circulation", "consciousness", "infection_risk", "allergies",
        "temperature_c", "pulse_bpm", "spo2_pct", "bp_systolic", "bp_diastolic",
        "next_of_kin_phone",
    ),
    "ipd": (
        "admission_type", "admitting_provider", "admission_reason", "acuity",
        "diet_order", "fall_risk", "isolation_requirement", "attendant_name",
        "attendant_phone", "payer_type", "consent_status", "expected_length_of_stay_days",
    ),
    "nursing": (
        "priority", "shift", "frequency", "care_plan_goal", "safety_risk",
        "baseline_observation", "escalation_instruction",
    ),
    "laboratory": (
        "priority", "clinical_indication", "specimen_type", "fasting_status",
        "collection_location", "infection_risk", "billing_status",
    ),
    "radiology": (
        "priority", "clinical_indication", "body_part", "laterality",
        "contrast_required", "pregnancy_status", "renal_risk",
        "sedation_required", "transport_mode",
    ),
    "pharmacy": (
        "prescription_source", "dose", "frequency", "duration_days", "route",
        "batch_no", "expiry_date", "allergy_review", "pharmacist_check", "counselling_status",
    ),
    "operation_theatre": (
        "case_type", "anaesthesia_type", "pre_op_diagnosis", "laterality",
        "expected_duration_minutes", "blood_requirement", "implant_planned",
        "infection_risk", "consent_status",
    ),
    "insurance_claim": (
        "claim_type", "diagnosis_codes", "procedure_codes", "service_from",
        "service_to", "preauth_required", "document_status", "submission_deadline",
        "claim_contact_phone",
    ),
}


def validate_clinical_profile(profile_type: str, profile: dict[str, Any] | None) -> dict[str, Any]:
    required = CLINICAL_PROFILE_REQUIREMENTS.get(profile_type)
    if not required:
        raise HTTPException(400, f"Unknown clinical profile: {profile_type}")
    values = dict(profile or {})
    missing = [key for key in required if values.get(key) in (None, "")]
    if missing:
        raise HTTPException(422, detail={
            "message": f"Required {profile_type.replace('_', ' ')} fields are missing",
            "fields": missing,
        })

    numeric_ranges = {
        "pain_score": (0, 10), "temperature_c": (25, 45), "pulse_bpm": (20, 250),
        "spo2_pct": (50, 100), "bp_systolic": (40, 300), "bp_diastolic": (20, 200),
        "expected_length_of_stay_days": (1, 365), "duration_days": (1, 365),
        "expected_duration_minutes": (5, 1440),
    }
    invalid: list[str] = []
    for key, (minimum, maximum) in numeric_ranges.items():
        if key not in values:
            continue
        try:
            number = float(values[key])
        except (TypeError, ValueError):
            invalid.append(key)
            continue
        if number < minimum or number > maximum:
            invalid.append(key)
    if invalid:
        raise HTTPException(422, detail={"message": "Clinical measurements are outside accepted ranges", "fields": invalid})
    return values

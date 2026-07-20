"""Operational field contracts for lifecycle-driven hospital domain desks.

These schemas are shared by the API and web client.  They keep the flexible
ModuleRecord payload useful without allowing departments to save vague,
title-only records.
"""
from __future__ import annotations

from typing import Any

from fastapi import HTTPException


def field(
    key: str,
    label: str,
    kind: str = "text",
    *,
    required: bool = False,
    options: list[str] | None = None,
    section: str = "Operational details",
    placeholder: str = "",
    help_text: str = "",
) -> dict[str, Any]:
    return {
        "key": key,
        "label": label,
        "type": kind,
        "required": required,
        "options": options or [],
        "section": section,
        "placeholder": placeholder,
        "help": help_text,
    }


DOMAIN_FIELD_SCHEMAS: dict[str, dict[str, list[dict[str, Any]]]] = {
    "inventory-procurement-and-stores": {
        "Stock master": [
            field("item_code", "Item / SKU code", required=True),
            field("item_name", "Item name", required=True),
            field("category", "Category", "select", required=True, options=["medicine", "surgical", "consumable", "implant", "linen", "equipment", "general"]),
            field("uom", "Unit of measure", "select", required=True, options=["each", "box", "strip", "bottle", "vial", "ampoule", "pack", "kg", "litre"]),
            field("batch_controlled", "Batch controlled", "checkbox"),
            field("expiry_controlled", "Expiry controlled", "checkbox"),
            field("reorder_level", "Reorder level", "number", required=True),
            field("current_stock", "Opening stock", "number", required=True),
            field("storage_location", "Store / bin location", required=True),
        ],
        "Purchase request": [
            field("requesting_department", "Requesting department", required=True),
            field("item_code", "Item / SKU code", required=True),
            field("quantity", "Requested quantity", "number", required=True),
            field("required_by", "Required by", "date", required=True),
            field("estimated_unit_cost", "Estimated unit cost", "number"),
            field("budget_code", "Budget / cost-centre code", required=True),
            field("clinical_justification", "Clinical / operational justification", "textarea", required=True),
            field("preferred_vendor", "Preferred vendor"),
        ],
        "GRN": [
            field("purchase_order_no", "Purchase order number", required=True),
            field("vendor_invoice_no", "Vendor invoice number", required=True),
            field("vendor_name", "Vendor name", required=True),
            field("received_at", "Received date and time", "datetime", required=True),
            field("item_code", "Item / SKU code", required=True),
            field("quantity_received", "Quantity received", "number", required=True),
            field("batch_no", "Batch number"),
            field("expiry_date", "Expiry date", "date"),
            field("quality_status", "Quality inspection", "select", required=True, options=["accepted", "accepted_with_variance", "quarantined", "rejected"]),
            field("variance_notes", "Shortage / damage / variance notes", "textarea"),
        ],
        "Issue to department": [
            field("department", "Receiving department", required=True),
            field("item_code", "Item / SKU code", required=True),
            field("batch_no", "Batch number"),
            field("quantity_issued", "Quantity issued", "number", required=True),
            field("issued_at", "Issued date and time", "datetime", required=True),
            field("issued_to", "Issued to employee", required=True),
            field("cost_centre", "Cost centre", required=True),
            field("purpose", "Clinical / operational purpose", "textarea", required=True),
        ],
        "Reorder rules": [
            field("item_code", "Item / SKU code", required=True),
            field("minimum_level", "Minimum level", "number", required=True),
            field("maximum_level", "Maximum level", "number", required=True),
            field("reorder_quantity", "Reorder quantity", "number", required=True),
            field("lead_time_days", "Supplier lead time (days)", "number", required=True),
            field("preferred_vendor", "Preferred vendor", required=True),
            field("auto_request", "Automatically create purchase request", "checkbox"),
        ],
    },
    "chronic-disease-programs": {
        "Program enrollment": [
            field("program", "Program", "select", required=True, options=["diabetes", "hypertension", "copd", "asthma", "heart_failure", "ckd", "other"]),
            field("diagnosis_code", "Primary diagnosis code", required=True),
            field("risk_level", "Risk stratification", "select", required=True, options=["low", "moderate", "high", "very_high"]),
            field("enrollment_date", "Enrollment date", "date", required=True),
            field("consent_reference", "Program consent reference", required=True),
            field("baseline_summary", "Baseline clinical summary", "textarea", required=True),
        ],
        "Care coordinator": [
            field("coordinator_name", "Care coordinator", required=True),
            field("assigned_date", "Assigned date", "date", required=True),
            field("contact_frequency", "Planned contact frequency", "select", required=True, options=["weekly", "fortnightly", "monthly", "quarterly"]),
            field("preferred_channel", "Preferred contact channel", "select", required=True, options=["phone", "sms", "whatsapp", "email", "home_visit"]),
            field("care_barriers", "Known care barriers", "textarea"),
        ],
        "Monitoring plan": [
            field("parameters", "Parameters to monitor", "textarea", required=True, placeholder="HbA1c, BP, weight, symptoms"),
            field("target_values", "Patient-specific targets", "textarea", required=True),
            field("monitoring_frequency", "Monitoring frequency", required=True),
            field("next_review_date", "Next review date", "date", required=True),
            field("self_monitoring", "Patient self-monitoring enabled", "checkbox"),
            field("device_or_source", "Device / data source"),
        ],
        "Alerts": [
            field("alert_type", "Alert type", "select", required=True, options=["clinical_threshold", "missed_reading", "medication_gap", "missed_visit", "symptom_escalation"]),
            field("severity", "Severity", "select", required=True, options=["advisory", "moderate", "high", "critical"]),
            field("trigger", "Trigger / observation", "textarea", required=True),
            field("action_required", "Required action", "textarea", required=True),
            field("due_at", "Response due", "datetime", required=True),
        ],
        "Review visits": [
            field("review_date", "Review date", "datetime", required=True),
            field("clinical_outcomes", "Clinical outcomes", "textarea", required=True),
            field("adherence_status", "Adherence", "select", required=True, options=["good", "partial", "poor", "unknown"]),
            field("medication_changes", "Medication changes", "textarea"),
            field("next_review_date", "Next review date", "date", required=True),
            field("escalation_needed", "Escalation needed", "checkbox"),
        ],
    },
    "physiotherapy-and-rehab": {
        "Assessment": [
            field("referral_diagnosis", "Referral diagnosis", required=True),
            field("affected_region", "Affected region / condition", required=True),
            field("pain_score", "Pain score (0-10)", "number", required=True),
            field("functional_limitations", "Functional limitations", "textarea", required=True),
            field("baseline_measure", "Baseline outcome measure", required=True),
            field("precautions", "Precautions / contraindications", "textarea", required=True),
        ],
        "Exercise plan": [
            field("therapy_goal", "Therapy goal", "textarea", required=True),
            field("exercises", "Exercises and dosage", "textarea", required=True),
            field("frequency", "Session frequency", required=True),
            field("home_program", "Home exercise programme", "textarea", required=True),
            field("review_date", "Plan review date", "date", required=True),
        ],
        "Session notes": [
            field("session_number", "Session number", "number", required=True),
            field("session_date", "Session date and time", "datetime", required=True),
            field("interventions", "Interventions performed", "textarea", required=True),
            field("response", "Patient response", "textarea", required=True),
            field("pain_score_after", "Pain score after session", "number", required=True),
            field("home_advice", "Home advice / precautions", "textarea"),
        ],
        "Progress tracking": [
            field("measurement_date", "Measurement date", "date", required=True),
            field("outcome_measure", "Outcome measure", required=True),
            field("baseline_value", "Baseline value", required=True),
            field("current_value", "Current value", required=True),
            field("goal_progress", "Goal progress", "select", required=True, options=["not_started", "behind", "on_track", "achieved"]),
            field("clinical_comment", "Clinical comment", "textarea", required=True),
        ],
        "Discharge goals": [
            field("discharge_date", "Discharge date", "date", required=True),
            field("goals_achieved", "Goals achieved", "textarea", required=True),
            field("functional_status", "Functional status at discharge", "textarea", required=True),
            field("continuing_plan", "Continuing self-management plan", "textarea", required=True),
            field("follow_up_needed", "Follow-up required", "checkbox"),
        ],
    },
    "post-treatment-patient-care": {
        "Discharge plan": [
            field("source_episode", "Encounter / admission reference", required=True),
            field("discharge_date", "Discharge date", "date", required=True),
            field("primary_diagnosis", "Primary diagnosis", required=True),
            field("care_instructions", "Home-care instructions", "textarea", required=True),
            field("red_flags", "Red flags requiring escalation", "textarea", required=True),
            field("caregiver_name", "Responsible caregiver"),
        ],
        "Follow-up schedule": [
            field("follow_up_date", "Follow-up date and time", "datetime", required=True),
            field("service", "Follow-up service", "select", required=True, options=["doctor_visit", "nurse_call", "home_visit", "telemedicine", "lab_test", "rehabilitation"]),
            field("provider_or_team", "Provider / responsible team", required=True),
            field("purpose", "Purpose", "textarea", required=True),
            field("reminder_channel", "Reminder channel", "select", required=True, options=["sms", "whatsapp", "email", "phone"]),
        ],
        "Home monitoring": [
            field("parameter", "Parameter", required=True),
            field("frequency", "Measurement frequency", required=True),
            field("target_range", "Target / safe range", required=True),
            field("escalation_threshold", "Escalation threshold", required=True),
            field("monitoring_end_date", "Monitoring end date", "date", required=True),
            field("device", "Device / collection method"),
        ],
        "Medication adherence": [
            field("medicine", "Medicine", required=True),
            field("prescribed_schedule", "Prescribed schedule", required=True),
            field("adherence_status", "Adherence status", "select", required=True, options=["taking_as_directed", "missed_doses", "stopped", "unable_to_obtain", "side_effects"]),
            field("barrier", "Barrier / reason", "textarea"),
            field("intervention", "Intervention", "textarea", required=True),
            field("review_date", "Review date", "date", required=True),
        ],
        "Escalation": [
            field("trigger", "Escalation trigger", "textarea", required=True),
            field("severity", "Severity", "select", required=True, options=["routine", "urgent", "emergency"]),
            field("escalated_to", "Escalated to", required=True),
            field("escalated_at", "Escalated at", "datetime", required=True),
            field("immediate_advice", "Immediate advice given", "textarea", required=True),
            field("resolution", "Resolution / outcome", "textarea"),
        ],
    },
    "women-child-and-specialty-care": {
        "Antenatal": [
            field("gravida", "Gravida", "number", required=True),
            field("para", "Para", "number", required=True),
            field("lmp", "Last menstrual period", "date", required=True),
            field("edd", "Expected delivery date", "date", required=True),
            field("gestational_age_weeks", "Gestational age (weeks)", "number", required=True),
            field("risk_factors", "Maternal / fetal risk factors", "textarea", required=True),
            field("blood_group_rh", "Blood group and Rh", required=True),
            field("next_visit", "Next ANC visit", "date", required=True),
        ],
        "Immunization": [
            field("vaccine", "Vaccine", required=True),
            field("dose", "Dose number", required=True),
            field("scheduled_date", "Scheduled date", "date", required=True),
            field("administered_date", "Administered date", "date"),
            field("batch_no", "Vaccine batch number"),
            field("site_route", "Site and route"),
            field("adverse_event", "Adverse event", "textarea"),
        ],
        "Pediatric growth": [
            field("measurement_date", "Measurement date", "date", required=True),
            field("age_months", "Age in months", "number", required=True),
            field("weight_kg", "Weight (kg)", "number", required=True),
            field("height_cm", "Height / length (cm)", "number", required=True),
            field("head_circumference_cm", "Head circumference (cm)", "number"),
            field("growth_interpretation", "Growth interpretation", "select", required=True, options=["normal", "underweight", "stunting", "wasting", "overweight", "needs_review"]),
            field("nutrition_advice", "Nutrition advice", "textarea"),
        ],
        "Specialty clinics": [
            field("clinic_type", "Specialty clinic", required=True),
            field("visit_date", "Visit date", "datetime", required=True),
            field("reason_for_visit", "Reason for visit", "textarea", required=True),
            field("clinical_findings", "Clinical findings", "textarea", required=True),
            field("care_plan", "Care plan", "textarea", required=True),
            field("follow_up_date", "Follow-up date", "date"),
        ],
        "Counseling": [
            field("counseling_type", "Counseling type", "select", required=True, options=["antenatal", "lactation", "family_planning", "nutrition", "adolescent", "genetic", "bereavement", "other"]),
            field("session_date", "Session date", "datetime", required=True),
            field("topics", "Topics discussed", "textarea", required=True),
            field("understanding", "Patient / guardian understanding", "textarea", required=True),
            field("agreed_actions", "Agreed actions", "textarea", required=True),
        ],
    },
    "ambulance-and-transport": {
        "Dispatch request": [
            field("request_type", "Request type", "select", required=True, options=["emergency_pickup", "interfacility_transfer", "discharge_transport", "scheduled_transport"]),
            field("caller_name", "Caller name", required=True),
            field("caller_phone", "Caller phone", "tel", required=True),
            field("pickup_address", "Pickup address", "textarea", required=True),
            field("destination", "Destination", "textarea", required=True),
            field("clinical_priority", "Clinical priority", "select", required=True, options=["routine", "urgent", "emergency", "critical"]),
            field("clinical_summary", "Clinical summary / transport needs", "textarea", required=True),
        ],
        "Fleet tracking": [
            field("vehicle_no", "Vehicle registration", required=True),
            field("crew", "Crew members", required=True),
            field("driver_phone", "Driver contact", "tel", required=True),
            field("current_location", "Current location", required=True),
            field("availability", "Availability", "select", required=True, options=["available", "assigned", "en_route", "on_scene", "transporting", "maintenance"]),
            field("equipment_status", "Required equipment readiness", "textarea", required=True),
        ],
        "ETA": [
            field("dispatch_reference", "Dispatch reference", required=True),
            field("estimated_arrival", "Estimated arrival", "datetime", required=True),
            field("distance_km", "Distance remaining (km)", "number"),
            field("delay_reason", "Delay / traffic note", "textarea"),
            field("last_location", "Last reported location", required=True),
        ],
        "Handover": [
            field("handover_at", "Handover date and time", "datetime", required=True),
            field("receiving_facility", "Receiving facility / unit", required=True),
            field("receiving_clinician", "Receiving clinician", required=True),
            field("clinical_condition", "Condition at handover", "textarea", required=True),
            field("interventions_en_route", "Interventions performed en route", "textarea", required=True),
            field("belongings_documents", "Documents / belongings handed over", "textarea"),
        ],
        "Billing linkage": [
            field("dispatch_reference", "Dispatch reference", required=True),
            field("tariff_code", "Transport tariff code", required=True),
            field("distance_km", "Billable distance (km)", "number", required=True),
            field("waiting_minutes", "Waiting time (minutes)", "number"),
            field("additional_charges", "Additional charge details", "textarea"),
            field("payer_type", "Payer type", "select", required=True, options=["self_pay", "insurance", "corporate", "government", "hospital"]),
        ],
    },
    "diet-catering-and-housekeeping": {
        "Diet orders": [
            field("ward_bed", "Ward / bed", required=True),
            field("diet_type", "Prescribed diet", "select", required=True, options=["regular", "soft", "liquid", "diabetic", "renal", "cardiac", "low_sodium", "high_protein", "npo", "custom"]),
            field("allergies", "Food allergies / intolerances", "textarea", required=True),
            field("texture", "Texture / consistency", required=True),
            field("effective_from", "Effective from", "datetime", required=True),
            field("clinical_instructions", "Clinical instructions", "textarea"),
        ],
        "Meal plans": [
            field("diet_order_reference", "Diet order reference", required=True),
            field("meal_date", "Meal date", "date", required=True),
            field("breakfast", "Breakfast plan", "textarea", required=True),
            field("lunch", "Lunch plan", "textarea", required=True),
            field("dinner", "Dinner plan", "textarea", required=True),
            field("snacks_supplements", "Snacks / supplements", "textarea"),
        ],
        "Catering SLA": [
            field("service_area", "Service area", required=True),
            field("meal", "Meal / service", required=True),
            field("scheduled_time", "Scheduled delivery", "datetime", required=True),
            field("delivered_time", "Actual delivery", "datetime"),
            field("temperature_c", "Food temperature (C)", "number"),
            field("variance_reason", "SLA variance reason", "textarea"),
        ],
        "Housekeeping tasks": [
            field("location", "Room / bed / area", required=True),
            field("task_type", "Task type", "select", required=True, options=["routine_clean", "terminal_clean", "spill_response", "isolation_clean", "linen_change", "waste_collection"]),
            field("infection_risk", "Infection-control risk", "select", required=True, options=["standard", "contact", "droplet", "airborne", "biohazard"]),
            field("assigned_team", "Assigned team", required=True),
            field("due_at", "Due date and time", "datetime", required=True),
            field("checklist", "Cleaning checklist / chemicals", "textarea", required=True),
        ],
        "Infection control": [
            field("location", "Location", required=True),
            field("precaution_type", "Precaution type", "select", required=True, options=["standard", "contact", "droplet", "airborne", "protective"]),
            field("organism_or_reason", "Organism / reason", required=True),
            field("started_at", "Precautions started", "datetime", required=True),
            field("ppe_requirements", "PPE requirements", "textarea", required=True),
            field("clearance_criteria", "Clearance criteria", "textarea", required=True),
        ],
    },
    "integrations-and-interoperability": {
        "FHIR endpoints": [
            field("endpoint_name", "Endpoint name", required=True),
            field("base_url", "FHIR base URL", "url", required=True),
            field("fhir_version", "FHIR version", "select", required=True, options=["R4", "R4B", "R5"]),
            field("auth_method", "Authentication method", "select", required=True, options=["oauth2", "smart_on_fhir", "mutual_tls", "api_key_reference"]),
            field("resource_scope", "Permitted resources / scopes", "textarea", required=True),
            field("owner", "Operational owner", required=True),
        ],
        "HL7 feeds": [
            field("feed_name", "Feed name", required=True),
            field("message_types", "Message types", required=True, placeholder="ADT, ORM, ORU"),
            field("transport", "Transport", "select", required=True, options=["MLLP", "SFTP", "HTTPS", "queue"]),
            field("endpoint", "Endpoint / channel reference", required=True),
            field("sending_facility", "Sending facility", required=True),
            field("error_queue", "Error queue / support owner", required=True),
        ],
        "Payment gateway": [
            field("gateway_name", "Gateway name", required=True),
            field("merchant_reference", "Merchant account reference", required=True),
            field("environment", "Environment", "select", required=True, options=["sandbox", "production"]),
            field("callback_url", "Callback URL", "url", required=True),
            field("supported_methods", "Supported payment methods", required=True),
            field("settlement_account", "Settlement account reference", required=True),
        ],
        "Lab interfaces": [
            field("laboratory_name", "Laboratory / analyser", required=True),
            field("interface_type", "Interface type", "select", required=True, options=["HL7", "ASTM", "FHIR", "REST", "file"]),
            field("endpoint", "Endpoint / device reference", required=True),
            field("test_mapping", "Test-code mapping reference", required=True),
            field("result_validation", "Result validation rule", "textarea", required=True),
            field("support_owner", "Support owner", required=True),
        ],
        "PACS bridge": [
            field("pacs_name", "PACS / VNA name", required=True),
            field("dicom_ae_title", "DICOM AE title", required=True),
            field("host", "Host / endpoint", required=True),
            field("port", "DICOM port", "number", required=True),
            field("viewer_url", "Viewer URL", "url", required=True),
            field("access_policy", "Access and retention policy", "textarea", required=True),
        ],
    },
    "data-governance-and-platform-ops": {
        "Data quality": [
            field("data_domain", "Data domain", required=True),
            field("quality_rule", "Quality rule", "textarea", required=True),
            field("threshold", "Acceptance threshold", required=True),
            field("owner", "Data owner", required=True),
            field("measurement_frequency", "Measurement frequency", required=True),
            field("remediation_sla", "Remediation SLA", required=True),
        ],
        "Retention policy": [
            field("record_category", "Record category", required=True),
            field("jurisdiction", "Jurisdiction", required=True),
            field("retention_years", "Retention period (years)", "number", required=True),
            field("legal_basis", "Legal / policy basis", "textarea", required=True),
            field("disposal_method", "Approved disposal method", required=True),
            field("policy_owner", "Policy owner", required=True),
        ],
        "Backup status": [
            field("system", "System / database", required=True),
            field("backup_type", "Backup type", "select", required=True, options=["full", "incremental", "transaction_log", "snapshot"]),
            field("completed_at", "Completed at", "datetime", required=True),
            field("verification_status", "Verification", "select", required=True, options=["verified", "warning", "failed"]),
            field("restore_test_date", "Last restore test", "date", required=True),
            field("retention_location", "Encrypted retention location", required=True),
        ],
        "Release gates": [
            field("release_version", "Release version", required=True),
            field("environment", "Environment", "select", required=True, options=["development", "test", "staging", "production"]),
            field("change_reference", "Change / ticket reference", required=True),
            field("test_evidence", "Test evidence reference", required=True),
            field("security_approval", "Security approval reference", required=True),
            field("rollback_plan", "Rollback plan", "textarea", required=True),
        ],
        "Environment config": [
            field("environment", "Environment", "select", required=True, options=["development", "test", "staging", "production"]),
            field("configuration_area", "Configuration area", required=True),
            field("value_reference", "Secret / configuration reference", required=True),
            field("owner", "Owner", required=True),
            field("last_reviewed", "Last reviewed", "date", required=True),
            field("notes", "Non-sensitive notes", "textarea"),
        ],
    },
    "provider-marketplace": {
        "Vendor onboarding": [
            field("legal_name", "Legal entity name", required=True),
            field("provider_type", "Provider type", "select", required=True, options=["hospital", "clinic", "diagnostic", "pharmacy", "home_care", "individual", "other"]),
            field("registration_no", "Registration / licence number", required=True),
            field("tax_id", "Tax identifier", required=True),
            field("service_area", "Service area / locations", required=True),
            field("credential_status", "Credential verification", "select", required=True, options=["pending", "verified", "exception", "rejected"]),
            field("primary_contact", "Primary contact", required=True),
        ],
        "Contract": [
            field("vendor_reference", "Vendor reference", required=True),
            field("contract_no", "Contract number", required=True),
            field("effective_from", "Effective from", "date", required=True),
            field("effective_to", "Effective to", "date", required=True),
            field("commercial_terms", "Commercial terms", "textarea", required=True),
            field("document_reference", "Signed contract document", required=True),
        ],
        "SLA": [
            field("vendor_reference", "Vendor reference", required=True),
            field("service", "Covered service", required=True),
            field("response_target", "Response target", required=True),
            field("resolution_target", "Resolution / TAT target", required=True),
            field("quality_metric", "Quality metric and threshold", required=True),
            field("penalty_rule", "Exception / penalty rule", "textarea", required=True),
        ],
        "Settlement": [
            field("vendor_reference", "Vendor reference", required=True),
            field("period", "Settlement period", required=True),
            field("gross_amount", "Gross amount", "number", required=True),
            field("deductions", "Deductions", "number", required=True),
            field("net_amount", "Net payable", "number", required=True),
            field("invoice_reference", "Invoice reference", required=True),
            field("payment_due_date", "Payment due date", "date", required=True),
        ],
        "Ratings": [
            field("vendor_reference", "Vendor reference", required=True),
            field("review_period", "Review period", required=True),
            field("quality_score", "Quality score (0-100)", "number", required=True),
            field("sla_score", "SLA score (0-100)", "number", required=True),
            field("patient_feedback_score", "Patient feedback score", "number"),
            field("review_notes", "Review notes and actions", "textarea", required=True),
        ],
    },
    "mobile-apps": {
        "Patient app config": [
            field("platform", "Platform", "select", required=True, options=["android", "ios", "both"]),
            field("tenant_branding", "Branding profile", required=True),
            field("enabled_features", "Enabled patient features", "textarea", required=True),
            field("privacy_policy_version", "Privacy policy version", required=True),
            field("support_contact", "Support contact", required=True),
            field("minimum_os", "Minimum OS version", required=True),
        ],
        "Doctor app config": [
            field("platform", "Platform", "select", required=True, options=["android", "ios", "both"]),
            field("enabled_features", "Enabled clinical features", "textarea", required=True),
            field("offline_policy", "Offline data policy", "textarea", required=True),
            field("device_security", "Device security requirements", "textarea", required=True),
            field("minimum_os", "Minimum OS version", required=True),
        ],
        "Push certificates": [
            field("platform", "Platform", "select", required=True, options=["FCM", "APNS"]),
            field("credential_reference", "Secure credential reference", required=True),
            field("bundle_or_project_id", "Bundle / project identifier", required=True),
            field("environment", "Environment", "select", required=True, options=["sandbox", "production"]),
            field("expires_on", "Certificate expiry", "date"),
            field("owner", "Credential owner", required=True),
        ],
        "App versions": [
            field("platform", "Platform", "select", required=True, options=["android", "ios"]),
            field("version", "Version", required=True),
            field("build_number", "Build number", required=True),
            field("release_date", "Release date", "date", required=True),
            field("release_notes", "Release notes", "textarea", required=True),
            field("minimum_supported_version", "Minimum supported version", required=True),
            field("store_url", "Store URL", "url"),
        ],
        "Feature flags": [
            field("flag_key", "Feature flag key", required=True),
            field("audience", "Audience", "select", required=True, options=["patients", "doctors", "nurses", "all_users", "pilot_group"]),
            field("platform", "Platform", "select", required=True, options=["android", "ios", "both"]),
            field("enabled", "Enabled", "checkbox"),
            field("rollout_percentage", "Rollout percentage", "number", required=True),
            field("expiry_or_review_date", "Review date", "date", required=True),
        ],
    },
}


PATIENT_LINKED_MODULES = {
    "chronic-disease-programs",
    "physiotherapy-and-rehab",
    "post-treatment-patient-care",
    "women-child-and-specialty-care",
    "ambulance-and-transport",
    "diet-catering-and-housekeeping",
}


def fields_for(module_code: str, submodule: str) -> list[dict[str, Any]]:
    return DOMAIN_FIELD_SCHEMAS.get(module_code, {}).get(submodule, [])


def validate_domain_payload(
    module_code: str,
    submodule: str,
    payload: dict[str, Any],
    *,
    patient_id: Any = None,
) -> dict[str, Any]:
    fields = fields_for(module_code, submodule)
    if not fields:
        raise HTTPException(400, f"No operational field contract configured for {module_code} / {submodule}")
    missing = [f["label"] for f in fields if f.get("required") and payload.get(f["key"]) in (None, "", [])]
    if module_code in PATIENT_LINKED_MODULES and not patient_id:
        missing.insert(0, "Patient")
    if missing:
        raise HTTPException(422, {"message": "Required operational fields are missing", "fields": missing})
    cleaned: dict[str, Any] = {}
    for f in fields:
        key = f["key"]
        value = payload.get(key)
        if f["type"] == "number" and value not in (None, ""):
            try:
                value = float(value)
            except (TypeError, ValueError):
                raise HTTPException(422, {"message": f"{f['label']} must be numeric", "field": key})
            if value < 0:
                raise HTTPException(422, {"message": f"{f['label']} cannot be negative", "field": key})
        if f["type"] == "select" and value not in (None, "") and value not in f.get("options", []):
            raise HTTPException(422, {"message": f"Invalid value for {f['label']}", "field": key})
        if f["type"] == "checkbox":
            value = bool(value)
        if value not in (None, "") or f["type"] == "checkbox":
            cleaned[key] = value
    return cleaned

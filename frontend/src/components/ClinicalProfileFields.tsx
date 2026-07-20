export type ClinicalProfileType =
  | "emergency" | "ipd" | "nursing" | "laboratory" | "radiology"
  | "pharmacy" | "operation_theatre" | "insurance_claim";

export type ClinicalProfileValues = Record<string, string | boolean>;

type Field = {
  key: string;
  label: string;
  type?: "text" | "number" | "date" | "datetime-local" | "tel" | "textarea" | "select" | "checkbox";
  options?: string[];
  defaultValue?: string | boolean;
  min?: number;
  max?: number;
  wide?: boolean;
};

const yesNo = ["no", "yes"];

export const CLINICAL_PROFILE_FIELDS: Record<ClinicalProfileType, Field[]> = {
  emergency: [
    { key: "arrival_mode", label: "Arrival mode", type: "select", options: ["walk_in", "ambulance", "police", "inter_facility_transfer"], defaultValue: "walk_in" },
    { key: "symptom_onset", label: "Symptom onset / incident time", type: "datetime-local" },
    { key: "pain_score", label: "Pain score (0–10)", type: "number", min: 0, max: 10, defaultValue: "0" },
    { key: "airway", label: "Airway", type: "select", options: ["patent", "at_risk", "obstructed"], defaultValue: "patent" },
    { key: "breathing", label: "Breathing", type: "select", options: ["normal", "distressed", "assisted"], defaultValue: "normal" },
    { key: "circulation", label: "Circulation", type: "select", options: ["stable", "shock_suspected", "active_bleeding"], defaultValue: "stable" },
    { key: "consciousness", label: "Consciousness", type: "select", options: ["alert", "voice", "pain", "unresponsive"], defaultValue: "alert" },
    { key: "infection_risk", label: "Infection / isolation risk", type: "select", options: ["none", "suspected", "confirmed"], defaultValue: "none" },
    { key: "allergies", label: "Known allergies", defaultValue: "None known" },
    { key: "temperature_c", label: "Temperature °C", type: "number", min: 25, max: 45, defaultValue: "37" },
    { key: "pulse_bpm", label: "Pulse / minute", type: "number", min: 20, max: 250, defaultValue: "80" },
    { key: "spo2_pct", label: "SpO₂ %", type: "number", min: 50, max: 100, defaultValue: "98" },
    { key: "bp_systolic", label: "BP systolic", type: "number", min: 40, max: 300, defaultValue: "120" },
    { key: "bp_diastolic", label: "BP diastolic", type: "number", min: 20, max: 200, defaultValue: "80" },
    { key: "next_of_kin_phone", label: "Next-of-kin phone", type: "tel" },
  ],
  ipd: [
    { key: "admission_type", label: "Admission type", type: "select", options: ["emergency", "elective", "day_care", "transfer"], defaultValue: "elective" },
    { key: "admitting_provider", label: "Admitting provider" },
    { key: "admission_reason", label: "Clinical reason for admission", type: "textarea", wide: true },
    { key: "acuity", label: "Clinical acuity", type: "select", options: ["stable", "moderate", "high_dependency", "critical"], defaultValue: "stable" },
    { key: "diet_order", label: "Diet order", type: "select", options: ["regular", "diabetic", "low_salt", "renal", "npo", "liquid", "paediatric"], defaultValue: "regular" },
    { key: "fall_risk", label: "Fall risk", type: "select", options: ["low", "medium", "high"], defaultValue: "low" },
    { key: "isolation_requirement", label: "Isolation requirement", type: "select", options: ["none", "contact", "droplet", "airborne", "protective"], defaultValue: "none" },
    { key: "attendant_name", label: "Attendant / next-of-kin name" },
    { key: "attendant_phone", label: "Attendant phone", type: "tel" },
    { key: "payer_type", label: "Payer type", type: "select", options: ["self_pay", "insurance", "corporate", "government"], defaultValue: "self_pay" },
    { key: "consent_status", label: "Admission consent", type: "select", options: ["captured", "emergency_override"], defaultValue: "captured" },
    { key: "expected_length_of_stay_days", label: "Expected stay (days)", type: "number", min: 1, max: 365, defaultValue: "1" },
  ],
  nursing: [
    { key: "priority", label: "Priority", type: "select", options: ["routine", "urgent", "stat"], defaultValue: "routine" },
    { key: "shift", label: "Shift", type: "select", options: ["morning", "evening", "night"], defaultValue: "morning" },
    { key: "frequency", label: "Frequency", type: "select", options: ["once", "hourly", "four_hourly", "six_hourly", "eight_hourly", "daily", "as_needed"], defaultValue: "once" },
    { key: "care_plan_goal", label: "Care-plan goal", type: "textarea", wide: true },
    { key: "safety_risk", label: "Safety risk", type: "select", options: ["none", "fall", "pressure_injury", "aspiration", "self_harm", "wandering"], defaultValue: "none" },
    { key: "baseline_observation", label: "Baseline observation", type: "textarea", wide: true },
    { key: "escalation_instruction", label: "Escalation instruction", type: "textarea", wide: true },
  ],
  laboratory: [
    { key: "priority", label: "Order priority", type: "select", options: ["routine", "urgent", "stat"], defaultValue: "routine" },
    { key: "clinical_indication", label: "Clinical indication", type: "textarea", wide: true },
    { key: "specimen_type", label: "Specimen type", type: "select", options: ["blood", "urine", "serum", "plasma", "swab", "sputum", "stool", "tissue", "other"], defaultValue: "blood" },
    { key: "fasting_status", label: "Fasting status", type: "select", options: ["not_required", "confirmed", "not_confirmed"], defaultValue: "not_required" },
    { key: "collection_location", label: "Collection location", type: "select", options: ["outpatient", "ward", "emergency", "icu", "home_collection"], defaultValue: "outpatient" },
    { key: "infection_risk", label: "Infection risk", type: "select", options: ["none", "suspected", "confirmed"], defaultValue: "none" },
    { key: "billing_status", label: "Billing clearance", type: "select", options: ["cleared", "credit_authorised", "emergency_override"], defaultValue: "cleared" },
  ],
  radiology: [
    { key: "priority", label: "Order priority", type: "select", options: ["routine", "urgent", "stat"], defaultValue: "routine" },
    { key: "clinical_indication", label: "Clinical indication", type: "textarea", wide: true },
    { key: "body_part", label: "Body part / region" },
    { key: "laterality", label: "Laterality", type: "select", options: ["not_applicable", "left", "right", "bilateral"], defaultValue: "not_applicable" },
    { key: "contrast_required", label: "Contrast required", type: "select", options: yesNo, defaultValue: "no" },
    { key: "pregnancy_status", label: "Pregnancy status", type: "select", options: ["not_applicable", "not_pregnant", "pregnant", "unknown"], defaultValue: "not_applicable" },
    { key: "renal_risk", label: "Renal impairment risk", type: "select", options: ["none", "known", "unknown"], defaultValue: "none" },
    { key: "sedation_required", label: "Sedation required", type: "select", options: yesNo, defaultValue: "no" },
    { key: "transport_mode", label: "Patient transport", type: "select", options: ["walking", "wheelchair", "stretcher", "bed", "ambulance"], defaultValue: "walking" },
  ],
  pharmacy: [
    { key: "prescription_source", label: "Prescription source", type: "select", options: ["electronic", "paper", "emergency_verbal"], defaultValue: "electronic" },
    { key: "dose", label: "Dose" },
    { key: "frequency", label: "Frequency" },
    { key: "duration_days", label: "Duration (days)", type: "number", min: 1, max: 365, defaultValue: "1" },
    { key: "route", label: "Route", type: "select", options: ["oral", "intravenous", "intramuscular", "subcutaneous", "topical", "inhaled", "other"], defaultValue: "oral" },
    { key: "batch_no", label: "Batch number" },
    { key: "expiry_date", label: "Expiry date", type: "date" },
    { key: "allergy_review", label: "Allergy review", type: "select", options: ["completed_no_conflict", "completed_alert_resolved"], defaultValue: "completed_no_conflict" },
    { key: "pharmacist_check", label: "Pharmacist clinical check", type: "select", options: ["completed", "override_documented"], defaultValue: "completed" },
    { key: "counselling_status", label: "Patient counselling", type: "select", options: ["completed", "declined", "not_applicable"], defaultValue: "completed" },
  ],
  operation_theatre: [
    { key: "case_type", label: "Case type", type: "select", options: ["elective", "emergency", "day_care"], defaultValue: "elective" },
    { key: "anaesthesia_type", label: "Anaesthesia", type: "select", options: ["general", "regional", "local", "sedation", "none"], defaultValue: "general" },
    { key: "pre_op_diagnosis", label: "Pre-operative diagnosis", type: "textarea", wide: true },
    { key: "laterality", label: "Site / laterality", type: "select", options: ["not_applicable", "left", "right", "bilateral"], defaultValue: "not_applicable" },
    { key: "expected_duration_minutes", label: "Expected duration (minutes)", type: "number", min: 5, max: 1440, defaultValue: "60" },
    { key: "blood_requirement", label: "Blood requirement", type: "select", options: ["not_required", "group_and_save", "crossmatch_ready"], defaultValue: "not_required" },
    { key: "implant_planned", label: "Implant planned", type: "select", options: yesNo, defaultValue: "no" },
    { key: "infection_risk", label: "Infection risk", type: "select", options: ["standard", "contact", "airborne", "blood_borne"], defaultValue: "standard" },
    { key: "consent_status", label: "Procedure consent", type: "select", options: ["signed", "emergency_override"], defaultValue: "signed" },
  ],
  insurance_claim: [
    { key: "claim_type", label: "Claim type", type: "select", options: ["cashless", "reimbursement", "government_scheme"], defaultValue: "cashless" },
    { key: "diagnosis_codes", label: "Diagnosis codes", type: "textarea", wide: true },
    { key: "procedure_codes", label: "Procedure / service codes", type: "textarea", wide: true },
    { key: "service_from", label: "Service from", type: "date" },
    { key: "service_to", label: "Service to", type: "date" },
    { key: "preauth_required", label: "Pre-authorisation required", type: "select", options: yesNo, defaultValue: "yes" },
    { key: "document_status", label: "Document checklist", type: "select", options: ["complete", "pending_clinical", "pending_financial", "pending_patient"], defaultValue: "complete" },
    { key: "submission_deadline", label: "Submission deadline", type: "date" },
    { key: "claim_contact_phone", label: "Claim contact phone", type: "tel" },
  ],
};

export function createClinicalProfile(type: ClinicalProfileType): ClinicalProfileValues {
  return Object.fromEntries(CLINICAL_PROFILE_FIELDS[type].map((field) => [field.key, field.defaultValue ?? (field.type === "checkbox" ? false : "")]));
}

export default function ClinicalProfileFields({ type, values, onChange }: {
  type: ClinicalProfileType;
  values: ClinicalProfileValues;
  onChange: (values: ClinicalProfileValues) => void;
}) {
  const set = (key: string, value: string | boolean) => onChange({ ...values, [key]: value });
  return (
    <fieldset className="clinical-profile">
      <legend>Required clinical and operational details</legend>
      <div className="domain-form-grid">
        {CLINICAL_PROFILE_FIELDS[type].map((field) => (
          <div className={`field ${field.wide || field.type === "textarea" ? "field--wide" : ""}`} key={field.key}>
            {field.type === "checkbox" ? (
              <label className="checkbox-field"><input type="checkbox" checked={Boolean(values[field.key])} onChange={(e) => set(field.key, e.target.checked)} /><span>{field.label} *</span></label>
            ) : (
              <>
                <label>{field.label} *</label>
                {field.type === "select" ? (
                  <select required value={String(values[field.key] ?? "")} onChange={(e) => set(field.key, e.target.value)}>{field.options?.map((option) => <option key={option} value={option}>{option.replaceAll("_", " ")}</option>)}</select>
                ) : field.type === "textarea" ? (
                  <textarea required rows={2} value={String(values[field.key] ?? "")} onChange={(e) => set(field.key, e.target.value)} />
                ) : (
                  <input required type={field.type || "text"} min={field.min} max={field.max} value={String(values[field.key] ?? "")} onChange={(e) => set(field.key, e.target.value)} />
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </fieldset>
  );
}

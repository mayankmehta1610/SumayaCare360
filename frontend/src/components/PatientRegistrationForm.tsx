import { FormEvent, useEffect, useState } from "react";
import { api } from "../api/client";

type Option = { code: string; name: string };
type CreatedPatient = { id: string; mrn: string; first_name: string; last_name: string };

type Props = { onCreated: (patient: CreatedPatient) => Promise<void> | void };

const emptyForm = {
  salutation: "",
  first_name: "",
  middle_name: "",
  last_name: "",
  date_of_birth: "",
  gender_code: "",
  blood_group: "",
  marital_status: "",
  nationality_code: "IN",
  preferred_language: "English",
  phone: "",
  alternate_phone: "",
  email: "",
  address_line_1: "",
  address_line_2: "",
  city: "",
  state: "",
  postal_code: "",
  country_code: "IN",
  occupation: "",
  id_type: "aadhaar",
  national_id: "",
  emergency_name: "",
  emergency_relation: "",
  emergency_phone: "",
  payer_type: "self_pay",
  payer_code: "",
  policy_no: "",
  allergies: "No known allergies",
  chronic_conditions: "None known",
  disability_or_support_needs: "None",
  registration_source: "walk_in",
  communication_preference: "sms",
  privacy_consent: false,
  treatment_consent: false,
  communication_consent: false,
};

export default function PatientRegistrationForm({ onCreated }: Props) {
  const [form, setForm] = useState(emptyForm);
  const [genders, setGenders] = useState<Option[]>([]);
  const [countries, setCountries] = useState<Option[]>([]);
  const [payers, setPayers] = useState<Option[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      api<Option[]>("/masters/genders"),
      api<Option[]>("/masters/countries"),
      api<Option[]>("/masters/insurance-payers").catch(() => []),
    ]).then(([genderRows, countryRows, payerRows]) => {
      setGenders(genderRows);
      setCountries(countryRows);
      setPayers(payerRows);
    }).catch((err) => setError(err.message));
  }, []);

  const set = (key: keyof typeof emptyForm, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!form.privacy_consent || !form.treatment_consent) {
      setError("Privacy notice acknowledgement and general treatment consent are required.");
      return;
    }
    if (form.payer_type === "insurance" && (!form.payer_code || !form.policy_no)) {
      setError("Payer and policy number are required for an insured patient.");
      return;
    }
    setSaving(true);
    try {
      const created = await api<CreatedPatient>("/patients", {
        method: "POST",
        body: JSON.stringify({
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          date_of_birth: form.date_of_birth,
          gender_code: form.gender_code,
          phone: form.phone.trim(),
          email: form.email.trim() || undefined,
          address: [form.address_line_1, form.address_line_2, form.city, form.state, form.postal_code, form.country_code].filter(Boolean).join(", "),
          blood_group: form.blood_group || undefined,
          national_id: form.national_id.trim(),
          emergency_contact: {
            name: form.emergency_name.trim(),
            relation: form.emergency_relation.trim(),
            phone: form.emergency_phone.trim(),
          },
          registration_profile: {
            salutation: form.salutation,
            middle_name: form.middle_name.trim(),
            marital_status: form.marital_status,
            nationality_code: form.nationality_code,
            preferred_language: form.preferred_language,
            alternate_phone: form.alternate_phone.trim(),
            address_line_1: form.address_line_1.trim(),
            address_line_2: form.address_line_2.trim(),
            city: form.city.trim(),
            state: form.state.trim(),
            postal_code: form.postal_code.trim(),
            country_code: form.country_code,
            occupation: form.occupation.trim(),
            id_type: form.id_type,
            payer_type: form.payer_type,
            payer_code: form.payer_code,
            policy_no: form.policy_no.trim(),
            allergies: form.allergies.trim(),
            chronic_conditions: form.chronic_conditions.trim(),
            disability_or_support_needs: form.disability_or_support_needs.trim(),
            registration_source: form.registration_source,
            communication_preference: form.communication_preference,
            consent: {
              privacy_notice: form.privacy_consent,
              general_treatment: form.treatment_consent,
              communication: form.communication_consent,
              captured_at: new Date().toISOString(),
            },
          },
        }),
      });
      setForm(emptyForm);
      await onCreated(created);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card registration-form" onSubmit={submit}>
      <div className="form-heading">
        <div><span className="eyebrow">New medical record</span><h2>Register patient</h2></div>
        <span className="required-note">* Required</span>
      </div>
      {error && <div className="error">{error}</div>}

      <fieldset>
        <legend>Identity and demographics</legend>
        <div className="domain-form-grid">
          <div className="field"><label>Salutation</label><select value={form.salutation} onChange={(e) => set("salutation", e.target.value)}><option value="">Select</option>{["Mr", "Ms", "Mrs", "Dr", "Master", "Baby"].map((v) => <option key={v}>{v}</option>)}</select></div>
          <div className="field"><label>First name *</label><input required value={form.first_name} onChange={(e) => set("first_name", e.target.value)} /></div>
          <div className="field"><label>Middle name</label><input value={form.middle_name} onChange={(e) => set("middle_name", e.target.value)} /></div>
          <div className="field"><label>Last name *</label><input required value={form.last_name} onChange={(e) => set("last_name", e.target.value)} /></div>
          <div className="field"><label>Date of birth *</label><input required type="date" max={new Date().toISOString().slice(0, 10)} value={form.date_of_birth} onChange={(e) => set("date_of_birth", e.target.value)} /></div>
          <div className="field"><label>Gender *</label><select required value={form.gender_code} onChange={(e) => set("gender_code", e.target.value)}><option value="">Select</option>{genders.map((v) => <option key={v.code} value={v.code}>{v.name}</option>)}</select></div>
          <div className="field"><label>Blood group</label><select value={form.blood_group} onChange={(e) => set("blood_group", e.target.value)}><option value="">Unknown</option>{["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((v) => <option key={v}>{v}</option>)}</select></div>
          <div className="field"><label>Marital status</label><select value={form.marital_status} onChange={(e) => set("marital_status", e.target.value)}><option value="">Select</option>{["single", "married", "divorced", "widowed", "other"].map((v) => <option key={v}>{v}</option>)}</select></div>
          <div className="field"><label>Nationality *</label><select required value={form.nationality_code} onChange={(e) => set("nationality_code", e.target.value)}>{countries.map((v) => <option key={v.code} value={v.code}>{v.name}</option>)}</select></div>
          <div className="field"><label>Preferred language *</label><input required value={form.preferred_language} onChange={(e) => set("preferred_language", e.target.value)} /></div>
          <div className="field"><label>ID type *</label><select required value={form.id_type} onChange={(e) => set("id_type", e.target.value)}>{["aadhaar", "passport", "driving_licence", "voter_id", "birth_certificate", "other"].map((v) => <option key={v} value={v}>{v.replaceAll("_", " ")}</option>)}</select></div>
          <div className="field"><label>ID number *</label><input required minLength={4} value={form.national_id} onChange={(e) => set("national_id", e.target.value)} /></div>
        </div>
      </fieldset>

      <fieldset>
        <legend>Contact and address</legend>
        <div className="domain-form-grid">
          <div className="field"><label>Mobile number *</label><input required type="tel" minLength={8} value={form.phone} onChange={(e) => set("phone", e.target.value)} /></div>
          <div className="field"><label>Alternate phone</label><input type="tel" value={form.alternate_phone} onChange={(e) => set("alternate_phone", e.target.value)} /></div>
          <div className="field"><label>Email</label><input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></div>
          <div className="field"><label>Occupation</label><input value={form.occupation} onChange={(e) => set("occupation", e.target.value)} /></div>
          <div className="field field--wide"><label>Address line 1 *</label><input required value={form.address_line_1} onChange={(e) => set("address_line_1", e.target.value)} /></div>
          <div className="field field--wide"><label>Address line 2</label><input value={form.address_line_2} onChange={(e) => set("address_line_2", e.target.value)} /></div>
          <div className="field"><label>City / district *</label><input required value={form.city} onChange={(e) => set("city", e.target.value)} /></div>
          <div className="field"><label>State *</label><input required value={form.state} onChange={(e) => set("state", e.target.value)} /></div>
          <div className="field"><label>Postal code *</label><input required value={form.postal_code} onChange={(e) => set("postal_code", e.target.value)} /></div>
          <div className="field"><label>Country *</label><select required value={form.country_code} onChange={(e) => set("country_code", e.target.value)}>{countries.map((v) => <option key={v.code} value={v.code}>{v.name}</option>)}</select></div>
        </div>
      </fieldset>

      <fieldset>
        <legend>Emergency contact and payer</legend>
        <div className="domain-form-grid">
          <div className="field"><label>Emergency contact name *</label><input required value={form.emergency_name} onChange={(e) => set("emergency_name", e.target.value)} /></div>
          <div className="field"><label>Relationship *</label><input required value={form.emergency_relation} onChange={(e) => set("emergency_relation", e.target.value)} /></div>
          <div className="field"><label>Emergency contact phone *</label><input required type="tel" minLength={8} value={form.emergency_phone} onChange={(e) => set("emergency_phone", e.target.value)} /></div>
          <div className="field"><label>Payer type *</label><select required value={form.payer_type} onChange={(e) => set("payer_type", e.target.value)}>{["self_pay", "insurance", "corporate", "government"].map((v) => <option key={v} value={v}>{v.replaceAll("_", " ")}</option>)}</select></div>
          {form.payer_type === "insurance" && <><div className="field"><label>Insurance payer *</label><select required value={form.payer_code} onChange={(e) => set("payer_code", e.target.value)}><option value="">Select</option>{payers.map((v) => <option key={v.code} value={v.code}>{v.name}</option>)}</select></div><div className="field"><label>Policy / member number *</label><input required value={form.policy_no} onChange={(e) => set("policy_no", e.target.value)} /></div></>}
        </div>
      </fieldset>

      <fieldset>
        <legend>Clinical alerts and consent</legend>
        <div className="domain-form-grid">
          <div className="field field--wide"><label>Allergies *</label><textarea required rows={2} value={form.allergies} onChange={(e) => set("allergies", e.target.value)} /></div>
          <div className="field field--wide"><label>Chronic conditions *</label><textarea required rows={2} value={form.chronic_conditions} onChange={(e) => set("chronic_conditions", e.target.value)} /></div>
          <div className="field field--wide"><label>Disability, accessibility, or support needs *</label><textarea required rows={2} value={form.disability_or_support_needs} onChange={(e) => set("disability_or_support_needs", e.target.value)} /></div>
          <div className="field"><label>Registration source *</label><select required value={form.registration_source} onChange={(e) => set("registration_source", e.target.value)}>{["walk_in", "appointment", "emergency", "referral", "camp", "online"].map((v) => <option key={v} value={v}>{v.replaceAll("_", " ")}</option>)}</select></div>
          <div className="field"><label>Communication preference *</label><select required value={form.communication_preference} onChange={(e) => set("communication_preference", e.target.value)}>{["sms", "whatsapp", "email", "phone", "none"].map((v) => <option key={v}>{v}</option>)}</select></div>
        </div>
        <div className="consent-grid">
          <label className="checkbox-field"><input required type="checkbox" checked={form.privacy_consent} onChange={(e) => set("privacy_consent", e.target.checked)} /><span>Privacy notice acknowledged *</span></label>
          <label className="checkbox-field"><input required type="checkbox" checked={form.treatment_consent} onChange={(e) => set("treatment_consent", e.target.checked)} /><span>General treatment consent captured *</span></label>
          <label className="checkbox-field"><input type="checkbox" checked={form.communication_consent} onChange={(e) => set("communication_consent", e.target.checked)} /><span>Consent for appointment and care communications</span></label>
        </div>
      </fieldset>

      <div className="form-actions"><button type="submit" disabled={saving}>{saving ? "Registering…" : "Register patient and create MRN"}</button></div>
    </form>
  );
}

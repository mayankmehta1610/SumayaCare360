import { FormEvent, useEffect, useState } from "react";
import { api } from "../api/client";

export default function EncountersPage() {
  const [encounters, setEncounters] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [diseases, setDiseases] = useState<any[]>([]);
  const [medicines, setMedicines] = useState<any[]>([]);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ patient_id: "", provider_id: "", chief_complaint: "" });
  const [vitals, setVitals] = useState({ bp_systolic: 120, bp_diastolic: 80, pulse: 72, temperature_c: 36.8, spo2: 98 });
  const [note, setNote] = useState("");
  const [diagnosis, setDiagnosis] = useState({ disease_code: "", disease_name: "" });
  const [rxMed, setRxMed] = useState("");

  async function load() {
    const [e, p, pr, d, m] = await Promise.all([
      api<any[]>("/encounters"),
      api<any[]>("/patients"),
      api<any[]>("/providers"),
      api<any[]>("/masters/diseases"),
      api<any[]>("/masters/medicines"),
    ]);
    setEncounters(e);
    setPatients(p);
    setProviders(pr);
    setDiseases(d);
    setMedicines(m);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function startEncounter(e: FormEvent) {
    e.preventDefault();
    const res = await api<{ id: string }>("/encounters", { method: "POST", body: JSON.stringify({ ...form, encounter_type: "opd" }) });
    setSelected(res.id);
    setMsg("Encounter started");
    await load();
  }

  async function saveVitals() {
    if (!selected) return;
    await api(`/encounters/${selected}/vitals`, { method: "POST", body: JSON.stringify(vitals) });
    setMsg("Vitals saved");
  }

  async function saveNote() {
    if (!selected) return;
    await api(`/encounters/${selected}/notes`, { method: "POST", body: JSON.stringify({ content: note, template_code: "SOAP" }) });
    setMsg("Clinical note saved");
  }

  async function saveDiagnosis() {
    if (!selected) return;
    const d = diseases.find((x) => x.code === diagnosis.disease_code);
    await api(`/encounters/${selected}/diagnoses`, {
      method: "POST",
      body: JSON.stringify({ disease_code: diagnosis.disease_code, disease_name: d?.name || diagnosis.disease_name, is_primary: true }),
    });
    setMsg("Diagnosis linked from disease master");
  }

  async function saveRx() {
    if (!selected || !rxMed) return;
    const med = medicines.find((m) => m.code === rxMed);
    await api(`/encounters/${selected}/prescriptions`, {
      method: "POST",
      body: JSON.stringify({
        notes: "Take as directed",
        lines: [{ medicine_code: med.code, medicine_name: med.name, dose: med.strength, frequency: "BD", duration: "5 days" }],
      }),
    });
    setMsg("eRx issued");
  }

  async function closeEnc() {
    if (!selected) return;
    await api(`/encounters/${selected}/close?assessment=Stable&plan=Follow-up`, { method: "PATCH" });
    setMsg("Encounter closed");
    await load();
  }

  return (
    <div>
      <h1 className="page-title">OPD clinical workspace</h1>
      {error && <div className="error">{error}</div>}
      {msg && <div className="success">{msg}</div>}
      <div className="grid-2">
        <form className="card" onSubmit={startEncounter}>
          <h3 style={{ marginTop: 0 }}>Start encounter</h3>
          <div className="field">
            <label>Patient</label>
            <select required value={form.patient_id} onChange={(e) => setForm({ ...form, patient_id: e.target.value })}>
              <option value="">Select</option>
              {patients.map((p) => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Provider</label>
            <select required value={form.provider_id} onChange={(e) => setForm({ ...form, provider_id: e.target.value })}>
              <option value="">Select</option>
              {providers.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Chief complaint</label>
            <input value={form.chief_complaint} onChange={(e) => setForm({ ...form, chief_complaint: e.target.value })} />
          </div>
          <button type="submit">Start</button>
        </form>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Active encounter</h3>
          <div className="field">
            <label>Encounter</label>
            <select value={selected} onChange={(e) => setSelected(e.target.value)}>
              <option value="">Select</option>
              {encounters.map((e) => <option key={e.id} value={e.id}>{e.id.slice(0, 8)} · {e.status} · {e.chief_complaint || "—"}</option>)}
            </select>
          </div>
          <div className="actions">
            <button type="button" onClick={saveVitals} disabled={!selected}>Save vitals</button>
            <button type="button" className="secondary" onClick={saveNote} disabled={!selected || !note}>Save note</button>
            <button type="button" className="secondary" onClick={saveDiagnosis} disabled={!selected || !diagnosis.disease_code}>Add diagnosis</button>
            <button type="button" className="secondary" onClick={saveRx} disabled={!selected || !rxMed}>Issue eRx</button>
            <button type="button" className="secondary" onClick={closeEnc} disabled={!selected}>Close</button>
          </div>
          <div className="field" style={{ marginTop: "1rem" }}>
            <label>Clinical note</label>
            <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="field">
            <label>Diagnosis (disease master)</label>
            <select value={diagnosis.disease_code} onChange={(e) => setDiagnosis({ disease_code: e.target.value, disease_name: "" })}>
              <option value="">Select</option>
              {diseases.map((d) => <option key={d.code} value={d.code}>{d.name} ({d.icd_code})</option>)}
            </select>
          </div>
          <div className="field">
            <label>Medicine (medicine master)</label>
            <select value={rxMed} onChange={(e) => setRxMed(e.target.value)}>
              <option value="">Select</option>
              {medicines.map((m) => <option key={m.code} value={m.code}>{m.name} {m.strength}</option>)}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

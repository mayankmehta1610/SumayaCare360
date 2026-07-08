import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";

type EncounterDetail = {
  id: string;
  status: string;
  chief_complaint: string;
  assessment: string;
  plan: string;
  patient: { name: string; mrn: string } | null;
  provider: { name: string } | null;
  vitals: { id: string; bp: string; pulse: number; spo2: number; temp: number | null }[];
  notes: { id: string; content: string; note_type: string }[];
  diagnoses: { disease_code: string; disease_name: string }[];
  prescriptions: { id: string; status: string; lines: { medicine_name: string; dose: string; frequency: string; duration: string }[] }[];
  invoice: { id: string; invoice_no: string; total: number; status: string } | null;
};

export default function EncountersPage() {
  const [encounters, setEncounters] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [diseases, setDiseases] = useState<any[]>([]);
  const [medicines, setMedicines] = useState<any[]>([]);
  const [selected, setSelected] = useState("");
  const [detail, setDetail] = useState<EncounterDetail | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ patient_id: "", provider_id: "", chief_complaint: "" });
  const [vitals, setVitals] = useState({ bp_systolic: 120, bp_diastolic: 80, pulse: 72, temperature_c: 36.8, spo2: 98 });
  const [note, setNote] = useState("");
  const [diagnosis, setDiagnosis] = useState({ disease_code: "", disease_name: "" });
  const [rxMed, setRxMed] = useState("");
  const [discharge, setDischarge] = useState({ assessment: "Stable", plan: "Follow-up" });

  async function loadList() {
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

  async function loadDetail(id: string) {
    if (!id) { setDetail(null); return; }
    const d = await api<EncounterDetail>(`/encounters/${id}`);
    setDetail(d);
  }

  useEffect(() => {
    loadList().catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    loadDetail(selected).catch((err) => setError(err.message));
  }, [selected]);

  async function startEncounter(e: FormEvent) {
    e.preventDefault();
    try {
      const res = await api<{ id: string }>("/encounters", { method: "POST", body: JSON.stringify({ ...form, encounter_type: "opd" }) });
      setSelected(res.id);
      setMsg("Encounter started");
      await loadList();
      await loadDetail(res.id);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function saveVitals() {
    if (!selected) return;
    try {
      await api(`/encounters/${selected}/vitals`, { method: "POST", body: JSON.stringify(vitals) });
      setMsg("Vitals saved");
      await loadDetail(selected);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function saveNote() {
    if (!selected) return;
    try {
      await api(`/encounters/${selected}/notes`, { method: "POST", body: JSON.stringify({ content: note, template_code: "SOAP" }) });
      setNote("");
      setMsg("Clinical note saved");
      await loadDetail(selected);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function saveDiagnosis() {
    if (!selected) return;
    try {
      const d = diseases.find((x) => x.code === diagnosis.disease_code);
      await api(`/encounters/${selected}/diagnoses`, {
        method: "POST",
        body: JSON.stringify({ disease_code: diagnosis.disease_code, disease_name: d?.name || diagnosis.disease_name, is_primary: true }),
      });
      setDiagnosis({ disease_code: "", disease_name: "" });
      setMsg("Diagnosis saved");
      await loadDetail(selected);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function saveRx() {
    if (!selected || !rxMed) return;
    try {
      const med = medicines.find((m) => m.code === rxMed);
      await api(`/encounters/${selected}/prescriptions`, {
        method: "POST",
        body: JSON.stringify({
          notes: "Take as directed",
          lines: [{ medicine_code: med.code, medicine_name: med.name, dose: med.strength, frequency: "BD", duration: "5 days" }],
        }),
      });
      setRxMed("");
      setMsg("Prescription issued and saved");
      await loadDetail(selected);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function dischargeEnc() {
    if (!selected) return;
    try {
      const res = await api<{ invoice: { invoice_no: string; total: number } }>(
        `/encounters/${selected}/discharge`,
        { method: "POST", body: JSON.stringify(discharge) },
      );
      setMsg(`Discharged — invoice ${res.invoice.invoice_no} (₹${res.invoice.total})`);
      await loadList();
      await loadDetail(selected);
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h1 className="page-title">OPD clinical workspace</h1>
      <p className="muted">All clinical data persists. Discharge auto-generates billing. <Link to="/care-journey">Use Care Journey</Link> for guided flow.</p>
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
          {detail && (
            <p className="muted">{detail.patient?.name} ({detail.patient?.mrn}) · Dr. {detail.provider?.name} · <span className="badge">{detail.status}</span></p>
          )}
          <div className="actions">
            <button type="button" onClick={saveVitals} disabled={!selected || detail?.status === "closed"}>Save vitals</button>
            <button type="button" className="secondary" onClick={saveNote} disabled={!selected || !note || detail?.status === "closed"}>Save note</button>
            <button type="button" className="secondary" onClick={saveDiagnosis} disabled={!selected || !diagnosis.disease_code || detail?.status === "closed"}>Add diagnosis</button>
            <button type="button" className="secondary" onClick={saveRx} disabled={!selected || !rxMed || detail?.status === "closed"}>Issue eRx</button>
          </div>
          {detail?.status !== "closed" && (
            <div style={{ marginTop: "1rem", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
              <div className="field">
                <label>Assessment (discharge)</label>
                <input value={discharge.assessment} onChange={(e) => setDischarge({ ...discharge, assessment: e.target.value })} />
              </div>
              <div className="field">
                <label>Plan</label>
                <input value={discharge.plan} onChange={(e) => setDischarge({ ...discharge, plan: e.target.value })} />
              </div>
              <button type="button" onClick={dischargeEnc} disabled={!selected}>Discharge & bill</button>
            </div>
          )}
          {detail?.invoice && (
            <p className="success" style={{ marginTop: "1rem" }}>Invoice {detail.invoice.invoice_no} — ₹{detail.invoice.total} ({detail.invoice.status})</p>
          )}
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

      {detail && (
        <div className="card" style={{ marginTop: "1rem" }}>
          <h3 style={{ marginTop: 0 }}>Saved chart — encounter {selected.slice(0, 8)}</h3>
          <div className="grid-2">
            <div>
              <h4>Vitals ({detail.vitals.length})</h4>
              <ul>{detail.vitals.map((v) => <li key={v.id}>BP {v.bp} · Pulse {v.pulse} · SpO2 {v.spo2}% · Temp {v.temp ?? "—"}°C</li>)}</ul>
              <h4>Notes ({detail.notes.length})</h4>
              <ul>{detail.notes.map((n) => <li key={n.id}>{n.content}</li>)}</ul>
            </div>
            <div>
              <h4>Diagnoses ({detail.diagnoses.length})</h4>
              <ul>{detail.diagnoses.map((d, i) => <li key={i}>{d.disease_name} ({d.disease_code})</li>)}</ul>
              <h4>Prescriptions ({detail.prescriptions.length})</h4>
              {detail.prescriptions.map((rx) => (
                <div key={rx.id}>
                  <strong>{rx.status}</strong>
                  <ul>{rx.lines.map((l, i) => <li key={i}>{l.medicine_name} — {l.dose} {l.frequency} × {l.duration}</li>)}</ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";

type Chart = {
  patient: { id: string; mrn: string; name: string };
  appointments: { id: string; queue_token: string; status: string; scheduled_at: string; mode: string }[];
  encounters: { id: string; status: string; chief_complaint: string }[];
  invoices: { id: string; invoice_no: string; total: number; status: string; encounter_id: string | null }[];
  ipd_admissions: { id: string; admission_no: string; bed_code: string; status: string }[];
};

type EncounterDetail = {
  id: string;
  status: string;
  chief_complaint: string;
  assessment: string;
  plan: string;
  vitals: { id: string; bp: string; pulse: number; spo2: number; temp: number | null }[];
  notes: { id: string; content: string; note_type: string }[];
  diagnoses: { disease_code: string; disease_name: string; is_primary: boolean }[];
  prescriptions: { id: string; status: string; notes: string; lines: { medicine_name: string; dose: string; frequency: string; duration: string }[] }[];
  invoice: { id: string; invoice_no: string; total: number; status: string } | null;
};

const STEPS = ["Patient", "Appointment", "Encounter", "Clinical", "Discharge & Pay"];

export default function CareJourneyPage() {
  const [step, setStep] = useState(0);
  const [patients, setPatients] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [diseases, setDiseases] = useState<any[]>([]);
  const [medicines, setMedicines] = useState<any[]>([]);
  const [patientId, setPatientId] = useState("");
  const [appointmentId, setAppointmentId] = useState("");
  const [encounterId, setEncounterId] = useState("");
  const [chart, setChart] = useState<Chart | null>(null);
  const [detail, setDetail] = useState<EncounterDetail | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [apptForm, setApptForm] = useState({ provider_id: "", scheduled_at: "", mode: "in_person", reason: "" });
  const [vitals, setVitals] = useState({ bp_systolic: 120, bp_diastolic: 80, pulse: 72, temperature_c: 36.8, spo2: 98 });
  const [note, setNote] = useState("");
  const [diagnosisCode, setDiagnosisCode] = useState("");
  const [rxMed, setRxMed] = useState("");
  const [discharge, setDischarge] = useState({ assessment: "Stable", plan: "Follow-up in 1 week" });

  async function loadMasters() {
    const [p, pr, d, m] = await Promise.all([
      api<any[]>("/patients"),
      api<any[]>("/providers"),
      api<any[]>("/masters/diseases"),
      api<any[]>("/masters/medicines"),
    ]);
    setPatients(p);
    setProviders(pr);
    setDiseases(d);
    setMedicines(m);
  }

  async function loadChart(pid: string) {
    const c = await api<Chart>(`/patients/${pid}/chart`);
    setChart(c);
    return c;
  }

  async function loadEncounterDetail(eid: string) {
    const d = await api<EncounterDetail>(`/encounters/${eid}`);
    setDetail(d);
    if (d.invoice) setStep(4);
    return d;
  }

  useEffect(() => {
    loadMasters().catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (patientId) loadChart(patientId).catch((e) => setError(e.message));
  }, [patientId]);

  useEffect(() => {
    if (encounterId) loadEncounterDetail(encounterId).catch((e) => setError(e.message));
  }, [encounterId]);

  async function bookAppointment(e: FormEvent) {
    e.preventDefault();
    const res = await api<{ id: string }>("/appointments", {
      method: "POST",
      body: JSON.stringify({
        patient_id: patientId,
        ...apptForm,
        scheduled_at: new Date(apptForm.scheduled_at).toISOString(),
      }),
    });
    setAppointmentId(res.id);
    setMsg(`Appointment booked — token will be assigned`);
    await loadChart(patientId);
    setStep(2);
  }

  async function startEncounter() {
    let eid = encounterId;
    if (appointmentId) {
      const res = await api<{ id: string }>(`/appointments/${appointmentId}/start-encounter`, { method: "POST" });
      eid = res.id;
    } else {
      const res = await api<{ id: string }>("/encounters", {
        method: "POST",
        body: JSON.stringify({
          patient_id: patientId,
          provider_id: apptForm.provider_id || providers[0]?.id,
          chief_complaint: apptForm.reason || "Walk-in",
          encounter_type: "opd",
        }),
      });
      eid = res.id;
    }
    setEncounterId(eid);
    setMsg("Encounter started — document clinical data below");
    setStep(3);
    await loadEncounterDetail(eid);
    await loadChart(patientId);
  }

  async function saveVitals() {
    await api(`/encounters/${encounterId}/vitals`, { method: "POST", body: JSON.stringify(vitals) });
    setMsg("Vitals saved");
    await loadEncounterDetail(encounterId);
  }

  async function saveNote() {
    await api(`/encounters/${encounterId}/notes`, { method: "POST", body: JSON.stringify({ content: note, template_code: "SOAP" }) });
    setNote("");
    setMsg("Clinical note saved");
    await loadEncounterDetail(encounterId);
  }

  async function saveDiagnosis() {
    const d = diseases.find((x) => x.code === diagnosisCode);
    await api(`/encounters/${encounterId}/diagnoses`, {
      method: "POST",
      body: JSON.stringify({ disease_code: diagnosisCode, disease_name: d?.name || diagnosisCode, is_primary: true }),
    });
    setDiagnosisCode("");
    setMsg("Diagnosis saved");
    await loadEncounterDetail(encounterId);
  }

  async function saveRx() {
    const med = medicines.find((m) => m.code === rxMed);
    if (!med) return;
    await api(`/encounters/${encounterId}/prescriptions`, {
      method: "POST",
      body: JSON.stringify({
        notes: "Take as directed",
        lines: [{ medicine_code: med.code, medicine_name: med.name, dose: med.strength, frequency: "BD", duration: "5 days" }],
      }),
    });
    setRxMed("");
    setMsg("Prescription issued and saved");
    await loadEncounterDetail(encounterId);
  }

  async function dischargeAndBill() {
    const res = await api<{ invoice: { id: string; invoice_no: string; total: number; status: string } }>(
      `/encounters/${encounterId}/discharge`,
      { method: "POST", body: JSON.stringify(discharge) },
    );
    setMsg(`Discharged — invoice ${res.invoice.invoice_no} for ₹${res.invoice.total}`);
    setStep(4);
    await loadEncounterDetail(encounterId);
    await loadChart(patientId);
  }

  async function payInvoice() {
    if (!detail?.invoice) return;
    await api("/billing/payments", {
      method: "POST",
      body: JSON.stringify({
        invoice_id: detail.invoice.id,
        amount: detail.invoice.total,
        gateway_token_ref: `tok_${crypto.randomUUID()}`,
        masked_last4: "4242",
        gateway: "stub",
      }),
    });
    setMsg("Payment recorded — visit complete");
    await loadEncounterDetail(encounterId);
    await loadChart(patientId);
  }

  return (
    <div>
      <h1 className="page-title">Care journey — end to end</h1>
      <p className="muted">Register → Appointment → Encounter → Clinical chart → Discharge & billing → Payment. All data persists to the database.</p>
      {error && <div className="error">{error}</div>}
      {msg && <div className="success">{msg}</div>}

      <div className="card" style={{ marginBottom: "1rem" }}>
        <div className="actions" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
          {STEPS.map((s, i) => (
            <button key={s} type="button" className={step === i ? "" : "secondary"} onClick={() => setStep(i)} disabled={i > 0 && !patientId}>
              {i + 1}. {s}
            </button>
          ))}
        </div>
      </div>

      {step === 0 && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Select patient</h3>
          <div className="field">
            <label>Patient</label>
            <select value={patientId} onChange={(e) => setPatientId(e.target.value)}>
              <option value="">Select or register in Patients module</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.mrn} — {p.first_name} {p.last_name}</option>
              ))}
            </select>
          </div>
          <div className="actions">
            <button type="button" disabled={!patientId} onClick={() => setStep(1)}>Next: Appointment</button>
            <Link to="/patients" className="secondary" style={{ padding: "0.5rem 1rem" }}>Register new patient</Link>
          </div>
          {chart && (
            <div style={{ marginTop: "1rem" }}>
              <h4>Patient timeline</h4>
              <p className="muted">{chart.encounters.length} encounters · {chart.invoices.length} invoices · {chart.ipd_admissions.length} IPD stays</p>
            </div>
          )}
        </div>
      )}

      {step === 1 && patientId && (
        <form className="card" onSubmit={(e) => bookAppointment(e).catch((err) => setError(err.message))}>
          <h3 style={{ marginTop: 0 }}>Book appointment (optional)</h3>
          <div className="field">
            <label>Provider</label>
            <select required value={apptForm.provider_id} onChange={(e) => setApptForm({ ...apptForm, provider_id: e.target.value })}>
              <option value="">Select</option>
              {providers.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>When</label>
            <input type="datetime-local" required value={apptForm.scheduled_at} onChange={(e) => setApptForm({ ...apptForm, scheduled_at: e.target.value })} />
          </div>
          <div className="field">
            <label>Mode</label>
            <select value={apptForm.mode} onChange={(e) => setApptForm({ ...apptForm, mode: e.target.value })}>
              <option value="in_person">In person (OPD)</option>
              <option value="telemedicine">Telemedicine</option>
            </select>
          </div>
          <div className="field">
            <label>Reason</label>
            <input value={apptForm.reason} onChange={(e) => setApptForm({ ...apptForm, reason: e.target.value })} />
          </div>
          <div className="actions">
            <button type="submit">Book & continue</button>
            <button type="button" className="secondary" onClick={() => { setStep(2); }}>Skip — walk-in</button>
          </div>
          {chart && chart.appointments.length > 0 && (
            <div style={{ marginTop: "1rem" }}>
              <label>Or use existing appointment</label>
              <select value={appointmentId} onChange={(e) => setAppointmentId(e.target.value)}>
                <option value="">None</option>
                {chart.appointments.filter((a) => a.status !== "completed" && a.status !== "cancelled").map((a) => (
                  <option key={a.id} value={a.id}>{a.queue_token} · {a.status} · {new Date(a.scheduled_at).toLocaleString()}</option>
                ))}
              </select>
            </div>
          )}
        </form>
      )}

      {step === 2 && patientId && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Start encounter</h3>
          <p className="muted">{appointmentId ? "Starting from booked appointment" : "Walk-in encounter without appointment"}</p>
          <button type="button" onClick={() => startEncounter().catch((err) => setError(err.message))}>Start clinical encounter</button>
          {chart && chart.encounters.filter((e) => e.status !== "closed").length > 0 && (
            <div style={{ marginTop: "1rem" }}>
              <label>Open encounter</label>
              <select value={encounterId} onChange={(e) => { setEncounterId(e.target.value); setStep(3); }}>
                <option value="">Select open encounter</option>
                {chart.encounters.filter((e) => e.status !== "closed").map((e) => (
                  <option key={e.id} value={e.id}>{e.id.slice(0, 8)} · {e.chief_complaint || "—"}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {step === 3 && encounterId && (
        <div className="grid-2">
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Document clinical chart</h3>
            <p className="muted">Encounter {encounterId.slice(0, 8)} · {detail?.status}</p>
            <div className="actions" style={{ marginBottom: "1rem" }}>
              <button type="button" onClick={() => saveVitals().catch((e) => setError(e.message))}>Save vitals</button>
            </div>
            <div className="field">
              <label>Clinical note</label>
              <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="SOAP note..." />
              <button type="button" className="secondary" style={{ marginTop: "0.5rem" }} disabled={!note} onClick={() => saveNote().catch((e) => setError(e.message))}>Save note</button>
            </div>
            <div className="field">
              <label>Diagnosis</label>
              <select value={diagnosisCode} onChange={(e) => setDiagnosisCode(e.target.value)}>
                <option value="">Select disease</option>
                {diseases.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
              </select>
              <button type="button" className="secondary" style={{ marginTop: "0.5rem" }} disabled={!diagnosisCode} onClick={() => saveDiagnosis().catch((e) => setError(e.message))}>Save diagnosis</button>
            </div>
            <div className="field">
              <label>Prescription</label>
              <select value={rxMed} onChange={(e) => setRxMed(e.target.value)}>
                <option value="">Select medicine</option>
                {medicines.map((m) => <option key={m.code} value={m.code}>{m.name} {m.strength}</option>)}
              </select>
              <button type="button" className="secondary" style={{ marginTop: "0.5rem" }} disabled={!rxMed} onClick={() => saveRx().catch((e) => setError(e.message))}>Issue eRx</button>
            </div>
            <div className="actions" style={{ marginTop: "1rem" }}>
              <button type="button" onClick={() => setStep(4)}>Proceed to discharge</button>
            </div>
          </div>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Saved chart data</h3>
            {!detail ? <p className="muted">Loading...</p> : (
              <>
                <h4>Vitals ({detail.vitals.length})</h4>
                <ul>{detail.vitals.map((v) => <li key={v.id}>BP {v.bp} · Pulse {v.pulse} · SpO2 {v.spo2}%</li>)}</ul>
                <h4>Notes ({detail.notes.length})</h4>
                <ul>{detail.notes.map((n) => <li key={n.id}>{n.content}</li>)}</ul>
                <h4>Diagnoses ({detail.diagnoses.length})</h4>
                <ul>{detail.diagnoses.map((d, i) => <li key={i}>{d.disease_name} ({d.disease_code})</li>)}</ul>
                <h4>Prescriptions ({detail.prescriptions.length})</h4>
                {detail.prescriptions.map((rx) => (
                  <div key={rx.id} style={{ marginBottom: "0.5rem" }}>
                    <strong>{rx.status}</strong>
                    <ul>{rx.lines.map((l, i) => <li key={i}>{l.medicine_name} — {l.dose} {l.frequency} × {l.duration}</li>)}</ul>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {step === 4 && encounterId && (
        <div className="grid-2">
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Discharge & billing</h3>
            <p className="muted">Closing the encounter auto-generates an invoice from tariff masters (consultation, registration, labs).</p>
            {detail?.status !== "closed" ? (
              <>
                <div className="field">
                  <label>Assessment</label>
                  <input value={discharge.assessment} onChange={(e) => setDischarge({ ...discharge, assessment: e.target.value })} />
                </div>
                <div className="field">
                  <label>Plan</label>
                  <input value={discharge.plan} onChange={(e) => setDischarge({ ...discharge, plan: e.target.value })} />
                </div>
                <button type="button" onClick={() => dischargeAndBill().catch((e) => setError(e.message))}>Discharge & generate invoice</button>
              </>
            ) : (
              <p className="success">Encounter closed</p>
            )}
          </div>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Payment</h3>
            {detail?.invoice ? (
              <>
                <p><strong>{detail.invoice.invoice_no}</strong> — ₹{detail.invoice.total} · <span className="badge">{detail.invoice.status}</span></p>
                {detail.invoice.status !== "paid" && (
                  <button type="button" onClick={() => payInvoice().catch((e) => setError(e.message))}>Collect payment</button>
                )}
                {detail.invoice.status === "paid" && (
                  <>
                    <p className="success">Visit complete — billing settled</p>
                    <div className="actions" style={{ marginTop: "1rem" }}>
                      <Link to="/clinical-hub" className="button-link">Order labs / IPD</Link>
                      <Link to="/insurance-claims" className="secondary button-link">Insurance claim</Link>
                      <Link to="/post-treatment" className="secondary button-link">Follow-up care</Link>
                      <Link to="/portal" className="secondary button-link">Patient portal</Link>
                    </div>
                  </>
                )}
              </>
            ) : (
              <p className="muted">Invoice appears after discharge</p>
            )}
            <div style={{ marginTop: "1rem" }}>
              <Link to="/billing">Open billing module</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

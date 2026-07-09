import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { fetchPatients } from "../../api/list";
import ModuleFlowBar from "../../components/ModuleFlowBar";

type Triage = {
  id: string;
  triage_no: string;
  patient_id: string;
  chief_complaint?: string;
  esi_level: number;
  status: string;
  disposition?: string;
};

const NEXT: Record<string, string> = {
  arrived: "triaged",
  triaged: "treatment",
  treatment: "disposition",
};

export default function EmergencyPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [rows, setRows] = useState<Triage[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ patient_id: "", chief_complaint: "", esi_level: "3", notes: "" });
  const [disposition, setDisposition] = useState("discharge");

  const patientMap = useMemo(() => {
    const m = new Map<string, string>();
    patients.forEach((p) => m.set(p.id, `${p.first_name} ${p.last_name}`));
    return m;
  }, [patients]);

  async function load() {
    const [p, t] = await Promise.all([
      fetchPatients(),
      api<Triage[]>("/emergency/triage"),
    ]);
    setPatients(p);
    setRows(t);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function register(e: FormEvent) {
    e.preventDefault();
    await api("/emergency/triage", {
      method: "POST",
      body: JSON.stringify({
        patient_id: form.patient_id,
        chief_complaint: form.chief_complaint,
        esi_level: Number(form.esi_level),
        notes: form.notes,
      }),
    });
    setMsg("Patient registered in ED");
    await load();
  }

  async function advance(row: Triage) {
    const next = NEXT[row.status];
    if (!next) return;
    const qs = next === "disposition" ? `?status=${next}&disposition=${disposition}` : `?status=${next}`;
    await api(`/emergency/triage/${row.id}/status${qs}`, { method: "PATCH" });
    setMsg(`${row.triage_no} → ${next}`);
    await load();
  }

  return (
    <div>
      <ModuleFlowBar moduleCode="emergency-and-triage" compact />
      <h1 className="page-title">Emergency & triage</h1>
      <p className="muted">ESI 1–5 · arrived → triaged → treatment → disposition</p>
      <div className="actions" style={{ marginBottom: "1rem" }}>
        <Link to="/patients" className="secondary button-link">Patients</Link>
        <Link to="/encounters" className="secondary button-link">Encounters</Link>
      </div>
      {error && <div className="error">{error}</div>}
      {msg && <div className="success">{msg}</div>}

      <form className="card" onSubmit={(e) => register(e).catch((err) => setError(err.message))}>
        <h3 style={{ marginTop: 0 }}>ED arrival</h3>
        <div className="grid-2">
          <div className="field">
            <label>Patient</label>
            <select required value={form.patient_id} onChange={(e) => setForm({ ...form, patient_id: e.target.value })}>
              <option value="">Select</option>
              {patients.map((p) => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>ESI level</label>
            <select value={form.esi_level} onChange={(e) => setForm({ ...form, esi_level: e.target.value })}>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label>Chief complaint</label>
          <input required value={form.chief_complaint} onChange={(e) => setForm({ ...form, chief_complaint: e.target.value })} />
        </div>
        <button type="submit">Register arrival</button>
      </form>

      <div className="card" style={{ marginTop: "1rem" }}>
        <div className="field">
          <label>Disposition (for final step)</label>
          <select value={disposition} onChange={(e) => setDisposition(e.target.value)}>
            <option value="discharge">Discharge</option>
            <option value="admit">Admit to IPD</option>
            <option value="transfer">Transfer</option>
            <option value="lwbs">Left without being seen</option>
          </select>
        </div>
      </div>

      <div className="card table-wrap" style={{ marginTop: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>ED board</h3>
        <table>
          <thead><tr><th>Triage</th><th>Patient</th><th>ESI</th><th>Complaint</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.triage_no}</td>
                <td>{patientMap.get(r.patient_id) || "—"}</td>
                <td><span className="badge">ESI {r.esi_level}</span></td>
                <td>{r.chief_complaint}</td>
                <td><span className="badge">{r.status}</span></td>
                <td>
                  {NEXT[r.status] && (
                    <button type="button" className="secondary" onClick={() => advance(r).catch((e) => setError(e.message))}>
                      → {NEXT[r.status]}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


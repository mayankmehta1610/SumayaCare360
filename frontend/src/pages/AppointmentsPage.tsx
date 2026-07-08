import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import ModuleFlowBar from "../components/ModuleFlowBar";

export default function AppointmentsPage() {
  const [searchParams] = useSearchParams();
  const statusFilter = searchParams.get("status") || "";
  const [rows, setRows] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({
    patient_id: "",
    provider_id: "",
    scheduled_at: "",
    mode: "in_person",
    reason: "",
  });

  async function load() {
    const [a, p, pr] = await Promise.all([
      api<any[]>("/appointments"),
      api<any[]>("/patients"),
      api<any[]>("/providers"),
    ]);
    setRows(a);
    setPatients(p);
    setProviders(pr);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  const filtered = useMemo(
    () => (statusFilter ? rows.filter((r) => r.status === statusFilter) : rows),
    [rows, statusFilter]
  );

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    try {
      await api("/appointments", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          scheduled_at: new Date(form.scheduled_at).toISOString(),
        }),
      });
      setMsg("Appointment booked");
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function startEncounter(apptId: string) {
    try {
      const res = await api<{ id: string }>(`/appointments/${apptId}/start-encounter`, { method: "POST" });
      setMsg(`Encounter started — open Encounters or Care Journey (${res.id.slice(0, 8)})`);
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function setStatus(id: string, status: string) {
    try {
      await api(`/appointments/${id}/status?status=${status}`, { method: "PATCH" });
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div>
      <ModuleFlowBar moduleCode="appointment-and-queue-management" compact />
      <h1 className="page-title">Appointments & queue</h1>
      {statusFilter && <p className="muted">Filtered by status: <strong>{statusFilter}</strong></p>}
      {error && <div className="error">{error}</div>}
      {msg && <div className="success">{msg}</div>}
      <div className="grid-2">
        <form className="card" onSubmit={onCreate}>
          <h3 style={{ marginTop: 0 }}>Book appointment</h3>
          <div className="field">
            <label>Patient</label>
            <select required value={form.patient_id} onChange={(e) => setForm({ ...form, patient_id: e.target.value })}>
              <option value="">Select</option>
              {patients.map((p) => <option key={p.id} value={p.id}>{p.mrn} — {p.first_name} {p.last_name}</option>)}
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
            <label>When</label>
            <input type="datetime-local" required value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} />
          </div>
          <div className="field">
            <label>Mode</label>
            <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
              <option value="in_person">In person</option>
              <option value="telemedicine">Telemedicine</option>
            </select>
          </div>
          <div className="field">
            <label>Reason</label>
            <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </div>
          <button type="submit">Book</button>
        </form>
        <div className="card table-wrap">
          <table>
            <thead>
              <tr><th>Token</th><th>When</th><th>Mode</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td>{r.queue_token}</td>
                  <td>{new Date(r.scheduled_at).toLocaleString()}</td>
                  <td>{r.mode}</td>
                  <td><span className="badge">{r.status}</span></td>
                  <td className="actions">
                    <button type="button" className="secondary" onClick={() => setStatus(r.id, "checked_in")}>Check in</button>
                    <button type="button" onClick={() => startEncounter(r.id)}>Start encounter</button>
                    <button type="button" className="secondary" onClick={() => setStatus(r.id, "cancelled")}>Cancel</button>
                    <button type="button" className="secondary" onClick={() => setStatus(r.id, "no_show")}>No show</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

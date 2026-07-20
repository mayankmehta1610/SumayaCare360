import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { fetchPatients } from "../api/list";
import ModuleFlowBar from "../components/ModuleFlowBar";

export default function AppointmentsPage() {
  const [searchParams] = useSearchParams();
  const statusFilter = searchParams.get("status") || "";
  const [rows, setRows] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({
    patient_id: "",
    provider_id: "",
    scheduled_at: "",
    mode: "in_person",
    reason: "",
    visit_type: "new_consultation",
    department_id: "",
    priority: "routine",
    duration_minutes: "30",
    referral_source: "self",
    payer_type: "self_pay",
    callback_phone: "",
    booking_notes: "",
  });

  async function load() {
    const [a, p, pr, d] = await Promise.all([
      api<any[]>("/appointments"),
      fetchPatients(),
      api<any[]>("/providers"),
      api<any[]>("/admin/departments"),
    ]);
    setRows(a);
    setPatients(p);
    setProviders(pr);
    setDepartments(d);
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
      const { visit_type, department_id, priority, duration_minutes, referral_source, payer_type, callback_phone, booking_notes, ...appointment } = form;
      await api("/appointments", {
        method: "POST",
        body: JSON.stringify({
          ...appointment,
          scheduled_at: new Date(form.scheduled_at).toISOString(),
          booking_profile: { visit_type, department_id, priority, duration_minutes: Number(duration_minutes), referral_source, payer_type, callback_phone, notes: booking_notes },
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

  async function callNext(id: string) {
    try {
      await api(`/queue/tokens/${id}/status?status=in_progress`, { method: "PATCH" });
      setMsg("Patient called to counter");
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function completeQueue(id: string) {
    try {
      await api(`/queue/tokens/${id}/status?status=completed`, { method: "PATCH" });
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
          <div className="field"><label>Department (master)</label><select required value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value, provider_id: "" })}><option value="">Select department</option>{departments.map((x) => <option key={x.id} value={x.id}>{x.code} ? {x.name}</option>)}</select></div>
          <div className="field">
            <label>Provider</label>
            <select required value={form.provider_id} onChange={(e) => setForm({ ...form, provider_id: e.target.value })}>
              <option value="">Select</option>
              {providers.filter((p) => p.department_id === form.department_id).map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
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
            <label>Reason for visit *</label>
            <input required minLength={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </div>
          <div className="grid-2">
            <div className="field"><label>Visit type *</label><select required value={form.visit_type} onChange={(e) => setForm({ ...form, visit_type: e.target.value })}><option value="new_consultation">New consultation</option><option value="follow_up">Follow-up</option><option value="procedure">Procedure</option><option value="diagnostic">Diagnostic</option><option value="preventive">Preventive care</option></select></div>
            <div className="field"><label>Priority *</label><select required value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}><option value="routine">Routine</option><option value="urgent">Urgent</option><option value="priority">Priority / vulnerable patient</option></select></div>
            <div className="field"><label>Planned duration (minutes) *</label><input required type="number" min="5" max="480" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} /></div>
            <div className="field"><label>Referral source *</label><select required value={form.referral_source} onChange={(e) => setForm({ ...form, referral_source: e.target.value })}><option value="self">Self / walk-in</option><option value="internal">Internal referral</option><option value="external_provider">External provider</option><option value="camp">Health camp</option><option value="online">Online</option></select></div>
            <div className="field"><label>Payer type *</label><select required value={form.payer_type} onChange={(e) => setForm({ ...form, payer_type: e.target.value })}><option value="self_pay">Self pay</option><option value="insurance">Insurance</option><option value="corporate">Corporate</option><option value="government">Government scheme</option></select></div>
          </div>
          <div className="field">
            <label>Callback phone *</label>
            <input required type="tel" minLength={8} value={form.callback_phone} onChange={(e) => setForm({ ...form, callback_phone: e.target.value })} />
          </div>
          <div className="field">
            <label>Booking instructions</label>
            <textarea rows={2} value={form.booking_notes} onChange={(e) => setForm({ ...form, booking_notes: e.target.value })} />
          </div>
          <button type="submit">Book appointment</button>
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
                    <button type="button" className="secondary" onClick={() => callNext(r.id)}>Call next</button>
                    <button type="button" onClick={() => startEncounter(r.id)}>Start encounter</button>
                    <button type="button" className="secondary" onClick={() => completeQueue(r.id)}>Complete</button>
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


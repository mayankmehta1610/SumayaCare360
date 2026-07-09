import { FormEvent, useEffect, useState } from "react";
import { api } from "../api/client";
import ModuleFlowBar from "../components/ModuleFlowBar";

export default function ProvidersPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [specialties, setSpecialties] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [schedules, setSchedules] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ code: "", full_name: "", specialty_code: "", license_no: "" });
  const [schedForm, setSchedForm] = useState({ day_of_week: 1, start_time: "09:00", end_time: "17:00", slot_minutes: 15, mode: "in_person" });

  async function load() {
    const [providers, specs] = await Promise.all([
      api<any[]>("/providers"),
      api<any[]>("/masters/specialties"),
    ]);
    setRows(providers);
    setSpecialties(specs);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!selectedId) { setSchedules([]); return; }
    api<any[]>(`/providers/${selectedId}/schedules`).then(setSchedules).catch(() => setSchedules([]));
  }, [selectedId]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    try {
      await api("/providers", { method: "POST", body: JSON.stringify(form) });
      setMsg("Provider created");
      setForm({ code: "", full_name: "", specialty_code: "", license_no: "" });
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function addSchedule(e: FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    await api(`/providers/${selectedId}/schedules`, { method: "POST", body: JSON.stringify(schedForm) });
    setMsg("Schedule slot added");
    const s = await api<any[]>(`/providers/${selectedId}/schedules`);
    setSchedules(s);
  }

  return (
    <div>
      <ModuleFlowBar moduleCode="doctor-and-provider-management" compact />
      <h1 className="page-title">Providers</h1>
      {error && <div className="error">{error}</div>}
      {msg && <div className="success">{msg}</div>}
      <div className="grid-2">
        <form className="card" onSubmit={onCreate}>
          <h3 style={{ marginTop: 0 }}>Add provider</h3>
          <div className="field"><label>Code</label><input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
          <div className="field"><label>Full name</label><input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
          <div className="field">
            <label>Specialty (from master)</label>
            <select required value={form.specialty_code} onChange={(e) => setForm({ ...form, specialty_code: e.target.value })}>
              <option value="">Select specialty</option>
              {specialties.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
            </select>
          </div>
          <div className="field"><label>License</label><input value={form.license_no} onChange={(e) => setForm({ ...form, license_no: e.target.value })} /></div>
          <button type="submit">Save provider</button>
        </form>
        <div className="card table-wrap">
          <table>
            <thead><tr><th>Code</th><th>Name</th><th>Specialty</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.code}</td><td>{r.full_name}</td><td>{r.specialty_code}</td><td>{r.status}</td>
                  <td><button type="button" className="secondary" onClick={() => setSelectedId(r.id)}>Schedules</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {selectedId && (
        <div className="card" style={{ marginTop: "1rem" }}>
          <h3 style={{ marginTop: 0 }}>Provider schedule</h3>
          <form onSubmit={(e) => addSchedule(e).catch((err) => setError(err.message))} className="grid-2">
            <div className="field"><label>Day (0=Sun)</label><input type="number" min={0} max={6} value={schedForm.day_of_week} onChange={(e) => setSchedForm({ ...schedForm, day_of_week: +e.target.value })} /></div>
            <div className="field"><label>Start</label><input value={schedForm.start_time} onChange={(e) => setSchedForm({ ...schedForm, start_time: e.target.value })} /></div>
            <div className="field"><label>End</label><input value={schedForm.end_time} onChange={(e) => setSchedForm({ ...schedForm, end_time: e.target.value })} /></div>
            <div className="field"><label>Slot (min)</label><input type="number" value={schedForm.slot_minutes} onChange={(e) => setSchedForm({ ...schedForm, slot_minutes: +e.target.value })} /></div>
            <div className="field"><label>Mode</label>
              <select value={schedForm.mode} onChange={(e) => setSchedForm({ ...schedForm, mode: e.target.value })}>
                <option value="in_person">In person</option>
                <option value="telemedicine">Telemedicine</option>
              </select>
            </div>
            <button type="submit">Add slot</button>
          </form>
          <ul>{schedules.map((s) => <li key={s.id}>Day {s.day_of_week}: {s.start_time}–{s.end_time} ({s.slot_minutes}m, {s.mode})</li>)}</ul>
        </div>
      )}
    </div>
  );
}

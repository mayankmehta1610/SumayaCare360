import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import ModuleFlowBar from "../../components/ModuleFlowBar";

type LocEvent = {
  id: string;
  patient_id?: string;
  purpose_code: string;
  latitude?: number;
  longitude?: number;
  accuracy_m?: number;
  created_at?: string;
};

export default function LocationServicesPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [purposes, setPurposes] = useState<any[]>([]);
  const [events, setEvents] = useState<LocEvent[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ patient_id: "", purpose_code: "", latitude: "28.6139", longitude: "77.2090", accuracy_m: "10" });

  async function load() {
    const [p, pu, ev] = await Promise.all([
      api<any[]>("/patients"),
      api<any[]>("/masters/location-purposes"),
      api<LocEvent[]>("/location/events"),
    ]);
    setPatients(p);
    setPurposes(pu);
    setEvents(ev);
    if (pu.length && !form.purpose_code) setForm((f) => ({ ...f, purpose_code: pu[0].code }));
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function logEvent(e: FormEvent) {
    e.preventDefault();
    await api("/location/events", {
      method: "POST",
      body: JSON.stringify({
        patient_id: form.patient_id || undefined,
        purpose_code: form.purpose_code,
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        accuracy_m: Number(form.accuracy_m),
      }),
    });
    setMsg("Location event logged");
    await load();
  }

  return (
    <div>
      <ModuleFlowBar moduleCode="location-services" compact />
      <h1 className="page-title">GPS & location services</h1>
      <p className="muted">Check-in · home visit · ambulance tracking · geofencing · privacy controls</p>
      <div className="actions" style={{ marginBottom: "1rem" }}>
        <Link to="/ambulance" className="secondary button-link">Ambulance</Link>
        <Link to="/masters" className="secondary button-link">Location purposes</Link>
      </div>
      {error && <div className="error">{error}</div>}
      {msg && <div className="success">{msg}</div>}
      <form className="card" onSubmit={(e) => logEvent(e).catch((err) => setError(err.message))}>
        <h3 style={{ marginTop: 0 }}>Log location event</h3>
        <div className="grid-2">
          <div className="field">
            <label>Purpose</label>
            <select required value={form.purpose_code} onChange={(e) => setForm({ ...form, purpose_code: e.target.value })}>
              {purposes.map((p) => <option key={p.code} value={p.code}>{p.name || p.code}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Patient (optional)</label>
            <select value={form.patient_id} onChange={(e) => setForm({ ...form, patient_id: e.target.value })}>
              <option value="">None</option>
              {patients.map((p) => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
            </select>
          </div>
        </div>
        <div className="grid-2">
          <div className="field">
            <label>Latitude</label>
            <input value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
          </div>
          <div className="field">
            <label>Longitude</label>
            <input value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
          </div>
        </div>
        <button type="submit">Log event</button>
      </form>
      <div className="card table-wrap" style={{ marginTop: "1rem" }}>
        <table>
          <thead><tr><th>Purpose</th><th>Lat</th><th>Lng</th><th>Accuracy</th><th>Time</th></tr></thead>
          <tbody>
            {events.map((ev) => (
              <tr key={ev.id}>
                <td>{ev.purpose_code}</td>
                <td>{ev.latitude}</td>
                <td>{ev.longitude}</td>
                <td>{ev.accuracy_m}m</td>
                <td>{ev.created_at ? new Date(ev.created_at).toLocaleString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

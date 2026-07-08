import { FormEvent, useEffect, useState } from "react";
import { api } from "../api/client";

export default function ProvidersPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [specialties, setSpecialties] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ code: "", full_name: "", specialty_code: "", license_no: "" });

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

  return (
    <div>
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
            <thead><tr><th>Code</th><th>Name</th><th>Specialty</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}><td>{r.code}</td><td>{r.full_name}</td><td>{r.specialty_code}</td><td>{r.status}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import { FormEvent, useEffect, useState } from "react";
import { api } from "../api/client";

type Patient = {
  id: string;
  mrn: string;
  first_name: string;
  last_name: string;
  phone?: string;
  gender_code?: string;
  status: string;
};

export default function PatientsPage() {
  const [rows, setRows] = useState<Patient[]>([]);
  const [query, setQuery] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    gender_code: "",
    date_of_birth: "",
  });
  const [genders, setGenders] = useState<{ code: string; name: string }[]>([]);

  async function load(q = query) {
    const data = await api<Patient[]>(`/patients?query=${encodeURIComponent(q)}`);
    setRows(data);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
    api<{ code: string; name: string }[]>("/masters/genders")
      .then(setGenders)
      .catch(() => setGenders([]));
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMsg("");
    try {
      await api("/patients", { method: "POST", body: JSON.stringify(form) });
      setMsg("Patient registered");
      setForm({ first_name: "", last_name: "", phone: "", gender_code: "", date_of_birth: "" });
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h1 className="page-title">Patient registration</h1>
      {error && <div className="error">{error}</div>}
      {msg && <div className="success">{msg}</div>}
      <div className="grid-2" style={{ marginBottom: "1rem" }}>
        <form className="card" onSubmit={onCreate}>
          <h3 style={{ marginTop: 0 }}>Register patient</h3>
          <div className="grid-2">
            <div className="field">
              <label>First name</label>
              <input required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
            </div>
            <div className="field">
              <label>Last name</label>
              <input required value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
            </div>
          </div>
          <div className="grid-2">
            <div className="field">
              <label>Phone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="field">
              <label>Gender</label>
              <select value={form.gender_code} onChange={(e) => setForm({ ...form, gender_code: e.target.value })}>
                <option value="">Select</option>
                {genders.map((g) => (
                  <option key={g.code} value={g.code}>{g.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Date of birth</label>
            <input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
          </div>
          <button type="submit">Create patient</button>
        </form>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Search</h3>
          <div className="actions" style={{ marginBottom: "0.8rem" }}>
            <input placeholder="Name, phone, MRN" value={query} onChange={(e) => setQuery(e.target.value)} />
            <button type="button" onClick={() => load().catch((e) => setError(e.message))}>Search</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>MRN</th><th>Name</th><th>Phone</th><th>Status</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.mrn}</td>
                    <td>{r.first_name} {r.last_name}</td>
                    <td>{r.phone || "—"}</td>
                    <td><span className="badge">{r.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

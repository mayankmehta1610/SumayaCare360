import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import ModuleFlowBar from "../components/ModuleFlowBar";

type Patient = {
  id: string;
  mrn: string;
  first_name: string;
  last_name: string;
  phone?: string;
  gender_code?: string;
  status: string;
};

type Chart = {
  appointments: unknown[];
  encounters: unknown[];
  invoices: unknown[];
  lab_orders: unknown[];
  journey_links: Record<string, string>;
};

export default function PatientsPage() {
  const { session } = useAuth();
  const prefix = session?.tenant_code ? `/${session.tenant_code}` : "";
  const [rows, setRows] = useState<Patient[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [chart, setChart] = useState<Chart | null>(null);
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

  useEffect(() => {
    if (!selectedId) {
      setChart(null);
      return;
    }
    api<Chart>(`/patients/${selectedId}/chart`)
      .then(setChart)
      .catch(() => setChart(null));
  }, [selectedId]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMsg("");
    try {
      const created = await api<Patient>("/patients", { method: "POST", body: JSON.stringify(form) });
      setMsg("Patient registered — continue to care journey");
      setForm({ first_name: "", last_name: "", phone: "", gender_code: "", date_of_birth: "" });
      await load();
      setSelectedId(created.id);
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div>
      <ModuleFlowBar moduleCode="patient-registration-and-crm" compact />
      <h1 className="page-title">Patient registration</h1>
      <p className="muted">Step 1 of care flow → next: providers, appointments, clinical encounter</p>
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
          <h3 style={{ marginTop: 0 }}>Search & interconnect</h3>
          <div className="actions" style={{ marginBottom: "0.8rem" }}>
            <input placeholder="Name, phone, MRN" value={query} onChange={(e) => setQuery(e.target.value)} />
            <button type="button" onClick={() => load().catch((e) => setError(e.message))}>Search</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>MRN</th><th>Name</th><th></th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} style={{ background: selectedId === r.id ? "var(--brand-soft)" : undefined }}>
                    <td>{r.mrn}</td>
                    <td>{r.first_name} {r.last_name}</td>
                    <td>
                      <button type="button" className="secondary" onClick={() => setSelectedId(r.id)}>Chart</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {chart && selectedId && (
            <div style={{ marginTop: "1rem", borderTop: "1px solid var(--line)", paddingTop: "1rem" }}>
              <h4>Patient 360° chart</h4>
              <p className="muted">
                {chart.appointments.length} appts · {chart.encounters.length} encounters · {chart.invoices.length} bills · {chart.lab_orders?.length || 0} labs
              </p>
              <div className="actions">
                <Link to={`${prefix}/care-journey`} className="button-link">Care journey</Link>
                <Link to={`${prefix}/appointments`} className="secondary button-link">Book appointment</Link>
                <Link to={`${prefix}/clinical-hub`} className="secondary button-link">Lab / IPD</Link>
                <Link to={`${prefix}/billing`} className="secondary button-link">Billing</Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

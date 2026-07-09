import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { apiList } from "../api/list";
import DataTable from "../components/DataTable";
import { useAuth } from "../context/AuthContext";
import ModuleFlowBar from "../components/ModuleFlowBar";
import { canWrite } from "../hooks/usePermissions";
import { downloadCsv, downloadJson, rowsToCsv } from "../utils/export";

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
  const write = canWrite(session, "patients");
  const prefix = session?.tenant_code ? `/${session.tenant_code}` : "";
  const [rows, setRows] = useState<Patient[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedId, setSelectedId] = useState("");
  const [chart, setChart] = useState<Chart | null>(null);
  const [query, setQuery] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    gender_code: "",
    date_of_birth: "",
  });
  const [genders, setGenders] = useState<{ code: string; name: string }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiList<Patient>("/patients", { query, page, page_size: pageSize });
      setRows(res.items);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [query, page, pageSize]);

  useEffect(() => {
    load().catch((e) => setError(e.message));
    api<{ code: string; name: string }[]>("/masters/genders")
      .then(setGenders)
      .catch(() => setGenders([]));
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [query]);

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

  const columns = [
    { key: "mrn", label: "MRN" },
    { key: "name", label: "Name", render: (r: Patient) => `${r.first_name} ${r.last_name}` },
    { key: "phone", label: "Phone" },
    { key: "status", label: "Status", render: (r: Patient) => <span className="badge">{r.status}</span> },
  ];

  return (
    <div>
      <ModuleFlowBar moduleCode="patient-registration-and-crm" compact />
      <h1 className="page-title">Patient registration</h1>
      <p className="muted">Step 1 of care flow → next: providers, appointments, clinical encounter</p>
      {error && <div className="error">{error}</div>}
      {msg && <div className="success">{msg}</div>}
      <div className="grid-2" style={{ marginBottom: "1rem" }}>
        {write && (
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
        )}
        <div className="card">
          {chart && selectedId && (
            <div style={{ marginBottom: "1rem" }}>
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

      <DataTable
        title="Patients"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        search={query}
        onSearchChange={setQuery}
        searchPlaceholder="Name, phone, MRN…"
        loading={loading}
        onExportJson={() => downloadJson(rows, "patients.json")}
        onExportCsv={() => downloadCsv(rowsToCsv(rows as unknown as Record<string, unknown>[]), "patients.csv")}
        renderActions={(r) => (
          <button type="button" className={selectedId === r.id ? "" : "secondary"} onClick={() => setSelectedId(r.id)}>
            Chart
          </button>
        )}
      />
    </div>
  );
}

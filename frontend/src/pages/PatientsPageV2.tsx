import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { apiList } from "../api/list";
import DataTable from "../components/DataTable";
import ModuleFlowBar from "../components/ModuleFlowBar";
import PatientRegistrationForm from "../components/PatientRegistrationForm";
import { useAuth } from "../context/AuthContext";
import { canWrite } from "../hooks/usePermissions";
import { downloadCsv, downloadJson, rowsToCsv } from "../utils/export";

type Patient = {
  id: string;
  mrn: string;
  first_name: string;
  last_name: string;
  phone?: string;
  email?: string;
  date_of_birth?: string;
  gender_code?: string;
  blood_group?: string;
  status: string;
  registration_profile?: Record<string, unknown>;
};

type Chart = {
  appointments: unknown[];
  encounters: unknown[];
  invoices: unknown[];
  lab_orders: unknown[];
};

export default function PatientsPageV2() {
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
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiList<Patient>("/patients", { query, page, page_size: pageSize });
      setRows(result.items);
      setTotal(result.total);
    } finally {
      setLoading(false);
    }
  }, [query, page, pageSize]);

  useEffect(() => { load().catch((err) => setError(err.message)); }, [load]);
  useEffect(() => { setPage(1); }, [query]);
  useEffect(() => {
    if (!selectedId) { setChart(null); return; }
    api<Chart>(`/patients/${selectedId}/chart`).then(setChart).catch((err) => setError(err.message));
  }, [selectedId]);

  const columns = [
    { key: "mrn", label: "MRN" },
    { key: "name", label: "Patient", render: (row: Patient) => <><strong>{row.first_name} {row.last_name}</strong><small className="table-subtitle">{row.gender_code || "—"} · {row.date_of_birth || "DOB not recorded"}</small></> },
    { key: "contact", label: "Contact", render: (row: Patient) => <>{row.phone || "—"}<small className="table-subtitle">{row.email || "No email"}</small></> },
    { key: "blood_group", label: "Blood group", render: (row: Patient) => row.blood_group || "—" },
    { key: "payer", label: "Payer", render: (row: Patient) => String(row.registration_profile?.payer_type || "—").replaceAll("_", " ") },
    { key: "status", label: "Status", render: (row: Patient) => <span className="badge">{row.status}</span> },
  ];

  return (
    <div>
      <ModuleFlowBar moduleCode="patient-registration-and-crm" compact />
      <div className="page-heading-row">
        <div><div className="eyebrow">Patient access and identity</div><h1 className="page-title">Patient registration & CRM</h1><p className="muted">Search before registration, capture mandatory identity and consent, issue an MRN, then continue the care journey.</p></div>
      </div>
      {error && <div className="error">{error}</div>}
      {message && <div className="success">{message}</div>}

      {write && <PatientRegistrationForm onCreated={async (patient) => { setMessage(`Patient ${patient.mrn} registered successfully`); await load(); setSelectedId(patient.id); }} />}

      {chart && selectedId && (
        <div className="card patient-next-actions">
          <div><span className="eyebrow">Patient 360 snapshot</span><h3>Continue this patient’s workflow</h3><p className="muted">{chart.appointments.length} appointments · {chart.encounters.length} encounters · {chart.invoices.length} invoices · {chart.lab_orders?.length || 0} laboratory orders</p></div>
          <div className="actions">
            <Link to={`${prefix}/patient-administration`} className="button-link">Patient administration</Link>
            <Link to={`${prefix}/care-journey`} className="secondary button-link">Care journey</Link>
            <Link to={`${prefix}/appointments`} className="secondary button-link">Book appointment</Link>
            <Link to={`${prefix}/billing`} className="secondary button-link">Billing</Link>
          </div>
        </div>
      )}

      <DataTable
        title="Patient registry"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
        search={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search MRN, name, mobile, ID…"
        loading={loading}
        onExportJson={() => downloadJson(rows, "patient-registry.json")}
        onExportCsv={() => downloadCsv(rowsToCsv(rows as unknown as Record<string, unknown>[]), "patient-registry.csv")}
        renderActions={(row) => <button type="button" className={selectedId === row.id ? "" : "secondary"} onClick={() => setSelectedId(row.id)}>Open chart</button>}
      />
    </div>
  );
}

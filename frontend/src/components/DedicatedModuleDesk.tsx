import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { apiList, fetchPatients } from "../api/list";
import DataTable, { Column } from "./DataTable";
import ModuleFlowBar from "./ModuleFlowBar";
import ModuleFeaturePanel from "./ModuleFeaturePanel";
import { useAuth } from "../context/AuthContext";
import { canDelete, canWriteWorkspace } from "../hooks/usePermissions";
import { exportFromApi } from "../utils/export";

export type DomainMeta = {
  module_code: string;
  name: string;
  submodules: string[];
  api_prefix: string;
  initial_status: string;
  statuses: string[];
};

type RecordRow = {
  id: string;
  reference_no: string;
  submodule: string;
  title: string;
  status: string;
  payload: Record<string, unknown>;
  patient_id?: string;
  allowed_next_statuses?: string[];
};

type Props = {
  moduleCode: string;
  description?: string;
  linkPatient?: boolean;
  extraFields?: { key: string; label: string; placeholder?: string }[];
};

export default function DedicatedModuleDesk({ moduleCode, description, linkPatient, extraFields = [] }: Props) {
  const { session } = useAuth();
  const write = canWriteWorkspace(session);
  const del = canDelete(session);

  const [meta, setMeta] = useState<DomainMeta | null>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [activeTab, setActiveTab] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [editId, setEditId] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ title: "", patient_id: "", extras: {} as Record<string, string> });

  const patientMap = useMemo(() => {
    const m = new Map<string, string>();
    patients.forEach((p) => m.set(p.id, `${p.first_name} ${p.last_name}`));
    return m;
  }, [patients]);

  const loadRecords = useCallback(async (tab: string) => {
    if (!tab) return;
    setLoading(true);
    try {
      const res = await apiList<RecordRow>(`/dedicated/${moduleCode}/records`, {
        submodule: tab,
        query: search,
        status: statusFilter || undefined,
        page,
        page_size: pageSize,
      });
      setRows(res.items);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [moduleCode, search, statusFilter, page, pageSize]);

  async function loadMeta() {
    const m = await api<DomainMeta>(`/dedicated/${moduleCode}/meta`);
    setMeta(m);
    const tab = activeTab || m.submodules[0] || "";
    if (!activeTab && tab) setActiveTab(tab);
    if (linkPatient) setPatients(await fetchPatients());
  }

  useEffect(() => {
    setActiveTab("");
    setPage(1);
    setSearch("");
    loadMeta().catch((e) => setError(e.message));
  }, [moduleCode]);

  useEffect(() => {
    if (!meta || !activeTab) return;
    loadRecords(activeTab).catch((e) => setError(e.message));
  }, [meta, activeTab, loadRecords]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, activeTab]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!meta || !write) return;
    const payload: Record<string, string> = { ...form.extras };
    if (editId) {
      await api(`/dedicated/${moduleCode}/records/${editId}`, {
        method: "PATCH",
        body: JSON.stringify({ title: form.title, payload }),
      });
      setMsg("Record updated");
      setEditId("");
    } else {
      await api(`/dedicated/${moduleCode}/records`, {
        method: "POST",
        body: JSON.stringify({
          submodule: activeTab || meta.submodules[0],
          title: form.title,
          patient_id: form.patient_id || undefined,
          payload,
        }),
      });
      setMsg("Record created");
    }
    setForm({ title: "", patient_id: "", extras: {} });
    await loadRecords(activeTab);
  }

  async function advance(id: string, status: string) {
    await api(`/dedicated/${moduleCode}/records/${id}/status?status=${status}`, { method: "PATCH" });
    setMsg(`→ ${status}`);
    await loadRecords(activeTab);
  }

  async function approve(id: string) {
    await api(`/dedicated/${moduleCode}/records/${id}/approve`, { method: "POST" });
    setMsg("Approved");
    await loadRecords(activeTab);
  }

  async function remove(id: string) {
    if (!confirm("Delete this record?")) return;
    await api(`/dedicated/${moduleCode}/records/${id}`, { method: "DELETE" });
    setMsg("Deleted");
    await loadRecords(activeTab);
  }

  function startEdit(r: RecordRow) {
    setEditId(r.id);
    setForm({
      title: r.title,
      patient_id: r.patient_id || "",
      extras: Object.fromEntries(Object.entries(r.payload || {}).map(([k, v]) => [k, String(v ?? "")])),
    });
  }

  const columns: Column<RecordRow>[] = useMemo(() => {
    const cols: Column<RecordRow>[] = [
      { key: "reference_no", label: "Ref" },
      { key: "title", label: "Title" },
    ];
    if (linkPatient) {
      cols.push({
        key: "patient",
        label: "Patient",
        render: (r) => (r.patient_id ? patientMap.get(r.patient_id) || "—" : "—"),
      });
    }
    cols.push({
      key: "status",
      label: "Status",
      render: (r) => <span className="badge">{r.status}</span>,
    });
    return cols;
  }, [linkPatient, patientMap]);

  if (!meta) return <div className="muted">Loading {moduleCode}…</div>;

  return (
    <div>
      <ModuleFlowBar moduleCode={moduleCode} compact />
      <h1 className="page-title">{meta.name}</h1>
      {description && <p className="muted">{description}</p>}
      <ModuleFeaturePanel moduleCode={moduleCode} submodule={activeTab} />
      {error && <div className="error">{error}</div>}
      {msg && <div className="success">{msg}</div>}

      <div className="tabs" style={{ marginBottom: "1rem", flexWrap: "wrap" }}>
        {meta.submodules.map((s) => (
          <button key={s} type="button" className={activeTab === s ? "" : "secondary"} onClick={() => setActiveTab(s)}>
            {s}
          </button>
        ))}
      </div>

      {write && (
        <form className="card" style={{ marginBottom: "1rem" }} onSubmit={(e) => onCreate(e).catch((err) => setError(err.message))}>
          <h3 style={{ marginTop: 0 }}>{editId ? "Edit" : "New"} — {activeTab}</h3>
          <div className="field">
            <label>Title</label>
            <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          {linkPatient && (
            <div className="field">
              <label>Patient</label>
              <select value={form.patient_id} onChange={(e) => setForm({ ...form, patient_id: e.target.value })}>
                <option value="">Optional</option>
                {patients.map((p) => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
              </select>
            </div>
          )}
          {extraFields.map((f) => (
            <div className="field" key={f.key}>
              <label>{f.label}</label>
              <input
                value={form.extras[f.key] || ""}
                placeholder={f.placeholder}
                onChange={(e) => setForm({ ...form, extras: { ...form.extras, [f.key]: e.target.value } })}
              />
            </div>
          ))}
          <button type="submit">{editId ? "Save changes" : "Create"}</button>
          {editId && (
            <button type="button" className="secondary" style={{ marginLeft: "0.5rem" }} onClick={() => { setEditId(""); setForm({ title: "", patient_id: "", extras: {} }); }}>
              Cancel edit
            </button>
          )}
        </form>
      )}

      <DataTable
        title={`${activeTab} records`}
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search ref or title…"
        loading={loading}
        toolbar={
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {meta.statuses.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        }
        onExportJson={() => exportFromApi(`/dedicated/${moduleCode}/export`, moduleCode, "json", { submodule: activeTab, query: search }).then((n) => setMsg(`Exported ${n}`)).catch((e) => setError(e.message))}
        onExportCsv={() => exportFromApi(`/dedicated/${moduleCode}/export`, moduleCode, "csv", { submodule: activeTab, query: search }).then((n) => setMsg(`Exported ${n}`)).catch((e) => setError(e.message))}
        renderActions={write ? (r) => (
          <>
            <button type="button" className="secondary" onClick={() => startEdit(r)}>Edit</button>
            {(r.allowed_next_statuses || []).map((s) => (
              <button key={s} type="button" className="secondary" onClick={() => advance(r.id, s).catch((e) => setError(e.message))}>→ {s}</button>
            ))}
            {r.status === "submitted" && (
              <>
                <button type="button" onClick={() => approve(r.id).catch((e) => setError(e.message))}>Approve</button>
                <button type="button" className="secondary" onClick={() => advance(r.id, "rejected").catch((e) => setError(e.message))}>Reject</button>
              </>
            )}
            {del && <button type="button" className="secondary" onClick={() => remove(r.id).catch((e) => setError(e.message))}>Delete</button>}
          </>
        ) : undefined}
      />
    </div>
  );
}

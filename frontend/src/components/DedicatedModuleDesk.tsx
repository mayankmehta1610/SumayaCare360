import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import ModuleFlowBar from "./ModuleFlowBar";
import ModuleFeaturePanel from "./ModuleFeaturePanel";

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
  const [meta, setMeta] = useState<DomainMeta | null>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [activeTab, setActiveTab] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [editId, setEditId] = useState("");
  const [form, setForm] = useState({ title: "", patient_id: "", extras: {} as Record<string, string> });

  const patientMap = useMemo(() => {
    const m = new Map<string, string>();
    patients.forEach((p) => m.set(p.id, `${p.first_name} ${p.last_name}`));
    return m;
  }, [patients]);

  async function load() {
    const m = await api<DomainMeta>(`/dedicated/${moduleCode}/meta`);
    setMeta(m);
    const tab = activeTab || m.submodules[0] || "";
    if (!activeTab && tab) setActiveTab(tab);
    const params = new URLSearchParams();
    if (tab) params.set("submodule", tab);
    if (search) params.set("query", search);
    if (statusFilter) params.set("status", statusFilter);
    const qs = params.toString() ? `?${params}` : "";
    const [recs, pts] = await Promise.all([
      api<RecordRow[]>(`/dedicated/${moduleCode}/records${qs}`),
      linkPatient ? api<any[]>("/patients") : Promise.resolve([]),
    ]);
    setRows(recs);
    setPatients(pts);
  }

  useEffect(() => {
    setActiveTab("");
    setSearch("");
    load().catch((e) => setError(e.message));
  }, [moduleCode]);

  useEffect(() => {
    if (!meta || !activeTab) return;
    const params = new URLSearchParams({ submodule: activeTab });
    if (search) params.set("query", search);
    if (statusFilter) params.set("status", statusFilter);
    api<RecordRow[]>(`/dedicated/${moduleCode}/records?${params}`)
      .then(setRows)
      .catch((e) => setError(e.message));
  }, [activeTab, search, statusFilter, moduleCode, meta?.module_code]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!meta) return;
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
    await load();
  }

  async function advance(id: string, status: string) {
    await api(`/dedicated/${moduleCode}/records/${id}/status?status=${status}`, { method: "PATCH" });
    setMsg(`→ ${status}`);
    await load();
  }

  async function approve(id: string) {
    await api(`/dedicated/${moduleCode}/records/${id}/approve`, { method: "POST" });
    setMsg("Approved");
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this record?")) return;
    await api(`/dedicated/${moduleCode}/records/${id}`, { method: "DELETE" });
    setMsg("Deleted");
    await load();
  }

  async function exportData() {
    const data = await api<any>(`/dedicated/${moduleCode}/export?submodule=${encodeURIComponent(activeTab)}`, { method: "POST" });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${moduleCode}-${activeTab}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMsg(`Exported ${data.count} records`);
  }

  function startEdit(r: RecordRow) {
    setEditId(r.id);
    setForm({
      title: r.title,
      patient_id: r.patient_id || "",
      extras: Object.fromEntries(
        Object.entries(r.payload || {}).map(([k, v]) => [k, String(v ?? "")])
      ),
    });
  }

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

      <div className="actions" style={{ marginBottom: "0.75rem", flexWrap: "wrap" }}>
        <input
          placeholder="Search ref or title…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ minWidth: "200px" }}
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {meta.statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button type="button" className="secondary" onClick={() => exportData().catch((e) => setError(e.message))}>
          Export JSON
        </button>
      </div>

      <form className="card" onSubmit={(e) => onCreate(e).catch((err) => setError(err.message))}>
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

      <div className="card table-wrap" style={{ marginTop: "1rem" }}>
        <table>
          <thead><tr><th>Ref</th><th>Title</th>{linkPatient && <th>Patient</th>}<th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.reference_no}</td>
                <td>{r.title}</td>
                {linkPatient && <td>{r.patient_id ? patientMap.get(r.patient_id) || "—" : "—"}</td>}
                <td><span className="badge">{r.status}</span></td>
                <td className="actions" style={{ flexWrap: "wrap" }}>
                  <button type="button" className="secondary" onClick={() => startEdit(r)}>Edit</button>
                  {(r.allowed_next_statuses || []).map((s) => (
                    <button key={s} type="button" className="secondary" onClick={() => advance(r.id, s).catch((e) => setError(e.message))}>
                      → {s}
                    </button>
                  ))}
                  {r.status === "submitted" && (
                    <>
                      <button type="button" onClick={() => approve(r.id).catch((e) => setError(e.message))}>Approve</button>
                      <button type="button" className="secondary" onClick={() => advance(r.id, "rejected").catch((e) => setError(e.message))}>Reject</button>
                    </>
                  )}
                  <button type="button" className="secondary" onClick={() => remove(r.id).catch((e) => setError(e.message))}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

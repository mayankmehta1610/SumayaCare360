import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { apiList } from "../api/list";
import DataTable from "../components/DataTable";
import ModuleFlowBar from "../components/ModuleFlowBar";
import { useAuth } from "../context/AuthContext";
import { canDelete, canWrite } from "../hooks/usePermissions";
import { exportFromApi } from "../utils/export";

type PlatformModule = {
  code: string;
  name: string;
  submodules: string[];
  fields_schema: { key: string; label: string; type: string; required?: boolean; options?: string[] }[];
  statuses: string[];
};

type RecordRow = {
  id: string;
  reference_no: string;
  submodule: string;
  title: string;
  status: string;
  payload: Record<string, unknown>;
};

type Props = { moduleCode?: string };

export default function ModulePage({ moduleCode: fixedCode }: Props) {
  const { moduleCode: paramCode = "" } = useParams();
  const moduleCode = fixedCode || paramCode;
  const { session } = useAuth();
  const write = canWrite(session);
  const del = canDelete(session);

  const [mod, setMod] = useState<PlatformModule | null>(null);
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [activeTab, setActiveTab] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [editId, setEditId] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ submodule: "", title: "", description: "", priority: "medium", status: "draft" });

  const loadRecords = useCallback(async (tab: string) => {
    if (!moduleCode || !tab) return;
    setLoading(true);
    try {
      const res = await apiList<RecordRow>(`/modules/${moduleCode}`, {
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

  async function loadModule() {
    const modules = await api<PlatformModule[]>("/platform/modules");
    const found = modules.find((m) => m.code === moduleCode);
    if (!found) throw new Error(`Module not found: ${moduleCode}`);
    setMod(found);
    const tab = activeTab || found.submodules[0] || "";
    if (!activeTab && tab) setActiveTab(tab);
    setForm((f) => ({ ...f, submodule: tab || found.submodules[0] || "" }));
  }

  useEffect(() => {
    setActiveTab("");
    setPage(1);
    loadModule().catch((e) => setError(e.message));
  }, [moduleCode]);

  useEffect(() => {
    if (!mod || !activeTab) return;
    loadRecords(activeTab).catch((e) => setError(e.message));
  }, [mod, activeTab, loadRecords]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, activeTab]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!write) return;
    setError("");
    if (editId) {
      await api(`/modules/${moduleCode}/${editId}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: form.title,
          status: form.status,
          payload: { description: form.description, priority: form.priority },
        }),
      });
      setMsg("Record updated");
      setEditId("");
    } else {
      await api(`/modules/${moduleCode}`, {
        method: "POST",
        body: JSON.stringify({
          submodule: form.submodule,
          title: form.title,
          status: form.status,
          payload: { description: form.description, priority: form.priority },
        }),
      });
      setMsg("Record saved to database");
    }
    setForm((f) => ({ ...f, title: "", description: "" }));
    await loadRecords(activeTab);
  }

  async function setStatus(id: string, status: string) {
    await api(`/modules/${moduleCode}/${id}/status?status=${status}`, { method: "PATCH" });
    await loadRecords(activeTab);
  }

  async function remove(id: string) {
    if (!confirm("Delete this record?")) return;
    await api(`/modules/${moduleCode}/${id}`, { method: "DELETE" });
    setMsg("Deleted");
    await loadRecords(activeTab);
  }

  function startEdit(r: RecordRow) {
    setEditId(r.id);
    setForm({
      submodule: r.submodule,
      title: r.title,
      description: String(r.payload?.description ?? ""),
      priority: String(r.payload?.priority ?? "medium"),
      status: r.status,
    });
  }

  const columns = useMemo(() => [
    { key: "reference_no", label: "Ref" },
    { key: "title", label: "Title" },
    { key: "status", label: "Status", render: (r: RecordRow) => <span className="badge">{r.status}</span> },
  ], []);

  if (!mod) return <div className="card">Loading module...</div>;

  return (
    <div>
      <ModuleFlowBar moduleCode={moduleCode} />
      <h1 className="page-title">{mod.name}</h1>
      <p className="muted">Full CRUD · search · pagination · export · role-based actions</p>
      {error && <div className="error">{error}</div>}
      {msg && <div className="success">{msg}</div>}

      <div className="module-tabs" style={{ marginBottom: "1rem" }}>
        {mod.submodules.map((s) => (
          <button key={s} type="button" className={activeTab === s ? "" : "secondary"} onClick={() => setActiveTab(s)}>
            {s}
          </button>
        ))}
      </div>

      {write && (
        <form className="card" style={{ marginBottom: "1rem" }} onSubmit={(e) => onCreate(e).catch((err) => setError(err.message))}>
          <h3 style={{ marginTop: 0 }}>{editId ? "Edit" : "Create"} — {activeTab || form.submodule}</h3>
          <div className="field">
            <label>Submodule tab</label>
            <select required value={form.submodule} onChange={(e) => { setForm({ ...form, submodule: e.target.value }); setActiveTab(e.target.value); }}>
              {mod.submodules.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Title</label>
            <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="field">
            <label>Description</label>
            <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid-2">
            <div className="field">
              <label>Priority</label>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                {["low", "medium", "high", "critical"].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {mod.statuses.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <button type="submit">{editId ? "Save changes" : "Save record"}</button>
          {editId && (
            <button type="button" className="secondary" style={{ marginLeft: "0.5rem" }} onClick={() => { setEditId(""); setForm((f) => ({ ...f, title: "", description: "" })); }}>
              Cancel
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
            {mod.statuses.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        }
        onExportJson={() => exportFromApi(`/modules/${moduleCode}/export`, `${moduleCode}-${activeTab}`, "json", { submodule: activeTab, query: search }).then((n) => setMsg(`Exported ${n} records`)).catch((e) => setError(e.message))}
        onExportCsv={() => exportFromApi(`/modules/${moduleCode}/export`, `${moduleCode}-${activeTab}`, "csv", { submodule: activeTab, query: search }).then((n) => setMsg(`Exported ${n} records`)).catch((e) => setError(e.message))}
        renderActions={write ? (r) => (
          <>
            <button type="button" className="secondary" onClick={() => startEdit(r)}>Edit</button>
            {r.status !== "in_progress" && r.status !== "completed" && (
              <button type="button" className="secondary" onClick={() => setStatus(r.id, "in_progress").catch((e) => setError(e.message))}>Start</button>
            )}
            {r.status !== "completed" && (
              <button type="button" className="secondary" onClick={() => setStatus(r.id, "completed").catch((e) => setError(e.message))}>Complete</button>
            )}
            {r.status !== "approved" && (
              <button type="button" className="secondary" onClick={() => api(`/modules/${moduleCode}/${r.id}/approve`, { method: "POST" }).then(() => loadRecords(activeTab)).catch((e) => setError(e.message))}>Approve</button>
            )}
            {del && <button type="button" className="secondary" onClick={() => remove(r.id).catch((e) => setError(e.message))}>Delete</button>}
          </>
        ) : undefined}
      />
    </div>
  );
}

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import ModuleFlowBar from "../components/ModuleFlowBar";

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
  const [mod, setMod] = useState<PlatformModule | null>(null);
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [activeTab, setActiveTab] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ submodule: "", title: "", description: "", priority: "medium", status: "draft" });

  async function load() {
    const modules = await api<PlatformModule[]>("/platform/modules");
    const found = modules.find((m) => m.code === moduleCode);
    if (!found) throw new Error(`Module not found: ${moduleCode}`);
    setMod(found);
    const tab = activeTab || found.submodules[0] || "";
    if (!activeTab && tab) setActiveTab(tab);
    const q = tab ? `?submodule=${encodeURIComponent(tab)}` : "";
    const data = await api<RecordRow[]>(`/modules/${moduleCode}${q}`);
    setRows(data);
    setForm((f) => ({ ...f, submodule: tab || found.submodules[0] || "" }));
  }

  useEffect(() => {
    setActiveTab("");
    load().catch((e) => setError(e.message));
  }, [moduleCode]);

  useEffect(() => {
    if (!mod || !activeTab) return;
    api<RecordRow[]>(`/modules/${moduleCode}?submodule=${encodeURIComponent(activeTab)}`)
      .then(setRows)
      .catch((e) => setError(e.message));
    setForm((f) => ({ ...f, submodule: activeTab }));
  }, [activeTab, moduleCode, mod?.code]);

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (!mod) return counts;
    for (const s of mod.submodules) counts[s] = 0;
    return counts;
  }, [mod]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError("");
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
    setForm((f) => ({ ...f, title: "", description: "" }));
    await load();
  }

  async function setStatus(id: string, status: string) {
    await api(`/modules/${moduleCode}/${id}/status?status=${status}`, { method: "PATCH" });
    await load();
  }

  if (!mod) return <div className="card">Loading module...</div>;

  return (
    <div>
      <ModuleFlowBar moduleCode={moduleCode} />
      <h1 className="page-title">{mod.name}</h1>
      <p className="muted">All {mod.submodules.length} submodules · tenant-scoped · audited · data persists</p>
      {error && <div className="error">{error}</div>}
      {msg && <div className="success">{msg}</div>}

      <div className="module-tabs" style={{ marginBottom: "1rem" }}>
        {mod.submodules.map((s) => (
          <button
            key={s}
            type="button"
            className={activeTab === s ? "" : "secondary"}
            onClick={() => setActiveTab(s)}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="grid-2">
        <form className="card" onSubmit={(e) => onCreate(e).catch((err) => setError(err.message))}>
          <h3 style={{ marginTop: 0 }}>Create — {activeTab || form.submodule}</h3>
          <div className="field">
            <label>Submodule tab</label>
            <select required value={form.submodule} onChange={(e) => { setForm({ ...form, submodule: e.target.value }); setActiveTab(e.target.value); }}>
              {mod.submodules.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Title</label>
            <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="field">
            <label>Description</label>
            <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid-2">
            <div className="field">
              <label>Priority</label>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div className="field">
              <label>Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {mod.statuses.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          <button type="submit">Save record</button>
        </form>
        <div className="card table-wrap">
          <h3 style={{ marginTop: 0 }}>{activeTab} records ({rows.length})</h3>
          <table>
            <thead>
              <tr><th>Ref</th><th>Title</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={4} className="muted">No records yet — create one above</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.reference_no}</td>
                  <td>{r.title}</td>
                  <td><span className="badge">{r.status}</span></td>
                  <td className="actions">
                    {r.status !== "in_progress" && r.status !== "completed" && (
                      <button type="button" className="secondary" onClick={() => setStatus(r.id, "in_progress").catch((e) => setError(e.message))}>Start</button>
                    )}
                    {r.status !== "completed" && (
                      <button type="button" className="secondary" onClick={() => setStatus(r.id, "completed").catch((e) => setError(e.message))}>Complete</button>
                    )}
                    {r.status !== "approved" && (
                      <button type="button" className="secondary" onClick={() => api(`/modules/${moduleCode}/${r.id}/approve`, { method: "POST" }).then(() => load()).catch((e) => setError(e.message))}>Approve</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

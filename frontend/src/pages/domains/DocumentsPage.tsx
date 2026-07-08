import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import ModuleFlowBar from "../../components/ModuleFlowBar";

type Doc = { id: string; file_name: string; entity_type: string; status: string };

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ entity_type: "consent", file_name: "", content_type: "application/pdf" });

  async function load() {
    const rows = await api<Doc[]>("/docs/");
    setDocs(rows);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function register(e: FormEvent) {
    e.preventDefault();
    await api("/docs/upload-metadata", {
      method: "POST",
      body: JSON.stringify(form),
    });
    setMsg("Document registered — upload via signed URL");
    await load();
  }

  return (
    <div>
      <ModuleFlowBar moduleCode="document-forms-and-templates" compact />
      <h1 className="page-title">Documents, forms & templates</h1>
      <p className="muted">Clinical templates · consent forms · upload metadata · version control</p>
      <div className="actions" style={{ marginBottom: "1rem" }}>
        <Link to="/masters" className="secondary button-link">Masters (templates)</Link>
        <Link to="/audit" className="secondary button-link">Audit</Link>
      </div>
      {error && <div className="error">{error}</div>}
      {msg && <div className="success">{msg}</div>}
      <form className="card" onSubmit={(e) => register(e).catch((err) => setError(err.message))}>
        <h3 style={{ marginTop: 0 }}>Register document</h3>
        <div className="grid-2">
          <div className="field">
            <label>Entity type</label>
            <select value={form.entity_type} onChange={(e) => setForm({ ...form, entity_type: e.target.value })}>
              <option value="consent">Consent</option>
              <option value="clinical_template">Clinical template</option>
              <option value="discharge_summary">Discharge summary</option>
              <option value="lab_report">Lab report</option>
            </select>
          </div>
          <div className="field">
            <label>File name</label>
            <input required value={form.file_name} onChange={(e) => setForm({ ...form, file_name: e.target.value })} />
          </div>
        </div>
        <button type="submit">Register metadata</button>
      </form>
      <div className="card table-wrap" style={{ marginTop: "1rem" }}>
        <table>
          <thead><tr><th>File</th><th>Type</th><th>Status</th></tr></thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id}><td>{d.file_name}</td><td>{d.entity_type}</td><td><span className="badge">{d.status}</span></td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

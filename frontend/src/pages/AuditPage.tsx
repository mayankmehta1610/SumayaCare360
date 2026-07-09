import { useEffect, useState } from "react";
import { api } from "../api/client";

export default function AuditPage() {
  const [tab, setTab] = useState<"business" | "api" | "clinical">("business");
  const [logs, setLogs] = useState<any[]>([]);
  const [apiLogs, setApiLogs] = useState<any[]>([]);
  const [clinicalLogs, setClinicalLogs] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [expanded, setExpanded] = useState<string>("");

  async function load() {
    const [a, b, c] = await Promise.all([
      api<any[]>("/audit/logs?limit=200"),
      api<any[]>("/audit/api-logs?limit=200"),
      api<any[]>("/audit/clinical-access?limit=200"),
    ]);
    setLogs(a);
    setApiLogs(b);
    setClinicalLogs(c);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  const filteredBusiness = entityFilter
    ? logs.filter((l) => (l.entity_type || "").includes(entityFilter) || (l.action || "").includes(entityFilter))
    : logs;
  const filteredApi = entityFilter
    ? apiLogs.filter((l) => (l.path || "").includes(entityFilter))
    : apiLogs;

  return (
    <div>
      <h1 className="page-title">Audit & API trails</h1>
      <p className="muted">Immutable business audit · API latency logs · clinical PHI access</p>
      {error && <div className="error">{error}</div>}
      <div className="field" style={{ maxWidth: "320px", marginBottom: "1rem" }}>
        <label>Filter by entity / path / action</label>
        <input value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)} placeholder="e.g. patient, /billing" />
      </div>
      <div className="actions" style={{ marginBottom: "1rem" }}>
        <button type="button" className={tab === "business" ? "" : "secondary"} onClick={() => setTab("business")}>Business audit ({filteredBusiness.length})</button>
        <button type="button" className={tab === "api" ? "" : "secondary"} onClick={() => setTab("api")}>API audit ({filteredApi.length})</button>
        <button type="button" className={tab === "clinical" ? "" : "secondary"} onClick={() => setTab("clinical")}>Clinical access ({clinicalLogs.length})</button>
        <button type="button" className="secondary" onClick={() => load().catch((e) => setError(e.message))}>Refresh</button>
      </div>
      {tab === "business" && (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr><th>Action</th><th>Entity</th><th>When</th><th>Detail</th></tr>
            </thead>
            <tbody>
              {filteredBusiness.map((l) => (
                <tr key={l.id}>
                  <td>{l.action}</td>
                  <td>{l.entity_type} {l.entity_id ? `#${String(l.entity_id).slice(0, 8)}` : ""}</td>
                  <td>{new Date(l.created_at).toLocaleString()}</td>
                  <td>
                    {l.new_values && (
                      <button type="button" className="secondary" onClick={() => setExpanded(expanded === l.id ? "" : l.id)}>View</button>
                    )}
                    {expanded === l.id && <pre style={{ fontSize: "0.7rem" }}>{JSON.stringify(l.new_values, null, 2)}</pre>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {tab === "api" && (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr><th>Method</th><th>Path</th><th>Status</th><th>ms</th><th>Correlation</th></tr>
            </thead>
            <tbody>
              {filteredApi.map((l) => (
                <tr key={l.id}>
                  <td>{l.method}</td>
                  <td>{l.path}</td>
                  <td>{l.status_code}</td>
                  <td>{l.latency_ms}</td>
                  <td>{l.correlation_id ? String(l.correlation_id).slice(0, 8) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {tab === "clinical" && (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr><th>Action</th><th>Entity</th><th>Actor</th><th>When</th></tr>
            </thead>
            <tbody>
              {clinicalLogs.map((l) => (
                <tr key={l.id}>
                  <td>{l.action}</td>
                  <td>{l.entity_type}</td>
                  <td>{l.actor_user_id ? String(l.actor_user_id).slice(0, 8) : "—"}</td>
                  <td>{new Date(l.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

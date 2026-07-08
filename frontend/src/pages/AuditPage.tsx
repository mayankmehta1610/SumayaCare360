import { useEffect, useState } from "react";
import { api } from "../api/client";

export default function AuditPage() {
  const [tab, setTab] = useState<"business" | "api" | "clinical">("business");
  const [logs, setLogs] = useState<any[]>([]);
  const [apiLogs, setApiLogs] = useState<any[]>([]);
  const [clinicalLogs, setClinicalLogs] = useState<any[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api<any[]>("/audit/logs"),
      api<any[]>("/audit/api-logs"),
      api<any[]>("/audit/clinical-access"),
    ])
      .then(([a, b, c]) => {
        setLogs(a);
        setApiLogs(b);
        setClinicalLogs(c);
      })
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <h1 className="page-title">Audit & API trails</h1>
      {error && <div className="error">{error}</div>}
      <div className="actions" style={{ marginBottom: "1rem" }}>
        <button type="button" className={tab === "business" ? "" : "secondary"} onClick={() => setTab("business")}>Business audit</button>
        <button type="button" className={tab === "api" ? "" : "secondary"} onClick={() => setTab("api")}>API audit</button>
        <button type="button" className={tab === "clinical" ? "" : "secondary"} onClick={() => setTab("clinical")}>Clinical access</button>
      </div>
      {tab === "business" && (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr><th>Action</th><th>Entity</th><th>When</th></tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td>{l.action}</td>
                  <td>{l.entity_type} {l.entity_id ? `#${String(l.entity_id).slice(0, 8)}` : ""}</td>
                  <td>{new Date(l.created_at).toLocaleString()}</td>
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
              <tr><th>Method</th><th>Path</th><th>Status</th><th>ms</th></tr>
            </thead>
            <tbody>
              {apiLogs.map((l) => (
                <tr key={l.id}>
                  <td>{l.method}</td>
                  <td>{l.path}</td>
                  <td>{l.status_code}</td>
                  <td>{l.latency_ms}</td>
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

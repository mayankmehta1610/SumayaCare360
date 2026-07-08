import { useEffect, useState } from "react";
import { api } from "../api/client";

export default function AuditPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [apiLogs, setApiLogs] = useState<any[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api<any[]>("/audit/logs"), api<any[]>("/audit/api-logs")])
      .then(([a, b]) => {
        setLogs(a);
        setApiLogs(b);
      })
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <h1 className="page-title">Audit & API trails</h1>
      {error && <div className="error">{error}</div>}
      <div className="grid-2">
        <div className="card table-wrap">
          <h3 style={{ marginTop: 0 }}>Business audit</h3>
          <table>
            <thead>
              <tr>
                <th>Action</th>
                <th>Entity</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td>{l.action}</td>
                  <td>
                    {l.entity_type} {l.entity_id ? `#${String(l.entity_id).slice(0, 8)}` : ""}
                  </td>
                  <td>{new Date(l.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card table-wrap">
          <h3 style={{ marginTop: 0 }}>API audit</h3>
          <table>
            <thead>
              <tr>
                <th>Method</th>
                <th>Path</th>
                <th>Status</th>
                <th>ms</th>
              </tr>
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
      </div>
    </div>
  );
}

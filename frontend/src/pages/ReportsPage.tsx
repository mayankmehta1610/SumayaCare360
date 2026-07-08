import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";

export default function ReportsPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([api<any[]>("/platform/reports"), api<any[]>("/platform/workflows")])
      .then(([r, w]) => {
        setReports(r);
        setWorkflows(w);
      })
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <h1 className="page-title">Reports, BI & Analytics</h1>
      <p className="muted">Clickable KPI drill-downs per requirements STD-006</p>
      {error && <div className="error">{error}</div>}
      <div className="kpi-grid">
        {reports.map((r) => (
          <div key={r.code} className="kpi" onClick={() => r.module_code && navigate(`/modules/${r.module_code}`)} role="button" tabIndex={0}>
            <div className="value">{r.code}</div>
            <div className="label">{r.name}</div>
            <div className="muted" style={{ fontSize: "0.75rem" }}>{r.audience}</div>
          </div>
        ))}
      </div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Workflow definitions (database-driven)</h3>
        <table>
          <thead><tr><th>Workflow</th><th>Module</th><th>Steps</th></tr></thead>
          <tbody>
            {workflows.map((w) => (
              <tr key={w.code}>
                <td>{w.name}</td>
                <td>{w.module_code}</td>
                <td>{(w.steps || []).join(" → ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

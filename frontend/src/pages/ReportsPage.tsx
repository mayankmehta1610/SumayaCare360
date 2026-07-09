import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import DataTable from "../components/DataTable";
import { MODULE_CATALOG } from "../data/moduleCatalog";
import { downloadCsv, downloadJson, rowsToCsv } from "../utils/export";

const MODULE_ROUTES = Object.fromEntries(MODULE_CATALOG.map((m) => [m.code, m.route]));

type ReportResult = {
  code: string;
  name: string;
  metrics: Record<string, unknown>;
  rows: Record<string, unknown>[];
  row_count: number;
  csv?: string;
};

export default function ReportsPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [coverage, setCoverage] = useState<any>(null);
  const [selected, setSelected] = useState("");
  const [result, setResult] = useState<ReportResult | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [rowPage, setRowPage] = useState(1);
  const rowPageSize = 25;
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      api<any[]>("/platform/reports"),
      api<any[]>("/platform/workflows"),
      api<any>("/platform/features/coverage"),
    ])
      .then(([r, w, c]) => {
        setReports(r);
        setWorkflows(w);
        setCoverage(c);
      })
      .catch((e) => setError(e.message));
  }, []);

  async function runReport(code: string) {
    setLoading(true);
    setError("");
    setRowPage(1);
    try {
      const res = await api<ReportResult>(`/platform/reports/${code}/run`, {
        method: "POST",
        body: JSON.stringify({ date_from: dateFrom || undefined, date_to: dateTo || undefined }),
      });
      setResult(res);
      setSelected(code);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function exportReport(fmt: "json" | "csv") {
    if (!result) return;
    const base = `report-${result.code}`;
    if (fmt === "csv") {
      const csv = result.csv || rowsToCsv(result.rows);
      downloadCsv(csv, `${base}.csv`);
    } else {
      downloadJson({ metrics: result.metrics, rows: result.rows }, `${base}.json`);
    }
  }

  const pagedRows = result?.rows?.slice((rowPage - 1) * rowPageSize, rowPage * rowPageSize) ?? [];
  const rowCols = result?.rows?.[0] ? Object.keys(result.rows[0]).map((k) => ({ key: k, label: k })) : [];

  return (
    <div>
      <h1 className="page-title">Reports, BI & Analytics</h1>
      <p className="muted">
        Run operational reports from PostgreSQL · Feature coverage {coverage?.percent ?? "—"}% ({coverage?.implemented}/{coverage?.total})
      </p>
      {error && <div className="error">{error}</div>}
      <div className="grid-2" style={{ marginBottom: "1rem" }}>
        <div className="field">
          <label>Date from</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="field">
          <label>Date to</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
      </div>
      <div className="kpi-grid">
        {reports.map((r) => (
          <div
            key={r.code}
            className="kpi"
            onClick={() => runReport(r.code)}
            role="button"
            tabIndex={0}
            style={{ outline: selected === r.code ? "2px solid var(--accent)" : undefined }}
          >
            <div className="value">{r.code}</div>
            <div className="label">{r.name}</div>
            <div className="muted" style={{ fontSize: "0.75rem" }}>{r.audience}</div>
            <button
              type="button"
              className="secondary"
              style={{ marginTop: "0.5rem", fontSize: "0.75rem" }}
              onClick={(e) => { e.stopPropagation(); r.module_code && navigate(MODULE_ROUTES[r.module_code] || "/module-map"); }}
            >
              Drill-down →
            </button>
          </div>
        ))}
      </div>
      {loading && <p className="muted">Running report…</p>}
      {result && (
        <>
          <div className="card" style={{ marginTop: "1rem" }}>
            <div className="actions" style={{ justifyContent: "space-between", marginBottom: "0.75rem" }}>
              <h3 style={{ margin: 0 }}>{result.name} — live metrics</h3>
              <div className="actions">
                <button type="button" className="secondary" onClick={() => exportReport("json")}>Export JSON</button>
                <button type="button" className="secondary" onClick={() => exportReport("csv")}>Export CSV</button>
              </div>
            </div>
            <table>
              <tbody>
                {Object.entries(result.metrics).map(([k, v]) => (
                  <tr key={k}><td><strong>{k}</strong></td><td>{typeof v === "object" ? JSON.stringify(v) : String(v)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.rows.length > 0 && (
            <DataTable
              title={`Detail rows (${result.row_count})`}
              columns={rowCols}
              rows={pagedRows}
              rowKey={(r) => String(r.id ?? r.order_no ?? JSON.stringify(r))}
              total={result.rows.length}
              page={rowPage}
              pageSize={rowPageSize}
              onPageChange={setRowPage}
              search=""
              onSearchChange={() => {}}
            />
          )}
        </>
      )}
      <div className="card" style={{ marginTop: "1rem" }}>
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

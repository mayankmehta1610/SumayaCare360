import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, FileSpreadsheet, Play, Printer } from "lucide-react";
import { api } from "../api/client";
import DataTable from "../components/DataTable";
import { MODULE_CATALOG } from "../data/moduleCatalog";
import { downloadCsv, downloadExcel, downloadJson, rowsToCsv } from "../utils/export";

const MODULE_ROUTES = Object.fromEntries(MODULE_CATALOG.map((m) => [m.code, m.route]));
type ReportResult = { code: string; name: string; metrics: Record<string, unknown>; rows: Record<string, unknown>[]; row_count: number; csv?: string };

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
    Promise.all([api<any[]>("/platform/reports"), api<any[]>("/platform/workflows"), api<any>("/platform/features/coverage")])
      .then(([r, w, c]) => { setReports(r); setWorkflows(w); setCoverage(c); })
      .catch((e) => setError(e.message));
  }, []);

  async function runReport(code: string) {
    setLoading(true); setError(""); setRowPage(1);
    try {
      const res = await api<ReportResult>(`/platform/reports/${code}/run`, { method: "POST", body: JSON.stringify({ date_from: dateFrom || undefined, date_to: dateTo || undefined }) });
      setResult(res); setSelected(code);
      setTimeout(() => document.getElementById("report-output")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  function exportReport(fmt: "json" | "csv") {
    if (!result) return;
    const base = `report-${result.code}`;
    if (fmt === "csv") downloadCsv(result.csv || rowsToCsv(result.rows), `${base}.csv`);
    else downloadJson({ metrics: result.metrics, rows: result.rows }, `${base}.json`);
  }

  const grouped = useMemo(() => reports.reduce((acc: Record<string, any[]>, report) => {
    (acc[report.category || "Other"] ||= []).push(report); return acc;
  }, {}), [reports]);
  const pagedRows = result?.rows?.slice((rowPage - 1) * rowPageSize, rowPage * rowPageSize) ?? [];
  const rowCols = result?.rows?.[0] ? Object.keys(result.rows[0]).map((key) => ({ key, label: key.replace(/_/g, " ") })) : [];

  return <div className="reports-page">
    <header className="reports-hero">
      <div><div className="eyebrow">Hospital intelligence</div><h1>Reports & operational analytics</h1><p>{reports.length} live reports across patient administration, clinical operations, inpatient care, diagnostics, finance and governance.</p></div>
      <div className="reports-coverage"><BarChart3 size={22} /><span><strong>{coverage?.percent ?? "—"}%</strong> feature coverage</span></div>
    </header>
    {error && <div className="error">{error}</div>}
    <div className="report-filters"><div className="field"><label>Date from</label><input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></div><div className="field"><label>Date to</label><input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></div></div>
    <div className="report-catalog">
      {Object.entries(grouped).map(([category, categoryReports]) => <section className="report-category" key={category}>
        <h2>{category}<span>{categoryReports.length}</span></h2>
        <div className="report-card-grid">{categoryReports.map((r) => <article key={r.code} className={`report-card ${selected === r.code ? "active" : ""}`}>
          <span className="report-card__icon"><BarChart3 size={19} /></span><div><h3>{r.name}</h3><p>{r.audience}</p></div>
          <div className="report-card__actions"><button onClick={() => runReport(r.code)}><Play size={14} /> Run</button><button className="secondary" onClick={() => r.module_code && navigate(MODULE_ROUTES[r.module_code] || "/module-map")}>Open module</button></div>
        </article>)}</div>
      </section>)}
    </div>
    {loading && <div className="card muted">Running report against live hospital data...</div>}
    {result && <div id="report-output" className="report-output-wrap">
      <div className="card report-output">
        <div className="report-output__head"><div><div className="eyebrow">Generated report</div><h2>{result.name}</h2></div><div className="actions">
          <button className="secondary" onClick={() => downloadExcel(result.rows, `report-${result.code}.xls`, result.name)}><FileSpreadsheet size={15} /> Excel</button>
          <button className="secondary" onClick={() => window.print()}><Printer size={15} /> PDF / Print</button>
          <button className="secondary" onClick={() => exportReport("csv")}>CSV</button><button className="secondary" onClick={() => exportReport("json")}>JSON</button>
        </div></div>
        <div className="report-metrics">{Object.entries(result.metrics).filter(([key]) => key !== "filters").map(([key, value]) => <div key={key}><span>{key.replace(/_/g, " ")}</span><strong>{typeof value === "object" ? JSON.stringify(value) : String(value)}</strong></div>)}</div>
      </div>
      {result.rows.length > 0 && <DataTable title={`Detail rows (${result.row_count})`} columns={rowCols} rows={pagedRows} rowKey={(r) => String(r.id ?? r.order_no ?? r.mrn ?? JSON.stringify(r))} total={result.rows.length} page={rowPage} pageSize={rowPageSize} onPageChange={setRowPage} search="" onSearchChange={() => {}} />}
    </div>}
    <div className="card workflow-register"><h3>Configured hospital workflows</h3><div className="table-wrap"><table><thead><tr><th>Workflow</th><th>Module</th><th>End-to-end steps</th></tr></thead><tbody>{workflows.map((w) => <tr key={w.code}><td><strong>{w.name}</strong></td><td>{w.module_code}</td><td>{(w.steps || []).join(" → ")}</td></tr>)}</tbody></table></div></div>
  </div>;
}

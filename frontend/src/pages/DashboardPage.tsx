import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

type Kpi = { code: string; label: string; value: number; drilldown: string };

type Phase = {
  id: string;
  name: string;
  description: string;
  hub_route: string;
  icon: string;
  module_count: number;
};

export default function DashboardPage() {
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [coverage, setCoverage] = useState<{ percent: number; implemented: number; total: number } | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loadingDemo, setLoadingDemo] = useState(false);
  const navigate = useNavigate();
  const { session } = useAuth();
  const prefix = session?.tenant_code ? `/${session.tenant_code}` : "";
  const patientCount = kpis.find((k) => k.code === "patients")?.value ?? 0;
  const isAdmin = session?.role_code === "TENANT_ADMIN" || session?.role_code === "SUPER_ADMIN";

  async function load() {
    const [kpiData, flowData, cov] = await Promise.all([
      api<{ kpis: Kpi[] }>("/dashboard/summary"),
      api<{ phases: Phase[] }>("/platform/module-flow"),
      api<{ percent: number; implemented: number; total: number }>("/platform/features/coverage"),
    ]);
    setKpis(kpiData.kpis);
    setPhases(flowData.phases);
    setCoverage(cov);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function reloadDemo() {
    setLoadingDemo(true);
    setError("");
    try {
      const res = await api<{ patients: number; reloaded: boolean }>("/admin/demo-reload", { method: "POST" });
      setMsg(`Demo data loaded — ${res.patients} patients in database`);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingDemo(false);
    }
  }

  return (
    <div>
      <h1 className="page-title">Operations dashboard</h1>
      <p className="muted">
        All KPIs load from PostgreSQL · click to drill down
        {coverage && (
          <> · Excel feature coverage <strong>{coverage.percent}%</strong> ({coverage.implemented}/{coverage.total})</>
        )}
      </p>
      {error && <div className="error">{error}</div>}
      {msg && <div className="success">{msg}</div>}

      {patientCount < 5 && isAdmin && (
        <div className="card" style={{ marginBottom: "1rem", borderColor: "var(--warn, #c90)" }}>
          <h3 style={{ marginTop: 0 }}>Database is empty or incomplete</h3>
          <p className="muted">Load the full demo replay dataset (8 patients, lab, IPD, claims, all 36 modules).</p>
          <button type="button" disabled={loadingDemo} onClick={() => reloadDemo()}>
            {loadingDemo ? "Loading…" : "Load demo data now"}
          </button>
        </div>
      )}

      <div className="card" style={{ marginBottom: "1.25rem", background: "linear-gradient(135deg, var(--brand-soft), #fff)" }}>
        <h3 style={{ marginTop: 0 }}>Care journey — start here</h3>
        <p className="muted">Patient → appointment → encounter → clinical chart → discharge → billing → payment</p>
        <div className="actions">
          <Link to={`${prefix}/care-journey`} className="button-link">Launch care journey</Link>
          <Link to={`${prefix}/module-map`} className="secondary button-link">View all modules</Link>
        </div>
      </div>

      <div className="kpi-grid">
        {kpis.map((k) => (
          <div key={k.code} className="kpi" onClick={() => navigate(`${prefix}${k.drilldown}`)} role="button" tabIndex={0}>
            <div className="value">{k.value}</div>
            <div className="label">{k.label}</div>
          </div>
        ))}
      </div>

      <h2 style={{ fontFamily: "var(--display)", fontSize: "1.2rem" }}>Module phases (logical order)</h2>
      <div className="flow-phase-cards">
        {phases.map((p) => (
          <div key={p.id} className="card flow-phase-card" onClick={() => navigate(`${prefix}${p.hub_route}`)} role="button" tabIndex={0}>
            <div style={{ fontSize: "1.5rem" }}>{p.icon}</div>
            <strong>{p.name}</strong>
            <p className="muted" style={{ fontSize: "0.8rem", margin: "0.35rem 0" }}>{p.description}</p>
            <span className="badge">{p.module_count} modules</span>
          </div>
        ))}
      </div>
    </div>
  );
}

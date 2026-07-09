import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, PlayCircle, Route } from "lucide-react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import NavIcon from "../components/ui/NavIcon";

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
      <header className="page-header">
        <h1 className="page-title">Operations dashboard</h1>
        <p className="page-subtitle">
          Live KPIs from PostgreSQL · click any metric to drill down
          {coverage && (
            <> · Feature coverage <strong>{coverage.percent}%</strong> ({coverage.implemented}/{coverage.total})</>
          )}
        </p>
      </header>

      {error && <div className="error">{error}</div>}
      {msg && <div className="success">{msg}</div>}

      {patientCount < 5 && isAdmin && (
        <div className="card card--highlight" style={{ marginBottom: "1.25rem" }}>
          <h3 style={{ marginTop: 0 }}>Database is empty or incomplete</h3>
          <p className="muted">Load the full demo replay dataset (8 patients, lab, IPD, claims, all 36 modules).</p>
          <button type="button" disabled={loadingDemo} onClick={() => reloadDemo()}>
            {loadingDemo ? "Loading…" : "Load demo data now"}
          </button>
        </div>
      )}

      <div className="card card--hero" style={{ marginBottom: "1.5rem" }}>
        <h3 style={{ marginTop: 0, fontFamily: "var(--display)", fontSize: "1.35rem" }}>Care journey — start here</h3>
        <p className="muted">Patient → appointment → encounter → clinical chart → discharge → billing → payment</p>
        <div className="actions" style={{ marginTop: "1rem" }}>
          <Link to={`${prefix}/care-journey`} className="button-link">
            <Route size={16} /> Launch care journey
          </Link>
          <Link to={`${prefix}/demo-tour`} className="button-link secondary">
            <PlayCircle size={16} /> Voice demo tour
          </Link>
          <Link to={`${prefix}/module-map`} className="button-link secondary">
            View all modules <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      <div className="kpi-grid">
        {kpis.map((k) => (
          <div
            key={k.code}
            className="kpi"
            onClick={() => navigate(`${prefix}${k.drilldown}`)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && navigate(`${prefix}${k.drilldown}`)}
          >
            <div className="kpi__icon">
              <NavIcon code={k.code} size={20} />
            </div>
            <div className="value">{k.value}</div>
            <div className="label">{k.label}</div>
          </div>
        ))}
      </div>

      <h2 style={{ fontFamily: "var(--display)", fontSize: "1.35rem", marginBottom: "1rem" }}>Module phases</h2>
      <div className="flow-phase-cards">
        {phases.map((p) => (
          <div
            key={p.id}
            className="card flow-phase-card"
            onClick={() => navigate(`${prefix}${p.hub_route}`)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && navigate(`${prefix}${p.hub_route}`)}
          >
            <div className="flow-phase-card__icon">
              <NavIcon route={p.hub_route} size={22} />
            </div>
            <strong>{p.name}</strong>
            <p className="muted" style={{ fontSize: "0.8rem", margin: "0.35rem 0" }}>{p.description}</p>
            <span className="badge">{p.module_count} modules</span>
          </div>
        ))}
      </div>
    </div>
  );
}

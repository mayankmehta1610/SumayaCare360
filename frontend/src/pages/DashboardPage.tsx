import { useEffect, useState } from "react";
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
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { session } = useAuth();
  const prefix = session?.tenant_code ? `/${session.tenant_code}` : "";

  useEffect(() => {
    Promise.all([
      api<{ kpis: Kpi[] }>("/dashboard/summary"),
      api<{ phases: Phase[] }>("/platform/module-flow"),
    ])
      .then(([kpiData, flowData]) => {
        setKpis(kpiData.kpis);
        setPhases(flowData.phases);
      })
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <h1 className="page-title">Operations dashboard</h1>
      <p className="muted">Click KPIs to drill down · follow phased modules for the full hospital workflow</p>
      {error && <div className="error">{error}</div>}

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

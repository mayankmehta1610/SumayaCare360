import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";

type Kpi = { code: string; label: string; value: number; drilldown: string };

export default function DashboardPage() {
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    api<{ kpis: Kpi[] }>("/dashboard/summary")
      .then((d) => setKpis(d.kpis))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <h1 className="page-title">Operations dashboard</h1>
      <p className="muted">Clickable KPIs drill into filtered modules (STD-006).</p>
      {error && <div className="error">{error}</div>}
      <div className="kpi-grid">
        {kpis.map((k) => (
          <div key={k.code} className="kpi" onClick={() => navigate(k.drilldown)} role="button" tabIndex={0}>
            <div className="value">{k.value}</div>
            <div className="label">{k.label}</div>
          </div>
        ))}
      </div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>End-to-end ready</h3>
        <p className="muted">
          Register patient → book appointment → OPD/teleconsult → notes/eRx → tariff invoice → tokenized payment → audit trail.
          All dropdowns load from PostgreSQL masters.
        </p>
      </div>
    </div>
  );
}

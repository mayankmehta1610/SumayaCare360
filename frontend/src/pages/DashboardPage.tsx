import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, PlayCircle, Route } from "lucide-react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import NavIcon from "../components/ui/NavIcon";
import { canAccessRoute, type NavPhase } from "../utils/roleAccess";

type Kpi = { code: string; label: string; value: number; drilldown: string };

export default function DashboardPage() {
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loadingDemo, setLoadingDemo] = useState(false);
  const navigate = useNavigate();
  const { session, navigation } = useAuth();
  const prefix = session?.tenant_code ? `/${session.tenant_code}` : "";
  const patientCount = kpis.find((k) => k.code === "patients")?.value ?? 0;
  const isAdmin = session?.role_code === "TENANT_ADMIN" || session?.role_code === "SUPER_ADMIN";
  const phases = (navigation?.phases || []) as NavPhase[];

  const allowed = new Set(navigation?.allowed_routes || []);
  const visibleKpis = kpis.filter((k) => allowed.has(k.drilldown));
  const showCareJourney = allowed.has("/care-journey");
  const showDemoTour = allowed.has("/demo-tour");
  const showModuleMap = allowed.has("/module-map");

  async function load() {
    const kpiData = await api<{ kpis: Kpi[] }>("/dashboard/summary");
    setKpis(kpiData.kpis);
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

  const roleTitle = session?.role_code?.replace(/_/g, " ") || "Staff";

  return (
    <div>
      <header className="page-header">
        <h1 className="page-title">{roleTitle} dashboard</h1>
        <p className="page-subtitle">
          Metrics and shortcuts for your role · data from PostgreSQL
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

      {(showCareJourney || showDemoTour || showModuleMap) && (
        <div className="card card--hero" style={{ marginBottom: "1.5rem" }}>
          <h3 style={{ marginTop: 0, fontFamily: "var(--display)", fontSize: "1.35rem" }}>Quick actions</h3>
          <div className="actions" style={{ marginTop: "1rem" }}>
            {showCareJourney && (
              <Link to={`${prefix}/care-journey`} className="button-link">
                <Route size={16} /> Care journey
              </Link>
            )}
            {showDemoTour && (
              <Link to={`${prefix}/demo-tour`} className="button-link secondary">
                <PlayCircle size={16} /> Demo tour
              </Link>
            )}
            {showModuleMap && (
              <Link to={`${prefix}/module-map`} className="button-link secondary">
                All modules <ArrowRight size={14} />
              </Link>
            )}
          </div>
        </div>
      )}

      {visibleKpis.length > 0 ? (
        <div className="kpi-grid">
          {visibleKpis.map((k) => (
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
      ) : (
        <div className="card muted" style={{ marginBottom: "1.5rem" }}>
          Use the sidebar to open your assigned modules.
        </div>
      )}

      {phases.length > 0 && (
        <>
          <h2 style={{ fontFamily: "var(--display)", fontSize: "1.35rem", marginBottom: "1rem" }}>Your modules</h2>
          <div className="flow-phase-cards">
            {phases.map((p) => {
              const target = p.modules[0]?.route || (p.hub_visible !== false ? p.hub_route : null);
              if (!target || !canAccessRoute(navigation, target)) return null;
              return (
                <div
                  key={p.id}
                  className="card flow-phase-card"
                  onClick={() => navigate(`${prefix}${target}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && navigate(`${prefix}${target}`)}
                >
                  <div className="flow-phase-card__icon">
                    <NavIcon route={target} size={22} />
                  </div>
                  <strong>{p.name}</strong>
                  <span className="badge">{p.module_count} modules</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

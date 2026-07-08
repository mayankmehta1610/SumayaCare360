import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

type Phase = {
  id: string;
  name: string;
  description: string;
  hub_route: string;
  icon: string;
  modules: { code: string; name: string; route: string; is_dedicated: boolean }[];
  module_count: number;
};

export default function ModuleMapPage() {
  const { session } = useAuth();
  const prefix = session?.tenant_code ? `/${session.tenant_code}` : "";
  const [phases, setPhases] = useState<Phase[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ phases: Phase[]; total_modules: number }>("/platform/module-flow")
      .then((d) => {
        setPhases(d.phases);
        setTotal(d.total_modules);
      })
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <h1 className="page-title">Complete module map</h1>
      <p className="muted">
        All {total} modules in logical care & operations order — click any phase to open its hub.
      </p>
      {error && <div className="error">{error}</div>}
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <Link to={`${prefix}/care-journey`} className="button-link" style={{ fontSize: "1.05rem" }}>
          Start end-to-end care journey →
        </Link>
      </div>
      {phases.map((phase) => (
        <section key={phase.id} className="flow-phase-section">
          <div className="flow-phase-header">
            <h2>
              {phase.icon} {phase.name}
            </h2>
            <Link to={`${prefix}${phase.hub_route}`}>Open hub →</Link>
          </div>
          <p className="muted">{phase.description}</p>
          <div className="flow-timeline">
            {phase.modules.map((mod, i) => (
              <div key={mod.code} className="flow-timeline-item">
                <div className="flow-timeline-dot">{i + 1}</div>
                <Link to={`${prefix}${mod.route}`} className="flow-timeline-label">
                  {mod.name}
                </Link>
                {!mod.is_dedicated && (
                  <Link to={`${prefix}/modules/${mod.code}`} className="flow-timeline-sub muted">
                    records
                  </Link>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

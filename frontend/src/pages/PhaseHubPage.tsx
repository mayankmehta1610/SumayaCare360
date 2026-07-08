import { Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

type FlowModule = {
  code: string;
  name: string;
  route: string;
  order: number;
  is_dedicated: boolean;
  is_virtual?: boolean;
  submodules: string[];
  next_modules: { code: string; name: string; route: string }[];
  quick_links: { label: string; route: string }[];
  super_only?: boolean;
};

type Phase = {
  id: string;
  name: string;
  description: string;
  hub_route: string;
  icon: string;
  modules: FlowModule[];
  module_count: number;
};

export default function PhaseHubPage() {
  const { phaseId = "" } = useParams();
  const { session } = useAuth();
  const prefix = session?.tenant_code ? `/${session.tenant_code}` : "";
  const [phase, setPhase] = useState<Phase | null>(null);
  const [allPhases, setAllPhases] = useState<Phase[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ phases: Phase[] }>("/platform/module-flow")
      .then((d) => {
        setAllPhases(d.phases);
        const found = d.phases.find((p) => p.id === phaseId);
        if (!found) throw new Error("Phase not found");
        setPhase(found);
      })
      .catch((e) => setError(e.message));
  }, [phaseId]);

  if (error) return <div className="error">{error}</div>;
  if (!phase) return <div className="card">Loading phase hub...</div>;

  const phaseIdx = allPhases.findIndex((p) => p.id === phaseId);
  const prevPhase = phaseIdx > 0 ? allPhases[phaseIdx - 1] : null;
  const nextPhase = phaseIdx < allPhases.length - 1 ? allPhases[phaseIdx + 1] : null;

  return (
    <div>
      <h1 className="page-title">
        {phase.icon} {phase.name}
      </h1>
      <p className="muted">{phase.description} · {phase.module_count} interconnected modules</p>

      <div className="flow-phase-nav">
        {prevPhase && (
          <Link to={`${prefix}${prevPhase.hub_route}`} className="secondary" style={{ padding: "0.4rem 0.8rem" }}>
            ← {prevPhase.name}
          </Link>
        )}
        <Link to={`${prefix}/module-map`} className="secondary" style={{ padding: "0.4rem 0.8rem" }}>
          Full module map
        </Link>
        {nextPhase && (
          <Link to={`${prefix}${nextPhase.hub_route}`} className="secondary" style={{ padding: "0.4rem 0.8rem" }}>
            {nextPhase.name} →
          </Link>
        )}
      </div>

      <div className="flow-module-grid">
        {phase.modules
          .filter((m) => !m.super_only || session?.role_code === "SUPER_ADMIN")
          .map((mod, i) => (
            <div key={mod.code} className="card flow-module-card">
              <div className="flow-step-num">{i + 1}</div>
              <h3 style={{ marginTop: 0 }}>{mod.name}</h3>
              {mod.submodules.length > 0 && (
                <p className="muted" style={{ fontSize: "0.8rem" }}>
                  {mod.submodules.slice(0, 3).join(" · ")}
                  {mod.submodules.length > 3 ? " …" : ""}
                </p>
              )}
              <div className="actions" style={{ marginTop: "0.75rem", flexWrap: "wrap" }}>
                <Link to={`${prefix}${mod.route}`} className="button-link">
                  Open module
                </Link>
              </div>
              {mod.quick_links.length > 0 && (
                <div className="flow-quick-links">
                  {mod.quick_links.map((l) => (
                    <Link key={l.route} to={`${prefix}${l.route}`}>
                      {l.label}
                    </Link>
                  ))}
                </div>
              )}
              {mod.next_modules.length > 0 && (
                <div className="flow-next-hint">
                  <span className="muted">Then → </span>
                  {mod.next_modules.map((n, j) => (
                    <span key={n.code}>
                      {j > 0 && ", "}
                      <Link to={`${prefix}${n.route}`}>{n.name}</Link>
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}

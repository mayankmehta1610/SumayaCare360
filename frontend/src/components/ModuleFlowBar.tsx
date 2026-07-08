import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

type ModuleRef = { code: string; name: string; route: string };
type FlowModule = {
  code: string;
  name: string;
  route: string;
  order: number;
  is_dedicated: boolean;
  next_modules: ModuleRef[];
  prev_module: ModuleRef | null;
  quick_links: { label: string; route: string; super_only?: boolean }[];
  super_only?: boolean;
};
type FlowDetail = {
  module: FlowModule;
  phase: { id: string; name: string; hub_route: string };
};

type Props = {
  moduleCode?: string;
  compact?: boolean;
};

export default function ModuleFlowBar({ moduleCode, compact }: Props) {
  const { session } = useAuth();
  const prefix = session?.tenant_code ? `/${session.tenant_code}` : "";
  const [flow, setFlow] = useState<FlowDetail | null>(null);

  useEffect(() => {
    if (!moduleCode) return;
    api<FlowDetail>(`/platform/module-flow/${moduleCode}`)
      .then(setFlow)
      .catch(() => setFlow(null));
  }, [moduleCode]);

  if (!flow) return null;
  const { module: mod, phase } = flow;

  return (
    <div className={`flow-bar ${compact ? "flow-bar-compact" : ""}`}>
      <div className="flow-bar-phase">
        <Link to={`${prefix}${phase.hub_route}`}>{phase.name}</Link>
      </div>
      <div className="flow-bar-nav">
        {mod.prev_module && (
          <Link to={`${prefix}${mod.prev_module.route}`} className="flow-link-prev">
            ← {mod.prev_module.name}
          </Link>
        )}
        {mod.next_modules.map((n) => (
          <Link key={n.code} to={`${prefix}${n.route}`} className="flow-link-next">
            {n.name} →
          </Link>
        ))}
      </div>
      {!compact && mod.quick_links.length > 0 && (
        <div className="flow-bar-links">
          {mod.quick_links
            .filter((l) => !l.super_only || session?.role_code === "SUPER_ADMIN")
            .map((l) => (
              <Link key={l.route} to={`${prefix}${l.route}`} className="flow-quick-link">
                {l.label}
              </Link>
            ))}
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { api } from "../api/client";

type FeatureRow = {
  feature_id: string;
  submodule: string;
  workflow_stage: string;
  feature_name: string;
  priority: string;
  implemented: boolean;
};

type Coverage = {
  total: number;
  implemented: number;
  percent: number;
  must_have: number;
  must_have_implemented: number;
};

type Props = {
  moduleCode: string;
  submodule?: string;
  collapsed?: boolean;
};

const STAGE_LABELS: Record<string, string> = {
  create: "Create",
  update: "Update",
  view: "View/Search",
  approve: "Approve",
  workflow: "Workflow",
  documents: "Documents",
  rules: "Rules",
  report: "Report",
  notify: "Notify",
  audit: "Audit",
  mobile: "Mobile",
  integration: "Integration",
};

export default function ModuleFeaturePanel({ moduleCode, submodule, collapsed = true }: Props) {
  const [open, setOpen] = useState(!collapsed);
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [features, setFeatures] = useState<FeatureRow[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "done">("all");

  useEffect(() => {
    const qs = submodule ? `&submodule=${encodeURIComponent(submodule)}` : "";
    Promise.all([
      api<Coverage>(`/platform/features/coverage?module_code=${encodeURIComponent(moduleCode)}`),
      api<FeatureRow[]>(`/platform/features?module_code=${encodeURIComponent(moduleCode)}${qs}`),
    ])
      .then(([c, f]) => {
        setCoverage(c);
        setFeatures(f);
      })
      .catch(() => {});
  }, [moduleCode, submodule]);

  const shown = features.filter((f) => {
    if (filter === "pending") return !f.implemented;
    if (filter === "done") return f.implemented;
    return true;
  });

  if (!coverage) return null;

  return (
    <div className="card" style={{ marginBottom: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
        <div>
          <strong>Feature coverage</strong>
          <span className="muted" style={{ marginLeft: "0.5rem", fontSize: "0.85rem" }}>
            {coverage.implemented}/{coverage.total} ({coverage.percent}%) · Must-have {coverage.must_have_implemented}/{coverage.must_have}
          </span>
        </div>
        <button type="button" className="secondary" onClick={() => setOpen(!open)}>
          {open ? "Hide features" : "Show Excel features"}
        </button>
      </div>
      {open && (
        <div style={{ marginTop: "0.75rem" }}>
          <div className="actions" style={{ marginBottom: "0.5rem" }}>
            {(["all", "pending", "done"] as const).map((f) => (
              <button key={f} type="button" className={filter === f ? "" : "secondary"} onClick={() => setFilter(f)}>
                {f === "all" ? "All" : f === "pending" ? "Pending" : "Implemented"}
              </button>
            ))}
          </div>
          <div style={{ maxHeight: "200px", overflow: "auto", fontSize: "0.8rem" }}>
            <table>
              <thead>
                <tr><th>ID</th><th>Stage</th><th>Feature</th><th>Priority</th><th>Status</th></tr>
              </thead>
              <tbody>
                {shown.slice(0, 80).map((f) => (
                  <tr key={f.feature_id}>
                    <td>{f.feature_id}</td>
                    <td>{STAGE_LABELS[f.workflow_stage] || f.workflow_stage}</td>
                    <td>{f.feature_name}</td>
                    <td>{f.priority}</td>
                    <td><span className={`badge ${f.implemented ? "" : "secondary"}`}>{f.implemented ? "✓" : "—"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {shown.length > 80 && <p className="muted">Showing 80 of {shown.length} features</p>}
          </div>
        </div>
      )}
    </div>
  );
}

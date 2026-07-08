import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "../api/client";

type Area = { code: string; name: string; resources: string[]; base_path: string };
type Coverage = {
  expanded_api_endpoints: number;
  feature_backlog_total: number;
  platform_modules: number;
  tenant_module_records: number;
  tenant_expanded_records: number;
};

export default function EngineeringHubPage() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api<{ areas: Area[] }>("/platform/expanded-api"),
      api<Coverage>("/platform/requirements-coverage"),
    ])
      .then(([exp, cov]) => {
        setAreas(exp.areas);
        setCoverage(cov);
      })
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <h1 className="page-title">Engineering & expanded API</h1>
      <p className="muted">500 expanded API endpoints across 10 platform engineering areas</p>
      {error && <div className="error">{error}</div>}
      {coverage && (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <strong>Requirements coverage</strong>
          <ul>
            <li>Feature backlog: {coverage.feature_backlog_total} rows (routed via module workflows)</li>
            <li>Expanded API: {coverage.expanded_api_endpoints} endpoints registered</li>
            <li>Platform modules: {coverage.platform_modules}</li>
            <li>Tenant module records: {coverage.tenant_module_records}</li>
            <li>Tenant expanded records: {coverage.tenant_expanded_records}</li>
          </ul>
        </div>
      )}
      <div className="grid-2">
        {areas.map((a) => (
          <div className="card" key={a.code}>
            <h3 style={{ marginTop: 0 }}>{a.name}</h3>
            <p className="muted">{a.resources.length} sub-resources · {a.base_path}</p>
            <Link to={`/engineering/${a.code}`}>Open area →</Link>
          </div>
        ))}
      </div>
    </div>
  );
}

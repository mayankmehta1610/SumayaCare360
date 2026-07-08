import { useEffect, useState } from "react";
import { api } from "../api/client";

const RESOURCES = [
  "countries",
  "genders",
  "specialties",
  "diseases",
  "medicines",
  "lab-tests",
  "tariffs",
  "clinical-templates",
  "notification-templates",
  "consent-templates",
  "video-providers",
  "location-purposes",
  "insurance-payers",
  "room-categories",
  "beds",
];

export default function MastersPage() {
  const [resource, setResource] = useState("specialties");
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api<any[]>(`/masters/${resource}`)
      .then(setRows)
      .catch((e) => setError(e.message));
  }, [resource]);

  return (
    <div>
      <h1 className="page-title">Configuration masters</h1>
      <p className="muted">No hard-coded business dropdowns — values load from PostgreSQL.</p>
      {error && <div className="error">{error}</div>}
      <div className="card">
        <div className="field">
          <label>Master resource</label>
          <select value={resource} onChange={(e) => setResource(e.target.value)}>
            {RESOURCES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Status</th>
                <th>Extra</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id || r.code}>
                  <td>{r.code}</td>
                  <td>{r.name || r.label}</td>
                  <td>{r.status}</td>
                  <td>
                    {r.amount != null && `₹${r.amount}`}
                    {r.icd_code && `ICD ${r.icd_code}`}
                    {r.permission && r.permission}
                    {r.capabilities && JSON.stringify(r.capabilities)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

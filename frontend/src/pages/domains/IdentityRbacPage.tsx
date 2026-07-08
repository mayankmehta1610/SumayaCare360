import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import ModuleFlowBar from "../../components/ModuleFlowBar";

export default function IdentityRbacPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api<any[]>("/admin/users").then(setUsers).catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <ModuleFlowBar moduleCode="identity-rbac-and-security" compact />
      <h1 className="page-title">Identity, RBAC & security</h1>
      <p className="muted">Users · roles · permissions · MFA · session control</p>
      <div className="actions" style={{ marginBottom: "1rem" }}>
        <Link to="/settings/mfa" className="secondary button-link">MFA settings</Link>
        <Link to="/audit" className="secondary button-link">Audit trail</Link>
        <Link to="/administration" className="secondary button-link">Administration</Link>
      </div>
      {error && <div className="error">{error}</div>}
      <div className="kpi-grid">
        <div className="kpi"><div className="value">{users.length}</div><div className="label">Active users</div></div>
        <div className="kpi"><div className="value">{users.filter((u) => u.status === "active").length}</div><div className="label">Enabled</div></div>
      </div>
      <div className="card table-wrap">
        <h3 style={{ marginTop: 0 }}>Users & role assignments</h3>
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}><td>{u.full_name}</td><td>{u.email}</td><td><span className="badge">{u.role_code}</span></td><td>{u.status}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

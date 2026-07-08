import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import ModuleFlowBar from "../../components/ModuleFlowBar";

const ROLES = ["TENANT_ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST", "BILLING_STAFF"];

export default function IdentityRbacPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ email: "", full_name: "", role_code: "RECEPTIONIST", password: "Welcome@360" });

  async function load() {
    setUsers(await api<any[]>("/admin/users"));
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function createUser(e: FormEvent) {
    e.preventDefault();
    await api("/admin/users", { method: "POST", body: JSON.stringify(form) });
    setMsg("User created");
    setForm({ email: "", full_name: "", role_code: "RECEPTIONIST", password: "Welcome@360" });
    await load();
  }

  return (
    <div>
      <ModuleFlowBar moduleCode="identity-rbac-and-security" compact />
      <h1 className="page-title">Identity, RBAC & security</h1>
      <p className="muted">Create users · assign roles · MFA · audit</p>
      <div className="actions" style={{ marginBottom: "1rem" }}>
        <Link to="/settings/mfa" className="secondary button-link">MFA settings</Link>
        <Link to="/audit" className="secondary button-link">Audit trail</Link>
      </div>
      {error && <div className="error">{error}</div>}
      {msg && <div className="success">{msg}</div>}

      <form className="card" onSubmit={(e) => createUser(e).catch((err) => setError(err.message))}>
        <h3 style={{ marginTop: 0 }}>Add user</h3>
        <div className="grid-2">
          <div className="field"><label>Full name</label><input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
          <div className="field"><label>Email</label><input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        </div>
        <div className="grid-2">
          <div className="field">
            <label>Role</label>
            <select value={form.role_code} onChange={(e) => setForm({ ...form, role_code: e.target.value })}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="field"><label>Password</label><input required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
        </div>
        <button type="submit">Create user</button>
      </form>

      <div className="card table-wrap" style={{ marginTop: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>Users & role assignments ({users.length})</h3>
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

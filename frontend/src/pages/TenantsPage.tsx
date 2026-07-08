import { FormEvent, useEffect, useState } from "react";
import { api } from "../api/client";

export default function TenantsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({
    tenant_code: "",
    name: "",
    admin_email: "",
    admin_password: "TenantAdmin@360",
    admin_full_name: "Tenant Admin",
    branch_name: "Main Branch",
  });

  async function load() {
    setRows(await api<any[]>("/super-admin/tenants"));
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    try {
      await api("/super-admin/tenants", { method: "POST", body: JSON.stringify(form) });
      setMsg("Tenant onboarded");
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h1 className="page-title">Super Admin — tenants</h1>
      {error && <div className="error">{error}</div>}
      {msg && <div className="success">{msg}</div>}
      <div className="grid-2">
        <form className="card" onSubmit={onCreate}>
          <h3 style={{ marginTop: 0 }}>Onboard tenant</h3>
          <div className="field">
            <label>Tenant code (URL)</label>
            <input required value={form.tenant_code} onChange={(e) => setForm({ ...form, tenant_code: e.target.value })} />
          </div>
          <div className="field">
            <label>Hospital / clinic name</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="field">
            <label>Admin email</label>
            <input required type="email" value={form.admin_email} onChange={(e) => setForm({ ...form, admin_email: e.target.value })} />
          </div>
          <div className="field">
            <label>Admin password</label>
            <input required type="password" value={form.admin_password} onChange={(e) => setForm({ ...form, admin_password: e.target.value })} />
          </div>
          <button type="submit">Create tenant</button>
        </form>
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Plan</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td>/{t.tenant_code}</td>
                  <td>{t.name}</td>
                  <td>{t.plan_code}</td>
                  <td>{t.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

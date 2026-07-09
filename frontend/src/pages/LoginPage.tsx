import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Activity, BarChart3, Shield, Stethoscope } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import BrandLogo from "../components/ui/BrandLogo";
import { api } from "../api/client";
import { homeRouteForRoleCode } from "../utils/roleAccess";

type DemoUser = {
  email: string;
  full_name: string;
  role_code: string;
  password: string;
  description: string;
};

type DemoCreds = {
  tenant_code: string;
  super_admin: DemoUser & { role_code: string };
  users: DemoUser[];
};

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { tenantCode: urlTenant } = useParams();
  const [email, setEmail] = useState("admin@demo.sumaya");
  const [password, setPassword] = useState("TenantAdmin@360");
  const [tenant, setTenant] = useState(urlTenant || "demo");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [creds, setCreds] = useState<DemoCreds | null>(null);

  useEffect(() => {
    api<DemoCreds>("/auth/demo-credentials")
      .then(setCreds)
      .catch(() => setCreds(null));
  }, []);

  function fillLogin(u: DemoUser) {
    setEmail(u.email);
    setPassword(u.password);
    setTenant(creds?.tenant_code || "demo");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const session = await login(email, password, tenant || undefined);
      const prefix = tenant ? `/${tenant}` : "";
      navigate(`${prefix}${homeRouteForRoleCode(session.role_code)}`);
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-hero">
        <BrandLogo />
        <h1>Unified care for hospitals & clinics</h1>
        <p>
          OPD, IPD, lab, pharmacy, billing, telemedicine, and 36 integrated modules — one secure platform.
        </p>
        <div className="login-features">
          <div className="login-feature">
            <div className="login-feature__icon"><Stethoscope size={18} /></div>
            <div><strong>Clinical workflows</strong><br />Encounters, orders, discharge → billing</div>
          </div>
          <div className="login-feature">
            <div className="login-feature__icon"><BarChart3 size={18} /></div>
            <div><strong>Reports & analytics</strong><br />Live KPIs from your database</div>
          </div>
          <div className="login-feature">
            <div className="login-feature__icon"><Shield size={18} /></div>
            <div><strong>Role-based security</strong><br />Tenant isolation & audit trail</div>
          </div>
          <div className="login-feature">
            <div className="login-feature__icon"><Activity size={18} /></div>
            <div><strong>End-to-end journey</strong><br />Patient → appointment → care → payment</div>
          </div>
        </div>
      </div>
      <div className="login-panel">
        <form className="login-card" onSubmit={onSubmit}>
          <h2>Welcome back</h2>
          <p className="muted" style={{ marginBottom: "1.25rem" }}>Sign in to your tenant workspace</p>
          {error && <div className="error">{error}</div>}
          <div className="field">
            <label>Tenant code</label>
            <input value={tenant} onChange={(e) => setTenant(e.target.value)} placeholder="demo" />
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          </div>
          <button disabled={loading} style={{ width: "100%", marginTop: "0.25rem" }}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
          <p style={{ marginTop: "0.85rem", fontSize: "0.85rem" }}>
            <Link to={tenant ? `/${tenant}/forgot-password` : "/forgot-password"} style={{ color: "var(--brand)" }}>
              Forgot password?
            </Link>
          </p>
        </form>

        {creds && (
          <div className="login-card" style={{ marginTop: "1rem", maxHeight: "420px", overflow: "auto" }}>
            <h3 style={{ marginTop: 0 }}>Demo credentials (tenant: {creds.tenant_code})</h3>
            <p className="muted" style={{ fontSize: "0.8rem" }}>Click a row to fill the login form. All data is loaded from the database.</p>
            <table className="data-table" style={{ fontSize: "0.78rem" }}>
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Email</th>
                  <th>Password</th>
                </tr>
              </thead>
              <tbody>
                {creds.users.map((u) => (
                  <tr key={u.email} style={{ cursor: "pointer" }} onClick={() => fillLogin(u)} title={u.description}>
                    <td><span className="badge">{u.role_code.replace(/_/g, " ")}</span></td>
                    <td>{u.email}</td>
                    <td><code>{u.password}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="muted" style={{ marginTop: "0.75rem", fontSize: "0.75rem" }}>
              Super admin: <strong>{creds.super_admin.email}</strong> / <code>{creds.super_admin.password}</code> (no tenant)
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

import { FormEvent, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Activity, BarChart3, Shield, Stethoscope } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import BrandLogo from "../components/ui/BrandLogo";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { tenantCode: urlTenant } = useParams();
  const [email, setEmail] = useState("admin@demo.sumaya");
  const [password, setPassword] = useState("TenantAdmin@360");
  const [tenant, setTenant] = useState(urlTenant || "demo");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(email, password, tenant || undefined);
      const prefix = tenant ? `/${tenant}` : "";
      navigate(`${prefix}/dashboard`);
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
          <p className="muted" style={{ marginTop: "1.25rem", fontSize: "0.78rem", lineHeight: 1.5 }}>
            Demo: <strong>admin@demo.sumaya</strong> / <strong>TenantAdmin@360</strong> · tenant <strong>demo</strong>
            <br />
            URL: <strong>/demo/login</strong>
          </p>
        </form>
      </div>
    </div>
  );
}

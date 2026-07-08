import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@demo.sumaya");
  const [password, setPassword] = useState("TenantAdmin@360");
  const [tenant, setTenant] = useState("demo");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(email, password, tenant || undefined);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={onSubmit}>
        <h1>SUMAYA Care 360</h1>
        <p className="muted">Hospital, clinic & telemedicine platform</p>
        {error && <div className="error">{error}</div>}
        <div className="field">
          <label>Tenant code</label>
          <input value={tenant} onChange={(e) => setTenant(e.target.value)} placeholder="demo (blank for super admin)" />
        </div>
        <div className="field">
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <button disabled={loading} style={{ width: "100%" }}>
          {loading ? "Signing in..." : "Sign in"}
        </button>
        <p className="muted" style={{ marginTop: "1rem", fontSize: "0.8rem" }}>
          Demo: admin@demo.sumaya / TenantAdmin@360 · tenant <strong>demo</strong>
          <br />
          Super: superadmin@sumayacare360.com / SuperAdmin@360
        </p>
      </form>
    </div>
  );
}

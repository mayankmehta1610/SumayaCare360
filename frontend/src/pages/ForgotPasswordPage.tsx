import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [tenant, setTenant] = useState("demo");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email, tenant_code: tenant || null }),
        tenantCode: tenant || null,
      });
      setMsg("If the account exists, a reset email has been queued (check notification outbox in dev).");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={onSubmit}>
        <h1>Reset password</h1>
        <p className="muted">We will queue a secure reset link via email</p>
        {error && <div className="error">{error}</div>}
        {msg && <div className="success">{msg}</div>}
        <div className="field">
          <label>Tenant code</label>
          <input value={tenant} onChange={(e) => setTenant(e.target.value)} />
        </div>
        <div className="field">
          <label>Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <button disabled={loading} style={{ width: "100%" }}>
          {loading ? "Sending..." : "Send reset link"}
        </button>
        <p style={{ marginTop: "1rem" }}>
          <Link to="/login">Back to sign in</Link>
        </p>
      </form>
    </div>
  );
}

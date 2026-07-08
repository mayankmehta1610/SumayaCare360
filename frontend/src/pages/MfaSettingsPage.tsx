import { FormEvent, useEffect, useState } from "react";
import { api } from "../api/client";

export default function MfaSettingsPage() {
  const [enabled, setEnabled] = useState(false);
  const [secret, setSecret] = useState("");
  const [otpauth, setOtpauth] = useState("");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ mfa_enabled: boolean }>("/auth/mfa/status").then((r) => setEnabled(r.mfa_enabled)).catch(() => {});
  }, []);

  async function setup() {
    setError("");
    const data = await api<{ secret: string; otpauth_url: string }>("/auth/mfa/setup", { method: "POST" });
    setSecret(data.secret);
    setOtpauth(data.otpauth_url);
    setMsg("Scan the secret in your authenticator app, then verify with a 6-digit code.");
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api("/auth/mfa/verify", { method: "POST", body: JSON.stringify({ code }) });
      setEnabled(true);
      setMsg("MFA enabled successfully");
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h1 className="page-title">Multi-factor authentication</h1>
      <p className="muted">TOTP-based MFA for privileged accounts</p>
      {error && <div className="error">{error}</div>}
      {msg && <div className="success">{msg}</div>}
      <div className="card" style={{ maxWidth: 480 }}>
        <p>Status: <strong>{enabled ? "Enabled" : "Disabled"}</strong></p>
        {!secret && (
          <button type="button" onClick={() => setup().catch((e) => setError(e.message))}>
            Initialize MFA setup
          </button>
        )}
        {secret && !enabled && (
          <>
            <p className="muted">Secret (dev): <code>{secret}</code></p>
            <p className="muted" style={{ fontSize: "0.75rem", wordBreak: "break-all" }}>{otpauth}</p>
            <form onSubmit={verify}>
              <div className="field">
                <label>Verification code</label>
                <input value={code} onChange={(e) => setCode(e.target.value)} pattern="[0-9]{6}" required />
              </div>
              <button type="submit">Verify & enable</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

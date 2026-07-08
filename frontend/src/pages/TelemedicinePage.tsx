import { useEffect, useState } from "react";
import { api } from "../api/client";

export default function TelemedicinePage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [video, setVideo] = useState<any>(null);
  const [active, setActive] = useState<any>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [patientId, setPatientId] = useState("");
  const [summary, setSummary] = useState("");

  async function load() {
    const [s, v, p] = await Promise.all([
      api<any[]>("/telemedicine/sessions"),
      api<any>("/video/providers"),
      api<any[]>("/patients"),
    ]);
    setSessions(s);
    setVideo(v);
    setPatients(p);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function captureConsent() {
    if (!patientId) return;
    const consent = await api<{ id: string }>("/telemedicine/recording-consent", {
      method: "POST",
      body: JSON.stringify({
        patient_id: patientId,
        template_code: "VIDEO_REC",
        purpose: "telemedicine_recording",
        version: "1.0",
        granted: true,
      }),
    });
    setMsg(`Consent captured: ${consent.id}`);
    return consent.id;
  }

  async function join(sessionId: string) {
    let consentId: string | undefined;
    if (patientId) {
      consentId = await captureConsent();
      if (consentId) {
        await api(`/telemedicine/sessions/${sessionId}/link-consent?consent_id=${consentId}`, { method: "POST" });
      }
    }
    const join = await api<any>(`/telemedicine/sessions/${sessionId}/join?as_role=provider`);
    setActive(join);
    setMsg("Joined virtual room");
    await load();
  }

  async function finish() {
    if (!active?.session_id) return;
    await api(`/telemedicine/sessions/${active.session_id}/post-call-summary?summary=${encodeURIComponent(summary || "Visit completed")}`, {
      method: "POST",
    });
    setMsg("Post-call summary saved");
    setActive(null);
    await load();
  }

  return (
    <div>
      <h1 className="page-title">Telemedicine</h1>
      <p className="muted">
        Provider: {video?.tenant_config?.provider_code || "—"} · Recording:{" "}
        {video?.tenant_config?.recording_enabled ? "enabled" : "off"}
      </p>
      {error && <div className="error">{error}</div>}
      {msg && <div className="success">{msg}</div>}
      <div className="grid-2">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Sessions</h3>
          <div className="field">
            <label>Patient for consent</label>
            <select value={patientId} onChange={(e) => setPatientId(e.target.value)}>
              <option value="">Select patient</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.first_name} {p.last_name}
                </option>
              ))}
            </select>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Room</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td>{s.room_id}</td>
                    <td>
                      <span className="badge">{s.status}</span>
                    </td>
                    <td>
                      <button type="button" onClick={() => join(s.id).catch((e) => setError(e.message))}>
                        Join
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            Book a telemedicine appointment first — session is created automatically.
          </p>
        </div>
        <div className="card">
          <div className="tele-room">
            {active ? (
              <div>
                <h2 style={{ marginTop: 0 }}>Virtual consultation room</h2>
                <p>Room: {active.room_id}</p>
                <p>Token: {active.join_token}</p>
                <p>Provider adapter: {active.provider}</p>
                <p>Recording allowed: {active.recording_allowed ? "Yes" : "No (consent required)"}</p>
              </div>
            ) : (
              <div>
                <h2 style={{ marginTop: 0 }}>Waiting room</h2>
                <p>Join a session to open the secure room (Teams/Zoom/ACS/Twilio abstraction).</p>
              </div>
            )}
          </div>
          {active && (
            <div style={{ marginTop: "1rem" }}>
              <div className="field">
                <label>Post-call summary</label>
                <textarea rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} />
              </div>
              <button type="button" onClick={() => finish().catch((e) => setError(e.message))}>
                End & save summary
              </button>
            </div>
          )}
          <div style={{ marginTop: "1rem" }}>
            <h4>Available adapters</h4>
            <div className="actions">
              {(video?.providers || []).map((p: any) => (
                <span className="badge" key={p.code}>
                  {p.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

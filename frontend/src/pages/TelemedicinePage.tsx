import { FormEvent, useEffect, useState } from "react";
import { api } from "../api/client";
import ModuleFlowBar from "../components/ModuleFlowBar";
import ModuleFeaturePanel from "../components/ModuleFeaturePanel";

export default function TelemedicinePage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [video, setVideo] = useState<any>(null);
  const [active, setActive] = useState<any>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [patientId, setPatientId] = useState("");
  const [summary, setSummary] = useState("");
  const [inCallNote, setInCallNote] = useState("");
  const [createApptId, setCreateApptId] = useState("");

  async function load() {
    const [s, v, p, a] = await Promise.all([
      api<any[]>("/telemedicine/sessions"),
      api<any>("/video/providers"),
      api<any[]>("/patients"),
      api<any[]>("/appointments"),
    ]);
    setSessions(s);
    setVideo(v);
    setPatients(p);
    setAppointments(a.filter((x: any) => x.mode === "telemedicine"));
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

  async function createSession(e: FormEvent) {
    e.preventDefault();
    if (!createApptId) return;
    await api("/telemedicine/sessions", {
      method: "POST",
      body: JSON.stringify({ appointment_id: createApptId }),
    });
    setMsg("Telemedicine session created");
    await load();
  }

  async function join(sessionId: string) {
    let consentId: string | undefined;
    if (patientId) {
      consentId = await captureConsent();
      if (consentId) {
        await api(`/telemedicine/sessions/${sessionId}/link-consent?consent_id=${consentId}`, { method: "POST" });
      }
    }
    const joinRes = await api<any>(`/telemedicine/sessions/${sessionId}/join?as_role=provider`);
    setActive(joinRes);
    setMsg("Joined virtual room");
    await load();
  }

  async function waitingRoom(action: "admit" | "hold") {
    if (!active?.session_id) return;
    await api("/telemedicine/waiting-room", {
      method: "POST",
      body: JSON.stringify({ session_id: active.session_id, action }),
    });
    setMsg(action === "admit" ? "Patient admitted" : "Returned to waiting room");
    await load();
  }

  async function saveInCallNote() {
    if (!active?.session_id || !inCallNote) return;
    await api("/telemedicine/in-call/notes", {
      method: "POST",
      body: JSON.stringify({ session_id: active.session_id, content: inCallNote, note_type: "clinical" }),
    });
    setInCallNote("");
    setMsg("In-call note saved");
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
      <ModuleFlowBar moduleCode="telemedicine-and-virtual-care" compact />
      <h1 className="page-title">Telemedicine</h1>
      <ModuleFeaturePanel moduleCode="telemedicine-and-virtual-care" />
      <p className="muted">
        Provider: {video?.tenant_config?.provider_code || "—"} · Recording:{" "}
        {video?.tenant_config?.recording_enabled ? "enabled" : "off"}
      </p>
      {error && <div className="error">{error}</div>}
      {msg && <div className="success">{msg}</div>}
      <form className="card" onSubmit={(e) => createSession(e).catch((err) => setError(err.message))} style={{ marginBottom: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>Create session from telemedicine appointment</h3>
        <div className="field">
          <label>Appointment</label>
          <select required value={createApptId} onChange={(e) => setCreateApptId(e.target.value)}>
            <option value="">Select telemedicine appointment</option>
            {appointments.map((a) => (
              <option key={a.id} value={a.id}>
                {a.queue_token} — {new Date(a.scheduled_at).toLocaleString()} ({a.status})
              </option>
            ))}
          </select>
        </div>
        <button type="submit">Create video session</button>
      </form>
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
                <div className="actions">
                  <button type="button" onClick={() => waitingRoom("admit").catch((e) => setError(e.message))}>Admit from waiting room</button>
                  <button type="button" className="secondary" onClick={() => waitingRoom("hold").catch((e) => setError(e.message))}>Hold in waiting room</button>
                </div>
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
                <label>In-call note</label>
                <textarea rows={2} value={inCallNote} onChange={(e) => setInCallNote(e.target.value)} />
              </div>
              <button type="button" className="secondary" onClick={() => saveInCallNote().catch((e) => setError(e.message))}>Save note</button>
              <div className="field" style={{ marginTop: "0.75rem" }}>
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

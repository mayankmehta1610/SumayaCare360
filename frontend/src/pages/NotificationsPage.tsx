import { FormEvent, useEffect, useState } from "react";
import { api } from "../api/client";
import ModuleFlowBar from "../components/ModuleFlowBar";

type OutboxRow = {
  id: string;
  channel: string;
  recipient: string;
  subject?: string;
  body: string;
  status: string;
  created_at?: string;
};

export default function NotificationsPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [outbox, setOutbox] = useState<OutboxRow[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ channel: "email", recipient: "", subject: "", body: "" });

  async function load() {
    const [t, o] = await Promise.all([
      api<any[]>("/masters/notification-templates"),
      api<OutboxRow[]>("/notifications/outbox"),
    ]);
    setTemplates(t);
    setOutbox(o);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  function useTemplate(t: any) {
    setForm({
      channel: t.channel,
      recipient: "",
      subject: t.subject || t.name,
      body: t.body,
    });
  }

  async function onSend(e: FormEvent) {
    e.preventDefault();
    await api("/notifications/outbox", {
      method: "POST",
      body: JSON.stringify({
        channel: form.channel,
        recipient: form.recipient,
        subject: form.subject || "Notification",
        body: form.body,
      }),
    });
    setMsg("Notification queued");
    await load();
  }

  return (
    <div>
      <ModuleFlowBar moduleCode="notifications-and-engagement" compact />
      <h1 className="page-title">Notifications & engagement</h1>
      <p className="muted">SMS · email · WhatsApp · push — loaded from PostgreSQL outbox</p>
      {error && <div className="error">{error}</div>}
      {msg && <div className="success">{msg}</div>}
      <div className="grid-2">
        <form className="card" onSubmit={(e) => onSend(e).catch((err) => setError(err.message))}>
          <h3 style={{ marginTop: 0 }}>Send notification</h3>
          <div className="field"><label>Channel</label>
            <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="push">Push</option>
            </select>
          </div>
          <div className="field"><label>Recipient</label>
            <input required value={form.recipient} onChange={(e) => setForm({ ...form, recipient: e.target.value })} />
          </div>
          <div className="field"><label>Subject</label>
            <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          </div>
          <div className="field"><label>Body</label>
            <textarea rows={4} required value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          </div>
          <button type="submit">Queue send</button>
        </form>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Templates (master)</h3>
          {templates.map((t) => (
            <div key={t.id} style={{ marginBottom: "0.8rem", paddingBottom: "0.8rem", borderBottom: "1px solid var(--line)" }}>
              <strong>{t.code}</strong> · {t.channel}
              <p className="muted" style={{ fontSize: "0.85rem" }}>{t.subject}</p>
              <button type="button" className="secondary" onClick={() => useTemplate(t)}>Use template</button>
            </div>
          ))}
        </div>
      </div>
      <div className="card table-wrap" style={{ marginTop: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>Outbox ({outbox.length})</h3>
        <table>
          <thead><tr><th>Channel</th><th>Recipient</th><th>Subject</th><th>Status</th><th>Time</th></tr></thead>
          <tbody>
            {outbox.map((r) => (
              <tr key={r.id}>
                <td>{r.channel}</td>
                <td>{r.recipient}</td>
                <td>{r.subject}</td>
                <td><span className="badge">{r.status}</span></td>
                <td>{r.created_at ? new Date(r.created_at).toLocaleString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

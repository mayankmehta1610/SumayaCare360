import { FormEvent, useEffect, useState } from "react";
import { api } from "../api/client";

export default function NotificationsPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ channel: "email", recipient: "", subject: "", body: "" });

  useEffect(() => {
    api<any[]>("/masters/notification-templates").then(setTemplates).catch((e) => setError(e.message));
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
  }

  return (
    <div>
      <h1 className="page-title">Notifications & Engagement</h1>
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
    </div>
  );
}

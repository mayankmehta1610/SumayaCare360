import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";

type Appt = { id: string; scheduled_at: string; status: string; queue_token?: string; mode?: string };
type Bill = { id: string; invoice_no: string; status: string; total_amount: number };
type Session = { id: string; session_code: string; status: string; join_url: string };
type Provider = { id: string; full_name: string; specialty_code: string };

export default function PatientPortalPage() {
  const [appointments, setAppointments] = useState<Appt[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [summaries, setSummaries] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [bookForm, setBookForm] = useState({ provider_id: "", scheduled_at: "", reason: "", mode: "telemedicine" });

  async function load() {
    const [a, b, s, p, v] = await Promise.all([
      api<Appt[]>("/portal/appointments"),
      api<Bill[]>("/portal/bills"),
      api<Session[]>("/portal/telemedicine/sessions"),
      api<Provider[]>("/portal/providers"),
      api<any[]>("/portal/visit-summaries"),
    ]);
    setAppointments(a);
    setBills(b);
    setSessions(s);
    setProviders(p);
    setSummaries(v);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function bookAppt(e: FormEvent) {
    e.preventDefault();
    await api("/portal/appointments", {
      method: "POST",
      body: JSON.stringify({
        ...bookForm,
        scheduled_at: new Date(bookForm.scheduled_at).toISOString(),
      }),
    });
    setMsg("Appointment requested — confirmation queued");
    setBookForm({ provider_id: "", scheduled_at: "", reason: "", mode: "telemedicine" });
    await load();
  }

  async function payBill(bill: Bill) {
    await api("/portal/bills/pay", {
      method: "POST",
      body: JSON.stringify({
        invoice_id: bill.id,
        amount: bill.total_amount,
        gateway_token_ref: `tok_portal_${crypto.randomUUID()}`,
        masked_last4: "4242",
      }),
    });
    setMsg(`Paid ${bill.invoice_no} (tokenized gateway)`);
    await load();
  }

  return (
    <div>
      <h1 className="page-title">Patient portal</h1>
      <p className="muted">Book appointments, pay bills, join teleconsult, view visit summaries</p>
      {error && <div className="error">{error}</div>}
      {msg && <div className="success">{msg}</div>}
      <form className="card" onSubmit={(e) => bookAppt(e).catch((err) => setError(err.message))}>
        <h3 style={{ marginTop: 0 }}>Request appointment</h3>
        <div className="field">
          <label>Provider</label>
          <select required value={bookForm.provider_id} onChange={(e) => setBookForm({ ...bookForm, provider_id: e.target.value })}>
            <option value="">Select</option>
            {providers.map((p) => <option key={p.id} value={p.id}>{p.full_name} ({p.specialty_code})</option>)}
          </select>
        </div>
        <div className="field">
          <label>When</label>
          <input type="datetime-local" required value={bookForm.scheduled_at} onChange={(e) => setBookForm({ ...bookForm, scheduled_at: e.target.value })} />
        </div>
        <div className="field">
          <label>Mode</label>
          <select value={bookForm.mode} onChange={(e) => setBookForm({ ...bookForm, mode: e.target.value })}>
            <option value="telemedicine">Telemedicine</option>
            <option value="in_person">In person</option>
          </select>
        </div>
        <div className="field">
          <label>Reason</label>
          <input value={bookForm.reason} onChange={(e) => setBookForm({ ...bookForm, reason: e.target.value })} />
        </div>
        <button type="submit">Request booking</button>
      </form>
      <div className="grid-2" style={{ marginTop: "1rem" }}>
        <div className="card">
          <h3>Upcoming appointments</h3>
          {appointments.length === 0 && <p className="muted">No appointments</p>}
          <ul>
            {appointments.map((a) => (
              <li key={a.id}>
                {a.queue_token && <strong>{a.queue_token} </strong>}
                {new Date(a.scheduled_at).toLocaleString()} — {a.status} ({a.mode})
              </li>
            ))}
          </ul>
        </div>
        <div className="card">
          <h3>Teleconsult sessions</h3>
          {sessions.map((s) => (
            <div key={s.id} style={{ marginBottom: "0.5rem" }}>
              {s.session_code} — {s.status}{" "}
              <Link to="/telemedicine">Join</Link>
            </div>
          ))}
        </div>
        <div className="card">
          <h3>Bills</h3>
          {bills.map((b) => (
            <div key={b.id} style={{ marginBottom: "0.5rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <span>{b.invoice_no}: {b.status} — ₹{b.total_amount.toFixed(2)}</span>
              {b.status !== "paid" && (
                <button type="button" className="secondary" onClick={() => payBill(b).catch((e) => setError(e.message))}>Pay now</button>
              )}
            </div>
          ))}
        </div>
        <div className="card">
          <h3>Visit summaries</h3>
          {summaries.map((v) => (
            <div key={v.id}>{v.encounter_no} — {v.status} · {v.started_at ? new Date(v.started_at).toLocaleDateString() : "—"}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

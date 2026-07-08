import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";

type Appt = { id: string; scheduled_at: string; status: string };
type Bill = { id: string; invoice_no: string; status: string; total_amount: number };
type Session = { id: string; session_code: string; status: string; join_url: string };

export default function PatientPortalPage() {
  const [appointments, setAppointments] = useState<Appt[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api<Appt[]>("/portal/appointments"),
      api<Bill[]>("/portal/bills"),
      api<Session[]>("/portal/telemedicine/sessions"),
    ])
      .then(([a, b, s]) => {
        setAppointments(a);
        setBills(b);
        setSessions(s);
      })
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <h1 className="page-title">Patient portal</h1>
      <p className="muted">Appointments, teleconsult, bills & visit summaries</p>
      {error && <div className="error">{error}</div>}
      <div className="grid-2">
        <div className="card">
          <h3>Upcoming appointments</h3>
          {appointments.length === 0 && <p className="muted">No appointments</p>}
          <ul>
            {appointments.map((a) => (
              <li key={a.id}>{new Date(a.scheduled_at).toLocaleString()} — {a.status}</li>
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
            <div key={b.id}>{b.invoice_no}: {b.status} — ₹{b.total_amount.toFixed(2)}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

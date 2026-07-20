import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity, ArrowRight, BedDouble, CalendarCheck, ClipboardPlus, CreditCard,
  FileSearch, FlaskConical, HeartPulse, Search, Siren, UserRoundCheck, UsersRound, X,
} from "lucide-react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

type BoardPatient = {
  id: string; mrn: string; name: string; date_of_birth?: string; gender?: string; phone?: string;
  blood_group?: string; stage: string; stage_label: string; route: string; next_action: string;
  active_admission?: string; bed?: string; pending_orders: number; open_tasks: number;
  outstanding: number; last_activity?: string;
};
type Board = { summary: Record<string, number>; patients: BoardPatient[]; generated_at: string };
type Journey = {
  patient: Record<string, any>;
  events: { id: string; type: string; status: string; detail?: string; occurred_at?: string }[];
};

const FLOW = [
  { label: "Register", detail: "MRN, identity, consent", route: "/patients", icon: UserRoundCheck },
  { label: "Arrive", detail: "Appointment, walk-in or ED", route: "/appointments", icon: CalendarCheck },
  { label: "Assess", detail: "Triage, vitals, consultation", route: "/care-journey", icon: Activity },
  { label: "Treat", detail: "Orders, medicines, procedures", route: "/clinical-hub", icon: HeartPulse },
  { label: "Admit", detail: "Bed, nursing and care plan", route: "/inpatient", icon: BedDouble },
  { label: "Discharge", detail: "Summary, billing, follow-up", route: "/post-treatment", icon: ClipboardPlus },
];

const STAGE_ORDER = ["all", "registered", "scheduled", "checked_in", "clinical", "emergency", "inpatient"];
const STAGE_LABELS: Record<string, string> = {
  all: "All patients", registered: "Registered", scheduled: "Scheduled", checked_in: "Checked in",
  clinical: "In consultation", emergency: "Emergency", inpatient: "Inpatient",
};

function money(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value || 0);
}

function when(value?: string) {
  if (!value) return "No activity";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export default function PatientAdministrationPage() {
  const [board, setBoard] = useState<Board | null>(null);
  const [journey, setJourney] = useState<Journey | null>(null);
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { session } = useAuth();
  const prefix = session?.tenant_code ? `/${session.tenant_code}` : "";

  async function load() {
    setLoading(true);
    try {
      setBoard(await api<Board>(`/patient-administration/board?query=${encodeURIComponent(query)}&limit=500`));
      setError("");
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { const id = setTimeout(load, 250); return () => clearTimeout(id); }, [query]);

  async function openJourney(patient: BoardPatient) {
    try {
      setJourney(await api<Journey>(`/patient-administration/patients/${patient.id}/journey`));
    } catch (e: any) { setError(e.message); }
  }

  const filtered = useMemo(() => board?.patients.filter((p) => stage === "all" || p.stage === stage) || [], [board, stage]);
  const s = board?.summary || {};
  const cards = [
    { label: "Active patients", value: s.patients || 0, icon: UsersRound, tone: "blue" },
    { label: "In care now", value: (s.checked_in || 0) + (s.clinical || 0), icon: Activity, tone: "violet" },
    { label: "ED / Inpatient", value: (s.emergency || 0) + (s.inpatient || 0), icon: Siren, tone: "red" },
    { label: "Pending clinical work", value: (s.pending_orders || 0) + (s.open_tasks || 0), icon: FlaskConical, tone: "amber" },
    { label: "Outstanding", value: money(s.outstanding || 0), icon: CreditCard, tone: "green" },
  ];

  return (
    <div className="patient-admin">
      <header className="command-hero">
        <div>
          <div className="eyebrow">Hospital operations</div>
          <h1>Patient administration command center</h1>
          <p>One operational view from registration and arrival through clinical care, admission, discharge, billing and follow-up.</p>
        </div>
        <div className="command-hero__actions">
          <button onClick={() => navigate(`${prefix}/patients`)}><UserRoundCheck size={17} /> Register patient</button>
          <button className="secondary" onClick={() => navigate(`${prefix}/reports`)}><FileSearch size={17} /> Operational reports</button>
        </div>
      </header>

      {error && <div className="error">{error}</div>}

      <section className="hospital-flow" aria-label="Hospital patient workflow">
        {FLOW.map(({ label, detail, route, icon: Icon }, index) => (
          <button className="hospital-flow__step" key={label} onClick={() => navigate(`${prefix}${route}`)}>
            <span className="hospital-flow__number">{String(index + 1).padStart(2, "0")}</span>
            <span className="hospital-flow__icon"><Icon size={19} /></span>
            <span><strong>{label}</strong><small>{detail}</small></span>
            {index < FLOW.length - 1 && <ArrowRight className="hospital-flow__arrow" size={15} />}
          </button>
        ))}
      </section>

      <section className="command-metrics">
        {cards.map(({ label, value, icon: Icon, tone }) => (
          <div className={`command-metric command-metric--${tone}`} key={label}>
            <span className="command-metric__icon"><Icon size={19} /></span>
            <div><strong>{value}</strong><span>{label}</span></div>
          </div>
        ))}
      </section>

      <section className="worklist-card">
        <div className="worklist-head">
          <div><h2>Live patient worklist</h2><p>Prioritized patient state and the next operational action.</p></div>
          <label className="command-search"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search MRN, patient or mobile" /></label>
        </div>
        <div className="stage-tabs">
          {STAGE_ORDER.map((key) => <button key={key} className={stage === key ? "active" : ""} onClick={() => setStage(key)}>
            {STAGE_LABELS[key]} <span>{key === "all" ? board?.patients.length || 0 : s[key] || 0}</span>
          </button>)}
        </div>
        <div className="table-wrap">
          <table className="command-table">
            <thead><tr><th>Patient</th><th>Current state</th><th>Operational next step</th><th>Clinical work</th><th>Financial</th><th>Last activity</th><th></th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="empty-cell">Loading live worklist...</td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={7} className="empty-cell">No patients match this view.</td></tr>}
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td><button className="patient-link" onClick={() => openJourney(p)}><span className="patient-avatar">{p.name.split(" ").map((x) => x[0]).join("").slice(0, 2)}</span><span><strong>{p.name}</strong><small>{p.mrn} · {p.gender || "—"} · {p.phone || "No mobile"}</small></span></button></td>
                  <td><span className={`status-chip status-chip--${p.stage}`}>{p.stage_label}</span>{p.bed && <small className="cell-note">Bed {p.bed}</small>}</td>
                  <td><span className="next-action">{p.next_action}</span></td>
                  <td><span className="work-count">{p.pending_orders} orders</span><span className="work-count">{p.open_tasks} tasks</span></td>
                  <td className={p.outstanding > 0 ? "amount-due" : "muted"}>{money(p.outstanding)}</td>
                  <td>{when(p.last_activity)}</td>
                  <td><button className="icon-action" title="Open workflow" onClick={() => navigate(`${prefix}${p.route}`)}><ArrowRight size={17} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {journey && <div className="journey-backdrop" onClick={() => setJourney(null)}>
        <aside className="journey-panel" onClick={(e) => e.stopPropagation()}>
          <button className="journey-close" onClick={() => setJourney(null)}><X size={19} /></button>
          <div className="eyebrow">Patient 360</div>
          <h2>{journey.patient.name}</h2>
          <p className="journey-identity">{journey.patient.mrn} · {journey.patient.gender || "—"} · Blood group {journey.patient.blood_group || "—"}</p>
          <div className="journey-demographics"><span><small>Mobile</small>{journey.patient.phone || "—"}</span><span><small>Date of birth</small>{journey.patient.date_of_birth || "—"}</span><span><small>Email</small>{journey.patient.email || "—"}</span></div>
          <h3>Longitudinal activity</h3>
          <div className="journey-timeline">
            {journey.events.length === 0 && <p className="muted">No clinical or financial activity yet.</p>}
            {journey.events.map((event) => <div className="journey-event" key={`${event.type}-${event.id}`}>
              <span className="journey-event__dot" />
              <div><div className="journey-event__head"><strong>{event.type}</strong><span className="badge">{event.status}</span></div><p>{event.detail || "Activity recorded"}</p><time>{when(event.occurred_at)}</time></div>
            </div>)}
          </div>
        </aside>
      </div>}
    </div>
  );
}

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import ModuleFlowBar from "../../components/ModuleFlowBar";

type Claim = {
  id: string;
  claim_no: string;
  payer_code: string;
  status: string;
  amount: number;
  patient_id: string;
  policy_no?: string;
};

const STATUS_ACTIONS: Record<string, { label: string; next: string }[]> = {
  draft: [{ label: "Submit", next: "submitted" }],
  submitted: [{ label: "Review", next: "under_review" }],
  under_review: [
    { label: "Approve", next: "approved" },
    { label: "Deny", next: "denied" },
  ],
  approved: [{ label: "Mark paid", next: "paid" }],
};

export default function InsuranceClaimsPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [payers, setPayers] = useState<any[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ patient_id: "", payer_code: "", amount: "1000", policy_no: "" });

  const patientMap = useMemo(() => {
    const m = new Map<string, string>();
    patients.forEach((p) => m.set(p.id, `${p.first_name} ${p.last_name}`));
    return m;
  }, [patients]);

  async function load() {
    const [p, py, cl] = await Promise.all([
      api<any[]>("/patients"),
      api<any[]>("/masters/insurance-payers"),
      api<Claim[]>("/clinical/insurance-claims"),
    ]);
    setPatients(p);
    setPayers(py);
    setClaims(cl);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function submitClaim(e: FormEvent) {
    e.preventDefault();
    const q = new URLSearchParams({
      patient_id: form.patient_id,
      payer_code: form.payer_code,
      amount: form.amount,
      policy_no: form.policy_no,
    });
    await api(`/clinical/insurance-claims?${q}`, { method: "POST" });
    setMsg("Claim created (draft)");
    await load();
  }

  async function transition(id: string, status: string) {
    await api(`/clinical/insurance-claims/${id}/status?status=${status}`, { method: "PATCH" });
    setMsg(`Claim → ${status}`);
    await load();
  }

  const openClaims = claims.filter((c) => !["paid", "denied"].includes(c.status));

  return (
    <div>
      <ModuleFlowBar moduleCode="insurance-and-claims" compact />
      <h1 className="page-title">Insurance & claims</h1>
      <p className="muted">Submit claims · payer master · status workflow through settlement</p>
      <div className="actions" style={{ marginBottom: "1rem" }}>
        <Link to="/billing" className="secondary button-link">Billing</Link>
        <Link to="/masters" className="secondary button-link">Insurance payers</Link>
      </div>
      {error && <div className="error">{error}</div>}
      {msg && <div className="success">{msg}</div>}

      <div className="grid-2">
        <form className="card" onSubmit={(e) => submitClaim(e).catch((err) => setError(err.message))}>
          <h3 style={{ marginTop: 0 }}>New claim</h3>
          <div className="field">
            <label>Patient</label>
            <select required value={form.patient_id} onChange={(e) => setForm({ ...form, patient_id: e.target.value })}>
              <option value="">Select</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Payer (master)</label>
            <select required value={form.payer_code} onChange={(e) => setForm({ ...form, payer_code: e.target.value })}>
              <option value="">Select</option>
              {payers.map((p) => (
                <option key={p.code} value={p.code}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Policy no</label>
            <input value={form.policy_no} onChange={(e) => setForm({ ...form, policy_no: e.target.value })} />
          </div>
          <div className="field">
            <label>Amount (₹)</label>
            <input type="number" required min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
          <button type="submit">Create claim</button>
        </form>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Workflow</h3>
          <p className="muted" style={{ marginTop: 0 }}>
            draft → submitted → under_review → approved/denied → paid
          </p>
          <p><strong>{openClaims.length}</strong> open claims</p>
          <p><strong>{claims.filter((c) => c.status === "paid").length}</strong> settled</p>
        </div>
      </div>

      <div className="card table-wrap" style={{ marginTop: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>Claims</h3>
        <table>
          <thead>
            <tr><th>Claim</th><th>Patient</th><th>Payer</th><th>Policy</th><th>Amount</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {claims.map((c) => (
              <tr key={c.id}>
                <td>{c.claim_no}</td>
                <td>{patientMap.get(c.patient_id) || c.patient_id.slice(0, 8)}</td>
                <td>{c.payer_code}</td>
                <td>{c.policy_no || "—"}</td>
                <td>₹{c.amount}</td>
                <td><span className="badge">{c.status}</span></td>
                <td className="actions">
                  {(STATUS_ACTIONS[c.status] || []).map((a) => (
                    <button
                      key={a.next}
                      type="button"
                      className="secondary"
                      onClick={() => transition(c.id, a.next).catch((e) => setError(e.message))}
                    >
                      {a.label}
                    </button>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

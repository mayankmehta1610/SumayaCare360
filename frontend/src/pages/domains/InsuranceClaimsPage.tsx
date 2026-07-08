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
  allowed_next_statuses?: string[];
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
      api<Claim[]>("/finance/claims"),
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
    await api("/finance/claims", {
      method: "POST",
      body: JSON.stringify({
        patient_id: form.patient_id,
        payer_code: form.payer_code,
        amount: Number(form.amount),
        policy_no: form.policy_no,
      }),
    });
    setMsg("Claim created (draft)");
    await load();
  }

  async function preAuth() {
    if (!form.patient_id || !form.payer_code) return;
    const res = await api<{ approved: boolean; reference: string }>("/finance/claims/pre-auth-check", {
      method: "POST",
      body: JSON.stringify({
        patient_id: form.patient_id,
        payer_code: form.payer_code,
        amount: Number(form.amount),
        policy_no: form.policy_no,
      }),
    });
    setMsg(`Pre-auth ${res.approved ? "approved" : "denied"} — ref ${res.reference}`);
  }

  async function setStatus(id: string, status: string) {
    await api(`/finance/claims/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    setMsg(`Claim → ${status}`);
    await load();
  }

  return (
    <div>
      <ModuleFlowBar moduleCode="insurance-and-claims" compact />
      <h1 className="page-title">Insurance & claims</h1>
      <p className="muted">draft → submitted → under_review → approved/denied → paid</p>
      <div className="actions" style={{ marginBottom: "1rem" }}>
        <Link to="/billing" className="secondary button-link">Billing</Link>
        <Link to="/hubs/finance" className="secondary button-link">Finance hub</Link>
      </div>
      {error && <div className="error">{error}</div>}
      {msg && <div className="success">{msg}</div>}

      <form className="card" onSubmit={(e) => submitClaim(e).catch((err) => setError(err.message))}>
        <h3 style={{ marginTop: 0 }}>New claim</h3>
        <div className="grid-2">
          <div className="field">
            <label>Patient</label>
            <select required value={form.patient_id} onChange={(e) => setForm({ ...form, patient_id: e.target.value })}>
              <option value="">Select</option>
              {patients.map((p) => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Payer</label>
            <select required value={form.payer_code} onChange={(e) => setForm({ ...form, payer_code: e.target.value })}>
              <option value="">Select</option>
              {payers.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
            </select>
          </div>
        </div>
        <div className="grid-2">
          <div className="field">
            <label>Amount</label>
            <input type="number" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div className="field">
            <label>Policy no</label>
            <input value={form.policy_no} onChange={(e) => setForm({ ...form, policy_no: e.target.value })} />
          </div>
        </div>
        <div className="actions">
          <button type="submit">Create claim</button>
          <button type="button" className="secondary" onClick={() => preAuth().catch((e) => setError(e.message))}>Pre-auth check</button>
        </div>
      </form>

      <div className="card table-wrap" style={{ marginTop: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>Claims pipeline</h3>
        <table>
          <thead><tr><th>Claim</th><th>Patient</th><th>Payer</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {claims.map((c) => (
              <tr key={c.id}>
                <td>{c.claim_no}</td>
                <td>{patientMap.get(c.patient_id) || "—"}</td>
                <td>{c.payer_code}</td>
                <td>₹{c.amount}</td>
                <td><span className="badge">{c.status}</span></td>
                <td className="actions">
                  {(c.allowed_next_statuses || []).map((s) => (
                    <button key={s} type="button" className="secondary" onClick={() => setStatus(c.id, s).catch((e) => setError(e.message))}>
                      → {s}
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

import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { fetchPatients } from "../../api/list";
import ModuleFlowBar from "../../components/ModuleFlowBar";

type Tab = "claims" | "preauth" | "ar" | "refunds";

export default function RevenueCyclePage() {
  const [tab, setTab] = useState<Tab>("claims");
  const [patients, setPatients] = useState<any[]>([]);
  const [payers, setPayers] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [ar, setAr] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [preAuthForm, setPreAuthForm] = useState({ patient_id: "", payer_code: "", amount: "5000", policy_no: "" });
  const [refundForm, setRefundForm] = useState({ payment_id: "", amount: "", reason: "" });

  async function loadBase() {
    const [p, py, cl, aging, inv] = await Promise.all([
      fetchPatients(),
      api<any[]>("/masters/insurance-payers"),
      api<any[]>("/finance/claims"),
      api<any>("/finance/ar-aging"),
      api<any[]>("/billing/invoices").catch(() => []),
    ]);
    setPatients(p);
    setPayers(py);
    setClaims(cl);
    setAr(aging);
    const paid = (inv as any[]).flatMap((i) => (i.payments || []).map((pay: any) => ({ ...pay, invoice_no: i.invoice_no })));
    setPayments(paid);
  }

  useEffect(() => {
    loadBase().catch((e) => setError(e.message));
  }, []);

  async function preAuth(e: FormEvent) {
    e.preventDefault();
    const res = await api<{ approved: boolean; reference: string }>("/finance/claims/pre-auth-check", {
      method: "POST",
      body: JSON.stringify({
        patient_id: preAuthForm.patient_id,
        payer_code: preAuthForm.payer_code,
        amount: Number(preAuthForm.amount),
        policy_no: preAuthForm.policy_no,
      }),
    });
    setMsg(`Pre-auth ${res.approved ? "approved" : "denied"} — ${res.reference}`);
  }

  async function refund(e: FormEvent) {
    e.preventDefault();
    await api("/finance/refunds", {
      method: "POST",
      body: JSON.stringify({
        payment_id: refundForm.payment_id,
        amount: Number(refundForm.amount),
        reason: refundForm.reason,
      }),
    });
    setMsg("Refund initiated");
    await loadBase();
  }

  async function setClaimStatus(id: string, status: string) {
    await api(`/finance/claims/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
    setMsg(`Claim → ${status}`);
    await loadBase();
  }

  return (
    <div>
      <ModuleFlowBar moduleCode="revenue-cycle-management" compact />
      <h1 className="page-title">Revenue cycle management</h1>
      <p className="muted">Claims · pre-authorization · AR aging · refunds</p>
      <div className="actions" style={{ marginBottom: "1rem" }}>
        <Link to="/billing" className="secondary button-link">Billing & payments</Link>
        <Link to="/insurance-claims" className="secondary button-link">Claims desk</Link>
      </div>
      {error && <div className="error">{error}</div>}
      {msg && <div className="success">{msg}</div>}

      <div className="tabs" style={{ marginBottom: "1rem" }}>
        {(["claims", "preauth", "ar", "refunds"] as Tab[]).map((t) => (
          <button key={t} type="button" className={tab === t ? "" : "secondary"} onClick={() => setTab(t)}>
            {t === "preauth" ? "Pre-auth" : t === "ar" ? "AR aging" : t}
          </button>
        ))}
      </div>

      {tab === "claims" && (
        <div className="card table-wrap">
          <table>
            <thead><tr><th>Claim</th><th>Payer</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {claims.map((c) => (
                <tr key={c.id}>
                  <td>{c.claim_no}</td>
                  <td>{c.payer_code}</td>
                  <td>₹{c.amount}</td>
                  <td><span className="badge">{c.status}</span></td>
                  <td className="actions">
                    {(c.allowed_next_statuses || []).map((s: string) => (
                      <button key={s} type="button" className="secondary" onClick={() => setClaimStatus(c.id, s).catch((e) => setError(e.message))}>→ {s}</button>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "preauth" && (
        <form className="card" onSubmit={(e) => preAuth(e).catch((err) => setError(err.message))}>
          <h3 style={{ marginTop: 0 }}>Pre-authorization check</h3>
          <div className="grid-2">
            <div className="field">
              <label>Patient</label>
              <select required value={preAuthForm.patient_id} onChange={(e) => setPreAuthForm({ ...preAuthForm, patient_id: e.target.value })}>
                <option value="">Select</option>
                {patients.map((p) => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Payer</label>
              <select required value={preAuthForm.payer_code} onChange={(e) => setPreAuthForm({ ...preAuthForm, payer_code: e.target.value })}>
                <option value="">Select</option>
                {payers.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid-2">
            <div className="field">
              <label>Amount</label>
              <input type="number" required value={preAuthForm.amount} onChange={(e) => setPreAuthForm({ ...preAuthForm, amount: e.target.value })} />
            </div>
            <div className="field">
              <label>Policy no</label>
              <input value={preAuthForm.policy_no} onChange={(e) => setPreAuthForm({ ...preAuthForm, policy_no: e.target.value })} />
            </div>
          </div>
          <button type="submit">Run pre-auth</button>
        </form>
      )}

      {tab === "ar" && ar && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Accounts receivable aging</h3>
          <div className="grid-2">
            <div><strong>Total outstanding</strong><p>₹{ar.total_outstanding ?? 0}</p></div>
            <div><strong>0–30 days</strong><p>₹{ar.by_age?.current_0_30?.amount ?? 0}</p></div>
            <div><strong>31–60 days</strong><p>₹{ar.by_age?.days_31_60?.amount ?? 0}</p></div>
            <div><strong>61–90 days</strong><p>₹{ar.by_age?.days_61_90?.amount ?? 0}</p></div>
            <div><strong>90+ days</strong><p>₹{ar.by_age?.over_90?.amount ?? 0}</p></div>
          </div>
        </div>
      )}

      {tab === "refunds" && (
        <form className="card" onSubmit={(e) => refund(e).catch((err) => setError(err.message))}>
          <h3 style={{ marginTop: 0 }}>Issue refund</h3>
          <div className="field">
            <label>Payment</label>
            <select required value={refundForm.payment_id} onChange={(e) => setRefundForm({ ...refundForm, payment_id: e.target.value })}>
              <option value="">Select payment</option>
              {payments.map((p) => (
                <option key={p.id} value={p.id}>{p.invoice_no} — ₹{p.amount} ({p.method})</option>
              ))}
            </select>
          </div>
          <div className="grid-2">
            <div className="field">
              <label>Amount</label>
              <input type="number" required value={refundForm.amount} onChange={(e) => setRefundForm({ ...refundForm, amount: e.target.value })} />
            </div>
            <div className="field">
              <label>Reason</label>
              <input required value={refundForm.reason} onChange={(e) => setRefundForm({ ...refundForm, reason: e.target.value })} />
            </div>
          </div>
          <button type="submit">Create refund</button>
        </form>
      )}
    </div>
  );
}


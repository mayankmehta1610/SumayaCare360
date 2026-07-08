import { FormEvent, useEffect, useState } from "react";
import { api } from "../api/client";

export default function ClinicalHubPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [tests, setTests] = useState<any[]>([]);
  const [beds, setBeds] = useState<any[]>([]);
  const [payers, setPayers] = useState<any[]>([]);
  const [labOrders, setLabOrders] = useState<any[]>([]);
  const [ipd, setIpd] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [labForm, setLabForm] = useState({ patient_id: "", test_code: "" });
  const [ipdForm, setIpdForm] = useState({ patient_id: "", bed_code: "" });
  const [claimForm, setClaimForm] = useState({ patient_id: "", payer_code: "", amount: "1000", policy_no: "" });

  async function load() {
    const [p, t, b, py, lo, ip, cl] = await Promise.all([
      api<any[]>("/patients"),
      api<any[]>("/masters/lab-tests"),
      api<any[]>("/admin/beds"),
      api<any[]>("/masters/insurance-payers"),
      api<any[]>("/clinical/lab-orders"),
      api<any[]>("/clinical/ipd-admissions"),
      api<any[]>("/clinical/insurance-claims"),
    ]);
    setPatients(p);
    setTests(t);
    setBeds(b.filter((x) => x.status === "available"));
    setPayers(py);
    setLabOrders(lo);
    setIpd(ip);
    setClaims(cl);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function orderLab(e: FormEvent) {
    e.preventDefault();
    const q = new URLSearchParams({ patient_id: labForm.patient_id, test_code: labForm.test_code });
    await api(`/clinical/lab-orders?${q}`, { method: "POST" });
    setMsg("Lab order created");
    await load();
  }

  async function admit(e: FormEvent) {
    e.preventDefault();
    const q = new URLSearchParams({ patient_id: ipdForm.patient_id, bed_code: ipdForm.bed_code });
    await api(`/clinical/ipd-admissions?${q}`, { method: "POST" });
    setMsg("Patient admitted");
    await load();
  }

  async function dischargeIpd(id: string) {
    const res = await api<{ invoice: { invoice_no: string; total: number } }>(`/clinical/ipd-admissions/${id}/discharge`, { method: "POST" });
    setMsg(`Discharged — invoice ${res.invoice.invoice_no} (₹${res.invoice.total}). Bed released.`);
    await load();
  }

  async function submitClaim(e: FormEvent) {
    e.preventDefault();
    const q = new URLSearchParams({
      patient_id: claimForm.patient_id,
      payer_code: claimForm.payer_code,
      amount: claimForm.amount,
      policy_no: claimForm.policy_no,
    });
    await api(`/clinical/insurance-claims?${q}`, { method: "POST" });
    setMsg("Claim submitted");
    await load();
  }

  return (
    <div>
      <h1 className="page-title">Clinical operations hub</h1>
      <p className="muted">Laboratory · IPD · Insurance claims — masters from PostgreSQL</p>
      {error && <div className="error">{error}</div>}
      {msg && <div className="success">{msg}</div>}
      <div className="grid-2">
        <form className="card" onSubmit={(e) => orderLab(e).catch((err) => setError(err.message))}>
          <h3 style={{ marginTop: 0 }}>Lab order</h3>
          <div className="field"><label>Patient</label>
            <select required value={labForm.patient_id} onChange={(e) => setLabForm({ ...labForm, patient_id: e.target.value })}>
              <option value="">Select</option>
              {patients.map((p) => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
            </select>
          </div>
          <div className="field"><label>Test (master)</label>
            <select required value={labForm.test_code} onChange={(e) => setLabForm({ ...labForm, test_code: e.target.value })}>
              <option value="">Select</option>
              {tests.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
            </select>
          </div>
          <button type="submit">Order test</button>
        </form>
        <form className="card" onSubmit={(e) => admit(e).catch((err) => setError(err.message))}>
          <h3 style={{ marginTop: 0 }}>IPD admission</h3>
          <div className="field"><label>Patient</label>
            <select required value={ipdForm.patient_id} onChange={(e) => setIpdForm({ ...ipdForm, patient_id: e.target.value })}>
              <option value="">Select</option>
              {patients.map((p) => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
            </select>
          </div>
          <div className="field"><label>Bed (master)</label>
            <select required value={ipdForm.bed_code} onChange={(e) => setIpdForm({ ...ipdForm, bed_code: e.target.value })}>
              <option value="">Select</option>
              {beds.map((b) => <option key={b.id} value={b.bed_code}>{b.bed_code} · {b.room_code}</option>)}
            </select>
          </div>
          <button type="submit">Admit</button>
        </form>
        <form className="card" onSubmit={(e) => submitClaim(e).catch((err) => setError(err.message))}>
          <h3 style={{ marginTop: 0 }}>Insurance claim</h3>
          <div className="field"><label>Patient</label>
            <select required value={claimForm.patient_id} onChange={(e) => setClaimForm({ ...claimForm, patient_id: e.target.value })}>
              <option value="">Select</option>
              {patients.map((p) => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
            </select>
          </div>
          <div className="field"><label>Payer (master)</label>
            <select required value={claimForm.payer_code} onChange={(e) => setClaimForm({ ...claimForm, payer_code: e.target.value })}>
              <option value="">Select</option>
              {payers.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
            </select>
          </div>
          <div className="field"><label>Policy no</label>
            <input value={claimForm.policy_no} onChange={(e) => setClaimForm({ ...claimForm, policy_no: e.target.value })} />
          </div>
          <div className="field"><label>Amount</label>
            <input type="number" required value={claimForm.amount} onChange={(e) => setClaimForm({ ...claimForm, amount: e.target.value })} />
          </div>
          <button type="submit">Submit claim</button>
        </form>
      </div>
      <div className="grid-2" style={{ marginTop: "1rem" }}>
        <div className="card table-wrap">
          <h3 style={{ marginTop: 0 }}>Lab orders</h3>
          <table><thead><tr><th>Order</th><th>Test</th><th>Status</th></tr></thead>
            <tbody>{labOrders.map((r) => <tr key={r.id}><td>{r.order_no}</td><td>{r.test_code}</td><td>{r.status}</td></tr>)}</tbody></table>
        </div>
        <div className="card table-wrap">
          <h3 style={{ marginTop: 0 }}>IPD admissions</h3>
          <table><thead><tr><th>Admission</th><th>Bed</th><th>Status</th><th></th></tr></thead>
            <tbody>{ipd.map((r) => (
              <tr key={r.id}>
                <td>{r.admission_no}</td>
                <td>{r.bed_code}</td>
                <td>{r.status}</td>
                <td>
                  {r.status !== "discharged" && (
                    <button type="button" className="secondary" onClick={() => dischargeIpd(r.id).catch((e) => setError(e.message))}>
                      Discharge & bill
                    </button>
                  )}
                </td>
              </tr>
            ))}</tbody></table>
        </div>
        <div className="card table-wrap">
          <h3 style={{ marginTop: 0 }}>Insurance claims</h3>
          <table><thead><tr><th>Claim</th><th>Payer</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>{claims.map((r) => <tr key={r.id}><td>{r.claim_no}</td><td>{r.payer_code}</td><td>{r.amount}</td><td>{r.status}</td></tr>)}</tbody></table>
        </div>
      </div>
    </div>
  );
}

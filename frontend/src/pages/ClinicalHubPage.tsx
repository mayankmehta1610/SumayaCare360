import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { apiList, fetchPatients } from "../api/list";
import { useAuth } from "../context/AuthContext";
import ModuleFlowBar from "../components/ModuleFlowBar";

export default function ClinicalHubPage() {
  const { session } = useAuth();
  const prefix = session?.tenant_code ? `/${session.tenant_code}` : "";
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
  const [claimForm, setClaimForm] = useState({ patient_id: "", payer_code: "", amount: "1000", policy_no: "" });

  async function load() {
    const [p, t, b, py, lo, ip, cl] = await Promise.all([
      fetchPatients(),
      api<any[]>("/masters/lab-tests"),
      api<any[]>("/admin/beds"),
      api<any[]>("/masters/insurance-payers"),
      apiList<any>("/clinical/lab-orders", { page: 1, page_size: 200 }).then((r) => r.items),
      api<any[]>("/clinical/ipd-admissions"),
      api<any[]>("/finance/claims"),
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
    await api("/clinical/lab-orders", {
      method: "POST",
      body: JSON.stringify({ patient_id: labForm.patient_id, test_code: labForm.test_code }),
    });
    setMsg("Lab order created");
    await load();
  }

  async function dischargeIpd(id: string) {
    const res = await api<{ invoice: { invoice_no: string; total: number } }>(`/clinical/ipd-admissions/${id}/discharge`, { method: "POST" });
    setMsg(`Discharged — invoice ${res.invoice.invoice_no} (₹${res.invoice.total}). Bed released.`);
    await load();
  }

  async function submitClaim(e: FormEvent) {
    e.preventDefault();
    await api("/finance/claims", {
      method: "POST",
      body: JSON.stringify({
        patient_id: claimForm.patient_id,
        payer_code: claimForm.payer_code,
        amount: Number(claimForm.amount),
        policy_no: claimForm.policy_no,
      }),
    });
    setMsg("Claim submitted");
    await load();
  }

  return (
    <div>
      <ModuleFlowBar moduleCode="laboratory-and-diagnostics" compact />
      <h1 className="page-title">Clinical operations hub</h1>
      <p className="muted">Laboratory · IPD · Insurance — linked to encounters, billing & care programs</p>
      <div className="actions" style={{ marginBottom: "1rem" }}>
        <Link to={`${prefix}/laboratory`} className="secondary button-link">Laboratory</Link>
        <Link to={`${prefix}/radiology`} className="secondary button-link">Radiology</Link>
        <Link to={`${prefix}/pharmacy`} className="secondary button-link">Pharmacy</Link>
        <Link to={`${prefix}/inpatient`} className="secondary button-link">Inpatient</Link>
        <Link to={`${prefix}/insurance-claims`} className="secondary button-link">Insurance claims</Link>
        <Link to={`${prefix}/hubs/finance`} className="secondary button-link">Finance hub →</Link>
      </div>
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
        <div className="card">
          <h3 style={{ marginTop: 0 }}>IPD admission</h3>
          <p><strong>{beds.length}</strong> governed beds currently available.</p>
          <p className="muted">Admissions now use the complete workflow: patient, linked ward/room/bed, diagnosis master and required clinical details.</p>
          <Link to={`${prefix}/inpatient`} className="button-link">Open complete admission workflow</Link>
        </div>
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


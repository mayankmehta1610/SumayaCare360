import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { fetchPatients } from "../api/list";
import ModuleFlowBar from "../components/ModuleFlowBar";

export default function BillingPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [tariffs, setTariffs] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [form, setForm] = useState({ patient_id: "", tariff_code: "" });
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  async function load() {
    const [p, t, i] = await Promise.all([
      fetchPatients(),
      api<any[]>("/masters/tariffs"),
      api<any[]>("/billing/invoices"),
    ]);
    setPatients(p);
    setTariffs(t);
    setInvoices(i);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function createEstimate(e: FormEvent) {
    e.preventDefault();
    const est = await api<any>("/billing/estimates", {
      method: "POST",
      body: JSON.stringify({
        patient_id: form.patient_id,
        lines: [{ tariff_code: form.tariff_code, qty: 1 }],
      }),
    });
    setMsg(`Estimate ${est.estimate_no} — ₹${est.total}`);
    await load();
  }

  async function createInvoice(e: FormEvent) {
    e.preventDefault();
    const inv = await api<any>("/billing/invoices", {
      method: "POST",
      body: JSON.stringify({
        patient_id: form.patient_id,
        lines: [{ tariff_code: form.tariff_code, qty: 1 }],
      }),
    });
    setMsg(`Invoice ${inv.invoice_no} created for ${inv.total}`);
    await load();
  }

  async function pay(invoiceId: string, amount: number) {
    await api("/billing/payments", {
      method: "POST",
      body: JSON.stringify({
        invoice_id: invoiceId,
        amount,
        gateway_token_ref: `tok_${crypto.randomUUID()}`,
        masked_last4: "4242",
        gateway: "stub",
      }),
    });
    setMsg("Payment recorded (tokenized — no raw card data)");
    await load();
  }

  return (
    <div>
      <ModuleFlowBar moduleCode="billing-tariff-and-payments" compact />
      <h1 className="page-title">Billing</h1>
      <p className="muted">Invoices auto-created on OPD/IPD discharge. Manual invoices also supported. Payments use gateway tokens only (PCI).</p>
      <div className="actions" style={{ marginBottom: "1rem" }}>
        <Link to="/insurance-claims" className="secondary button-link">Insurance claims</Link>
        <Link to="/revenue-cycle" className="secondary button-link">Revenue cycle</Link>
        <Link to="/hubs/finance" className="secondary button-link">Finance hub</Link>
      </div>
      {error && <div className="error">{error}</div>}
      {msg && <div className="success">{msg}</div>}
      <div className="grid-2">
        <form className="card" onSubmit={(e) => createInvoice(e).catch((err) => setError(err.message))}>
          <h3 style={{ marginTop: 0 }}>Create invoice</h3>
          <div className="field">
            <label>Patient</label>
            <select required value={form.patient_id} onChange={(e) => setForm({ ...form, patient_id: e.target.value })}>
              <option value="">Select</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.first_name} {p.last_name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Tariff (master)</label>
            <select required value={form.tariff_code} onChange={(e) => setForm({ ...form, tariff_code: e.target.value })}>
              <option value="">Select</option>
              {tariffs.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.name} — ₹{t.amount}
                </option>
              ))}
            </select>
          </div>
          <button type="submit">Issue invoice</button>
          <button type="button" className="secondary" style={{ marginLeft: "0.5rem" }} onClick={(e) => createEstimate(e).catch((err) => setError(err.message))}>
            Create estimate
          </button>
        </form>
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Encounter</th>
                <th>Total</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((i) => (
                <tr key={i.id}>
                  <td>{i.invoice_no}</td>
                  <td>{i.encounter_id ? i.encounter_id.slice(0, 8) : "IPD / manual"}</td>
                  <td>
                    {i.currency} {i.total}
                  </td>
                  <td>
                    <span className="badge">{i.status}</span>
                  </td>
                  <td>
                    {i.status !== "paid" && (
                      <button type="button" className="secondary" onClick={() => pay(i.id, i.total).catch((e) => setError(e.message))}>
                        Pay
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


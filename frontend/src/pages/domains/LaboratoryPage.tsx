import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import ModuleFlowBar from "../../components/ModuleFlowBar";

type LabOrder = {
  id: string;
  order_no: string;
  test_code: string;
  status: string;
  patient_id: string;
  result_value?: string;
  result_notes?: string;
  critical_flag?: boolean;
};

const NEXT_STATUS: Record<string, string> = {
  ordered: "sample_collected",
  sample_collected: "result_entered",
  result_entered: "verified",
};

export default function LaboratoryPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [tests, setTests] = useState<any[]>([]);
  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ patient_id: "", test_code: "" });
  const [resultForm, setResultForm] = useState({ orderId: "", result_value: "", result_notes: "", critical_flag: false });

  const patientMap = useMemo(() => {
    const m = new Map<string, string>();
    patients.forEach((p) => m.set(p.id, `${p.first_name} ${p.last_name}`));
    return m;
  }, [patients]);

  async function load() {
    const [p, t, o] = await Promise.all([
      api<any[]>("/patients"),
      api<any[]>("/masters/lab-tests"),
      api<LabOrder[]>("/clinical/lab-orders"),
    ]);
    setPatients(p);
    setTests(t);
    setOrders(o);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function createOrder(e: FormEvent) {
    e.preventDefault();
    await api("/clinical/lab-orders", {
      method: "POST",
      body: JSON.stringify({ patient_id: form.patient_id, test_code: form.test_code }),
    });
    setMsg("Lab order created");
    setForm({ patient_id: "", test_code: "" });
    await load();
  }

  async function advanceStatus(order: LabOrder) {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    await api(`/clinical/lab-orders/${order.id}/status?status=${next}`, { method: "PATCH" });
    setMsg(`Order ${order.order_no} → ${next}`);
    await load();
  }

  async function saveResult(e: FormEvent) {
    e.preventDefault();
    await api(`/clinical/lab-orders/${resultForm.orderId}/results`, {
      method: "POST",
      body: JSON.stringify({
        result_value: resultForm.result_value,
        result_notes: resultForm.result_notes,
        critical_flag: resultForm.critical_flag,
        results: { value: resultForm.result_value },
      }),
    });
    setMsg("Results entered");
    setResultForm({ orderId: "", result_value: "", result_notes: "", critical_flag: false });
    await load();
  }

  const active = orders.filter((o) => !["verified", "critical_alert"].includes(o.status));

  return (
    <div>
      <ModuleFlowBar moduleCode="laboratory-and-diagnostics" compact />
      <h1 className="page-title">Laboratory & diagnostics</h1>
      <p className="muted">ordered → sample_collected → result_entered → verified / critical_alert</p>
      <div className="actions" style={{ marginBottom: "1rem" }}>
        <Link to="/clinical-hub" className="secondary button-link">Clinical hub</Link>
        <Link to="/radiology" className="secondary button-link">Radiology</Link>
        <Link to="/masters" className="secondary button-link">Lab test masters</Link>
      </div>
      {error && <div className="error">{error}</div>}
      {msg && <div className="success">{msg}</div>}

      <div className="grid-2">
        <form className="card" onSubmit={(e) => createOrder(e).catch((err) => setError(err.message))}>
          <h3 style={{ marginTop: 0 }}>New lab order</h3>
          <div className="field">
            <label>Patient</label>
            <select required value={form.patient_id} onChange={(e) => setForm({ ...form, patient_id: e.target.value })}>
              <option value="">Select</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.mrn} — {p.first_name} {p.last_name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Test (master)</label>
            <select required value={form.test_code} onChange={(e) => setForm({ ...form, test_code: e.target.value })}>
              <option value="">Select</option>
              {tests.map((t) => (
                <option key={t.code} value={t.code}>{t.name} ({t.code})</option>
              ))}
            </select>
          </div>
          <button type="submit">Order test</button>
        </form>

        <form className="card" onSubmit={(e) => saveResult(e).catch((err) => setError(err.message))}>
          <h3 style={{ marginTop: 0 }}>Result entry</h3>
          <div className="field">
            <label>Order (sample collected)</label>
            <select
              required
              value={resultForm.orderId}
              onChange={(e) => setResultForm({ ...resultForm, orderId: e.target.value })}
            >
              <option value="">Select</option>
              {orders.filter((o) => o.status === "sample_collected").map((o) => (
                <option key={o.id} value={o.id}>{o.order_no} — {o.test_code}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Result value</label>
            <input required value={resultForm.result_value} onChange={(e) => setResultForm({ ...resultForm, result_value: e.target.value })} />
          </div>
          <div className="field">
            <label>Notes</label>
            <textarea rows={2} value={resultForm.result_notes} onChange={(e) => setResultForm({ ...resultForm, result_notes: e.target.value })} />
          </div>
          <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.75rem" }}>
            <input type="checkbox" checked={resultForm.critical_flag} onChange={(e) => setResultForm({ ...resultForm, critical_flag: e.target.checked })} />
            Critical result
          </label>
          <button type="submit">Enter results</button>
        </form>
      </div>

      <div className="card table-wrap" style={{ marginTop: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>Lab orders ({active.length} active)</h3>
        <table>
          <thead>
            <tr><th>Order</th><th>Patient</th><th>Test</th><th>Status</th><th>Result</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td>{o.order_no}</td>
                <td>{patientMap.get(o.patient_id) || "—"}</td>
                <td>{o.test_code}</td>
                <td><span className="badge">{o.status}</span></td>
                <td>{o.result_value || "—"}</td>
                <td className="actions">
                  {NEXT_STATUS[o.status] && (
                    <button type="button" className="secondary" onClick={() => advanceStatus(o).catch((e) => setError(e.message))}>
                      → {NEXT_STATUS[o.status]}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import ModuleFlowBar from "../../components/ModuleFlowBar";

type RadOrder = {
  id: string;
  order_no: string;
  study_code: string;
  status: string;
  patient_id: string;
  report_text?: string;
  pacs_link?: string;
};

const STUDIES = ["XRAY-CHEST", "USG-ABD", "CT-HEAD", "MRI-SPINE", "MAMMO-SCREEN"];
const NEXT_STATUS: Record<string, string> = {
  ordered: "scheduled",
  scheduled: "acquired",
  acquired: "reported",
};

export default function RadiologyPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [orders, setOrders] = useState<RadOrder[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ patient_id: "", study_code: STUDIES[0] });
  const [reportId, setReportId] = useState("");
  const [reportText, setReportText] = useState("");
  const [pacsLink, setPacsLink] = useState("");

  const patientMap = useMemo(() => {
    const m = new Map<string, string>();
    patients.forEach((p) => m.set(p.id, `${p.first_name} ${p.last_name}`));
    return m;
  }, [patients]);

  async function load() {
    const [p, o] = await Promise.all([api<any[]>("/patients"), api<RadOrder[]>("/clinical/radiology-orders")]);
    setPatients(p);
    setOrders(o);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function createOrder(e: FormEvent) {
    e.preventDefault();
    await api("/clinical/radiology-orders", {
      method: "POST",
      body: JSON.stringify({ patient_id: form.patient_id, study_code: form.study_code }),
    });
    setMsg("Imaging order created");
    await load();
  }

  async function advanceStatus(order: RadOrder) {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    await api(`/clinical/radiology-orders/${order.id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: next }),
    });
    setMsg(`Order ${order.order_no} → ${next}`);
    await load();
  }

  async function saveReport(e: FormEvent) {
    e.preventDefault();
    await api(`/clinical/radiology-orders/${reportId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: "reported", report_text: reportText, pacs_link: pacsLink }),
    });
    setMsg("Report saved");
    setReportId("");
    setReportText("");
    setPacsLink("");
    await load();
  }

  return (
    <div>
      <ModuleFlowBar moduleCode="radiology-and-imaging" compact />
      <h1 className="page-title">Radiology & imaging</h1>
      <p className="muted">ordered → scheduled → acquired → reported / critical</p>
      <div className="actions" style={{ marginBottom: "1rem" }}>
        <Link to="/laboratory" className="secondary button-link">Laboratory</Link>
        <Link to="/pharmacy" className="secondary button-link">Pharmacy</Link>
      </div>
      {error && <div className="error">{error}</div>}
      {msg && <div className="success">{msg}</div>}

      <div className="grid-2">
        <form className="card" onSubmit={(e) => createOrder(e).catch((err) => setError(err.message))}>
          <h3 style={{ marginTop: 0 }}>New imaging order</h3>
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
            <label>Study</label>
            <select value={form.study_code} onChange={(e) => setForm({ ...form, study_code: e.target.value })}>
              {STUDIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <button type="submit">Order imaging</button>
        </form>

        <form className="card" onSubmit={(e) => saveReport(e).catch((err) => setError(err.message))}>
          <h3 style={{ marginTop: 0 }}>Dictate report</h3>
          <div className="field">
            <label>Order (acquired)</label>
            <select required value={reportId} onChange={(e) => setReportId(e.target.value)}>
              <option value="">Select</option>
              {orders.filter((o) => o.status === "acquired").map((o) => (
                <option key={o.id} value={o.id}>{o.order_no} — {o.study_code}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Report</label>
            <textarea rows={4} required value={reportText} onChange={(e) => setReportText(e.target.value)} />
          </div>
          <div className="field">
            <label>PACS link</label>
            <input value={pacsLink} onChange={(e) => setPacsLink(e.target.value)} placeholder="https://pacs..." />
          </div>
          <button type="submit">Finalize report</button>
        </form>
      </div>

      <div className="card table-wrap" style={{ marginTop: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>Imaging orders</h3>
        <table>
          <thead>
            <tr><th>Order</th><th>Patient</th><th>Study</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td>{o.order_no}</td>
                <td>{patientMap.get(o.patient_id) || "—"}</td>
                <td>{o.study_code}</td>
                <td><span className="badge">{o.status}</span></td>
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

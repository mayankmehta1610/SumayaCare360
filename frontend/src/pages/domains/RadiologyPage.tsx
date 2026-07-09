import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { fetchPatients } from "../../api/list";
import ClinicalListDesk from "../../components/ClinicalListDesk";
import ModuleFlowBar from "../../components/ModuleFlowBar";
import { useAuth } from "../../context/AuthContext";
import { canDelete, canWrite } from "../../hooks/usePermissions";

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
const STATUSES = ["ordered", "scheduled", "acquired", "reported", "critical"];

export default function RadiologyPage() {
  const { session } = useAuth();
  const write = canWrite(session, "encounters");
  const del = canDelete(session);
  const [patients, setPatients] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ patient_id: "", study_code: STUDIES[0] });
  const [reportId, setReportId] = useState("");
  const [reportText, setReportText] = useState("");
  const [pacsLink, setPacsLink] = useState("");
  const [deskKey, setDeskKey] = useState(0);

  const patientMap = useMemo(() => {
    const m = new Map<string, string>();
    patients.forEach((p) => m.set(p.id, `${p.first_name} ${p.last_name}`));
    return m;
  }, [patients]);

  useEffect(() => {
    fetchPatients().then(setPatients).catch((e) => setError(e.message));
  }, []);

  async function createOrder(e: FormEvent) {
    e.preventDefault();
    await api("/clinical/radiology-orders", {
      method: "POST",
      body: JSON.stringify({ patient_id: form.patient_id, study_code: form.study_code }),
    });
    setMsg("Imaging order created");
    setDeskKey((k) => k + 1);
  }

  async function advanceStatus(order: RadOrder, reload: () => void) {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    await api(`/clinical/radiology-orders/${order.id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: next }),
    });
    setMsg(`Order ${order.order_no} → ${next}`);
    reload();
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
    setDeskKey((k) => k + 1);
  }

  async function remove(order: RadOrder, reload: () => void) {
    if (!confirm("Delete this order?")) return;
    await api(`/clinical/radiology-orders/${order.id}`, { method: "DELETE" });
    setMsg("Deleted");
    reload();
  }

  const columns = useMemo(() => [
    { key: "order_no", label: "Order" },
    { key: "patient_id", label: "Patient", render: (o: RadOrder) => patientMap.get(o.patient_id) || "—" },
    { key: "study_code", label: "Study" },
    { key: "status", label: "Status", render: (o: RadOrder) => <span className="badge">{o.status}</span> },
    { key: "report_text", label: "Report", render: (o: RadOrder) => o.report_text ? "Yes" : "—" },
  ], [patientMap]);

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

      {write && (
        <div className="grid-2" style={{ marginBottom: "1rem" }}>
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
              <label>Order ID (acquired)</label>
              <input required value={reportId} onChange={(e) => setReportId(e.target.value)} placeholder="Order UUID" />
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
      )}

      <ClinicalListDesk<RadOrder>
        key={deskKey}
        title="Imaging orders"
        listPath="/clinical/radiology-orders"
        exportPath="/clinical/radiology-orders/export"
        columns={columns}
        rowKey={(o) => o.id}
        searchPlaceholder="Search order no or study…"
        statusOptions={STATUSES}
        canWrite={write}
        renderActions={write ? (o, reload) => (
          <>
            {NEXT_STATUS[o.status] && (
              <button type="button" className="secondary" onClick={() => advanceStatus(o, reload).catch((e) => setError(e.message))}>
                → {NEXT_STATUS[o.status]}
              </button>
            )}
            {del && <button type="button" className="secondary" onClick={() => remove(o, reload).catch((e) => setError(e.message))}>Delete</button>}
          </>
        ) : undefined}
      />
    </div>
  );
}

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { fetchPatients } from "../../api/list";
import ClinicalListDesk from "../../components/ClinicalListDesk";
import ModuleFlowBar from "../../components/ModuleFlowBar";
import ClinicalProfileFields, { createClinicalProfile } from "../../components/ClinicalProfileFields";
import { useAuth } from "../../context/AuthContext";
import { canDelete, canOrderClinical, canWrite } from "../../hooks/usePermissions";

type RadOrder = {
  id: string;
  order_no: string;
  study_code: string;
  status: string;
  patient_id: string;
  report_text?: string;
  pacs_link?: string;
};

type Study = { code: string; name: string };

export default function RadiologyPage() {
  const { session } = useAuth();
  const write = canWrite(session, "radiology");
  const canOrder = canOrderClinical(session, "radiology");
  const del = canDelete(session, "radiology");
  const [patients, setPatients] = useState<any[]>([]);
  const [studies, setStudies] = useState<Study[]>([]);
  const [workflow, setWorkflow] = useState<{ statuses: string[]; next: Record<string, string> }>({ statuses: [], next: {} });
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ patient_id: "", study_code: "" });
  const [orderProfile, setOrderProfile] = useState(() => createClinicalProfile("radiology"));
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
    Promise.all([
      fetchPatients(),
      api<Study[]>("/clinical/radiology/studies"),
      api<{ statuses: string[]; next: Record<string, string> }>("/clinical/radiology/workflow"),
    ])
      .then(([p, s, wf]) => {
        setPatients(p);
        setStudies(s);
        setWorkflow(wf);
        if (s.length > 0) setForm((f) => ({ ...f, study_code: f.study_code || s[0].code }));
      })
      .catch((e) => setError(e.message));
  }, []);

  async function createOrder(e: FormEvent) {
    e.preventDefault();
    await api("/clinical/radiology-orders", {
      method: "POST",
        body: JSON.stringify({ patient_id: form.patient_id, study_code: form.study_code, order_profile: orderProfile }),
    });
    setMsg("Imaging order created");
    setDeskKey((k) => k + 1);
  }

  async function advanceStatus(order: RadOrder, reload: () => void) {
    const next = workflow.next[order.status];
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
      <p className="muted">
        {workflow.statuses.length > 0 ? workflow.statuses.join(" → ") : "Loading workflow…"}
      </p>
      <div className="actions" style={{ marginBottom: "1rem" }}>
        <Link to="/laboratory" className="secondary button-link">Laboratory</Link>
        <Link to="/pharmacy" className="secondary button-link">Pharmacy</Link>
      </div>
      {error && <div className="error">{error}</div>}
      {msg && <div className="success">{msg}</div>}

      {canOrder && (
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
                {studies.map((s) => <option key={s.code} value={s.code}>{s.name} ({s.code})</option>)}
              </select>
            </div>
            <button type="submit">Order imaging</button>
          <ClinicalProfileFields type="radiology" values={orderProfile} onChange={setOrderProfile} />
          </form>

          {write && (
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
          )}
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
        statusOptions={workflow.statuses}
        canWrite={canOrder || write}
        renderActions={(canOrder || write) ? (o, reload) => (
          <>
            {workflow.next[o.status] && (
              <button type="button" className="secondary" onClick={() => advanceStatus(o, reload).catch((e) => setError(e.message))}>
                → {workflow.next[o.status]}
              </button>
            )}
            {del && <button type="button" className="secondary" onClick={() => remove(o, reload).catch((e) => setError(e.message))}>Delete</button>}
          </>
        ) : undefined}
      />
    </div>
  );
}

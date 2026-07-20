import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { fetchPatients } from "../../api/list";
import ClinicalListDesk from "../../components/ClinicalListDesk";
import ModuleFlowBar from "../../components/ModuleFlowBar";
import ClinicalProfileFields, { createClinicalProfile } from "../../components/ClinicalProfileFields";
import { useAuth } from "../../context/AuthContext";
import { canOrderClinical, canWrite } from "../../hooks/usePermissions";

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

export default function LaboratoryPage() {
  const { session } = useAuth();
  const write = canWrite(session, "laboratory");
  const canOrder = canOrderClinical(session, "laboratory");
  const [patients, setPatients] = useState<any[]>([]);
  const [tests, setTests] = useState<any[]>([]);
  const [workflow, setWorkflow] = useState<{ statuses: string[]; next: Record<string, string> }>({ statuses: [], next: {} });
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ patient_id: "", test_code: "" });
  const [orderProfile, setOrderProfile] = useState(() => createClinicalProfile("laboratory"));
  const [resultForm, setResultForm] = useState({ orderId: "", result_value: "", result_notes: "", critical_flag: false });
  const [deskKey, setDeskKey] = useState(0);

  const patientMap = useMemo(() => {
    const m = new Map<string, string>();
    patients.forEach((p) => m.set(p.id, `${p.first_name} ${p.last_name}`));
    return m;
  }, [patients]);

  useEffect(() => {
    Promise.all([
      fetchPatients(),
      api<any[]>("/masters/lab-tests"),
      api<{ statuses: string[]; next: Record<string, string> }>("/clinical/lab-orders/workflow"),
    ])
      .then(([p, t, wf]) => { setPatients(p); setTests(t); setWorkflow(wf); })
      .catch((e) => setError(e.message));
  }, []);

  async function createOrder(e: FormEvent) {
    e.preventDefault();
    await api("/clinical/lab-orders", {
      method: "POST",
        body: JSON.stringify({ patient_id: form.patient_id, test_code: form.test_code, order_profile: orderProfile }),
    });
    setMsg("Lab order created");
    setForm({ patient_id: "", test_code: "" });
    setDeskKey((k) => k + 1);
  }

  async function advanceStatus(order: LabOrder, reload: () => void) {
    const next = workflow.next[order.status];
    if (!next) return;
    await api(`/clinical/lab-orders/${order.id}/status?status=${next}`, { method: "PATCH" });
    setMsg(`Order ${order.order_no} → ${next}`);
    reload();
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
    setDeskKey((k) => k + 1);
  }

  const columns = useMemo(() => [
    { key: "order_no", label: "Order" },
    { key: "patient_id", label: "Patient", render: (o: LabOrder) => patientMap.get(o.patient_id) || "—" },
    { key: "test_code", label: "Test" },
    { key: "status", label: "Status", render: (o: LabOrder) => <span className="badge">{o.status}</span> },
    { key: "result_value", label: "Result", render: (o: LabOrder) => o.result_value || "—" },
  ], [patientMap]);

  return (
    <div>
      <ModuleFlowBar moduleCode="laboratory-and-diagnostics" compact />
      <h1 className="page-title">Laboratory & diagnostics</h1>
      <p className="muted">
        {workflow.statuses.length > 0 ? workflow.statuses.join(" → ") : "Loading workflow…"}
      </p>
      <div className="actions" style={{ marginBottom: "1rem" }}>
        <Link to="/clinical-hub" className="secondary button-link">Clinical hub</Link>
        <Link to="/radiology" className="secondary button-link">Radiology</Link>
        <Link to="/masters" className="secondary button-link">Lab test masters</Link>
      </div>
      {error && <div className="error">{error}</div>}
      {msg && <div className="success">{msg}</div>}

      {canOrder && (
        <div className="grid-2" style={{ marginBottom: "1rem" }}>
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
          <ClinicalProfileFields type="laboratory" values={orderProfile} onChange={setOrderProfile} />
          </form>

          {write && (
          <form className="card" onSubmit={(e) => saveResult(e).catch((err) => setError(err.message))}>
            <h3 style={{ marginTop: 0 }}>Result entry</h3>
            <div className="field">
              <label>Order ID (sample collected)</label>
              <input
                required
                placeholder="Paste order UUID"
                value={resultForm.orderId}
                onChange={(e) => setResultForm({ ...resultForm, orderId: e.target.value })}
              />
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
          )}
        </div>
      )}

      <ClinicalListDesk<LabOrder>
        key={deskKey}
        title="Lab orders"
        listPath="/clinical/lab-orders"
        exportPath="/clinical/lab-orders/export"
        columns={columns}
        rowKey={(o) => o.id}
        searchPlaceholder="Search order no or test…"
        statusOptions={workflow.statuses}
        canWrite={canOrder || write}
        renderActions={(canOrder || write) ? (o, reload) => (
          workflow.next[o.status] ? (
            <button type="button" className="secondary" onClick={() => advanceStatus(o, reload).catch((e) => setError(e.message))}>
              → {workflow.next[o.status]}
            </button>
          ) : null
        ) : undefined}
      />
    </div>
  );
}

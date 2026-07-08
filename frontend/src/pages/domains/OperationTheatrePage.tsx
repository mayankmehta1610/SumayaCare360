import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import ModuleFlowBar from "../../components/ModuleFlowBar";

type OtProc = {
  id: string;
  procedure_no: string;
  patient_id: string;
  procedure_code: string;
  procedure_name: string;
  theatre_code?: string;
  status: string;
  pre_op_checklist: Record<string, boolean>;
};

const NEXT: Record<string, string> = {
  scheduled: "pre_op",
  pre_op: "in_progress",
  in_progress: "completed",
};

export default function OperationTheatrePage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [rows, setRows] = useState<OtProc[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ patient_id: "", procedure_code: "", procedure_name: "", theatre_code: "OT-1" });

  const patientMap = useMemo(() => {
    const m = new Map<string, string>();
    patients.forEach((p) => m.set(p.id, `${p.first_name} ${p.last_name}`));
    return m;
  }, [patients]);

  async function load() {
    const [p, o] = await Promise.all([
      api<any[]>("/patients"),
      api<OtProc[]>("/ot/procedures"),
    ]);
    setPatients(p);
    setRows(o);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function schedule(e: FormEvent) {
    e.preventDefault();
    await api("/ot/procedures", {
      method: "POST",
      body: JSON.stringify(form),
    });
    setMsg("OT procedure scheduled");
    await load();
  }

  async function toggleCheck(proc: OtProc, key: string) {
    const checklist = { ...proc.pre_op_checklist, [key]: !proc.pre_op_checklist?.[key] };
    await api(`/ot/procedures/${proc.id}/pre-op`, {
      method: "PATCH",
      body: JSON.stringify({ checklist }),
    });
    await load();
  }

  async function advance(proc: OtProc) {
    const next = NEXT[proc.status];
    if (!next) return;
    await api(`/ot/procedures/${proc.id}/status?status=${next}`, { method: "PATCH" });
    setMsg(`${proc.procedure_no} → ${next}`);
    await load();
  }

  return (
    <div>
      <ModuleFlowBar moduleCode="operation-theatre-and-procedures" compact />
      <h1 className="page-title">Operation theatre & procedures</h1>
      <p className="muted">scheduled → pre_op (checklist) → in_progress → completed</p>
      <div className="actions" style={{ marginBottom: "1rem" }}>
        <Link to="/inpatient" className="secondary button-link">IPD</Link>
        <Link to="/nursing" className="secondary button-link">Nursing</Link>
      </div>
      {error && <div className="error">{error}</div>}
      {msg && <div className="success">{msg}</div>}

      <form className="card" onSubmit={(e) => schedule(e).catch((err) => setError(err.message))}>
        <h3 style={{ marginTop: 0 }}>Schedule procedure</h3>
        <div className="grid-2">
          <div className="field">
            <label>Patient</label>
            <select required value={form.patient_id} onChange={(e) => setForm({ ...form, patient_id: e.target.value })}>
              <option value="">Select</option>
              {patients.map((p) => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Theatre</label>
            <input value={form.theatre_code} onChange={(e) => setForm({ ...form, theatre_code: e.target.value })} />
          </div>
        </div>
        <div className="grid-2">
          <div className="field">
            <label>Procedure code</label>
            <input required value={form.procedure_code} onChange={(e) => setForm({ ...form, procedure_code: e.target.value })} />
          </div>
          <div className="field">
            <label>Procedure name</label>
            <input required value={form.procedure_name} onChange={(e) => setForm({ ...form, procedure_name: e.target.value })} />
          </div>
        </div>
        <button type="submit">Schedule</button>
      </form>

      <div className="card table-wrap" style={{ marginTop: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>OT schedule</h3>
        <table>
          <thead><tr><th>Case</th><th>Patient</th><th>Procedure</th><th>Theatre</th><th>Pre-op</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td>{p.procedure_no}</td>
                <td>{patientMap.get(p.patient_id) || "—"}</td>
                <td>{p.procedure_name}</td>
                <td>{p.theatre_code}</td>
                <td>
                  {["consent", "labs_ok", "npo"].map((k) => (
                    <label key={k} style={{ marginRight: "0.5rem", fontSize: "0.85rem" }}>
                      <input
                        type="checkbox"
                        checked={!!p.pre_op_checklist?.[k]}
                        disabled={!["scheduled", "pre_op"].includes(p.status)}
                        onChange={() => toggleCheck(p, k).catch((e) => setError(e.message))}
                      />
                      {k}
                    </label>
                  ))}
                </td>
                <td><span className="badge">{p.status}</span></td>
                <td>
                  {NEXT[p.status] && (
                    <button type="button" className="secondary" onClick={() => advance(p).catch((e) => setError(e.message))}>
                      → {NEXT[p.status]}
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

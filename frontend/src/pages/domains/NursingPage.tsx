import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { apiList, fetchPatients } from "../../api/list";
import ModuleFlowBar from "../../components/ModuleFlowBar";
import ClinicalProfileFields, { createClinicalProfile } from "../../components/ClinicalProfileFields";

type Task = {
  id: string;
  task_type: string;
  description?: string;
  status: string;
  patient_id: string;
  admission_id?: string;
  due_at?: string;
};

const NEXT: Record<string, string> = { pending: "in_progress", in_progress: "completed" };

export default function NursingPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [admissions, setAdmissions] = useState<any[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ patient_id: "", admission_id: "", task_type: "vitals_check", description: "" });
  const [careProfile, setCareProfile] = useState(() => createClinicalProfile("nursing"));

  const patientMap = useMemo(() => {
    const m = new Map<string, string>();
    patients.forEach((p) => m.set(p.id, `${p.first_name} ${p.last_name}`));
    return m;
  }, [patients]);

  async function load() {
    const [p, ipd, t] = await Promise.all([
      fetchPatients(),
      api<any[]>("/clinical/ipd-admissions"),
      apiList<Task>("/clinical/nursing-tasks", { page: 1, page_size: 200 }).then((r) => r.items),
    ]);
    setPatients(p);
    setAdmissions(ipd.filter((a) => a.status !== "discharged"));
    setTasks(t);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function createTask(e: FormEvent) {
    e.preventDefault();
    await api("/clinical/nursing-tasks", {
      method: "POST",
      body: JSON.stringify({
        patient_id: form.patient_id,
        admission_id: form.admission_id || undefined,
        task_type: form.task_type,
        description: form.description,
        care_profile: careProfile,
      }),
    });
    setMsg("Nursing task created");
    await load();
  }

  async function advance(task: Task) {
    const next = NEXT[task.status];
    if (!next) return;
    await api(`/clinical/nursing-tasks/${task.id}/status?status=${next}`, { method: "PATCH" });
    setMsg(`Task → ${next}`);
    await load();
  }

  return (
    <div>
      <ModuleFlowBar moduleCode="nursing-and-care-plans" compact />
      <h1 className="page-title">Nursing & care plans</h1>
      <p className="muted">Task checklist linked to IPD admissions · pending → in_progress → completed</p>
      <div className="actions" style={{ marginBottom: "1rem" }}>
        <Link to="/inpatient" className="secondary button-link">IPD admissions</Link>
        <Link to="/encounters" className="secondary button-link">Clinical encounters</Link>
      </div>
      {error && <div className="error">{error}</div>}
      {msg && <div className="success">{msg}</div>}

      <form className="card" onSubmit={(e) => createTask(e).catch((err) => setError(err.message))}>
        <h3 style={{ marginTop: 0 }}>New nursing task</h3>
        <div className="grid-2">
          <div className="field">
            <label>Patient</label>
            <select required value={form.patient_id} onChange={(e) => setForm({ ...form, patient_id: e.target.value })}>
              <option value="">Select</option>
              {patients.map((p) => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>IPD admission (optional)</label>
            <select value={form.admission_id} onChange={(e) => setForm({ ...form, admission_id: e.target.value })}>
              <option value="">None</option>
              {admissions.map((a) => <option key={a.id} value={a.id}>{a.admission_no} — {a.bed_code}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label>Task type</label>
          <select value={form.task_type} onChange={(e) => setForm({ ...form, task_type: e.target.value })}>
            <option value="vitals_check">Vitals check</option>
            <option value="medication_admin">Medication administration</option>
            <option value="wound_care">Wound care</option>
            <option value="handover">Shift handover</option>
          </select>
        </div>
        <div className="field">
          <label>Description</label>
          <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <ClinicalProfileFields type="nursing" values={careProfile} onChange={setCareProfile} />
        <button type="submit">Create task</button>
      </form>

      <div className="card table-wrap" style={{ marginTop: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>Task board</h3>
        <table>
          <thead><tr><th>Patient</th><th>Type</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id}>
                <td>{patientMap.get(t.patient_id) || "—"}</td>
                <td>{t.task_type}</td>
                <td><span className="badge">{t.status}</span></td>
                <td>
                  {NEXT[t.status] && (
                    <button type="button" className="secondary" onClick={() => advance(t).catch((e) => setError(e.message))}>
                      → {NEXT[t.status]}
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


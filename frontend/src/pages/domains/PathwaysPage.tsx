import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import ModuleFlowBar from "../../components/ModuleFlowBar";

const MODULE = "disease-and-care-pathways";

type PathwayRecord = {
  id: string;
  reference_no: string;
  submodule: string;
  title: string;
  status: string;
  payload: Record<string, unknown>;
  patient_id?: string;
};

const MILESTONE_STATUSES = ["draft", "scheduled", "in_progress", "completed"];

export default function PathwaysPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [records, setRecords] = useState<PathwayRecord[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [templateForm, setTemplateForm] = useState({ title: "", description: "", disease_code: "" });
  const [enrollForm, setEnrollForm] = useState({ patient_id: "", template_ref: "", title: "" });

  async function load() {
    const [p, rows] = await Promise.all([
      api<any[]>("/patients"),
      api<PathwayRecord[]>(`/modules/${MODULE}`),
    ]);
    setPatients(p);
    setRecords(rows);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  const templates = records.filter((r) => r.submodule === "Pathway template");
  const enrollments = records.filter((r) => r.submodule === "Enrollment");
  const milestones = records.filter((r) => r.submodule === "Milestone tracking");

  async function createTemplate(e: FormEvent) {
    e.preventDefault();
    await api(`/modules/${MODULE}`, {
      method: "POST",
      body: JSON.stringify({
        submodule: "Pathway template",
        title: templateForm.title,
        status: "approved",
        payload: { description: templateForm.description, disease_code: templateForm.disease_code },
      }),
    });
    setMsg("Pathway template created");
    setTemplateForm({ title: "", description: "", disease_code: "" });
    await load();
  }

  async function enrollPatient(e: FormEvent) {
    e.preventDefault();
    await api(`/modules/${MODULE}`, {
      method: "POST",
      body: JSON.stringify({
        submodule: "Enrollment",
        title: enrollForm.title,
        status: "scheduled",
        patient_id: enrollForm.patient_id,
        payload: { template_ref: enrollForm.template_ref },
      }),
    });
    setMsg("Patient enrolled in pathway");
    setEnrollForm({ patient_id: "", template_ref: "", title: "" });
    await load();
  }

  async function addMilestone(enrollment: PathwayRecord) {
    const title = `Milestone — ${enrollment.title}`;
    await api(`/modules/${MODULE}`, {
      method: "POST",
      body: JSON.stringify({
        submodule: "Milestone tracking",
        title,
        status: "draft",
        patient_id: enrollment.patient_id,
        payload: { enrollment_ref: enrollment.reference_no },
      }),
    });
    setMsg("Milestone added");
    await load();
  }

  async function advanceMilestone(record: PathwayRecord) {
    const idx = MILESTONE_STATUSES.indexOf(record.status);
    const next = MILESTONE_STATUSES[idx + 1];
    if (!next) return;
    await api(`/modules/${MODULE}/${record.id}/status?status=${next}`, { method: "PATCH" });
    setMsg(`Milestone → ${next}`);
    await load();
  }

  function patientLabel(id?: string) {
    if (!id) return "—";
    const p = patients.find((x) => x.id === id);
    return p ? `${p.first_name} ${p.last_name}` : id.slice(0, 8);
  }

  return (
    <div>
      <ModuleFlowBar moduleCode={MODULE} compact />
      <h1 className="page-title">Disease & care pathways</h1>
      <p className="muted">Pathway templates · patient enrollment · milestone advancement</p>
      <div className="actions" style={{ marginBottom: "1rem" }}>
        <Link to="/care-journey" className="secondary button-link">Care journey</Link>
        <Link to="/masters" className="secondary button-link">Disease masters</Link>
      </div>
      {error && <div className="error">{error}</div>}
      {msg && <div className="success">{msg}</div>}

      <div className="grid-2">
        <form className="card" onSubmit={(e) => createTemplate(e).catch((err) => setError(err.message))}>
          <h3 style={{ marginTop: 0 }}>Pathway template</h3>
          <div className="field">
            <label>Title</label>
            <input required value={templateForm.title} onChange={(e) => setTemplateForm({ ...templateForm, title: e.target.value })} placeholder="e.g. Diabetes care pathway" />
          </div>
          <div className="field">
            <label>Disease code</label>
            <input value={templateForm.disease_code} onChange={(e) => setTemplateForm({ ...templateForm, disease_code: e.target.value })} placeholder="ICD / master code" />
          </div>
          <div className="field">
            <label>Description</label>
            <textarea rows={2} value={templateForm.description} onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })} />
          </div>
          <button type="submit">Save template</button>
        </form>

        <form className="card" onSubmit={(e) => enrollPatient(e).catch((err) => setError(err.message))}>
          <h3 style={{ marginTop: 0 }}>Enroll patient</h3>
          <div className="field">
            <label>Patient</label>
            <select required value={enrollForm.patient_id} onChange={(e) => setEnrollForm({ ...enrollForm, patient_id: e.target.value })}>
              <option value="">Select</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Template</label>
            <select required value={enrollForm.template_ref} onChange={(e) => setEnrollForm({ ...enrollForm, template_ref: e.target.value })}>
              <option value="">Select</option>
              {templates.map((t) => (
                <option key={t.id} value={t.reference_no}>{t.title}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Enrollment title</label>
            <input required value={enrollForm.title} onChange={(e) => setEnrollForm({ ...enrollForm, title: e.target.value })} />
          </div>
          <button type="submit">Enroll</button>
        </form>
      </div>

      <div className="grid-2" style={{ marginTop: "1rem" }}>
        <div className="card table-wrap">
          <h3 style={{ marginTop: 0 }}>Templates ({templates.length})</h3>
          <table>
            <thead><tr><th>Ref</th><th>Title</th><th>Status</th></tr></thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id}><td>{t.reference_no}</td><td>{t.title}</td><td><span className="badge">{t.status}</span></td></tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card table-wrap">
          <h3 style={{ marginTop: 0 }}>Enrollments ({enrollments.length})</h3>
          <table>
            <thead><tr><th>Ref</th><th>Patient</th><th>Title</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {enrollments.map((e) => (
                <tr key={e.id}>
                  <td>{e.reference_no}</td>
                  <td>{patientLabel(e.patient_id)}</td>
                  <td>{e.title}</td>
                  <td><span className="badge">{e.status}</span></td>
                  <td>
                    <button type="button" className="secondary" onClick={() => addMilestone(e).catch((err) => setError(err.message))}>
                      Add milestone
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card table-wrap" style={{ marginTop: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>Milestones ({milestones.length})</h3>
        <table>
          <thead><tr><th>Ref</th><th>Patient</th><th>Title</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {milestones.map((m) => (
              <tr key={m.id}>
                <td>{m.reference_no}</td>
                <td>{patientLabel(m.patient_id)}</td>
                <td>{m.title}</td>
                <td><span className="badge">{m.status}</span></td>
                <td>
                  {MILESTONE_STATUSES.indexOf(m.status) < MILESTONE_STATUSES.length - 1 && (
                    <button type="button" className="secondary" onClick={() => advanceMilestone(m).catch((err) => setError(err.message))}>
                      Advance
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

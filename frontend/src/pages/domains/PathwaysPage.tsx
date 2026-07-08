import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import ModuleFlowBar from "../../components/ModuleFlowBar";

type Template = {
  id: string;
  code: string;
  name: string;
  disease_code: string;
  milestones: { code: string; name: string; order?: number }[];
  status: string;
};

type Enrollment = {
  id: string;
  patient_id: string;
  pathway_id: string;
  status: string;
  current_milestone: string | null;
  pathway?: { code: string; name: string; milestones: Template["milestones"] };
};

export default function PathwaysPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [diseases, setDiseases] = useState<any[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [tplForm, setTplForm] = useState({ code: "", name: "", disease_code: "" });
  const [enrollForm, setEnrollForm] = useState({ patient_id: "", pathway_id: "" });

  async function load() {
    const [p, d, t, e] = await Promise.all([
      api<any[]>("/patients"),
      api<any[]>("/masters/diseases"),
      api<Template[]>("/pathways/templates"),
      api<Enrollment[]>("/pathways/enrollments"),
    ]);
    setPatients(p);
    setDiseases(d);
    setTemplates(t);
    setEnrollments(e);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function createTemplate(e: FormEvent) {
    e.preventDefault();
    const disease = diseases.find((x) => x.code === tplForm.disease_code);
    await api("/pathways/templates", {
      method: "POST",
      body: JSON.stringify({
        code: tplForm.code,
        name: tplForm.name,
        disease_code: tplForm.disease_code,
        milestones: [
          { code: "M1", name: "Baseline assessment", order: 1 },
          { code: "M2", name: "Treatment phase", order: 2 },
          { code: "M3", name: "Outcome review", order: 3 },
        ],
      }),
    });
    setMsg(`Pathway template created for ${disease?.name || tplForm.disease_code}`);
    setTplForm({ code: "", name: "", disease_code: "" });
    await load();
  }

  async function enroll(e: FormEvent) {
    e.preventDefault();
    await api("/pathways/enrollments", {
      method: "POST",
      body: JSON.stringify({ patient_id: enrollForm.patient_id, pathway_id: enrollForm.pathway_id }),
    });
    setMsg("Patient enrolled in pathway");
    await load();
  }

  async function advance(id: string) {
    await api(`/pathways/enrollments/${id}/advance`, { method: "POST" });
    setMsg("Milestone advanced");
    await load();
  }

  return (
    <div>
      <ModuleFlowBar moduleCode="disease-and-care-pathways" compact />
      <h1 className="page-title">Disease & care pathways</h1>
      <p className="muted">Templates · enrollment · milestone tracking · outcome measures</p>
      <div className="actions" style={{ marginBottom: "1rem" }}>
        <Link to="/portal" className="secondary button-link">Patient follow-up portal</Link>
        <Link to="/chronic-care" className="secondary button-link">Chronic programs</Link>
      </div>
      {error && <div className="error">{error}</div>}
      {msg && <div className="success">{msg}</div>}

      <div className="grid-2">
        <form className="card" onSubmit={(e) => createTemplate(e).catch((err) => setError(err.message))}>
          <h3 style={{ marginTop: 0 }}>Pathway template</h3>
          <div className="field">
            <label>Code</label>
            <input required value={tplForm.code} onChange={(e) => setTplForm({ ...tplForm, code: e.target.value })} placeholder="DM2-CARE" />
          </div>
          <div className="field">
            <label>Name</label>
            <input required value={tplForm.name} onChange={(e) => setTplForm({ ...tplForm, name: e.target.value })} />
          </div>
          <div className="field">
            <label>Disease (master)</label>
            <select required value={tplForm.disease_code} onChange={(e) => setTplForm({ ...tplForm, disease_code: e.target.value })}>
              <option value="">Select</option>
              {diseases.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
            </select>
          </div>
          <button type="submit">Create template</button>
        </form>

        <form className="card" onSubmit={(e) => enroll(e).catch((err) => setError(err.message))}>
          <h3 style={{ marginTop: 0 }}>Enroll patient</h3>
          <div className="field">
            <label>Patient</label>
            <select required value={enrollForm.patient_id} onChange={(e) => setEnrollForm({ ...enrollForm, patient_id: e.target.value })}>
              <option value="">Select</option>
              {patients.map((p) => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Pathway</label>
            <select required value={enrollForm.pathway_id} onChange={(e) => setEnrollForm({ ...enrollForm, pathway_id: e.target.value })}>
              <option value="">Select</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <button type="submit">Enroll</button>
        </form>
      </div>

      <div className="card table-wrap" style={{ marginTop: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>Active enrollments</h3>
        <table>
          <thead><tr><th>Pathway</th><th>Patient</th><th>Milestone</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {enrollments.map((e) => (
              <tr key={e.id}>
                <td>{e.pathway?.name || e.pathway_id.slice(0, 8)}</td>
                <td>{patients.find((p) => p.id === e.patient_id)?.first_name || e.patient_id.slice(0, 8)}</td>
                <td>{e.current_milestone || "—"}</td>
                <td><span className="badge">{e.status}</span></td>
                <td>
                  {e.status === "active" && (
                    <button type="button" className="secondary" onClick={() => advance(e.id).catch((err) => setError(err.message))}>
                      Advance milestone
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

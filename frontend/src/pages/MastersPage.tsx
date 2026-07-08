import { FormEvent, useEffect, useState } from "react";
import { api } from "../api/client";

const RESOURCES = [
  "countries",
  "genders",
  "specialties",
  "diseases",
  "medicines",
  "lab-tests",
  "tariffs",
  "clinical-templates",
  "notification-templates",
  "consent-templates",
  "video-providers",
  "location-purposes",
  "insurance-payers",
  "room-categories",
  "beds",
];

const CREATABLE = new Set(["tariffs", "medicines", "lab-tests"]);

type CreateForm = {
  code: string;
  name: string;
  amount: string;
  category: string;
  form: string;
  strength: string;
  sample_type: string;
};

const EMPTY_FORM: CreateForm = {
  code: "",
  name: "",
  amount: "",
  category: "service",
  form: "",
  strength: "",
  sample_type: "",
};

export default function MastersPage() {
  const [resource, setResource] = useState("specialties");
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_FORM);
  const [showCreate, setShowCreate] = useState(false);

  async function loadRows(res: string) {
    const data = await api<any[]>(`/masters/${res}`);
    setRows(data);
  }

  useEffect(() => {
    setShowCreate(false);
    setCreateForm(EMPTY_FORM);
    loadRows(resource).catch((e) => setError(e.message));
  }, [resource]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError("");
    const extra: Record<string, string | number> = {};
    if (resource === "tariffs") {
      extra.category = createForm.category;
      extra.amount = Number(createForm.amount) || 0;
    }
    if (resource === "medicines") {
      extra.form = createForm.form;
      extra.strength = createForm.strength;
    }
    if (resource === "lab-tests") {
      extra.sample_type = createForm.sample_type;
    }
    await api(`/masters/${resource}`, {
      method: "POST",
      body: JSON.stringify({ code: createForm.code, name: createForm.name, extra }),
    });
    setMsg(`${resource} master created`);
    setCreateForm(EMPTY_FORM);
    setShowCreate(false);
    await loadRows(resource);
  }

  return (
    <div>
      <h1 className="page-title">Configuration masters</h1>
      <p className="muted">No hard-coded business dropdowns — values load from PostgreSQL.</p>
      {error && <div className="error">{error}</div>}
      {msg && <div className="success">{msg}</div>}
      <div className="card">
        <div className="field">
          <label>Master resource</label>
          <select value={resource} onChange={(e) => setResource(e.target.value)}>
            {RESOURCES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        {CREATABLE.has(resource) && (
          <div style={{ marginBottom: "1rem" }}>
            {!showCreate ? (
              <button type="button" onClick={() => setShowCreate(true)}>Add {resource}</button>
            ) : (
              <form onSubmit={(e) => onCreate(e).catch((err) => setError(err.message))} className="card" style={{ marginTop: "0.5rem" }}>
                <h3 style={{ marginTop: 0 }}>Create {resource}</h3>
                <div className="grid-2">
                  <div className="field">
                    <label>Code</label>
                    <input required value={createForm.code} onChange={(e) => setCreateForm({ ...createForm, code: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>Name</label>
                    <input required value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} />
                  </div>
                </div>
                {resource === "tariffs" && (
                  <div className="grid-2">
                    <div className="field">
                      <label>Category</label>
                      <select value={createForm.category} onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}>
                        <option value="service">service</option>
                        <option value="consultation">consultation</option>
                        <option value="lab">lab</option>
                        <option value="inpatient">inpatient</option>
                        <option value="imaging">imaging</option>
                      </select>
                    </div>
                    <div className="field">
                      <label>Amount (₹)</label>
                      <input type="number" min="0" required value={createForm.amount} onChange={(e) => setCreateForm({ ...createForm, amount: e.target.value })} />
                    </div>
                  </div>
                )}
                {resource === "medicines" && (
                  <div className="grid-2">
                    <div className="field">
                      <label>Form</label>
                      <input value={createForm.form} onChange={(e) => setCreateForm({ ...createForm, form: e.target.value })} placeholder="Tablet" />
                    </div>
                    <div className="field">
                      <label>Strength</label>
                      <input value={createForm.strength} onChange={(e) => setCreateForm({ ...createForm, strength: e.target.value })} placeholder="500mg" />
                    </div>
                  </div>
                )}
                {resource === "lab-tests" && (
                  <div className="field">
                    <label>Sample type</label>
                    <input value={createForm.sample_type} onChange={(e) => setCreateForm({ ...createForm, sample_type: e.target.value })} placeholder="Blood" />
                  </div>
                )}
                <div className="actions">
                  <button type="submit">Save</button>
                  <button type="button" className="secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                </div>
              </form>
            )}
          </div>
        )}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Status</th>
                <th>Extra</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id || r.code}>
                  <td>{r.code}</td>
                  <td>{r.name || r.label}</td>
                  <td>{r.status}</td>
                  <td>
                    {r.amount != null && `₹${r.amount}`}
                    {r.icd_code && `ICD ${r.icd_code}`}
                    {r.form && `${r.form} ${r.strength || ""}`}
                    {r.sample_type && `Sample: ${r.sample_type}`}
                    {r.permission && r.permission}
                    {r.capabilities && JSON.stringify(r.capabilities)}
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

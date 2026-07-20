import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import DataTable from "../components/DataTable";
import { useAuth } from "../context/AuthContext";
import { canWrite } from "../hooks/usePermissions";
import { downloadCsv, downloadJson, rowsToCsv } from "../utils/export";

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

const CREATABLE = new Set(["tariffs", "medicines", "lab-tests", "room-categories", "insurance-payers", "diseases", "notification-templates"]);

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
  const { session } = useAuth();
  const write = canWrite(session, "masters");
  const [resource, setResource] = useState("specialties");
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_FORM);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [catalog, setCatalog] = useState<any[]>([]);

  useEffect(() => {
    api<{ items: any[] }>("/admin/master-data-catalog").then((x) => setCatalog(x.items)).catch(() => setCatalog([]));
  }, []);

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

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      String(r.code || "").toLowerCase().includes(q) ||
      String(r.name || r.label || "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  const paged = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page, pageSize]);

  const columns = useMemo(() => [
    { key: "code", label: "Code" },
    { key: "name", label: "Name", render: (r: any) => r.name || r.label },
    { key: "status", label: "Status" },
    {
      key: "extra",
      label: "Extra",
      render: (r: any) => (
        <>
          {r.amount != null && `₹${r.amount} `}
          {r.icd_code && `ICD ${r.icd_code} `}
          {r.form && `${r.form} ${r.strength || ""} `}
          {r.sample_type && `Sample: ${r.sample_type} `}
          {r.permission && r.permission}
        </>
      ),
    },
  ], []);

  return (
    <div>
      <h1 className="page-title">Configuration masters</h1>
      <p className="muted">Governed source records, relationships and downstream use—not disconnected text values.</p>
      {error && <div className="error">{error}</div>}
      {msg && <div className="success">{msg}</div>}
      <div className="card table-wrap" style={{ marginBottom: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>Master-data governance map</h3>
        <p className="muted">Use free text only for clinical narrative and notes. Identifiers, classifications, people, services and physical locations must come from masters.</p>
        <table><thead><tr><th>Domain</th><th>Master</th><th>Depends on</th><th>Used by</th></tr></thead>
          <tbody>{catalog.map((x, i) => <tr key={`${x.domain}-${x.master}-${i}`}><td>{x.domain}</td><td><strong>{x.master}</strong></td><td>{x.depends_on}</td><td>{x.used_by}</td></tr>)}</tbody>
        </table>
      </div>
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

        {CREATABLE.has(resource) && write && (
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
                        <option value="procedure">procedure</option>
                        <option value="surgery">surgery</option>
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

        <DataTable
          title={`${resource} (${filtered.length})`}
          columns={columns}
          rows={paged}
          rowKey={(r) => r.id || r.code}
          total={filtered.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
          search={search}
          onSearchChange={(q) => { setSearch(q); setPage(1); }}
          searchPlaceholder="Search code or name…"
          onExportJson={() => downloadJson(filtered, `${resource}.json`)}
          onExportCsv={() => downloadCsv(rowsToCsv(filtered), `${resource}.csv`)}
        />
      </div>
    </div>
  );
}

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";

type RecordRow = {
  id: string;
  reference_no: string;
  title: string;
  status: string;
  payload: Record<string, unknown>;
};

type AreaMeta = { code: string; name: string; resources: string[] };

export default function ExpandedAreaPage() {
  const { areaCode = "" } = useParams();
  const [area, setArea] = useState<AreaMeta | null>(null);
  const [resource, setResource] = useState("");
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  async function load(res: string) {
    const data = await api<RecordRow[]>(`/${areaCode}/${res}`);
    setRows(data);
  }

  useEffect(() => {
    api<{ areas: AreaMeta[] }>("/platform/expanded-api")
      .then((r) => {
        const found = r.areas.find((a) => a.code === areaCode);
        if (!found) throw new Error("Area not found");
        setArea(found);
        const first = found.resources[0];
        setResource(first);
        return load(first);
      })
      .catch((e) => setError(e.message));
  }, [areaCode]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!resource) return;
    await api(`/${areaCode}/${resource}`, {
      method: "POST",
      body: JSON.stringify({ title, status: "draft", payload: {} }),
    });
    setTitle("");
    setMsg("Record created");
    await load(resource);
  }

  if (!area) return <div className="card">Loading...</div>;

  return (
    <div>
      <h1 className="page-title">{area.name}</h1>
      <p className="muted">Expanded API · /api/v1/{areaCode}/{"{resource}"}</p>
      {error && <div className="error">{error}</div>}
      {msg && <div className="success">{msg}</div>}
      <div className="field" style={{ maxWidth: 360 }}>
        <label>Sub-resource</label>
        <select
          value={resource}
          onChange={(e) => {
            setResource(e.target.value);
            load(e.target.value).catch((err) => setError(err.message));
          }}
        >
          {area.resources.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>
      <form className="card" onSubmit={(e) => onCreate(e).catch((err) => setError(err.message))}>
        <h3>Create record</h3>
        <div className="field">
          <label>Title</label>
          <input required value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <button type="submit">Create</button>
      </form>
      <div className="card" style={{ marginTop: "1rem" }}>
        <h3>Records</h3>
        <table className="data-table">
          <thead>
            <tr><th>Ref</th><th>Title</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.reference_no}</td>
                <td>{r.title}</td>
                <td>{r.status}</td>
                <td>
                  {r.status !== "approved" && (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => api(`/${areaCode}/${resource}/${r.id}/approve`, { method: "POST" }).then(() => load(resource))}
                    >
                      Approve
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

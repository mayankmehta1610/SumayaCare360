import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import ModuleFlowBar from "../components/ModuleFlowBar";

export default function AdministrationPage() {
  const [branches, setBranches] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [beds, setBeds] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [branchForm, setBranchForm] = useState({ code: "", name: "", city: "" });
  const [deptForm, setDeptForm] = useState({ code: "", name: "" });

  async function load() {
    const [b, d, u, bd, r] = await Promise.all([
      api<any[]>("/admin/branches"),
      api<any[]>("/admin/departments"),
      api<any[]>("/admin/users"),
      api<any[]>("/admin/beds"),
      api<any[]>("/admin/room-categories"),
    ]);
    setBranches(b);
    setDepartments(d);
    setUsers(u);
    setBeds(bd);
    setRooms(r);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function addBranch(e: FormEvent) {
    e.preventDefault();
    await api("/admin/branches", { method: "POST", body: JSON.stringify(branchForm) });
    setMsg("Branch created");
    setBranchForm({ code: "", name: "", city: "" });
    await load();
  }

  async function addDept(e: FormEvent) {
    e.preventDefault();
    await api("/admin/departments", { method: "POST", body: JSON.stringify(deptForm) });
    setMsg("Department created");
    setDeptForm({ code: "", name: "" });
    await load();
  }

  return (
    <div>
      <ModuleFlowBar moduleCode="hospital-clinic-administration" compact />
      <h1 className="page-title">Hospital / Clinic Administration</h1>
      <div className="actions" style={{ marginBottom: "1rem" }}>
        <Link to="/rooms-facilities" className="secondary button-link">Rooms & facilities</Link>
        <Link to="/identity-security" className="secondary button-link">Users & RBAC</Link>
        <Link to="/masters" className="secondary button-link">Masters</Link>
      </div>
      {error && <div className="error">{error}</div>}
      {msg && <div className="success">{msg}</div>}
      <div className="kpi-grid">
        <div className="kpi"><div className="value">{branches.length}</div><div className="label">Branches</div></div>
        <div className="kpi"><div className="value">{departments.length}</div><div className="label">Departments</div></div>
        <div className="kpi"><div className="value">{users.length}</div><div className="label">Users</div></div>
        <div className="kpi"><div className="value">{beds.filter((b) => b.status === "available").length}</div><div className="label">Beds available</div></div>
      </div>
      <div className="grid-2">
        <form className="card" onSubmit={(e) => addBranch(e).catch((err) => setError(err.message))}>
          <h3 style={{ marginTop: 0 }}>Add branch</h3>
          <div className="field"><label>Code</label><input required value={branchForm.code} onChange={(e) => setBranchForm({ ...branchForm, code: e.target.value })} /></div>
          <div className="field"><label>Name</label><input required value={branchForm.name} onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })} /></div>
          <div className="field"><label>City</label><input value={branchForm.city} onChange={(e) => setBranchForm({ ...branchForm, city: e.target.value })} /></div>
          <button type="submit">Save branch</button>
        </form>
        <form className="card" onSubmit={(e) => addDept(e).catch((err) => setError(err.message))}>
          <h3 style={{ marginTop: 0 }}>Add department</h3>
          <div className="field"><label>Code</label><input required value={deptForm.code} onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })} /></div>
          <div className="field"><label>Name</label><input required value={deptForm.name} onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })} /></div>
          <button type="submit">Save department</button>
        </form>
      </div>
      <div className="grid-2" style={{ marginTop: "1rem" }}>
        <div className="card table-wrap">
          <h3 style={{ marginTop: 0 }}>Branches</h3>
          <table><thead><tr><th>Code</th><th>Name</th><th>City</th></tr></thead>
            <tbody>{branches.map((b) => <tr key={b.id}><td>{b.code}</td><td>{b.name}</td><td>{b.city}</td></tr>)}</tbody></table>
        </div>
        <div className="card table-wrap">
          <h3 style={{ marginTop: 0 }}>Departments</h3>
          <table><thead><tr><th>Code</th><th>Name</th></tr></thead>
            <tbody>{departments.map((d) => <tr key={d.id}><td>{d.code}</td><td>{d.name}</td></tr>)}</tbody></table>
        </div>
      </div>
    </div>
  );
}

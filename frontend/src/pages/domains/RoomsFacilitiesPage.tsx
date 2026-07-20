import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import ModuleFlowBar from "../../components/ModuleFlowBar";
import { RoomsHousekeepingDesk } from "./DomainDesks";

const TYPES = ["building", "wing", "floor", "ward", "room"];
const PARENT: Record<string, string | null> = { building: null, wing: "building", floor: "wing", ward: "floor", room: "ward" };
const BED_STATUSES = ["available", "reserved", "maintenance", "housekeeping", "blocked"];
type Location = { id: string; branch_id: string; location_type: string; code: string; name: string; status: string; operational_status: string; path_label: string };

export default function RoomsFacilitiesPage() {
  const [beds, setBeds] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [tab, setTab] = useState("hierarchy");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loc, setLoc] = useState({ branch_id: "", location_type: "building", parent_id: "", department_id: "", room_category_id: "", service_type: "patient_room", code: "", name: "" });
  const [bed, setBed] = useState({ bed_code: "", room_id: "", room_category_id: "", isolation_flag: false });
  const [category, setCategory] = useState({ code: "", name: "", tariff_class: "standard" });

  async function load() {
    const [bs, cs, ls, br, ds] = await Promise.all([
      api<any[]>("/admin/beds"), api<any[]>("/admin/room-categories"),
      api<Location[]>("/admin/facility-locations"), api<any[]>("/admin/branches"), api<any[]>("/admin/departments"),
    ]);
    setBeds(bs); setCategories(cs); setLocations(ls); setBranches(br); setDepartments(ds);
    setLoc((x) => ({ ...x, branch_id: x.branch_id || br[0]?.id || "" }));
  }
  useEffect(() => { load().catch((e) => setError(e.message)); }, []);

  const parentType = PARENT[loc.location_type];
  const parents = useMemo(() => locations.filter((x) => x.branch_id === loc.branch_id && x.location_type === parentType && x.status === "active"), [locations, loc.branch_id, parentType]);
  const rooms = locations.filter((x) => x.location_type === "room" && x.status === "active" && x.operational_status === "operational");

  async function addLocation(e: FormEvent) {
    e.preventDefault(); setError("");
    await api("/admin/facility-locations", { method: "POST", body: JSON.stringify({ ...loc, parent_id: loc.parent_id || null, department_id: loc.department_id || null, room_category_id: loc.location_type === "room" ? loc.room_category_id || null : null, attributes: loc.location_type === "room" ? { service_type: loc.service_type } : {} }) });
    setMsg(`${loc.location_type} linked to the facility hierarchy`); setLoc((x) => ({ ...x, parent_id: "", code: "", name: "", department_id: "", room_category_id: "", service_type: "patient_room" })); await load();
  }
  async function addBed(e: FormEvent) {
    e.preventDefault(); setError("");
    await api("/admin/beds", { method: "POST", body: JSON.stringify({ ...bed, room_category_id: bed.room_category_id || null }) });
    setMsg("Bed linked to room master"); setBed({ bed_code: "", room_id: "", room_category_id: "", isolation_flag: false }); await load();
  }
  async function addCategory(e: FormEvent) {
    e.preventDefault(); setError("");
    await api("/masters/room-categories", { method: "POST", body: JSON.stringify({ code: category.code, name: category.name, extra: { tariff_class: category.tariff_class } }) });
    setMsg("Room category master created"); setCategory({ code: "", name: "", tariff_class: "standard" }); await load();
  }
  async function bedStatus(id: string, status: string) { await api(`/admin/beds/${id}?status=${status}`, { method: "PATCH" }); setMsg(`Bed status: ${status}`); await load(); }

  return <div>
    <ModuleFlowBar moduleCode="rooms-and-facilities" compact />
    <h1 className="page-title">Facility, room & bed masters</h1>
    <p className="muted">Campus → building → wing → floor → ward → room → bed. Every level is linked and validated.</p>
    <div className="actions" style={{ marginBottom: "1rem" }}><Link to="/administration" className="secondary button-link">Administration</Link><Link to="/inpatient" className="secondary button-link">IPD admissions</Link><Link to="/masters" className="secondary button-link">Master governance</Link></div>
    {error && <div className="error">{error}</div>}{msg && <div className="success">{msg}</div>}
    <div className="tabs" style={{ marginBottom: "1rem" }}>{[["hierarchy", "Location hierarchy"], ["beds", "Bed map"], ["categories", "Room categories"], ["housekeeping", "Housekeeping"]].map(([key, label]) => <button key={key} type="button" className={tab === key ? "" : "secondary"} onClick={() => setTab(key)}>{label}</button>)}</div>

    {tab === "hierarchy" && <>
      <form className="card" onSubmit={(e) => addLocation(e).catch((x) => setError(x.message))}>
        <h3 style={{ marginTop: 0 }}>Add a linked facility location</h3>
        <div className="grid-2"><Field label="Branch / campus *"><select required value={loc.branch_id} onChange={(e) => setLoc({ ...loc, branch_id: e.target.value, parent_id: "" })}><option value="">Select</option>{branches.map((x) => <option key={x.id} value={x.id}>{x.code} · {x.name}</option>)}</select></Field><Field label="Location type *"><select value={loc.location_type} onChange={(e) => setLoc({ ...loc, location_type: e.target.value, parent_id: "", room_category_id: "" })}>{TYPES.map((x) => <option key={x}>{x}</option>)}</select></Field></div>
        {parentType && <Field label={`Parent ${parentType} *`}><select required value={loc.parent_id} onChange={(e) => setLoc({ ...loc, parent_id: e.target.value })}><option value="">Select governed parent</option>{parents.map((x) => <option key={x.id} value={x.id}>{x.path_label}</option>)}</select>{parents.length === 0 && <small className="muted">Create the required {parentType} first.</small>}</Field>}
        <div className="grid-2"><Field label="Code *"><input required value={loc.code} onChange={(e) => setLoc({ ...loc, code: e.target.value })} /></Field><Field label="Name *"><input required value={loc.name} onChange={(e) => setLoc({ ...loc, name: e.target.value })} /></Field></div>
        {["ward", "room"].includes(loc.location_type) && <Field label="Department"><select value={loc.department_id} onChange={(e) => setLoc({ ...loc, department_id: e.target.value })}><option value="">Not assigned</option>{departments.map((x) => <option key={x.id} value={x.id}>{x.code} · {x.name}</option>)}</select></Field>}
        {loc.location_type === "room" && <Field label="Room category *"><select required value={loc.room_category_id} onChange={(e) => setLoc({ ...loc, room_category_id: e.target.value })}><option value="">Select master</option>{categories.map((x) => <option key={x.id} value={x.id}>{x.code} · {x.name}</option>)}</select></Field>}
        {loc.location_type === "room" && <Field label="Room use *"><select required value={loc.service_type} onChange={(e) => setLoc({ ...loc, service_type: e.target.value })}><option value="patient_room">Patient room</option><option value="consultation">Consultation</option><option value="operation_theatre">Operation theatre</option><option value="lab_collection">Lab collection</option><option value="radiology">Radiology</option><option value="emergency">Emergency</option></select></Field>}
        <button type="submit">Save linked location</button>
      </form>
      <Register rows={locations} />
    </>}

    {tab === "beds" && <>
      <form className="card" onSubmit={(e) => addBed(e).catch((x) => setError(x.message))}><h3 style={{ marginTop: 0 }}>Add bed to a room</h3><div className="grid-2"><Field label="Room *"><select required value={bed.room_id} onChange={(e) => setBed({ ...bed, room_id: e.target.value })}><option value="">Select room from hierarchy</option>{rooms.map((x) => <option key={x.id} value={x.id}>{x.path_label}</option>)}</select></Field><Field label="Bed code *"><input required value={bed.bed_code} onChange={(e) => setBed({ ...bed, bed_code: e.target.value })} /></Field></div><Field label="Category override"><select value={bed.room_category_id} onChange={(e) => setBed({ ...bed, room_category_id: e.target.value })}><option value="">Use room category</option>{categories.map((x) => <option key={x.id} value={x.id}>{x.code} · {x.name}</option>)}</select></Field><label><input type="checkbox" checked={bed.isolation_flag} onChange={(e) => setBed({ ...bed, isolation_flag: e.target.checked })} /> Isolation-capable</label><div style={{ marginTop: "1rem" }}><button type="submit">Save bed master</button></div></form>
      <div className="card table-wrap" style={{ marginTop: "1rem" }}><table><thead><tr><th>Bed</th><th>Full location</th><th>Category</th><th>Status</th><th>Actions</th></tr></thead><tbody>{beds.map((x) => <tr key={x.id}><td>{x.bed_code}</td><td>{x.location_label || x.room_code}</td><td>{x.category_code}</td><td><span className="badge">{x.status}</span></td><td className="actions">{x.status !== "occupied" && BED_STATUSES.filter((s) => s !== x.status).map((s) => <button key={s} type="button" className="secondary" onClick={() => bedStatus(x.id, s).catch((e) => setError(e.message))}>→ {s}</button>)}</td></tr>)}</tbody></table></div>
    </>}

    {tab === "categories" && <><form className="card" onSubmit={(e) => addCategory(e).catch((x) => setError(x.message))}><h3 style={{ marginTop: 0 }}>Add room category master</h3><div className="grid-2"><Field label="Code *"><input required value={category.code} onChange={(e) => setCategory({ ...category, code: e.target.value })} /></Field><Field label="Name *"><input required value={category.name} onChange={(e) => setCategory({ ...category, name: e.target.value })} /></Field></div><Field label="Tariff class *"><select value={category.tariff_class} onChange={(e) => setCategory({ ...category, tariff_class: e.target.value })}><option value="standard">Standard</option><option value="premium">Premium</option><option value="critical">Critical care</option><option value="daycare">Day care</option></select></Field><button type="submit">Save category</button></form><div className="card table-wrap" style={{ marginTop: "1rem" }}><table><thead><tr><th>Code</th><th>Name</th><th>Tariff class</th><th>Status</th></tr></thead><tbody>{categories.map((x) => <tr key={x.id}><td>{x.code}</td><td>{x.name}</td><td>{x.tariff_class}</td><td>{x.status}</td></tr>)}</tbody></table></div></>}
    {tab === "housekeeping" && <RoomsHousekeepingDesk />}
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="field"><label>{label}</label>{children}</div>; }
function Register({ rows }: { rows: Location[] }) { return <div className="card table-wrap" style={{ marginTop: "1rem" }}><h3 style={{ marginTop: 0 }}>Governed location register</h3><table><thead><tr><th>Type</th><th>Code</th><th>Full hierarchy</th><th>Status</th></tr></thead><tbody>{rows.map((x) => <tr key={x.id}><td><span className="badge">{x.location_type}</span></td><td>{x.code}</td><td>{x.path_label}</td><td>{x.operational_status}</td></tr>)}</tbody></table></div>; }

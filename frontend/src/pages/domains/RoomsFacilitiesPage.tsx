import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import ModuleFlowBar from "../../components/ModuleFlowBar";
import { RoomsHousekeepingDesk } from "./DomainDesks";

const BED_STATUSES = ["available", "occupied", "maintenance", "housekeeping"];

export default function RoomsFacilitiesPage() {
  const [beds, setBeds] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState<"beds" | "categories" | "housekeeping">("beds");
  const [roomForm, setRoomForm] = useState({ code: "", name: "", tariff_class: "standard" });
  const [bedForm, setBedForm] = useState({ code: "", room_code: "R101", category_code: "GEN" });

  async function load() {
    const [b, r] = await Promise.all([
      api<any[]>("/admin/beds"),
      api<any[]>("/admin/room-categories"),
    ]);
    setBeds(b);
    setRooms(r);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function setBedStatus(id: string, status: string) {
    await api(`/admin/beds/${id}?status=${status}`, { method: "PATCH" });
    setMsg(`Bed → ${status}`);
    await load();
  }

  async function addRoom(e: FormEvent) {
    e.preventDefault();
    await api("/masters/room-categories", {
      method: "POST",
      body: JSON.stringify({ code: roomForm.code, name: roomForm.name, extra: { tariff_class: roomForm.tariff_class } }),
    });
    setMsg("Room category created");
    await load();
  }

  async function addBed(e: FormEvent) {
    e.preventDefault();
    await api("/masters/beds", {
      method: "POST",
      body: JSON.stringify({
        code: bedForm.code,
        name: bedForm.code,
        extra: { room_code: bedForm.room_code, category_code: bedForm.category_code, status: "available" },
      }),
    });
    setMsg("Bed created");
    await load();
  }

  return (
    <div>
      <ModuleFlowBar moduleCode="rooms-and-facilities" compact />
      <h1 className="page-title">Rooms & facilities</h1>
      <p className="muted">Manage beds · room categories · housekeeping workflows</p>
      <div className="actions" style={{ marginBottom: "1rem" }}>
        <Link to="/administration" className="secondary button-link">Administration</Link>
        <Link to="/inpatient" className="secondary button-link">IPD admissions</Link>
      </div>
      {error && <div className="error">{error}</div>}
      {msg && <div className="success">{msg}</div>}
      <div className="tabs" style={{ marginBottom: "1rem" }}>
        <button type="button" className={tab === "beds" ? "" : "secondary"} onClick={() => setTab("beds")}>Bed map</button>
        <button type="button" className={tab === "categories" ? "" : "secondary"} onClick={() => setTab("categories")}>Room categories</button>
        <button type="button" className={tab === "housekeeping" ? "" : "secondary"} onClick={() => setTab("housekeeping")}>Housekeeping</button>
      </div>
      {tab === "beds" && (
        <>
          <form className="card" onSubmit={(e) => addBed(e).catch((err) => setError(err.message))}>
            <h3 style={{ marginTop: 0 }}>Add bed</h3>
            <div className="grid-2">
              <div className="field"><label>Bed code</label><input required value={bedForm.code} onChange={(e) => setBedForm({ ...bedForm, code: e.target.value })} /></div>
              <div className="field"><label>Room</label><input value={bedForm.room_code} onChange={(e) => setBedForm({ ...bedForm, room_code: e.target.value })} /></div>
            </div>
            <button type="submit">Add bed</button>
          </form>
          <div className="card table-wrap" style={{ marginTop: "1rem" }}>
            <table>
              <thead><tr><th>Bed</th><th>Room</th><th>Category</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {beds.map((b) => (
                  <tr key={b.id}>
                    <td>{b.bed_code}</td><td>{b.room_code}</td><td>{b.category_code}</td>
                    <td><span className="badge">{b.status}</span></td>
                    <td className="actions">
                      {BED_STATUSES.filter((s) => s !== b.status).map((s) => (
                        <button key={s} type="button" className="secondary" onClick={() => setBedStatus(b.id, s).catch((e) => setError(e.message))}>→ {s}</button>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {tab === "categories" && (
        <>
          <form className="card" onSubmit={(e) => addRoom(e).catch((err) => setError(err.message))}>
            <h3 style={{ marginTop: 0 }}>Add room category</h3>
            <div className="grid-2">
              <div className="field"><label>Code</label><input required value={roomForm.code} onChange={(e) => setRoomForm({ ...roomForm, code: e.target.value })} /></div>
              <div className="field"><label>Name</label><input required value={roomForm.name} onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })} /></div>
            </div>
            <button type="submit">Save category</button>
          </form>
          <div className="card table-wrap" style={{ marginTop: "1rem" }}>
            <table>
              <thead><tr><th>Code</th><th>Name</th><th>Tariff class</th><th>Status</th></tr></thead>
              <tbody>
                {rooms.map((r) => (
                  <tr key={r.id}><td>{r.code}</td><td>{r.name}</td><td>{r.tariff_class}</td><td>{r.status}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {tab === "housekeeping" && <RoomsHousekeepingDesk />}
    </div>
  );
}

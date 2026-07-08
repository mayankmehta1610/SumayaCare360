import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import ModuleFlowBar from "../../components/ModuleFlowBar";
import { RoomsHousekeepingDesk } from "./DomainDesks";

export default function RoomsFacilitiesPage() {
  const [beds, setBeds] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"beds" | "categories" | "housekeeping">("beds");

  useEffect(() => {
    Promise.all([
      api<any[]>("/admin/beds"),
      api<any[]>("/admin/room-categories"),
    ])
      .then(([b, r]) => { setBeds(b); setRooms(r); })
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <ModuleFlowBar moduleCode="rooms-and-facilities" compact />
      <h1 className="page-title">Rooms & facilities</h1>
      <p className="muted">Bed map · room categories · housekeeping lifecycle</p>
      <div className="actions" style={{ marginBottom: "1rem" }}>
        <Link to="/administration" className="secondary button-link">Administration</Link>
        <Link to="/inpatient" className="secondary button-link">IPD admissions</Link>
      </div>
      {error && <div className="error">{error}</div>}
      <div className="tabs" style={{ marginBottom: "1rem" }}>
        <button type="button" className={tab === "beds" ? "" : "secondary"} onClick={() => setTab("beds")}>Bed map</button>
        <button type="button" className={tab === "categories" ? "" : "secondary"} onClick={() => setTab("categories")}>Room categories</button>
        <button type="button" className={tab === "housekeeping" ? "" : "secondary"} onClick={() => setTab("housekeeping")}>Housekeeping</button>
      </div>
      {tab === "beds" && (
        <div className="card table-wrap">
          <table>
            <thead><tr><th>Bed</th><th>Room</th><th>Category</th><th>Status</th></tr></thead>
            <tbody>
              {beds.map((b) => (
                <tr key={b.id}><td>{b.bed_code}</td><td>{b.room_code}</td><td>{b.category_code}</td><td><span className="badge">{b.status}</span></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {tab === "categories" && (
        <div className="card table-wrap">
          <table>
            <thead><tr><th>Code</th><th>Name</th><th>Tariff class</th><th>Status</th></tr></thead>
            <tbody>
              {rooms.map((r) => (
                <tr key={r.id}><td>{r.code}</td><td>{r.name}</td><td>{r.tariff_class}</td><td>{r.status}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {tab === "housekeeping" && <RoomsHousekeepingDesk />}
    </div>
  );
}

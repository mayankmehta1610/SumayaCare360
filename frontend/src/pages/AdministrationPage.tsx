import { useEffect, useState } from "react";
import { api } from "../api/client";

export default function AdministrationPage() {
  const [branches, setBranches] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [beds, setBeds] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api<any[]>("/admin/branches"),
      api<any[]>("/admin/users"),
      api<any[]>("/admin/beds"),
      api<any[]>("/admin/room-categories"),
    ])
      .then(([b, u, bd, r]) => {
        setBranches(b);
        setUsers(u);
        setBeds(bd);
        setRooms(r);
      })
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <h1 className="page-title">Hospital / Clinic Administration</h1>
      {error && <div className="error">{error}</div>}
      <div className="kpi-grid">
        <div className="kpi"><div className="value">{branches.length}</div><div className="label">Branches</div></div>
        <div className="kpi"><div className="value">{users.length}</div><div className="label">Users</div></div>
        <div className="kpi"><div className="value">{beds.filter((b) => b.status === "available").length}</div><div className="label">Beds available</div></div>
        <div className="kpi"><div className="value">{rooms.length}</div><div className="label">Room categories</div></div>
      </div>
      <div className="grid-2">
        <div className="card table-wrap">
          <h3 style={{ marginTop: 0 }}>Branches</h3>
          <table><thead><tr><th>Code</th><th>Name</th><th>City</th></tr></thead>
            <tbody>{branches.map((b) => <tr key={b.id}><td>{b.code}</td><td>{b.name}</td><td>{b.city}</td></tr>)}</tbody></table>
        </div>
        <div className="card table-wrap">
          <h3 style={{ marginTop: 0 }}>Users & RBAC</h3>
          <table><thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead>
            <tbody>{users.map((u) => <tr key={u.id}><td>{u.full_name}</td><td>{u.email}</td><td>{u.role_code}</td></tr>)}</tbody></table>
        </div>
        <div className="card table-wrap">
          <h3 style={{ marginTop: 0 }}>Bed map</h3>
          <table><thead><tr><th>Bed</th><th>Room</th><th>Status</th></tr></thead>
            <tbody>{beds.map((b) => <tr key={b.id}><td>{b.bed_code}</td><td>{b.room_code}</td><td>{b.status}</td></tr>)}</tbody></table>
        </div>
        <div className="card table-wrap">
          <h3 style={{ marginTop: 0 }}>Room categories</h3>
          <table><thead><tr><th>Code</th><th>Name</th><th>Tariff class</th></tr></thead>
            <tbody>{rooms.map((r) => <tr key={r.id}><td>{r.code}</td><td>{r.name}</td><td>{r.tariff_class}</td></tr>)}</tbody></table>
        </div>
      </div>
    </div>
  );
}

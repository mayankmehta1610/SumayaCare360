import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const links = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/patients", label: "Patients" },
  { to: "/providers", label: "Providers" },
  { to: "/appointments", label: "Appointments" },
  { to: "/encounters", label: "OPD / Encounters" },
  { to: "/telemedicine", label: "Telemedicine" },
  { to: "/billing", label: "Billing" },
  { to: "/masters", label: "Masters" },
  { to: "/audit", label: "Audit" },
  { to: "/tenants", label: "Tenants", superOnly: true },
];

export default function AppLayout() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">SUMAYA Care 360</div>
        <div className="brand-sub">
          {session?.tenant_code ? `/${session.tenant_code}` : "Super Admin"} · {session?.role_code}
        </div>
        <nav className="nav">
          {links
            .filter((l) => !l.superOnly || session?.role_code === "SUPER_ADMIN")
            .map((l) => (
              <NavLink key={l.to} to={l.to} className={({ isActive }) => (isActive ? "active" : "")}>
                {l.label}
              </NavLink>
            ))}
        </nav>
      </aside>
      <main className="main">
        <div className="topbar">
          <div>
            <div className="muted" style={{ fontSize: "0.85rem" }}>
              Signed in as {session?.full_name}
            </div>
          </div>
          <button
            className="secondary"
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            Sign out
          </button>
        </div>
        <Outlet />
      </main>
    </div>
  );
}

import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";

type Mod = { code: string; name: string; category: string; route: string; is_dedicated: boolean };

const STATIC_LINKS = [
  { to: "/dashboard", label: "Dashboard", category: "Overview" },
  { to: "/administration", label: "Administration", category: "Administration" },
  { to: "/clinical-hub", label: "Lab / IPD / Claims", category: "Clinical" },
  { to: "/masters", label: "Configuration Masters", category: "Platform" },
  { to: "/reports", label: "Reports & BI", category: "Analytics" },
  { to: "/notifications", label: "Notifications", category: "Engagement" },
  { to: "/audit", label: "Audit & Governance", category: "Platform" },
  { to: "/tenants", label: "Tenants (Super)", category: "Platform", superOnly: true },
];

export default function AppLayout() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const [modules, setModules] = useState<Mod[]>([]);

  useEffect(() => {
    api<Mod[]>("/platform/modules").then(setModules).catch(() => setModules([]));
  }, []);

  const nav = useMemo(() => {
    const dedicated = modules.filter((m) => m.is_dedicated).map((m) => ({
      to: m.route,
      label: m.name,
      category: m.category,
    }));
    const generic = modules
      .filter((m) => !m.is_dedicated)
      .map((m) => ({
        to: m.route.startsWith("/modules/") ? m.route : `/modules/${m.code}`,
        label: m.name,
        category: m.category,
      }));
    const all = [...STATIC_LINKS, ...dedicated, ...generic];
    const byCat: Record<string, typeof all> = {};
    for (const item of all) {
      if ((item as any).superOnly && session?.role_code !== "SUPER_ADMIN") continue;
      const c = item.category || "Other";
      byCat[c] = byCat[c] || [];
      if (!byCat[c].some((x) => x.to === item.to)) byCat[c].push(item);
    }
    return byCat;
  }, [modules, session?.role_code]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">SUMAYA Care 360</div>
        <div className="brand-sub">
          {session?.tenant_code ? `/${session.tenant_code}` : "Super Admin"} · {session?.role_code}
        </div>
        <nav className="nav">
          {Object.entries(nav).map(([cat, items]) => (
            <div key={cat} className="nav-group">
              <div className="nav-cat">{cat}</div>
              {items.map((l) => (
                <NavLink key={l.to} to={l.to} className={({ isActive }) => (isActive ? "active" : "")}>
                  {l.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      <main className="main">
        <div className="topbar">
          <div className="muted" style={{ fontSize: "0.85rem" }}>Signed in as {session?.full_name}</div>
          <button className="secondary" onClick={() => { logout(); navigate("/login"); }}>Sign out</button>
        </div>
        <Outlet />
      </main>
    </div>
  );
}

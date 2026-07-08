import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { buildFallbackPhases, type NavPhase } from "../data/moduleCatalog";

type FlowModule = {
  code: string;
  name: string;
  route: string;
  is_dedicated: boolean;
  super_only?: boolean;
};

type Phase = {
  id: string;
  name: string;
  hub_route: string;
  icon: string;
  modules: FlowModule[];
};

const EXTRA_LINKS = [
  { to: "/dashboard", label: "Dashboard", phase: "_top" },
  { to: "/module-map", label: "Module map", phase: "_top" },
  { to: "/care-journey", label: "Care journey (E2E)", phase: "clinical" },
  { to: "/tenants", label: "Tenants (Super)", phase: "_top", superOnly: true },
];

export default function AppLayout() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const [phases, setPhases] = useState<NavPhase[]>([]);
  const [navError, setNavError] = useState("");

  useEffect(() => {
    api<{ phases: NavPhase[] }>("/platform/module-flow")
      .then((d) => {
        setPhases(d.phases);
        setNavError("");
      })
      .catch((err) => {
        setPhases(buildFallbackPhases());
        setNavError(typeof err?.message === "string" ? err.message : "Using offline module catalog");
      });
  }, []);

  const nav = useMemo(() => {
    const prefix = session?.tenant_code ? `/${session.tenant_code}` : "";
    const withPrefix = (to: string) => (to.startsWith("/") ? `${prefix}${to}` : to);

    const groups: { key: string; label: string; items: { to: string; label: string }[] }[] = [];

    const topItems = EXTRA_LINKS.filter(
      (l) => !l.superOnly || session?.role_code === "SUPER_ADMIN"
    ).map((l) => ({ to: withPrefix(l.to), label: l.label }));
    groups.push({ key: "_top", label: "Overview", items: topItems });

    for (const phase of phases) {
      const hubLink = { to: withPrefix(phase.hub_route), label: `${phase.icon} ${phase.name.split("·")[1]?.trim() || phase.name}` };
      const moduleLinks = phase.modules
        .filter((m) => !m.super_only || session?.role_code === "SUPER_ADMIN")
        .filter((m) => !m.code.startsWith("_"))
        .map((m) => ({
          to: withPrefix(m.route),
          label: m.name.length > 28 ? m.name.slice(0, 26) + "…" : m.name,
        }));
      const seen = new Set<string>();
      const items = [hubLink, ...moduleLinks].filter((item) => {
        if (seen.has(item.to)) return false;
        seen.add(item.to);
        return true;
      });
      groups.push({
        key: phase.id,
        label: phase.name,
        items,
      });
    }

    return groups;
  }, [phases, session?.role_code, session?.tenant_code]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">SUMAYA Care 360</div>
        <div className="brand-sub">
          {session?.tenant_code ? `/${session.tenant_code}` : "Super Admin (demo context)"} · {session?.role_code}
        </div>
        {navError && <div className="muted" style={{ fontSize: "0.72rem", padding: "0 0.5rem" }}>{navError}</div>}
        {phases.length === 0 && (
          <div className="muted" style={{ fontSize: "0.75rem", padding: "0.5rem" }}>Loading modules…</div>
        )}
        <nav className="nav">
          {nav.map((group) => (
            <div key={group.key} className="nav-group">
              <div className="nav-cat">{group.label}</div>
              {group.items.map((l) => (
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

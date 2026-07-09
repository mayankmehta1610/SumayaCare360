import { NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { buildFallbackPhases, type NavPhase } from "../data/moduleCatalog";
import BrandLogo from "./ui/BrandLogo";
import NavIcon, { normalizeRoute } from "./ui/NavIcon";
import { canAccessRoute, filterNavRoutes, homeRouteForRole, stripTenantPrefix } from "../utils/roleAccess";

const EXTRA_LINKS = [
  { to: "/dashboard", label: "Dashboard", phase: "_top" },
  { to: "/demo-tour", label: "Demo tour", phase: "_top" },
  { to: "/module-map", label: "Module map", phase: "_top" },
  { to: "/care-journey", label: "Care journey", phase: "clinical" },
  { to: "/tenants", label: "Tenants", phase: "_top", superOnly: true },
];

export default function AppLayout() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [phases, setPhases] = useState<NavPhase[]>([]);
  const [navError, setNavError] = useState("");

  const prefix = session?.tenant_code ? `/${session.tenant_code}` : "";
  const currentRoute = stripTenantPrefix(location.pathname, session?.tenant_code);
  if (session && !canAccessRoute(session, currentRoute)) {
    return <Navigate to={`${prefix}${homeRouteForRole(session)}`} replace />;
  }

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

    const groups: { key: string; label: string; items: { to: string; label: string; route: string }[] }[] = [];

    const topItems = EXTRA_LINKS.filter(
      (l) => (!l.superOnly || session?.role_code === "SUPER_ADMIN") && filterNavRoutes(session, l.to),
    ).map((l) => ({ to: withPrefix(l.to), label: l.label, route: l.to }));
    groups.push({ key: "_top", label: "Overview", items: topItems });

    for (const phase of phases) {
      const hubRoute = phase.hub_route;
      const hubLabel = phase.name.split("·")[1]?.trim() || phase.name;
      const hubLink = { to: withPrefix(hubRoute), label: hubLabel, route: hubRoute };
      const moduleLinks = phase.modules
        .filter((m) => !m.super_only || session?.role_code === "SUPER_ADMIN")
        .filter((m) => !m.code.startsWith("_"))
        .filter((m) => filterNavRoutes(session, m.route))
        .map((m) => ({
          to: withPrefix(m.route),
          label: m.name.length > 26 ? m.name.slice(0, 24) + "…" : m.name,
          route: m.route,
        }));
      const seen = new Set<string>();
      const items = [hubLink, ...moduleLinks].filter((item) => {
        if (seen.has(item.to)) return false;
        seen.add(item.to);
        return true;
      });
      groups.push({ key: phase.id, label: phase.name, items });
    }

    return groups;
  }, [phases, session, session?.role_code, session?.tenant_code]);

  const initials = session?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar__head">
          <BrandLogo />
          <div className="brand-sub">
            {session?.tenant_code ? (
              <span className="tenant-pill">/{session.tenant_code}</span>
            ) : (
              <span>Super admin</span>
            )}
            <span>· {session?.role_code?.replace(/_/g, " ")}</span>
          </div>
          {navError && <div className="muted" style={{ fontSize: "0.7rem", marginTop: "0.5rem" }}>{navError}</div>}
        </div>
        <nav className="nav">
          {phases.length === 0 && (
            <div className="muted" style={{ fontSize: "0.75rem", padding: "0.5rem" }}>Loading modules…</div>
          )}
          {nav.map((group) => (
            <div key={group.key} className="nav-group">
              <div className="nav-cat">{group.label}</div>
              {group.items.map((l) => (
                <NavLink key={l.to} to={l.to} className={({ isActive }) => (isActive ? "active" : "")}>
                  <NavIcon route={normalizeRoute(l.route)} className="nav-icon" size={17} />
                  <span>{l.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      <main className="main">
        <div className="topbar">
          <div className="topbar__left">
            <span className="topbar__title">Hospital & clinic operations</span>
          </div>
          <div className="topbar__user">
            <div className="user-chip">
              <div className="user-avatar">{initials}</div>
              <span>{session?.full_name}</span>
            </div>
            <button type="button" className="secondary" onClick={() => { logout(); navigate("/login"); }}>
              <LogOut size={16} style={{ verticalAlign: "middle", marginRight: "0.35rem" }} />
              Sign out
            </button>
          </div>
        </div>
        <div className="main__content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

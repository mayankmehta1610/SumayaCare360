import { NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useMemo } from "react";
import { LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import BrandLogo from "./ui/BrandLogo";
import NavIcon, { normalizeRoute } from "./ui/NavIcon";
import { canAccessRouteSession, homeRouteForRole, stripTenantPrefix } from "../utils/roleAccess";

/** Strip legacy "1 · Phase name" prefixes from navigation labels. */
function cleanNavLabel(label: string): string {
  return label.replace(/^\d+\s*[·.\-–]\s*/, "").trim() || label;
}

export default function AppLayout() {
  const { session, navigation, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const prefix = session?.tenant_code ? `/${session.tenant_code}` : "";
  const currentRoute = stripTenantPrefix(location.pathname, session?.tenant_code);

  if (session && navigation && !canAccessRouteSession(session, navigation, currentRoute)) {
    return <Navigate to={`${prefix}${homeRouteForRole(navigation)}`} replace />;
  }

  const nav = useMemo(() => {
    if (!navigation) return [];
    const withPrefix = (to: string) => (to.startsWith("/") ? `${prefix}${to}` : to);

    const groups: { key: string; label: string; items: { to: string; label: string; route: string }[] }[] = [];

    const topItems = navigation.top_links.map((l) => ({
      to: withPrefix(l.to),
      label: l.label,
      route: l.to,
    }));
    if (topItems.length > 0) {
      groups.push({ key: "_top", label: "Menu", items: topItems });
    }

    for (const phase of navigation.phases) {
      const items: { to: string; label: string; route: string }[] = [];
      if (phase.hub_visible !== false) {
        const hubLabel = cleanNavLabel(phase.name);
        items.push({
          to: withPrefix(phase.hub_route),
          label: hubLabel,
          route: phase.hub_route,
        });
      }
      for (const m of phase.modules) {
        items.push({
          to: withPrefix(m.route),
          label: m.name.length > 28 ? m.name.slice(0, 26) + "…" : m.name,
          route: m.route,
        });
      }
      const seen = new Set<string>();
      const unique = items.filter((item) => {
        if (seen.has(item.to)) return false;
        seen.add(item.to);
        return true;
      });
      if (unique.length > 0) {
        groups.push({ key: phase.id, label: cleanNavLabel(phase.name), items: unique });
      }
    }

    if (session?.role_code === "SUPER_ADMIN") {
      groups[0]?.items.push({
        to: withPrefix("/tenants"),
        label: "Tenants",
        route: "/tenants",
      });
    }

    return groups;
  }, [navigation, prefix, session?.role_code]);

  const initials = session?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

  const roleLabel = session?.role_code?.replace(/_/g, " ") || "";

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
            <span>· {roleLabel}</span>
          </div>
        </div>
        <nav className="nav">
          {!navigation && (
            <div className="muted" style={{ fontSize: "0.75rem", padding: "0.5rem" }}>Loading menu…</div>
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
            <span className="topbar__title">{roleLabel} workspace</span>
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

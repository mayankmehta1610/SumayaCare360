import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { Session, clearSession, currentSession, saveSession, api } from "../api/client";
import { RoleNavigation } from "../utils/roleAccess";

type AuthState = {
  session: Session | null;
  navigation: RoleNavigation | null;
  loading: boolean;
  login: (email: string, password: string, tenant_code?: string) => Promise<Session>;
  logout: () => void;
  refreshNavigation: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

async function fetchNavigation(): Promise<RoleNavigation | null> {
  try {
    return await api<RoleNavigation>("/auth/navigation");
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(currentSession());
  const [navigation, setNavigation] = useState<RoleNavigation | null>(null);
  const [loading, setLoading] = useState(!!currentSession());

  async function loadSessionAndNav(existing: Session) {
    const me = await api<Session>("/auth/me");
    const next: Session = {
      access_token: existing.access_token,
      tenant_code: me.tenant_code ?? existing.tenant_code,
      role_code: me.role_code,
      full_name: me.full_name,
      permissions: me.permissions ?? existing.permissions,
    };
    saveSession(next);
    setSession(next);
    const nav = await fetchNavigation();
    setNavigation(nav);
  }

  useEffect(() => {
    const existing = currentSession();
    if (!existing) {
      setLoading(false);
      return;
    }
    loadSessionAndNav(existing)
      .catch(() => {
        clearSession();
        setSession(null);
        setNavigation(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      navigation,
      loading,
      async refreshNavigation() {
        const nav = await fetchNavigation();
        setNavigation(nav);
      },
      async login(email, password, tenant_code) {
        const data = await api<Session>("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password, tenant_code: tenant_code || null }),
          tenantCode: tenant_code || null,
        });
        saveSession(data);
        setSession(data);
        const nav = await fetchNavigation();
        setNavigation(nav);
        return data;
      },
      logout() {
        api("/auth/logout", { method: "POST" }).catch(() => {});
        clearSession();
        setSession(null);
        setNavigation(null);
      },
    }),
    [session, navigation, loading]
  );

  if (loading) {
    return (
      <div className="login-panel" style={{ minHeight: "100vh" }}>
        <div className="card" style={{ padding: "2rem", textAlign: "center" }}>
          <div className="kpi__icon" style={{ margin: "0 auto 1rem" }}>⋯</div>
          Loading session…
        </div>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("AuthProvider missing");
  return ctx;
}

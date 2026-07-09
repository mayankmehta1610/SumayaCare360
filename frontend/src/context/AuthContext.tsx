import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { Session, clearSession, currentSession, saveSession, api } from "../api/client";

type AuthState = {
  session: Session | null;
  loading: boolean;
  login: (email: string, password: string, tenant_code?: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(currentSession());
  const [loading, setLoading] = useState(!!currentSession());

  useEffect(() => {
    const existing = currentSession();
    if (!existing) {
      setLoading(false);
      return;
    }
    api<Session>("/auth/me")
      .then((me) => {
        const next: Session = {
          access_token: existing.access_token,
          tenant_code: me.tenant_code ?? existing.tenant_code,
          role_code: me.role_code,
          full_name: me.full_name,
          permissions: me.permissions ?? existing.permissions,
        };
        saveSession(next);
        setSession(next);
      })
      .catch(() => {
        clearSession();
        setSession(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      loading,
      async login(email, password, tenant_code) {
        const data = await api<Session>("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password, tenant_code: tenant_code || null }),
          tenantCode: tenant_code || null,
        });
        saveSession(data);
        setSession(data);
      },
      logout() {
        api("/auth/logout", { method: "POST" }).catch(() => {});
        clearSession();
        setSession(null);
      },
    }),
    [session, loading]
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

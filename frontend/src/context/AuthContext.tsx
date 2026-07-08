import { createContext, useContext, useMemo, useState, ReactNode } from "react";
import { Session, clearSession, currentSession, saveSession, api } from "../api/client";

type AuthState = {
  session: Session | null;
  login: (email: string, password: string, tenant_code?: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(currentSession());

  const value = useMemo<AuthState>(
    () => ({
      session,
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
        clearSession();
        setSession(null);
      },
    }),
    [session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("AuthProvider missing");
  return ctx;
}

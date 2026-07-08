const API_BASE = import.meta.env.VITE_API_BASE || "/api/v1";

export type Session = {
  access_token: string;
  tenant_code?: string | null;
  role_code: string;
  full_name: string;
  permissions: string[];
};

function getSession(): Session | null {
  const raw = localStorage.getItem("sc360_session");
  return raw ? JSON.parse(raw) : null;
}

export function saveSession(session: Session) {
  localStorage.setItem("sc360_session", JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem("sc360_session");
}

export function currentSession() {
  return getSession();
}

export function hasPermission(session: Session | null, perm: string): boolean {
  if (!session) return false;
  if (session.permissions.includes("*")) return true;
  if (session.permissions.includes(perm)) return true;
  const [resource] = perm.split(":");
  return session.permissions.includes(`${resource}:*`);
}

export async function api<T = any>(
  path: string,
  options: RequestInit & { tenantCode?: string | null } = {}
): Promise<T> {
  const session = getSession();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  const tenant = options.tenantCode ?? session?.tenant_code
    ?? (session?.role_code === "SUPER_ADMIN" ? "demo" : undefined);
  if (tenant) {
    headers["X-Tenant-Code"] = tenant;
  }
  headers["X-Correlation-Id"] = crypto.randomUUID();

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
  if (res.status === 401) {
    clearSession();
    if (!window.location.pathname.startsWith("/login")) {
      window.location.href = "/login";
    }
    throw new Error("Session expired");
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || JSON.stringify(body);
    } catch {
      /* ignore */
    }
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

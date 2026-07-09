import { api } from "./client";

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
};

export function isPaginated<T>(data: unknown): data is Paginated<T> {
  return !!data && typeof data === "object" && "items" in data && Array.isArray((data as Paginated<T>).items);
}

export function normalizeList<T>(data: T[] | Paginated<T>): Paginated<T> {
  if (isPaginated<T>(data)) return data;
  const items = data as T[];
  return { items, total: items.length, page: 1, page_size: items.length || 25, pages: 1 };
}

export async function apiList<T>(
  path: string,
  params: Record<string, string | number | undefined> = {},
): Promise<Paginated<T>> {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  });
  const suffix = qs.toString() ? `?${qs}` : "";
  const data = await api<T[] | Paginated<T>>(`${path}${suffix}`);
  return normalizeList(data);
}

/** Load all patients for dropdowns (up to 500). */
export async function fetchPatients(): Promise<any[]> {
  const res = await apiList<any>("/patients", { page: 1, page_size: 500 });
  return res.items;
}

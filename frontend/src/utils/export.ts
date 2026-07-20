export function downloadText(content: string, filename: string, mime = "text/plain") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadJson(data: unknown, filename: string) {
  downloadText(JSON.stringify(data, null, 2), filename, "application/json");
}

export function downloadCsv(csv: string, filename: string) {
  downloadText(csv, filename, "text/csv");
}

export function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

export function downloadExcel(rows: Record<string, unknown>[], filename: string, title = "Report") {
  const cols = rows[0] ? Object.keys(rows[0]) : [];
  const esc = (value: unknown) => String(value == null ? "" : typeof value === "object" ? JSON.stringify(value) : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = `<html><head><meta charset="utf-8"></head><body><h2>${esc(title)}</h2><table border="1"><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${cols.map((c) => `<td>${esc(r[c])}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`;
  downloadText(html, filename, "application/vnd.ms-excel");
}

export async function exportFromApi(
  path: string,
  filename: string,
  format: "json" | "csv" = "json",
  extraParams: Record<string, string> = {},
) {
  const qs = new URLSearchParams({ format, ...extraParams });
  const data = await import("../api/client").then(({ api }) =>
    api<any>(`${path}?${qs}`, { method: "POST" }),
  );
  if (format === "csv" && data.csv) {
    downloadCsv(data.csv, `${filename}.csv`);
  } else if (data.records) {
    downloadJson(data.records, `${filename}.json`);
  } else {
    downloadJson(data, `${filename}.json`);
  }
  return data.count ?? data.row_count ?? 0;
}

import { ReactNode } from "react";

export type Column<T> = {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
};

type Props<T> = {
  title?: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  search: string;
  onSearchChange: (q: string) => void;
  searchPlaceholder?: string;
  onExportJson?: () => void;
  onExportCsv?: () => void;
  renderActions?: (row: T) => ReactNode;
  emptyMessage?: string;
  toolbar?: ReactNode;
  loading?: boolean;
};

export default function DataTable<T>({
  title,
  columns,
  rows,
  rowKey,
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  onExportJson,
  onExportCsv,
  renderActions,
  emptyMessage = "No records found",
  toolbar,
  loading,
}: Props<T>) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="card table-wrap">
      {(title || onExportJson || onExportCsv || toolbar) && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.75rem" }}>
          {title && <h3 style={{ margin: 0 }}>{title}</h3>}
          <div className="actions" style={{ flexWrap: "wrap" }}>
            {toolbar}
            {onExportJson && (
              <button type="button" className="secondary" onClick={onExportJson}>Export JSON</button>
            )}
            {onExportCsv && (
              <button type="button" className="secondary" onClick={onExportCsv}>Export CSV</button>
            )}
          </div>
        </div>
      )}
      <div className="actions" style={{ marginBottom: "0.75rem", flexWrap: "wrap" }}>
        <input
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{ minWidth: "200px" }}
        />
        {onPageSizeChange && (
          <select value={pageSize} onChange={(e) => onPageSizeChange(Number(e.target.value))}>
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>{n} / page</option>
            ))}
          </select>
        )}
        <span className="muted" style={{ fontSize: "0.85rem" }}>
          {loading ? "Loading…" : `${from}–${to} of ${total}`}
        </span>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((c) => <th key={c.key}>{c.label}</th>)}
            {renderActions && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && !loading && (
            <tr className="data-table__empty"><td colSpan={columns.length + (renderActions ? 1 : 0)} className="muted">{emptyMessage}</td></tr>
          )}
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((c) => (
                <td key={c.key} data-label={c.label}>{c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? "—")}</td>
              ))}
              {renderActions && <td data-label="Actions" className="actions data-table__actions" style={{ flexWrap: "wrap" }}>{renderActions(row)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      {pages > 1 && (
        <div className="table-pagination">
          <button type="button" className="secondary" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>← Prev</button>
          <span className="muted">Page {page} / {pages}</span>
          <button type="button" className="secondary" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
}

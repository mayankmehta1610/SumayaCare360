import { ReactNode, useCallback, useEffect, useState } from "react";
import { apiList } from "../api/list";
import DataTable, { Column } from "./DataTable";
import { exportFromApi } from "../utils/export";

type Props<T> = {
  title: string;
  listPath: string;
  exportPath: string;
  columns: Column<T>[];
  rowKey: (row: T) => string;
  searchPlaceholder?: string;
  statusOptions?: string[];
  renderActions?: (row: T, reload: () => void) => ReactNode;
  canWrite?: boolean;
  createForm?: ReactNode;
  toolbar?: ReactNode;
};

export default function ClinicalListDesk<T extends Record<string, unknown>>({
  title,
  listPath,
  exportPath,
  columns,
  rowKey,
  searchPlaceholder,
  statusOptions = [],
  renderActions,
  canWrite = true,
  createForm,
  toolbar,
}: Props<T>) {
  const [rows, setRows] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiList<T>(listPath, {
        query: search,
        status: statusFilter || undefined,
        page,
        page_size: pageSize,
      });
      setRows(res.items);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [listPath, search, statusFilter, page, pageSize]);

  useEffect(() => {
    reload().catch(() => {});
  }, [reload]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  return (
    <div>
      {msg && <div className="success">{msg}</div>}
      {canWrite && createForm}
      <DataTable
        title={title}
        columns={columns}
        rows={rows}
        rowKey={rowKey}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={searchPlaceholder}
        loading={loading}
        toolbar={
          <>
            {toolbar}
            {statusOptions.length > 0 && (
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All statuses</option>
                {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
          </>
        }
        onExportJson={() => exportFromApi(exportPath, title.replace(/\s+/g, "-"), "json", { query: search, status: statusFilter }).then((n) => setMsg(`Exported ${n}`))}
        onExportCsv={() => exportFromApi(exportPath, title.replace(/\s+/g, "-"), "csv", { query: search, status: statusFilter }).then((n) => setMsg(`Exported ${n}`))}
        renderActions={renderActions ? (r) => renderActions(r, reload) : undefined}
      />
    </div>
  );
}

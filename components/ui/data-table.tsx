export type Column<T> = {
  key: string; header: string; align?: "left" | "right"; className?: string; render: (row: T) => React.ReactNode;
  /** "low" columns hide below sm, so a phone shows the ones that matter without sideways scrolling. */
  priority?: "low";
};

/** Quiet table: grey headers, hairline rows, right-aligned figures. Scrolls inside its card on narrow screens. */
/** Pagination is controlled: pass `pageSize` with `page` and `onPage` (keep `page` in the URL). */
export function DataTable<T>({ columns, rows, rowKey, highlight, caption, footer, pageSize, page = 1, onPage }: {
  columns: Column<T>[]; rows: T[]; rowKey: (row: T) => string; highlight?: string; caption?: string; footer?: React.ReactNode;
  pageSize?: number; page?: number; onPage?: (page: number) => void;
}) {
  const pages = pageSize ? Math.max(1, Math.ceil(rows.length / pageSize)) : 1;
  const at = Math.min(Math.max(1, page), pages);
  const visible = pageSize ? rows.slice((at - 1) * pageSize, at * pageSize) : rows;
  const hide = (c: Column<T>) => (c.priority === "low" ? "hidden sm:table-cell" : "");
  const pager = "h-8 rounded-control border border-hairline bg-surface px-3 text-sm text-strong hover:bg-raised disabled:pointer-events-none disabled:opacity-50";
  return (
    <div className="-mx-2 relative overflow-x-auto">
      <table className="w-full border-separate border-spacing-0 text-sm sm:min-w-[640px]">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={`${hide(c)} border-b border-hairline px-2 pb-2.5 text-xs font-normal text-faint ${c.align === "right" ? "text-right" : "text-left"}`}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((r) => {
            const k = rowKey(r);
            return (
              <tr key={k} className={k === highlight ? "bg-raised/70" : ""}>
                {columns.map((c) => (
                  <td key={c.key} className={`${hide(c)} border-b border-hairline px-2 py-3 align-middle text-strong tabular-nums ${c.align === "right" ? "text-right" : ""} ${c.className ?? ""}`}>{c.render(r)}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {(footer || pages > 1) && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-2 pt-4 text-sm text-faint">
          {footer ?? <span />}
          {pages > 1 && (
            <nav aria-label="Pages" className="flex items-center gap-2">
              <button type="button" className={pager} disabled={at === 1} onClick={() => onPage?.(at - 1)}>Previous</button>
              <span className="tabular-nums">Page {at} of {pages}</span>
              <button type="button" className={pager} disabled={at === pages} onClick={() => onPage?.(at + 1)}>Next</button>
            </nav>
          )}
        </div>
      )}
    </div>
  );
}

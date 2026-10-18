export type Column<T> = { key: string; header: string; align?: "left" | "right"; className?: string; render: (row: T) => React.ReactNode };

/** Quiet table: grey headers, hairline rows, right-aligned figures. Scrolls inside its card on narrow screens. */
export function DataTable<T>({ columns, rows, rowKey, highlight, caption, footer }: { columns: Column<T>[]; rows: T[]; rowKey: (row: T) => string; highlight?: string; caption?: string; footer?: React.ReactNode }) {
  return (
    <div className="-mx-2 relative overflow-x-auto">
      <table className="w-full min-w-[640px] border-separate border-spacing-0 text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={`border-b border-hairline px-2 pb-2.5 text-xs font-normal text-faint ${c.align === "right" ? "text-right" : "text-left"}`}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const k = rowKey(r);
            return (
              <tr key={k} className={k === highlight ? "bg-raised/70" : ""}>
                {columns.map((c) => (
                  <td key={c.key} className={`border-b border-hairline px-2 py-3 align-middle text-strong tabular-nums ${c.align === "right" ? "text-right" : ""} ${c.className ?? ""}`}>{c.render(r)}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {footer && <div className="flex items-center justify-between px-2 pt-4 text-sm text-faint">{footer}</div>}
    </div>
  );
}

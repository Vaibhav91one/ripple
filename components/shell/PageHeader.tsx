import Link from "next/link";
import { Calendar, ChevronDown, ChevronRight, Download, ListFilter } from "lucide-react";

/** Page title row (margin): a large light title on the left, the control row on the right. Detail pages pass `crumbs`. */
export function PageHeader({ title, subtitle, crumbs, children }: { title: React.ReactNode; subtitle?: React.ReactNode; crumbs?: { label: string; href?: string }[]; children?: React.ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
      <div className="min-w-0">
        {crumbs && (
          <nav aria-label="Breadcrumb" className="mb-2 flex items-center gap-1 text-sm text-faint">
            {crumbs.map((c, i) => (
              <span key={c.label} className="flex items-center gap-1">
                {i > 0 && <ChevronRight size={13} aria-hidden />}
                {c.href ? <Link href={c.href} className="hover:text-strong">{c.label}</Link> : <span className="text-body">{c.label}</span>}
              </span>
            ))}
          </nav>
        )}
        <h1 className="truncate text-3xl font-normal leading-tight tracking-tight text-strong sm:text-title">{title}</h1>
        {subtitle && <p className="mt-1.5 text-md text-faint">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}

const pill = "inline-flex h-10 items-center gap-2 rounded-control px-3.5 text-sm font-medium";

/** Date range pill plus the muted "vs previous" label that always follows it. */
export function DateRange({ label, compare, onClick }: { label: string; compare?: string; onClick?: () => void }) {
  return (
    <span className="inline-flex items-center gap-1">
      <button type="button" onClick={onClick} className={`${pill} border border-hairline bg-surface text-strong shadow-[0_1px_1px_oklch(0_0_0/0.03)]`}>
        <Calendar size={15} aria-hidden className="text-body" />
        {label}
        <ChevronDown size={14} aria-hidden className="text-faint" />
      </button>
      {compare && <span className="px-2 text-sm text-faint">vs {compare}</span>}
    </span>
  );
}

export function FilterPill({ label, icon: Icon = ListFilter, onClick }: { label: string; icon?: typeof ListFilter; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`${pill} bg-raised text-strong hover:bg-hairline`}>
      <Icon size={15} aria-hidden className="text-body" />
      {label}
      <ChevronDown size={14} aria-hidden className="text-faint" />
    </button>
  );
}

/** White pill button; `href` makes it a download link (e.g. a CSV route), otherwise it calls `onClick`. */
export function ExportButton({ href, label = "Export", onClick }: { href?: string; label?: string; onClick?: () => void }) {
  const body = (<><Download size={15} aria-hidden className="text-body" />{label}</>);
  const cls = `${pill} border border-hairline bg-surface text-strong hover:bg-raised`;
  return href ? <a href={href} download className={cls}>{body}</a> : <button type="button" onClick={onClick} className={cls}>{body}</button>;
}

/** The one dark button a page may have (margin's "Flag for review"). */
export function PrimaryButton({ children, href }: { children: React.ReactNode; href?: string }) {
  const cls = `${pill} bg-strong text-ink-on-strong shadow-[0_1px_2px_oklch(0_0_0/0.15)] hover:bg-body`;
  return href ? <Link href={href} className={cls}>{children}</Link> : <button type="button" className={cls}>{children}</button>;
}

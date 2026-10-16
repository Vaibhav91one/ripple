/** Page title row inside the shell content area: title + subtitle on the left, optional controls on the right. */
export function PageHeader({ title, subtitle, children }: { title: React.ReactNode; subtitle?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold text-strong">{title}</h1>
        {subtitle && <p className="mt-1 text-[13px] text-faint">{subtitle}</p>}
      </div>
      {children}
    </header>
  );
}

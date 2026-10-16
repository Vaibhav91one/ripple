// Beautiful UI (beautifului.dev), MIT, see ./LICENSE. Restyled to Ripple tokens.
"use client";

import "./kit.css";

import { useMemo, useState } from "react";

/* ─────────────────────────────────────────────────────────
 * RECORDS TABLE — a compact CRM grid with the details that
 * make a wide table feel usable: explicit grid lines, a
 * restrained tag palette, a sticky first column, real links,
 * selection, sorting, import/export actions, and calculations.
 * ───────────────────────────────────────────────────────── */

export type Strength = "strong" | "weak" | "veryweak" | "none";
type SortKey = "name" | "last" | "strength";

const STRENGTH: Record<Strength, { label: string; color: string; rank: number }> = {
  strong: { label: "Covered", color: "var(--covered)", rank: 3 },
  weak: { label: "Partly told", color: "var(--gap)", rank: 2 },
  veryweak: { label: "Not told", color: "var(--conflict)", rank: 1 },
  none: { label: "Unknown", color: "var(--faint)", rank: 0 },
};

const TAG_COLORS: Record<string, string> = {
  Contract: "var(--gap)",
  RFC: "var(--ripple)",
  Slack: "var(--covered)",
  Policy: "var(--conflict)",
  Plan: "var(--ripple)",
  Email: "var(--covered)",
};

export type RecordRow = {
  id: string;
  name: string;
  tags: string[];
  last: string;
  strength: Strength;
  website?: string;
};

const SAMPLE_ROWS: RecordRow[] = [
  { id: "rfc-14", name: "RFC-14 · Launch moves to Nov 3", tags: ["RFC", "Plan"], last: "9 days ago", strength: "strong", website: "docs.acme.com/rfc-14" },
  { id: "msa-v3", name: "Acme MSA v3 · clause 7.2", tags: ["Contract"], last: "3 weeks ago", strength: "veryweak", website: "legal.acme.com/msa-v3" },
  { id: "launch-thread", name: "#launch-plan thread", tags: ["Slack"], last: "2 days ago", strength: "weak" },
  { id: "sla", name: "Support SLA policy", tags: ["Policy", "Contract"], last: "2 months ago", strength: "weak", website: "wiki.acme.com/sla" },
  { id: "billing", name: "Billing migration plan", tags: ["Plan", "RFC"], last: "15 days ago", strength: "strong", website: "docs.acme.com/billing" },
  { id: "renewal", name: "Globex renewal email", tags: ["Email", "Contract"], last: "over 1 year ago", strength: "veryweak" },
  { id: "onboarding", name: "Customer onboarding checklist", tags: ["Policy"], last: "5 months ago", strength: "veryweak" },
  { id: "pricing", name: "Pricing sheet Q4", tags: ["Plan"], last: "No contact", strength: "none", website: "sales.acme.com/pricing" },
  { id: "security", name: "Security review notes", tags: ["RFC", "Policy"], last: "about 1 month ago", strength: "weak" },
  { id: "handoff", name: "Sales handoff email", tags: ["Email"], last: "No contact", strength: "none" },
];

function Icon({ children, size = 14, strokeWidth = 1.8 }: { children: React.ReactNode; size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

function Checkbox({ checked, mixed = false, onChange, label }: { checked: boolean; mixed?: boolean; onChange: () => void; label: string }) {
  return (
    <label className="records-checkbox" title={label}>
      <input type="checkbox" checked={checked} onChange={onChange} aria-label={label} />
      <span className={`records-checkbox-box ${checked || mixed ? "is-active" : ""}`}>
        {mixed ? <span className="records-checkbox-dash" /> : checked ? <Icon size={12}><path d="m5 12 4 4L19 6" /></Icon> : null}
      </span>
    </label>
  );
}


function Tag({ name }: { name: string }) {
  const color = TAG_COLORS[name] ?? "var(--faint)";
  return (
    <span className="records-tag" style={{ "--tag-color": color } as React.CSSProperties}>
      <span className="records-tag-dot" style={{ background: color }} />
      {name}
    </span>
  );
}

function HeaderCell({ label, icon, sortKey, sort, onSort, className = "" }: { label: string; icon: React.ReactNode; sortKey?: SortKey; sort: { key: SortKey; dir: 1 | -1 }; onSort: (key: SortKey) => void; className?: string }) {
  return (
    <th className={`records-header-cell ${className}`}>
      <button type="button" className="records-header-button" onClick={sortKey ? () => onSort(sortKey) : undefined}>
        <span className="records-header-icon">{icon}</span>
        <span className="truncate">{label}</span>
        {sortKey && <span className={`records-sort ${sort.key === sortKey ? "is-visible" : ""}`} style={{ transform: sort.key === sortKey && sort.dir === -1 ? "rotate(180deg)" : undefined }}><Icon size={12}><path d="M12 5v14M5 12l7 7 7-7" /></Icon></span>}
      </button>
    </th>
  );
}

const SAMPLE_LABELS = ["Company", "Kind", "Last touched", "Coverage", "Links"] as const;

export default function RecordsTable({
  rows = SAMPLE_ROWS,
  labels = SAMPLE_LABELS,
}: {
  rows?: RecordRow[];
  /** Column headers: name, tags, last, strength, links. */
  labels?: readonly string[];
} = {}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "name", dir: 1 });

  const visibleRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const value = sort.key === "name"
        ? a.name.localeCompare(b.name)
        : sort.key === "last"
          ? a.last.localeCompare(b.last)
          : STRENGTH[a.strength].rank - STRENGTH[b.strength].rank;
      return value * sort.dir;
    });
  }, [rows, sort]);

  const allSelected = visibleRows.length > 0 && visibleRows.every((row) => selected.has(row.id));
  const partiallySelected = !allSelected && visibleRows.some((row) => selected.has(row.id));

  const toggleSort = (key: SortKey) => setSort((current) => current.key === key ? { key, dir: (current.dir * -1) as 1 | -1 } : { key, dir: 1 });
  const toggleRow = (id: string) => setSelected((current) => {
    const next = new Set(current);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const toggleAll = () => setSelected((current) => {
    const next = new Set(current);
    if (allSelected) visibleRows.forEach((row) => next.delete(row.id));
    else visibleRows.forEach((row) => next.add(row.id));
    return next;
  });

  return (
    <div className="records-shell">
      <div className="records-scroll" tabIndex={0} aria-label="Artifacts table. Scroll horizontally and vertically to view all columns and records.">
        <table className="records-table">
          <colgroup><col className="records-company-col" /><col className="records-category-col" /><col className="records-last-col" /><col className="records-strength-col" /><col className="records-link-col" /></colgroup>
          <thead>
            <tr>
              <th className="records-header-cell records-sticky-cell"><div className="records-company-header"><Checkbox checked={allSelected} mixed={partiallySelected} onChange={toggleAll} label="Select all rows" /><span>{labels[0]}</span></div></th>
              <HeaderCell label={labels[1]} sort={sort} onSort={toggleSort} icon={<Icon size={15}><path d="m20.6 13.4-8.6 8.6-8-8V4h10l6.6 6.6a2 2 0 0 1 0 2.8zM7 7h.01" /></Icon>} />
              <HeaderCell label={labels[2]} sortKey="last" sort={sort} onSort={toggleSort} icon={<Icon size={15}><path d="M3 5h18M3 12h12M3 19h7M18 15v6m-3-3h6" /></Icon>} />
              <HeaderCell label={labels[3]} sortKey="strength" sort={sort} onSort={toggleSort} icon={<Icon size={15}><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1a5.5 5.5 0 1 0-7.8 7.8L12 21l8.8-8.5a5.5 5.5 0 0 0 0-7.9z" /></Icon>} />
              <HeaderCell label={labels[4]} sort={sort} onSort={toggleSort} icon={<Icon size={15}><path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1" /></Icon>} />
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => {
              const selectedRow = selected.has(row.id);
              const strength = STRENGTH[row.strength];
              return <tr key={row.id} className={`records-row ${selectedRow ? "is-selected" : ""}`}>
                <td className="records-cell records-sticky-cell records-company-cell"><Checkbox checked={selectedRow} onChange={() => toggleRow(row.id)} label={`Select ${row.name}`} /><span className="records-company-mark">{row.name.slice(0, 1).toUpperCase()}</span><a href={row.website ? `https://${row.website}` : "#"} onClick={(event) => !row.website && event.preventDefault()} className={`records-company-name ${row.website ? "has-link" : ""}`}>{row.name}</a></td>
                <td className="records-cell"><div className="records-tags">{row.tags.slice(0, 4).map((tag) => <Tag key={tag} name={tag} />)}{row.tags.length > 4 ? <span className="records-more-tag">+{row.tags.length - 4}</span> : null}</div></td>
                <td className={`records-cell ${row.last === "No contact" ? "records-muted" : ""}`}>{row.last}</td>
                <td className="records-cell"><span className="records-strength"><span className="records-strength-dot" style={{ background: strength.color }} />{strength.label}</span></td>
                <td className="records-cell">{row.website ? <a className="records-link" href={`https://${row.website}`} target="_blank" rel="noreferrer">{row.website}<Icon size={12}><path d="M14 5h5v5M19 5l-8 8" /></Icon></a> : <span className="records-muted">—</span>}</td>
              </tr>;
            })}
          </tbody>
          <tfoot>
            <tr className="records-calculation-row"><td className="records-cell records-sticky-cell records-calculation-label"><span className="records-calculation-number">{rows.length}</span> count</td><td className="records-cell"><button type="button" className="records-add-calculation"><Icon size={14}><path d="M12 5v14M5 12h14" /></Icon>Add calculation</button></td><td className="records-cell records-muted">—</td><td className="records-cell"><span className="records-average"><span className="records-strength-dot" style={{ background: "var(--gap)" }} />{Math.round(rows.reduce((sum, row) => sum + STRENGTH[row.strength].rank, 0) / rows.length / 3 * 100)}% average</span></td><td className="records-cell"><span className="records-muted">{rows.filter((row) => row.website).length} links</span></td></tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

"use client";
// Obsidian UI (obsidianui.dev) Analytics Dashboard, MIT, see ../LICENSE. Restyled to Ripple tokens; prop-driven (no star state).
import type { CSSProperties, ReactNode } from "react";
import { m, useReducedMotion } from "motion/react";
import { StatusPill } from "./status-pill";
import { cx, type Tone } from "./tone";

export function RepoCard({
  title,
  meta,
  icon,
  tag,
  stats = [],
  status,
  activity,
  updated,
  className,
}: {
  /** "org/name" renders the org part faint */
  title: string;
  /** description under the title */
  meta?: ReactNode;
  icon?: ReactNode;
  tag?: string;
  stats?: { icon?: ReactNode; label: string }[];
  status?: { tone: Tone; label: string };
  /** mini bar strip */
  activity?: number[];
  updated?: string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const slash = title.indexOf("/");
  const org = slash >= 0 ? title.slice(0, slash + 1) : "";
  const name = slash >= 0 ? title.slice(slash + 1) : title;
  const peak = Math.max(1, ...(activity ?? []));

  return (
    <div className={cx("oa oa-card oa-repo", className)}>
      <div className="oa-repo-head">
        {icon}
        <h3 className="oa-repo-name">
          {org && <span className="oa-repo-org">{org}</span>}
          {name}
        </h3>
        {tag && <span className="oa-tag">{tag}</span>}
        {status && <StatusPill tone={status.tone} label={status.label} />}
      </div>
      {meta && <p className="oa-repo-desc">{meta}</p>}
      {activity && (
        <div className="oa-mini-bars" role="img" aria-label={`Last ${activity.length} periods, peak ${peak}`}>
          {activity.map((v, i) => (
            <m.span
              key={i}
              style={{ "--h": v / peak } as CSSProperties}
              initial={reduce ? false : { scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1], delay: 0.2 + i * 0.022 }}
            />
          ))}
        </div>
      )}
      <div className="oa-repo-foot">
        {stats.map((s) => (
          <span key={s.label} className="oa-repo-stat">
            {s.icon}
            {s.label}
          </span>
        ))}
        {updated && <span className="oa-repo-updated">{updated}</span>}
      </div>
    </div>
  );
}

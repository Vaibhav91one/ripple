"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** One labelled snippet with a copy button. The code is shown exactly as it is copied. */
export function CopySnippet({ label, lang, code }: { label: string; lang?: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () =>
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }, () => {});
  return (
    <figure className="overflow-hidden rounded-inset border border-hairline bg-surface">
      <figcaption className="flex items-center justify-between gap-3 border-b border-hairline px-3 py-1.5">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-xs font-medium text-strong">{label}</span>
          {lang && <span className="text-xs text-faint">{lang}</span>}
        </span>
        <button type="button" onClick={copy} aria-label={`Copy ${label}`}
          className={`inline-flex h-7 shrink-0 items-center gap-1 rounded-chip px-2 text-xs font-medium hover:bg-raised ${copied ? "text-covered-ink" : "text-body"}`}>
          {copied ? <Check size={12} aria-hidden /> : <Copy size={12} aria-hidden />}
          <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
        </button>
      </figcaption>
      <pre className="whitespace-pre-wrap bg-page px-3 py-2.5 font-mono [overflow-wrap:anywhere] text-xs leading-relaxed text-strong"><code>{code}</code></pre>
    </figure>
  );
}

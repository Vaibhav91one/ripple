import { MotionDemo } from "@/components/motion/MotionDemo";

// Every design token in one place (#1). Motion (#2) and kit components (#3) add sections here.
const surfaces = ["page", "surface", "raised", "overlay"] as const;
const text = [["strong", "Headings, numbers", "text-strong"], ["body", "Running text", "text-body"], ["faint", "Labels, hints", "text-faint"]] as const;
const status = [
  ["conflict", "Conflict: a promise and a decision disagree"],
  ["gap", "Gap: affected, not told"],
  ["covered", "Covered: told or acknowledged"],
  ["ripple", "Ripple accent: what the change just reached"],
] as const;
const sizes = [["xs", 12], ["sm", 13], ["md", 15], ["lg", 18], ["xl", 24], ["2xl", 32]] as const;

const swatch: Record<string, string> = {
  page: "bg-page", surface: "bg-surface", raised: "bg-raised", overlay: "bg-overlay",
  conflict: "bg-conflict", gap: "bg-gap", covered: "bg-covered", ripple: "bg-ripple",
};
const soft: Record<string, string> = {
  conflict: "bg-conflict-soft text-conflict", gap: "bg-gap-soft text-gap", covered: "bg-covered-soft text-covered", ripple: "bg-ripple-soft text-ripple",
};
const size: Record<string, string> = { xs: "text-xs", sm: "text-sm", md: "text-md", lg: "text-lg", xl: "text-xl", "2xl": "text-2xl" };

export default function Styleguide() {
  return (
    <main className="mx-auto w-full max-w-5xl space-y-10 p-8">
      <header className="space-y-1">
        <h1 className="text-xl">Ripple styleguide</h1>
        <p className="text-faint">Dark first · Geist · 13px base · 8px grid · 6px radius · hairline borders</p>
        <p className="text-faint">
          More: <a href="/styleguide/kit" className="text-ripple hover:underline transition-colors">kit components</a> ·{" "}
          <a href="/styleguide/refs" className="text-ripple hover:underline transition-colors">reference components</a>
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-md">Surfaces</h2>
        <div className="grid grid-cols-4 gap-3">
          {surfaces.map((s) => (
            <div key={s} className={`h-20 rounded-lg border border-hairline p-3 ${swatch[s]}`}>
              <span className="font-mono text-xs text-faint">--{s}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-md">Text</h2>
        {text.map(([t, use, cls]) => (
          <p key={t} className={cls}><span className="font-mono text-xs text-faint">--{t}</span> · {use}</p>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-md">Status colours (strict: one meaning each)</h2>
        <div className="grid grid-cols-4 gap-3">
          {status.map(([s, use]) => (
            <div key={s} className="space-y-2 rounded-lg border border-hairline bg-surface p-3">
              <div className={`h-8 rounded-md ${swatch[s]}`} />
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-xs ${soft[s]}`}>{s}</span>
              <p className="text-xs text-faint">{use}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-md">Type scale</h2>
        {sizes.map(([n, px]) => (
          <p key={n} className={`${size[n]} text-strong`}>{px}px · 40 customers · 3 not told</p>
        ))}
        <p className="font-mono text-sm text-strong">Geist Mono · MATCH (d:Decision)-[:SUNSETS]-&gt;(s:System)</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-md">Signature pieces</h2>
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1 rounded-full border border-hairline bg-raised px-2 py-0.5 font-mono text-xs text-body">RFC-14 §2</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-gap-soft px-2 py-0.5 text-xs text-gap">Legal · not told</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-conflict-soft px-2 py-0.5 text-xs text-conflict">1 conflict</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-covered-soft px-2 py-0.5 text-xs text-covered">Support · told</span>
        </div>
        <p className="text-lg text-strong">5 affected · <span className="text-gap">3 not told</span> · <span className="text-conflict">1 conflict</span></p>
      </section>

      <MotionDemo />
    </main>
  );
}

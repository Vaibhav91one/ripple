import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Mark } from "@/components/brand/Mark";
import { RippleHero } from "@/components/brand/RippleHero";
import { TrustChecklist } from "@/components/kit/refs/fivecorner/trust-checklist";
import { Button } from "@/components/ui/button";

const DOCS = "https://github.com/Vaibhav91one/ripple#readme";

const steps = [
  ["Spot the change", "A pricing edit, a policy update, a renamed API. Ripple notices it in the sources your teams already use."],
  ["Trace who it hits", "Walk the graph hop by hop: systems, customers, contracts and the teams behind them."],
  ["Make sure every team is told and acts", "See who has been told, who hasn't, and what each team has to do next."],
] as const;

const agents = [
  ["Change Scout", "Watches your sources and flags what changed."],
  ["Impact Analyst", "Follows the change through the graph."],
  ["Contract Sentinel", "Checks the change against what you promised."],
  ["Courier", "Tells each affected team, in their words."],
  ["Access Planner", "Works out who needs access to act on it."],
  ["Ask", "Answers any question, with the quote."],
] as const;

const trust = [
  { title: "Every claim has a quote", sub: "Each statement links to the exact source text. No quote, no claim." },
  { title: "Your teams' data stays with them", sub: "Teams only see what they already had access to." },
  { title: "Agents ask before they act", sub: "Nothing is sent or changed without a person saying yes." },
];

const label = "font-mono text-2xs uppercase tracking-wider text-faint";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6">
      <nav className="flex h-16 items-center justify-between">
        <span className="flex items-center gap-2 font-medium text-strong"><Mark size={20} />Ripple</span>
        <div className="flex items-center gap-5 text-body">
          <a href={DOCS} target="_blank" rel="noreferrer" className="transition-colors hover:text-strong">Docs</a>
          <Link href="/overview" className="transition-colors hover:text-strong">Live demo</Link>
        </div>
      </nav>

      <section className="grid items-center gap-12 py-12 md:grid-cols-[1.1fr_1fr] md:py-20">
        <div className="space-y-6">
          <p className={label}>The change-impact graph for your company</p>
          <h1 className="text-balance text-xl font-semibold text-strong sm:text-2xl lg:text-3xl">
            Before you ship a change, Ripple tells you which teams you forgot to tell and which contract you&apos;re about to break, with the quote to prove it.
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg" asChild><Link href="/overview">Try the live demo<ArrowRight aria-hidden /></Link></Button>
            <Button size="lg" variant="outline" asChild><a href={DOCS} target="_blank" rel="noreferrer">Read the docs</a></Button>
          </div>
        </div>
        <RippleHero />
      </section>

      <section className="space-y-6 border-t border-hairline py-14">
        <h2 className={label}>How it works</h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {steps.map(([t, d], i) => (
            <li key={t} className="space-y-2 rounded-card border border-hairline bg-surface p-5">
              <span className="font-mono text-ripple">{i + 1}</span>
              <h3 className="text-md font-medium text-strong">{t}</h3>
              <p className="text-body">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-6 border-t border-hairline py-14">
        <h2 className={label}>Agents</h2>
        <ul className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map(([n, d]) => (
            <li key={n} className="flex gap-3">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-ripple" aria-hidden />
              <p className="text-body"><span className="font-medium text-strong">{n}</span> {d}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-6 border-t border-hairline py-14 md:grid-cols-[1fr_2fr]">
        <h2 className={label}>Trust</h2>
        <div className="max-w-md"><TrustChecklist heading="What you can rely on" items={trust} /></div>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline py-6 text-xs text-faint">
        <span className="flex items-center gap-2"><Mark size={14} />Ripple · built on FalkorDB</span>
        <a href={DOCS} target="_blank" rel="noreferrer" className="transition-colors hover:text-body">GitHub</a>
      </footer>
    </main>
  );
}

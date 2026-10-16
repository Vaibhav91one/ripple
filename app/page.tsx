import Link from "next/link";
import FluidOrb from "@/components/kit/rareui/fluid-orb";
import { Button } from "@/components/ui/button";

const points = [
  ["One graph", "People, systems, customers, contracts and decisions live in a single graph."],
  ["Follows the change", "Change one thing and see every team it touches, and who hasn't been told."],
  ["Sourced briefs", "Every claim links to the exact quote it came from. No quote, no claim."],
] as const;

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-10 px-6 py-16 text-center">
      {/* The one place the orb appears. Its shader colour is a hex (WebGL), matching --ripple. */}
      <div aria-hidden className="opacity-60">
        <FluidOrb size={200} color="#2fb8c4" />
      </div>
      <div className="space-y-4">
        <h1 className="mx-auto max-w-2xl text-2xl font-semibold text-strong sm:text-3xl">
          Change one thing. See everyone it touches, and who hasn&apos;t been told.
        </h1>
        <div className="flex items-center justify-center gap-3">
          <Button size="lg" asChild><Link href="/overview">Try the demo</Link></Button>
          <span className="group relative">
            <Button size="lg" variant="outline" disabled aria-describedby="soon">Sign in</Button>
            <span id="soon" role="tooltip" className="pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-hairline bg-overlay px-2 py-1 text-xs text-body opacity-0 transition-opacity group-hover:opacity-100">
              Coming soon
            </span>
          </span>
        </div>
      </div>
      <ul className="grid w-full gap-3 text-left sm:grid-cols-3">
        {points.map(([t, d]) => (
          <li key={t} className="space-y-1 rounded-lg border border-hairline bg-surface p-4">
            <h2 className="font-medium text-strong">{t}</h2>
            <p className="text-body">{d}</p>
          </li>
        ))}
      </ul>
      <p className="text-xs text-faint">Built on FalkorDB</p>
    </main>
  );
}

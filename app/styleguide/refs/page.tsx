// Reference component system: every UI pattern collected from the user's X likes, shown three ways
// (screenshot, faithful replica in the reference's skin, Ripple version) for review before use.
import type { ReactNode } from "react";
import ProximitySidebar from "@/components/kit/rareui/proximity-sidebar";
import SakaniSection from "@/components/kit/refs/sakani/section";
import MarginSection from "@/components/kit/refs/margin/section";
import FivecornerSection from "@/components/kit/refs/fivecorner/section";
import ClearbillSection from "@/components/kit/refs/clearbill/section";
import Gr8rSection from "@/components/kit/refs/gr8r/section";
import ProtonSection from "@/components/kit/refs/proton/section";
import IsoSection from "@/components/kit/refs/iso/section";
import PushSection from "@/components/kit/refs/push/section";

const groups: { id: string; label: string; note: string; body: ReactNode }[] = [
  { id: "sakani", label: "SakaniUI", note: "Dark CRM home. MIT, ported from github.com/samzydd/Sakani-design-system.", body: <SakaniSection /> },
  { id: "margin", label: "margin", note: "Explaining a number: big figure, waterfall, pattern found, needs you. Design by @nizamdesign, recreated from the image.", body: <MarginSection /> },
  { id: "fivecorner", label: "fivecorner", note: "What changed and how the answer is made: change drawer, stepped bars, inline ask, trust checklist. Design by @nizamdesign.", body: <FivecornerSection /> },
  { id: "clearbill", label: "Clearbill", note: "One exception, end to end: status, evidence diff, explanation, resolve, severity, toast. Design by @nizamdesign.", body: <ClearbillSection /> },
  { id: "gr8r", label: "Gr8r", note: "Timeline with dependencies and a today line. Rebuilt from a written spec; Gr8r's code has no licence and none is copied.", body: <Gr8rSection /> },
  { id: "proton", label: "Proton", note: "Agent at work and big plain numbers. Recreated from the image.", body: <ProtonSection /> },
  { id: "iso", label: "Isometric", note: "Systems as tiles on an isometric grid. Simulithic (image) and ISO-GLOW (MIT) style.", body: <IsoSection /> },
  { id: "push", label: "Push + search", note: "Heat map, pill call to action, mixed search. Push and CollectUI, recreated from the images.", body: <PushSection /> },
];

export default function RefsStyleguide() {
  return (
    <main className="mx-auto w-full max-w-7xl space-y-14 p-8 xl:pr-56">
      <header className="space-y-2">
        <h1 className="text-xl">Reference components</h1>
        <p className="max-w-3xl text-faint">
          Patterns collected from liked posts. Each row shows the reference, a replica in the reference&apos;s own look, and the same
          component on Ripple tokens with Ripple data. Reference screenshots are local only and never committed.
        </p>
      </header>
      <div className="fixed right-0 top-0 hidden h-screen xl:block">
        <ProximitySidebar sections={groups.map((g) => ({ id: g.id, label: g.label, kind: "title" as const }))} />
      </div>
      {groups.map((g) => (
        <section key={g.id} id={g.id} className="space-y-6">
          <header className="space-y-1 border-b border-hairline pb-3">
            <h2 className="text-lg">{g.label}</h2>
            <p className="text-faint">{g.note}</p>
          </header>
          {g.body}
        </section>
      ))}
    </main>
  );
}

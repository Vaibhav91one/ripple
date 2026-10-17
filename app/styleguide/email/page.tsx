import { BriefEmail } from "@/components/email/BriefEmail";
import { NotificationEmail } from "@/components/email/NotificationEmail";
import { demoToken } from "@/lib/ack-token";
import { buildMessage } from "@/lib/notify/message";
import { artifacts, briefs, conflict, decisions, teams } from "@/lib/mock/ledgerly";

const frame = "overflow-hidden rounded-lg border border-hairline";

export default function EmailStyleguide() {
  const brief = briefs.find((b) => b.teamId === "legal")!;
  const quotes = brief.claims.flatMap((c) => c.sources).map((s) => ({
    artifactId: s.artifactId, title: artifacts.find((a) => a.id === s.artifactId)?.title ?? s.artifactId, quote: s.quote,
  }));
  const n = {
    title: decisions.find((d) => d.id === brief.decisionId)!.title,
    body: { reason: "team_owner: Legal owns a contract that guarantees API v1", subject: { kind: "decision", id: brief.decisionId } },
  };
  // Same notification for two recipients: the owner reads the quotes, a non-owner gets the placeholder.
  const ctx = { orgId: "demo", personId: "p-mei", now: 1_800_000_000, baseUrl: "https://ripple.example", deliveryId: "00000000-0000-4000-8000-000000000001", ack: { teamId: "legal", decisionId: brief.decisionId }, quotes };
  const owner = buildMessage(n, { ...ctx, viewer: { teamIds: ["legal"] }, index: { ids: new Map(), artifacts: new Map() } });
  const outsider = buildMessage(n, { ...ctx, viewer: { teamIds: ["eng"] }, index: { ids: new Map(), artifacts: new Map(quotes.map((q) => [q.artifactId, "legal"])) } });
  return (
    <main className="mx-auto w-full max-w-3xl space-y-4 p-8">
      <header className="space-y-1">
        <h1 className="text-xl">Notification email</h1>
        <p className="text-faint">Built from buildMessage() (lib/notify/message.ts): title, why, quotes, actions. Shown for the quote owner, then for a recipient who does not own them.</p>
      </header>
      <div className={frame}><NotificationEmail message={owner} /></div>
      <div className={frame}><NotificationEmail message={outsider} /></div>
      <header className="space-y-1 pt-4">
        <h1 className="text-xl">Brief email</h1>
        <p className="text-faint">Table-based, inline styles. Exported from components/email/BriefEmail.tsx for Resend (#16).</p>
      </header>
      <div className={frame}>
        <BriefEmail
          brief={brief}
          teamName={teams.find((t) => t.id === brief.teamId)!.name}
          decisionTitle={decisions.find((d) => d.id === brief.decisionId)!.title}
          conflict={conflict}
          sourceTitle={(id) => artifacts.find((a) => a.id === id)?.title ?? id}
          token={demoToken("legal")}
        />
      </div>
    </main>
  );
}

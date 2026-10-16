import { BriefEmail } from "@/components/email/BriefEmail";
import { demoToken } from "@/lib/ack-token";
import { artifacts, briefs, conflict, decisions, teams } from "@/lib/mock/ledgerly";

export default function EmailStyleguide() {
  const brief = briefs.find((b) => b.teamId === "legal")!;
  return (
    <main className="mx-auto w-full max-w-3xl space-y-4 p-8">
      <header className="space-y-1">
        <h1 className="text-xl">Brief email</h1>
        <p className="text-faint">Table-based, inline styles. Exported from components/email/BriefEmail.tsx for Resend (#16).</p>
      </header>
      <div className="overflow-hidden rounded-lg border border-hairline">
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

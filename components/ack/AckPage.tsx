import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { AckConfirm } from "./AckConfirm";
import { decodeAckToken } from "@/lib/ack-token";
import { artifacts, briefs, decisions, teams } from "@/lib/mock/ledgerly";

const shell = "mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 px-6 py-16";

function Notice({ icon: Icon, title, body }: { icon: typeof Clock; title: string; body: string }) {
  return (
    <main className={shell}>
      <div className="space-y-3 rounded-lg border border-hairline bg-surface p-6">
        <Icon className="size-5 text-faint" aria-hidden />
        <h1 className="text-lg font-semibold text-strong">{title}</h1>
        <p className="text-body">{body}</p>
        <Link href="/ripple" className="inline-block text-ripple-ink underline underline-offset-4">Open Ripple</Link>
      </div>
    </main>
  );
}

export function AckPage({ token, reply }: { token: string; reply?: string }) {
  const r = decodeAckToken(token);
  if (r.state === "invalid")
    return <Notice icon={AlertTriangle} title="This link is not valid" body="The acknowledgement link is malformed or has been altered. Ask for the brief to be sent again." />;
  if (r.state === "expired")
    return <Notice icon={Clock} title="This link has expired" body="Acknowledgement links last for a limited time. Open Ripple to acknowledge from your inbox." />;
  if (r.state === "acked")
    return <Notice icon={CheckCircle2} title="Already acknowledged" body="Your team has already acknowledged this decision. Nothing more to do." />;

  const { teamId, decisionId } = r.payload;
  const brief = briefs.find((b) => b.teamId === teamId && b.decisionId === decisionId);
  if (!brief) return <Notice icon={AlertTriangle} title="Brief not found" body="There is no brief for this team and decision." />;
  const team = teams.find((t) => t.id === teamId)?.name ?? teamId;
  const decision = decisions.find((d) => d.id === decisionId)?.title ?? decisionId;
  const title = (id: string) => artifacts.find((a) => a.id === id)?.title ?? id;

  return (
    <main className={shell}>
      <header className="space-y-1">
        <p className="text-xs text-faint">Brief for {team}</p>
        <h1 className="text-xl font-semibold text-strong">{decision}</h1>
      </header>
      <ol className="space-y-3">
        {brief.claims.map((c, i) => (
          <li key={i} className="space-y-2 rounded-lg border border-hairline bg-surface p-4">
            <p className="text-strong">{c.text}</p>
            {c.sources.map((s, j) => (
              <blockquote key={j} className="border-l-2 border-hairline pl-3 text-xs text-body">
                &ldquo;{s.quote}&rdquo;
                <cite className="mt-0.5 block not-italic text-faint">{title(s.artifactId)}</cite>
              </blockquote>
            ))}
          </li>
        ))}
      </ol>
      <AckConfirm token={token} reply={reply} />
    </main>
  );
}

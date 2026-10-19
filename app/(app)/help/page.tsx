import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/card";

const FAQ: [string, string][] = [
  ["What is Ripple?", "Ripple is a company brain. It reads your contracts, tickets, chats and decisions, links them in a graph, and answers one question: when something changes, who is affected and who has not been told yet?"],
  ["What is the demo?", "The shared demo is a made-up company with a planned API v1 shutdown. It is read-only: you can look at everything, but nothing is sent and nothing is saved. Run Ripple yourself or sign in to act on your own changes."],
  ["How do I connect my tools?", "Open Connections in the sidebar. Pick Slack, GitHub or a file upload and follow the steps. Ripple reads what you allow and shows how fresh each source is."],
  ["Who can see what?", "Everyone sees who is affected and who has been told. The text of contracts, deals, customer revenue and similar details stays with the team that owns it, and it is hidden before any answer is written, including the Assistant's."],
  ["Can I run it myself?", "Yes. Ripple needs no account and no AI key to start: it works from cached answers. The README has the one-command Docker setup and the settings for real data."],
];

export default function HelpPage() {
  return (
    <>
      <PageHeader title="Help" subtitle="Short answers. For anything else, ask the Assistant on the home page." />
      <Card className="max-w-[760px]">
        <dl className="divide-y divide-hairline">
          {FAQ.map(([q, a]) => (
            <div key={q} className="py-4 first:pt-0 last:pb-0">
              <dt className="text-md font-medium text-strong">{q}</dt>
              <dd className="mt-1.5 text-md leading-relaxed text-body">{a}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </>
  );
}

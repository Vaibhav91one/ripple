import { ingest } from "@/lib/connectors/slack/ingest";

// Slack POSTs here; verify, ack in well under 3s, work happens on the slack-inbound queue.
export const POST = (req: Request) => ingest(req, "events");

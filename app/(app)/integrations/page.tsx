import Link from "next/link";
import { headers } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import { ChevronDown, ExternalLink, MessageSquare } from "lucide-react";
import { BrandIcon, type BrandName } from "@/components/brand/BrandIcon";
import { CopySnippet } from "@/components/integrations/CopySnippet";
import { ApiKeysPanel, type KeyRow } from "@/components/settings/ApiKeysPanel";
import { PageHeader } from "@/components/shell/PageHeader";
import { PageLoading } from "@/components/states/States";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { env } from "@/lib/env";
import { cursorDeeplink, mcpUrl, snippets, type Snippet } from "@/lib/integrations";
import { getContext } from "@/lib/server/context";
import { publicOrigin } from "@/lib/server/redirect";

// The /setup/* pages arrive with #240 (Slack) and #236 (GitHub). Flip to true when they merge so the cards link there.
const SETUP_LIVE = { slack: false, github: false };

type Client = { id: string; name: string; icon: BrandName | typeof MessageSquare; line: string; tag: string; steps: React.ReactNode[]; snippets?: Snippet[]; extra?: React.ReactNode };

const Steps = ({ steps }: { steps: React.ReactNode[] }) => (
  <ol className="space-y-2 text-sm text-body">
    {steps.map((s, i) => (
      <li key={i} className="flex gap-3">
        <span aria-hidden className="grid size-5 shrink-0 place-items-center rounded-full border border-hairline font-mono text-xs text-faint">{i + 1}</span>
        <span className="min-w-0">{s}</span>
      </li>
    ))}
  </ol>
);

const Kbd = ({ children }: { children: React.ReactNode }) => <span className="font-medium text-strong">{children}</span>;
const Code = ({ children }: { children: React.ReactNode }) => <code className="rounded-chip bg-raised px-1 py-0.5 font-mono text-xs text-strong">{children}</code>;

function clients(origin: string): Client[] {
  const s = snippets(origin);
  return [
    {
      id: "claude-code", name: "Claude Code", icon: "claudecode", tag: "Plugin + MCP",
      line: "Ask about a change from your terminal; the ripple-impact skill drafts the PR description and team briefs.",
      steps: [
        <>Install the plugin: it adds the hosted MCP server and the <Code>ripple-impact</Code> skill.</>,
        <>Or add only the MCP server. Without a key you get the read-only demo graph.</>,
        <>For your org, create a key below and export it as <Code>RIPPLE_API_KEY</Code>; the plugin and <Code>.mcp.json</Code> read it from the environment.</>,
      ],
      snippets: [...s.plugin, ...s.claudeCode],
    },
    {
      id: "claude-desktop", name: "Claude Desktop & claude.ai", icon: "claude", tag: "Custom connector",
      line: "Add Ripple as a custom connector, then upload the skill so Claude knows when to use it.",
      steps: [
        <>Open <Kbd>Customize › Connectors</Kbd>, press <Kbd>+</Kbd>, then <Kbd>Add custom connector</Kbd>.</>,
        <>Name it <Kbd>Ripple</Kbd> and paste the URL. Choose <Kbd>No sign in</Kbd> for the demo.</>,
        <>For your org, add the <Kbd>Authorization</Kbd> request header with your key.</>,
        <>Skill: zip the <Code>ripple-impact</Code> folder (the folder name must stay <Code>ripple-impact</Code>) and upload it under <Kbd>Customize › Skills › + › Upload a skill</Kbd>. Code execution must be on.</>,
      ],
      snippets: [...s.desktop, { label: "Zip the skill", lang: "shell", code: "cd ripple/skills && zip -r ripple-impact.zip ripple-impact" }],
    },
    {
      id: "codex", name: "Codex", icon: "codex", tag: "config.toml",
      line: "Point Codex at the MCP server; the key comes from RIPPLE_API_KEY, never the file.",
      steps: [
        <>Add the server to <Code>~/.codex/config.toml</Code>.</>,
        <>Export <Code>RIPPLE_API_KEY</Code> for your org, or leave it unset for the demo.</>,
        <>Codex picks up skills from <Code>.agents/skills/</Code>; this repo ships a copy of <Code>ripple-impact</Code> there.</>,
      ],
      snippets: s.codex,
    },
    {
      id: "cursor", name: "Cursor", icon: "cursor", tag: "One click",
      line: "Install in one click, or paste the JSON into mcp.json.",
      steps: [
        <>Press <Kbd>Add to Cursor</Kbd>. The link carries only the URL, never a key.</>,
        <>For your org, add the <Kbd>headers</Kbd> block to <Code>~/.cursor/mcp.json</Code>.</>,
      ],
      extra: (
        <a href={cursorDeeplink(origin)} className="inline-flex h-10 items-center gap-2 rounded-control bg-strong px-3.5 text-sm font-medium text-ink-on-strong hover:bg-body">
          <BrandIcon name="cursor" size={16} /> Add to Cursor
        </a>
      ),
      snippets: s.cursor,
    },
    {
      id: "chatgpt", name: "ChatGPT", icon: MessageSquare, tag: "Demo only",
      line: "Developer mode connectors can't send a static header, so ChatGPT reaches the public demo only.",
      steps: [
        <>Turn on <Kbd>Developer mode</Kbd> in ChatGPT settings, then create a connector.</>,
        <>Paste the URL and choose <Kbd>No authentication</Kbd>.</>,
      ],
      snippets: s.chatgpt,
    },
    {
      id: "slack", name: "Slack", icon: "slack", tag: SETUP_LIVE.slack ? "Slash command" : "Coming",
      line: "Type /ripple in any channel or mention @Ripple in a thread; Ripple answers in the thread with sources.",
      steps: [
        <>Install the Slack app from <Link href="/connections/slack" className="font-medium text-strong underline underline-offset-2">Connections › Slack</Link>.</>,
        <>Ask <Code>/ripple who wasn&apos;t told about the v1 sunset?</Code> or mention <Code>@Ripple</Code>.</>,
      ],
      extra: <SetupLink live={SETUP_LIVE.slack} href="/setup/slack" label="Slack setup" />,
    },
    {
      id: "github", name: "GitHub", icon: "github", tag: SETUP_LIVE.github ? "@mention" : "Coming",
      line: "Mention @ripple-company-brain on a pull request or issue and Ripple comments with the change's impact.",
      steps: [
        <>Connect the GitHub App from <Link href="/connections/github" className="font-medium text-strong underline underline-offset-2">Connections › GitHub</Link>.</>,
        <>Comment <Code>@ripple-company-brain what does this break?</Code> on a pull request.</>,
      ],
      extra: <SetupLink live={SETUP_LIVE.github} href="/setup/github" label="GitHub setup" />,
    },
  ];
}

function SetupLink({ live, href, label }: { live: boolean; href: string; label: string }) {
  return live ? (
    <Link href={href} className="inline-flex h-10 items-center gap-1.5 rounded-control border border-hairline bg-surface px-3.5 text-sm font-medium text-strong hover:bg-raised">{label} <ExternalLink size={14} aria-hidden className="text-faint" /></Link>
  ) : (
    <StatusPill tone="neutral">{label}: coming</StatusPill>
  );
}

function ClientCard({ c, open }: { c: Client; open?: boolean }) {
  const Icon = c.icon;
  return (
    <details id={c.id} open={open} className="group rounded-card border border-hairline bg-surface">
      <summary className="flex cursor-pointer list-none items-start gap-4 p-5 sm:p-6 [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-inset border border-hairline bg-surface text-strong">
          {typeof Icon === "string" ? <BrandIcon name={Icon} size={22} /> : <Icon size={20} className="text-body" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-medium leading-6 text-strong">{c.name}</span>
            <StatusPill tone="neutral">{c.tag}</StatusPill>
          </span>
          <span className="mt-0.5 block text-sm text-faint">{c.line}</span>
        </span>
        <ChevronDown size={18} aria-hidden className="shrink-0 text-faint group-open:rotate-180" />
      </summary>
      <div className="space-y-4 border-t border-hairline p-5 sm:p-6">
        <Steps steps={c.steps} />
        {c.extra}
        {c.snippets && <div className="grid gap-3">{c.snippets.map((sn) => <CopySnippet key={sn.label} {...sn} />)}</div>}
      </div>
    </details>
  );
}

const Note = ({ children }: { children: React.ReactNode }) => <p className="text-sm text-body">{children}</p>;

async function Keys() {
  const ctx = await getContext();
  if (ctx.viewer.kind !== "user")
    return <Note>This is the shared demo: its MCP endpoint is anonymous and read-only, so there are no keys to create. Self-host Ripple (local mode needs no accounts) to create keys that read your own graph as you.</Note>;
  if (ctx.viewer.role !== "admin") return <Note>Only org admins can manage API keys.</Note>;
  if (!env().DATABASE_URL) return <Note>Postgres isn&apos;t configured, so there are no API keys to manage.</Note>;
  const { listKeys } = await import("@/lib/api-keys");
  const rows: KeyRow[] = (await listKeys(ctx.org.id)).map((k) => ({
    id: k.id, name: k.name, prefix: k.prefix, createdAt: k.createdAt.toISOString(), revoked: !!k.revokedAt, lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
  }));
  return <ApiKeysPanel keys={rows} />;
}

async function Integrations() {
  await connection(); // per-request: the origin and viewer differ per visit
  const h = await headers();
  const origin = publicOrigin(new Request(`http://${h.get("host") ?? "localhost"}`, { headers: h }));
  const list = clients(origin);
  return (
    <>
      <PageHeader title="Integrations" subtitle={`Ripple shows up in ${list.length} places you already work. Every snippet below points at ${new URL(origin).host}.`} />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <div className="grid gap-4">{list.map((c) => <ClientCard key={c.id} c={c} />)}</div>
        <div className="grid gap-4 lg:sticky lg:top-6">
          <Card className="space-y-4">
            <CardHeader title="MCP endpoint" sub="Streamable HTTP, 12 tools" action={<BrandIcon name="mcp" size={20} className="text-body" />} />
            <CopySnippet label="URL" code={mcpUrl(origin)} />
            <p className="text-sm text-faint">Without a key it answers from the read-only demo graph. With a key it reads your org as the person who created it, with the same redactions.</p>
          </Card>
          <Card id="api-keys" className="space-y-4">
            <CardHeader title="API keys" sub="Bearer rpl_… keys, shown once, revocable" />
            <Suspense fallback={<PageLoading />}><Keys /></Suspense>
          </Card>
        </div>
      </div>
    </>
  );
}

export default function IntegrationsPage() {
  return <Suspense fallback={<PageLoading />}><Integrations /></Suspense>;
}

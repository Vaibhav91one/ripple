// Small talk and help (#268): recognised before any model call, so "hi" costs nothing and never shows a citation or warning.
// Only a whole message that IS small talk matches; "hi, who isn't told about v1?" is a real question and goes on to the agent.
// Client-safe: the chat route replies with it and the thread renders helpChips().
import type { Suggestion } from "../schemas";
import { STARTER_PROMPTS } from "./prompts";

export type TalkKind = "hello" | "how" | "thanks" | "bye" | "who" | "help" | "offtopic" | "link";
const GREET = "(?:hi|hello|hey|hiya|howdy|yo|sup|greetings|good (?:morning|afternoon|evening))";
const NAME = "(?: (?:there|ripple|team|everyone|all))?";
const PATTERNS: [TalkKind, RegExp][] = [
  ["how", new RegExp(`^(?:${GREET}${NAME} )?(?:how are you(?: doing)?|hows it going|how is it going|how do you do|whats up|what is up)(?: today)?${NAME}$`)],
  ["hello", new RegExp(`^${GREET}${NAME}$`)],
  ["thanks", new RegExp(`^(?:(?:ok|okay|great|cool|nice|perfect|awesome)? ?)(?:thanks|thank you|thx|ty|cheers|much appreciated|appreciate it)(?: (?:a lot|so much|very much|ripple|again))*$`)],
  ["bye", new RegExp(`^(?:bye|goodbye|good night|see you|see ya|cya|later|talk later)(?: (?:later|soon|ripple))?$`)],
  ["who", /^(?:who are you|what are you|what is ripple|introduce yourself|are you a bot|are you real)$/],
  ["help", /^(?:help|help me|menu|options|what can you do|what do you do|what can i ask(?: you| ripple)?|how does this work|how do i use this|how can you help|what are you good at)$/],
];
const norm = (s: string) => s.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

// Off-topic (#274): everyday questions Ripple has no data for. Only when nothing in the message sounds like the company.
const OFF = /\b(?:weather|forecast|temperature|raining|rain|snow|recipe|cook|joke|poem|song|lyrics|movie|horoscope|lottery|bitcoin|crypto|stock price|share price|football|soccer|cricket|nba|nfl|match score|who won|capital of|translate|time is it|what time|sports?)\b/;
const WORK = /\b(?:change|changes|team|teams|contract|customer|deal|ticket|api|sunset|launch|release|repo|pr|incident|ripple|told|affect|owner|system|service|company|our|we)\b/;
const URL_ONLY = /^\s*<?https?:\/\/\S+>?\s*$/i;

/** The small-talk kind of a whole message, or undefined when it is a real question. */
export function classify(text: string): TalkKind | undefined {
  if (URL_ONLY.test(text)) return "link"; // a pasted link alone: one reply, no model
  const t = norm(text);
  if (t.length <= 60) {
    const k = PATTERNS.find(([, re]) => re.test(t))?.[0];
    if (k) return k;
  }
  return t.length <= 160 && OFF.test(t) && !WORK.test(t) ? "offtopic" : undefined;
}

const CAN = "I can tell you who a change affects, which teams haven't been told, and whether it breaks a signed contract.";
const REPLIES: Record<TalkKind, string[]> = {
  hello: [
    `Hi! I'm Ripple. ${CAN} Pick something below or ask in your own words.`,
    `Hello! Good to see you. ${CAN} What would you like to look at?`,
    `Hey there. ${CAN} Where shall we start?`,
  ],
  how: [
    `Doing well, thanks for asking. ${CAN} What's on your mind?`,
    `All good here. ${CAN} Want to look at something?`,
  ],
  thanks: [
    "You're welcome. Anything else you'd like to check?",
    "Happy to help. Ask me about another change whenever you like.",
    "Any time. Want to look at something else?",
  ],
  bye: ["Bye for now. I'll keep an eye on things.", "See you soon. Come back whenever a change needs checking."],
  who: [
    `I'm Ripple. I follow every change at your company and tell you who it reaches. ${CAN}`,
    `I'm Ripple, the assistant that connects your company's changes, teams and contracts. ${CAN}`,
  ],
  help: [
    `Here's what I can do. ${CAN} I can also point you to the map of your company, the agents that help, and the tools you can connect.`,
    `Glad to help. ${CAN} Try one of these to start.`,
  ],
  offtopic: [
    "I only know about your company's changes, so I can't help with that one. Ask me who a change reaches, who hasn't been told, or what it breaks.",
    "That's outside what I know. I only follow your company's changes: who they reach, who hasn't been told and what they break.",
  ],
  link: [
    "I can't open links. If that page is about a change at your company, tell me in a sentence what is changing and I'll check who it reaches.",
  ],
};

/** A short, warm reply. `pick` chooses among the variants (random by default, fixed in tests). */
export function reply(kind: TalkKind, pick: (n: number) => number = (n) => Math.floor(Math.random() * n)): string {
  const r = REPLIES[kind];
  return r[pick(r.length)] ?? r[0];
}

/** What the org's own graph holds, for its starter chips (lib/assistant/home.ts reads it). */
export type HomeFacts = { changes: { id: string; title: string }[]; systems: { id: string; name: string }[]; conflicts: number };

const ask = (q: string): Suggestion => ({ label: q, prompt: q });
const SAMPLE_CHANGE = "d-1"; // the Ledgerly sample's change: its starters are the cached ones

/**
 * The one starter chip set (#274): the home screen and the chips after "hi" / "help" both come from here.
 * No facts (the public demo, or the org's graph has the Ledgerly sample) -> the starter prompts; an org -> its own latest
 * changes, conflicts and systems; an org with nothing yet -> no question chips (the UI shows onboarding instead).
 */
export function starterChips(f?: HomeFacts): Suggestion[] {
  if (!f || f.changes[0]?.id === SAMPLE_CHANGE) return STARTER_PROMPTS.map(ask);
  const [latest, next] = f.changes;
  const out: Suggestion[] = [];
  if (latest) out.push(ask(`What does ${latest.title} touch?`), { label: `Who hasn't been told about ${latest.title}?`, prompt: `Which teams have not been told about ${latest.title}?` });
  if (latest && f.conflicts) out.push({ label: "Any contract conflicts?", prompt: `Do any contracts conflict with ${latest.title}?` });
  if (next) out.push(ask(`What does ${next.title} touch?`));
  for (const s of f.systems.slice(0, 2)) out.push(ask(`Who knows ${s.name}?`));
  return out.slice(0, 5);
}

/** Onboarding links for an org with nothing in its graph yet. */
export const ONBOARD_CHIPS: Suggestion[] = [
  { label: "Connect GitHub", href: "/connections/github" },
  { label: "Connect Slack", href: "/connections/slack" },
  { label: "Import a CSV", href: "/connections/csv" },
];

/** The chips under a help reply: the same set as the home screen. */
export const helpChips = (f?: HomeFacts): Suggestion[] => {
  const c = starterChips(f);
  return c.length ? c : ONBOARD_CHIPS;
};

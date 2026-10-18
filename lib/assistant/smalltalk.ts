// Small talk and help (#268): recognised before any model call, so "hi" costs nothing and never shows a citation or warning.
// Only a whole message that IS small talk matches; "hi, who isn't told about v1?" is a real question and goes on to the agent.
// Client-safe: the chat route replies with it and the thread renders helpChips().
import type { Suggestion } from "../schemas";
import { STARTER_PROMPTS } from "./prompts";

export type TalkKind = "hello" | "how" | "thanks" | "bye" | "who" | "help";
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

/** The small-talk kind of a whole message, or undefined when it is a real question. */
export function classify(text: string): TalkKind | undefined {
  const t = norm(text);
  return t.length <= 60 ? PATTERNS.find(([, re]) => re.test(t))?.[0] : undefined;
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
};

/** A short, warm reply. `pick` chooses among the variants (random by default, fixed in tests). */
export function reply(kind: TalkKind, pick: (n: number) => number = (n) => Math.floor(Math.random() * n)): string {
  const r = REPLIES[kind];
  return r[pick(r.length)] ?? r[0];
}

/** The chips under a help reply. With the open changes (from /api/reports) they name the real latest change; without, the starter prompts. */
export function helpChips(cases: { id: string; title: string }[] = []): Suggestion[] {
  const [latest, ...more] = cases;
  const told = latest
    ? { label: `Who hasn't been told about ${latest.title}?`, prompt: latest.id === "d-1" ? STARTER_PROMPTS[2] : `Which teams have not been told about ${latest.title}?` }
    : { label: STARTER_PROMPTS[2], prompt: STARTER_PROMPTS[2] };
  return [
    ...(latest ? [{ label: `What does ${latest.title} touch?`, prompt: latest.id === "d-1" ? STARTER_PROMPTS[1] : `What does ${latest.title} touch?` }] : []),
    ...more.slice(0, 1).map((c) => ({ label: `What does ${c.title} touch?`, prompt: `What does ${c.title} touch?` })),
    told,
    { label: "Any contract conflicts?", prompt: STARTER_PROMPTS[3] },
    { label: "Show the graph", href: "/graph" },
    { label: "Meet the agents", href: "/agents" },
    { label: "Connect your tools", href: "/integrations" },
  ];
}

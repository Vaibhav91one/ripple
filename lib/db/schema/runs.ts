import { boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Per-org agent switch. No row = on. runBackground refuses a run when enabled is false.
export const agentSettings = pgTable(
  "agent_setting",
  { orgId: text("org_id").notNull(), agent: text("agent").notNull(), enabled: boolean("enabled").notNull().default(true) },
  (t) => [primaryKey({ columns: [t.orgId, t.agent] })],
);

export const RUN_STATUSES = ["queued", "running", "done", "failed", "budget"] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

// no FK to orgs: the run log outlives a deleted org (like audit_log and event)
export const agentRuns = pgTable(
  "agent_run",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id").notNull(),
    agent: text("agent").notNull(),
    trigger: text("trigger").notNull(),
    input: jsonb("input").notNull(),
    status: text("status", { enum: RUN_STATUSES }).notNull().default("queued"),
    output: jsonb("output"),
    tokens: integer("tokens").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    error: text("error"),
  },
  (t) => [index("agent_run_org_started_idx").on(t.orgId, t.startedAt)],
);

export const runSteps = pgTable(
  "run_step",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id").notNull().references(() => agentRuns.id, { onDelete: "cascade" }),
    n: integer("n").notNull(),
    kind: text("kind", { enum: ["tool", "text", "validation"] }).notNull(),
    tool: text("tool"),
    args: jsonb("args"),
    cypher: text("cypher").array().notNull().default([]),
    sourceIds: text("source_ids").array().notNull().default([]),
    tokens: integer("tokens").notNull().default(0),
    /** Execution trace of a tool call (#211): wall time and rows returned. */
    durationMs: integer("duration_ms"),
    rowCount: integer("row_count"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("run_step_run_idx").on(t.runId, t.n)],
);

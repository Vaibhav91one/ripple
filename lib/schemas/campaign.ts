import { z } from "zod";
import { id, ts } from "./common";

const at = ts.nullable();
/** One team's campaign for a change: ledger stages (earliest time over its people), Slack evidence, tasks and access. Slack never reports "read", so there is no such stage. */
export const CampaignTeam = z.object({
  teamId: id,
  ownerId: id.nullable(),
  dueAt: at,
  told: at,
  delivered: at,
  clicked: at,
  acked: at,
  /** The graph's own answer: the team is out of the gap (acknowledged, by any route). */
  covered: z.boolean(),
  discussed: z.array(z.object({ at: ts, permalink: z.string().nullable(), channelId: z.string() })),
  tasks: z.array(z.object({ id, title: z.string(), status: z.string(), dueAt: at })),
  access: z.object({ pending: z.number().int(), total: z.number().int() }),
});
export const Campaign = z.object({
  changeId: id,
  title: z.string(),
  kind: z.string(),
  status: z.string(),
  owner: id.nullable(),
  effectiveAt: at,
  /** Slack channel of the change (change_channel); `url` is null when the workspace link is unknown. */
  channel: z.object({ id: z.string(), url: z.string().nullable() }).nullable(),
  teams: z.array(CampaignTeam),
});
export type Campaign = z.infer<typeof Campaign>;
export type CampaignTeam = z.infer<typeof CampaignTeam>;


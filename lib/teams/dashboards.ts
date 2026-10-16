// Pure registry data (no graph code): the team ids and the payload union. Safe to import from the browser.
import { z } from "zod";
import { EngPayload } from "./eng/schema";
import { SupportPayload } from "./support/schema";
import { SalesPayload } from "./sales/schema";
import { LegalPayload } from "./legal/schema";
import { SecurityPayload } from "./security/schema";
import { DevRelPayload } from "./devrel/schema";
import { LeadershipPayload } from "./leadership/schema";

export const TEAM_IDS = ["eng", "support", "sales", "legal", "security", "devrel", "leadership"] as const;
export const TeamId = z.enum(TEAM_IDS);
export type TeamId = z.infer<typeof TeamId>;
export const TeamDashboard = z.discriminatedUnion("team", [EngPayload, SupportPayload, SalesPayload, LegalPayload, SecurityPayload, DevRelPayload, LeadershipPayload]);
export type TeamDashboard = z.infer<typeof TeamDashboard>;

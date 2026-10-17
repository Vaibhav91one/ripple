import { z } from "zod";

export const id = z.string().min(1);
export const ts = z.number().int(); // epoch seconds

/** What a viewer's redaction hid from a payload: `count` items of `kind` owned by team `owner` ("2 contracts - restricted to Legal"). `total` is the usd sum, given to leadership only. */
export const RestrictedSummary = z.object({
  kind: z.enum(["contract", "clause", "deal", "finding", "control", "source"]),
  owner: z.string(),
  count: z.number().int(),
  total: z.number().optional(),
});
export type RestrictedSummary = z.infer<typeof RestrictedSummary>;
/** Spread into a payload schema so the `restricted` list survives the client-side parse. */
export const restrictedField = { restricted: z.array(RestrictedSummary).optional() };

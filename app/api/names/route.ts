import { z } from "zod";
import { names } from "@/lib/graph/queries";
import { handle } from "@/lib/server/route";


/** id -> display name for every entity; the Changes screen labels edge ends with it. */
export const GET = () => handle(z.record(z.string(), z.string()), async (g) => (await names(g)).data);

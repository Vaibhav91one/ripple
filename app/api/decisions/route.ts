import { z } from "zod";
import { decisions } from "@/lib/graph/queries";
import { handle } from "@/lib/server/route";
import { Decision } from "@/lib/schemas";


export const GET = () => handle(z.array(Decision), async ({ graph }) => (await decisions(graph)).data);

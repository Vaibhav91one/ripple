import { z } from "zod";
import { people } from "@/lib/graph/queries";
import { handle } from "@/lib/server/route";
import { Person } from "@/lib/schemas";


export const GET = () => handle(z.array(Person), async ({ graph }) => (await people(graph)).data);

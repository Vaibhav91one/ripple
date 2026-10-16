import { z } from "zod";
import { bottleneck } from "@/lib/graph/queries";
import { handle } from "@/lib/server/route";
import { BottleneckRow } from "@/lib/schemas";


export const GET = () => handle(z.array(BottleneckRow), async (g, now) => (await bottleneck(g, now)).data);

import { z } from "zod";
import { bottleneck } from "@/lib/graph/queries";
import { handle } from "@/lib/server/route";
import { BottleneckRow } from "@/lib/schemas";


export const GET = () => handle(z.array(BottleneckRow), async ({ graph, now }) => (await bottleneck(graph, now)).data);

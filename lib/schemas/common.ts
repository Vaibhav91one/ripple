import { z } from "zod";

export const id = z.string().min(1);
export const ts = z.number().int(); // epoch seconds

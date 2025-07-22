import { z } from "zod";
import type { Binder } from "./binder.ts";

export const WALLET_BINDING_SCHEMA = [{
  name: "DECO_LIST_PRICES" as const,
  inputSchema: z.any(),
  outputSchema: z.object({
    prices: z.array(z.object({
      toolName: z.string(),
      cost: z.number(),
    })),
  }),
  opt: true,
}] as const satisfies Binder;
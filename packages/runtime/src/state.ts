import { AsyncLocalStorage } from "node:async_hooks";
import { z } from "zod/v3";
import type { AppContext } from "./mastra.ts";
import { createTool } from "./mastra.ts";

const asyncLocalStorage = new AsyncLocalStorage<AppContext | undefined>();

export const State = {
  getStore: () => {
    return asyncLocalStorage.getStore();
  },
  run: <TEnv, R, TArgs extends unknown[]>(
    ctx: AppContext<TEnv>,
    f: (...args: TArgs) => R,
    ...args: TArgs
  ): R => asyncLocalStorage.run(ctx, f, ...args),
};

export interface ValidationPayload {
  state: unknown;
}

export const createStateValidationTool = (stateSchema?: z.ZodTypeAny) => {
  return createTool({
    id: "DECO_CHAT_STATE_VALIDATION",
    description: "Validate the state of the OAuth flow",
    inputSchema: z.object({
      state: z.unknown(),
    }),
    outputSchema: z.object({
      valid: z.boolean(),
    }),
    execute: (ctx) => {
      if (!stateSchema) {
        return Promise.resolve({ valid: true });
      }
      const parsed = stateSchema.safeParse(ctx.context.state);
      return Promise.resolve({
        valid: parsed.success,
        reason: parsed.error?.message,
      });
    },
  });
};

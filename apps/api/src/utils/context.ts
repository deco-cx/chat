import type { EnvVars, Vars } from "@deco/sdk/mcp";
import type { Context } from "hono";
import type { TimingVariables } from "hono/timing";

export * from "@deco/sdk/mcp";

export type Bindings = EnvVars & {
  DECO_CHAT_APP_ORIGIN?: string;
  PROD_DISPATCHER: {
    get: <
      TOutbound extends Record<string, unknown> = Record<string, unknown>,
    >(
      script: string,
      ctx?: Record<string, unknown>,
      metadata?: { outbound?: TOutbound },
    ) => { fetch: typeof fetch };
  };
  KB_FILE_PROCESSOR?: { send: (message: any) => Promise<void> };
};

export type AppEnv = {
  Variables: Vars & TimingVariables;
  Bindings: Bindings;
};

export type HonoAppContext = Context<AppEnv>;

import { EnvVars, Vars } from "@deco/sdk/mcp";
import { Context } from "hono";
import type { TimingVariables } from "hono/timing";

export * from "@deco/sdk/mcp";

export type AppEnv = {
  Variables: Vars & TimingVariables;
  Bindings: EnvVars & {
    PROD_DISPATCHER: { get: (script: string) => { fetch: typeof fetch } };
  };
};

export type HonoAppContext = Context<AppEnv>;

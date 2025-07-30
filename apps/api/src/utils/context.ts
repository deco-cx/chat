import type { EnvVars, Vars } from "@deco/sdk/mcp";
import type { Context } from "hono";
import type { TimingVariables } from "hono/timing";
import { WorkspaceDatabase } from "../durable-objects/workspace-database";

export * from "@deco/sdk/mcp";

export type Bindings = EnvVars & {
  DECO_CHAT_APP_ORIGIN?: string;
  WORKSPACE_DB: DurableObjectNamespace<WorkspaceDatabase>;
  PROD_DISPATCHER: {
    get: <
      TOutbound extends Record<string, unknown> = Record<string, unknown>,
    >(
      script: string,
      ctx?: Record<string, unknown>,
      metadata?: { outbound?: TOutbound },
    ) => { fetch: typeof fetch };
  };
  KB_FILE_PROCESSOR?: Workflow;
};

export type AppEnv = {
  Variables: Vars & TimingVariables;
  Bindings: Bindings;
};

export type HonoAppContext = Context<AppEnv>;

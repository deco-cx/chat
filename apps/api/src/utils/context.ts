import { ActorConstructor, StubFactory } from "@deco/actors";
import { AIAgent, Trigger } from "@deco/ai/actors";
import { Client } from "@deco/sdk/storage";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.d.ts";
import { type User as SupaUser } from "@supabase/supabase-js";
import Cloudflare from "cloudflare";
import { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { env as honoEnv } from "hono/adapter";
import type { TimingVariables } from "hono/timing";
import { AsyncLocalStorage } from "node:async_hooks";
import { z } from "zod";
import { AuthorizationClient, PolicyClient } from "../auth/policy.ts";

export type AppEnv = {
  Variables: {
    db: Client;
    user: SupaUser;
    cf: Cloudflare;
    immutableRes?: boolean;
    policy: PolicyClient;
    authorization: AuthorizationClient;
    stub: <
      Constructor extends
        | ActorConstructor<Trigger>
        | ActorConstructor<AIAgent>,
    >(
      c: Constructor,
    ) => StubFactory<InstanceType<Constructor>>;
  } & TimingVariables;
  Bindings: {
    SUPABASE_URL: string;
    SUPABASE_SERVER_TOKEN: string;
    TURSO_GROUP_DATABASE_TOKEN: string;
    TURSO_ORGANIZATION: string;
    CF_ACCOUNT_ID: string;
    CF_API_TOKEN: string;
    CF_DISPATCH_NAMESPACE: string;
    PROD_DISPATCHER: { get: (script: string) => { fetch: typeof fetch } };
  };
};

export type AppContext = Context<AppEnv>;

const isErrorLike = (error: unknown): error is Error =>
  Boolean((error as Error)?.message);

export const serializeError = (error: unknown): string => {
  if (typeof error === "string") {
    return error;
  }

  if (isErrorLike(error)) {
    return error.message;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
};

export const getEnv = (ctx: AppContext) => {
  const {
    CF_DISPATCH_NAMESPACE,
    CF_ACCOUNT_ID,
    CF_API_TOKEN,
    VITE_USE_LOCAL_BACKEND,
    SUPABASE_URL,
    SUPABASE_SERVER_TOKEN,
    TURSO_GROUP_DATABASE_TOKEN,
    TURSO_ORGANIZATION,
    RESEND_API_KEY,
  } = honoEnv(ctx);

  if (
    typeof CF_ACCOUNT_ID !== "string" ||
    typeof SUPABASE_URL !== "string" ||
    typeof SUPABASE_SERVER_TOKEN !== "string" ||
    typeof CF_API_TOKEN !== "string" ||
    typeof CF_DISPATCH_NAMESPACE !== "string" ||
    typeof TURSO_GROUP_DATABASE_TOKEN !== "string" ||
    typeof TURSO_ORGANIZATION !== "string"
  ) {
    throw new Error("Missing environment variables");
  }

  return {
    CF_ACCOUNT_ID,
    CF_API_TOKEN,
    CF_DISPATCH_NAMESPACE,
    VITE_USE_LOCAL_BACKEND,
    SUPABASE_URL,
    SUPABASE_SERVER_TOKEN,
    TURSO_GROUP_DATABASE_TOKEN,
    TURSO_ORGANIZATION,
    RESEND_API_KEY,
  };
};

export const AUTH_URL = (ctx: AppContext) =>
  getEnv(ctx).VITE_USE_LOCAL_BACKEND === "true"
    ? "http://localhost:3001"
    : "https://api.deco.chat";

export const createAIHandler =
  // deno-lint-ignore no-explicit-any
  (cb: (...args: any[]) => Promise<any> | any) =>
  // deno-lint-ignore no-explicit-any
  async (...args: any[]): Promise<CallToolResult> => {
    try {
      const response = await cb(...args);

      return {
        isError: false,
        content: [{ type: "text", text: JSON.stringify(response) }],
      };
    } catch (error) {
      console.error(error);

      return {
        isError: true,
        content: [{ type: "text", text: serializeError(error) }],
      };
    }
  };

export const createApiHandler = <
  T extends z.ZodType = z.ZodType,
  R extends object | boolean = object,
>(definition: {
  name: string;
  description: string;
  schema: T;
  canAccess: (props: z.infer<T>, c: AppContext) => Promise<boolean> | boolean;
  handler: (props: z.infer<T>, c: AppContext) => Promise<R> | R;
}) => ({
  ...definition,
  handler: async (props: z.infer<T>): Promise<R> => {
    const context = State.getStore();

    // Check if canAccess function is provided and the user has access
    if (definition.canAccess) {
      const hasAccess = await definition.canAccess(props, context);
      if (!hasAccess) {
        throw new HTTPException(403, {
          message: `User cannot access this tool ${definition.name}`,
        });
      }
    }

    return definition.handler(props, context);
  },
});

export type ApiHandler = ReturnType<typeof createApiHandler>;

const asyncLocalStorage = new AsyncLocalStorage<AppContext>();

export const State = {
  getStore: () => {
    const store = asyncLocalStorage.getStore();

    if (!store) {
      throw new Error("Missing context, did you forget to call State.bind?");
    }

    return store;
  },
  run: <R, TArgs extends unknown[]>(
    ctx: AppContext,
    f: (...args: TArgs) => R,
    ...args: TArgs
  ): R => asyncLocalStorage.run(ctx, f, ...args),
};

// deno-lint-ignore-file no-explicit-any
import { ActorConstructor, StubFactory } from "@deco/actors";
import { AIAgent, Trigger } from "@deco/ai/actors";
import { Client } from "@deco/sdk/storage";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.d.ts";
import { type User as SupaUser } from "@supabase/supabase-js";
import Cloudflare from "cloudflare";
import { AsyncLocalStorage } from "node:async_hooks";
import { z } from "zod";

export interface Vars {
  workspace?: {
    root: string;
    slug: string;
    value: string;
  };
  cookie?: string;
  host?: string;
  db: Client;
  user: SupaUser;
  cf: Cloudflare;
  walletBinding?: { fetch: typeof fetch }
  immutableRes?: boolean;
  stub: <
    Constructor extends
      | ActorConstructor<Trigger>
      | ActorConstructor<AIAgent>,
  >(
    c: Constructor,
  ) => StubFactory<InstanceType<Constructor>>;
}

export interface EnvVars {
  OPENROUTER_API_KEY: string;
  VITE_USE_LOCAL_BACKEND: string;
  RESEND_API_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_SERVER_TOKEN: string;
  TURSO_GROUP_DATABASE_TOKEN: string;
  TURSO_ORGANIZATION: string;
  CF_ACCOUNT_ID: string;
  CF_API_TOKEN: string;
  CF_DISPATCH_NAMESPACE: string;
  WALLET_API_KEY: string;
  STRIPE_SECRET_KEY: string;
}

export type AppContext = Vars & { envVars: EnvVars };

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

const REQUIRED_LOCAL_ENV_VARS = [
  "OPENROUTER_API_KEY",
  "CF_ACCOUNT_ID",
  "SUPABASE_URL",
  "SUPABASE_SERVER_TOKEN",
  "CF_API_TOKEN",
  "CF_DISPATCH_NAMESPACE",
  "TURSO_GROUP_DATABASE_TOKEN",
  "TURSO_ORGANIZATION",
] as const;

export const getEnv = (ctx: AppContext) => {
  if (
    !REQUIRED_LOCAL_ENV_VARS.every((v) => typeof ctx.envVars[v] === "string")
  ) {
    const missing = REQUIRED_LOCAL_ENV_VARS.filter(
      (v) => typeof ctx.envVars[v] !== "string",
    );
    throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  }

  return ctx.envVars;
};

export const AUTH_URL = (ctx: AppContext) =>
  getEnv(ctx).VITE_USE_LOCAL_BACKEND === "true"
    ? "http://localhost:3001"
    : "https://api.deco.chat";

export const createAIHandler =
  (cb: (...args: any[]) => Promise<any> | any) =>
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

export interface ApiHandlerDefinition<
  TName extends string = string,
  T extends z.ZodType = z.ZodType,
  R extends object | boolean = object,
  THandler extends (props: z.infer<T>, c: AppContext) => Promise<R> | R = (
    props: z.infer<T>,
    c: AppContext,
  ) => Promise<R> | R,
> {
  name: TName;
  description: string;
  schema: T;
  handler: THandler;
}

export interface ApiHandler<
  TName extends string = string,
  T extends z.ZodType = z.ZodType,
  R extends object | boolean = object,
  THandler extends (props: z.infer<T>) => Promise<R> | R = (
    props: z.infer<T>,
  ) => Promise<R> | R,
> {
  name: TName;
  description: string;
  schema: T;
  handler: THandler;
}

export const createApiHandler = <
  TName extends string = string,
  T extends z.ZodType = z.ZodType,
  R extends object | boolean = object | boolean,
  THandler extends (props: z.infer<T>, c: AppContext) => Promise<R> | R = (
    props: z.infer<T>,
    c: AppContext,
  ) => Promise<R> | R,
>(
  definition: ApiHandlerDefinition<TName, T, R, THandler>,
): ApiHandler<
  TName,
  T,
  R,
  (props: Parameters<THandler>[0]) => ReturnType<THandler>
> => ({
  ...definition,
  handler: (props: Parameters<THandler>[0]): ReturnType<THandler> =>
    definition.handler(props, State.getStore()) as ReturnType<THandler>,
});

export type MCPDefinition = ApiHandler[];

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

export * from "./stub.ts";

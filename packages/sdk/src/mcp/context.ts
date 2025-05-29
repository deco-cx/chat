// deno-lint-ignore-file no-explicit-any
import { ActorConstructor, StubFactory } from "@deco/actors";
import { AIAgent, Trigger } from "@deco/ai/actors";
import { Client } from "@deco/sdk/storage";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.d.ts";
import { type User as SupaUser } from "@supabase/supabase-js";
import { S3Client } from "@aws-sdk/client-s3";
import Cloudflare from "cloudflare";
import { AsyncLocalStorage } from "node:async_hooks";
import { z } from "zod";
import { JWTPayload } from "../auth/jwt.ts";
import { AuthorizationClient, PolicyClient } from "../auth/policy.ts";
import { ForbiddenError, HttpError } from "../errors.ts";

export type UserPrincipal = Pick<SupaUser, "id" | "email" | "is_anonymous">;
export type AgentPrincipal = JWTPayload;
export type Principal =
  | UserPrincipal
  | AgentPrincipal;
export interface Vars {
  params: Record<string, string>;
  workspace?: {
    root: string;
    slug: string;
    value: string;
  };
  cookie?: string;
  db: Client;
  user: Principal;
  policy: PolicyClient;
  authorization: AuthorizationClient;
  isLocal?: boolean;
  cf: Cloudflare;
  walletBinding?: { fetch: typeof fetch };
  s3: S3Client;
  immutableRes?: boolean;
  stub: <
    Constructor extends
      | ActorConstructor<Trigger>
      | ActorConstructor<AIAgent>,
  >(
    c: Constructor,
  ) => StubFactory<InstanceType<Constructor>>;
}

export type EnvVars = z.infer<typeof envSchema>;
export type AppContext = Vars & {
  envVars: EnvVars;
};

const isErrorLike = (error: unknown): error is Error =>
  Boolean((error as Error)?.message);

const isHttpError = (error: unknown): error is HttpError =>
  Boolean((error as HttpError)?.code) && Boolean((error as HttpError)?.message);

export const serializeError = (error: unknown): Record<string, unknown> => {
  if (typeof error === "string") {
    return { message: error };
  }

  if (isHttpError(error)) {
    return {
      message: error.message,
      code: error.code,
    };
  }

  if (isErrorLike(error)) {
    return {
      message: error.message,
      stack: error.stack,
    };
  }

  try {
    return Object.fromEntries(Object.entries(error as Record<string, unknown>));
  } catch (e) {
    console.error(e);
    return { message: "Unknown error" };
  }
};

const envSchema = z.object({
  CF_DISPATCH_NAMESPACE: z.string().readonly(),
  CF_ACCOUNT_ID: z.string().readonly(),
  CF_API_TOKEN: z.string().readonly(),
  CF_R2_ACCESS_KEY_ID: z.any().optional().readonly(),
  CF_R2_SECRET_ACCESS_KEY: z.any().optional().readonly(),
  VITE_USE_LOCAL_BACKEND: z.any().optional().readonly(),
  SUPABASE_URL: z.string().readonly(),
  SUPABASE_SERVER_TOKEN: z.string().readonly(),
  ISSUER_JWT_SECRET: z.any().optional().readonly(),
  TURSO_GROUP_DATABASE_TOKEN: z.string().readonly(),
  TURSO_ORGANIZATION: z.string().readonly(),
  RESEND_API_KEY: z.any().optional().readonly(),
  OPENROUTER_API_KEY: z.string().readonly(),
  TURSO_ADMIN_TOKEN: z.any().optional().readonly(),
  OPENAI_API_KEY: z.any().optional().readonly(),
  LLMS_ENCRYPTION_KEY: z.any().optional().readonly(),

  /**
   * Only needed for locally testing wallet features.
   */
  WALLET_API_KEY: z.string().nullish(),
  STRIPE_SECRET_KEY: z.string().nullish(),
  STRIPE_WEBHOOK_SECRET: z.string().nullish(),
  CURRENCY_API_KEY: z.string().nullish(),
  TESTING_CUSTOMER_ID: z.string().nullish(),
});

export const getEnv = (ctx: AppContext): EnvVars =>
  envSchema.parse(ctx.envVars);

export const AUTH_URL = (ctx: AppContext) =>
  getEnv(ctx).VITE_USE_LOCAL_BACKEND === "true"
    ? "http://localhost:3001"
    : "https://api.deco.chat";

type ToolCallResult<T> = {
  structuredContent: T;
  isError: boolean;
};

export interface ToolDefinition<
  TAppContext extends AppContext = AppContext,
  TName extends string = string,
  TInput = any,
  TReturn extends object | null | boolean = object,
> {
  annotations?: ToolAnnotations;
  group?: string;
  name: TName;
  description: string;
  inputSchema: z.ZodType<TInput>;
  outputSchema?: z.ZodType<TReturn>;
  handler: (
    props: TInput,
    c: TAppContext,
  ) => Promise<TReturn> | TReturn;
  canAccess: (
    name: TName,
    props: TInput,
    c: AppContext,
  ) => Promise<boolean>;
}

export interface Tool<
  TName extends string = string,
  TInput = any,
  TReturn extends object | null | boolean = object,
> {
  annotations?: ToolAnnotations;
  group?: string;
  name: TName;
  description: string;
  inputSchema: z.ZodType<TInput>;
  outputSchema?: z.ZodType<TReturn>;
  handler: (
    props: TInput,
  ) => Promise<ToolCallResult<TReturn>> | ToolCallResult<TReturn>;
}

export const createToolFactory = <
  TAppContext extends AppContext = AppContext,
>(contextFactory: (c: AppContext) => TAppContext, group?: string) =>
<
  TName extends string = string,
  TInput = any,
  TReturn extends object | null | boolean = object,
>(
  def: ToolDefinition<TAppContext, TName, TInput, TReturn>,
): Tool<TName, TInput, TReturn> => ({
  group,
  ...def,
  handler: async (
    props: TInput,
  ): Promise<ToolCallResult<TReturn>> => {
    try {
      const context = contextFactory(State.getStore());

      const hasAccess = await def.canAccess?.(
        def.name,
        props,
        context,
      ).catch((error) => {
        console.warn(
          "Failed to authorize tool with the following error",
          error,
        );
        return false;
      });

      if (!hasAccess) {
        throw new ForbiddenError(
          `User cannot access this tool ${def.name}`,
        );
      }

      const structuredContent = await def.handler(props, context);

      return {
        isError: false,
        structuredContent,
      };
    } catch (error) {
      const structuredContent = serializeError(error) as unknown as TReturn;

      return {
        isError: true,
        structuredContent,
      };
    }
  },
});

export const createTool = createToolFactory<AppContext>((c) => c);

export type MCPDefinition = Tool[];

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

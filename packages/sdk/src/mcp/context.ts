// deno-lint-ignore-file no-explicit-any
import type { ActorConstructor, StubFactory } from "@deco/actors";
import type { AIAgent, Trigger } from "@deco/ai/actors";
import type { Client } from "@deco/sdk/storage";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.d.ts";
import type { User as SupaUser } from "@supabase/supabase-js";
import type Cloudflare from "cloudflare";
import { AsyncLocalStorage } from "node:async_hooks";
import { z } from "zod";
import type { JWTPayload } from "../auth/jwt.ts";
import type {
  AuthorizationClient,
  Policy,
  PolicyClient,
} from "../auth/policy.ts";
import { type WellKnownMcpGroup, WellKnownMcpGroups } from "../crud/groups.ts";
import { ForbiddenError, type HttpError } from "../errors.ts";
import type { WithTool } from "./assertions.ts";
import type { ResourceAccess } from "./auth/index.ts";
import { addGroup, type GroupIntegration } from "./groups.ts";
export type UserPrincipal = Pick<SupaUser, "id" | "email" | "is_anonymous">;

export interface JWTPrincipal extends JWTPayload {
  policies?: Pick<Policy, "statements">[];
}

export type Principal =
  | UserPrincipal
  | JWTPrincipal;
export interface Vars {
  params: Record<string, string>;
  workspace?: {
    root: string;
    slug: string;
    value: string;
  };
  resourceAccess: ResourceAccess;
  /** Current tool being executed definitions */
  tool?: { name: string };
  cookie?: string;
  token?: string;
  db: Client;
  user: Principal;
  policy: PolicyClient;
  authorization: AuthorizationClient;
  isLocal?: boolean;
  cf: Cloudflare;
  walletBinding?: { fetch: typeof fetch };
  immutableRes?: boolean;
  kbFileProcessor?: Workflow;
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

export const serializeError = (error: unknown): string => {
  if (typeof error === "string") {
    return error;
  }

  if (isHttpError(error) || isErrorLike(error)) {
    return error.toString();
  }

  try {
    return JSON.stringify(error, null, 2);
  } catch (e) {
    console.error(e);
    return "Unknown error";
  }
};

const envSchema = z.object({
  CF_DISPATCH_NAMESPACE: z.string().readonly(),
  CF_ACCOUNT_ID: z.string().readonly(),
  CF_API_TOKEN: z.string().readonly(),
  CF_ZONE_ID: z.string().optional().readonly(),
  CF_R2_ACCESS_KEY_ID: z.any().optional().readonly(),
  CF_R2_SECRET_ACCESS_KEY: z.any().optional().readonly(),
  VITE_USE_LOCAL_BACKEND: z.any().optional().readonly(),
  SUPABASE_URL: z.string().readonly(),
  SUPABASE_SERVER_TOKEN: z.string().readonly(),
  DECO_CHAT_API_JWT_PUBLIC_KEY: z.any().optional().readonly(),
  DECO_CHAT_API_JWT_PRIVATE_KEY: z.any().optional().readonly(),
  TURSO_GROUP_DATABASE_TOKEN: z.string().readonly(),
  TURSO_ORGANIZATION: z.string().readonly(),
  RESEND_API_KEY: z.any().optional().readonly(),
  OPENROUTER_API_KEY: z.string().readonly(),
  TURSO_ADMIN_TOKEN: z.any().optional().readonly(),
  OPENAI_API_KEY: z.any().optional().readonly(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional().readonly(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional().readonly(),
  WHATSAPP_API_VERSION: z.string().optional().readonly(),
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

type ToolCallResultSuccess<T> = {
  isError: false;
  structuredContent: T;
};

type ToolCallResultError = {
  isError: true;
  content: { type: "text"; text: string }[];
};

type ToolCallResult<T> = ToolCallResultSuccess<T> | ToolCallResultError;

export const isToolCallResultError = <T>(
  result: ToolCallResult<T>,
): result is ToolCallResultError => result.isError;

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
  handler: (props: TInput, c: TAppContext) => Promise<TReturn> | TReturn;
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
  ) => Promise<TReturn> | TReturn;
}

export const createToolGroup = (
  group: WellKnownMcpGroup,
  integration: GroupIntegration,
) =>
  createToolFactory<WithTool<AppContext>>(
    (c) => c as unknown as WithTool<AppContext>,
    WellKnownMcpGroups[group],
    integration,
  );

export const withMCPErrorHandling = <
  TInput = any,
  TReturn extends object | null | boolean = object,
>(f: (props: TInput) => Promise<TReturn>) =>
async (props: TInput) => {
  try {
    const result = await f(props);

    return {
      isError: false,
      structuredContent: result,
    };
  } catch (error) {
    return {
      isError: true,
      content: [{ type: "text", text: serializeError(error) }],
    };
  }
};

export const createToolFactory = <
  TAppContext extends AppContext = AppContext,
>(
  contextFactory: (c: AppContext) => TAppContext,
  group?: string,
  integration?: GroupIntegration,
) =>
<
  TName extends string = string,
  TInput = any,
  TReturn extends object | null | boolean = object,
>(
  def: ToolDefinition<TAppContext, TName, TInput, TReturn>,
): Tool<TName, TInput, TReturn> => {
  group && integration && addGroup(group, integration);
  return {
    group,
    ...def,
    handler: async (props: TInput): Promise<TReturn> => {
      const context = contextFactory(State.getStore());
      context.tool = { name: def.name };

      const result = await def.handler(props, context);

      if (!context.resourceAccess.granted()) {
        console.warn(
          `User cannot access this tool ${def.name}. Did you forget to call ctx.authTools.setAccess(true)?`,
        );
        throw new ForbiddenError(
          `User cannot access this tool ${def.name}.`,
        );
      }

      return result;
    },
  };
};

export const createTool = createToolFactory<WithTool<AppContext>>(
  (c) => c as unknown as WithTool<AppContext>,
);

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

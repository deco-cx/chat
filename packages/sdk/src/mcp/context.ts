// deno-lint-ignore-file no-explicit-any
import type { ActorConstructor, StubFactory } from "@deco/actors";
import type { AIAgent, Trigger } from "@deco/ai/actors";
import type { Client } from "@deco/sdk/storage";
import { createClient } from "@libsql/client/web";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.d.ts";
import * as api from "@opentelemetry/api";
import { createServerClient } from "@supabase/ssr";
import type { User as SupaUser } from "@supabase/supabase-js";
import { Cloudflare } from "cloudflare";
import { AsyncLocalStorage } from "node:async_hooks";
import { z } from "zod/v3";
import { stubFor } from "../actors/index.ts";
import { JwtIssuer, JWTPayload } from "../auth/jwt.ts";
import { AuthorizationClient, Policy, PolicyClient } from "../auth/policy.ts";
import { SUPABASE_URL } from "../constants.ts";
import { type WellKnownMcpGroup, WellKnownMcpGroups } from "../crud/groups.ts";
import { ForbiddenError, type HttpError } from "../errors.ts";
import { lazy } from "../lazy.ts";
import { ProjectLocator } from "../locator.ts";
import { trace } from "../observability/index.ts";
import { createPosthogServerClient, PosthogServerClient } from "../posthog.ts";
import { WorkflowRunnerProps } from "../workflows/workflow-runner.ts";
import { type WithTool } from "./assertions.ts";
import { type ResourceAccess } from "./auth/index.ts";
import { DatatabasesRunSqlInput, QueryResult } from "./databases/api.ts";
import { Blobs } from "./deconfig/blobs.ts";
import { Branch } from "./deconfig/branch.ts";
import { addGroup, type GroupIntegration } from "./groups.ts";
import { generateUUIDv5, toAlphanumericId } from "./slugify.ts";
import {
  drizzle as drizzlePostgres,
  PostgresJsDatabase,
} from "drizzle-orm/postgres-js";
import postgres from "postgres";

export type UserPrincipal = Pick<SupaUser, "id" | "email" | "is_anonymous">;

export interface JWTPrincipal extends JWTPayload {
  policies?: Pick<Policy, "statements">[];
}

export type Principal = UserPrincipal | JWTPrincipal;

const TURSO_GROUP = "deco-agents-v2";

const createSQLClientFor = async (
  workspace: string,
  organization: string,
  authToken: string,
) => {
  const memoryId = toAlphanumericId(`${workspace}/default`);
  const uniqueDbName = await generateUUIDv5(`${memoryId}-${TURSO_GROUP}`);

  return createClient({
    url: `libsql://${uniqueDbName}-${organization}.turso.io`,
    authToken: authToken,
  });
};

export interface TursoOptions {
  type: "turso";
  TURSO_GROUP_DATABASE_TOKEN: string;
  TURSO_ORGANIZATION: string;
  workspace: string;
}

export interface SQLIteOptions {
  type: "sqlite";
  workspaceDO: WorkspaceDO;
  workspace: string;
}

const wrapIWorkspaceDB = (
  db: IWorkspaceDB,
  workspace?: string,
  turso?: boolean,
): IWorkspaceDB => {
  return {
    ...db,
    exec: ({ sql, params }) => {
      const tracer = trace.getTracer("db-sql-tracer");
      return tracer.startActiveSpan(
        "db-query",
        {
          attributes: {
            "db.sql.query": sql,
            workspace,
            turso,
          },
        },
        api.context.active(),
        async (span) => {
          try {
            return await db.exec({ sql, params });
          } finally {
            span.end();
          }
        },
      );
    },
  };
};

const createWorkspaceDB = async (
  options: Pick<AppContext, "workspaceDO"> & {
    user?: AppContext["user"];
    workspace: Pick<NonNullable<AppContext["workspace"]>, "value">;
    envVars: Pick<EnvVars, "TURSO_GROUP_DATABASE_TOKEN" | "TURSO_ORGANIZATION">;
  },
  turso?: boolean,
): Promise<IWorkspaceDB> => {
  const {
    workspace,
    workspaceDO,
    envVars: { TURSO_GROUP_DATABASE_TOKEN, TURSO_ORGANIZATION },
  } = options;
  const shouldUseSQLite = turso !== true;

  if (shouldUseSQLite) {
    const dbId =
      typeof options.user === "object" &&
      "integrationId" in options.user &&
      typeof options.user.integrationId === "string"
        ? options.user.integrationId
        : undefined;
    const uniqueDbName = dbId ? `${dbId}-${workspace.value}` : workspace.value;
    return workspaceDO.get(
      workspaceDO.idFromName(uniqueDbName),
    ) as IWorkspaceDB;
  }

  const client = await createSQLClientFor(
    workspace.value,
    TURSO_ORGANIZATION,
    TURSO_GROUP_DATABASE_TOKEN,
  );

  return {
    exec: async (args) => {
      const result = await client.execute({
        sql: args.sql,
        args: args.params,
      });

      return {
        result: [{ results: result.rows }],
        [Symbol.dispose]: () => {},
      };
    },
  };
};

export const workspaceDB = async (
  options: Pick<AppContext, "workspaceDO"> & {
    user?: AppContext["user"];
    workspace: Pick<NonNullable<AppContext["workspace"]>, "value">;
    envVars: Pick<EnvVars, "TURSO_GROUP_DATABASE_TOKEN" | "TURSO_ORGANIZATION">;
  },
  turso?: boolean,
): Promise<IWorkspaceDB> => {
  return wrapIWorkspaceDB(
    await createWorkspaceDB(options, turso),
    options.workspace.value,
    turso,
  );
};

export type IWorkspaceDBExecResult = { result: QueryResult[] } & Disposable;
export type IWorkspaceDBMeta = { size: number } & Disposable;
export interface IWorkspaceDB {
  meta?: () => Promise<IWorkspaceDBMeta> | IWorkspaceDBMeta;
  recovery?: (dt: Date) => Promise<Disposable>;
  exec: (
    args: DatatabasesRunSqlInput,
  ) => Promise<IWorkspaceDBExecResult> | IWorkspaceDBExecResult;
}

export type WorkspaceDO = DurableObjectNamespace<
  IWorkspaceDB & Rpc.DurableObjectBranded
>;

export interface PrincipalExecutionContext {
  params: Record<string, string>;
  /**
   * @deprecated Use locator instead
   */
  workspace?: {
    root: string;
    slug: string;
    value: string;
    branch: string;
  };
  locator?: {
    org: string;
    project: string;
    branch: string;
    value: ProjectLocator;
  };
  resourceAccess: ResourceAccess;
  /** Current tool being executed definitions */
  tool?: { name: string };
  cookie?: string;
  token?: string;
  proxyToken?: string;
  callerApp?: string;
  isLocal?: boolean;
  user: Principal;
}

export interface Vars extends PrincipalExecutionContext {
  db: Client;
  drizzle: PostgresJsDatabase;
  policy: PolicyClient;
  authorization: AuthorizationClient;
  cf: Cloudflare;
  walletBinding?: { fetch: typeof fetch };
  immutableRes?: boolean;
  kbFileProcessor?: Workflow;
  workspaceDO: WorkspaceDO;
  // DECONFIG DurableObjects
  branchDO: DurableObjectNamespace<Branch>;
  blobsDO: DurableObjectNamespace<Blobs>;
  workflowRunner: Workflow<WorkflowRunnerProps>;
  jwtIssuer: () => Promise<JwtIssuer>;
  posthog: PosthogServerClient;
  stub: <
    Constructor extends ActorConstructor<Trigger> | ActorConstructor<AIAgent>,
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
    return JSON.stringify(
      {
        message: error.message, // message and code era not enumerable
        code: "code" in error ? error.code : undefined,
        name: "name" in error ? error.name : undefined,
      },
      null,
      2,
    );
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
  DATABASE_URL: z.string().readonly(),
  DECO_CHAT_API_JWT_PUBLIC_KEY: z.any().optional().readonly(),
  DECO_CHAT_API_JWT_PRIVATE_KEY: z.any().optional().readonly(),
  TURSO_GROUP_DATABASE_TOKEN: z.string().readonly(),
  TURSO_ORGANIZATION: z.string().readonly(),
  RESEND_API_KEY: z.any().optional().readonly(),
  OPENROUTER_API_KEY: z.string().readonly(),
  TURSO_ADMIN_TOKEN: z.any().optional().readonly(),
  OPENAI_API_KEY: z.any().optional().readonly(),
  LLMS_ENCRYPTION_KEY: z.any().optional().readonly(),

  POSTHOG_API_KEY: z.string().optional().readonly(),
  POSTHOG_API_HOST: z.string().optional().readonly(),

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

export const DECO_CMS_API = (ctx: AppContext, isDecoChat: boolean) =>
  getEnv(ctx).VITE_USE_LOCAL_BACKEND === "true"
    ? "http://localhost:3001"
    : isDecoChat
      ? "https://api.deco.chat"
      : "https://api.decocms.com";

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
  handler: (props: TInput) => Promise<TReturn> | TReturn;
}

export function createToolGroup(
  group: WellKnownMcpGroup,
  integration: GroupIntegration,
) {
  return createToolFactory<WithTool<AppContext>>(
    (c) => c as unknown as WithTool<AppContext>,
    WellKnownMcpGroups[group],
    integration,
  );
}

type ToolName = string;
type GroupName = string;
export const resourceGroupMap = new Map<ToolName, GroupName | undefined>();

export function createToolFactory<TAppContext extends AppContext = AppContext>(
  contextFactory: (c: AppContext) => Promise<TAppContext> | TAppContext,
  group?: string,
  integration?: GroupIntegration,
  wrapHandler?: <TInput, TReturn>(
    handler: (props: TInput) => Promise<TReturn>,
  ) => (props: TInput) => Promise<TReturn>,
) {
  return <
    TName extends string = string,
    TInput = any,
    TReturn extends object | null | boolean = object,
  >(
    def: ToolDefinition<TAppContext, TName, TInput, TReturn>,
  ): Tool<TName, TInput, TReturn> => {
    wrapHandler ??= (handler) => handler;
    group && integration && addGroup(group, integration);
    resourceGroupMap.set(def.name, group);
    return {
      group,
      ...def,
      handler: wrapHandler(async (props: TInput): Promise<TReturn> => {
        const context = await contextFactory(State.getStore());
        context.tool = { name: def.name };

        const result = await def.handler(props, context);

        if (!context.resourceAccess.granted()) {
          console.warn(
            `User cannot access this tool ${def.name}. Did you forget to call ctx.authTools.setAccess(true)?`,
          );
          throw new ForbiddenError(`User cannot access this tool ${def.name}.`);
        }

        return result;
      }),
    };
  };
}

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

export type Bindings = EnvVars & {
  WALLET: Service;
  DECO_CHAT_APP_ORIGIN?: string;
  WORKSPACE_DB: DurableObjectNamespace<IWorkspaceDB & Rpc.DurableObjectBranded>;
  // DECONFIG DurableObjects
  BRANCH: DurableObjectNamespace<Branch>;
  BLOBS: DurableObjectNamespace<Blobs>;
  WORKFLOW_RUNNER: Workflow<WorkflowRunnerProps>;
  PROD_DISPATCHER: {
    get: <TOutbound extends Record<string, unknown> = Record<string, unknown>>(
      script: string,
      ctx?: Record<string, unknown>,
      metadata?: { outbound?: TOutbound },
    ) => { fetch: typeof fetch };
  };
  KB_FILE_PROCESSOR?: Workflow;
};
export type BindingsContext = Omit<AppContext, keyof PrincipalExecutionContext>;

export const toBindingsContext = (bindings: Bindings): BindingsContext => {
  const db = createServerClient(SUPABASE_URL, bindings.SUPABASE_SERVER_TOKEN, {
    cookies: { getAll: () => [] },
  });
  const policy = PolicyClient.getInstance(db);
  const authorization = new AuthorizationClient(policy);
  const sql = postgres(bindings.DATABASE_URL, {
    max: 5,
  });
  const drizzle = drizzlePostgres(sql);

  return {
    drizzle,
    blobsDO: bindings.BLOBS,
    branchDO: bindings.BRANCH,
    envVars: bindings,
    workflowRunner: bindings.WORKFLOW_RUNNER,
    workspaceDO: bindings.WORKSPACE_DB,
    kbFileProcessor: bindings.KB_FILE_PROCESSOR,
    walletBinding: bindings.WALLET,
    policy,
    authorization,
    db,
    cf: new Cloudflare({ apiToken: bindings.CF_API_TOKEN }),
    posthog: createPosthogServerClient({
      apiKey: bindings.POSTHOG_API_KEY,
      apiHost: bindings.POSTHOG_API_HOST,
    }),
    stub: stubFor(bindings),
    jwtIssuer: lazy(() => {
      const keyPair =
        bindings.DECO_CHAT_API_JWT_PRIVATE_KEY &&
        bindings.DECO_CHAT_API_JWT_PUBLIC_KEY
          ? {
              public: bindings.DECO_CHAT_API_JWT_PUBLIC_KEY,
              private: bindings.DECO_CHAT_API_JWT_PRIVATE_KEY,
            }
          : undefined;

      return JwtIssuer.forKeyPair(keyPair);
    }),
  };
};

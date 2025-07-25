// deno-lint-ignore-file no-explicit-any
import type { ExecutionContext } from "@cloudflare/workers-types";
import { decodeJwt } from "jose";
import type { z } from "zod";
import { getReqToken, handleAuthCallback, StateParser } from "./auth.ts";
import { createIntegrationBinding, workspaceClient } from "./bindings.ts";
import { DECO_MCP_CLIENT_HEADER } from "./client.ts";
import {
  createMCPServer,
  type CreateMCPServerOptions,
  MCPServer,
} from "./mastra.ts";
import { MCPClient, type QueryResult } from "./mcp.ts";
import type { WorkflowDO } from "./workflow.ts";
import { Workflow } from "./workflow.ts";
import type { Binding, MCPBinding } from "./wrangler.ts";
import { State } from "./state.ts";
export {
  createMCPFetchStub,
  type CreateStubAPIOptions,
  type ToolBinder,
} from "./mcp.ts";

export interface WorkspaceDB {
  query: (
    params: { sql: string; params: string[] },
  ) => Promise<{ result: QueryResult[] }>;
}

export interface DefaultEnv<TSchema extends z.ZodTypeAny = any> {
  DECO_CHAT_REQUEST_CONTEXT: RequestContext<TSchema>;
  DECO_CHAT_APP_NAME: string;
  DECO_CHAT_APP_SLUG: string;
  DECO_CHAT_APP_ENTRYPOINT: string;
  DECO_CHAT_API_URL?: string;
  DECO_CHAT_WORKSPACE: string;
  DECO_CHAT_API_JWT_PUBLIC_KEY: string;
  DECO_CHAT_APP_DEPLOYMENT_ID: string;
  DECO_CHAT_BINDINGS: string;
  DECO_CHAT_API_TOKEN: string;
  DECO_CHAT_WORKFLOW_DO: DurableObjectNamespace<WorkflowDO>;
  DECO_CHAT_WORKSPACE_DB: WorkspaceDB & {
    forContext: (ctx: RequestContext) => WorkspaceDB;
  };
  [key: string]: unknown;
}

export interface BindingsObject {
  bindings?: Binding[];
}

export const WorkersMCPBindings = {
  parse: (bindings?: string): Binding[] => {
    if (!bindings) return [];
    try {
      return JSON.parse(atob(bindings)) as Binding[];
    } catch {
      return [];
    }
  },
  stringify: (bindings: Binding[]): string => {
    return btoa(JSON.stringify(bindings));
  },
};

export interface UserDefaultExport<
  TUserEnv = Record<string, unknown>,
  TSchema extends z.ZodTypeAny = never,
  TEnv = TUserEnv & DefaultEnv<TSchema>,
> extends CreateMCPServerOptions<TEnv, TSchema> {
  fetch?: (
    req: Request,
    env: TEnv,
    ctx: ExecutionContext,
  ) => Promise<Response> | Response;
}

// 1. Map binding type to its interface
interface BindingTypeMap {
  mcp: MCPBinding;
}

export interface User {
  id: string;
  email: string;
  workspace: string;
  user_metadata: {
    avatar_url: string;
    full_name: string;
    picture: string;
    [key: string]: unknown;
  };
}

export interface RequestContext<
  TSchema extends z.ZodTypeAny = any,
> {
  state: z.infer<TSchema>;
  token: string;
  workspace: string;
  ensureAuthenticated: (
    options?: { workspaceHint?: string },
  ) => User | undefined;
}

// 2. Map binding type to its creator function
type CreatorByType = {
  [K in keyof BindingTypeMap]: (
    value: BindingTypeMap[K],
    env: DefaultEnv,
  ) => unknown;
};

// 3. Strongly type creatorByType
const creatorByType: CreatorByType = {
  mcp: createIntegrationBinding,
};

const withDefaultBindings = (
  env: DefaultEnv,
  server: MCPServer<any, any>,
  ctx: RequestContext,
) => {
  const client = workspaceClient(ctx);
  const createWorkspaceDB = (ctx: RequestContext): WorkspaceDB => {
    const client = workspaceClient(ctx);
    return {
      query: ({ sql, params }) => {
        return client.DATABASES_RUN_SQL({
          sql,
          params,
        });
      },
    };
  };
  env["SELF"] = new Proxy({}, {
    get: (_, prop) => {
      return async (args: unknown) => {
        return await server.callTool({
          toolCallId: prop as string,
          toolCallInput: args,
        });
      };
    },
  });
  env["DECO_CHAT_API"] = MCPClient;
  env["DECO_CHAT_WORKSPACE_API"] = client;
  env["DECO_CHAT_WORKSPACE_DB"] = {
    ...createWorkspaceDB(ctx),
    forContext: createWorkspaceDB,
  };
};

export class UnauthorizedError extends Error {
  constructor(message: string, public redirectTo: URL) {
    super(message);
    this.name = "UnauthorizedError";
  }
}

const AUTH_CALLBACK_ENDPOINT = "/oauth/callback";
const AUTH_START_ENDPOINT = "/oauth/start";
const AUTHENTICATED = (user?: unknown, workspace?: string) => () => {
  return {
    ...((user as User) ?? {}),
    workspace,
  } as User;
};

export const withBindings = <TEnv>(
  _env: TEnv,
  server: MCPServer<TEnv, any>,
  tokenOrContext?: string | RequestContext,
): TEnv => {
  const env = _env as DefaultEnv<any>;

  let context;
  if (typeof tokenOrContext === "string") {
    const decoded = decodeJwt(tokenOrContext);
    const workspace = decoded.aud as string;
    context = {
      state: decoded.state as Record<string, unknown>,
      token: tokenOrContext,
      workspace,
      ensureAuthenticated: AUTHENTICATED(decoded.user, workspace),
    } as RequestContext<any>;
  } else if (typeof tokenOrContext === "object") {
    context = tokenOrContext;
    const decoded = decodeJwt(tokenOrContext.token);
    const workspace = decoded.aud as string;
    context.ensureAuthenticated = AUTHENTICATED(decoded.user, workspace);
  } else {
    context = {
      state: undefined,
      token: env.DECO_CHAT_API_TOKEN,
      workspace: env.DECO_CHAT_WORKSPACE,
      ensureAuthenticated: (options?: { workspaceHint?: string }) => {
        const workspaceHint = options?.workspaceHint ?? env.DECO_CHAT_WORKSPACE;
        const authUri = new URL(
          "/apps/oauth",
          env.DECO_CHAT_API_URL ?? "https://api.deco.chat",
        );
        authUri.searchParams.set("client_id", env.DECO_CHAT_APP_NAME);
        authUri.searchParams.set(
          "redirect_uri",
          `${env.DECO_CHAT_APP_ENTRYPOINT}${AUTH_CALLBACK_ENDPOINT}`,
        );
        workspaceHint &&
          authUri.searchParams.set("workspace_hint", workspaceHint);
        throw new UnauthorizedError("Unauthorized", authUri);
      },
    };
  }

  env.DECO_CHAT_REQUEST_CONTEXT = context;
  const bindings = WorkersMCPBindings.parse(env.DECO_CHAT_BINDINGS);

  for (const binding of bindings) {
    env[binding.name] = creatorByType[binding.type](
      binding as any,
      env,
    );
  }

  withDefaultBindings(env, server, env.DECO_CHAT_REQUEST_CONTEXT);

  return env as TEnv;
};

export const withRuntime = <TEnv, TSchema extends z.ZodTypeAny = never>(
  userFns: UserDefaultExport<TEnv, TSchema>,
): UserDefaultExport<TEnv, TSchema> & {
  Workflow: ReturnType<typeof Workflow>;
} => {
  const server = createMCPServer<TEnv, TSchema>(userFns);
  const fetcher = async (
    req: Request,
    env: TEnv & DefaultEnv<TSchema>,
    ctx: ExecutionContext,
  ) => {
    const url = new URL(req.url);
    if (url.pathname === AUTH_CALLBACK_ENDPOINT) {
      return handleAuthCallback(req, {
        apiUrl: env.DECO_CHAT_API_URL,
        appName: env.DECO_CHAT_APP_NAME,
      });
    }
    if (url.pathname === AUTH_START_ENDPOINT) {
      env.DECO_CHAT_REQUEST_CONTEXT.ensureAuthenticated();
      const redirectTo = new URL(
        "/",
        url,
      );
      const next = url.searchParams.get("next");
      return Response.redirect(next ?? redirectTo, 302);
    }
    if (url.pathname === "/mcp") {
      return server.fetch(
        req,
        env,
        ctx,
      );
    }

    if (url.pathname.startsWith("/mcp/call-tool")) {
      const toolCallId = url.pathname.split("/").pop();
      if (!toolCallId) {
        return new Response("Not found", { status: 404 });
      }
      const toolCallInput = await req.json();
      const result = await server.callTool({
        toolCallId,
        toolCallInput,
      });

      return new Response(JSON.stringify(result), {
        headers: {
          "Content-Type": "application/json",
        },
      });
    }
    return userFns.fetch?.(
      req,
      env,
      ctx,
    ) ||
      new Response("Not found", { status: 404 });
  };
  return {
    Workflow: Workflow(server, userFns.workflows),
    fetch: async (
      req: Request,
      env: TEnv & DefaultEnv<TSchema>,
      ctx: ExecutionContext,
    ) => {
      try {
        const bindings = withBindings(env, server, getReqToken(req));
        return await State.run(
          { req, env: bindings, ctx },
          async () => await fetcher(req, bindings, ctx),
        );
      } catch (error) {
        if (error instanceof UnauthorizedError) {
          const referer = req.headers.get("referer");
          const isFetchRequest = req.headers.has(DECO_MCP_CLIENT_HEADER) ||
            req.headers.get("sec-fetch-mode") === "cors";
          if (!isFetchRequest) {
            const url = new URL(req.url);
            error.redirectTo.searchParams.set(
              "state",
              StateParser.stringify({
                next: url.searchParams.get("next") ?? referer ?? req.url,
              }),
            );
            return Response.redirect(error.redirectTo, 302);
          }
          return new Response(null, { status: 401 });
        }
        throw error;
      }
    },
  };
};

export { type Migration, type WranglerConfig } from "./wrangler.ts";

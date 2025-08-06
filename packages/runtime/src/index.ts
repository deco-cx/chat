// deno-lint-ignore-file no-explicit-any
import type { ExecutionContext } from "@cloudflare/workers-types";
import { decodeJwt, SignJWT } from "jose";
import type { z } from "zod";
import { getReqToken, handleAuthCallback, StateParser } from "./auth.ts";
import { createIntegrationBinding, workspaceClient } from "./bindings.ts";
import { DECO_MCP_CLIENT_HEADER } from "./client.ts";
import {
  createMCPServer,
  type CreateMCPServerOptions,
  MCPServer,
  type PricingCallback,
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
  query: (params: {
    sql: string;
    params: string[];
  }) => Promise<{ result: QueryResult[] }>;
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

export interface RequestContext<TSchema extends z.ZodTypeAny = any> {
  state: z.infer<TSchema>;
  token: string;
  workspace: string;
  ensureAuthenticated: (options?: {
    workspaceHint?: string;
  }) => User | undefined;
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
  env["SELF"] = new Proxy(
    {},
    {
      get: (_, prop) => {
        if (prop === "toJSON") {
          return null;
        }

        return async (args: unknown) => {
          return await server.callTool({
            toolCallId: prop as string,
            toolCallInput: args,
          });
        };
      },
    },
  );
  env["DECO_CHAT_API"] = MCPClient;
  env["DECO_CHAT_WORKSPACE_API"] = client;
  env["DECO_CHAT_WORKSPACE_DB"] = {
    ...createWorkspaceDB(ctx),
    forContext: createWorkspaceDB,
  };
};

export class UnauthorizedError extends Error {
  constructor(
    message: string,
    public redirectTo: URL,
  ) {
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

export const withBindings = <TEnv>({
  env: _env,
  server,
  tokenOrContext,
  origin,
}: {
  env: TEnv;
  server: MCPServer<TEnv, any>;
  tokenOrContext?: string | RequestContext;
  origin?: string | null;
}): TEnv => {
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
          new URL(
            AUTH_CALLBACK_ENDPOINT,
            origin ?? env.DECO_CHAT_APP_ENTRYPOINT,
          ).href,
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
    env[binding.name] = creatorByType[binding.type](binding as any, env);
  }

  withDefaultBindings(env, server, env.DECO_CHAT_REQUEST_CONTEXT);

  return env as TEnv;
};

/**
 * Generate a temporary callback token for pricing operations
 */
const generateCallbackToken = async (
  executionId: string | undefined, 
  workspaceId: string | undefined,
  apiUrl: string
): Promise<string> => {
  // Ensure we have valid values for the callback token
  if (!executionId) {
    executionId = crypto.randomUUID();
    console.log(`Generated fallback executionId: ${executionId}`);
  }
  
  if (!workspaceId) {
    workspaceId = "unknown-workspace";
    console.log(`Using fallback workspaceId: ${workspaceId}`);
  }

  const payload = {
    executionId,
    workspaceId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (5 * 60), // 5 minutes
    aud: "pricing:callback"
  };

  // Create a simple token that the API can decode
  // This is a placeholder - in production you'd use proper JWT signing
  return btoa(JSON.stringify(payload));
};

/**
 * Generate a scoped tool execution token
 */
const generateScopedToolToken = async (
  toolId: string,
  executionId: string,
  workspaceId: string,
  apiUrl: string
): Promise<string> => {
  const payload = {
    type: "scoped_tool_execution",
    toolId,
    executionId,
    workspaceId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (10 * 60), // 10 minutes for tool execution
    aud: "tool:execution"
  };

  return btoa(JSON.stringify(payload));
};

export const withRuntime = <TEnv, TSchema extends z.ZodTypeAny = never>(
  userFns: UserDefaultExport<TEnv, TSchema>,
): UserDefaultExport<TEnv, TSchema> & {
  Workflow: ReturnType<typeof Workflow>;
} => {
  const server = createMCPServer<TEnv, TSchema>(userFns);
  console.log({server, userFns})
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
      const redirectTo = new URL("/", url);
      const next = url.searchParams.get("next");
      return Response.redirect(next ?? redirectTo, 302);
    }

    if (url.pathname === "/tool/pre-authorize" && req.method === "POST") {
      try {
        // Ensure user is authenticated
        const user = env.DECO_CHAT_REQUEST_CONTEXT.ensureAuthenticated();
        const requestBody = await req.json() as { toolId?: string; estimatedCost?: number };
        const { toolId, estimatedCost } = requestBody;

        if (!toolId) {
          return new Response(JSON.stringify({ error: "toolId required" }), { 
            status: 400, 
            headers: { "Content-Type": "application/json" } 
          });
        }

        const executionId = crypto.randomUUID();
        const workspace = env.DECO_CHAT_REQUEST_CONTEXT?.workspace || env.DECO_CHAT_WORKSPACE;
        const apiUrl = env.DECO_CHAT_API_URL || "http://localhost:3001";

        // Create pre-authorization using workspace client
        const client = workspaceClient({
          workspace,
          token: env.DECO_CHAT_REQUEST_CONTEXT?.token || env.DECO_CHAT_API_TOKEN
        });

        try {
          // Create actual pre-authorization transaction
          // This would call the wallet API to reserve funds
          console.log(`Pre-authorizing ${estimatedCost || 10.00} for tool ${toolId}, execution ${executionId}`);
          
          // Generate scoped token that can ONLY execute this tool
          const scopedToken = await generateScopedToolToken(toolId, executionId, workspace, apiUrl);
          
          console.log(`Generated scoped token for tool ${toolId}`);

          return new Response(JSON.stringify({
            success: true,
            executionId,
            scopedToken,
            expiresIn: 600, // 10 minutes
            toolId,
            estimatedCost: estimatedCost || 10.00
          }), {
            headers: { "Content-Type": "application/json" }
          });

        } catch (preAuthError) {
          console.error(`Pre-authorization failed for tool ${toolId}:`, preAuthError);
          return new Response(JSON.stringify({ 
            error: "Failed to pre-authorize tool execution" 
          }), { 
            status: 402, 
            headers: { "Content-Type": "application/json" } 
          });
        }

      } catch (authError) {
        // User not authenticated - they need to sign up first
        const authUri = new URL("/apps/oauth", env.DECO_CHAT_API_URL ?? "https://api.deco.chat");
        authUri.searchParams.set("client_id", env.DECO_CHAT_APP_NAME);
        authUri.searchParams.set("redirect_uri", `${env.DECO_CHAT_APP_ENTRYPOINT}/oauth/callback`);
        authUri.searchParams.set("state", StateParser.stringify({ 
          next: `${env.DECO_CHAT_APP_ENTRYPOINT}/`,
          toolId: requestBody.toolId,
          authType: "tool_execution"
        }));
        
        // Add tool-specific parameters for better OAuth experience
        authUri.searchParams.set("tool_id", requestBody.toolId || "unknown");
        authUri.searchParams.set("auth_type", "tool_execution");

        console.log(`Pre-authorization requires authentication for tool ${requestBody.toolId}`);

        return new Response(JSON.stringify({
          error: "Authentication required",
          authUrl: authUri.href,
          toolId: requestBody.toolId
        }), {
          status: 401,
          headers: { "Content-Type": "application/json" }
        });
      }
    }
    if (url.pathname === "/mcp") {
      console.log({req, env, ctx})
      return server.fetch(req, env, ctx);
    }

    if (url.pathname.startsWith("/mcp/call-tool")) {
      console.log({url, req})
      const toolCallId = url.pathname.split("/").pop();
      if (!toolCallId) {
        return new Response("Not found", { status: 404 });
      }
      
      let toolCallInput = await req.json();
      
      // Check for scoped tool token in Authorization header
      const authHeader = req.headers.get("Authorization");
      let scopedTokenPayload = null;
      
      if (authHeader && authHeader.startsWith("Bearer ")) {
        try {
          const token = authHeader.replace("Bearer ", "");
          
          // JWT tokens have 3 parts separated by dots: header.payload.signature
          let payload;
          const parts = token.split('.');
          if (parts.length === 3) {
            // This is a JWT token - decode the payload (middle part)
            payload = JSON.parse(atob(parts[1]));
          } else {
            // Try old format for backwards compatibility
            payload = JSON.parse(atob(token));
          }
          
          // Validate it's a scoped tool token (check both old and new formats)
          const isOldFormat = payload.type === "scoped_tool_execution" && payload.aud === "tool:execution";
          const isNewFormat = payload.authType === "tool_execution" && payload.aud?.includes("tool_execution");
          
          if (isOldFormat || isNewFormat) {
            // Check if token is for this specific tool
            if (payload.toolId !== toolCallId) {
              return new Response(JSON.stringify({ 
                error: `Token is for tool '${payload.toolId}', cannot execute '${toolCallId}'` 
              }), { 
                status: 403, 
                headers: { "Content-Type": "application/json" } 
              });
            }
            
            // Check expiration
            if (payload.exp && Date.now() / 1000 > payload.exp) {
              return new Response(JSON.stringify({ 
                error: "Scoped token expired" 
              }), { 
                status: 401, 
                headers: { "Content-Type": "application/json" } 
              });
            }
            
            scopedTokenPayload = payload;
            console.log(`Valid scoped token for tool ${toolCallId}, execution: ${payload.executionId}`);
          }
        } catch (tokenError) {
          console.error("Invalid scoped token:", tokenError);
          return new Response(JSON.stringify({ 
            error: "Invalid scoped token" 
          }), { 
            status: 401, 
            headers: { "Content-Type": "application/json" } 
          });
        }
      }
      
      // If we have a scoped token, use its execution context
      if (scopedTokenPayload) {
        const { executionId, workspaceId } = scopedTokenPayload;
        const apiUrl = env.DECO_CHAT_API_URL || "http://localhost:3001";
        
        // Generate callback token for pricing operations using scoped token context
        const callbackToken = await generateCallbackToken(executionId, workspaceId, apiUrl);
        
        const pricingCallback: PricingCallback = {
          executionId,
          token: callbackToken,
          apiUrl
        };
        
        // Inject pricing callback with scoped token context
        toolCallInput = typeof toolCallInput === 'object' && toolCallInput !== null 
          ? { ...toolCallInput, _deco_pricing_callback: pricingCallback }
          : { _deco_pricing_callback: pricingCallback };
        
        console.log(`Using scoped token context for tool ${toolCallId}, execution: ${executionId}`);
      } else {
        // No scoped token provided - check if user has regular auth
        let isUserAuthenticated = false;
        try {
          // Try to get authenticated user - this will throw if not authenticated
          const user = env.DECO_CHAT_REQUEST_CONTEXT.ensureAuthenticated();
          isUserAuthenticated = true;
          console.log(`User authenticated for tool ${toolCallId}:`, user?.id);
        } catch (authError) {
          console.log(`User not authenticated for tool ${toolCallId}`);
          isUserAuthenticated = false;
        }
        
        if (!isUserAuthenticated) {
          // User not authenticated - return 401 with auth URL for redirect
          const authUri = new URL("/apps/oauth", env.DECO_CHAT_API_URL ?? "https://api.deco.chat");
          authUri.searchParams.set("client_id", env.DECO_CHAT_APP_NAME);
          authUri.searchParams.set("redirect_uri", `${env.DECO_CHAT_APP_ENTRYPOINT}/oauth/callback`);
          authUri.searchParams.set("state", StateParser.stringify({ 
            next: `${env.DECO_CHAT_APP_ENTRYPOINT}/`,
            toolId: toolCallId,
            authType: "tool_execution"
          }));
          
          // Add tool-specific parameters for better OAuth experience
          authUri.searchParams.set("tool_id", toolCallId);
          authUri.searchParams.set("auth_type", "tool_execution");

          console.log(`Returning 401 for tool ${toolCallId}, auth URL:`, authUri.href);
          
          return new Response(JSON.stringify({
            error: "Authentication required",
            authUrl: authUri.href,
            toolId: toolCallId
          }), {
            status: 401,
            headers: { "Content-Type": "application/json" }
          });
        }
        
        // User is authenticated - set up pricing callback for potential billing
        try {
          const executionId = crypto.randomUUID();
          const apiUrl = env.DECO_CHAT_API_URL || "http://localhost:3001";
          const workspace = env.DECO_CHAT_REQUEST_CONTEXT?.workspace || env.DECO_CHAT_WORKSPACE;
          
          const callbackToken = await generateCallbackToken(executionId, workspace, apiUrl);
          
          const pricingCallback: PricingCallback = {
            executionId,
            token: callbackToken,
            apiUrl
          };
          
          toolCallInput = typeof toolCallInput === 'object' && toolCallInput !== null 
            ? { ...toolCallInput, _deco_pricing_callback: pricingCallback }
            : { _deco_pricing_callback: pricingCallback };
          
          console.log(`Using authenticated user for tool ${toolCallId}, execution: ${executionId}`);
          
        } catch (pricingError) {
          console.error(`Pricing setup failed for tool ${toolCallId}:`, pricingError);
          // Continue without pricing callback - tool can still execute
        }
      }
      
      // Execute the tool with proper context
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
    return (
      userFns.fetch?.(req, env, ctx) ||
      new Response("Not found", { status: 404 })
    );
  };
  return {
    Workflow: Workflow(server, userFns.workflows),
    fetch: async (
      req: Request,
      env: TEnv & DefaultEnv<TSchema>,
      ctx: ExecutionContext,
    ) => {
      const referer = req.headers.get("referer");
      const isFetchRequest =
        req.headers.has(DECO_MCP_CLIENT_HEADER) ||
        req.headers.get("sec-fetch-mode") === "cors";

      try {
        const bindings = withBindings({
          env,
          server,
          tokenOrContext: getReqToken(req),
          origin: referer ?? req.headers.get("origin"),
        });
        return await State.run(
          { req, env: bindings, ctx },
          async () => await fetcher(req, bindings, ctx),
        );
      } catch (error) {
        if (error instanceof UnauthorizedError) {
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

import { HttpServerTransport } from "@deco/mcp/http";
import {
  DECO_CHAT_WEB,
  IntegrationSchema,
  WELL_KNOWN_KNOWLEDGE_BASE_CONNECTION_ID_STARTSWITH,
  WellKnownMcpGroups,
} from "@deco/sdk";
import { DECO_CHAT_KEY_ID, getKeyPair } from "@deco/sdk/auth";
import {
  AGENT_TOOLS,
  assertHasWorkspace,
  assertPrincipalIsUser,
  assertWorkspaceResourceAccess,
  AuthorizationClient,
  createMCPToolsStub,
  EMAIL_TOOLS,
  getPresignedReadUrl_WITHOUT_CHECKING_AUTHORIZATION,
  getWorkspaceBucketName,
  GLOBAL_TOOLS,
  PolicyClient,
  type ToolLike,
  withMCPErrorHandling,
  WORKSPACE_TOOLS,
} from "@deco/sdk/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { type Context, Hono } from "hono";
import { env, getRuntimeKey } from "hono/adapter";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { endTime, startTime } from "hono/timing";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";
import { ROUTES as loginRoutes } from "./auth/index.ts";
import { withActorsStubMiddleware } from "./middlewares/actors-stub.ts";
import { withActorsMiddleware } from "./middlewares/actors.ts";
import { withContextMiddleware } from "./middlewares/context.ts";
import { setUserMiddleware } from "./middlewares/user.ts";
import { handleCodeExchange } from "./oauth/code.ts";
import { type AppContext, type AppEnv, State } from "./utils/context.ts";
import { handleStripeWebhook } from "./webhooks/stripe.ts";
import { handleTrigger } from "./webhooks/trigger.ts";
import { parseId } from "packages/sdk/src/mcp/integrations/api.ts";
import { getGroups } from "packages/sdk/src/mcp/groups.ts";
import { createServerClient } from "packages/sdk/src/mcp/utils.ts";
import { extractKnowledgeBaseIndexNameFromIntegrationId } from "packages/sdk/src/utils/knowledge.ts";

const workspaceAsserts = (appCtx: AppContext) => {
  assertPrincipalIsUser(appCtx);
  assertHasWorkspace(appCtx);
};

export const app = new Hono<AppEnv>();
export const honoCtxToAppCtx = (c: Context<AppEnv>): AppContext => {
  const envs = env(c);
  const slug = c.req.param("slug");
  const root = c.req.param("root");
  const workspace = `/${root}/${slug}`;

  const policyClient = PolicyClient.getInstance(c.var.db);
  const authorizationClient = new AuthorizationClient(policyClient);

  return {
    ...c.var,
    params: { ...c.req.query(), ...c.req.param() },
    envVars: envs,
    cookie: c.req.header("Cookie"),
    policy: policyClient,
    authorization: authorizationClient,
    token: c.req.header("Authorization")?.replace("Bearer ", ""),
    kbFileProcessor: c.env.KB_FILE_PROCESSOR,
    workspaceDO: c.env.WORKSPACE_DB,
    workspace: slug && root ? { root, slug, value: workspace } : undefined,
  };
};

const mapMCPErrorToHTTPExceptionOrThrow = (err: Error) => {
  if ("code" in err) {
    throw new HTTPException(
      (err.code as ContentfulStatusCode | undefined) ?? 500,
      { message: err.message ?? "Internal server error" },
    );
  }

  throw err;
};
/**
 * Creates and sets up an MCP server for the given tools
 */
const createMCPHandlerFor = (
  tools:
    | typeof GLOBAL_TOOLS
    | typeof WORKSPACE_TOOLS
    | typeof EMAIL_TOOLS
    | typeof AGENT_TOOLS,
) => {
  return async (c: Context) => {
    const group = c.req.query("group");

    const server = new McpServer(
      { name: "@deco/api", version: "1.0.0" },
      { capabilities: { tools: {} } },
    );

    for (const tool of tools) {
      if (group && tool.group !== group) {
        continue;
      }

      server.registerTool(
        tool.name,
        {
          annotations: tool.annotations,
          description: tool.description,
          inputSchema:
            "shape" in tool.inputSchema
              ? (tool.inputSchema.shape as z.ZodRawShape)
              : z.object({}).shape,
          outputSchema:
            tool.outputSchema &&
            typeof tool.outputSchema === "object" &&
            "shape" in tool.outputSchema
              ? (tool.outputSchema.shape as z.ZodRawShape)
              : z.object({}).shape,
        },
        // @ts-expect-error: zod shape is not typed
        withMCPErrorHandling(tool.handler),
      );
    }

    const transport = new HttpServerTransport();

    startTime(c, "mcp-connect");
    await server.connect(transport);
    endTime(c, "mcp-connect");

    startTime(c, "mcp-handle-message");
    const res = await State.run(
      honoCtxToAppCtx(c),
      transport.handleMessage.bind(transport),
      c.req.raw,
    );
    endTime(c, "mcp-handle-message");

    return res;
  };
};

/**
 * Setup a handler for handling tool calls. It's used so that
 * UIs can call the tools without suffering the serialization
 * of the protocol.
 */
const createToolCallHandlerFor = <
  TDefinition extends readonly ToolLike[] = readonly ToolLike[],
>(
  tools: TDefinition,
) => {
  const toolMap = new Map(tools.map((t) => [t.name, t]));

  return async (c: Context) => {
    const client = createMCPToolsStub({ tools });
    const tool = c.req.param("tool");
    const args = await c.req.json();

    const t = toolMap.get(tool as TDefinition[number]["name"]);
    if (!t) {
      throw new HTTPException(404, { message: "Tool not found" });
    }
    const { data, error } = t.inputSchema.safeParse(args);

    if (error || !data) {
      throw new HTTPException(400, {
        message: error?.message ?? "Invalid arguments",
      });
    }

    startTime(c, tool);
    const toolFn = client[tool as TDefinition[number]["name"]] as (
      args: z.ZodType<TDefinition[number]["inputSchema"]>,
    ) => Promise<z.ZodType<TDefinition[number]["outputSchema"]>>;

    const result = await State.run(
      honoCtxToAppCtx(c),
      (args) => toolFn(args),
      data,
    ).catch(mapMCPErrorToHTTPExceptionOrThrow);
    endTime(c, tool);

    return c.json({ data: result });
  };
};

const getIntegrationCallTool = async (
  c: Context,
  appCtx: AppContext,
  integrationId: string,
  tool: string,
  toolsMap: Map<string, ToolLike>,
) => {
  const { uuid, type } = parseId(integrationId);
  const groups = getGroups();

  let isKnowledgeBase = false;
  // handle knowledge_base tools
  if (
    type === "i" &&
    (groups[uuid] || "user-management" === uuid || "team-management" === uuid ||
      (isKnowledgeBase = integrationId.startsWith(
        WELL_KNOWN_KNOWLEDGE_BASE_CONNECTION_ID_STARTSWITH,
      )))
  ) {
    const t = toolsMap.get(tool);
    if (!t) {
      throw new HTTPException(404, { message: "Tool not found" });
    }

    startTime(c, tool);
    const client = createMCPToolsStub({ tools: [t] });
    const toolFn = client[tool as keyof typeof client];

    const callTool = async (args: z.ZodType<typeof t.inputSchema>) => {
      const { data, error } = t.inputSchema.safeParse(args);
      if (error || !data) {
        throw new HTTPException(400, {
          message: error?.message ?? "Invalid arguments",
        });
      }

      if (isKnowledgeBase) {
        const indexName = extractKnowledgeBaseIndexNameFromIntegrationId(
          integrationId,
        );
        if (indexName) {
          appCtx.params.name = indexName;
        }
      }

      const result = await State.run(
        appCtx,
        (args) => toolFn(args),
        data,
      ).catch(mapMCPErrorToHTTPExceptionOrThrow);
      endTime(c, tool);

      return result;
    };
    return callTool;
  }

  // TODO (@igorbrasileiro): add a webcache here
  const { data: connection } = await appCtx.db.from("deco_chat_integrations")
    .select("connection, name").eq("id", uuid).single();
  const { data: integration, error: integrationError } = IntegrationSchema.pick(
    { connection: true, name: true },
  ).safeParse(connection);

  if (!connection) {
    throw new HTTPException(400, { message: "Integration not found" });
  }
  if (integrationError) {
    throw new HTTPException(400, { message: "Invalid integration" });
  }

  const client = await createServerClient(integration);
  const callTool = async (
    args: Parameters<typeof client.callTool>[0]["arguments"] = {},
  ) => {
    try {
      const result = await client.callTool({
        name: tool,
        arguments: args || {},
      });

      return result.structuredContent;
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Unknown error",
      };
    } finally {
      await client.close();
    }
  };

  return callTool;
};

const crateCallIntegrationTool = (
  tools: typeof WORKSPACE_TOOLS | typeof GLOBAL_TOOLS,
  asserts?: (c: AppContext) => void,
) => {
  const toolMap = new Map(tools.map((t) => [t.name, t]));
  return async (c: Context) => {
    const integrationId = c.req.param("integrationId");
    const tool = c.req.param("tool");

    if (!integrationId) {
      throw new HTTPException(400, { message: "Invalid request" });
    }

    // auth
    const appCtx = honoCtxToAppCtx(c);
    asserts?.(appCtx);

    // TODO: add match integration on assert
    await assertWorkspaceResourceAccess(tool, appCtx);

    // get integration
    const callTool = await getIntegrationCallTool(
      c,
      appCtx,
      integrationId,
      tool,
      toolMap,
    );
    const args = await c.req.json();

    return c.json({ data: await callTool(args) });
  };
};

// Add logger middleware
app.use(logger());

// Enable CORS for all routes on api.deco.chat and localhost
app.use(
  cors({
    origin: (origin) => origin,
    maxAge: 86400, // one day
    allowMethods: ["HEAD", "GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "Cookie",
      "Accept",
      "cache-control",
      "pragma",
      "x-trace-debug-id",
      "x-deno-isolate-instance-id",
    ],
    exposeHeaders: [
      "Content-Type",
      "Authorization",
      "Set-Cookie",
      "x-trace-debug-id",
    ],
    credentials: true,
  }),
);

app.use(withContextMiddleware);
app.use(setUserMiddleware);
app.use(withActorsStubMiddleware);

// copy immutable responses to allow workerd to change its headers.
app.use(async (c, next) => {
  await next();

  if (c.var.immutableRes && getRuntimeKey() === "workerd") {
    c.res = new Response(c.res.body, c.res);
  }
});

app.use(withActorsMiddleware);

// MCP endpoint handlers
app.all("/mcp", createMCPHandlerFor(GLOBAL_TOOLS));
app.all("/:root/:slug/mcp", createMCPHandlerFor(WORKSPACE_TOOLS));
app.all("/:root/:slug/agents/:agentId/mcp", createMCPHandlerFor(AGENT_TOOLS));

// Tool call endpoint handlers
app.post("/tools/call/:tool", createToolCallHandlerFor(GLOBAL_TOOLS));
app.post(
  "/:integrationId/tools/call/:tool",
  crateCallIntegrationTool(GLOBAL_TOOLS, assertPrincipalIsUser),
);

app.post(
  "/:root/:slug/tools/call/:tool",
  createToolCallHandlerFor(WORKSPACE_TOOLS),
);

app.post(
  "/:root/:slug/:integrationId/tools/call/:tool",
  crateCallIntegrationTool(WORKSPACE_TOOLS, workspaceAsserts),
);

app.post(
  "/:root/:slug/tools/call/agents/:agentId/:tool",
  createToolCallHandlerFor(AGENT_TOOLS),
);

app.post(
  `/:root/:slug/${WellKnownMcpGroups.Email}/mcp`,
  createMCPHandlerFor(EMAIL_TOOLS),
);

app.post("/apps/code-exchange", handleCodeExchange);

app.post("/:root/:slug/triggers/:id", handleTrigger);

// Login and auth routes
Object.entries(loginRoutes).forEach(([route, honoApp]) => {
  app.route(route, honoApp);
});

app.get("/files/:root/:slug/:path{.+}", async (c) => {
  const root = c.req.param("root");
  const slug = c.req.param("slug");
  const filePath = c.req.param("path");

  if (!filePath) {
    throw new HTTPException(400, { message: "File path is required" });
  }

  const workspace = `/${root}/${slug}`;

  const appCtx = honoCtxToAppCtx(c);

  const bucketName = getWorkspaceBucketName(workspace);
  const url = await getPresignedReadUrl_WITHOUT_CHECKING_AUTHORIZATION({
    c: appCtx,
    existingBucketName: bucketName,
    path: filePath,
    expiresIn: 3600,
  });

  const response = await fetch(url);

  if (response.status === 404) {
    throw new HTTPException(404, { message: "File not found" });
  }

  if (response.status === 403) {
    throw new HTTPException(403, { message: "Forbidden" });
  }

  if (response.status === 401) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  if (!response.body) {
    throw new HTTPException(404, { message: "File not found" });
  }

  return c.body(response.body, 200, {
    "Content-Type":
      response.headers.get("content-type") || "application/octet-stream",
  });
});

const getPublicKey = async (): Promise<JsonWebKey> => {
  const [publicKey] = await getKeyPair();
  return publicKey;
};
app.get("/.well-known/jwks.json", async () => {
  return Response.json({
    keys: [{ ...(await getPublicKey()), kid: DECO_CHAT_KEY_ID }],
  });
});
// External webhooks
app.post("/webhooks/stripe", handleStripeWebhook);

// Apps oauth
app.get("/apps/oauth", (c) => {
  const url = new URL(c.req.raw.url);
  const target = new URL(DECO_CHAT_WEB);
  target.pathname = "/apps-auth";
  target.search = url.search;

  return c.redirect(target.href);
});

// Health check endpoint
app.get("/health", (c: Context) => c.json({ status: "ok" }));

app.onError((err, c) => {
  return c.json(
    { error: err?.message ?? "Internal server error" },
    err instanceof HTTPException ? err.status : 500,
  );
});

export default app;

import { HttpServerTransport } from "@deco/mcp/http";
import { createServerClient } from "@deco/ai/mcp";
import { DECO_CMS_WEB_URL, MCPConnection, WellKnownMcpGroups } from "@deco/sdk";
import { DECO_CHAT_KEY_ID, getKeyPair } from "@deco/sdk/auth";
import {
  AGENT_TOOLS,
  assertWorkspaceResourceAccess,
  AuthorizationClient,
  CallToolMiddleware,
  compose,
  CONTRACTS_TOOLS,
  createMCPToolsStub,
  EMAIL_TOOLS,
  getPresignedReadUrl_WITHOUT_CHECKING_AUTHORIZATION,
  getWorkspaceBucketName,
  GLOBAL_TOOLS,
  ListToolsMiddleware,
  PolicyClient,
  type ToolLike,
  withMCPAuthorization,
  withMCPErrorHandling,
  WORKSPACE_TOOLS,
  wrapToolFn,
  getIntegration,
  type IntegrationWithTools,
  getRegistryApp,
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
import {
  withActorsMiddleware,
  withActorsMiddlewareLegacy,
} from "./middlewares/actors.ts";
import { withContextMiddleware } from "./middlewares/context.ts";
import { setUserMiddleware } from "./middlewares/user.ts";
import { handleCodeExchange } from "./oauth/code.ts";
import { type AppContext, type AppEnv, State } from "./utils/context.ts";
import { handleStripeWebhook } from "./webhooks/stripe.ts";
import { handleTrigger } from "./webhooks/trigger.ts";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListToolsResult,
} from "@modelcontextprotocol/sdk/types.js";
import { createPosthogServerClient } from "packages/sdk/src/posthog.ts";
import { studio } from "outerbase-browsable-do-enforced";

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
    posthog: createPosthogServerClient({
      apiKey: envs.POSTHOG_API_KEY,
      apiHost: envs.POSTHOG_API_HOST,
    }),
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
    | typeof AGENT_TOOLS
    | typeof CONTRACTS_TOOLS,
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
        withMCPErrorHandling(tool.handler, tool.name),
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
    const ctx = honoCtxToAppCtx(c);
    const toolFn = wrapToolFn(
      client[tool as TDefinition[number]["name"]] as (
        args: z.ZodType<TDefinition[number]["inputSchema"]>,
      ) => Promise<z.ZodType<TDefinition[number]["outputSchema"]>>,
      tool,
      ctx?.workspace?.value,
    );

    const result = await State.run(ctx, (args) => toolFn(args), data).catch(
      mapMCPErrorToHTTPExceptionOrThrow,
    );
    endTime(c, tool);

    return c.json({ data: result });
  };
};

interface ProxyOptions {
  tools?: ListToolsResult | null;
  middlewares?: Partial<{
    listTools: ListToolsMiddleware[];
    callTool: CallToolMiddleware[];
  }>;
}

const proxy = (
  mcpConnection: MCPConnection,
  { middlewares, tools }: ProxyOptions = {},
) => {
  const createMcpClient = async () => {
    const client = await createServerClient({
      connection: mcpConnection,
      name: "proxy",
    });

    const listTools = compose(
      ...(middlewares?.listTools ?? []),
      async () =>
        tools ??
        ((await client.listTools()) as Awaited<
          ReturnType<ListToolsMiddleware>
        >),
    );

    const callTool = compose(
      ...(middlewares?.callTool ?? []),
      (req) => client.callTool(req.params) as ReturnType<CallToolMiddleware>,
    );

    return { listTools, callTool };
  };

  const fetch = async (req: Request) => {
    const { callTool, listTools } = await createMcpClient();
    const mcpServer = new McpServer(
      { name: "deco-chat-server", version: "1.0.0" },
      { capabilities: { tools: {} } },
    );
    const transport = new HttpServerTransport();

    await mcpServer.connect(transport);

    mcpServer.server.setRequestHandler(CallToolRequestSchema, (req) =>
      callTool(req),
    );
    mcpServer.server.setRequestHandler(ListToolsRequestSchema, (req) =>
      listTools(req),
    );

    return await transport.handleMessage(req);
  };

  return {
    fetch,
    callTool: async (
      ...args: Parameters<
        Awaited<ReturnType<typeof createMcpClient>>["callTool"]
      >
    ) => {
      const { callTool } = await createMcpClient();
      return callTool(...args);
    },
    listTools: async (
      ...args: Parameters<
        Awaited<ReturnType<typeof createMcpClient>>["listTools"]
      >
    ) => {
      const { listTools } = await createMcpClient();
      return listTools(...args);
    },
  };
};

const createMcpServerProxyForIntegration = async (
  c: Context,
  fetchIntegration: () => Promise<
    Pick<IntegrationWithTools, "connection" | "tools" | "id">
  >,
) => {
  const ctx = honoCtxToAppCtx(c);

  const integration = await fetchIntegration();

  const mcpServerProxy = proxy(integration.connection, {
    tools: integration.tools
      ? { tools: integration.tools as ListToolsResult["tools"] }
      : undefined,
    middlewares: {
      callTool: [withMCPAuthorization(ctx, { integrationId: integration.id })],
    },
  });

  return mcpServerProxy;
};

const createMcpServerProxyForAppName = (c: Context) => {
  const ctx = honoCtxToAppCtx(c);

  const appName = c.req.query("appName");
  const fetchIntegration = async () => {
    using _ = ctx.resourceAccess.grant();
    const integration = await State.run(ctx, () =>
      getRegistryApp.handler({ name: appName }),
    );

    return {
      ...integration,
      tools: integration.tools ?? [],
    };
  };

  return createMcpServerProxyForIntegration(c, fetchIntegration);
};
const createMcpServerProxy = (c: Context) => {
  const ctx = honoCtxToAppCtx(c);

  const integrationId = c.req.param("integrationId");
  const fetchIntegration = async () => {
    using _ = ctx.resourceAccess.grant();
    return await State.run(ctx, () =>
      getIntegration.handler({ id: integrationId }),
    );
  };

  return createMcpServerProxyForIntegration(c, () =>
    fetchIntegration().then((integration) => ({
      ...integration,
      id: integrationId,
    })),
  );
};

// Add logger middleware
app.use(logger());

// Enable CORS for all routes on api.decocms.com and localhost
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
      "mcp-protocol-version",
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
app.use(withActorsMiddlewareLegacy);

app.post(`/contracts/mcp`, createMCPHandlerFor(CONTRACTS_TOOLS));

app.all("/mcp", createMCPHandlerFor(GLOBAL_TOOLS));
app.all("/:root/:slug/mcp", createMCPHandlerFor(WORKSPACE_TOOLS));
app.all("/:root/:slug/agents/:agentId/mcp", createMCPHandlerFor(AGENT_TOOLS));

// Tool call endpoint handlers
app.post("/tools/call/:tool", createToolCallHandlerFor(GLOBAL_TOOLS));

app.post(
  "/:root/:slug/tools/call/:tool",
  createToolCallHandlerFor(WORKSPACE_TOOLS),
);

app.post(
  `/:root/:slug/${WellKnownMcpGroups.Email}/mcp`,
  createMCPHandlerFor(EMAIL_TOOLS),
);

app.post("/:root/:slug/:integrationId/mcp", async (c) => {
  const mcpServerProxy = await createMcpServerProxy(c);

  return mcpServerProxy.fetch(c.req.raw);
});

app.post("/apps/mcp", async (c) => {
  const mcpServerProxy = await createMcpServerProxyForAppName(c);

  return mcpServerProxy.fetch(c.req.raw);
});

app.post("/:root/:slug/:integrationId/tools/list", async (c) => {
  const mcpServerProxy = await createMcpServerProxy(c);

  return c.json(
    await mcpServerProxy.listTools({
      method: "tools/list" as const,
    }),
  );
});

app.all("/:root/:slug/i:databases-management/studio", async (c) => {
  const root = c.req.param("root");
  const slug = c.req.param("slug");
  const ctx = honoCtxToAppCtx(c);
  await assertWorkspaceResourceAccess(ctx, {
    resource: "DATABASES_RUN_SQL",
  });

  // The DO id can be overridden by the client, both on the URL
  // for GET requests and on the body "id" property for POST requests
  // i've forked the library to add the ability to enforce the id
  return studio(c.req.raw, ctx.workspaceDO, {
    disableHomepage: true,
    enforceId: `/${root}/${slug}`,
  });
});

app.post("/:root/:slug/:integrationId/tools/call/:tool", async (c) => {
  const mcpServerProxy = await createMcpServerProxy(c);
  const tool = c.req.param("tool");

  const callToolParam = {
    method: "tools/call" as const,
    params: {
      name: tool,
      arguments: await c.req.json(),
    },
  };

  return c.json(await mcpServerProxy.callTool(callToolParam));
});

app.post(
  "/:root/:slug/tools/call/agents/:agentId/:tool",
  createToolCallHandlerFor(AGENT_TOOLS),
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
  const target = new URL(DECO_CMS_WEB_URL);
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

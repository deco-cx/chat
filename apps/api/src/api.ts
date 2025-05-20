import { HttpServerTransport } from "@deco/mcp/http";
import { GLOBAL_TOOLS, HttpError, WORKSPACE_TOOLS } from "@deco/sdk/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Context, Hono } from "hono";
import { env, getRuntimeKey } from "hono/adapter";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { endTime, startTime } from "hono/timing";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ROUTES as loginRoutes } from "./auth/index.ts";
import { withActorsMiddleware } from "./middlewares/actors.ts";
import { withActorsStubMiddleware } from "./middlewares/actorsStub.ts";
import { withContextMiddleware } from "./middlewares/context.ts";
import { setUserMiddleware } from "./middlewares/user.ts";
import {
  ApiHandler,
  AppContext,
  AppEnv,
  createAIHandler,
  createMCPToolsStub,
  State,
} from "./utils/context.ts";
import { handleStripeWebhook } from "./webhooks/stripe.ts";

export const app = new Hono<AppEnv>();

export const honoCtxToAppCtx = (c: Context<AppEnv>): AppContext => {
  const envs = env(c);
  const slug = c.req.param("slug");
  const root = c.req.param("root");
  const workspace = `/${root}/${slug}`;

  return {
    ...c.var,
    envVars: envs,
    cookie: c.req.header("Cookie"),
    workspace: slug && root
      ? {
        root,
        slug,
        value: workspace,
      }
      : undefined,
  };
};

const mapMCPErrorToHTTPExceptionOrThrow = (err: Error) => {
  if (!(err instanceof HttpError)) {
    throw err;
  }

  throw new HTTPException(
    (err.code as ContentfulStatusCode | undefined) ?? 500,
    {
      message: err.message,
    },
  );
};
/**
 * Creates and sets up an MCP server for the given tools
 */
const createMCPHandlerFor = (
  tools: typeof GLOBAL_TOOLS | typeof WORKSPACE_TOOLS,
) => {
  const server = new McpServer(
    { name: "@deco/api", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );

  for (const tool of tools) {
    server.tool(
      tool.name,
      tool.description,
      tool.schema.shape,
      createAIHandler(tool.handler),
    );
  }

  return async (c: Context) => {
    const transport = new HttpServerTransport();

    startTime(c, "mcp-connect");
    await server.connect(transport);
    endTime(c, "mcp-connect");

    startTime(c, "mcp-handle-message");
    c.res = await State.run(
      honoCtxToAppCtx(c),
      transport.handleMessage.bind(transport),
      c.req.raw,
    ).catch(mapMCPErrorToHTTPExceptionOrThrow);
    endTime(c, "mcp-handle-message");

    return c.res;
  };
};

/**
 * Setup a handler for handling tool calls. It's used so that
 * UIs can call the tools without suffering the serialization
 * of the protocol.
 */
const createToolCallHandlerFor = (tools: readonly ApiHandler[]) => {
  const toolMap = new Map(tools.map((t) => [t.name, t]));

  return async (c: Context) => {
    const client = createMCPToolsStub({ tools });
    const tool = c.req.param("tool");
    const args = await c.req.json();

    const t = toolMap.get(tool);
    if (!t) {
      throw new HTTPException(404, { message: "Tool not found" });
    }
    const { data, error } = t.schema.safeParse(args);

    if (error || !data) {
      throw new HTTPException(400, {
        message: error?.message ?? "Invalid arguments",
      });
    }

    startTime(c, tool);
    const result = await State.run(
      honoCtxToAppCtx(c),
      (args) => client[tool](args),
      data,
    ).catch(mapMCPErrorToHTTPExceptionOrThrow);
    endTime(c, tool);

    return c.json({ data: result });
  };
};

// Add logger middleware
app.use(logger());

// Enable CORS for all routes on api.deco.chat and localhost
app.use(cors({
  origin: (origin) => origin,
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
}));

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
app.all(
  "/mcp",
  createMCPHandlerFor(GLOBAL_TOOLS),
);
app.all(
  "/:root/:slug/mcp",
  createMCPHandlerFor(WORKSPACE_TOOLS),
);

// Tool call endpoint handlers
app.post(
  "/tools/call/:tool",
  createToolCallHandlerFor(GLOBAL_TOOLS),
);
app.post(
  "/:root/:slug/tools/call/:tool",
  createToolCallHandlerFor(WORKSPACE_TOOLS),
);

// Login and auth routes
Object.entries(loginRoutes).forEach(([route, honoApp]) => {
  app.route(route, honoApp);
});

// External webhooks
app.post("/webhooks/stripe", handleStripeWebhook);

// Health check endpoint
app.get("/health", (c: Context) => c.json({ status: "ok" }));

app.onError((err, c) => {
  console.error(err);

  return c.json(
    { error: err?.message ?? "Internal server error" },
    err instanceof HTTPException ? err.status : 500,
  );
});

export default app;

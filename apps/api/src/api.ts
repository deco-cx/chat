import { HttpServerTransport } from "@deco/mcp/http";
import {
  AuthorizationClient,
  createMCPToolsStub,
  Entrypoint,
  GLOBAL_TOOLS,
  PolicyClient,
  type ToolLike,
  withMCPErrorHandling,
  WORKSPACE_RESOURCES,
  WORKSPACE_TOOLS,
} from "@deco/sdk/mcp";
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { type Context, Hono } from "hono";
import { env, getRuntimeKey } from "hono/adapter";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { endTime, startTime } from "hono/timing";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";
import { fetchScript } from "./apps.ts";
import { ROUTES as loginRoutes } from "./auth/index.ts";
import { withActorsStubMiddleware } from "./middlewares/actors-stub.ts";
import { withActorsMiddleware } from "./middlewares/actors.ts";
import { withContextMiddleware } from "./middlewares/context.ts";
import { setUserMiddleware } from "./middlewares/user.ts";
import { type AppContext, type AppEnv, State } from "./utils/context.ts";
import { handleStripeWebhook } from "./webhooks/stripe.ts";

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
  tools: typeof GLOBAL_TOOLS | typeof WORKSPACE_TOOLS,
) => {
  return async (c: Context) => {
    const group = c.req.query("group");

    const server = new McpServer(
      { name: "@deco/api", version: "1.0.0" },
      { capabilities: { tools: {}, resources: {} } },
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
          inputSchema: "shape" in tool.inputSchema
            ? (tool.inputSchema.shape as z.ZodRawShape)
            : z.object({}).shape,
          outputSchema:
            tool.outputSchema && typeof tool.outputSchema === "object" &&
              "shape" in tool.outputSchema
              ? (tool.outputSchema.shape as z.ZodRawShape)
              : z.object({}).shape,
        },
        // @ts-expect-error: zod shape is not typed
        withMCPErrorHandling(tool.handler),
      );
    }

    server.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      const appCtx = honoCtxToAppCtx(c);
      const resource = WORKSPACE_RESOURCES.find((r) =>
        r.name === "HOSTING_APPS_LIST_RESOURCE"
      );
      const result = await State.run(
        {
          ...appCtx,
          resource: { name: resource?.name || "HOSTING_APPS_LIST_RESOURCE" },
        },
        () =>
          resource?.handler({}, {
            ...appCtx,
            resource: { name: resource?.name || "HOSTING_APPS_LIST_RESOURCE" },
          }),
      );
      return {
        resources: result,
      };
    });

    server.server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
      const { uri } = req.params;
      const appCtx = honoCtxToAppCtx(c);
      const resource = WORKSPACE_RESOURCES.find((r) =>
        r.name === "HOSTING_APP_READ_RESOURCE"
      );
      const result = await State.run(
        {
          ...appCtx,
          resource: { name: resource?.name || "HOSTING_APP_READ_RESOURCE" },
        },
        () =>
          resource?.handler({ uri }, {
            ...appCtx,
            resource: { name: resource?.name || "HOSTING_APP_READ_RESOURCE" },
          }),
      );

      const contents = [];
      if (result?.contents) {
        for (const [path, content] of result.contents) {
          contents.push({
            uri: `${uri}/${path}`,
            mimeType: path.endsWith(".ts") || path.endsWith(".js")
              ? "application/javascript"
              : "text/plain",
            text: content,
          });
        }
      }

      return {
        contents,
      };
    });

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

const DECO_WORKSPACE_HEADER = "x-deco-workspace";
const SENSITIVE_HEADERS = ["Cookie", "Authorization"];
app.on([
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "PATCH",
  "OPTIONS",
], [
  "/:root/:slug/views/:script/:path{.+}?",
  "/views/:script/:path{.+}?",
], (c: Context) => {
  const script = c.req.param("script");
  const path = c.req.param("path");
  const root = c.req.param("root");
  const slug = c.req.param("slug");
  const workspace = root && slug
    ? `/${root}/${slug}`
    : c.req.header(DECO_WORKSPACE_HEADER);

  const url = new URL(c.req.raw.url);
  url.protocol = "https:";
  url.port = "443";
  url.host = Entrypoint.host(script);
  url.pathname = `/${path || ""}`;

  const headers = new Headers(c.req.header());
  SENSITIVE_HEADERS.forEach((header) => {
    headers.delete(header);
  });

  workspace && headers.set(DECO_WORKSPACE_HEADER, workspace);
  return fetchScript(
    c,
    script,
    new Request(url, {
      redirect: c.req.raw.redirect,
      body: c.req.raw.body,
      method: c.req.raw.method,
      headers,
    }),
  );
});

app.onError((err, c) => {
  console.error(err);

  return c.json(
    { error: err?.message ?? "Internal server error" },
    err instanceof HTTPException ? err.status : 500,
  );
});

export default app;

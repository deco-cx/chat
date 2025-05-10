import { HttpServerTransport } from "@deco/mcp/http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Context, Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { endTime, startTime } from "hono/timing";
import * as agentsAPI from "./api/agents/api.ts";
import * as hostingAPI from "./api/hosting/api.ts";
import * as integrationsAPI from "./api/integrations/api.ts";
import * as membersAPI from "./api/members/api.ts";
import * as profilesAPI from "./api/profiles/api.ts";
import * as teamsAPI from "./api/teams/api.ts";
import * as threadsAPI from "./api/threads/api.ts";
import { ROUTES as loginRoutes } from "./auth/index.ts";
import { withContextMiddleware } from "./middlewares/context.ts";
import { setUserMiddleware } from "./middlewares/user.ts";
import { ApiHandler, AppEnv, createAIHandler, State } from "./utils/context.ts";

export const app = new Hono<AppEnv>();

// Register tools for each API handler
const GLOBAL_TOOLS = [
  teamsAPI.getTeam,
  teamsAPI.createTeam,
  teamsAPI.updateTeam,
  teamsAPI.deleteTeam,
  teamsAPI.listTeams,
  membersAPI.getTeamMembers,
  membersAPI.updateTeamMember,
  membersAPI.removeTeamMember,
  membersAPI.registerMemberActivity,
  membersAPI.getMyInvites,
  membersAPI.acceptInvite,
  membersAPI.inviteTeamMembers,
  membersAPI.teamRolesList,
  profilesAPI.getProfile,
  profilesAPI.updateProfile,
];

// Tools tied to an specific workspace
const WORKSPACE_TOOLS = [
  agentsAPI.getAgent,
  agentsAPI.deleteAgent,
  agentsAPI.createAgent,
  agentsAPI.updateAgent,
  agentsAPI.listAgents,
  integrationsAPI.getIntegration,
  integrationsAPI.createIntegration,
  integrationsAPI.updateIntegration,
  integrationsAPI.deleteIntegration,
  integrationsAPI.listIntegrations,
  threadsAPI.listThreads,
  threadsAPI.getThread,
  threadsAPI.getThreadMessages,
  threadsAPI.getThreadTools,
  hostingAPI.listApps,
  hostingAPI.deployFiles,
  hostingAPI.deleteApp,
  hostingAPI.getAppInfo,
];

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
      c,
      transport.handleMessage.bind(transport),
      c.req.raw,
    );
    endTime(c, "mcp-handle-message");

    return c.res;
  };
};

/**
 * Setup a handler for handling tool calls. It's used so that
 * UIs can call the tools without suffering the serialization
 * of the protocol.
 */
const createToolCallHandlerFor = (tools: ApiHandler[]) => {
  const toolMap = new Map(tools.map((t) => [t.name, t]));

  return async (c: Context) => {
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
    const result = await State.run(c, t.handler, data);
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
  ],
  exposeHeaders: ["Content-Type", "Authorization", "Set-Cookie"],
  credentials: true,
}));

app.use(withContextMiddleware);
app.use(setUserMiddleware);

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

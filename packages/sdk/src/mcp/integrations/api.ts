import {
  createServerClient as createMcpServerClient,
  isApiDecoChatMCPConnection,
  listToolsByConnectionType,
  patchApiDecoChatTokenHTTPConnection,
} from "@deco/ai/mcp";
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  Agent,
  AgentSchema,
  API_SERVER_URL,
  INNATE_INTEGRATIONS,
  Integration,
  IntegrationSchema,
  InternalServerError,
  NEW_INTEGRATION_TEMPLATE,
  UserInputError,
} from "../../index.ts";
import type { Workspace } from "../../path.ts";
import {
  assertHasWorkspace,
  canAccessWorkspaceResource,
} from "../assertions.ts";
import { createApiHandler } from "../context.ts";
import { NotFoundError } from "../index.ts";
import { KNOWLEDGE_BASE_GROUP, listKnowledgeBases } from "../knowledge/api.ts";

const ensureStartingSlash = (path: string) =>
  path.startsWith("/") ? path : `/${path}`;

const parseId = (id: string) => {
  const [type, uuid] = id.includes(":") ? id.split(":") : ["i", id];
  return {
    type: (type || "i") as "i" | "a",
    uuid: uuid || id,
  };
};

const formatId = (type: "i" | "a", uuid: string) => `${type}:${uuid}`;

const agentAsIntegrationFor =
  (workspace: string) => (agent: Agent): Integration => ({
    id: formatId("a", agent.id),
    icon: agent.avatar,
    name: agent.name,
    description: agent.description,
    connection: {
      name: formatId("a", agent.id),
      type: "INNATE",
      workspace: ensureStartingSlash(workspace),
    },
  });

export const callTool = createApiHandler({
  name: "INTEGRATIONS_CALL_TOOL",
  description: "Call a given tool",
  schema: IntegrationSchema.pick({
    connection: true,
  }).merge(CallToolRequestSchema.pick({ params: true })),
  // The tool call will be authorized itself. This is a proxy
  canAccess: () => Promise.resolve(true),
  handler: async ({ connection: reqConnection, params: toolCall }, c) => {
    const connection = isApiDecoChatMCPConnection(reqConnection)
      ? patchApiDecoChatTokenHTTPConnection(
        reqConnection,
        c.cookie,
      )
      : reqConnection;

    if (!connection || !toolCall) {
      return { error: "Missing url parameter" };
    }

    const client = await createMcpServerClient({
      name: "deco-chat-client",
      connection,
    });

    if (!client) {
      return { error: "Failed to create client" };
    }

    try {
      const result = await client.callTool({
        name: toolCall.name,
        arguments: toolCall.arguments || {},
      });

      await client.close();

      return result;
    } catch (error) {
      console.error(
        "Failed to call tool:",
        error instanceof Error ? error.message : "Unknown error",
      );
      await client.close();
      return {
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

export const listTools = createApiHandler({
  name: "INTEGRATIONS_LIST_TOOLS",
  description: "List tools of a given integration",
  schema: IntegrationSchema.pick({
    connection: true,
  }),
  canAccess: () => Promise.resolve(true),
  handler: async ({ connection }, c) => {
    const result = await listToolsByConnectionType(
      connection,
      c,
    );

    // Sort tools by name for consistent UI
    if (Array.isArray(result?.tools)) {
      result.tools.sort((a, b) => a.name.localeCompare(b.name));
    }

    return result;
  },
});

const virtualIntegrationsFor = (
  workspace: string,
  knowledgeBases: string[],
) => {
  // Create a virtual User Management integration
  const userManagementIntegration = {
    id: formatId("i", "user-management"),
    name: "User Management",
    description: "Manage your teams, invites and profile",
    connection: {
      type: "HTTP",
      url: new URL("/mcp", API_SERVER_URL).href,
    },
    icon: "https://i.imgur.com/GD4o7vx.png",
    workspace,
    created_at: new Date().toISOString(),
  };
  const workspaceMcp = new URL(`${workspace}/mcp`, API_SERVER_URL);

  // Create a virtual Workspace Management integration
  const workspaceManagementIntegration = {
    id: formatId("i", "workspace-management"),
    name: "Workspace Management",
    description: "Manage your agents, integrations and threads",
    connection: {
      type: "HTTP",
      url: workspaceMcp.href,
    },
    icon: "https://assets.webdraw.app/uploads/deco-avocado-light.png",
    workspace,
    created_at: new Date().toISOString(),
  };

  return [
    userManagementIntegration,
    workspaceManagementIntegration,
    ...knowledgeBases.map((kb) => {
      const url = new URL(workspaceMcp);
      url.searchParams.set("group", KNOWLEDGE_BASE_GROUP);
      url.searchParams.set("name", kb);
      return {
        id: formatId("i", `knowledge-base-${kb}`),
        name: `${kb} (Knowledge Base)`,
        description: "A knowledge base for your workspace",
        connection: {
          type: "HTTP",
          url: url.href,
        },
        icon: "https://assets.webdraw.app/uploads/deco-avocado-light.png",
        workspace,
        created_at: new Date().toISOString(),
      };
    }),
  ];
};

export const listIntegrations = createApiHandler({
  name: "INTEGRATIONS_LIST",
  description: "List all integrations",
  schema: z.object({}),
  async canAccess(_, c) {
    return await canAccessWorkspaceResource(this.name, c);
  },
  handler: async (_, c) => {
    assertHasWorkspace(c);
    const workspace = c.workspace.value;

    const [
      integrations,
      agents,
      knowledgeBases,
    ] = await Promise.all([
      c.db
        .from("deco_chat_integrations")
        .select("*")
        .ilike("workspace", workspace),
      c.db
        .from("deco_chat_agents")
        .select("*")
        .ilike("workspace", workspace),
      listKnowledgeBases.handler({}).catch(() => {
        return { names: [] as string[] };
      }),
    ]);

    const error = integrations.error || agents.error;

    if (error) {
      throw new InternalServerError(
        error.message || "Failed to list integrations",
      );
    }

    return [
      ...virtualIntegrationsFor(workspace, knowledgeBases.names),
      ...integrations.data.map((item) => ({
        ...item,
        id: formatId("i", item.id),
      })),
      ...agents.data
        .map((item) => AgentSchema.safeParse(item)?.data)
        .filter((a) => !!a)
        .map(agentAsIntegrationFor(workspace)),
      ...Object.values(INNATE_INTEGRATIONS),
    ]
      .map((i) => IntegrationSchema.safeParse(i)?.data)
      .filter((i) => !!i);
  },
});

export const getIntegration = createApiHandler({
  name: "INTEGRATIONS_GET",
  description: "Get an integration by id",
  schema: z.object({
    id: z.string(),
  }),
  async canAccess({ id }, c) {
    if (INNATE_INTEGRATIONS[id as keyof typeof INNATE_INTEGRATIONS]) {
      return true;
    }
    return await canAccessWorkspaceResource(this.name, c);
  },
  handler: async ({ id }, c) => {
    const { uuid, type } = parseId(id);
    if (uuid in INNATE_INTEGRATIONS) {
      const data =
        INNATE_INTEGRATIONS[uuid as keyof typeof INNATE_INTEGRATIONS];
      return IntegrationSchema.parse({
        ...data,
        id: formatId(type, data.id),
      });
    }
    assertHasWorkspace(c);

    const knowledgeBases = await listKnowledgeBases.handler({});
    const virtualIntegrations = virtualIntegrationsFor(
      c.workspace.value,
      knowledgeBases.names,
    );

    if (virtualIntegrations.some((i) => i.id === id)) {
      return IntegrationSchema.parse({
        ...virtualIntegrations.find((i) => i.id === id),
        id: formatId(type, id),
      });
    }

    const { data, error } = await c.db
      .from(type === "i" ? "deco_chat_integrations" : "deco_chat_agents")
      .select("*")
      .eq("id", uuid)
      .single();

    if (error) {
      throw new InternalServerError(error.message);
    }

    if (!data) {
      throw new NotFoundError("Integration not found");
    }

    if (type === "a") {
      const mapAgentToIntegration = agentAsIntegrationFor(
        c.workspace.value as Workspace,
      );
      return IntegrationSchema.parse({
        ...mapAgentToIntegration(data as unknown as Agent),
        id: formatId(type, data.id),
      });
    }

    return IntegrationSchema.parse({
      ...data,
      id: formatId(type, data.id),
    });
  },
});

export const createIntegration = createApiHandler({
  name: "INTEGRATIONS_CREATE",
  description: "Create a new integration",
  schema: IntegrationSchema.partial(),
  async canAccess(_, c) {
    return await canAccessWorkspaceResource(this.name, c);
  },
  handler: async (integration, c) => {
    assertHasWorkspace(c);

    const { data, error } = await c.db
      .from("deco_chat_integrations")
      .insert({
        ...NEW_INTEGRATION_TEMPLATE,
        ...integration,
        workspace: c.workspace.value,
      })
      .select()
      .single();

    if (error) {
      throw new InternalServerError(error.message);
    }

    return IntegrationSchema.parse({
      ...data,
      id: formatId("i", data.id),
    });
  },
});

export const updateIntegration = createApiHandler({
  name: "INTEGRATIONS_UPDATE",
  description: "Update an existing integration",
  schema: z.object({
    id: z.string(),
    integration: IntegrationSchema,
  }),
  async canAccess(_, c) {
    return await canAccessWorkspaceResource(this.name, c);
  },
  handler: async ({ id, integration }, c) => {
    assertHasWorkspace(c);

    const { uuid, type } = parseId(id);

    if (type === "a") {
      throw new UserInputError("Cannot update an agent integration");
    }

    const { data, error } = await c.db
      .from("deco_chat_integrations")
      .update({ ...integration, id: uuid, workspace: c.workspace.value })
      .eq("id", uuid)
      .select()
      .single();

    if (error) {
      throw new InternalServerError(error.message);
    }

    if (!data) {
      throw new NotFoundError("Integration not found");
    }

    return IntegrationSchema.parse({
      ...data,
      id: formatId(type, data.id),
    });
  },
});

export const deleteIntegration = createApiHandler({
  name: "INTEGRATIONS_DELETE",
  description: "Delete an integration by id",
  schema: z.object({
    id: z.string(),
  }),
  async canAccess(_, c) {
    return await canAccessWorkspaceResource(this.name, c);
  },
  handler: async ({ id }, c) => {
    assertHasWorkspace(c);

    const { uuid, type } = parseId(id);

    if (type === "a") {
      throw new UserInputError("Cannot delete an agent integration");
    }

    const { error } = await c.db
      .from("deco_chat_integrations")
      .delete()
      .eq("id", uuid);

    if (error) {
      throw new InternalServerError(error.message);
    }

    return true;
  },
});

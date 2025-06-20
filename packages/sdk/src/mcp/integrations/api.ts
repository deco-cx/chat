import {
  createServerClient as createMcpServerClient,
  isApiDecoChatMCPConnection,
  listToolsByConnectionType,
  patchApiDecoChatTokenHTTPConnection,
} from "@deco/ai/mcp";
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  type Agent,
  AgentSchema,
  BindingsSchema,
  DECO_CHAT_API,
  INNATE_INTEGRATIONS,
  type Integration,
  IntegrationSchema,
  InternalServerError,
  NEW_INTEGRATION_TEMPLATE,
  UserInputError,
} from "../../index.ts";
import { CallToolResultSchema } from "../../models/tool-call.ts";
import type { Workspace } from "../../path.ts";
import type { QueryResult } from "../../storage/supabase/client.ts";
import { getKnowledgeBaseIntegrationId } from "../../utils/index.ts";
import { IMPORTANT_ROLES } from "../agents/api.ts";
import {
  assertHasWorkspace,
  assertWorkspaceResourceAccess,
} from "../assertions.ts";
import { createTool } from "../context.ts";
import { Binding, NotFoundError, WellKnownBindings } from "../index.ts";
import { KNOWLEDGE_BASE_GROUP, listKnowledgeBases } from "../knowledge/api.ts";
import { createServerClient } from "../utils.ts";

const ensureStartingSlash = (path: string) =>
  path.startsWith("/") ? path : `/${path}`;

export const parseId = (id: string) => {
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

export const callTool = createTool({
  name: "INTEGRATIONS_CALL_TOOL",
  description: "Call a given tool",
  inputSchema: IntegrationSchema.pick({
    connection: true,
  }).merge(CallToolRequestSchema.pick({ params: true })),
  handler: async ({ connection: reqConnection, params: toolCall }, c) => {
    c.resourceAccess.grant();

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
        // @ts-expect-error TODO: remove this once this is merged: https://github.com/modelcontextprotocol/typescript-sdk/pull/528
      }, CallToolResultSchema);

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

export const listTools = createTool({
  name: "INTEGRATIONS_LIST_TOOLS",
  description: "List tools of a given integration",
  inputSchema: IntegrationSchema.pick({
    connection: true,
  }),
  handler: async ({ connection }, c) => {
    c.resourceAccess.grant();

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
      url: new URL("/mcp", DECO_CHAT_API).href,
    },
    icon: "https://i.imgur.com/GD4o7vx.png",
    workspace,
    created_at: new Date().toISOString(),
  };
  const workspaceMcp = new URL(`${workspace}/mcp`, DECO_CHAT_API);

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

  // Create a virtual AI Integration
  const aiIntegrationUrl = new URL(workspaceMcp);
  aiIntegrationUrl.searchParams.set("group", "AI_INTEGRATION");
  const aiIntegration = {
    id: formatId("i", "ai-integration"),
    name: "AI Integration",
    description: "Call AI models directly for text and structured object generation",
    connection: {
      type: "HTTP",
      url: aiIntegrationUrl.href,
    },
    icon: "https://cdn-icons-png.flaticon.com/512/11865/11865223.png",
    workspace,
    created_at: new Date().toISOString(),
  };

  return [
    userManagementIntegration,
    workspaceManagementIntegration,
    aiIntegration,
    ...knowledgeBases.map((kb) => {
      const url = new URL(workspaceMcp);
      url.searchParams.set("group", KNOWLEDGE_BASE_GROUP);
      url.searchParams.set("name", kb);
      return {
        id: getKnowledgeBaseIntegrationId(kb),
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

export const listIntegrations = createTool({
  name: "INTEGRATIONS_LIST",
  description: "List all integrations",
  inputSchema: z.object({
    binder: BindingsSchema.optional(),
  }),
  handler: async ({ binder }, c) => {
    assertHasWorkspace(c);
    const workspace = c.workspace.value;

    await assertWorkspaceResourceAccess(c.tool.name, c);

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
      listKnowledgeBases.handler({}),
    ]);

    const error = integrations.error || agents.error;

    if (error) {
      throw new InternalServerError(
        error.message || "Failed to list integrations",
      );
    }
    const roles = c.workspace.root === "users"
      ? []
      : (await c.policy.getUserRoles(c.user.id as string, c.workspace.slug));
    const userRoles: string[] = roles?.map((role) => role?.name);

    // TODO: This is a temporary solution to filter integrations and agents by access.
    const filteredIntegrations = integrations.data.filter((integration) =>
      !integration.access ||
      userRoles?.includes(integration.access) ||
      userRoles?.some((role) => IMPORTANT_ROLES.includes(role))
    );

    const filteredAgents = agents.data.filter((agent) =>
      !agent.access ||
      userRoles?.includes(agent.access) ||
      userRoles?.some((role) => IMPORTANT_ROLES.includes(role))
    );

    const result = [
      ...virtualIntegrationsFor(
        workspace,
        knowledgeBases.names ?? [],
      ),
      ...filteredIntegrations.map((item) => ({
        ...item,
        id: formatId("i", item.id),
      })),
      ...filteredAgents
        .map((item) => AgentSchema.safeParse(item)?.data)
        .filter((a) => !!a)
        .map(agentAsIntegrationFor(workspace)),
      ...Object.values(INNATE_INTEGRATIONS),
    ]
      .map((i) => IntegrationSchema.safeParse(i)?.data)
      .filter((i) => !!i);

    if (binder) {
      const filtered: typeof result = [];
      await Promise.all(result.map(async (integration) => {
        const integrationTools = await Promise.race([
          listTools.handler({
            connection: integration.connection,
          }),
          new Promise<null>(
            (r) => setTimeout(() => r(null), 7_000),
          ),
        ]);
        if (!integrationTools) {
          return;
        }
        const tools = integrationTools.tools ?? [];
        if (Binding(WellKnownBindings[binder]).isImplementedBy(tools)) {
          filtered.push(integration);
        }
      }));
      return filtered;
    }
    return result;
  },
});

export const convertFromDatabase = (
  integration: QueryResult<"deco_chat_integrations", "*">,
) => {
  return IntegrationSchema.parse({
    ...integration,
    id: formatId("i", integration.id),
  });
};

export const getIntegration = createTool({
  name: "INTEGRATIONS_GET",
  description: "Get an integration by id",
  inputSchema: z.object({
    id: z.string(),
  }),
  handler: async ({ id }, c) => {
    // preserve the logic of the old canAccess
    const isInnate =
      INNATE_INTEGRATIONS[id as keyof typeof INNATE_INTEGRATIONS];

    const canAccess = isInnate ||
      await assertWorkspaceResourceAccess(c.tool.name, c)
        .then(() => true)
        .catch(() => false);

    if (canAccess) {
      c.resourceAccess.grant();
    }

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

    const selectPromise = c.db
      .from(type === "i" ? "deco_chat_integrations" : "deco_chat_agents")
      .select("*")
      .eq("id", uuid)
      .single().then((r) => r);
    const knowledgeBases = await listKnowledgeBases.handler({});

    const virtualIntegrations = virtualIntegrationsFor(
      c.workspace.value,
      knowledgeBases.names ?? [],
    );

    if (virtualIntegrations.some((i) => i.id === id)) {
      return IntegrationSchema.parse({
        ...virtualIntegrations.find((i) => i.id === id),
        id: formatId(type, id),
      });
    }

    const { data, error } = await selectPromise;

    if (!data) {
      throw new NotFoundError("Integration not found");
    }

    if (error) {
      throw new InternalServerError((error as Error).message);
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

export const createIntegration = createTool({
  name: "INTEGRATIONS_CREATE",
  description: "Create a new integration",
  inputSchema: IntegrationSchema.partial(),
  handler: async (integration, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c.tool.name, c);

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

export const updateIntegration = createTool({
  name: "INTEGRATIONS_UPDATE",
  description: "Update an existing integration",
  inputSchema: z.object({
    id: z.string(),
    integration: IntegrationSchema,
  }),
  handler: async ({ id, integration }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c.tool.name, c);

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

export const deleteIntegration = createTool({
  name: "INTEGRATIONS_DELETE",
  description: "Delete an integration by id",
  inputSchema: z.object({
    id: z.string(),
  }),
  handler: async ({ id }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c.tool.name, c);

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

    return { success: true };
  },
});

const DECO_REGISTRY_SERVER_URL = "https://mcp.deco.site";

const getDecoRegistryServerClient = () => {
  const url = new URL("/mcp/messages", DECO_REGISTRY_SERVER_URL);

  return createServerClient({
    name: url.hostname,
    connection: { type: "HTTP", url: url.href },
  });
};

const searchMarketplaceIntegations = async (
  query?: string,
): Promise<(Integration & { provider: string })[]> => {
  const client = await getDecoRegistryServerClient();

  try {
    const result = await client.callTool({
      name: "SEARCH",
      arguments: { query },
      // @ts-expect-error should be fixed after this is merged: https://github.com/modelcontextprotocol/typescript-sdk/pull/528
    }, CallToolResultSchema);

    return result.structuredContent as (Integration & { provider: string })[];
  } finally {
    client.close();
  }
};

export const DECO_INTEGRATIONS_SEARCH = createTool({
  name: "DECO_INTEGRATIONS_SEARCH",
  description: `
Search for integrations in both marketplace and installed.
If no query is provided, it will return all installed integrations. For better results, try searching for the service name, i.e. GoogleSheets, GoogleCalendar, Notion, etc.
It's always handy to search for installed integrations with no query, since all integrations will be returned. Also, some integrations are handy agents that may help you with common tasks.
`,
  inputSchema: z.object({
    query: z.string().describe("The query to search for").optional(),
  }),
  outputSchema: z.object({
    integrations: z.array(
      IntegrationSchema.omit({ connection: true }).and(z.object({
        provider: z.string(),
      })),
    ).describe("The Integrations that match the query"),
  }),
  handler: async ({ query }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c.tool.name, c);

    const marketplace = await searchMarketplaceIntegations(query);

    const list = marketplace.map((
      { id, name, description, icon, provider },
    ) => ({
      id,
      name,
      description,
      icon,
      provider,
    }));

    return {
      integrations: list,
    };
  },
});

export const DECO_INTEGRATION_OAUTH_START = createTool({
  name: "DECO_INTEGRATION_OAUTH_START",
  description: "Start the OAuth flow for an integration",
  inputSchema: z.object({
    appName: z.string().describe(
      "The id of the integration to start the OAuth flow for",
    ),
    returnUrl: z.string().describe(
      "The return URL for the OAuth flow. Will come with a query param including the mcp URL.",
    ),
    installId: z.string().describe(
      "The install id of the integration to start the OAuth flow for",
    ),
  }),
  handler: async ({ appName, returnUrl, installId }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c.tool.name, c);

    const url = new URL(`${DECO_REGISTRY_SERVER_URL}/oauth/start`);
    url.searchParams.set("installId", installId);
    url.searchParams.set("appName", appName);
    url.searchParams.set("returnUrl", returnUrl);

    const response = await fetch(url.toString(), {
      redirect: "manual",
    });

    const redirectUrl = response.headers.get("location");

    if (!redirectUrl) {
      throw new Error("No redirect URL found");
    }

    return { redirectUrl };
  },
});

// TODO: Check if any composio integration cannot be auto connected
const canAutoConnect = (_data: Record<string, unknown>) => {
  console.log("[Composio] canAutoConnect", _data);
  return true;
};

const parseComposioToolResult = (result: ToolCallResult) => {
  try {
    const dataStringified = result.content?.[0]?.text ?? "{}";
    const data = JSON.parse(dataStringified);
    return data;
  } catch (error) {
    console.error("Error parsing Composio tool result", error);
    return {};
  }
};

interface ToolCallResult {
  content?: {
    text?: string;
  }[];
}

export const COMPOSIO_INTEGRATION_OAUTH_START = createTool({
  name: "COMPOSIO_INTEGRATION_OAUTH_START",
  description: "Start the OAuth flow for a Composio integration",
  inputSchema: z.object({
    url: z.string().describe("The url of the Composio MCP server"),
  }),
  handler: async ({ url }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c.tool.name, c);

    const client = await createServerClient({
      name: "composio-authenticator",
      connection: { type: "HTTP", url },
    });

    const { tools } = await client.listTools();

    const initiateConnectionTool = tools.find((tool) =>
      tool.name.endsWith("_INITIATE_CONNECTION")
    );
    const getRequiredParametersTool = tools.find((tool) =>
      tool.name.endsWith("_GET_REQUIRED_PARAMETERS")
    );

    if (!initiateConnectionTool) {
      throw new Error("Composio authenticator has no required tools");
    }

    if (getRequiredParametersTool) {
      const getRequiredParametersResult = await client.callTool({
        name: getRequiredParametersTool.name,
        arguments: {},
      });

      const getRequiredParametersData = parseComposioToolResult(
        getRequiredParametersResult as ToolCallResult,
      );

      if (!canAutoConnect(getRequiredParametersData)) {
        return { redirectUrl: null };
      }
    }

    const initiateConnectionResult = await client.callTool({
      name: initiateConnectionTool.name,
      arguments: {},
    });

    const data = parseComposioToolResult(
      initiateConnectionResult as ToolCallResult,
    );
    const redirectUrl = data.data?.response_data?.redirect_url ?? null;
    return { redirectUrl };
  },
});

const CONFIGURE_INTEGRATION_OUTPUT_SCHEMA = z.object({
  success: z.boolean().describe("Whether the configuration was successful"),
  message: z.string().describe(
    "A message describing the result of the configuration attempt",
  ).optional(),
  data: IntegrationSchema.omit({ id: true }).optional(),
  // configure integration can return the install id, e.g for composio
  installId: z.string().optional(),
});

export const DECO_INTEGRATION_INSTALL = createTool({
  name: "DECO_INTEGRATION_INSTALL",
  description:
    "Install an integration. To know the available ids, use the DECO_INTEGRATIONS_SEARCH tool. Also, after installing, enable the integration using the INTEGRATION_ENABLE tool.",
  inputSchema: z.object({
    id: z.string().describe(
      "The id of the integration to install. To know the available ids, use the DECO_INTEGRATIONS_SEARCH tool",
    ),
  }),
  outputSchema: z.object({
    installationId: z.string().describe(
      "The id of the installation. Use this id to enable the integration using the DECO_INTEGRATIONS_SEARCH tool",
    ),
  }),
  handler: async (args, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c.tool.name, c);

    const client = await getDecoRegistryServerClient();

    try {
      const result = await client.callTool({
        name: "CONFIGURE",
        arguments: { id: args.id },
        // @ts-expect-error should be fixed after this is merged: https://github.com/modelcontextprotocol/typescript-sdk/pull/528
      }, CallToolResultSchema);

      const parsed = CONFIGURE_INTEGRATION_OUTPUT_SCHEMA.parse(
        result.structuredContent,
      );

      const pattern = new URLPattern({
        pathname: "/apps/:appName/:installId/mcp/messages",
      });
      const match = parsed.data && "url" in parsed.data.connection &&
          typeof parsed.data.connection.url === "string"
        ? pattern.exec(parsed.data.connection.url)
        : null;
      const id = parsed.installId ?? match?.pathname.groups.installId ??
        crypto.randomUUID();

      const created = await createIntegration.handler({
        id,
        ...(parsed.data as Omit<Integration, "id">),
      });

      client.close();

      if (!created?.id) {
        throw new Error("Failed to create integration");
      }

      return { installationId: created.id };
    } catch (error) {
      client.close();
      throw error;
    }
  },
});

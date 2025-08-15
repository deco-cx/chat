import {
  createServerClient as createMcpServerClient,
  isApiDecoChatMCPConnection as shouldPatchDecoChatMCPConnection,
  listToolsByConnectionType,
  patchApiDecoChatTokenHTTPConnection,
} from "@deco/ai/mcp";
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { KNOWLEDGE_BASE_GROUP } from "../../constants.ts";
import {
  type Agent,
  AgentSchema,
  BindingsSchema,
  DECO_CHAT_API,
  INNATE_INTEGRATIONS,
  type Integration,
  IntegrationSchema,
  InternalServerError,
  type MCPConnection,
  NEW_INTEGRATION_TEMPLATE,
  UserInputError,
  WellKnownMcpGroups,
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
import { getGroups } from "../groups.ts";
import {
  Binding,
  createToolGroup,
  MCPClient,
  NotFoundError,
  WellKnownBindings,
} from "../index.ts";
import { listKnowledgeBases } from "../knowledge/api.ts";
import { getRegistryApp, listRegistryApps } from "../registry/api.ts";
import { createServerClient } from "../utils.ts";
import type { MCPTool } from "../../hooks/tools.ts";

const SELECT_INTEGRATION_QUERY = `
          *,
          deco_chat_apps_registry(
            name,
            deco_chat_registry_scopes(scope_name),
            deco_chat_apps_registry_tools(
              name,
              description,
              input_schema,
              output_schema
            )
          )
        ` as const;
// Tool factories for each group
const mapIntegration = (
  integration: QueryResult<
    "deco_chat_integrations",
    typeof SELECT_INTEGRATION_QUERY
  >,
) => {
  let appName: undefined | string;
  const registryName = integration.deco_chat_apps_registry?.name;
  const appScope =
    integration.deco_chat_apps_registry?.deco_chat_registry_scopes?.scope_name;
  if (registryName && appScope) {
    appName = `@${appScope}/${registryName}`;
  }
  return {
    ...integration,
    appName,
    id: formatId("i", integration.id),
  };
};
export const parseId = (id: string) => {
  const [type, uuid] = id.includes(":") ? id.split(":") : ["i", id];
  return {
    type: (type || "i") as "i" | "a",
    uuid: uuid || id,
  };
};

const formatId = (type: "i" | "a", uuid: string) => `${type}:${uuid}`;

const agentAsIntegrationFor =
  (workspace: string, token?: string) =>
  (agent: Agent): Integration => ({
    id: formatId("a", agent.id),
    icon: agent.avatar,
    name: agent.name,
    description: agent.description,
    connection: {
      type: "HTTP",
      url: new URL(`${workspace}/agents/${agent.id}/mcp`, DECO_CHAT_API).href,
      token,
    },
  });

const createIntegrationManagementTool = createToolGroup("Integration", {
  name: "Integration Management",
  description:
    "Install, authorize, and manage third-party integrations and their tools.",
  icon: "https://assets.decocache.com/mcp/2ead84c2-2890-4d37-b61c-045f4760f2f7/Integration-Management.png",
});
export const callTool = createIntegrationManagementTool({
  name: "INTEGRATIONS_CALL_TOOL",
  description: "Call a given tool",
  inputSchema: IntegrationSchema.pick({
    connection: true,
  }).merge(CallToolRequestSchema.pick({ params: true })),
  handler: async ({ connection: reqConnection, params: toolCall }, c) => {
    c.resourceAccess.grant();

    const connection = shouldPatchDecoChatMCPConnection(reqConnection)
      ? patchApiDecoChatTokenHTTPConnection(reqConnection, c.cookie)
      : reqConnection;

    if (!connection || !toolCall) {
      return { error: "Missing url parameter" };
    }

    console.log({ connection });

    const client = await createMcpServerClient({
      name: "deco-chat-client",
      connection,
    });

    if (!client) {
      return { error: "Failed to create client" };
    }

    try {
      const result = await client.callTool(
        {
          name: toolCall.name,
          arguments: toolCall.arguments || {},
        },
        // @ts-expect-error TODO: remove this once this is merged: https://github.com/modelcontextprotocol/typescript-sdk/pull/528
        CallToolResultSchema,
      );

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

export const listTools = createIntegrationManagementTool({
  name: "INTEGRATIONS_LIST_TOOLS",
  description: "List tools of a given integration",
  inputSchema: IntegrationSchema.pick({
    connection: true,
  }).extend({
    ignoreCache: z
      .boolean()
      .optional()
      .describe("Whether to ignore the cache when listing tools"),
  }),
  handler: async ({ connection, ignoreCache }, c) => {
    c.resourceAccess.grant();

    const result = await listToolsByConnectionType(connection, c, ignoreCache);

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
  token?: string,
) => {
  // Create a virtual User Management integration
  const decoChatMcp = new URL("/mcp", DECO_CHAT_API);
  const userManagementIntegration = {
    id: formatId("i", "user-management"),
    name: "User Management",
    description: "Manage your teams, invites and profile",
    connection: {
      type: "HTTP",
      url: decoChatMcp.href,
      token,
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
      token,
    },
    icon: "https://assets.webdraw.app/uploads/deco-avocado-light.png",
    workspace,
    created_at: new Date().toISOString(),
  };

  const integrationGroups = Object.entries(getGroups()).map(
    ([group, { name, description, icon, workspace }]) => {
      const url =
        workspace === false ? new URL(decoChatMcp) : new URL(workspaceMcp);
      url.searchParams.set("group", group);
      return {
        id: formatId("i", group),
        name,
        icon,
        description,
        connection: {
          type: "HTTP",
          url: url.href,
          token,
        },
        workspace,
        created_at: new Date().toISOString(),
      };
    },
  );

  return [
    userManagementIntegration,
    workspaceManagementIntegration,
    ...integrationGroups,
    ...knowledgeBases.map((kb) => {
      const url = new URL(workspaceMcp);
      url.searchParams.set("group", KNOWLEDGE_BASE_GROUP);
      url.searchParams.set("name", kb);
      return {
        id: getKnowledgeBaseIntegrationId(kb),
        name: `${kb} (Knowledge Base)`,
        description: "Ingest, search, and manage contextual data.",
        connection: {
          type: "HTTP",
          url: url.href,
          token,
        },
        icon: "https://assets.decocache.com/mcp/1b6e79a9-7830-459c-a1a6-ba83e7e58cbe/Knowledge-Base.png",
        workspace,
        created_at: new Date().toISOString(),
      };
    }),
  ];
};

// Helper function to extract tools from registry data - shared between list and get
const extractToolsFromRegistry = (
  integration: QueryResult<
    "deco_chat_integrations",
    typeof SELECT_INTEGRATION_QUERY
  >,
): MCPTool[] | null => {
  const registryData = integration.deco_chat_apps_registry;
  const registryTools =
    registryData && Array.isArray(registryData.deco_chat_apps_registry_tools)
      ? registryData.deco_chat_apps_registry_tools
      : null;

  return (
    registryTools?.map(
      (tool): MCPTool => ({
        name: tool.name,
        description: tool.description || undefined,
        inputSchema: (tool.input_schema as Record<string, unknown>) || {},
        outputSchema:
          (tool.output_schema as Record<string, unknown>) || undefined,
      }),
    ) || null
  );
};

export const listIntegrations = createIntegrationManagementTool({
  name: "INTEGRATIONS_LIST",
  description: "List all integrations with their tools",
  inputSchema: z.object({
    binder: BindingsSchema.optional(),
  }),
  outputSchema: z.object({
    items: z.array(IntegrationSchema),
  }),
  handler: async ({ binder }, c) => {
    assertHasWorkspace(c);
    const workspace = c.workspace.value;

    await assertWorkspaceResourceAccess(c);

    const [integrations, agents, knowledgeBases] = await Promise.all([
      c.db
        .from("deco_chat_integrations")
        .select(SELECT_INTEGRATION_QUERY)
        .ilike("workspace", workspace),
      c.db.from("deco_chat_agents").select("*").ilike("workspace", workspace),
      listKnowledgeBases.handler({}),
    ]);

    const error = integrations.error || agents.error;

    if (error) {
      throw new InternalServerError(
        error.message || "Failed to list integrations",
      );
    }
    const roles =
      c.workspace.root === "users"
        ? []
        : await c.policy.getUserRoles(c.user.id as string, c.workspace.slug);
    const userRoles: string[] = roles?.map((role) => role?.name);

    // TODO: This is a temporary solution to filter integrations and agents by access.
    const filteredIntegrations = integrations.data.filter(
      (integration) =>
        !integration.access ||
        userRoles?.includes(integration.access) ||
        userRoles?.some((role) => IMPORTANT_ROLES.includes(role)),
    );

    const filteredAgents = agents.data.filter(
      (agent) =>
        !agent.access ||
        userRoles?.includes(agent.access) ||
        userRoles?.some((role) => IMPORTANT_ROLES.includes(role)),
    );

    // Build the result with all integrations
    const baseResult = [
      ...virtualIntegrationsFor(workspace, knowledgeBases.names ?? [], c.token),
      ...filteredIntegrations.map(mapIntegration),
      ...filteredAgents
        .map((item) => AgentSchema.safeParse(item)?.data)
        .filter((a) => !!a)
        .map(agentAsIntegrationFor(workspace, c.token)),
      ...Object.values(INNATE_INTEGRATIONS),
    ]
      .map((i) => IntegrationSchema.safeParse(i)?.data)
      .filter((i) => !!i);

    // Add tools to each integration
    const result = baseResult.map((integration) => {
      // Find the corresponding database record to extract tools
      const dbRecord = filteredIntegrations.find(
        (dbIntegration) => formatId("i", dbIntegration.id) === integration.id,
      );

      const tools = dbRecord ? extractToolsFromRegistry(dbRecord) : null;

      return { ...integration, tools };
    });

    if (binder) {
      // Filter by binder capability
      const filteredResult = result.filter((integration) => {
        return Binding(WellKnownBindings[binder]).isImplementedBy(
          integration.tools ?? [],
        );
      });
      return { items: filteredResult };
    }

    return { items: result };
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

export const getIntegration = createIntegrationManagementTool({
  name: "INTEGRATIONS_GET",
  description: "Get an integration by id with tools",
  inputSchema: z.object({
    id: z.string(),
  }),
  handler: async ({ id }, c) => {
    // preserve the logic of the old canAccess
    const isInnate =
      INNATE_INTEGRATIONS[id as keyof typeof INNATE_INTEGRATIONS];

    const canAccess =
      isInnate ||
      (await assertWorkspaceResourceAccess(c)
        .then(() => true)
        .catch(() => false));

    if (canAccess) {
      c.resourceAccess.grant();
    }

    const { uuid, type } = parseId(id);
    if (uuid in INNATE_INTEGRATIONS) {
      const data =
        INNATE_INTEGRATIONS[uuid as keyof typeof INNATE_INTEGRATIONS];
      const baseIntegration = IntegrationSchema.parse({
        ...data,
        id: formatId(type, data.id),
      });
      return { ...baseIntegration, tools: null }; // Innate integrations don't have tools for now
    }
    assertHasWorkspace(c);

    const selectPromise =
      type === "i"
        ? c.db
            .from("deco_chat_integrations")
            .select(SELECT_INTEGRATION_QUERY)
            .eq("id", uuid)
            .eq("workspace", c.workspace.value)
            .single()
            .then((r) => r)
        : c.db
            .from("deco_chat_agents")
            .select("*")
            .eq("id", uuid)
            .eq("workspace", c.workspace.value)
            .single()
            .then((r) => r);

    const knowledgeBases = await listKnowledgeBases.handler({});

    const virtualIntegrations = virtualIntegrationsFor(
      c.workspace.value,
      knowledgeBases.names ?? [],
      c.token,
    );

    if (virtualIntegrations.some((i) => i.id === id)) {
      const baseIntegration = IntegrationSchema.parse({
        ...virtualIntegrations.find((i) => i.id === id),
        id: formatId(type, id),
      });
      return { ...baseIntegration, tools: null }; // Virtual integrations don't have tools for now
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
        c.token,
      );
      const baseIntegration = IntegrationSchema.parse({
        ...mapAgentToIntegration(data as unknown as Agent),
        id: formatId(type, data.id),
      });
      return { ...baseIntegration, tools: null }; // Agents don't have tools for now
    }

    const integrationData = data as unknown as QueryResult<
      "deco_chat_integrations",
      typeof SELECT_INTEGRATION_QUERY
    >;

    const tools = extractToolsFromRegistry(integrationData);
    const baseIntegration = IntegrationSchema.parse({
      ...mapIntegration(integrationData),
      id: formatId(type, data.id),
    });

    return { ...baseIntegration, tools };
  },
});

export const createIntegration = createIntegrationManagementTool({
  name: "INTEGRATIONS_CREATE",
  description: "Create a new integration",
  inputSchema: IntegrationSchema.partial().omit({ appName: true }),
  handler: async (_integration, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    const { appId, ...integration } = _integration;

    const payload = {
      ...NEW_INTEGRATION_TEMPLATE,
      ...integration,
      app_id: appId ?? undefined,
      workspace: c.workspace.value,
      id: integration.id ? parseId(integration.id).uuid : undefined,
    };

    const { data, error } =
      "id" in payload && payload.id
        ? await c.db
            .from("deco_chat_integrations")
            .upsert(payload)
            .eq("workspace", c.workspace.value)
            .select()
            .single()
        : await c.db
            .from("deco_chat_integrations")
            .insert(payload)
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

export const updateIntegration = createIntegrationManagementTool({
  name: "INTEGRATIONS_UPDATE",
  description: "Update an existing integration",
  inputSchema: z.object({
    id: z.string(),
    integration: IntegrationSchema,
  }),
  handler: async ({ id, integration }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    const { uuid, type } = parseId(id);

    if (type === "a") {
      throw new UserInputError("Cannot update an agent integration");
    }

    const { name, description, icon, connection, access, appId } = integration;

    const { data, error } = await c.db
      .from("deco_chat_integrations")
      .update({
        name,
        description,
        icon,
        connection,
        access,
        app_id: appId,
        id: uuid,
        workspace: c.workspace.value,
      })
      .eq("id", uuid)
      .eq("workspace", c.workspace.value)
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

export const deleteIntegration = createIntegrationManagementTool({
  name: "INTEGRATIONS_DELETE",
  description: "Delete an integration by id",
  inputSchema: z.object({
    id: z.string(),
  }),
  handler: async ({ id }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    const { uuid, type } = parseId(id);

    if (type === "a") {
      throw new UserInputError("Cannot delete an agent integration");
    }

    const { error } = await c.db
      .from("deco_chat_integrations")
      .delete()
      .eq("id", uuid)
      .eq("workspace", c.workspace.value);

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

const DECO_PROVIDER = "deco";
const virtualInstallableIntegrations = () => {
  return [
    {
      id: "AGENTS_EMAIL",
      name: "Agents Email",
      group: WellKnownMcpGroups.Email,
      description: "Manage your agents email",
      icon: "https://assets.decocache.com/mcp/65334e3f-17b4-470f-b644-5d226c565db9/email-integration.png",
      provider: DECO_PROVIDER,
    },
  ];
};

const MARKETPLACE_PROVIDER = "marketplace";

export const DECO_INTEGRATIONS_SEARCH = createIntegrationManagementTool({
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
    integrations: z
      .array(
        IntegrationSchema.omit({ connection: true }).and(
          z.object({
            provider: z.string(),
            friendlyName: z.string().optional(),
          }),
        ),
      )
      .describe("The Integrations that match the query"),
  }),
  handler: async ({ query }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    const registry = await listRegistryApps.handler({
      search: query,
    });

    const registryList = registry.apps.map((app) => ({
      id: app.id,
      name: `@${app.scopeName}/${app.name}`,
      friendlyName: app.friendlyName,
      description: app.description,
      icon: app.icon,
      provider: MARKETPLACE_PROVIDER,
      verified: app.verified,
    }));

    const virtualIntegrations = virtualInstallableIntegrations();
    return {
      integrations: [
        ...virtualIntegrations.filter(
          (integration) => !query || integration.name.includes(query),
        ),
        ...registryList,
      ],
    };
  },
});

export const DECO_INTEGRATION_OAUTH_START = createIntegrationManagementTool({
  name: "DECO_INTEGRATION_OAUTH_START",
  description: "Start the OAuth flow for an integration",
  inputSchema: z.object({
    appName: z
      .string()
      .describe("The id of the integration to start the OAuth flow for"),
    returnUrl: z
      .string()
      .describe(
        "The return URL for the OAuth flow. Will come with a query param including the mcp URL.",
      ),
    installId: z
      .string()
      .describe(
        "The install id of the integration to start the OAuth flow for",
      ),
    provider: z
      .string()
      .optional()
      .describe("The provider of the integration to start the OAuth flow for"),
  }),
  outputSchema: z.union([
    z.object({
      redirectUrl: z.string(),
    }),
    z.object({
      stateSchema: z.unknown(),
      scopes: z.array(z.string()).optional(),
    }),
  ]),
  handler: async ({ appName, returnUrl, installId, provider }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);
    let connection: MCPConnection;
    if (provider === "marketplace") {
      const app = await getRegistryApp.handler({ name: appName });
      connection = app.connection;
    } else {
      connection = {
        type: "HTTP",
        url: new URL(`/apps/${appName}/mcp/messages`, DECO_REGISTRY_SERVER_URL)
          .href,
        token: installId,
      };
    }
    const oauth = (await MCPClient.INTEGRATIONS_CALL_TOOL({
      connection,
      params: {
        name: "DECO_CHAT_OAUTH_START",
        arguments: {
          installId,
          returnUrl,
        },
      },
    })) as {
      structuredContent:
        | { redirectUrl: string }
        | {
            stateSchema: unknown;
            scopes?: string[];
          };
    };

    return oauth.structuredContent;
  },
});

interface ToolCallResult {
  content?: {
    text?: string;
  }[];
}

const CONFIGURE_INTEGRATION_OUTPUT_SCHEMA = z.object({
  success: z.boolean().describe("Whether the configuration was successful"),
  message: z
    .string()
    .describe("A message describing the result of the configuration attempt")
    .optional(),
  data: IntegrationSchema.omit({ id: true }).optional(),
  // configure integration can return the install id
  installId: z.string().optional(),
});

export const DECO_INTEGRATION_INSTALL = createIntegrationManagementTool({
  name: "DECO_INTEGRATION_INSTALL",
  description:
    "Install an integration. To know the available ids, use the DECO_INTEGRATIONS_SEARCH tool. Also, after installing, enable the integration using the INTEGRATION_ENABLE tool.",
  inputSchema: z.object({
    id: z
      .string()
      .describe(
        "The id of the integration to install. To know the available ids, use the DECO_INTEGRATIONS_SEARCH tool",
      ),
    provider: z
      .string()
      .optional()
      .describe(
        "The provider of the integration to install. To know the available providers, use the DECO_INTEGRATIONS_SEARCH tool",
      ),
    appId: z
      .string()
      .optional()
      .describe(
        "The id of the app to install the integration for. To know the available app ids, use the DECO_INTEGRATIONS_SEARCH tool",
      ),
  }),
  outputSchema: z.object({
    installationId: z
      .string()
      .describe(
        "The id of the installation. Use this id to enable the integration using the DECO_INTEGRATIONS_SEARCH tool",
      ),
  }),
  handler: async (args, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    let integration: Integration;
    const virtual = virtualInstallableIntegrations().find(
      (i) => i.id === args.id || i.id === args.appId,
    );
    if (virtual) {
      const workspaceMcp = new URL(
        `${c.workspace.value}/${virtual.group}/mcp`,
        DECO_CHAT_API,
      );
      workspaceMcp.searchParams.set("group", virtual.group);

      integration = {
        id: crypto.randomUUID(),
        name: virtual.name,
        description: virtual.description,
        icon: virtual.icon,
        connection: {
          type: "HTTP",
          url: workspaceMcp.href,
        },
      };
    } else if (args.provider === MARKETPLACE_PROVIDER) {
      const app = await getRegistryApp.handler({ name: args.id });
      integration = {
        id: crypto.randomUUID(),
        name: app.friendlyName ?? `@${app.scopeName}/${app.name}`,
        appId: args.appId,
        description: app.description,
        icon: app.icon,
        connection: app.connection,
      };
    } else {
      const client = await getDecoRegistryServerClient();

      try {
        const result = await client.callTool(
          {
            name: "CONFIGURE",
            arguments: { id: args.id },
          },
          // @ts-expect-error should be fixed after this is merged: https://github.com/modelcontextprotocol/typescript-sdk/pull/528
          CallToolResultSchema,
        );

        const parsed = CONFIGURE_INTEGRATION_OUTPUT_SCHEMA.parse(
          result.structuredContent,
        );

        const id =
          parsed.installId ??
          (parsed.data?.connection as { token?: string })?.token ??
          crypto.randomUUID();

        client.close();
        integration = {
          id,
          ...(parsed.data as Omit<Integration, "id">),
        };
      } finally {
        client.close();
      }
    }
    const created = await createIntegration.handler(integration);

    if (!created?.id) {
      throw new Error("Failed to create integration");
    }

    return { installationId: created.id };
  },
});

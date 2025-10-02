import {
  createServerClient as createMcpServerClient,
  listToolsByConnectionType,
  patchApiDecoChatTokenHTTPConnection,
  isApiDecoChatMCPConnection as shouldPatchDecoChatMCPConnection,
} from "@deco/ai/mcp";
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { and, eq, or } from "drizzle-orm";
import { z } from "zod";
import { AppName } from "../../common/index.ts";
import {
  KNOWLEDGE_BASE_GROUP,
  WELL_KNOWN_KNOWLEDGE_BASE_CONNECTION_ID_STARTSWITH,
} from "../../constants.ts";
import type { MCPTool } from "../../hooks/tools.ts";
import {
  type Agent,
  AgentSchema,
  BindingsSchema,
  DECO_CMS_API_URL,
  INNATE_INTEGRATIONS,
  type Integration,
  IntegrationSchema,
  Locator,
  LocatorStructured,
  type MCPConnection,
  NEW_INTEGRATION_TEMPLATE,
  ProjectLocator,
  UserInputError,
  WellKnownMcpGroups,
} from "../../index.ts";
import { CallToolResultSchema } from "../../models/tool-call.ts";
import type { Workspace } from "../../path.ts";
import { Json } from "../../storage/index.ts";
import type { QueryResult } from "../../storage/supabase/client.ts";
import { KnowledgeBaseID } from "../../utils/index.ts";
import {
  IMPORTANT_ROLES,
  matchByWorkspaceOrProjectLocatorForAgents,
} from "../agents/api.ts";
import {
  assertHasLocator,
  assertHasWorkspace,
  assertWorkspaceResourceAccess,
} from "../assertions.ts";
import { getAppNameFromGroup, getGroups } from "../groups.ts";
import {
  AppContext,
  Binding,
  createToolGroup,
  MCPClient,
  NotFoundError,
  WellKnownBindings,
} from "../index.ts";
import { listKnowledgeBases } from "../knowledge/api.ts";
import { getProjectIdFromContext } from "../projects/util.ts";
import {
  getRegistryApp,
  listRegistryApps,
  RegistryApp,
} from "../registry/api.ts";
import {
  agents,
  integrations,
  organizations,
  projects,
  registryApps,
  registryScopes,
  registryTools,
} from "../schema.ts";
import { createServerClient } from "../utils.ts";

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

/**
 * Returns a Drizzle OR condition that filters Integrations by workspace or project locator.
 * This version works with queries that don't include the agents table.
 */
export const matchByWorkspaceOrProjectLocatorForIntegrations = (
  workspace: string,
  locator?: LocatorStructured,
) => {
  return or(
    eq(integrations.workspace, workspace),
    locator
      ? and(
          eq(projects.slug, locator.project),
          eq(organizations.slug, locator.org),
        )
      : undefined,
  );
};

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
    appName = AppName.build(appScope, registryName);
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
      url: new URL(`${workspace}/agents/${agent.id}/mcp`, DECO_CMS_API_URL)
        .href,
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

async function listToolsAndSortByName(
  {
    connection,
    ignoreCache,
  }: { connection: MCPConnection; ignoreCache?: boolean },
  c: AppContext,
) {
  const result = await listToolsByConnectionType(connection, c, ignoreCache);

  // Sort tools by name for consistent UI
  if (Array.isArray(result?.tools)) {
    result.tools.sort((a, b) => a.name.localeCompare(b.name));
  }

  return result;
}

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
  handler: (props, c) => {
    c.resourceAccess.grant();

    return listToolsAndSortByName(props, c);
  },
});

const toKbIntegration = (
  kb: string,
  locator: ProjectLocator,
  token?: string,
) => {
  const { url: workspaceMcpUrl } = projectUrlFromLocator(locator);
  const url = new URL(workspaceMcpUrl);
  url.searchParams.set("group", KNOWLEDGE_BASE_GROUP);
  url.searchParams.set("name", kb);
  return {
    id: kb,
    name: `${KnowledgeBaseID.parse(kb)} (Knowledge Base)`,
    description: "Ingest, search, and manage contextual data.",
    connection: {
      type: "HTTP",
      url: url.href,
      token,
    },
    icon: "https://assets.decocache.com/mcp/1b6e79a9-7830-459c-a1a6-ba83e7e58cbe/Knowledge-Base.png",
    workspace: Locator.adaptToRootSlug(locator),
    created_at: new Date().toISOString(),
  };
};

const projectUrlFromLocator = (locator: ProjectLocator) => {
  const projectPath = `/${
    locator.startsWith("/") ? locator.slice(1) : locator
  }`;
  return { url: new URL(`${projectPath}/mcp`, DECO_CMS_API_URL), projectPath };
};

const virtualIntegrationsFor = (
  locator: ProjectLocator,
  knowledgeBases: string[],
  token?: string,
) => {
  // Create a virtual User Management integration
  const decoChatMcp = new URL("/mcp", DECO_CMS_API_URL);
  const userManagementIntegration = {
    id: formatId("i", WellKnownMcpGroups.User),
    name: "User Management",
    description: "Manage your teams, invites and profile",
    connection: {
      type: "HTTP",
      url: decoChatMcp.href,
      token,
    },
    icon: "https://i.imgur.com/GD4o7vx.png",
    workspace: Locator.adaptToRootSlug(locator),
    created_at: new Date().toISOString(),
  };
  const { url: workspaceMcp, projectPath } = projectUrlFromLocator(locator);

  const contractsMcp = new URL("/contracts/mcp", DECO_CMS_API_URL);
  const contractsIntegration = {
    id: formatId("i", WellKnownMcpGroups.Contracts),
    name: "Contracts Management",
    description: "Manage your contracts",
    connection: {
      type: "HTTP",
      url: contractsMcp.href,
      token,
    },
    workspace: Locator.adaptToRootSlug(locator),
    created_at: new Date().toISOString(),
  };

  const workflowsMcp = new URL(
    `${projectPath}/${WellKnownMcpGroups.Workflows}/mcp`,
    DECO_CMS_API_URL,
  );

  const workflowsIntegration = {
    id: formatId("i", WellKnownMcpGroups.Workflows),
    name: "Workflows Management",
    description: "Manage your workflows",
    connection: {
      type: "HTTP",
      url: workflowsMcp.href,
      token,
    },
    icon: "https://assets.decocache.com/mcp/81d602bb-45e2-4361-b52a-23379520a34d/sandbox.png",
    workspace: Locator.adaptToRootSlug(locator),
    created_at: new Date().toISOString(),
  };

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
    workspace: Locator.adaptToRootSlug(locator),
    created_at: new Date().toISOString(),
  };

  const integrationGroups = Object.entries(getGroups()).map(
    ([group, { name, description, icon, workspace }]) => {
      const url =
        workspace === false ? new URL(decoChatMcp) : new URL(workspaceMcp);
      url.searchParams.set("group", group);
      const app = getAppNameFromGroup(group);
      return {
        id: formatId("i", group),
        name,
        icon,
        description,
        appName: app ? AppName.build("deco", app) : undefined,
        connection: {
          type: "HTTP",
          url: url.href,
          token,
        },
        workspace: Locator.adaptToRootSlug(locator),
        created_at: new Date().toISOString(),
      };
    },
  );

  return [
    userManagementIntegration,
    workspaceManagementIntegration,
    ...integrationGroups,
    workflowsIntegration,
    contractsIntegration,
    ...knowledgeBases.map((kb) => {
      return toKbIntegration(KnowledgeBaseID.format(kb), locator, token);
    }),
  ];
};

const registryToolToMcpTool = (tool: {
  name: string;
  description: string | null;
  input_schema: Json;
  output_schema: Json;
}): MCPTool => ({
  name: tool.name,
  description: tool.description || undefined,
  inputSchema: (tool.input_schema as Record<string, unknown>) || {},
  outputSchema: (tool.output_schema as Record<string, unknown>) || undefined,
});

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

  return registryTools?.map(registryToolToMcpTool) || null;
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
    assertHasLocator(c);
    const workspace = c.workspace.value;

    await assertWorkspaceResourceAccess(c);

    const [integrationsData, agentsData, knowledgeBases] = await Promise.all([
      // Query integrations with all necessary joins
      c.drizzle
        .select({
          id: integrations.id,
          name: integrations.name,
          description: integrations.description,
          icon: integrations.icon,
          connection: integrations.connection,
          created_at: integrations.created_at,
          workspace: integrations.workspace,
          access: integrations.access,
          access_id: integrations.access_id,
          app_id: integrations.app_id,
          project_id: integrations.project_id,
          // Registry app fields
          registry_app_name: registryApps.name,
          registry_scope_name: registryScopes.scope_name,
          // Tool fields
          tool_id: registryTools.id,
          tool_name: registryTools.name,
          tool_description: registryTools.description,
          tool_input_schema: registryTools.input_schema,
          tool_output_schema: registryTools.output_schema,
        })
        .from(integrations)
        .leftJoin(projects, eq(integrations.project_id, projects.id))
        .leftJoin(organizations, eq(projects.org_id, organizations.id))
        .leftJoin(registryApps, eq(integrations.app_id, registryApps.id))
        .leftJoin(registryScopes, eq(registryApps.scope_id, registryScopes.id))
        .leftJoin(registryTools, eq(registryApps.id, registryTools.app_id))
        .where(
          matchByWorkspaceOrProjectLocatorForIntegrations(workspace, c.locator),
        )
        .then((rows) => {
          const byIntegration = new Map<
            string,
            QueryResult<
              "deco_chat_integrations",
              typeof SELECT_INTEGRATION_QUERY
            >
          >();
          for (const row of rows) {
            const tool = row.tool_id
              ? {
                  name: row.tool_name!,
                  description: row.tool_description,
                  input_schema: row.tool_input_schema,
                  output_schema: row.tool_output_schema,
                }
              : null;
            const existing = byIntegration.get(row.id);
            if (!existing) {
              byIntegration.set(row.id, {
                ...row,
                created_at:
                  row.created_at?.toISOString() || new Date().toISOString(),
                deco_chat_apps_registry: row.registry_app_name
                  ? {
                      name: row.registry_app_name,
                      deco_chat_registry_scopes: row.registry_scope_name
                        ? { scope_name: row.registry_scope_name }
                        : null,
                      deco_chat_apps_registry_tools: tool ? [tool] : [],
                    }
                  : null,
                connection: row.connection as Json,
              } as unknown as QueryResult<
                "deco_chat_integrations",
                typeof SELECT_INTEGRATION_QUERY
              >);
            } else if (tool && existing.deco_chat_apps_registry) {
              (
                existing.deco_chat_apps_registry
                  .deco_chat_apps_registry_tools as unknown[]
              ).push(tool);
            }
          }
          return Array.from(byIntegration.values());
        }),
      // Query agents
      c.drizzle
        .select({
          id: agents.id,
          name: agents.name,
          avatar: agents.avatar,
          instructions: agents.instructions,
          description: agents.description,
          tools_set: agents.tools_set,
          max_steps: agents.max_steps,
          max_tokens: agents.max_tokens,
          model: agents.model,
          memory: agents.memory,
          views: agents.views,
          created_at: agents.created_at,
          workspace: agents.workspace,
          temperature: agents.temperature,
          visibility: agents.visibility,
          access: agents.access,
          access_id: agents.access_id,
          project_id: projects.id,
          org_id: organizations.id,
        })
        .from(agents)
        .leftJoin(projects, eq(agents.project_id, projects.id))
        .leftJoin(organizations, eq(projects.org_id, organizations.id))
        .where(matchByWorkspaceOrProjectLocatorForAgents(workspace, c.locator))
        .then((result) => ({ data: result })),
      listKnowledgeBases.handler({}),
    ]);
    const roles =
      c.workspace.root === "users"
        ? []
        : await c.policy.getUserRoles(c.user.id as string, c.workspace.slug);
    const userRoles: string[] = roles?.map((role) => role?.name);

    // TODO: This is a temporary solution to filter integrations and agents by access.
    const filteredIntegrations = integrationsData.filter(
      (integration) =>
        !integration.access ||
        userRoles?.includes(integration.access) ||
        userRoles?.some((role) => IMPORTANT_ROLES.includes(role)),
    );

    const filteredAgents = agentsData.data.filter(
      (agent) =>
        !agent.access ||
        userRoles?.includes(agent.access) ||
        userRoles?.some((role) => IMPORTANT_ROLES.includes(role)),
    );

    // Build the result with all integrations
    const baseResult = [
      ...virtualIntegrationsFor(
        c.locator.value,
        knowledgeBases.names ?? [],
        c.token,
      ),
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
    const result = await Promise.all(
      baseResult.map(async (integration) => {
        // Find the corresponding database record to extract tools
        const dbRecord = filteredIntegrations.find(
          (dbIntegration) => formatId("i", dbIntegration.id) === integration.id,
        );

        const { connection } = integration;

        const isVirtual =
          connection.type === "HTTP" &&
          connection.url.startsWith(DECO_CMS_API_URL);

        const tools = isVirtual
          ? await listToolsAndSortByName({ connection, ignoreCache: false }, c)
              .then((r) => r?.tools ?? null)
              .catch(() => {
                console.error(
                  "Error listing tools for virtual integration",
                  connection,
                );
                return null;
              })
          : dbRecord
            ? extractToolsFromRegistry(dbRecord)
            : null;

        return {
          ...integration,
          tools: tools as z.infer<typeof IntegrationSchema>["tools"],
        };
      }),
    );

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
    assertHasLocator(c);

    if (
      formatId(type, uuid).startsWith(
        WELL_KNOWN_KNOWLEDGE_BASE_CONNECTION_ID_STARTSWITH,
      )
    ) {
      const parsed = IntegrationSchema.parse({
        ...toKbIntegration(uuid, c.locator.value, c.token),
        id: formatId(type, id),
      });
      return {
        ...parsed,
        tools: null,
      };
    }
    assertHasWorkspace(c);

    if (uuid in INNATE_INTEGRATIONS) {
      const data =
        INNATE_INTEGRATIONS[uuid as keyof typeof INNATE_INTEGRATIONS];
      const baseIntegration = IntegrationSchema.parse({
        ...data,
        id: formatId(type, data.id),
      });
      return { ...baseIntegration, tools: null }; // Innate integrations don't have tools for now
    }

    const selectPromise =
      type === "i"
        ? c.drizzle
            .select({
              id: integrations.id,
              name: integrations.name,
              description: integrations.description,
              icon: integrations.icon,
              connection: integrations.connection,
              created_at: integrations.created_at,
              workspace: integrations.workspace,
              access: integrations.access,
              access_id: integrations.access_id,
              project_id: projects.id,
              org_id: organizations.id,
              // Registry app fields
              registry_app_name: registryApps.name,
              registry_scope_name: registryScopes.scope_name,
              // Tool fields
              tool_id: registryTools.id,
              tool_name: registryTools.name,
              tool_description: registryTools.description,
              tool_input_schema: registryTools.input_schema,
              tool_output_schema: registryTools.output_schema,
            })
            .from(integrations)
            .leftJoin(projects, eq(integrations.project_id, projects.id))
            .leftJoin(organizations, eq(projects.org_id, organizations.id))
            .leftJoin(registryApps, eq(integrations.app_id, registryApps.id))
            .leftJoin(
              registryScopes,
              eq(registryApps.scope_id, registryScopes.id),
            )
            .leftJoin(registryTools, eq(registryApps.id, registryTools.app_id))
            .where(
              and(
                eq(integrations.id, uuid),
                matchByWorkspaceOrProjectLocatorForIntegrations(
                  c.workspace.value,
                  c.locator,
                ),
              ),
            )
            .then((rows) => {
              if (!rows.length) return null;

              // Group tools by integration
              const baseRow = rows[0];
              const tools = rows
                .filter((row) => row.tool_id) // Only include rows with tools
                .map((row) => ({
                  name: row.tool_name!,
                  description: row.tool_description,
                  input_schema: row.tool_input_schema,
                  output_schema: row.tool_output_schema,
                }));

              return {
                ...baseRow,
                deco_chat_apps_registry: baseRow.registry_app_name
                  ? {
                      name: baseRow.registry_app_name,
                      deco_chat_registry_scopes: baseRow.registry_scope_name
                        ? {
                            scope_name: baseRow.registry_scope_name,
                          }
                        : null,
                      deco_chat_apps_registry_tools:
                        tools.length > 0 ? tools : null,
                    }
                  : null,
              };
            })
        : c.drizzle
            .select({
              id: agents.id,
              name: agents.name,
              description: agents.description,
              avatar: agents.avatar,
              created_at: agents.created_at,
              workspace: agents.workspace,
              access: agents.access,
              access_id: agents.access_id,
              project_id: projects.id,
              org_id: organizations.id,
            })
            .from(agents)
            .leftJoin(projects, eq(agents.project_id, projects.id))
            .leftJoin(organizations, eq(projects.org_id, organizations.id))
            .where(
              and(
                eq(agents.id, uuid),
                matchByWorkspaceOrProjectLocatorForAgents(
                  c.workspace.value,
                  c.locator,
                ),
              ),
            )
            .limit(1)
            .then((r) => r[0]);

    const virtualIntegrations = virtualIntegrationsFor(
      c.locator.value,
      [],
      c.token,
    );

    if (virtualIntegrations.some((i) => i.id === id)) {
      const baseIntegration = IntegrationSchema.parse({
        ...virtualIntegrations.find((i) => i.id === id),
        id: formatId(type, id),
      });
      return {
        ...baseIntegration,
        tools: await listToolsAndSortByName(
          { connection: baseIntegration.connection, ignoreCache: false },
          c,
        ).then((r) => r?.tools as z.infer<typeof IntegrationSchema>["tools"]),
      };
    }

    const data = await selectPromise;

    if (!data) {
      throw new NotFoundError("Integration not found");
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

    // Cast the data to match the expected format for compatibility
    const integrationData = {
      ...data,
      deco_chat_apps_registry:
        "deco_chat_apps_registry" in data ? data.deco_chat_apps_registry : null,
    } as unknown as QueryResult<
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

export type IntegrationWithTools = Awaited<
  ReturnType<(typeof getIntegration)["handler"]>
>;

export const createIntegration = createIntegrationManagementTool({
  name: "INTEGRATIONS_CREATE",
  description: "Create a new integration",
  inputSchema: IntegrationSchema.partial()
    // TODO(@camudo): Remember why we omit this here and unify install process
    .omit({ appName: true })
    .extend({
      clientIdFromApp: z.string().optional(),
    }),
  handler: async (_integration, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    const { appId, clientIdFromApp, ...integration } = _integration;
    const baseIntegration = {
      ...NEW_INTEGRATION_TEMPLATE,
      ...integration,
      workspace: c.workspace.value,
      id: integration.id ? parseId(integration.id).uuid : undefined,
    };

    const fetchedApp = clientIdFromApp
      ? await getRegistryApp.handler({ name: clientIdFromApp })
      : undefined;

    const projectId = await getProjectIdFromContext(c);

    const payload = {
      ...baseIntegration,
      app_id: appId ?? fetchedApp?.id,
      project_id: projectId,
    };

    const existingIntegration = payload.id
      ? await c.drizzle
          .select({
            id: integrations.id,
          })
          .from(integrations)
          .leftJoin(projects, eq(integrations.project_id, projects.id))
          .leftJoin(organizations, eq(projects.org_id, organizations.id))
          .where(
            and(
              eq(integrations.id, payload.id),
              matchByWorkspaceOrProjectLocatorForIntegrations(
                c.workspace.value,
                c.locator,
              ),
            ),
          )
          .limit(1)
          .then((r) => r[0])
      : null;

    if (existingIntegration) {
      const [data] = await c.drizzle
        .update(integrations)
        .set(payload)
        .where(
          and(
            eq(integrations.id, existingIntegration.id),
            or(
              eq(integrations.workspace, c.workspace.value),
              projectId ? eq(integrations.project_id, projectId) : undefined,
            ),
          ),
        )
        .returning();

      return IntegrationSchema.parse({
        ...data,
        id: formatId("i", data.id),
      });
    }

    const [data] = await c.drizzle
      .insert(integrations)
      .values(payload)
      .returning();

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
    assertHasLocator(c);

    const { uuid, type } = parseId(id);

    if (type === "a") {
      throw new UserInputError("Cannot update an agent integration");
    }

    const { name, description, icon, connection, access, appId } = integration;

    // For UPDATE queries with joins, we need to use a different approach
    // First, let's get the project ID if we have a locator
    const projectId = c.locator ? await getProjectIdFromContext(c) : null;

    const [data] = await c.drizzle
      .update(integrations)
      .set({
        name,
        description,
        icon,
        connection,
        access,
        app_id: appId,
        id: uuid,
      })
      .where(
        and(
          eq(integrations.id, uuid),
          or(
            eq(integrations.workspace, c.workspace.value),
            projectId ? eq(integrations.project_id, projectId) : undefined,
          ),
        ),
      )
      .returning();

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

    // For UPDATE queries with joins, we need to use a different approach
    // First, let's get the project ID if we have a locator
    const projectId = c.locator ? await getProjectIdFromContext(c) : null;

    await c.drizzle
      .delete(integrations)
      .where(
        and(
          eq(integrations.id, uuid),
          or(
            eq(integrations.workspace, c.workspace.value),
            projectId ? eq(integrations.project_id, projectId) : undefined,
          ),
        ),
      );

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
      connection: {
        type: "HTTP",
        url: "https://mcp.deco.site/mcp/messages",
      } as MCPConnection,
    },
  ];
};

const appIsContract = (app: RegistryApp) => {
  return app.metadata?.contract !== undefined;
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
    showContracts: z
      .boolean()
      .describe("Whether to show contracts")
      .optional()
      .default(false),
  }),
  outputSchema: z.object({
    integrations: z
      .array(
        IntegrationSchema.and(
          z.object({
            provider: z.string(),
            friendlyName: z.string().optional(),
          }),
        ),
      )
      .describe("The Integrations that match the query"),
  }),
  handler: async ({ query, showContracts }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    const registry = await listRegistryApps.handler({
      search: query,
    });

    const registryList = registry.apps
      .map((app) => {
        if (!showContracts && appIsContract(app)) {
          return null;
        }
        return {
          id: app.id,
          name: AppName.build(app.scopeName, app.name),
          friendlyName: app.friendlyName,
          description: app.description,
          icon: app.icon,
          provider: MARKETPLACE_PROVIDER,
          metadata: app.metadata,
          verified: app.verified,
          connection:
            app.connection || ({ type: "HTTP", url: "" } as MCPConnection),
        };
      })
      .filter((app) => app !== null);

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
    if (provider === MARKETPLACE_PROVIDER) {
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

export const DECO_GET_APP_SCHEMA = createIntegrationManagementTool({
  name: "DECO_GET_APP_SCHEMA",
  description: "Get the schema for a marketplace app",
  inputSchema: z.object({
    appName: z.string(),
  }),
  outputSchema: z.object({
    schema: z.unknown(),
    scopes: z.array(z.string()).optional(),
  }),
  handler: async ({ appName }, c) => {
    // Anyone can get the schema for an app
    c.resourceAccess.grant();
    assertHasWorkspace(c);

    const app = await getRegistryApp.handler({ name: appName });
    const connection = app.connection;

    const result = (await MCPClient.INTEGRATIONS_CALL_TOOL({
      connection,
      params: {
        name: "DECO_CHAT_OAUTH_START",
        arguments: {
          returnUrl: "",
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

    if ("redirectUrl" in result.structuredContent) {
      throw new Error("Redirect URL returned, but we expected a state schema");
    }

    return {
      schema: result.structuredContent.stateSchema,
      scopes: result.structuredContent.scopes,
    };
  },
});

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
        DECO_CMS_API_URL,
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
        name: app.friendlyName ?? AppName.build(app.scopeName, app.name),
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

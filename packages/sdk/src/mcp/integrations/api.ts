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
  BindingsSchema,
  INNATE_INTEGRATIONS,
  Integration,
  IntegrationSchema,
  InternalServerError,
  NEW_INTEGRATION_TEMPLATE,
  UserInputError,
} from "../../index.ts";
import { CallToolResultSchema } from "../../models/tool-call.ts";
import type { Workspace } from "../../path.ts";
import { QueryResult } from "../../storage/supabase/client.ts";
import {
  Access,
  createAccess,
  restoreAccessTypes,
  updateAccess,
  withAccessSchema,
} from "../access.ts";
import { IMPORTANT_ROLES, listAgents } from "../agents/api.ts";
import {
  assertHasWorkspace,
  assertWorkspaceResourceAccess,
} from "../assertions.ts";
import { createTool } from "../context.ts";
import { Binding, NotFoundError, WellKnownBindings } from "../index.ts";
import { KNOWLEDGE_BASE_GROUP, listKnowledgeBases } from "../knowledge/api.ts";

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
    access: agent.access,
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

const isAccessGranted = (
  access: Pick<Access, "visibility" | "owner_id">,
  userId: unknown,
  canAccessResource: boolean,
) =>
  access.visibility === "public" ||
  (access.visibility === "private" && access.owner_id === userId) ||
  (access.visibility === "role_based" && canAccessResource);

const DEFAULT_ACCESS: Pick<
  Access,
  "visibility" | "owner_id" | "allowed_roles"
> = {
  owner_id: "",
  allowed_roles: [],
  visibility: "role_based",
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

    const [
      canAccess,
      integrations,
      agents,
      knowledgeBases,
    ] = await Promise.all([
      assertWorkspaceResourceAccess(c.tool.name, c)
        .then(() => true).catch(() => false),
      c.db
        .from("deco_chat_integrations")
        .select(`
          *, 
          access:deco_chat_access(
            visibility, 
            owner_id, 
            allowed_roles
          )
        `)
        .ilike("workspace", workspace),
      listAgents.handler({}),
      listKnowledgeBases.handler({}),
    ]);

    if (integrations.error) {
      throw new InternalServerError(
        integrations.error.message || "Failed to list integrations",
      );
    }

    // TODO: This is a temporary solution to filter integrations and agents by access.
    const filteredIntegrations = integrations.data.filter((integration) =>
      isAccessGranted(
        integration.access ?? DEFAULT_ACCESS,
        c.user?.id,
        canAccess,
      )
    );

    const filteredAgents = agents.structuredContent ?? [];

    const result = [
      ...virtualIntegrationsFor(
        workspace,
        knowledgeBases.structuredContent?.names ?? [],
      ),
      ...filteredIntegrations.map((item) => ({
        ...item,
        id: formatId("i", item.id),
        access: restoreAccessTypes(item.access),
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
          new Promise<{ isError: true }>((resolve) =>
            setTimeout(() =>
              resolve({
                isError: true,
              }), 7_000)
          ),
        ]);
        if (integrationTools.isError) {
          return;
        }
        const tools = integrationTools.structuredContent?.tools ?? [];
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
    const isInnate = id in INNATE_INTEGRATIONS;

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
      .select(`
        *, 
        access:deco_chat_access(
          visibility, 
          owner_id, 
          allowed_roles
        )
      `)
      .eq("id", uuid)
      .single().then((r) => r);
    const knowledgeBases = await listKnowledgeBases.handler({});
    const virtualIntegrations = virtualIntegrationsFor(
      c.workspace.value,
      knowledgeBases.structuredContent?.names ?? [],
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

    if (
      !isAccessGranted(data.access ?? DEFAULT_ACCESS, c.user?.id, canAccess)
    ) {
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
      access: restoreAccessTypes(data.access),
    });
  },
});

export const createIntegration = createTool({
  name: "INTEGRATIONS_CREATE",
  description: "Create a new integration",
  inputSchema: withAccessSchema(IntegrationSchema.partial()),
  handler: async ({ access, ...integration }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c.tool.name, c);

    const accessData = await createAccess(c, access || ["private"]);

    const { data, error } = await c.db
      .from("deco_chat_integrations")
      .insert({
        ...NEW_INTEGRATION_TEMPLATE,
        ...integration,
        access: null,
        access_id: accessData.id,
        workspace: c.workspace.value,
      })
      .select()
      .single();

    if (error || !data) {
      throw new InternalServerError(error.message);
    }

    return IntegrationSchema.parse({
      ...data,
      id: formatId("i", data.id),
      access: restoreAccessTypes(accessData),
    });
  },
});

export const updateIntegration = createTool({
  name: "INTEGRATIONS_UPDATE",
  description: "Update an existing integration",
  inputSchema: z.object({
    id: z.string(),
    integration: withAccessSchema(IntegrationSchema.partial()),
  }),
  handler: async ({ id, integration: { access, ...integration } }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c.tool.name, c);

    const { uuid, type } = parseId(id);

    if (type === "a") {
      throw new UserInputError("Cannot update an agent integration");
    }

    // First get the current integration to check if it exists and get its access_id
    const { data: existing, error: fetchError } = await c.db
      .from("deco_chat_integrations")
      .select("access_id")
      .eq("id", uuid)
      .single();

    if (fetchError) {
      throw new InternalServerError(fetchError.message);
    }

    if (!existing) {
      throw new NotFoundError("Integration not found");
    }

    // Handle access creation/update
    const accessData = existing.access_id
      ? await updateAccess(c, existing.access_id, access || ["private"])
      : await createAccess(c, access || ["private"]); // backwards compatibility

    // Update the integration with the new access_id
    const { data, error } = await c.db
      .from("deco_chat_integrations")
      .update({
        ...integration,
        id: uuid,
        workspace: c.workspace.value,
        access_id: accessData.id,
      })
      .eq("id", uuid)
      .select()
      .single();

    if (error) {
      throw new InternalServerError(error.message);
    }

    return IntegrationSchema.parse({
      ...data,
      id: formatId(type, data.id),
      access: restoreAccessTypes(accessData),
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

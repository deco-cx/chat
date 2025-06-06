import { PostgrestError } from "@supabase/supabase-js";
import { z } from "zod";
import {
  Agent,
  AgentSchema,
  NEW_AGENT_TEMPLATE,
  WELL_KNOWN_AGENTS,
} from "../../index.ts";
import {
  type Access,
  createAccess,
  restoreAccessTypes,
  updateAccess,
  withAccessSchema,
} from "../access.ts";
import {
  assertHasWorkspace,
  assertPrincipalIsUser,
  assertWorkspaceResourceAccess,
} from "../assertions.ts";
import { AppContext, createTool } from "../context.ts";
import {
  ForbiddenError,
  InternalServerError,
  NotFoundError,
} from "../index.ts";
import { deleteTrigger, listTriggers } from "../triggers/api.ts";

const NO_DATA_ERROR = "PGRST116";

export const getAgentsByIds = async (
  ids: string[],
  c: AppContext,
) => {
  assertHasWorkspace(c);

  if (ids.length === 0) return [];

  const dbIds = ids.filter((id) => !(id in WELL_KNOWN_AGENTS));

  let dbAgents: z.infer<typeof AgentSchema>[] = [];
  if (dbIds.length > 0) {
    const { data, error } = await c.db
      .from("deco_chat_agents")
      .select("*")
      .in("id", dbIds)
      .eq("workspace", c.workspace.value);

    if (error) {
      throw error;
    }

    dbAgents = data.map((item) => AgentSchema.parse(item));
  }

  return ids
    .map((id) => {
      if (id in WELL_KNOWN_AGENTS) {
        return AgentSchema.parse(
          WELL_KNOWN_AGENTS[id as keyof typeof WELL_KNOWN_AGENTS],
        );
      }
      return dbAgents.find((agent) => agent.id === id);
    })
    .filter((a): a is z.infer<typeof AgentSchema> => !!a);
};

export const IMPORTANT_ROLES = ["owner", "admin"];

const isAccessGranted = (
  access: Pick<Access, "visibility" | "owner_id">,
  userId: unknown,
  canAccessResource: boolean,
) =>
  access.visibility === "public" ||
  (access.visibility === "private" && access.owner_id === userId) ||
  (access.visibility === "role_based" && canAccessResource);

const getAccess = (
  agent: {
    visibility: "PUBLIC" | "PRIVATE" | "WORKSPACE";
    access?:
      | Pick<Access, "visibility" | "owner_id" | "allowed_roles">
      | null;
  },
  ownerId: unknown,
): Pick<Access, "visibility" | "owner_id" | "allowed_roles"> => {
  return agent?.access ?? {
    owner_id: typeof ownerId === "string" ? ownerId : "",
    allowed_roles: [],
    visibility: agent?.visibility === "PUBLIC"
      ? "public"
      : agent?.visibility === "PRIVATE"
      ? "private"
      : "role_based",
  } ?? {
    owner_id: "",
    allowed_roles: [],
    visibility: "role_based",
  };
};

export const listAgents = createTool({
  name: "AGENTS_LIST",
  description: "List all agents",
  inputSchema: z.object({}),
  handler: async (_, c) => {
    assertHasWorkspace(c);
    assertPrincipalIsUser(c);

    const [canAccessResource, { data, error }] = await Promise.all([
      assertWorkspaceResourceAccess(c.tool.name, c)
        .then(() => true)
        .catch(() => false),
      c.db
        .from("deco_chat_agents")
        .select(`
          *,
          access:deco_chat_access(
            visibility,
            owner_id,
            allowed_roles
          )
        `)
        .ilike("workspace", c.workspace.value),
    ]);

    if (error) {
      throw new InternalServerError(error.message);
    }

    return data
      .reduce((acc, item) => {
        const access = getAccess(item, c.user?.id);
        const parsed = AgentSchema.safeParse({
          ...item,
          access: restoreAccessTypes(access),
        });
        const accessGranted = isAccessGranted(
          access,
          c.user.id,
          canAccessResource,
        );

        if (accessGranted && parsed.data) {
          acc.push(parsed.data);
        }

        return acc;
      }, [] as Agent[]);
  },
});

export const getAgent = createTool({
  name: "AGENTS_GET",
  description: "Get an agent by id",
  inputSchema: z.object({ id: z.string() }),
  handler: async ({ id }, c) => {
    assertHasWorkspace(c);

    // This means auth will be handled later on this function's body
    c.resourceAccess.grant();

    // Built-in agents are always public
    if (id in WELL_KNOWN_AGENTS) {
      return AgentSchema.parse(
        WELL_KNOWN_AGENTS[id as keyof typeof WELL_KNOWN_AGENTS],
      );
    }

    const [
      canAccess,
      { data: agentData, error: agentError },
    ] = await Promise.all([
      assertWorkspaceResourceAccess(c.tool.name, c)
        .then(() => true).catch(() => false),
      c.db
        .from("deco_chat_agents")
        .select(`
            *,
            access:deco_chat_access(
              visibility,
              owner_id,
              allowed_roles
            )
          `)
        .eq("workspace", c.workspace.value)
        .eq("id", id)
        .single(),
    ]);

    if ((agentError && agentError.code == NO_DATA_ERROR) || !agentData) {
      throw new NotFoundError(id);
    }

    if (agentError) {
      throw new InternalServerError((agentError as PostgrestError).message);
    }

    const access = getAccess(agentData, c.user?.id);

    if (!isAccessGranted(access, c.user?.id, canAccess)) {
      throw new ForbiddenError(`You are not allowed to access this agent`);
    }

    return AgentSchema.parse({
      ...agentData,
      access: restoreAccessTypes(access),
    });
  },
});

export const createAgent = createTool({
  name: "AGENTS_CREATE",
  description: "Create a new agent",
  inputSchema: withAccessSchema(AgentSchema.partial()),
  handler: async ({ access, ...agent }, c) => {
    assertHasWorkspace(c);
    assertPrincipalIsUser(c);

    await assertWorkspaceResourceAccess(c.tool.name, c);

    const accessData = await createAccess(c, access || ["private"]);

    const { data, error: agentError } = await c.db
      .from("deco_chat_agents")
      .insert({
        ...NEW_AGENT_TEMPLATE,
        ...agent,
        access: null,
        access_id: accessData.id,
        workspace: c.workspace.value,
      })
      .select("*")
      .single();

    if (agentError || !data) {
      throw new InternalServerError(
        agentError?.message || "Failed to create agent",
      );
    }

    return AgentSchema.parse({
      ...data,
      access: restoreAccessTypes(accessData),
    });
  },
});

export const updateAgent = createTool({
  name: "AGENTS_UPDATE",
  description: "Update an existing agent",
  inputSchema: z.object({
    id: z.string(),
    agent: withAccessSchema(AgentSchema.partial()),
  }),
  handler: async ({ id, agent: { access, ...agent } }, c) => {
    assertHasWorkspace(c);

    await assertWorkspaceResourceAccess(c.tool.name, c);

    // First get the current agent to check if it exists and get its access_id
    const { data: existingAgent, error: fetchError } = await c.db
      .from("deco_chat_agents")
      .select("access_id")
      .eq("id", id)
      .single();

    if (fetchError) {
      throw new InternalServerError(fetchError.message);
    }

    if (!existingAgent) {
      throw new NotFoundError("Agent not found");
    }

    // Handle access creation/update
    const accessData = existingAgent.access_id
      ? await updateAccess(c, existingAgent.access_id, access || ["private"])
      : await createAccess(c, access || ["private"]); // backwards compatibility

    // Update the agent with the new access_id if needed
    const { data, error } = await c.db
      .from("deco_chat_agents")
      .update({
        ...agent,
        id,
        workspace: c.workspace.value,
        access_id: existingAgent.access_id || accessData.id,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new InternalServerError(error.message);
    }

    return AgentSchema.parse({
      ...data,
      access: restoreAccessTypes(accessData),
    });
  },
});

export const deleteAgent = createTool({
  name: "AGENTS_DELETE",
  description: "Delete an agent by id",
  inputSchema: z.object({ id: z.string() }),
  handler: async ({ id }, c) => {
    assertHasWorkspace(c);

    await assertWorkspaceResourceAccess(c.tool.name, c);

    const { error: agentError } = await c.db
      .from("deco_chat_agents")
      .delete()
      .eq("id", id);

    const triggers = await listTriggers.handler({ agentId: id });
    for (const trigger of triggers.structuredContent.triggers) {
      await deleteTrigger.handler({ agentId: id, triggerId: trigger.id });
    }

    if (agentError) {
      throw new InternalServerError(agentError.message);
    }

    return { deleted: true };
  },
});

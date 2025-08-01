import type { PostgrestError } from "@supabase/supabase-js";
import { z } from "zod";
import {
  AgentSchema,
  NEW_AGENT_TEMPLATE,
  WELL_KNOWN_AGENTS,
} from "../../index.ts";
import {
  assertHasWorkspace,
  assertWorkspaceResourceAccess,
  type WithTool,
} from "../assertions.ts";
import { type AppContext, createToolGroup } from "../context.ts";
import {
  ForbiddenError,
  InternalServerError,
  NotFoundError,
} from "../index.ts";
import { deleteTrigger, listTriggers } from "../triggers/api.ts";
const createTool = createToolGroup("Agent", {
  name: "Agent Management",
  description: "Manage your agents",
  icon: "https://assets.decocache.com/mcp/6f6bb7ac-e2bd-49fc-a67c-96d09ef84993/Agent-Management.png",
});

const NO_DATA_ERROR = "PGRST116";
export const getAgentsByIds = async (ids: string[], c: AppContext) => {
  assertHasWorkspace(c);

  if (ids.length === 0) return [];

  const dbIds = ids.filter((id) => !(id in WELL_KNOWN_AGENTS));

  let dbAgents: Omit<
    z.infer<typeof AgentSchema>,
    "instructions" | "memory" | "views" | "visibility" | "access"
  >[] = [];
  if (dbIds.length > 0) {
    const { data, error } = await c.db
      .from("deco_chat_agents")
      .select("id, name, description, tools_set, avatar")
      .in("id", dbIds)
      .eq("workspace", c.workspace.value);

    if (error) {
      throw error;
    }

    dbAgents = data.map((item) =>
      AgentSchema.omit({
        instructions: true,
        memory: true,
        views: true,
        visibility: true,
        access: true,
      }).parse(item),
    );
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

export const listAgents = createTool({
  name: "AGENTS_LIST",
  description: "List all agents",
  inputSchema: z.object({}),
  handler: async (_, c: WithTool<AppContext>) => {
    assertHasWorkspace(c);

    await assertWorkspaceResourceAccess({ resource: c.tool.name }, c);

    const { data, error } = await c.db
      .from("deco_chat_agents")
      .select("*")
      .ilike("workspace", c.workspace.value);

    if (error) {
      throw new InternalServerError(error.message);
    }

    const roles =
      c.workspace.root === "users"
        ? []
        : await c.policy.getUserRoles(c.user.id as string, c.workspace.slug);
    const userRoles: string[] = roles?.map((role) => role.name);

    const filteredAgents = data.filter(
      (agent) =>
        !agent.access ||
        userRoles?.includes(agent.access) ||
        userRoles?.some((role) => IMPORTANT_ROLES.includes(role)),
    );

    return filteredAgents
      .map((item) => AgentSchema.safeParse(item)?.data)
      .filter((a) => !!a);
  },
});

export const getAgent = createTool({
  name: "AGENTS_GET",
  description: "Get an agent by id",
  inputSchema: z.object({ id: z.string() }),
  handler: async ({ id }, c) => {
    assertHasWorkspace(c);

    const [canAccess, { data, error }] = await Promise.all([
      assertWorkspaceResourceAccess({ resource: c.tool.name }, c)
        .then(() => true)
        .catch(() => false),
      id in WELL_KNOWN_AGENTS
        ? Promise.resolve({
            data: WELL_KNOWN_AGENTS[id as keyof typeof WELL_KNOWN_AGENTS],
            error: null,
          })
        : c.db
            .from("deco_chat_agents")
            .select("*")
            .eq("workspace", c.workspace.value)
            .eq("id", id)
            .single(),
    ]);

    if ((error && error.code == NO_DATA_ERROR) || !data) {
      throw new NotFoundError(id);
    }

    if (data.visibility !== "PUBLIC" && !canAccess) {
      throw new ForbiddenError(`You are not allowed to access this agent`);
    }

    if (error) {
      throw new InternalServerError((error as PostgrestError).message);
    }

    c.resourceAccess.grant();

    return AgentSchema.parse(data);
  },
});

export const createAgent = createTool({
  name: "AGENTS_CREATE",
  description: "Create a new agent",
  inputSchema: AgentSchema.partial(),
  handler: async (agent, c) => {
    assertHasWorkspace(c);

    await assertWorkspaceResourceAccess({ resource: c.tool.name }, c);

    const [{ data, error }] = await Promise.all([
      c.db
        .from("deco_chat_agents")
        // @ts-ignore - @Camudo push your code
        .insert({
          ...NEW_AGENT_TEMPLATE,
          ...agent,
          workspace: c.workspace.value,
        })
        .select()
        .single(),
    ]);

    if (error) {
      throw new InternalServerError(error.message);
    }

    return AgentSchema.parse(data);
  },
});

export const createAgentSetupTool = createToolGroup("AgentSetup", {
  name: "Agent Setup",
  description:
    "Configure agent identity, update settings, and list available integrations.",
  icon: "https://assets.decocache.com/mcp/42dcf0d2-5a2f-4d50-87a6-0e9ebaeae9b5/Agent-Setup.png",
});

export const updateAgent = createAgentSetupTool({
  name: "AGENTS_UPDATE",
  description: "Update an existing agent",
  inputSchema: z.object({
    id: z.string(),
    agent: AgentSchema.partial(),
  }),
  handler: async ({ id, agent }, c) => {
    assertHasWorkspace(c);

    await assertWorkspaceResourceAccess({ resource: c.tool.name }, c);

    const { data, error } = await c.db
      .from("deco_chat_agents")
      .update({ ...agent, id, workspace: c.workspace.value })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new InternalServerError(error.message);
    }

    if (!data) {
      throw new NotFoundError("Agent not found");
    }

    return AgentSchema.parse(data);
  },
});

export const deleteAgent = createTool({
  name: "AGENTS_DELETE",
  description: "Delete an agent by id",
  inputSchema: z.object({ id: z.string() }),
  handler: async ({ id }, c) => {
    assertHasWorkspace(c);

    await assertWorkspaceResourceAccess({ resource: c.tool.name }, c);

    const { error } = await c.db.from("deco_chat_agents").delete().eq("id", id);

    const triggers = await listTriggers.handler({ agentId: id });

    for (const trigger of triggers.triggers) {
      await deleteTrigger.handler({ id: trigger.id });
    }

    // TODO: implement an way to remove knowledge base and it's files from asset and kb

    if (error) {
      throw new InternalServerError(error.message);
    }

    return { deleted: true };
  },
});

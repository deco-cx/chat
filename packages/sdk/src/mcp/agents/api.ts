import { PostgrestError } from "@supabase/supabase-js";
import { z } from "zod";
import {
  AgentSchema,
  NEW_AGENT_TEMPLATE,
  WELL_KNOWN_AGENTS,
} from "../../index.ts";
import {
  assertHasWorkspace,
  canAccessWorkspaceResource,
} from "../assertions.ts";
import { AppContext, createTool } from "../context.ts";
import { InternalServerError, NotFoundError } from "../index.ts";
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

export const listAgents = createTool({
  name: "AGENTS_LIST",
  description: "List all agents",
  inputSchema: z.object({}),
  canAccess: canAccessWorkspaceResource,
  handler: async (_, c) => {
    assertHasWorkspace(c);

    const { data, error } = await c.db
      .from("deco_chat_agents")
      .select("*")
      .ilike("workspace", c.workspace.value);

    if (error) {
      throw new InternalServerError(error.message);
    }

    return data
      .map((item) => AgentSchema.safeParse(item)?.data)
      .filter((a) => !!a);
  },
});

export const getAgent = createTool({
  name: "AGENTS_GET",
  description: "Get an agent by id",
  inputSchema: z.object({ id: z.string() }),
  async canAccess(name, props, c) {
    const hasAccess = await canAccessWorkspaceResource(name, props, c)
      .catch(() => false);

    if (hasAccess) {
      return true;
    }

    const { data: agentData } = await c.db
      .from("deco_chat_agents")
      .select("visibility")
      .eq("workspace", c.workspace!.value)
      .eq("id", props.id)
      .single();

    // TODO: implement this using authorization system
    if (agentData?.visibility === "PUBLIC") {
      return true;
    }

    return false;
  },
  handler: async ({ id }, c) => {
    assertHasWorkspace(c);

    const { data, error } = id in WELL_KNOWN_AGENTS
      ? {
        data: WELL_KNOWN_AGENTS[id as keyof typeof WELL_KNOWN_AGENTS],
        error: null,
      }
      : await c.db
        .from("deco_chat_agents")
        .select("*")
        .eq("id", id)
        .single();

    if ((error && error.code == NO_DATA_ERROR) || !data) {
      throw new NotFoundError(id);
    }

    if (error) {
      throw new InternalServerError((error as PostgrestError).message);
    }

    return AgentSchema.parse(data);
  },
});

export const createAgent = createTool({
  name: "AGENTS_CREATE",
  description: "Create a new agent",
  inputSchema: AgentSchema.partial(),
  canAccess: canAccessWorkspaceResource,
  handler: async (agent, c) => {
    assertHasWorkspace(c);

    const [{ data, error }] = await Promise.all([
      c.db
        .from("deco_chat_agents")
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

export const createTempAgent = createTool({
  name: "AGENTS_CREATE_TEMP",
  description:
    "Inserts or updates a temp agent for the whatsapp integration based on userId",
  inputSchema: z.object({
    agentId: z.string(),
    userId: z.string(),
  }),
  async canAccess(_name, _props, c) {
    return await canAccessWorkspaceResource("AGENTS_CREATE", _props, c);
  },
  handler: async ({ agentId, userId }, c) => {
    const [{ data, error }] = await Promise.all([
      c.db
        .from("temp_wpp_agents")
        .upsert({
          agent_id: agentId,
          user_id: userId,
        }, {
          onConflict: "user_id",
          ignoreDuplicates: false,
        })
        .select()
        .maybeSingle(),
    ]);

    if (error) {
      throw new InternalServerError(error.message);
    }

    return data;
  },
});

export const updateAgent = createTool({
  name: "AGENTS_UPDATE",
  description: "Update an existing agent",
  inputSchema: z.object({
    id: z.string(),
    agent: AgentSchema.partial(),
  }),
  canAccess: canAccessWorkspaceResource,
  handler: async ({ id, agent }, c) => {
    assertHasWorkspace(c);
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
  canAccess: canAccessWorkspaceResource,
  handler: async ({ id }, c) => {
    assertHasWorkspace(c);
    const { error } = await c.db
      .from("deco_chat_agents")
      .delete()
      .eq("id", id);

    const triggers = await listTriggers.handler({ agentId: id });
    for (const trigger of triggers.structuredContent.triggers) {
      await deleteTrigger.handler({ agentId: id, triggerId: trigger.id });
    }

    if (error) {
      throw new InternalServerError(error.message);
    }

    return true;
  },
});

export const getTempAgent = createTool({
  name: "AGENTS_GET_TEMP",
  description: "Get the temp WhatsApp agent for the current user",
  inputSchema: z.object({ userId: z.string() }),
  async canAccess(_name, _props, c) {
    return await canAccessWorkspaceResource("AGENTS_GET", _props, c);
  },
  handler: async ({ userId }, c) => {
    const { data, error } = await c.db
      .from("temp_wpp_agents")
      .select("agent_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      throw new InternalServerError(error.message);
    }

    return data;
  },
});

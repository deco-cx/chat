import { Trigger } from "@deco/ai/actors";
import { join } from "node:path";
import { z } from "zod";
import {
  InternalServerError,
  NotFoundError,
  UserInputError,
} from "../../errors.ts";
import { Hosts } from "../../hosts.ts";
import { AgentSchema } from "../../models/agent.ts";
import { IntegrationSchema } from "../../models/mcp.ts";
import {
  CreateCronTriggerInputSchema,
  CreateTriggerOutputSchema,
  CreateWebhookTriggerInputSchema,
  DeleteTriggerOutputSchema,
  GetWebhookTriggerUrlOutputSchema,
  ListTriggersOutputSchema,
  TriggerSchema,
} from "../../models/trigger.ts";
import { Path } from "../../path.ts";
import { Json, QueryResult } from "../../storage/index.ts";
import { getAgentsByIds } from "../agents/api.ts";
import {
  assertHasWorkspace,
  canAccessWorkspaceResource,
} from "../assertions.ts";
import { createTool } from "../context.ts";
import { convertFromDatabase } from "../integrations/api.ts";
import { userFromDatabase } from "../user.ts";

const SELECT_TRIGGER_QUERY = `
  *,
  binding:deco_chat_integrations(
    *
  ),
  profile:profiles(
    metadata:users_meta_data_view(
      raw_user_meta_data
    )
  )
`;

function mapTrigger(
  trigger: QueryResult<"deco_chat_triggers", typeof SELECT_TRIGGER_QUERY>,
  agentsById: Record<string, z.infer<typeof AgentSchema>>,
) {
  return {
    type: trigger.metadata && typeof trigger.metadata === "object" &&
        "cronExp" in trigger.metadata
      ? "cron" as const
      : "webhook" as const,
    id: trigger.id,
    agent: agentsById[trigger.agent_id],
    createdAt: trigger.created_at,
    updatedAt: trigger.updated_at,
    user: {
      // @ts-expect-error - Supabase user metadata is not typed
      ...userFromDatabase(trigger.profile),
      id: trigger.user_id,
      // @ts-expect-error - Supabase user metadata is not typed
    } as z.infer<typeof ListTriggersOutputSchema["triggers"][number]["user"]>,
    workspace: trigger.workspace,
    active: trigger.active,
    data: trigger.metadata as z.infer<typeof TriggerSchema>,
    binding: trigger.binding ? convertFromDatabase(trigger.binding) : null,
  };
}

export const buildWebhookUrl = (
  triggerId: string,
  passphrase?: string,
  outputTool?: string,
) => {
  const params = new URLSearchParams();
  if (passphrase) params.append("passphrase", passphrase);
  params.append("deno_isolate_instance_id", triggerId);
  if (outputTool) params.append("output_tool", outputTool);
  return `https://${Hosts.API}/actors/${Trigger.name}/invoke/run?${params.toString()}`;
};

export const listTriggers = createTool({
  name: "TRIGGERS_LIST",
  description: "List all triggers",
  inputSchema: z.object({ agentId: z.string().optional() }),
  canAccess: canAccessWorkspaceResource,
  handler: async (
    { agentId },
    c,
  ): Promise<z.infer<typeof ListTriggersOutputSchema>> => {
    assertHasWorkspace(c);
    const db = c.db;
    const workspace = c.workspace.value;

    const query = db
      .from("deco_chat_triggers")
      .select(SELECT_TRIGGER_QUERY)
      .eq("workspace", workspace);

    if (agentId) {
      query.eq("agent_id", agentId);
    }

    const { data, error } = await query;

    if (error) {
      throw new InternalServerError(error.message);
    }

    const agentIds = Array.from(
      new Set(data.map((trigger) => trigger.agent_id).filter(Boolean)),
    );

    const agents = await getAgentsByIds(agentIds, c);

    const agentsById = agents.reduce((acc, agent) => {
      acc[agent.id] = agent;
      return acc;
    }, {} as Record<string, z.infer<typeof AgentSchema>>);

    return {
      triggers: data.map((trigger) => mapTrigger(trigger, agentsById)),
    };
  },
});

export const createTrigger = createTool({
  name: "TRIGGERS_CREATE",
  description: "Create a trigger",
  inputSchema: z.object({ agentId: z.string(), data: TriggerSchema }),
  canAccess: canAccessWorkspaceResource,
  handler: async (
    { agentId, data },
    c,
  ): Promise<z.infer<typeof CreateTriggerOutputSchema>> => {
    assertHasWorkspace(c);
    const db = c.db;
    const workspace = c.workspace.value;
    const user = c.user;
    const stub = c.stub;

    // Check if there's already a WhatsApp-enabled trigger for this agent
    const whatsappEnabled =
      (data as z.infer<typeof TriggerSchema> & { whatsappEnabled: boolean })
        .whatsappEnabled;
    if (whatsappEnabled) {
      const { data: _existingTriggers, error: checkError } = await db.from(
        "deco_chat_triggers",
      )
        .select("id")
        .eq("agent_id", agentId)
        .eq("workspace", workspace)
        .eq("whatsapp_enabled", true);

      if (checkError) {
        throw new InternalServerError(checkError.message);
      }
    }

    const id = crypto.randomUUID();

    const triggerId = Path.resolveHome(
      join(Path.folders.Agent.root(agentId), Path.folders.trigger(id)),
      workspace,
    ).path;

    if (data.type === "cron") {
      const parse = CreateCronTriggerInputSchema.safeParse(data);
      if (!parse.success) {
        throw new UserInputError("Invalid trigger");
      }
    }

    if (data.type === "webhook") {
      const parse = CreateWebhookTriggerInputSchema.safeParse(data);
      if (!parse.success) {
        throw new UserInputError("Invalid trigger");
      }
      (data as z.infer<typeof TriggerSchema> & { url: string }).url =
        buildWebhookUrl(triggerId, data.passphrase, data.outputTool);
    }

    const userId = typeof user.id === "string" ? user.id : undefined;
    await stub(Trigger).new(triggerId).create(
      {
        ...data,
        id,
        resourceId: userId,
      },
    );

    const { data: trigger, error } = await db.from("deco_chat_triggers")
      .insert({
        id,
        agent_id: agentId,
        user_id: userId,
        workspace,
        metadata: data as Json,
        whatsapp_enabled:
          (data as z.infer<typeof TriggerSchema> & { whatsappEnabled: boolean })
            .whatsappEnabled,
      })
      .select(SELECT_TRIGGER_QUERY)
      .single();

    if (error) {
      throw new InternalServerError(error.message);
    }

    const agents = await getAgentsByIds([agentId], c);
    const agentsById = agents.reduce((acc, agent) => {
      acc[agent.id] = agent;
      return acc;
    }, {} as Record<string, z.infer<typeof AgentSchema>>);

    return mapTrigger(trigger, agentsById);
  },
});

export const createCronTrigger = createTool({
  name: "TRIGGERS_CREATE_CRON",
  description: "Create a cron trigger",
  inputSchema: z.object({
    agentId: z.string(),
    data: CreateCronTriggerInputSchema,
  }),
  canAccess: canAccessWorkspaceResource,
  handler: async (
    { agentId, data },
    c,
  ): Promise<z.infer<typeof CreateTriggerOutputSchema>> => {
    assertHasWorkspace(c);
    const db = c.db;
    const workspace = c.workspace.value;
    const user = c.user;
    const stub = c.stub;

    const id = crypto.randomUUID();

    const triggerId = Path.resolveHome(
      join(Path.folders.Agent.root(agentId), Path.folders.trigger(id)),
      workspace,
    ).path;

    const userId = typeof user.id === "string" ? user.id : undefined;
    await stub(Trigger).new(triggerId).create(
      {
        ...data,
        id,
        resourceId: userId,
      },
    );

    const { data: trigger, error } = await db.from("deco_chat_triggers")
      .insert({
        id,
        agent_id: agentId,
        user_id: userId,
        workspace,
        metadata: data as Json,
      })
      .select(SELECT_TRIGGER_QUERY)
      .single();

    if (error) {
      throw new InternalServerError(error.message);
    }

    const agents = await getAgentsByIds([agentId], c);
    const agentsById = agents.reduce((acc, agent) => {
      acc[agent.id] = agent;
      return acc;
    }, {} as Record<string, z.infer<typeof AgentSchema>>);

    return mapTrigger(trigger, agentsById);
  },
});

export const createWebhookTrigger = createTool({
  name: "TRIGGERS_CREATE_WEBHOOK",
  description: "Create a webhook trigger",
  inputSchema: z.object({
    agentId: z.string(),
    data: CreateWebhookTriggerInputSchema,
  }),
  canAccess: canAccessWorkspaceResource,
  handler: async (
    { agentId, data },
    c,
  ): Promise<z.infer<typeof CreateTriggerOutputSchema>> => {
    assertHasWorkspace(c);
    const db = c.db;
    const workspace = c.workspace.value;
    const user = c.user;
    const stub = c.stub;

    const id = crypto.randomUUID();

    const triggerId = Path.resolveHome(
      join(Path.folders.Agent.root(agentId), Path.folders.trigger(id)),
      workspace,
    ).path;

    (data as z.infer<typeof TriggerSchema> & { url: string }).url =
      buildWebhookUrl(triggerId, data.passphrase);

    const userId = typeof user.id === "string" ? user.id : undefined;
    await stub(Trigger).new(triggerId).create(
      {
        ...data,
        id,
        resourceId: userId,
      },
    );

    const { data: trigger, error } = await db.from("deco_chat_triggers")
      .insert({
        id,
        agent_id: agentId,
        user_id: userId,
        workspace,
        metadata: data as Json,
        whatsapp_enabled:
          (data as z.infer<typeof TriggerSchema> & { whatsappEnabled: boolean })
            .whatsappEnabled,
      })
      .select(SELECT_TRIGGER_QUERY)
      .single();

    if (error) {
      throw new InternalServerError(error.message);
    }

    const agents = await getAgentsByIds([agentId], c);
    const agentsById = agents.reduce((acc, agent) => {
      acc[agent.id] = agent;
      return acc;
    }, {} as Record<string, z.infer<typeof AgentSchema>>);

    return mapTrigger(trigger, agentsById);
  },
});
export const deleteTrigger = createTool({
  name: "TRIGGERS_DELETE",
  description: "Delete a trigger",
  inputSchema: z.object({ triggerId: z.string(), agentId: z.string() }),
  canAccess: canAccessWorkspaceResource,
  handler: async (
    { triggerId, agentId },
    c,
  ): Promise<z.infer<typeof DeleteTriggerOutputSchema>> => {
    assertHasWorkspace(c);
    const db = c.db;
    const workspace = c.workspace.value;
    const stub = c.stub;

    const workspaceTrigger = Path.resolveHome(
      join(Path.folders.Agent.root(agentId), Path.folders.trigger(triggerId)),
      workspace,
    ).path;

    await stub(Trigger).new(workspaceTrigger).delete();

    const { error } = await db.from("deco_chat_triggers")
      .delete()
      .eq("id", triggerId)
      .eq("workspace", workspace);

    if (error) {
      throw new InternalServerError(error.message);
    }
    return {
      triggerId,
      agentId,
    };
  },
});

export const getWebhookTriggerUrl = createTool({
  name: "TRIGGERS_GET_WEBHOOK_URL",
  description: "Get the webhook URL for a trigger",
  inputSchema: z.object({ triggerId: z.string() }),
  canAccess: canAccessWorkspaceResource,
  handler: async (
    { triggerId },
    c,
  ): Promise<z.infer<typeof GetWebhookTriggerUrlOutputSchema>> => {
    assertHasWorkspace(c);
    const db = c.db;
    const workspace = c.workspace.value;

    const { data, error } = await db.from("deco_chat_triggers")
      .select("metadata")
      .eq("id", triggerId)
      .eq("workspace", workspace)
      .single();

    if (error) {
      throw new InternalServerError(error.message);
    }

    if (!data) {
      throw new NotFoundError("Trigger not found");
    }

    return {
      url: (data.metadata as { url?: string })?.url,
    };
  },
});

export const getTrigger = createTool({
  name: "TRIGGERS_GET",
  description: "Get a trigger by ID",
  inputSchema: z.object({ id: z.string() }),
  canAccess: canAccessWorkspaceResource,
  handler: async (
    { id: triggerId },
    c,
  ): Promise<
    z.infer<
      typeof CreateTriggerOutputSchema
    > & {
      binding: z.infer<typeof IntegrationSchema> | null;
    }
  > => {
    assertHasWorkspace(c);
    const db = c.db;
    const workspace = c.workspace.value;

    const { data: trigger, error } = await db.from("deco_chat_triggers")
      .select(SELECT_TRIGGER_QUERY)
      .eq("id", triggerId)
      .eq("workspace", workspace)
      .maybeSingle();

    if (error) {
      throw new InternalServerError(error.message);
    }

    if (!trigger) {
      throw new NotFoundError("Trigger not found");
    }

    const agents = await getAgentsByIds([trigger.agent_id], c);
    const agentsById = agents.reduce((acc, agent) => {
      acc[agent.id] = agent;
      return acc;
    }, {} as Record<string, z.infer<typeof AgentSchema>>);

    return mapTrigger(trigger, agentsById);
  },
});

export const activateTrigger = createTool({
  name: "TRIGGERS_ACTIVATE",
  description: "Activate a trigger",
  inputSchema: z.object({ triggerId: z.string() }),
  canAccess: canAccessWorkspaceResource,
  handler: async ({ triggerId }, c) => {
    assertHasWorkspace(c);
    const db = c.db;
    const workspace = c.workspace.value;
    const stub = c.stub;
    const user = c.user;

    try {
      const { data, error: selectError } = await db.from("deco_chat_triggers")
        .select("*")
        .eq("id", triggerId)
        .eq("workspace", workspace)
        .single();

      if (selectError) {
        return {
          success: false,
          message: "Failed to activate trigger",
        };
      }

      if (data?.active) {
        return {
          success: true,
          message: "Trigger already activated",
        };
      }

      await stub(Trigger).new(triggerId).create(
        {
          ...data.metadata as z.infer<typeof TriggerSchema>,
          id: data.id,
          resourceId: typeof user.id === "string" ? user.id : undefined,
        },
      );

      const { error } = await db.from("deco_chat_triggers")
        .update({ active: true })
        .eq("id", triggerId)
        .eq("workspace", workspace);

      if (error) {
        return {
          success: false,
          message: "Failed to activate trigger",
        };
      }

      return {
        success: true,
        message: "Trigger activated successfully",
      };
    } catch (_) {
      return {
        success: false,
        message: "Failed to activate trigger",
      };
    }
  },
});

export const deactivateTrigger = createTool({
  name: "TRIGGERS_DEACTIVATE",
  description: "Deactivate a trigger",
  inputSchema: z.object({ triggerId: z.string() }),
  canAccess: canAccessWorkspaceResource,
  handler: async ({ triggerId }, c) => {
    assertHasWorkspace(c);
    const db = c.db;
    const workspace = c.workspace.value;
    const stub = c.stub;

    try {
      const { data, error: selectError } = await db.from("deco_chat_triggers")
        .select("*")
        .eq("id", triggerId)
        .eq("workspace", workspace)
        .single();

      if (selectError) {
        return {
          success: false,
          message: "Failed to deactivate trigger",
        };
      }

      if (!data?.active) {
        return {
          success: true,
          message: "Trigger already deactivated",
        };
      }

      await stub(Trigger).new(triggerId).delete();

      const { error } = await db.from("deco_chat_triggers")
        .update({ active: false })
        .eq("id", triggerId)
        .eq("workspace", workspace);

      if (error) {
        return {
          success: false,
          message: "Failed to deactivate trigger",
        };
      }

      return {
        success: true,
        message: "Trigger deactivated successfully",
      };
    } catch (_) {
      return {
        success: false,
        message: "Failed to deactivate trigger",
      };
    }
  },
});

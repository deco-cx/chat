import { Trigger } from "@deco/ai/actors";
import { join } from "node:path";
import { z } from "zod";
import {
  InternalServerError,
  NotFoundError,
  UserInputError,
} from "../../errors.ts";
import { Hosts } from "../../hosts.ts";
import type { IntegrationSchema } from "../../models/mcp.ts";
import {
  CreateCronTriggerInputSchema,
  type CreateTriggerOutputSchema,
  CreateWebhookTriggerInputSchema,
  type DeleteTriggerOutputSchema,
  type GetWebhookTriggerUrlOutputSchema,
  type ListTriggersOutputSchema,
  TriggerSchema,
} from "../../models/trigger.ts";
import { Path } from "../../path.ts";
import type { Json, QueryResult } from "../../storage/index.ts";
import {
  assertHasWorkspace,
  assertWorkspaceResourceAccess,
} from "../assertions.ts";
import { createToolGroup } from "../context.ts";
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
) {
  return {
    type: trigger.metadata && typeof trigger.metadata === "object" &&
        "cronExp" in trigger.metadata
      ? "cron" as const
      : "webhook" as const,
    id: trigger.id,
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
    agent: {
      id: trigger.agent_id,
    },
  };
}

export const buildWebhookUrl = (
  triggerId: string,
  passphrase?: string,
  outputTool?: string,
) => {
  return `https://${Hosts.API}/actors/${Trigger.name}/invoke/run?passphrase=${passphrase}&deno_isolate_instance_id=${triggerId}&output_tool=${outputTool}`;
};

const createTool = createToolGroup("Triggers", {
  name: "Triggers & Automation",
  description: "Create cron jobs and webhook-based workflows.",
  icon:
    "https://assets.decocache.com/mcp/ca2b0d62-731c-4232-b72b-92a0df5afb5b/Triggers--Automation.png",
});

export const listTriggers = createTool({
  name: "TRIGGERS_LIST",
  description: "List all triggers",
  inputSchema: z.object({ agentId: z.string().optional() }),
  handler: async (
    { agentId },
    c,
  ): Promise<z.infer<typeof ListTriggersOutputSchema>> => {
    assertHasWorkspace(c);

    await assertWorkspaceResourceAccess(c.tool.name, c);

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

    return {
      triggers: data.map((trigger) => mapTrigger(trigger)),
    };
  },
});

export const upsertTrigger = createTool({
  name: "TRIGGERS_UPSERT",
  description: "Create or update a trigger",
  inputSchema: z.object({
    agentId: z.string().describe(
      "The ID of the agent to create the trigger for, use only UUIDs",
    ),
    triggerId: z.string().optional(),
    data: TriggerSchema,
  }),
  handler: async ({ agentId, triggerId, data }, c) => {
    assertHasWorkspace(c);

    await assertWorkspaceResourceAccess(c.tool.name, c);

    const db = c.db;
    const workspace = c.workspace.value;
    const user = c.user;
    const stub = c.stub;

    const id = triggerId || crypto.randomUUID();

    const triggerPath = Path.resolveHome(
      join(
        Path.folders.Agent.root(agentId),
        Path.folders.trigger(id),
      ),
      workspace,
    ).path;

    // Validate trigger data based on type
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
        buildWebhookUrl(
          triggerPath,
          data.passphrase,
          "outputTool" in data ? data.outputTool : undefined,
        );
    }

    const userId = typeof user.id === "string" ? user.id : undefined;

    // Delete existing trigger if updating
    if (triggerId) {
      await stub(Trigger).new(triggerPath).delete();
    }

    // Update database
    const { data: trigger, error } = await db.from("deco_chat_triggers")
      .upsert({
        id,
        workspace,
        agent_id: agentId,
        user_id: userId,
        metadata: data as Json,
      })
      .select(SELECT_TRIGGER_QUERY)
      .single();

    if (error) {
      throw new InternalServerError(error.message);
    }

    // Create new trigger
    await stub(Trigger).new(triggerPath).create(
      {
        ...data,
        id,
        resourceId: userId,
      },
    );

    return mapTrigger(trigger);
  },
});

export const createTrigger = createTool({
  name: "TRIGGERS_CREATE",
  description: "Create a trigger",
  inputSchema: z.object({
    agentId: z.string().describe(
      "The ID of the agent(current) to create the trigger for, use only UUIDs",
    ),
    data: TriggerSchema,
  }),
  handler: async ({ agentId, data }, c) => {
    assertHasWorkspace(c);

    await assertWorkspaceResourceAccess(c.tool.name, c);

    const result = await upsertTrigger.handler({ agentId, data });

    return result;
  },
});

export const updateTrigger = createTool({
  name: "TRIGGERS_UPDATE",
  description: "Update a trigger",
  inputSchema: z.object({
    agentId: z.string().describe(
      "The ID of the agent(current) to create the trigger for, use only UUIDs.",
    ),
    triggerId: z.string(),
    data: TriggerSchema,
  }),
  handler: async ({ agentId, triggerId, data }, c) => {
    assertHasWorkspace(c);

    await assertWorkspaceResourceAccess(c.tool.name, c);

    const result = await upsertTrigger.handler({ agentId, triggerId, data });

    return result;
  },
});

export const createCronTrigger = createTool({
  name: "TRIGGERS_CREATE_CRON",
  description: "Create a cron trigger",
  inputSchema: z.object({
    agentId: z.string().describe(
      "The ID of the agent(current) to create the trigger for, use only UUIDs.",
    ),
    data: CreateCronTriggerInputSchema,
  }),
  handler: async (
    { agentId, data },
    c,
  ): Promise<z.infer<typeof CreateTriggerOutputSchema>> => {
    assertHasWorkspace(c);

    await assertWorkspaceResourceAccess(c.tool.name, c);

    agentId ??= crypto.randomUUID();
    const result = await upsertTrigger.handler({ agentId, data });

    return result;
  },
});

export const createWebhookTrigger = createTool({
  name: "TRIGGERS_CREATE_WEBHOOK",
  description: "Create a webhook trigger",
  inputSchema: z.object({
    agentId: z.string().describe(
      "The ID of the agent(current) to create the trigger for, use only UUIDs.",
    ),
    data: CreateWebhookTriggerInputSchema,
  }),
  handler: async (
    { agentId, data },
    c,
  ): Promise<z.infer<typeof CreateTriggerOutputSchema>> => {
    assertHasWorkspace(c);

    await assertWorkspaceResourceAccess(c.tool.name, c);

    agentId ??= crypto.randomUUID();
    const result = await upsertTrigger.handler({ agentId, data });

    return result;
  },
});

export const deleteTrigger = createTool({
  name: "TRIGGERS_DELETE",
  description: "Delete a trigger",
  inputSchema: z.object({ triggerId: z.string(), agentId: z.string() }),
  handler: async (
    { triggerId, agentId },
    c,
  ): Promise<z.infer<typeof DeleteTriggerOutputSchema>> => {
    assertHasWorkspace(c);

    await assertWorkspaceResourceAccess(c.tool.name, c);

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
  handler: async (
    { triggerId },
    c,
  ): Promise<z.infer<typeof GetWebhookTriggerUrlOutputSchema>> => {
    assertHasWorkspace(c);

    await assertWorkspaceResourceAccess(c.tool.name, c);

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
  handler: async ({ id: triggerId }, c): Promise<
    z.infer<
      typeof CreateTriggerOutputSchema
    > & {
      binding: z.infer<typeof IntegrationSchema> | null;
    }
  > => {
    assertHasWorkspace(c);

    await assertWorkspaceResourceAccess(c.tool.name, c);

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

    return mapTrigger(trigger);
  },
});

export const activateTrigger = createTool({
  name: "TRIGGERS_ACTIVATE",
  description: "Activate a trigger",
  inputSchema: z.object({ triggerId: z.string() }),
  handler: async ({ triggerId }, c) => {
    assertHasWorkspace(c);

    await assertWorkspaceResourceAccess(c.tool.name, c);

    const db = c.db;
    const workspace = c.workspace.value;
    const stub = c.stub;
    const user = c.user;

    try {
      const { data, error: selectError } = await db.from("deco_chat_triggers")
        .select(SELECT_TRIGGER_QUERY)
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
  handler: async ({ triggerId }, c) => {
    assertHasWorkspace(c);

    await assertWorkspaceResourceAccess(c.tool.name, c);

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

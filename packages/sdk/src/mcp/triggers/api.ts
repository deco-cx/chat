import { Trigger } from "@deco/ai/actors";

import { z } from "zod/v3";
import { WELL_KNOWN_AGENT_IDS } from "../../constants.ts";
import {
  InternalServerError,
  NotFoundError,
  UserInputError,
} from "../../errors.ts";
import { Hosts } from "../../hosts.ts";
import type { IntegrationSchema } from "../../models/mcp.ts";
import {
  CreateCronTriggerInputSchema,
  type CreateTriggerOutput,
  CreateTriggerOutputSchema,
  CreateWebhookTriggerInputSchema,
  type DeleteTriggerOutput,
  DeleteTriggerOutputSchema,
  type GetWebhookTriggerUrlOutput,
  GetWebhookTriggerUrlOutputSchema,
  type ListTriggersOutput,
  ListTriggersOutputSchema,
  type Trigger as TriggerType,
  TriggerSchema,
} from "../../models/trigger.ts";

import type { Json, QueryResult } from "../../storage/index.ts";
import {
  assertHasWorkspace,
  assertWorkspaceResourceAccess,
  type WithTool,
} from "../assertions.ts";
import { type AppContext, createToolGroup } from "../context.ts";
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
  const metadata = trigger.metadata || {};
  const triggerType =
    typeof metadata === "object" && "cronExp" in metadata
      ? ("cron" as const)
      : ("webhook" as const);

  if (trigger.agent_id !== WELL_KNOWN_AGENT_IDS.teamAgent) {
    // @ts-expect-error - Compatibility with triggers created before toolCall support was added
    metadata.agentId = trigger.agent_id;
  }

  return {
    type: triggerType,
    id: trigger.id,
    createdAt: trigger.created_at,
    updatedAt: trigger.updated_at,
    user: {
      // @ts-expect-error - Supabase user metadata is not typed
      ...userFromDatabase(trigger.profile),
      id: trigger.user_id,
    } as ListTriggersOutput["triggers"][number]["user"],
    workspace: trigger.workspace,
    active: trigger.active,
    data: metadata as TriggerType,
    binding: trigger.binding ? convertFromDatabase(trigger.binding) : null,
  };
}

interface WebhookOptions {
  id: string;
  workspace: string;
  passphrase?: string;
}

const webhookURLFrom = ({ id, workspace, passphrase }: WebhookOptions) => {
  const url = new URL(
    `${workspace}/triggers/${id}`,
    `https://${Hosts.API_LEGACY}`,
  );

  if (passphrase) {
    url.searchParams.set("passphrase", passphrase);
  }

  return url.href;
};

const createTriggerStub = ({
  id,
  workspace,
  stub,
}: {
  id: string;
  workspace: string;
  stub: WithTool<AppContext>["stub"];
}) => stub(Trigger).new(`${workspace}/triggers/${id}`);

const createTool = createToolGroup("Triggers", {
  name: "Triggers & Automation",
  description: "Create cron jobs and webhook-based workflows.",
  icon: "https://assets.decocache.com/mcp/ca2b0d62-731c-4232-b72b-92a0df5afb5b/Triggers--Automation.png",
});

export const listTriggers = createTool({
  name: "TRIGGERS_LIST",
  description: "List all triggers",
  inputSchema: z.lazy(() => z.object({ agentId: z.string().optional() })),
  outputSchema: z.lazy(() => ListTriggersOutputSchema),
  handler: async ({ agentId }, c): Promise<ListTriggersOutput> => {
    assertHasWorkspace(c);

    await assertWorkspaceResourceAccess(c);

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
  inputSchema: z.lazy(() =>
    z.object({
      id: z.string().optional(),
      data: TriggerSchema,
    }),
  ),
  handler: async ({ id, data }, c) => {
    assertHasWorkspace(c);

    await assertWorkspaceResourceAccess(c);

    const db = c.db;
    const workspace = c.workspace.value;
    const user = c.user;
    const stub = c.stub;

    const triggerId = id || crypto.randomUUID();

    if (data.type === "webhook") {
      data.url = webhookURLFrom({
        id: triggerId,
        workspace,
        passphrase: data.passphrase,
      });
    }

    // Validate trigger data based on type
    const parse = TriggerSchema.safeParse(data);
    if (!parse.success) {
      throw new UserInputError(parse.error.message);
    }

    const triggerStub = createTriggerStub({ id: triggerId, workspace, stub });

    // Delete existing trigger if updating
    if (id) {
      await triggerStub.delete();
    }

    const userId = typeof user?.id === "string" ? user.id : undefined;
    const agentId =
      "agentId" in data && data.agentId
        ? data.agentId
        : WELL_KNOWN_AGENT_IDS.teamAgent;

    // Update database
    const { data: trigger, error } = await db
      .from("deco_chat_triggers")
      .upsert({
        id: triggerId,
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
    await triggerStub.create({ ...data, id: triggerId, resourceId: userId });

    return mapTrigger(trigger);
  },
});

export const createTrigger = createTool({
  name: "TRIGGERS_CREATE",
  description: "Create a trigger",
  inputSchema: z.lazy(() => z.object({ trigger: TriggerSchema })),
  handler: async ({ trigger }, c) => {
    assertHasWorkspace(c);

    await assertWorkspaceResourceAccess(c);

    const result = await upsertTrigger.handler({ data: trigger });

    return result;
  },
});

export const updateTrigger = createTool({
  name: "TRIGGERS_UPDATE",
  description: "Update a trigger",
  inputSchema: z.lazy(() =>
    z.object({
      id: z.string(),
      data: TriggerSchema,
    }),
  ),
  handler: async ({ id, data }, c) => {
    assertHasWorkspace(c);

    await assertWorkspaceResourceAccess(c);

    const result = await upsertTrigger.handler({ id, data });

    return result;
  },
});

export const createCronTrigger = createTool({
  name: "TRIGGERS_CREATE_CRON",
  description: "Create a cron trigger",
  inputSchema: z.lazy(() => CreateCronTriggerInputSchema),
  handler: async (data, c): Promise<CreateTriggerOutput> => {
    assertHasWorkspace(c);

    await assertWorkspaceResourceAccess(c);

    const result = await upsertTrigger.handler({ data });

    return result;
  },
});

export const createWebhookTrigger = createTool({
  name: "TRIGGERS_CREATE_WEBHOOK",
  description: "Create a webhook trigger",
  inputSchema: z.lazy(() => CreateWebhookTriggerInputSchema),
  outputSchema: z.lazy(() => CreateTriggerOutputSchema),
  handler: async (data, c): Promise<CreateTriggerOutput> => {
    assertHasWorkspace(c);

    await assertWorkspaceResourceAccess(c);

    const result = await upsertTrigger.handler({ data });

    return result;
  },
});

export const deleteTrigger = createTool({
  name: "TRIGGERS_DELETE",
  description: "Delete a trigger",
  inputSchema: z.lazy(() => z.object({ id: z.string() })),
  outputSchema: z.lazy(() => DeleteTriggerOutputSchema),
  handler: async ({ id }, c): Promise<DeleteTriggerOutput> => {
    assertHasWorkspace(c);

    await assertWorkspaceResourceAccess(c);

    const db = c.db;
    const workspace = c.workspace.value;
    const stub = c.stub;

    const triggerStub = createTriggerStub({ id, workspace, stub });
    await triggerStub.delete();

    const { error } = await db
      .from("deco_chat_triggers")
      .delete()
      .eq("id", id)
      .eq("workspace", workspace);

    if (error) {
      throw new InternalServerError(error.message);
    }
    return { id };
  },
});

export const getWebhookTriggerUrl = createTool({
  name: "TRIGGERS_GET_WEBHOOK_URL",
  description: "Get the webhook URL for a trigger",
  inputSchema: z.lazy(() => z.object({ id: z.string() })),
  outputSchema: z.lazy(() => GetWebhookTriggerUrlOutputSchema),
  handler: async ({ id }, c): Promise<GetWebhookTriggerUrlOutput> => {
    assertHasWorkspace(c);

    await assertWorkspaceResourceAccess(c);

    const db = c.db;
    const workspace = c.workspace.value;

    const { data, error } = await db
      .from("deco_chat_triggers")
      .select("metadata")
      .eq("id", id)
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
  inputSchema: z.lazy(() => z.object({ id: z.string() })),
  handler: async (
    { id: triggerId },
    c,
  ): Promise<
    CreateTriggerOutput & {
      binding: z.infer<typeof IntegrationSchema> | null;
    }
  > => {
    assertHasWorkspace(c);

    await assertWorkspaceResourceAccess(c);

    const db = c.db;
    const workspace = c.workspace.value;

    const { data: trigger, error } = await db
      .from("deco_chat_triggers")
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
  inputSchema: z.lazy(() => z.object({ id: z.string() })),
  handler: async ({ id }, c) => {
    assertHasWorkspace(c);

    await assertWorkspaceResourceAccess(c);

    const db = c.db;
    const workspace = c.workspace.value;
    const stub = c.stub;
    const user = c.user;

    try {
      const { data, error: selectError } = await db
        .from("deco_chat_triggers")
        .select(SELECT_TRIGGER_QUERY)
        .eq("id", id)
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

      const triggerStub = createTriggerStub({ id, workspace, stub });

      await triggerStub.create({
        ...(data.metadata as TriggerType),
        id: data.id,
        resourceId: typeof user.id === "string" ? user.id : undefined,
      });

      const { error } = await db
        .from("deco_chat_triggers")
        .update({ active: true })
        .eq("id", id)
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
  inputSchema: z.lazy(() => z.object({ id: z.string() })),
  handler: async ({ id }, c) => {
    assertHasWorkspace(c);

    await assertWorkspaceResourceAccess(c);

    const db = c.db;
    const workspace = c.workspace.value;
    const stub = c.stub;

    try {
      const { data, error: selectError } = await db
        .from("deco_chat_triggers")
        .select("*")
        .eq("id", id)
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

      const triggerStub = createTriggerStub({ id, workspace, stub });
      await triggerStub.delete();

      const { error } = await db
        .from("deco_chat_triggers")
        .update({ active: false })
        .eq("id", id)
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

import {
  CreateCronTriggerInputSchema,
  CreateCronTriggerOutputSchema,
  CreateWebhookTriggerInputSchema,
  CreateWebhookTriggerOutputSchema,
  DeleteTriggerInputSchema,
  DeleteTriggerOutputSchema,
  GetWebhookTriggerUrlInputSchema,
  GetWebhookTriggerUrlOutputSchema,
  ListTriggersOutputSchema,
} from "./services.ts";
import { createInnateTool } from "../utils/createTool.ts";
import type { TriggerData } from "./services.ts";
import {
  buildWebhookUrl,
  createCronTrigger,
  createWebhookTrigger,
  deleteTrigger,
  listTriggers,
} from "./services.ts";
import { Path } from "@deco/sdk/path";
import { join } from "@std/path/posix";

/**
 * Creates a new trigger tool
 */
export const DECO_TRIGGER_CREATE_CRON = createInnateTool({
  id: "DECO_TRIGGER_CREATE_CRON",
  description:
    "Create a new cron trigger with specified expression and tool call",
  inputSchema: CreateCronTriggerInputSchema,
  outputSchema: CreateCronTriggerOutputSchema,
  execute: (agent) => async ({ context, resourceId }) => {
    return await createCronTrigger({
      stub: agent.state.stub,
      workspace: agent.workspace,
      agentId: agent.state.id.split("/").at(-1) ?? "",
      trigger: context,
      resourceId,
      userId: agent.metadata?.principal?.id ?? "",
    });
  },
});

/**
 * Creates a new trigger tool
 */
export const DECO_TRIGGER_CREATE_WEBHOOK = createInnateTool({
  id: "DECO_TRIGGER_CREATE_WEBHOOK",
  description:
    "Creates a new webhook trigger with specified passphrase that is used to invoke the agent back",
  inputSchema: CreateWebhookTriggerInputSchema,
  outputSchema: CreateWebhookTriggerOutputSchema,
  execute: (agent) => async ({ context, resourceId }) => {
    return await createWebhookTrigger({
      stub: agent.state.stub,
      workspace: agent.workspace,
      agentId: agent.state.id.split("/").at(-1) ?? "",
      trigger: context,
      resourceId,
      userId: agent.metadata?.principal?.id ?? "",
    });
  },
});

/**
 * Creates a tool for deleting triggers
 */
export const DECO_TRIGGER_DELETE = createInnateTool({
  id: "DECO_TRIGGER_DELETE",
  description: "Delete a trigger by its ID",
  inputSchema: DeleteTriggerInputSchema,
  outputSchema: DeleteTriggerOutputSchema,
  execute: (agent) => async ({ context }) => {
    return await deleteTrigger({
      stub: agent.state.stub,
      workspace: agent.workspace,
      agentId: agent.state.id.split("/").at(-1) ?? "",
      triggerId: context.id,
    });
  },
});

/**
 * Creates a tool for listing all triggers
 */
export const DECO_TRIGGER_LIST = createInnateTool({
  id: "DECO_TRIGGER_LIST",
  description: "List all triggers for the current agent",
  outputSchema: ListTriggersOutputSchema,
  execute: (agent) => async () => {
    const agentId = agent.state.id.split("/").at(-1) ?? "";
    const triggers = await listTriggers(
      agent.workspace,
      agent.storage,
      agentId,
    );
    return {
      success: true,
      message: "Triggers listed successfully",
      triggers: triggers.map((trigger) => ({
        id: trigger.id,
        data: trigger,
      })),
    };
  },
});

/**
 * Creates a tool for getting webhook trigger URLs
 */
export const DECO_TRIGGER_GET_WEBHOOK_URL = createInnateTool({
  id: "DECO_TRIGGER_GET_WEBHOOK_URL",
  description: "Get the webhook URL for a specific trigger ID",
  inputSchema: GetWebhookTriggerUrlInputSchema,
  outputSchema: GetWebhookTriggerUrlOutputSchema,
  execute: (agent) => async ({ context }) => {
    try {
      if (!agent.storage) {
        return {
          success: false,
          message: "Storage not available",
        };
      }

      const trigger = await agent.storage.triggers
        ?.for(agent.workspace)
        .get(context.id);

      if (!trigger || trigger.type !== "webhook") {
        return {
          success: false,
          message: "Trigger not found",
        };
      }

      const triggerId = join(
        agent.state.id,
        Path.folders.trigger(context.id),
      );

      return {
        success: true,
        message: "Webhook URL retrieved successfully",
        url: buildWebhookUrl(triggerId, trigger.passphrase),
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to get webhook URL: ${error}`,
      };
    }
  },
});

export const tools = {
  DECO_TRIGGER_CREATE_CRON,
  DECO_TRIGGER_CREATE_WEBHOOK,
  DECO_TRIGGER_DELETE,
  DECO_TRIGGER_LIST,
  DECO_TRIGGER_GET_WEBHOOK_URL,
} as const;

export const threadOf = (
  data: TriggerData,
  url?: URL,
): { threadId: string | undefined; resourceId: string | undefined } => {
  const resourceId = data.resourceId ?? url?.searchParams.get("resourceId") ??
    undefined;
  const threadId = url?.searchParams.get("threadId") ??
    (resourceId ? crypto.randomUUID() : undefined); // generate a random threadId if resourceId exists.
  return { threadId, resourceId };
};

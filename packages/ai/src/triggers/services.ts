import type { ActorState } from "@deco/actors";
import { actors } from "@deco/actors/stub";
import { Hosts } from "@deco/sdk/hosts";
import { join } from "@std/path/posix";
import type { Workspace } from "@deco/sdk/path";
import { Path } from "@deco/sdk/path";
import { z } from "zod";
import type { Agent } from "../schemas.ts";
import type { DecoChatStorage } from "../storage/index.ts";
import { Trigger } from "./trigger.ts";

export type TriggerData = CreateTriggerInput & {
  id: string;
  agent?: Agent;
  resourceId?: string;
  createdAt?: string;
  updatedAt?: string;
  author?: {
    id: string;
    name: string;
    email: string;
    avatar: string;
  };
};

/**
 * Schema for tool call validation
 */
export const PromptSchema = z.object({
  threadId: z.string().optional().describe(
    "if not provided, the same conversation thread will be used, you can pass any string you want to use",
  ),
  resourceId: z.string().optional().describe(
    "if not provided, the same resource will be used, you can pass any string you want to use",
  ),
  messages: z.array(z.object({
    role: z.enum(["user", "assistant", "system"]),
    content: z.string(),
  })).describe("The messages to send to the LLM"),
});

/**
 * Schema for cron trigger validation
 */
export const CronTriggerSchema = z.object({
  title: z.string().describe("The title of the trigger"),
  description: z.string().optional().describe(
    "The description of the trigger",
  ),
  cronExp: z.string(),
  prompt: PromptSchema,
  type: z.literal("cron"),
});

/**
 * Schema for webhook trigger validation
 */
export const WebhookTriggerSchema = z.object({
  title: z.string().describe("The title of the trigger"),
  description: z.string().optional().describe(
    "The description of the trigger",
  ),
  type: z.literal("webhook"),
  passphrase: z.string().optional().describe("The passphrase for the webhook"),
  schema: z.record(z.string(), z.unknown()).optional().describe(
    "The JSONSchema of the returning of the webhook.\n\n" +
    "By default this webhook returns the LLM generate text response.\n\n" +
    "If a JSONSchema is specified, it returns a JSON with the specified schema.\n\n",
  ),
});

/**
 * Input schema for creating new triggers
 */
export const CreateCronTriggerInputSchema = CronTriggerSchema;

export const CreateWebhookTriggerInputSchema = WebhookTriggerSchema;

export type CreateTriggerInput =
  | z.infer<typeof CreateCronTriggerInputSchema>
  | z.infer<typeof CreateWebhookTriggerInputSchema>;

/**
 * Output schema for the trigger creation operation
 */
export const CreateCronTriggerOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  id: z.string(),
});

/**
 * Input schema for deleting a trigger
 */
export const DeleteTriggerInputSchema = z.object({
  id: z.string().describe("The trigger ID"),
});

/**
 * Output schema for trigger deletion results
 */
export const DeleteTriggerOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export const TriggerSchema = z.union([
  CreateCronTriggerInputSchema,
  CreateWebhookTriggerInputSchema,
]);

/**
 * Input schema for getting webhook trigger URL
 */
export const GetWebhookTriggerUrlInputSchema = z.object({
  id: z.string().describe("The trigger ID"),
});

/**
 * Output schema for webhook trigger URL results
 */
export const GetWebhookTriggerUrlOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  url: z.string().optional().describe("The URL of the webhook trigger"),
});

/**
 * Output schema for trigger listing results
 */
export const ListTriggersOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  triggers: z.array(z.object({
    id: z.string().describe("The trigger ID"),
    data: TriggerSchema,
  })),
});

export const CreateWebhookTriggerOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  id: z.string(),
  url: z.string().optional().describe("The URL of the webhook"),
});

export interface TriggerListResult {
  success: boolean;
  message: string;
  triggers: z.infer<typeof ListTriggersOutputSchema>["triggers"];
}

export interface TriggerRun {
  id: string;
  triggerId: string;
  timestamp: string;
  result: Record<string, unknown> | null;
  status: string;
  metadata: Record<string, unknown> | null;
}

export interface TriggerRunListResult {
  success: boolean;
  message: string;
  runs: TriggerRun[] | undefined;
}

/**
 * Lists all triggers using Supabase implementation
 * @param workspace - The workspace
 * @param storage - The DecoChatStorage instance
 * @returns Object containing success status, message, and triggers array
 */
export const listTriggers = async (
  workspace: Workspace,
  storage: DecoChatStorage | undefined,
  agentId?: string,
): Promise<TriggerData[]> => {
  try {
    if (!storage || !storage.triggers) {
      return [];
    }

    return await storage.triggers
      ?.for(workspace)
      .list(agentId);
  } catch (_) {
    return [];
  }
};

/**
 * Lists all runs for a specific trigger using filesystem
 * @param workspace - The workspace
 * @param triggerId - The trigger ID
 * @returns Object containing success status, message, and runs array
 */
export const listTriggerRuns = async (
  triggerId: string,
  workspace: Workspace,
  storage: DecoChatStorage | undefined,
): Promise<TriggerRunListResult> => {
  if (!storage) {
    return {
      success: false,
      message: "Storage not available",
      runs: [],
    };
  }

  const runs = await storage.triggers?.for(workspace).listRuns(triggerId);

  return {
    success: true,
    message: `Found ${runs?.length} trigger runs`,
    runs,
  };
};

/**
 * Generates a webhook URL for a trigger
 * @param triggerId - The full trigger ID path
 * @param passphrase - The webhook passphrase
 * @returns The webhook URL
 */
export const buildWebhookUrl = (
  triggerId: string,
  passphrase: string | undefined,
) => {
  return `https://${Hosts.API}/actors/${Trigger.name}/invoke/run?passphrase=${passphrase}&deno_isolate_instance_id=${triggerId}`;
};

/**
 * Creates a new trigger
 * @param agent - The agent to create the trigger for
 * @param context - The context of the trigger
 * @param id - The ID for the trigger
 * @returns The trigger
 */
const createTrigger = async (
  stub: ActorState["stub"] = actors.stub,
  workspace: Workspace,
  agentId: string,
  userId: string,
  context: CreateTriggerInput & { url?: string },
  resourceId: string | undefined,
  id: string,
) => {
  const triggerId = Path.resolveHome(
    join(Path.folders.Agent.root(agentId), Path.folders.trigger(id)),
    workspace,
  ).path;

  try {
    await stub(Trigger).new(triggerId).create(
      { ...context, id, resourceId },
      agentId,
      userId,
    );
    return {
      success: true,
      message: "Trigger created successfully",
      id,
      url: context.url,
    };
  } catch (error) {
    console.error(error);
    return {
      success: false,
      message: `Failed to create trigger: ${error}`,
      id,
      url: undefined,
    };
  }
};

/**
 * Creates a new webhook trigger
 * @param agent - The agent to create the trigger for
 * @param trigger - The trigger configuration
 * @param resourceId - Optional resource ID
 * @returns The created webhook trigger
 */
export const createWebhookTrigger = async ({
  stub,
  workspace,
  agentId,
  trigger,
  resourceId,
  userId,
}: {
  stub: ActorState["stub"];
  workspace: Workspace;
  agentId: string;
  trigger: z.infer<typeof WebhookTriggerSchema>;
  resourceId?: string;
  userId: string;
}): Promise<z.infer<typeof CreateWebhookTriggerOutputSchema>> => {
  const id = crypto.randomUUID();
  const triggerId = Path.resolveHome(
    join(Path.folders.Agent.root(agentId), Path.folders.trigger(id)),
    workspace,
  ).path;

  const url = buildWebhookUrl(triggerId, trigger.passphrase);

  return await createTrigger(
    stub,
    workspace,
    agentId,
    userId,
    {
      type: "webhook",
      title: trigger.title,
      description: trigger.description,
      passphrase: trigger.passphrase,
      schema: trigger.schema,
      url,
    },
    resourceId,
    id,
  );
};

/**
 * Creates a new cron trigger
 * @param agent - The agent to create the trigger for
 * @param trigger - The trigger configuration
 * @param resourceId - Optional resource ID
 * @returns The created cron trigger
 */
export const createCronTrigger = async ({
  stub,
  workspace,
  agentId,
  trigger,
  resourceId,
  userId,
}: {
  stub: ActorState["stub"];
  workspace: Workspace;
  agentId: string;
  trigger: z.infer<typeof CronTriggerSchema>;
  resourceId?: string;
  userId: string;
}): Promise<z.infer<typeof CreateCronTriggerOutputSchema>> => {
  const id = crypto.randomUUID();
  return await createTrigger(
    stub,
    workspace,
    agentId,
    userId,
    {
      type: "cron",
      title: trigger.title,
      description: trigger.description,
      cronExp: trigger.cronExp,
      prompt: {
        ...trigger.prompt,
        resourceId: trigger.prompt.resourceId ?? resourceId,
      },
    },
    resourceId,
    id,
  );
};

/**
 * Deletes a trigger by its ID
 * @param agent - The agent that owns the trigger
 * @param triggerId - The ID of the trigger to delete
 * @returns Object containing success status and message
 */
export const deleteTrigger = async ({
  stub,
  agentId,
  workspace,
  triggerId,
}: {
  stub: ActorState["stub"];
  agentId: string;
  workspace: Workspace;
  triggerId: string;
}): Promise<z.infer<typeof DeleteTriggerOutputSchema>> => {
  try {
    const triggerWorkspace = Path.resolveHome(
      join(Path.folders.Agent.root(agentId), Path.folders.trigger(triggerId)),
      workspace,
    ).path;
    const result = await stub(Trigger).new(triggerWorkspace).delete();

    if (!result || result.success === false) {
      return {
        success: false,
        message: `Failed to delete trigger: ${result}`,
      };
    }

    return {
      success: true,
      message: `Trigger ${triggerId} deleted successfully`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to delete trigger: ${error}`,
    };
  }
};

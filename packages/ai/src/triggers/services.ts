import type { ActorState } from "@deco/actors";
import { actors } from "@deco/actors/stub";
import {
  CreateCronTriggerOutputSchema,
  CreateTriggerInput,
  CreateWebhookTriggerOutputSchema,
  CronTriggerSchema,
  DeleteTriggerOutputSchema,
  ListTriggersOutputSchema,
  WebhookTriggerSchema,
} from "@deco/sdk";
import { Hosts } from "@deco/sdk/hosts";
import { MCPClientStub, WorkspaceTools } from "@deco/sdk/mcp";
import type { Workspace } from "@deco/sdk/path";
import { Path } from "@deco/sdk/path";
import { join } from "node:path/posix";
import { z } from "zod";
import { Trigger } from "./trigger.ts";

export type TriggerData = CreateTriggerInput & {
  id: string;
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
  mcpClient: MCPClientStub<WorkspaceTools>,
  agentId?: string,
): Promise<z.infer<typeof ListTriggersOutputSchema>["triggers"]> => {
  return await mcpClient.TRIGGERS_LIST({ agentId }).then((res) => res.triggers);
};

/**
 * Generates a webhook URL for a trigger
 * @param triggerId - The full trigger ID path
 * @param passphrase - The webhook passphrase
 * @returns The webhook URL
 */
export const buildWebhookUrl = (
  triggerId: string,
  passphrase?: string,
  outputTool?: string,
) => {
  const url = new URL(
    `https://${Hosts.API}/actors/${Trigger.name}/invoke/run`,
  );
  url.searchParams.set("deno_isolate_instance_id", triggerId);

  if (passphrase) {
    url.searchParams.set("passphrase", passphrase);
  }
  if (outputTool) {
    url.searchParams.set("outputTool", outputTool);
  }
  return url.toString();
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
  mcpClient,
}: {
  stub: ActorState["stub"];
  workspace: Workspace;
  agentId: string;
  trigger: z.infer<typeof WebhookTriggerSchema>;
  resourceId?: string;
  mcpClient: MCPClientStub<WorkspaceTools>;
}): Promise<z.infer<typeof CreateWebhookTriggerOutputSchema>> => {
  const id = crypto.randomUUID();
  const triggerId = Path.resolveHome(
    join(Path.folders.Agent.root(agentId), Path.folders.trigger(id)),
    workspace,
  ).path;

  const url = buildWebhookUrl(
    triggerId,
    trigger.passphrase,
    trigger.outputTool,
  );

  const data = {
    type: "webhook",
    title: trigger.title,
    description: trigger.description,
    passphrase: trigger.passphrase,
    schema: trigger.schema,
    url,
  } as CreateTriggerInput & { url?: string };

  const result = await createTrigger(
    stub,
    workspace,
    agentId,
    data,
    resourceId,
    id,
  );

  await mcpClient.TRIGGERS_CREATE({
    agentId,
    data,
  });

  return result;
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
  mcpClient,
}: {
  stub: ActorState["stub"];
  workspace: Workspace;
  agentId: string;
  trigger: z.infer<typeof CronTriggerSchema>;
  resourceId?: string;
  userId: string;
  mcpClient: MCPClientStub<WorkspaceTools>;
}): Promise<z.infer<typeof CreateCronTriggerOutputSchema>> => {
  const id = crypto.randomUUID();
  const data = {
    type: "cron",
    title: trigger.title,
    description: trigger.description,
    cronExp: trigger.cronExp,
    prompt: {
      ...trigger.prompt,
      resourceId: trigger.prompt.resourceId ?? resourceId,
    },
  } as CreateTriggerInput & { url?: string };
  const result = await createTrigger(
    stub,
    workspace,
    agentId,
    data,
    resourceId,
    id,
  );

  await mcpClient.TRIGGERS_CREATE({
    agentId,
    data,
  });

  return result;
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
  mcpClient,
}: {
  stub: ActorState["stub"];
  agentId: string;
  workspace: Workspace;
  triggerId: string;
  mcpClient: MCPClientStub<WorkspaceTools>;
}): Promise<z.infer<typeof DeleteTriggerOutputSchema>> => {
  const triggerWorkspace = Path.resolveHome(
    join(Path.folders.Agent.root(agentId), Path.folders.trigger(triggerId)),
    workspace,
  ).path;
  const result = await stub(Trigger).new(triggerWorkspace).delete();

  if (!result || result.success === false) {
    throw new Error(`Failed to delete trigger: ${result}`);
  }

  return await mcpClient.TRIGGERS_DELETE({
    agentId,
    triggerId,
  });
};

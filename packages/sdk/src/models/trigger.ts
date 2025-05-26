import { z } from "zod";
import { AgentSchema } from "./agent.ts";

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
  outputTool: z.string().optional(),
  schema: z.record(z.string(), z.unknown()).optional().describe(
    "The JSONSchema of the returning of the webhook.\n\n" +
      "By default this webhook returns the LLM generate text response.\n\n" +
      "If a JSONSchema is specified, it returns a JSON with the specified schema.\n\n",
  ),
  whatsappEnabled: z.boolean().optional().describe(
    "Whether the webhook is enabled for WhatsApp",
  ),
});

export const WebhookTriggerOutputSchema = z.object({
  title: z.string().describe("The title of the trigger"),
  description: z.string().optional().describe(
    "The description of the trigger",
  ),
  type: z.literal("webhook"),
  passphrase: z.string().optional().describe("The passphrase for the webhook"),
  outputTool: z.string().optional(),
  schema: z.record(z.string(), z.unknown()).optional().describe(
    "The JSONSchema of the returning of the webhook.\n\n" +
      "By default this webhook returns the LLM generate text response.\n\n" +
      "If a JSONSchema is specified, it returns a JSON with the specified schema.\n\n",
  ),
  url: z.string().describe("The URL of the webhook"),
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
export const DeleteTriggerOutputSchema = z.void();

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
  url: z.string().optional().describe("The URL of the webhook trigger"),
});

/**
 * Output schema for trigger results
 */
export const TriggerOutputSchema = z.object({
  id: z.string().describe("The trigger ID"),
  type: z.enum(["cron", "webhook"]),
  agent: AgentSchema,
  createdAt: z.string().describe("The creation date"),
  updatedAt: z.string().describe("The update date"),
  user: z.object({
    id: z.string().describe("The user ID"),
    metadata: z.object({
      full_name: z.string().describe("The user name"),
      email: z.string().describe("The user email"),
      avatar_url: z.string().describe("The user avatar"),
    }),
  }),
  active: z.boolean().optional().describe("The trigger status"),
  workspace: z.string().describe("The workspace ID"),
  data: TriggerSchema,
});

export const CreateTriggerOutputSchema = TriggerOutputSchema.describe(
  "The created trigger",
);

/**
 * Output schema for trigger listing results
 */
export const ListTriggersOutputSchema = z.object({
  triggers: z.array(TriggerOutputSchema),
});

export const CreateWebhookTriggerOutputSchema = z.object({
  id: z.string(),
  url: z.string().optional().describe("The URL of the webhook"),
});

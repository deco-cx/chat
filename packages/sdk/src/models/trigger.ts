import { z } from "zod";

/**
 * Schema for tool call validation
 */
export const PromptSchema = z.object({
  threadId: z
    .string()
    .optional()
    .describe(
      "if not provided, the same conversation thread will be used, you can pass any string you want to use",
    ),
  resourceId: z
    .string()
    .optional()
    .describe(
      "if not provided, the same resource will be used, you can pass any string you want to use",
    ),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string(),
      }),
    )
    .describe("The messages to send to the LLM"),
});

/**
 * Schema for cron trigger validation
 */
export const CronBaseTriggerSchema = z.object({
  title: z.string().describe("The title of the trigger"),
  description: z.string().optional().describe("The description of the trigger"),
  cronExp: z.string(),
  type: z.literal("cron"),
});

/**
 * Schema for cron trigger validation
 */
export const CronTriggerPromptAgentSchema = CronBaseTriggerSchema.extend({
  agentId: z.string().describe("The agent ID to use for the trigger"),
  prompt: PromptSchema,
  url: z.string().describe("The URL of the webhook").optional(),
});

export const CallToolSchema = z.object({
  integrationId: z.string().describe("The integration ID"),
  toolName: z.string().describe("The tool name"),
  arguments: z
    .record(z.string(), z.unknown())
    .describe("The arguments to pass to the tool")
    .optional(),
});
export type CallTool = z.infer<typeof CallToolSchema>;

export const CronTriggerCallToolSchema = CronBaseTriggerSchema.extend({
  callTool: CallToolSchema,
});

export const CronTriggerSchema = z.union([
  CronTriggerPromptAgentSchema,
  CronTriggerCallToolSchema,
]);

export const WebhookBaseTriggerSchema = z.object({
  title: z.string().describe("The title of the trigger"),
  description: z.string().optional().describe("The description of the trigger"),
  type: z.literal("webhook"),
  url: z.string().optional().describe("The URL of the webhook"),
  passphrase: z.string().optional().describe("The passphrase for the webhook"),
});

/**
 * Schema for webhook trigger validation
 */
export const WebhookTriggerAgentSchema = WebhookBaseTriggerSchema.extend({
  agentId: z.string().describe("The agent ID to use for the trigger"),
  schema: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      "The JSONSchema of the returning of the webhook.\n\n" +
        "By default this webhook returns the LLM generate text response.\n\n" +
        "If a JSONSchema is specified, it returns a JSON with the specified schema.\n\n",
    ),
});

export const WebhookTriggerCallToolSchema = WebhookBaseTriggerSchema.extend({
  callTool: CallToolSchema,
});

export const WebhookTriggerSchema = z.union([
  WebhookTriggerAgentSchema,
  WebhookTriggerCallToolSchema,
]);

export const WebhookTriggerOutputSchema = z.object({
  title: z.string().describe("The title of the trigger"),
  description: z.string().optional().describe("The description of the trigger"),
  type: z.literal("webhook"),
  passphrase: z.string().optional().describe("The passphrase for the webhook"),
  schema: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
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
export const DeleteTriggerOutputSchema = z.object({
  id: z.string().describe("The trigger ID"),
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
  url: z.string().optional().describe("The URL of the webhook trigger"),
});

/**
 * Output schema for trigger results
 */
export const TriggerOutputSchema = z.object({
  id: z.string().describe("The trigger ID"),
  type: z.enum(["cron", "webhook"]),
  data: TriggerSchema,
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
  workspace: z.string().nullable().describe("The workspace ID"),
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

/**
 * Type alias for trigger output - use this instead of z.infer<typeof TriggerOutputSchema>
 */
export type TriggerOutput = z.infer<typeof TriggerOutputSchema>;

/**
 * Type alias for list triggers output - use this instead of z.infer<typeof ListTriggersOutputSchema>
 */
export type ListTriggersOutput = z.infer<typeof ListTriggersOutputSchema>;

/**
 * Type alias for create trigger output - use this instead of z.infer<typeof CreateTriggerOutputSchema>
 */
export type CreateTriggerOutput = z.infer<typeof CreateTriggerOutputSchema>;

/**
 * Type alias for delete trigger output - use this instead of z.infer<typeof DeleteTriggerOutputSchema>
 */
export type DeleteTriggerOutput = z.infer<typeof DeleteTriggerOutputSchema>;

/**
 * Type alias for get webhook trigger URL output - use this instead of z.infer<typeof GetWebhookTriggerUrlOutputSchema>
 */
export type GetWebhookTriggerUrlOutput = z.infer<
  typeof GetWebhookTriggerUrlOutputSchema
>;

/**
 * Type alias for trigger schema - use this instead of z.infer<typeof TriggerSchema>
 */
export type Trigger = z.infer<typeof TriggerSchema>;

/**
 * Type alias for cron trigger prompt agent schema - use this instead of z.infer<typeof CronTriggerPromptAgentSchema>
 */
export type CronTriggerPromptAgent = z.infer<
  typeof CronTriggerPromptAgentSchema
>;

/**
 * Type alias for cron trigger call tool schema - use this instead of z.infer<typeof CronTriggerCallToolSchema>
 */
export type CronTriggerCallTool = z.infer<typeof CronTriggerCallToolSchema>;

/**
 * Type alias for webhook trigger agent schema - use this instead of z.infer<typeof WebhookTriggerAgentSchema>
 */
export type WebhookTriggerAgent = z.infer<typeof WebhookTriggerAgentSchema>;

export type WebhookTrigger = z.infer<typeof WebhookTriggerSchema>;
export type CronTrigger = z.infer<typeof CronTriggerSchema>;

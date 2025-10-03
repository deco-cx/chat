import { z } from "zod/v3";
import { DEFAULT_MODEL, WELL_KNOWN_MODELS } from "../constants.ts";
import {
  DecoConnectionSchema,
  HTTPConnectionSchema,
  InnateConnectionSchema,
  SSEConnectionSchema,
  WebsocketConnectionSchema,
} from "./mcp.ts";

const wellKnownModelIds = [
  ...WELL_KNOWN_MODELS.map((m) => m.id),
  ...WELL_KNOWN_MODELS.map((m) => m.legacyId).filter(Boolean),
];

/**
 * Schema for agent model validation
 * Accepts either well-known model IDs or UUIDs for BYOK models
 */
export const ModelSchema = z
  .string()
  .refine(
    (val) => {
      // Check if it's a well-known model ID
      if (wellKnownModelIds.includes(val)) {
        return true;
      }
      // Check if it's a valid UUID
      if (
        val.match(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        )
      ) {
        return true;
      }
      return false;
    },
    {
      message: "Model must be a well-known model ID or valid UUID",
    },
  )
  .default(DEFAULT_MODEL.id);

/**
 * Zod schema for an AI Agent
 */
export const AgentSchema = z.object({
  /** Unique identifier for the agent */
  id: z.string().describe("Unique identifier for the agent"),
  /** Human-readable name of the agent */
  name: z.string().describe("Human-readable name of the agent"),
  /** URL to the agent's avatar image */
  avatar: z.string().describe("URL to the agent's avatar image"),
  /** System prompt/instructions for the agent */
  instructions: z.string().describe("System prompt/instructions for the agent"),
  /** Brief description of the agent's purpose or capabilities */
  description: z
    .string()
    .optional()
    .describe("Brief description of the agent's purpose or capabilities"),
  /** Tools available to the agent */
  tools_set: z
    .record(
      z.string().describe("The integrationId"),
      z
        .array(z.string())
        .describe(
          "Tool names for a given integrationId. Add an empty array for enabling all tools of this integration. This should prevent bugs",
        ),
    )
    .describe("Tools available to the agent"),
  /** Maximum number of steps the agent can take */
  max_steps: z
    .number()
    .optional()
    .describe("Maximum number of steps the agent can take, defaults to 7"),
  /** Maximum number of tokens the agent can use */
  max_tokens: z
    .number()
    .nullable()
    .optional()
    .describe("Maximum number of tokens the agent can use, defaults to 8192"),
  /** Model to use for the agent */
  model: ModelSchema.describe(
    "Model to use for the agent - either a well-known model ID or UUID for BYOK models",
  ),
  /** Memory to use for the agent */
  memory: z
    .object({
      discriminator: z
        .string()
        .optional()
        .describe("A memory discriminator for the tenant"),
      last_messages: z
        .number()
        .optional()
        .describe("The number of messages to keep in memory"),
      semantic_recall: z
        .boolean()
        .optional()
        .describe("Whether to use semantic recall"),
      working_memory: z
        .object({
          enabled: z
            .boolean()
            .optional()
            .describe("Whether to use working memory"),
          template: z
            .string()
            .optional()
            .describe(
              "The template or JSON schema string to use for working memory",
            ),
        })
        .optional()
        .describe("Working memory to use for the agent"),
    })
    .optional()
    .describe("Memory to use for the agent"),
  /** Views where the agent can be used */
  views: z
    .array(
      z.object({
        /** URL for the view */
        url: z.string().describe("URL for the view"),
        /** Name of the view */
        name: z.string().describe("Name of the view"),
      }),
    )
    .describe("Views where the agent can be used"),
  /** Visibility of the agent */
  visibility: z
    .enum(["PUBLIC", "WORKSPACE", "PRIVATE"])
    .describe("Visibility of the agent"),
  access: z.string().optional().nullable().describe("Access control by role"),
  temperature: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .nullable()
    .describe("Temperature of the LLM. Must be between 0 and 1."),
});

const MCPConnectionSchema = z.discriminatedUnion("type", [
  HTTPConnectionSchema,
  SSEConnectionSchema,
  WebsocketConnectionSchema,
  DecoConnectionSchema,
  InnateConnectionSchema,
]);

export const ToolsetSchema = z.object({
  connection: MCPConnectionSchema,
  filters: z.array(z.string()).optional(),
});

export type Toolset = z.infer<typeof ToolsetSchema>;

export const AgentGenerateOptions = z.object({
  instructions: z.string().optional(),
  model: z.string().optional(),
  tools: z.record(z.string(), z.array(z.string())).optional(),
  bypassOpenRouter: z.boolean().optional(),
  threadId: z.string().optional(),
  resourceId: z.string().optional(),
  enableSemanticRecall: z.boolean().optional(),
  maxSteps: z.number().optional(),
  toolsets: z.array(ToolsetSchema).optional(),
  pdfSummarization: z
    .boolean()
    .optional()
    .describe(
      `Preprocess PDFs before sending to the main LLM.
      This can extend the max size of user inputted PDFs by summarizing them.`,
    ),
});

export type GenerateOptions = z.infer<typeof AgentGenerateOptions>;

export const AgentStreamOptions = AgentGenerateOptions.extend({
  sendReasoning: z.boolean().optional(),
  threadTitle: z.string().optional(),
  smoothStream: z
    .object({
      delayInMs: z.number().optional(),
      chunking: z.enum(["word", "line"]).optional(),
    })
    .optional(),
  annotations: z.array(z.any()).optional(),
});

export type StreamOptions = z.infer<typeof AgentStreamOptions>;

/**
 * Type for UIMessage metadata containing all stream options
 * Used with UIMessage<MessageMetadata> for type-safe message passing
 */
export type MessageMetadata = Omit<StreamOptions, "threadId" | "resourceId">;

/**
 * Type representing an AI Agent derived from the Zod schema
 */
export type Agent = z.infer<typeof AgentSchema>;

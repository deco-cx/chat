import type { UIMessage } from "ai";
import { z } from "zod";
import { DEFAULT_MODEL, WELL_KNOWN_MODELS } from "../constants.ts";
import { MCPConnectionSchema } from "./mcp.ts";

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

export const ToolsetSchema = z.object({
  connection: MCPConnectionSchema,
  filters: z.array(z.string()).optional(),
});

export type Toolset = z.infer<typeof ToolsetSchema>;

/**
 * Options for agent generation
 */
export interface GenerateOptions {
  /** Custom instructions to override agent's default instructions */
  instructions?: string;
  /** Model ID to use for generation */
  model?: string;
  /** Tools available for the generation */
  tools?: Record<string, string[]>;
  /** Bypass OpenRouter and use provider directly */
  bypassOpenRouter?: boolean;
  /** Thread ID for the conversation */
  threadId?: string;
  /** Resource ID for the conversation */
  resourceId?: string;
  /** Enable semantic recall for memory */
  enableSemanticRecall?: boolean;
  /** Maximum number of steps the agent can take */
  maxSteps?: number;
  /** Temperature for LLM generation (0-1) */
  temperature?: number;
  /** Number of recent messages to keep in context window */
  lastMessages?: number;
  /** Maximum number of tokens the agent can generate */
  maxTokens?: number;
}

/**
 * Options for agent streaming
 */
export interface StreamOptions extends GenerateOptions {
  /** Whether to send reasoning in the stream */
  sendReasoning?: boolean;
  /** Title for the thread */
  threadTitle?: string;
  /**
   * Additional context messages that are sent to the LLM but not persisted to the thread.
   * Useful for providing temporary context like rules or instructions that shouldn't be part of the conversation history.
   */
  context?: UIMessage[];
}

/**
 * Type for request metadata containing all stream options
 * Used as separate parameter in agent methods for type-safe configuration
 */
export type MessageMetadata = Omit<StreamOptions, "threadId" | "resourceId">;

/**
 * Type representing an AI Agent derived from the Zod schema
 */
export type Agent = z.infer<typeof AgentSchema>;

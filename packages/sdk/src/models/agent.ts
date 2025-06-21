import { z } from "zod";
import { DEFAULT_MODEL, WELL_KNOWN_MODELS } from "../constants.ts";

const wellKnownModelIds = [
  ...WELL_KNOWN_MODELS.map((m) => m.id),
  ...WELL_KNOWN_MODELS.map((m) => m.legacyId).filter(Boolean),
];

/**
 * Schema for agent model validation
 * Accepts either well-known model IDs or UUIDs for BYOK models
 */
const ModelSchema = z.union([
  // Well-known model IDs
  z.enum(wellKnownModelIds as [string, ...string[]]),
  // UUID format for BYOK models
  z.string().uuid().describe("UUID for BYOK models"),
]);

/**
 * Schema for a space configuration
 */
const SpaceSchema = z.object({
  /** Name of the space */
  title: z.string().describe("Name of the space"),
  /** Dock/tab layout configuration */
  viewSetup: z.record(z.any()).describe("Dock/tab layout configuration"),
  /** Theme configuration for this space */
  theme: z.record(z.string()).optional().describe("Theme configuration for this space"),
});

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
  description: z.string().optional().describe(
    "Brief description of the agent's purpose or capabilities",
  ),
  /** Tools available to the agent */
  tools_set: z.record(
    z.string().describe("The integrationId"),
    z.array(z.string()).describe(
      "Tool names for a given integrationId. Add an empty array for enabling all tools of this integration. This should prevent bugs",
    ),
  ).describe("Tools available to the agent"),
  /** Maximum number of steps the agent can take */
  max_steps: z.number().optional().describe(
    "Maximum number of steps the agent can take, defaults to 7",
  ),
  /** Maximum number of tokens the agent can use */
  max_tokens: z.number().nullable().optional().describe(
    "Maximum number of tokens the agent can use, defaults to 8192",
  ),
  /** Model to use for the agent */
  model: ModelSchema.default(DEFAULT_MODEL.id)
    .describe(
      "Model to use for the agent - either a well-known model ID or UUID for BYOK models",
    ),
  /** Memory to use for the agent */
  memory: z.object({
    discriminator: z.string().optional().describe(
      "A memory discriminator for the tenant",
    ),
    last_messages: z.number().optional().describe(
      "The number of messages to keep in memory",
    ),
  }).optional().describe("Memory to use for the agent"),
  /** Views where the agent can be used */
  views: z.array(
    z.object({
      /** URL for the view */
      url: z.string().describe("URL for the view"),
      /** Name of the view */
      name: z.string().describe("Name of the view"),
    }),
  ).describe("Views where the agent can be used"),
  /** Visibility of the agent */
  visibility: z.enum(["PUBLIC", "WORKSPACE", "PRIVATE"])
    .describe("Visibility of the agent"),
  access: z.string().optional().nullable().describe(
    "Access control by role",
  ),
  /** Saved spaces configurations */
  spaces: z.record(SpaceSchema).optional().describe(
    "Saved spaces configurations for different editing layouts",
  ),
});

/**
 * Type representing an AI Agent derived from the Zod schema
 */
export type Agent = z.infer<typeof AgentSchema>;

/**
 * Type representing a Space configuration
 */
export type Space = z.infer<typeof SpaceSchema>;

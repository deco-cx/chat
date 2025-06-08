import { z } from "zod";
import { DEFAULT_MODEL } from "../constants.ts";

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
  /** Token usage level (minimal: 10%, normal: 50%, max: 100%) */
  tokenUsage: z.enum(["minimal", "normal", "max"]).default("normal").optional().describe(
    "Token usage level: minimal (10%), normal (50%), max (100%)",
  ),
  /** Model to use for the agent */
  model: z.string().default(DEFAULT_MODEL.id)
    .describe("Model to use for the agent"),
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
});

/**
 * Type representing an AI Agent derived from the Zod schema
 */
export type Agent = z.infer<typeof AgentSchema>;

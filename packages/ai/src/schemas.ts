import { z } from "zod";

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
  description: z.string().nullish().describe(
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
  max_steps: z.number().nullish().describe(
    "Maximum number of steps the agent can take, defaults to 7",
  ),
  /** Maximum number of tokens the agent can use */
  max_tokens: z.number().nullish().describe(
    "Maximum number of tokens the agent can use, defaults to 8192",
  ),
  /** Model to use for the agent */
  model: z.string().default("anthropic:claude-3.7-sonnet:thinking")
    .describe("Model to use for the agent"),
  /** Memory to use for the agent */
  memory: z.object({
    discriminator: z.string().nullish().describe(
      "A memory discriminator for the tenant",
    ),
    last_messages: z.number().nullish().describe(
      "The number of messages to keep in memory",
    ),
  }).nullish().describe("Memory to use for the agent"),
  /** Views where the agent can be used */
  views: z.array(
    z.object({
      /** URL for the view */
      url: z.string().describe("URL for the view"),
      /** Name of the view */
      name: z.string().describe("Name of the view"),
    }),
  ).describe("Views where the agent can be used"),
  draft: z.boolean().nullish().describe("Whether the agent is in draft mode"),
});

/**
 * Type representing an AI Agent derived from the Zod schema
 */
export type Agent = z.infer<typeof AgentSchema>;

/**
 * Schema for different connection types
 */
export const SSEConnectionSchema = z.object({
  type: z.literal("SSE"),
  url: z.string().url(),
  token: z.string().optional(),
  headers: z.record(z.string()).optional(),
});

export const WebsocketConnectionSchema = z.object({
  type: z.literal("Websocket"),
  url: z.string().url(),
  token: z.string().optional(),
});

export const DecoConnectionSchema = z.object({
  type: z.literal("Deco"),
  tenant: z.string(),
  token: z.string().optional(),
});

export const InnateConnectionSchema = z.object({
  type: z.literal("INNATE"),
  name: z.string(),
  workspace: z.string().optional(),
});

export const HTTPConnectionSchema = z.object({
  type: z.literal("HTTP"),
  url: z.string().url(),
  token: z.string().optional(),
});

/**
 * Zod schema for a Multi-Channel Platform integration
 */
export const IntegrationSchema = z.object({
  /** Unique identifier for the MCP */
  id: z.string(),
  /** Human-readable name of the integration */
  name: z.string(),
  /** Brief description of the integration's functionality */
  description: z.string().nullish(),
  /** URL to the integration's icon */
  icon: z.string().nullish(),
  /** Connection configuration */
  connection: z.discriminatedUnion("type", [
    HTTPConnectionSchema,
    SSEConnectionSchema,
    WebsocketConnectionSchema,
    DecoConnectionSchema,
    InnateConnectionSchema,
  ]),
});

/**
 * Type representing a Multi-Channel Platform integration derived from the Zod schema
 */
export type Integration = z.infer<typeof IntegrationSchema>;
export type SSEConnection = z.infer<typeof SSEConnectionSchema>;
export type WebsocketConnection = z.infer<typeof WebsocketConnectionSchema>;
export type DecoConnection = z.infer<typeof DecoConnectionSchema>;
export type InnateConnection = z.infer<typeof InnateConnectionSchema>;
export type HTTPConnection = z.infer<typeof HTTPConnectionSchema>;
export type MCPConnection =
  | SSEConnection
  | WebsocketConnection
  | InnateConnection
  | DecoConnection
  | HTTPConnection;

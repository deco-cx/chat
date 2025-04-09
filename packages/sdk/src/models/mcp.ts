import { z } from "zod";

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
  name: z.enum(["CORE"]),
});

export const HTTPConnectionSchema = z.object({
  type: z.literal("HTTP"),
  url: z.string().url(),
  token: z.string().optional(),
});

export const AgentConnectionSchema = z.object({
  type: z.literal("AGENT"),
  agentId: z.string(),
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
  description: z.string().optional(),
  /** URL to the integration's icon */
  icon: z.string().optional(),
  /** Connection configuration */
  connection: z.discriminatedUnion("type", [
    HTTPConnectionSchema,
    SSEConnectionSchema,
    WebsocketConnectionSchema,
    DecoConnectionSchema,
    InnateConnectionSchema,
    AgentConnectionSchema,
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
export type AgentConnection = z.infer<typeof AgentConnectionSchema>;
export type MCPConnection =
  | SSEConnection
  | WebsocketConnection
  | InnateConnection
  | DecoConnection
  | HTTPConnection
  | AgentConnection;

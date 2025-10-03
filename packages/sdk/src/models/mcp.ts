import { z } from "zod/v3";
import type { WellKnownBindingsName } from "../mcp/index.ts";
import { ToolDefinitionSchema } from "../mcp/tools/schemas.ts";

export const BindingsSchema = z.enum([
  "Channel",
  "View",
] as const satisfies WellKnownBindingsName[]);
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
  description: z.string().optional(),
  /** URL to the integration's icon */
  icon: z.string().optional(),
  /** Access level of the integration */
  access: z.string().optional().nullable(),
  /** App Name */
  appName: z.string().optional().nullable(),
  /** App ID */
  appId: z.string().optional().nullable(),
  /** Connection configuration */
  connection: z.discriminatedUnion("type", [
    HTTPConnectionSchema,
    SSEConnectionSchema,
    WebsocketConnectionSchema,
    DecoConnectionSchema,
    InnateConnectionSchema,
  ]),
  /** Metadata */
  metadata: z.record(z.any()).optional().nullable(),
  /** Tools */
  tools: z
    .array(
      ToolDefinitionSchema.pick({
        name: true,
        inputSchema: true,
      }).and(
        ToolDefinitionSchema.pick({
          description: true,
          outputSchema: true,
        }).partial(),
      ),
    )
    .nullish(),
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

export type Binder = z.infer<typeof BindingsSchema>;

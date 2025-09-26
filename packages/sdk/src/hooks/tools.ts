import { useMutation, useQuery } from "@tanstack/react-query";
import type { MCPConnection } from "../models/mcp.ts";
import { MCPClient } from "../fetcher.ts";
export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

export interface MCPToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface MCPToolCallResult<T = unknown> {
  content: Array<{
    text: string;
    type: "text";
  }>;
  structuredContent?: T;
  isError?: boolean;
}

export type ToolsData = {
  tools: MCPTool[];
  instructions: string;
  version?: {
    name: string;
    version?: string;
  };
  capabilities?: Record<string, unknown>;
};

const INITIAL_DATA: ToolsData = { tools: [], instructions: "" };

export const listTools = (
  connection: MCPConnection,
  init?: RequestInit,
  ignoreCache?: boolean,
): Promise<ToolsData> =>
  MCPClient.INTEGRATIONS_LIST_TOOLS(
    { connection, ignoreCache },
    init,
  ) as Promise<ToolsData>;

export const callTool = (
  connection: MCPConnection,
  toolCallArgs: MCPToolCall,
) =>
  MCPClient.INTEGRATIONS_CALL_TOOL({
    connection,
    // deno-lint-ignore no-explicit-any
    params: toolCallArgs as any,
  });

export function useTools(connection: MCPConnection, ignoreCache?: boolean) {
  const response = useQuery({
    retry: false,
    queryKey: [
      "tools",
      connection.type,
      // deno-lint-ignore no-explicit-any
      (connection as any).url ||
        // deno-lint-ignore no-explicit-any
        (connection as any).tenant ||
        // deno-lint-ignore no-explicit-any
        (connection as any).name,
    ],
    queryFn: ({ signal }) => listTools(connection, { signal }, ignoreCache),
  });

  return {
    ...response,
    data: response.data || INITIAL_DATA,
  };
}

export function useToolCall<T = unknown>(connection: MCPConnection) {
  return useMutation<MCPToolCallResult<T>, Error, MCPToolCall>({
    mutationFn: (toolCall: MCPToolCall) =>
      callTool(connection, toolCall) as Promise<MCPToolCallResult<T>>,
  });
}

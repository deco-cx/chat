import { MCPConnection } from "../models/mcp.ts";
import { MCPClient, ToolLike } from "./index.ts";
import { MCPClientFetchStub } from "./stub.ts";

export const createMCPBinding = <TDefinition extends readonly ToolLike[]>() => {
  return {
    forConnection: (
      mcpConnection: MCPConnection,
    ): MCPClientFetchStub<TDefinition> => {
      return new Proxy<MCPClientFetchStub<TDefinition>>(
        {} as MCPClientFetchStub<TDefinition>,
        {
          get(_, name) {
            if (typeof name !== "string") {
              throw new Error("Name must be a string");
            }

            return (args: Record<string, unknown>) => {
              return MCPClient.INTEGRATIONS_CALL_TOOL({
                connection: mcpConnection,
                params: {
                  name,
                  arguments: args,
                },
              });
            };
          },
        },
      );
    },
  };
};

import { MCPConnection } from "../models/mcp.ts";
import { MCPClient, ToolBinder } from "./index.ts";
import { MCPClientFetchStub } from "./stub.ts";

export type Binder<TDefinition extends readonly ToolBinder[]> = {
  [K in keyof TDefinition]: TDefinition[K];
};

export const mcpBinding = <TDefinition extends readonly ToolBinder[]>(
  binder: TDefinition,
) => {
  return {
    implements: async (
      mcpConnection: MCPConnection,
    ) => {
      const listedTools = await MCPClient.INTEGRATIONS_LIST_TOOLS({
        connection: mcpConnection,
      }).catch(() => ({ tools: [] }));

      return binder.filter((tool) =>
        (listedTools.tools ?? []).some((t) => t.name === tool.name)
      );
    },
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

import type {
  GlobalTools,
  MCPClientFetchStub,
  ToolBinder,
  WorkspaceTools,
} from "./mcp/index.ts";
import { createMCPFetchStub } from "./mcp/stub.ts";
import type { MCPConnection } from "./models/mcp.ts";

export interface FetchOptions extends RequestInit {
  path?: string;
  segments?: string[];
}

// Default fetcher instance with API_SERVER_URL and API_HEADERS
const global = createMCPFetchStub<GlobalTools>({});
export const MCPClient = new Proxy(
  {} as typeof global & {
    forWorkspace: (
      workspace: string,
      integrationId?: string,
    ) => MCPClientFetchStub<WorkspaceTools>;
    forConnection: <TDefinition extends readonly ToolBinder[]>(
      connection: MCPConnection,
    ) => MCPClientFetchStub<TDefinition>;
  },
  {
    get(_, name) {
      if (name === "forWorkspace") {
        return (workspace: string) =>
          createMCPFetchStub<WorkspaceTools>({ workspace });
      }
      if (name === "forConnection") {
        return <TDefinition extends readonly ToolBinder[]>(
          connection: MCPConnection,
        ) => createMCPFetchStub<TDefinition>({ connection });
      }
      return global[name as keyof typeof global];
    },
  },
);

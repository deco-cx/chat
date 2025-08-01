import type {
  GlobalTools,
  MCPClientFetchStub,
  ToolBinder,
  WorkspaceTools,
} from "./mcp/index.ts";
import {
  createMCPFetchStub,
  createMCPFetchStubForIntegration,
} from "./mcp/stub.ts";
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
    forIntegration: (
      workspace: string,
      integrationId: string,
      // deno-lint-ignore no-explicit-any
    ) => (args: unknown, init?: RequestInit) => Promise<Record<any, any>>;
  },
  {
    get(_, name) {
      if (name === "forWorkspace") {
        return (workspace: string) =>
          createMCPFetchStub<WorkspaceTools>({ workspace });
      }
      if (name === "forIntegration") {
        return (workspace: string, integrationId: string) =>
          createMCPFetchStubForIntegration({ workspace, integrationId });
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

export interface ForWorkspaceOptions {
  workspace: string;
  integrationId: string;
}

// deno-lint-ignore no-explicit-any
export const isForWorkspaceOptions = <T extends Record<any, any>>(
  obj: T,
): obj is T & ForWorkspaceOptions =>
  "workspace" in obj && "integrationId" in obj;

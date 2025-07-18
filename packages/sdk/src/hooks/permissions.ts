import { useQuery } from "@tanstack/react-query";
import { DECO_CHAT_API } from "../constants.ts";
import { MCPClient } from "../fetcher.ts";
import { KEYS } from "./api.ts";
import { useSDK } from "./store.tsx";

export interface PermissionDescription {
  scope: string;
  description: string;
}

/**
 * Hook to get permission descriptions dynamically from MCP tools
 * Falls back to static descriptions for non-tool permissions
 */
export function usePermissionDescriptions(scopes: string[] = []): {
  permissions: PermissionDescription[];
  isLoading: boolean;
  error: Error | null;
} {
  const { workspace } = useSDK();

  const {
    data: toolsData,
    isLoading,
    error,
  } = useQuery({
    queryKey: [
      ...KEYS.INTEGRATION_TOOLS(workspace, "workspace-management"),
      "permission-descriptions",
    ],
    queryFn: async () => {
      // Get tools from workspace management integration (which contains most MCP tools)
      const result = await MCPClient.INTEGRATIONS_LIST_TOOLS({
        connection: {
          type: "HTTP",
          url: `${DECO_CHAT_API}/${workspace}/mcp`,
        },
      });
      return result;
    },
    enabled: scopes.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  // Map scopes to permissions with descriptions
  const permissions: PermissionDescription[] = scopes.map((scope) => {
    // First try to find in tools data
    const tool = toolsData?.tools?.find((tool) => tool.name === scope);

    if (tool?.description) {
      return {
        scope,
        description: tool.description,
      };
    }

    // Fall back to static descriptions
    return {
      scope,
      description: scope,
    };
  });

  return {
    permissions,
    isLoading,
    error: error as Error | null,
  };
}

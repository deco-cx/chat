import { useQuery } from "@tanstack/react-query";
import { DECO_CMS_API_URL } from "../constants.ts";
import { MCPClient } from "../fetcher.ts";
import { KEYS } from "./api.ts";
import { useSDK } from "./store.tsx";
import { getRegistryApp } from "../crud/registry.ts";

export interface PermissionDescription {
  scope: string;
  description: string;
}

export interface AppScope {
  name: string;
  app?: string;
}

/**
 * Hook to get permission descriptions dynamically from MCP tools
 * Falls back to static descriptions for non-tool permissions
 *
 * @param scopes - Array of AppScope objects OR string array (for backward compatibility)
 */
export function usePermissionDescriptions(scopes: AppScope[]): {
  permissions: PermissionDescription[];
  isLoading: boolean;
  error: Error | null;
} {
  const { workspace } = useSDK();

  // Separate scopes by whether they have an app or not
  const workspaceScopes = scopes.filter((scope) => !scope.app);
  const registryScopes = scopes.filter((scope) => scope.app);

  // Query for workspace tools
  const {
    data: workspaceToolsData,
    isLoading: isWorkspaceLoading,
    error: workspaceError,
  } = useQuery({
    queryKey: [
      ...KEYS.INTEGRATION_TOOLS(workspace, "workspace-management"),
      "permission-descriptions",
      "workspace",
    ],
    queryFn: async () => {
      // Get tools from workspace management integration (which contains most MCP tools)
      const result = await MCPClient.INTEGRATIONS_LIST_TOOLS({
        connection: {
          type: "HTTP",
          url: `${DECO_CMS_API_URL}/${workspace}/mcp`,
        },
      });
      return result;
    },
    enabled: workspaceScopes.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  // Query for registry apps (fetch all unique apps in a single query)
  const uniqueApps = Array.from(
    new Set(registryScopes.map((scope) => scope.app).filter(Boolean)),
  ) as string[];

  const {
    data: registryAppsData,
    isLoading: isRegistryLoading,
    error: registryError,
  } = useQuery({
    queryKey: ["registry-apps", workspace, uniqueApps],
    queryFn: async () => {
      const results = await Promise.all(
        uniqueApps.map(async (appName) => {
          try {
            const result = await getRegistryApp(workspace, { name: appName });
            return { appName, data: result, error: null };
          } catch (error) {
            return { appName, data: null, error };
          }
        }),
      );
      return results;
    },
    enabled: uniqueApps.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  // Combine loading states and errors
  const isLoading = isWorkspaceLoading || isRegistryLoading;
  const error = workspaceError || registryError;

  // Map scopes to permissions with descriptions
  const permissions: PermissionDescription[] = scopes.map((scope) => {
    if (scope.app) {
      // For registry app scopes, find the app and look for the tool
      const appResult = registryAppsData?.find(
        (result) =>
          result.data &&
          scope.app &&
          scope.app.endsWith(`/${result.data.name}`),
      );

      if (appResult?.data?.tools) {
        const tool = appResult.data.tools.find(
          (tool) => tool.name === scope.name,
        );
        if (tool?.description) {
          return {
            scope: scope.name,
            description: tool.description,
            app: scope.app,
          };
        }
      }
    } else {
      // For workspace scopes, look in workspace tools
      const tool = workspaceToolsData?.tools?.find(
        (tool) => tool.name === scope.name,
      );
      if (tool?.description) {
        return {
          scope: scope.name,
          description: tool.description,
        };
      }
    }

    // Fall back to static descriptions
    return {
      scope: scope.name,
      description: scope.name,
    };
  });

  return {
    permissions,
    isLoading,
    error: error as Error | null,
  };
}

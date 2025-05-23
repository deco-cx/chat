import type { MCPTool } from "@deco/sdk";
import { listTools, useIntegrations } from "@deco/sdk";
import { useQueries } from "@tanstack/react-query";

/**
 * Loads the tools for all installed integrations and returns a map of integrationId to tools data.
 * Triggers background prefetching for all tools.
 */
export function useAllIntegrationTools() {
  const { data: integrations, isLoading, error } = useIntegrations();

  // Prepare queries for all integrations
  const queries = integrations?.map((integration) => ({
    queryKey: [
      "tools",
      integration.connection.type,
      // deno-lint-ignore no-explicit-any
      (integration.connection as any).url ||
      (integration.connection as any).tenant ||
      // deno-lint-ignore no-explicit-any
      (integration.connection as any).name,
    ],
    queryFn: () => listTools(integration.connection),
    enabled: !!integration,
  })) ?? [];

  // Run all queries in parallel
  const results = useQueries({ queries });

  // Map integrationId to tools data
  const toolsMap = integrations?.reduce((acc, integration, idx) => {
    acc[integration.id] = results[idx]?.data?.tools ?? [];
    return acc;
  }, {} as Record<string, MCPTool[]>) ?? {};

  //   console.log("toolsMap", toolsMap);

  return {
    isLoading: isLoading || results.some((r) => r.isLoading),
    error: error || results.find((r) => r.error)?.error,
    toolsMap,
  };
}

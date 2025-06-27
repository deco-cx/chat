import { Binding, WellKnownBindings } from "@deco/sdk/mcp/bindings";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useMemo } from "react";
import {
  createIntegration,
  deleteIntegration,
  listIntegrations,
  loadIntegration,
  saveIntegration,
} from "../crud/mcp.ts";
import { InternalServerError } from "../errors.ts";
import { MCPClient } from "../fetcher.ts";
import type { Agent, Binder, Integration } from "../models/index.ts";
import { applyDisplayNameToIntegration } from "../utils/integration-display-name.ts";
import { KEYS } from "./api.ts";
import { listTools, type MCPTool } from "./index.ts";
import { useSDK } from "./store.tsx";

export const useCreateIntegration = () => {
  const client = useQueryClient();
  const { workspace } = useSDK();

  const create = useMutation({
    mutationFn: (mcp: Partial<Integration>) =>
      createIntegration(workspace, mcp),
    onSuccess: (result) => {
      const agents = client.getQueryData<Agent[]>(KEYS.AGENT(workspace));
      const processedResult = applyDisplayNameToIntegration(result, agents);

      // update item
      const itemKey = KEYS.INTEGRATION(workspace, result.id);
      client.cancelQueries({ queryKey: itemKey });
      client.setQueryData<Integration>(itemKey, processedResult);

      // update list
      const listKey = KEYS.INTEGRATION(workspace);
      client.cancelQueries({ queryKey: listKey });
      client.setQueryData<Integration[]>(
        listKey,
        (old) => !old ? [processedResult] : [processedResult, ...old],
      );
    },
  });

  return create;
};

export const useUpdateIntegration = ({
  onError,
  onSuccess,
}: {
  onError?: (error: Error) => void;
  onSuccess?: (result: Integration) => void;
} = {}) => {
  const client = useQueryClient();
  const { workspace } = useSDK();

  const update = useMutation({
    mutationFn: (mcp: Integration) => saveIntegration(workspace, mcp),
    onSuccess: (result) => {
      const agents = client.getQueryData<Agent[]>(KEYS.AGENT(workspace));
      const processedResult = applyDisplayNameToIntegration(result, agents);

      // Update the individual MCP in cache
      const itemKey = KEYS.INTEGRATION(workspace, result.id);
      client.cancelQueries({ queryKey: itemKey });
      client.setQueryData<Integration>(itemKey, processedResult);

      // Update the list
      const listKey = KEYS.INTEGRATION(workspace);
      client.cancelQueries({ queryKey: listKey });
      client.setQueryData<Integration[]>(
        listKey,
        (old) =>
          !old
            ? [processedResult]
            : old.map((mcp) => mcp.id === result.id ? processedResult : mcp),
      );

      onSuccess?.(result);
    },
    onError,
  });

  return update;
};

export const useRemoveIntegration = () => {
  const client = useQueryClient();
  const { workspace } = useSDK();

  const remove = useMutation({
    mutationFn: (id: string) => deleteIntegration(workspace, id),
    onSuccess: (_, id) => {
      // Remove the individual MCP from cache
      const itemKey = KEYS.INTEGRATION(workspace, id);
      client.cancelQueries({ queryKey: itemKey });
      client.removeQueries({ queryKey: itemKey });

      // Update the list
      const listKey = KEYS.INTEGRATION(workspace);
      client.cancelQueries({ queryKey: listKey });
      client.setQueryData<Integration[]>(
        listKey,
        (old) => !old ? [] : old.filter((mcp) => mcp.id !== id),
      );
    },
  });

  return remove;
};

/** Hook for crud-like operations on MCPs */
export const useIntegration = (id: string) => {
  const { workspace } = useSDK();

  const data = useSuspenseQuery({
    queryKey: KEYS.INTEGRATION(workspace, id),
    queryFn: ({ signal }) => loadIntegration(workspace, id, signal),
    retry: (failureCount, error) =>
      error instanceof InternalServerError && failureCount < 2,
  });

  return data;
};

/** Hook for listing all bindings */
export const useBindings = (binder: Binder) => {
  const { workspace } = useSDK();
  const client = useQueryClient();

  const { data: items, isLoading: isLoadingItems, error: itemsError } =
    useQuery({
      queryKey: KEYS.INTEGRATION(workspace),
      queryFn: ({ signal }) => listIntegrations(workspace, {}, signal),
      staleTime: 2 * 60 * 1000, // 2 minutes
    });

  const queriesConfig = useMemo(() => {
    return (items || []).map((item) => ({
      queryKey: KEYS.INTEGRATION_TOOLS(workspace, item.id, binder),
      queryFn: async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, 7_000); // 7 second timeout

        try {
          const tools = await listTools(item.connection, {
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          const agents = client.getQueryData<Agent[]>(KEYS.AGENT(workspace));
          const itemKey = KEYS.INTEGRATION(workspace, item.id);
          client.setQueryData<Integration>(
            itemKey,
            applyDisplayNameToIntegration(item, agents),
          );

          return {
            integration: item,
            tools: tools.tools,
            success: true,
          };
        } catch (error) {
          clearTimeout(timeoutId);
          if (error instanceof Error && error.name === "AbortError") {
            console.warn(
              `Timeout fetching tools for integration: ${item.id}`,
            );
            return {
              integration: item,
              tools: [] as MCPTool[],
              success: false,
            };
          }

          console.error(
            "Error fetching tools for integration:",
            item.id,
            error,
          );
          throw error;
        }
      },
      enabled: !!items && items.length > 0,
      staleTime: 5 * 60 * 1000, // 5 minutes - tools don't change often
      retry: (failureCount: number) => failureCount < 2,
      // Use a shorter timeout to prevent hanging queries
      gcTime: 10 * 60 * 1000, // 10 minutes
    }));
  }, [items, workspace, binder, client]);

  const integrationQueries = useQueries({
    queries: queriesConfig,
  });

  // Derive filtered results from individual queries
  const filteredIntegrations = useMemo(() => {
    if (!items || integrationQueries.length === 0) return [];

    return integrationQueries
      .filter((query) => query.isSuccess && query.data)
      .map((query) => query.data!)
      .filter(({ tools }) =>
        Binding(WellKnownBindings[binder]).isImplementedBy(tools)
      )
      .map(({ integration }) => integration);
  }, [
    integrationQueries.length,
    integrationQueries.map((q) => q.isSuccess),
    integrationQueries.map((q) => !!q.data),
    items,
    binder,
  ]);

  // Aggregate loading and error states
  const isLoading = isLoadingItems ||
    integrationQueries.some((q) => q.isLoading);
  const hasErrors = !!itemsError || integrationQueries.some((q) => q.error);
  const errors = [
    itemsError,
    ...integrationQueries.map((q) => q.error).filter(Boolean),
  ].filter(Boolean);

  return {
    data: filteredIntegrations,
    isLoading,
    isPending: isLoading,
    error: hasErrors ? errors[0] : null,
    isSuccess: !isLoading && !hasErrors,
    totalIntegrations: items?.length || 0,
    processedIntegrations:
      integrationQueries.filter((q) => q.isSuccess || q.isError).length,
  };
};

/** Hook for listing all MCPs */
export const useIntegrations = () => {
  const { workspace } = useSDK();
  const client = useQueryClient();

  const data = useSuspenseQuery({
    queryKey: KEYS.INTEGRATION(workspace),
    queryFn: async ({ signal }) => {
      const items = await listIntegrations(workspace, {}, signal);

      const agents = client.getQueryData<Agent[]>(KEYS.AGENT(workspace));
      const processedItems = items.map((item) =>
        applyDisplayNameToIntegration(item, agents)
      );

      for (const item of processedItems) {
        const itemKey = KEYS.INTEGRATION(workspace, item.id);

        client.cancelQueries({ queryKey: itemKey });
        client.setQueryData<Integration>(itemKey, item);
      }

      return processedItems;
    },
  });

  return data;
};

interface IntegrationsResult {
  integrations: Array<Omit<Integration, "connection"> & { provider: string }>;
}

export const useMarketplaceIntegrations = () => {
  const { workspace } = useSDK();

  return useSuspenseQuery<IntegrationsResult>({
    queryKey: ["integrations", "marketplace"],
    queryFn: () =>
      MCPClient.forWorkspace(workspace).DECO_INTEGRATIONS_SEARCH({ query: "" })
        .then((r: IntegrationsResult | string) =>
          typeof r === "string" ? { integrations: [] } : r
        ),
  });
};

const WELL_KNOWN_DECO_OAUTH_INTEGRATIONS = [
  "github",
  "googlesheets",
  "googlegmail",
  "googleyoutube",
  "googledocs",
  "googledrive",
  "airtable",
  "slack",
];

export const useInstallFromMarketplace = () => {
  const { workspace } = useSDK();
  const client = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (
      { appName, provider, returnUrl }: {
        appName: string;
        returnUrl: string;
        provider: string;
      },
    ) => {
      const result: { installationId: string } = await MCPClient
        .forWorkspace(workspace)
        .DECO_INTEGRATION_INSTALL({ id: appName });

      const integration = await loadIntegration(
        workspace,
        result.installationId,
      );

      let redirectUrl: string | null = null;

      if (
        WELL_KNOWN_DECO_OAUTH_INTEGRATIONS.includes(appName.toLowerCase()) &&
        provider === "deco"
      ) {
        const result = await MCPClient
          .forWorkspace(workspace)
          .DECO_INTEGRATION_OAUTH_START({
            appName: appName,
            returnUrl,
            installId: integration.id.split(":").pop()!,
          });

        redirectUrl = result?.redirectUrl;
        if (!redirectUrl) {
          throw new Error("No redirect URL found");
        }
      }

      if (provider === "composio") {
        if (!("url" in integration.connection)) {
          throw new Error("Composio integration has no url");
        }

        const result = await MCPClient
          .forWorkspace(workspace)
          .COMPOSIO_INTEGRATION_OAUTH_START({
            url: integration.connection.url,
          });

        redirectUrl = result?.redirectUrl;
        if (!redirectUrl) {
          const errorInfo = {
            appName,
            returnUrl,
            installId: integration.id.split(":").pop()!,
            url: integration.connection.url,
            result,
          };
          console.error("[Composio] No redirect URL found", errorInfo);
        }
      }

      return { integration, redirectUrl };
    },
    onSuccess: ({ integration }) => {
      if (!integration) {
        return;
      }

      const agents = client.getQueryData<Agent[]>(KEYS.AGENT(workspace));
      const processedIntegration = applyDisplayNameToIntegration(
        integration,
        agents,
      );

      // update item
      const itemKey = KEYS.INTEGRATION(workspace, integration.id);
      client.cancelQueries({ queryKey: itemKey });
      client.setQueryData<Integration>(itemKey, processedIntegration);

      // update list
      const listKey = KEYS.INTEGRATION(workspace);
      client.cancelQueries({ queryKey: listKey });
      client.setQueryData<Integration[]>(
        listKey,
        (old) => !old ? [processedIntegration] : [processedIntegration, ...old],
      );
    },
  });

  return mutation;
};

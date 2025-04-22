import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  createIntegration,
  deleteIntegration,
  IntegrationNotFoundError,
  listIntegrations,
  loadIntegration,
  saveIntegration,
} from "../crud/mcp.ts";
import type { Integration } from "../models/mcp.ts";
import { useAgentStub } from "./agent.ts";
import { useSDK } from "./store.tsx";

const getKeyFor = (
  context: string,
  mcpId?: string,
) => ["mcp", context, mcpId];

export const useCreateIntegration = () => {
  const client = useQueryClient();
  const { context: root } = useSDK();

  const create = useMutation({
    mutationFn: (mcp: Partial<Integration>) => createIntegration(root, mcp),
    onSuccess: (result) => {
      const key = getKeyFor(root, result.id);

      // update item
      client.setQueryData(key, result);

      // update list
      client.setQueryData(
        getKeyFor(root),
        (old: Integration[] | undefined) => {
          if (!old) return [result];
          return [result, ...old];
        },
      );

      // invalidate list
      client.invalidateQueries({ queryKey: getKeyFor(root) });
    },
  });

  return create;
};

export const useUpdateIntegration = () => {
  const client = useQueryClient();
  const { context: root } = useSDK();

  const update = useMutation({
    mutationFn: (mcp: Integration) => saveIntegration(root, mcp),
    onMutate: async (updatedMCP) => {
      // Cancel any outgoing refetches
      await client.cancelQueries({ queryKey: getKeyFor(root) });

      // Snapshot the previous value
      const previousMCPs = client.getQueryData(getKeyFor(root)) as
        | Integration[]
        | undefined;

      // Optimistically update the cache
      client.setQueryData(getKeyFor(root), (old: Integration[] | undefined) => {
        if (!old) return [updatedMCP];
        return old.map((mcp) => mcp.id === updatedMCP.id ? updatedMCP : mcp);
      });

      // Update the individual MCP in cache
      client.setQueryData(getKeyFor(root, updatedMCP.id), updatedMCP);

      return { previousMCPs } as const;
    },
    onError: (_err, _updatedMCP, context) => {
      // Rollback to the previous value
      if (context?.previousMCPs) {
        client.setQueryData(getKeyFor(root), context.previousMCPs);
      }
    },
    onSettled: () => {
      // Always refetch after error or success to ensure data is in sync
      client.invalidateQueries({ queryKey: getKeyFor(root) });
    },
  });

  return update;
};

export const useRemoveIntegration = () => {
  const client = useQueryClient();
  const { context: root } = useSDK();

  const remove = useMutation({
    mutationFn: (mcpId: string) => deleteIntegration(root, mcpId),
    onMutate: async (mcpId) => {
      // Cancel any outgoing refetches
      await client.cancelQueries({ queryKey: getKeyFor(root) });

      // Snapshot the previous value
      const previousMCPs = client.getQueryData<Integration[]>(getKeyFor(root));

      // Optimistically update the cache
      client.setQueryData(getKeyFor(root), (old: Integration[]) => {
        if (!old) return old;
        return old.filter((mcp: Integration) => mcp.id !== mcpId);
      });

      // Remove the individual MCP from cache
      client.removeQueries({ queryKey: getKeyFor(root, mcpId) });

      return { previousMCPs };
    },
    onError: (_err, _vars, ctx) => {
      // Rollback to the previous value
      if (ctx?.previousMCPs) {
        client.setQueryData(getKeyFor(root), ctx.previousMCPs);
      }
    },
    onSettled: () => {
      // Always refetch after error or success to ensure data is in sync
      client.invalidateQueries({ queryKey: getKeyFor(root) });
    },
  });

  return remove;
};

/** Hook for crud-like operations on MCPs */
export const useIntegration = (mcpId: string) => {
  const { context } = useSDK();

  const data = useSuspenseQuery({
    queryKey: getKeyFor(context, mcpId),
    queryFn: () => loadIntegration(context, mcpId),
    retry: (failureCount, error) =>
      error instanceof IntegrationNotFoundError ? false : failureCount < 2,
  });

  return data;
};

/** Hook that returns a function to fetch a specific integration on demand */
export const useFetchIntegration = () => {
  const { context } = useSDK();
  const queryClient = useQueryClient();

  const fetchIntegration = async (mcpId: string) => {
    try {
      const integration = await loadIntegration(context, mcpId);

      // Update cache
      queryClient.setQueryData(getKeyFor(context, mcpId), integration);

      return integration;
    } catch (error) {
      if (error instanceof IntegrationNotFoundError) {
        throw error;
      }
      throw error;
    }
  };

  return fetchIntegration;
};

/** Hook for listing all MCPs */
export const useIntegrations = () => {
  const { context } = useSDK();

  const data = useQuery({
    queryKey: getKeyFor(context),
    queryFn: () => listIntegrations(context).then((r) => r.items),
  });

  return data;
};

interface IntegrationsResult {
  integrations: Array<Integration & { provider: string }>;
}

export const useMarketplaceIntegrations = () => {
  const agentStub = useAgentStub();

  return useSuspenseQuery<IntegrationsResult>({
    queryKey: ["integrations", "marketplace"],
    queryFn: () =>
      agentStub.callTool("DECO_INTEGRATIONS.DECO_INTEGRATIONS_SEARCH", {
        query: "",
        filters: { installed: false },
        verbose: true,
      }).then((r: { data: IntegrationsResult }) => r.data),
  });
};

export const useInstallFromMarketplace = () => {
  const agentStub = useAgentStub();
  const client = useQueryClient();
  const { context } = useSDK();

  const mutation = useMutation({
    mutationFn: async (mcpId: string) => {
      const result: { data: { installationId: string } } = await agentStub
        .callTool("DECO_INTEGRATIONS.DECO_INTEGRATION_INSTALL", { id: mcpId });

      return result.data;
    },
    onSuccess: () => {
      // Invalidate the integrations list to refresh it
      client.invalidateQueries({ queryKey: getKeyFor(context) });
    },
  });

  return mutation;
};

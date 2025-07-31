/**
 * Agent specific hooks
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useMemo } from "react";
import {
  createAgent,
  deleteAgent,
  listAgents,
  listAvailableAgentsForConnection,
  loadAgent,
  updateAgent,
} from "../crud/agent.ts";
import { InternalServerError } from "../errors.ts";
import type { Agent } from "../models/agent.ts";
import { KEYS } from "./api.ts";
import { useSDK } from "./store.tsx";
import { MCPConnection } from "../models/index.ts";

export const useCreateAgent = () => {
  const client = useQueryClient();
  const { workspace } = useSDK();

  const create = useMutation({
    mutationFn: (agent: Partial<Agent>) => createAgent(workspace, agent),
    onSuccess: (result) => {
      // update item
      const itemKey = KEYS.AGENT(workspace, result.id);
      client.cancelQueries({ queryKey: itemKey });
      client.setQueryData<Agent>(itemKey, result);

      // update list
      const listKey = KEYS.AGENT(workspace);
      client.cancelQueries({ queryKey: listKey });
      client.setQueryData<Agent[]>(
        listKey,
        (old) => !old ? [result] : [result, ...old],
      );
    },
  });

  return create;
};

export const useUpdateAgentCache = () => {
  const client = useQueryClient();
  const { workspace } = useSDK();

  const update = (agent: Agent) => {
    // Update the individual agent in cache
    const itemKey = KEYS.AGENT(workspace, agent.id);
    client.cancelQueries({ queryKey: itemKey });
    client.setQueryData<Agent>(itemKey, agent);

    // Update the list
    const listKey = KEYS.AGENT(workspace);
    client.cancelQueries({ queryKey: listKey });
    client.setQueryData<Agent[]>(
      listKey,
      (old) => !old ? [agent] : old.map((a) => a.id === agent.id ? agent : a),
    );
  };

  return update;
};

export const useUpdateAgent = () => {
  const { workspace } = useSDK();
  const updateAgentCache = useUpdateAgentCache();

  const update = useMutation({
    mutationFn: (agent: Agent) => updateAgent(workspace, agent),
    onSuccess: (result) => updateAgentCache(result),
  });

  return update;
};

export const useRemoveAgent = () => {
  const client = useQueryClient();
  const { workspace } = useSDK();

  const remove = useMutation({
    mutationFn: (id: string) => deleteAgent(workspace, id),
    onSuccess: (_, id) => {
      // Remove the individual agent from cache
      const itemKey = KEYS.AGENT(workspace, id);
      client.cancelQueries({ queryKey: itemKey });
      client.removeQueries({ queryKey: itemKey });

      // Update the list
      const listKey = KEYS.AGENT(workspace);
      client.cancelQueries({ queryKey: listKey });
      client.setQueryData<Agent[]>(
        listKey,
        (old) => !old ? [] : old.filter((agent) => agent.id !== id),
      );

      // Invalidate triggers
      client.invalidateQueries({ queryKey: KEYS.TRIGGERS(workspace) });
      client.invalidateQueries({ queryKey: KEYS.TRIGGERS(workspace, id) });
    },
  });

  return remove;
};

/** Hook for crud-like operations on agents */
export const useAgent = (id: string) => {
  const { workspace } = useSDK();

  const data = useSuspenseQuery({
    queryKey: KEYS.AGENT(workspace, id),
    queryFn: ({ signal }) => loadAgent(workspace, id, signal),
    retry: (failureCount, error) =>
      error instanceof InternalServerError && failureCount < 2,
  });

  return data;
};

/** Hook for listing all agents */
export const useAgents = () => {
  const { workspace } = useSDK();
  const client = useQueryClient();

  const data = useSuspenseQuery({
    queryKey: KEYS.AGENT(workspace),
    queryFn: async ({ signal }) => {
      const items = await listAgents(workspace, signal);

      for (const item of items) {
        const itemKey = KEYS.AGENT(workspace, item.id);
        client.cancelQueries({ queryKey: itemKey });
        client.setQueryData<Agent>(itemKey, item);
      }

      return items;
    },
  });

  return data;
};

export const useAgentRoot = (agentId: string) => {
  const { workspace } = useSDK();

  const root = useMemo(
    () => `/${workspace}/Agents/${agentId}`,
    [workspace, agentId],
  );

  return root;
};

export function useConnectionAgents(
  integration: { id: string; connection: MCPConnection } | null,
) {
  const { workspace } = useSDK();

  const data = useQuery({
    queryKey: KEYS.AGENTS(workspace, integration?.id ?? "null"),
    queryFn: async () => {
      if (!integration) return { agents: [] };
      const result = await listAvailableAgentsForConnection(
        integration.connection,
      ).catch((error) => {
        console.error(error);
        return { agents: [] };
      });

      return result;
    },
  });

  return data;
}

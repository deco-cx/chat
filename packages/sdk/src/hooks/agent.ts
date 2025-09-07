/**
 * Agent specific hooks
 */

import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useMemo } from "react";
import {
  createAgent,
  deleteAgent,
  listAgents,
  loadAgent,
  updateAgent,
} from "../crud/agent.ts";
import { InternalServerError } from "../errors.ts";
import type { Agent } from "../models/agent.ts";
import { KEYS } from "./api.ts";
import { useSDK } from "./store.tsx";

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
      client.setQueryData<Agent[]>(listKey, (old) =>
        !old ? [result] : [result, ...old],
      );
    },
  });

  return create;
};

export const useUpdateAgent = () => {
  const client = useQueryClient();
  const { workspace } = useSDK();

  const update = useMutation({
    mutationFn: (agent: Agent) => updateAgent(workspace, agent),
    onSuccess: (result) => {
      // update item
      const itemKey = KEYS.AGENT(workspace, result.id);
      client.cancelQueries({ queryKey: itemKey });
      client.setQueryData<Agent>(itemKey, result);

      // update list
      const listKey = KEYS.AGENT(workspace);
      client.cancelQueries({ queryKey: listKey });
      client.setQueryData<Agent[]>(listKey, (old) =>
        !old ? [result] : old.map((a) => (a.id === result.id ? result : a)),
      );
    },
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
      client.setQueryData<Agent[]>(listKey, (old) =>
        !old ? [] : old.filter((agent) => agent.id !== id),
      );

      // Invalidate triggers
      client.invalidateQueries({ queryKey: KEYS.TRIGGERS(workspace) });
      client.invalidateQueries({ queryKey: KEYS.TRIGGERS(workspace, id) });
    },
  });

  return remove;
};

/** Hook for fetching agent data from server */
export const useAgentData = (id: string) => {
  const { workspace } = useSDK();

  const data = useSuspenseQuery({
    queryKey: KEYS.AGENT(workspace, id),
    queryFn: ({ signal }) => loadAgent(workspace, id, signal),
    retry: (failureCount, error) =>
      error instanceof InternalServerError && failureCount < 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
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

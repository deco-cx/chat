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
  type AgentWithActivity,
} from "../crud/agent.ts";
import { InternalServerError } from "../errors.ts";
import type { Agent } from "../models/agent.ts";
import { KEYS } from "./api.ts";
import { useSDK } from "./store.tsx";

export const useCreateAgent = () => {
  const client = useQueryClient();
  const { locator } = useSDK();

  const create = useMutation({
    mutationFn: (agent: Partial<Agent>) => createAgent(locator, agent),
    onSuccess: (result) => {
      // update item
      const itemKey = KEYS.AGENT(locator, result.id);
      client.cancelQueries({ queryKey: itemKey });
      client.setQueryData<Agent>(itemKey, result);

      // update list
      const listKey = KEYS.AGENT(locator);
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
  const { locator } = useSDK();

  const update = useMutation({
    mutationFn: (agent: Agent) => updateAgent(locator, agent),
    onSuccess: (result) => {
      // update item
      const itemKey = KEYS.AGENT(locator, result.id);
      client.cancelQueries({ queryKey: itemKey });
      client.setQueryData<Agent>(itemKey, result);

      // update list
      const listKey = KEYS.AGENT(locator);
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
  const { locator } = useSDK();

  const remove = useMutation({
    mutationFn: (id: string) => deleteAgent(locator, id),
    onSuccess: (_, id) => {
      // Remove the individual agent from cache
      const itemKey = KEYS.AGENT(locator, id);
      client.cancelQueries({ queryKey: itemKey });
      client.removeQueries({ queryKey: itemKey });

      // Update the list
      const listKey = KEYS.AGENT(locator);
      client.cancelQueries({ queryKey: listKey });
      client.setQueryData<Agent[]>(listKey, (old) =>
        !old ? [] : old.filter((agent) => agent.id !== id),
      );

      // Invalidate triggers
      client.invalidateQueries({ queryKey: KEYS.TRIGGERS(locator) });
      client.invalidateQueries({ queryKey: KEYS.TRIGGERS(locator, id) });
    },
  });

  return remove;
};

/** Hook for fetching agent data from server */
export const useAgentData = (id: string) => {
  const { locator } = useSDK();

  const data = useSuspenseQuery({
    queryKey: KEYS.AGENT(locator, id),
    queryFn: ({ signal }) => loadAgent(locator, id, signal),
    retry: (failureCount, error) =>
      error instanceof InternalServerError && failureCount < 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  return data;
};

/** Hook for listing all agents */
export const useAgents = () => {
  const { locator } = useSDK();
  const client = useQueryClient();

  const data = useSuspenseQuery({
    queryKey: KEYS.AGENT(locator),
    queryFn: async ({ signal }) => {
      const items = (await listAgents(locator, signal)) as AgentWithActivity[];

      for (const item of items) {
        const itemKey = KEYS.AGENT(locator, item.id);
        client.cancelQueries({ queryKey: itemKey });
        client.setQueryData(itemKey, item as AgentWithActivity);
      }

      return items;
    },
  });

  return data;
};

export const useAgentRoot = (agentId: string) => {
  const { locator } = useSDK();

  const root = useMemo(
    () => `/${locator}/Agents/${agentId}`,
    [locator, agentId],
  );

  return root;
};

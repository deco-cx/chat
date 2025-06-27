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

/**
 * Hook para listagem paginada, ordenada e filtrada de agents
 */
export interface UseAgentsListParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: Record<string, unknown>;
}

export interface UseAgentsListResult {
  agents: Agent[];
  total: number;
  page: number;
  pageSize: number;
}

export function useAgentsList({
  page = 1,
  pageSize = 20,
  sortBy = 'lastUsed',
  sortOrder = 'desc',
  filters = {},
}: UseAgentsListParams = {}): UseAgentsListResult {
  const { workspace } = useSDK();
  const client = useQueryClient();

  // Por enquanto, busca todos e faz paginação/ordenação/filtro no client
  const data = useSuspenseQuery({
    queryKey: [KEYS.AGENT(workspace), page, pageSize, sortBy, sortOrder, filters],
    queryFn: async ({ signal }) => {
      const items = await listAgents(workspace, signal);
      // Filtro por nome
      let filtered = items;
      if (filters.name) {
        filtered = filtered.filter((a) => a.name.toLowerCase().includes(String(filters.name).toLowerCase()));
      }
      // Filtro por tags (quando implementado)
      if (filters.tags && Array.isArray(filters.tags)) {
        filtered = filtered.filter((a) => Array.isArray((a as any).tags) && (a as any).tags.some((tag: string) => filters.tags.includes(tag)));
      }
      // Ordenação
      let sorted = filtered;
      if (sortBy === 'lastUsed') {
        const recentIds = (() => {
          try {
            return JSON.parse(localStorage.getItem('recentAgents') || '[]');
          } catch {
            return [];
          }
        })();
        sorted = [
          ...filtered.filter((a) => recentIds.includes(a.id)).sort((a, b) => recentIds.indexOf(a.id) - recentIds.indexOf(b.id)),
          ...filtered.filter((a) => !recentIds.includes(a.id)),
        ];
      } else if (sortBy === 'name') {
        sorted = [...filtered].sort((a, b) => sortOrder === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));
      }
      // Paginação
      const total = sorted.length;
      const start = (page - 1) * pageSize;
      const end = start + pageSize;
      const paged = sorted.slice(start, end);
      // Atualiza cache individual
      for (const item of paged) {
        const itemKey = KEYS.AGENT(workspace, item.id);
        client.cancelQueries({ queryKey: itemKey });
        client.setQueryData<Agent>(itemKey, item);
      }
      return { agents: paged, total, page, pageSize };
    },
  });

  return data.data;
}

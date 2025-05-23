import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import {
  activateTrigger,
  createTrigger,
  deactivateTrigger,
  deleteTrigger,
  listAllTriggers,
  listTriggers,
  updateTrigger,
} from "../crud/trigger.ts";
import { useSDK } from "./store.tsx";
import { KEYS } from "./api.ts";
import {
  CreateTriggerInput,
  ListTriggersOutputSchema,
} from "../models/trigger.ts";
import { z } from "zod";

export function useListTriggersByAgentId(
  agentId: string,
  options?: Omit<
    UseQueryOptions<
      z.infer<typeof ListTriggersOutputSchema>,
      Error,
      z.infer<typeof ListTriggersOutputSchema>,
      string[]
    >,
    "queryKey" | "queryFn"
  >,
) {
  const { workspace } = useSDK();
  return useQuery({
    queryKey: KEYS.TRIGGERS(workspace, agentId),
    queryFn: () => listTriggers(workspace, agentId),
    staleTime: 0,

    ...options,
  });
}

export function useListTriggers() {
  const { workspace } = useSDK();
  return useQuery({
    queryKey: KEYS.TRIGGERS(workspace),
    queryFn: () => listAllTriggers(workspace),
  });
}

export function useCreateTrigger(agentId: string) {
  const { workspace } = useSDK();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (trigger: CreateTriggerInput) =>
      createTrigger(workspace, agentId, trigger),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: KEYS.TRIGGERS(workspace) });
      client.invalidateQueries({ queryKey: KEYS.TRIGGERS(workspace, agentId) });
    },
  });
}

export function useUpdateTrigger(agentId: string) {
  const { workspace } = useSDK();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      triggerId,
      trigger,
    }: {
      triggerId: string;
      trigger: CreateTriggerInput;
    }) => updateTrigger(workspace, agentId, triggerId, trigger),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: KEYS.TRIGGERS(workspace) });
      client.invalidateQueries({ queryKey: KEYS.TRIGGERS(workspace, agentId) });
    },
  });
}

export function useDeleteTrigger(agentId: string) {
  const { workspace } = useSDK();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (triggerId: string) =>
      deleteTrigger(workspace, agentId, triggerId),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: KEYS.TRIGGERS(workspace) });
      client.invalidateQueries({ queryKey: KEYS.TRIGGERS(workspace, agentId) });
    },
  });
}

export function useActivateTrigger(agentId: string) {
  const { workspace } = useSDK();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (triggerId: string) => activateTrigger(workspace, triggerId),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: KEYS.TRIGGERS(workspace) });
      client.invalidateQueries({ queryKey: KEYS.TRIGGERS(workspace, agentId) });
    },
  });
}

export function useDeactivateTrigger(agentId: string) {
  const { workspace } = useSDK();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (triggerId: string) => deactivateTrigger(workspace, triggerId),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: KEYS.TRIGGERS(workspace) });
      client.invalidateQueries({ queryKey: KEYS.TRIGGERS(workspace, agentId) });
    },
  });
}

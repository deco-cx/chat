import {
  type UseQueryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  activateTrigger,
  createTrigger,
  deactivateTrigger,
  deleteTrigger,
  getTrigger,
  listAllTriggers,
  updateTrigger,
} from "../crud/trigger.ts";
import type {
  CreateTriggerInput,
  ListTriggersOutput,
  TriggerOutput,
} from "../models/trigger.ts";
import { KEYS } from "./api.ts";
import { useSDK } from "./store.tsx";

export function useTrigger(
  triggerId: string | null,
  options?: Omit<
    UseQueryOptions<
      TriggerOutput | null,
      Error,
      TriggerOutput | null,
      string[]
    >,
    "queryKey" | "queryFn"
  >,
) {
  const { workspace } = useSDK();
  return useQuery({
    queryKey: KEYS.TRIGGER(workspace, triggerId ?? "null"),
    queryFn: () => (triggerId ? getTrigger(workspace, triggerId) : null),
    staleTime: 0,
    ...options,
  });
}

export function useListTriggers() {
  const { workspace } = useSDK();
  const client = useQueryClient();

  return useQuery({
    queryKey: KEYS.TRIGGERS(workspace),
    queryFn: async () => {
      const result = await listAllTriggers(workspace);

      // Update individual trigger caches
      for (const trigger of result.triggers) {
        const itemKey = KEYS.TRIGGER(workspace, trigger.id);
        client.cancelQueries({ queryKey: itemKey });
        client.setQueryData<TriggerOutput>(itemKey, trigger);
      }

      return result;
    },
  });
}

export function useUpdateTriggerCache() {
  const client = useQueryClient();
  const { workspace } = useSDK();

  const update = (trigger: TriggerOutput) => {
    // Update the individual trigger in cache
    const itemKey = KEYS.TRIGGER(workspace, trigger.id);
    client.cancelQueries({ queryKey: itemKey });
    client.setQueryData<TriggerOutput>(itemKey, trigger);

    // Update the list
    const listKey = KEYS.TRIGGERS(workspace);
    client.cancelQueries({ queryKey: listKey });
    client.setQueryData<ListTriggersOutput>(listKey, (old) => {
      if (!old) return { triggers: [trigger] };
      return {
        triggers: old.triggers.map((t) => (t.id === trigger.id ? trigger : t)),
      };
    });
  };

  return update;
}

export function useCreateTrigger() {
  const { workspace } = useSDK();
  const client = useQueryClient();

  return useMutation({
    mutationFn: (trigger: CreateTriggerInput) =>
      createTrigger(workspace, trigger),
    onSuccess: (result) => {
      // update item
      const itemKey = KEYS.TRIGGER(workspace, result.id);
      client.cancelQueries({ queryKey: itemKey });
      client.setQueryData<TriggerOutput>(itemKey, result);

      // update list
      const listKey = KEYS.TRIGGERS(workspace);
      client.cancelQueries({ queryKey: listKey });
      client.setQueryData<ListTriggersOutput>(listKey, (old) => {
        if (!old) return { triggers: [result] };
        return { triggers: [result, ...old.triggers] };
      });
    },
  });
}

export function useUpdateTrigger() {
  const { workspace } = useSDK();
  const updateTriggerCache = useUpdateTriggerCache();

  return useMutation({
    mutationFn: ({
      triggerId,
      trigger,
    }: {
      triggerId: string;
      trigger: CreateTriggerInput;
    }) => updateTrigger(workspace, triggerId, trigger),
    onSuccess: (result) => updateTriggerCache(result),
  });
}

export function useDeleteTrigger() {
  const { workspace } = useSDK();
  const client = useQueryClient();

  return useMutation({
    mutationFn: (triggerId: string) => deleteTrigger(workspace, triggerId),
    onSuccess: (_, triggerId) => {
      // Remove the individual trigger from cache
      const itemKey = KEYS.TRIGGER(workspace, triggerId);
      client.cancelQueries({ queryKey: itemKey });
      client.removeQueries({ queryKey: itemKey });

      // Update the list
      const listKey = KEYS.TRIGGERS(workspace);
      client.cancelQueries({ queryKey: listKey });
      client.setQueryData<ListTriggersOutput>(listKey, (old) => {
        if (!old) return { triggers: [] };
        return {
          triggers: old.triggers.filter((trigger) => trigger.id !== triggerId),
        };
      });
    },
  });
}

export function useActivateTrigger() {
  const { workspace } = useSDK();
  const client = useQueryClient();

  return useMutation({
    mutationFn: (triggerId: string) => activateTrigger(workspace, triggerId),
    onSuccess: (result, triggerId) => {
      if (result.success) {
        // Update the trigger's active status in cache
        const itemKey = KEYS.TRIGGER(workspace, triggerId);
        client.cancelQueries({ queryKey: itemKey });
        client.setQueryData<TriggerOutput>(itemKey, (old) =>
          old ? { ...old, active: true } : undefined,
        );

        // Update lists
        const listKey = KEYS.TRIGGERS(workspace);
        client.cancelQueries({ queryKey: listKey });
        client.setQueryData<ListTriggersOutput>(listKey, (old) => {
          if (!old) return old;
          return {
            triggers: old.triggers.map((t) =>
              t.id === triggerId ? { ...t, active: true } : t,
            ),
          };
        });
      }
    },
  });
}

export function useDeactivateTrigger() {
  const { workspace } = useSDK();
  const client = useQueryClient();

  return useMutation({
    mutationFn: (triggerId: string) => deactivateTrigger(workspace, triggerId),
    onSuccess: (result, triggerId) => {
      if (result.success) {
        // Update the trigger's active status in cache
        const itemKey = KEYS.TRIGGER(workspace, triggerId);
        client.cancelQueries({ queryKey: itemKey });
        client.setQueryData<TriggerOutput>(itemKey, (old) =>
          old ? { ...old, active: false } : undefined,
        );

        // Update lists
        const listKey = KEYS.TRIGGERS(workspace);
        client.cancelQueries({ queryKey: listKey });
        client.setQueryData<ListTriggersOutput>(listKey, (old) => {
          if (!old) return old;
          return {
            triggers: old.triggers.map((t) =>
              t.id === triggerId ? { ...t, active: false } : t,
            ),
          };
        });
      }
    },
  });
}

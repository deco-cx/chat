/**
 * Thread specific hooks
 */

import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import type { UIMessage } from "ai";
import { useCallback, useEffect } from "react";
import { WELL_KNOWN_AGENT_IDS } from "../constants.ts";
import {
  getThread,
  getThreadMessages,
  listThreads,
  type ThreadFilterOptions,
  type ThreadList,
  updateThreadMetadata,
  updateThreadTitle,
} from "../crud/thread.ts";
import { KEYS } from "./api.ts";
import { useSDK } from "./store.tsx";

/** Hook for fetching thread details */
export const useThread = (threadId: string) => {
  const { workspace } = useSDK();
  return useSuspenseQuery({
    queryKey: KEYS.THREAD(workspace, threadId),
    queryFn: ({ signal }) => getThread(workspace, threadId, { signal }),
  });
};

/** Hook for fetching messages from a thread */
export const useThreadMessages = (threadId: string) => {
  const { workspace } = useSDK();
  return useSuspenseQuery({
    queryKey: KEYS.THREAD_MESSAGES(workspace, threadId),
    queryFn: ({ signal }) => getThreadMessages(workspace, threadId, { signal }),
    staleTime: 0,
    gcTime: 0,
  });
};

export const useUpdateThreadMessages = () => {
  const { workspace } = useSDK();
  const client = useQueryClient();

  return useCallback(
    (threadId: string, messages: unknown[] = []) => {
      const messagesKey = KEYS.THREAD_MESSAGES(workspace, threadId);

      client.cancelQueries({ queryKey: messagesKey });
      client.setQueryData(messagesKey, messages);
    },
    [client, workspace],
  );
};

/** Hook for fetching all threads for the user */
export const useThreads = (partialOptions: ThreadFilterOptions = {}) => {
  const client = useQueryClient();
  const { workspace } = useSDK();
  const options: ThreadFilterOptions = {
    ...partialOptions,
  };
  const key = KEYS.THREADS(workspace, options);

  const effect = useCallback(
    ({ messages, threadId, agentId }: {
      messages: UIMessage[];
      threadId: string;
      agentId: string;
    }) => {
      client.cancelQueries({ queryKey: key });
      client.setQueryData<Awaited<ReturnType<typeof listThreads>>>(
        key,
        (oldData) => {
          const exists = oldData?.threads.find((thread) =>
            thread.id === threadId
          );

          if (exists) {
            return oldData;
          }

          const newTitle = typeof messages[0]?.content === "string"
            ? messages[0].content.slice(0, 20)
            : "New chat";

          const updated = {
            pagination: {
              hasMore: false,
              nextCursor: null,
              hasPrev: false,
              prevCursor: null,
              ...oldData?.pagination,
            },
            threads: [
              ...(oldData?.threads ?? []),
              {
                id: threadId,
                title: newTitle,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                resourceId: agentId,
                metadata: { agentId },
              },
            ],
          };

          // When uniqueyById, we should remove the agentId from the thread metadata
          if (
            options.uniqueByAgentId && !(agentId in WELL_KNOWN_AGENT_IDS)
          ) {
            updated.threads = updated.threads.filter(
              (thread, index) =>
                thread.metadata?.agentId !== agentId ||
                index === updated.threads.length - 1,
            );
          }

          return updated;
        },
      );
    },
    [client, key, options.uniqueByAgentId],
  );

  useMessagesSentEffect(effect);

  return useSuspenseQuery({
    queryKey: key,
    queryFn: ({ signal }) => listThreads(workspace, options, { signal }),
  });
};

export const useUpdateThreadTitle = (threadId: string) => {
  const { workspace } = useSDK();
  const client = useQueryClient();

  return useMutation({
    mutationFn: async (newTitle: string) => {
      return await updateThreadTitle(workspace, threadId, newTitle);
    },
    onMutate: async (newTitle: string) => {
      // Cancel all threads queries to prevent race conditions
      await client.cancelQueries({
        queryKey: KEYS.THREADS(workspace),
      });

      // Optimistically update all threads queries that contain this thread
      client.setQueriesData(
        { queryKey: KEYS.THREADS(workspace) },
        (oldData: ThreadList | undefined) => {
          if (!oldData?.threads) return oldData;

          return {
            ...oldData,
            threads: oldData.threads.map((thread) =>
              thread.id === threadId ? { ...thread, title: newTitle } : thread
            ),
          };
        },
      );
    },
    // deno-lint-ignore no-explicit-any
    onError: (_: any, __: any, context: any) => {
      // If the mutation fails, restore all previous queries data
      if (context?.previousQueriesData) {
        context.previousQueriesData.forEach(
          ([queryKey, data]: [readonly unknown[], unknown]) => {
            client.setQueryData(queryKey, data);
          },
        );
      }
    },
    onSettled: () => {
      // Always refetch after error or success to ensure data is in sync
      client.invalidateQueries({ queryKey: KEYS.THREAD(workspace, threadId) });
      client.invalidateQueries({
        queryKey: KEYS.THREADS(workspace),
      });
    },
  });
};

export const useDeleteThread = (threadId: string) => {
  const { workspace } = useSDK();
  const client = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      return await updateThreadMetadata(workspace, threadId, {
        deleted: true,
      });
    },
    onSuccess: () => {
      // Invalidate both the thread and all threads list queries
      client.invalidateQueries({ queryKey: KEYS.THREAD(workspace, threadId) });
      client.invalidateQueries({
        queryKey: KEYS.THREADS(workspace),
      });
    },
  });
};

const channel = new EventTarget();

export interface Options {
  messages: UIMessage[];
  threadId: string;
  agentId: string;
}

export const dispatchMessages = (options: Options) => {
  channel.dispatchEvent(new CustomEvent("message", { detail: options }));
};

const useMessagesSentEffect = (cb: (options: Options) => void) => {
  useEffect(() => {
    const handler = (event: Event) => {
      const options = (event as CustomEvent).detail as Options;
      cb(options);
    };

    channel.addEventListener("message", handler);

    return () => {
      channel.removeEventListener("message", handler);
    };
  }, [cb]);
};

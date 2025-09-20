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
import {
  getThread,
  getThreadMessages,
  listThreads,
  type Thread,
  type ThreadFilterOptions,
  type ThreadList,
  updateThreadMetadata,
  updateThreadTitle,
} from "../crud/thread.ts";
import { KEYS } from "./api.ts";
import { useSDK } from "./store.tsx";

/** Hook for fetching thread details */
export const useThread = (threadId: string) => {
  const { locator } = useSDK();
  return useSuspenseQuery({
    queryKey: KEYS.THREAD(locator, threadId),
    queryFn: ({ signal }) => getThread(locator, threadId, { signal }),
  });
};

/** Hook for fetching messages from a thread */
export const useThreadMessages = (threadId: string) => {
  const { locator } = useSDK();
  return useSuspenseQuery({
    queryKey: KEYS.THREAD_MESSAGES(locator, threadId),
    queryFn: ({ signal }) => getThreadMessages(locator, threadId, { signal }),
    staleTime: 0,
    gcTime: 0,
  });
};

export const useUpdateThreadMessages = () => {
  const { locator } = useSDK();
  const client = useQueryClient();

  return useCallback(
    (threadId: string, messages: unknown[] = []) => {
      const messagesKey = KEYS.THREAD_MESSAGES(locator, threadId);

      client.cancelQueries({ queryKey: messagesKey });
      client.setQueryData(messagesKey, messages);
    },
    [client, locator],
  );
};

/** Hook for fetching all threads for the user */
export const useThreads = (partialOptions: ThreadFilterOptions = {}) => {
  const client = useQueryClient();
  const { locator } = useSDK();
  const options: ThreadFilterOptions = {
    ...partialOptions,
  };
  const key = KEYS.THREADS(locator, options);

  const effect = useCallback(
    ({
      messages,
      threadId,
      agentId,
    }: {
      messages: UIMessage[];
      threadId: string;
      agentId: string;
    }) => {
      client.cancelQueries({ queryKey: key });
      client.setQueryData<Awaited<ReturnType<typeof listThreads>>>(
        key,
        (oldData) => {
          const exists = oldData?.threads.find(
            (thread: Thread) => thread.id === threadId,
          );

          if (exists) {
            return oldData;
          }

          const temporaryTitle =
            typeof messages[0]?.content === "string"
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
                title: temporaryTitle,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                resourceId: agentId,
                metadata: { agentId },
              },
            ],
          };

          return updated;
        },
      );
    },
    [client, key],
  );

  useMessagesSentEffect(effect);

  return useSuspenseQuery({
    queryKey: key,
    queryFn: ({ signal }) =>
      options.enabled
        ? listThreads(locator, options, { signal })
        : { threads: [], pagination: { hasMore: false, nextCursor: null } },
  });
};

// removed useLatestAgentAccess (moved to AGENTS_LIST enrichment)

export interface UpdateThreadTitleParams {
  threadId: string;
  title: string;
  stream?: boolean;
}

export const useUpdateThreadTitle = () => {
  const { locator } = useSDK();
  const client = useQueryClient();

  return useMutation({
    mutationFn: async ({ threadId, title }: UpdateThreadTitleParams) => {
      return await updateThreadTitle(locator, threadId, title);
    },
    onMutate: async ({ threadId, title, stream }: UpdateThreadTitleParams) => {
      // Cancel all threads queries to prevent race conditions
      await client.cancelQueries({
        queryKey: KEYS.THREADS(locator),
      });

      if (stream) {
        // Animate title character by character
        let currentIndex = 0;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        const animateTitle = () => {
          if (currentIndex <= title.length) {
            const partialTitle = title.slice(0, currentIndex);

            client.setQueriesData(
              { queryKey: KEYS.THREADS(locator) },
              (oldData: ThreadList | undefined) => {
                if (!oldData?.threads) return oldData;

                return {
                  ...oldData,
                  threads: oldData.threads.map((thread) =>
                    thread.id === threadId
                      ? { ...thread, title: partialTitle }
                      : thread,
                  ),
                };
              },
            );

            currentIndex++;
            if (currentIndex <= title.length) {
              timeoutId = setTimeout(animateTitle, 20);
            }
          }
        };

        // Start animation
        animateTitle();

        // Return cleanup function
        return () => {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
        };
      } else {
        // Optimistically update all threads queries that contain this thread
        client.setQueriesData(
          { queryKey: KEYS.THREADS(locator) },
          (oldData: ThreadList | undefined) => {
            if (!oldData?.threads) return oldData;

            return {
              ...oldData,
              threads: oldData.threads.map((thread) =>
                thread.id === threadId ? { ...thread, title } : thread,
              ),
            };
          },
        );
      }
    },
    // deno-lint-ignore no-explicit-any
    onError: (_: any, __: UpdateThreadTitleParams, context: any) => {
      // If the mutation fails, restore all previous queries data
      if (context?.previousQueriesData) {
        context.previousQueriesData.forEach(
          ([queryKey, data]: [readonly unknown[], unknown]) => {
            client.setQueryData(queryKey, data);
          },
        );
      }
    },
    onSettled: (_, __, { threadId }: UpdateThreadTitleParams) => {
      // Always refetch after error or success to ensure data is in sync
      client.invalidateQueries({ queryKey: KEYS.THREAD(locator, threadId) });
      client.invalidateQueries({
        queryKey: KEYS.THREADS(locator),
      });
    },
  });
};

export const useDeleteThread = (threadId: string) => {
  const { locator } = useSDK();
  const client = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      return await updateThreadMetadata(locator, threadId, {
        deleted: true,
      });
    },
    onSuccess: () => {
      // Invalidate both the thread and all threads list queries
      client.invalidateQueries({ queryKey: KEYS.THREAD(locator, threadId) });
      client.invalidateQueries({
        queryKey: KEYS.THREADS(locator),
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

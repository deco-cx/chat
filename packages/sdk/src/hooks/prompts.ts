import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  createPrompt,
  type CreatePromptInput,
  deletePrompt,
  getPrompt,
  getPromptVersions,
  listPrompts,
  searchPrompts,
  updatePrompt,
  type UpdatePromptInput,
} from "../crud/prompts.ts";
import { InternalServerError } from "../errors.ts";
import { KEYS } from "./api.ts";
import { useSDK } from "./store.tsx";

export const usePrompts = (input?: {
  ids?: string[];
  resolveMentions?: boolean;
  excludeIds?: string[];
}) => {
  const { workspace } = useSDK();
  return useSuspenseQuery({
    queryKey: KEYS.PROMPTS(
      workspace,
      input?.ids,
      input?.resolveMentions,
      input?.excludeIds,
    ),
    queryFn: ({ signal }) => listPrompts(workspace, input, { signal }),
    retry: (failureCount, error) =>
      error instanceof InternalServerError && failureCount < 2,
  });
};

export const usePrompt = (id: string = "") => {
  const { workspace } = useSDK();
  return useSuspenseQuery({
    queryKey: KEYS.PROMPT(workspace, id),
    retry: (failureCount, error) =>
      error instanceof InternalServerError && failureCount < 2,
    queryFn: ({ signal }) => {
      if (!id.length) {
        return null;
      }
      return getPrompt(workspace, id, { signal });
    },
  });
};

export function useCreatePrompt() {
  const { workspace } = useSDK();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePromptInput) => createPrompt(workspace, input),
    onSuccess: (result) => {
      client.invalidateQueries({
        queryKey: KEYS.PROMPTS(workspace).slice(0, 2),
      });
      client.setQueryData(["prompt", result.id], result);
    },
  });
}

export function useUpdatePrompt() {
  const { workspace } = useSDK();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdatePromptInput) => updatePrompt(workspace, input),
    onSuccess: (result) => {
      client.invalidateQueries({
        queryKey: KEYS.PROMPTS(workspace).slice(0, 2),
      });
      client.invalidateQueries({
        queryKey: KEYS.PROMPT_VERSIONS(workspace, result.id),
      });
      client.setQueryData(["prompt", result.id], result);
    },
  });
}

export function useDeletePrompt() {
  const { workspace } = useSDK();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePrompt(workspace, id),
    onSuccess: () => {
      client.invalidateQueries({
        queryKey: KEYS.PROMPTS(workspace).slice(0, 2),
      });
    },
  });
}

export function useSearchPrompts(
  query: string,
  limit: number = 10,
  offset: number = 0,
) {
  const { workspace } = useSDK();
  return useSuspenseQuery({
    queryKey: KEYS.PROMPTS_SEARCH(workspace, query, limit, offset),
    queryFn: ({ signal }) =>
      searchPrompts(workspace, { query, limit, offset }, { signal }),
    retry: (failureCount, error) =>
      error instanceof InternalServerError && failureCount < 2,
  });
}

export function usePromptVersions(
  id: string,
  limit: number = 10,
  offset: number = 0,
) {
  const { workspace } = useSDK();
  return useSuspenseQuery({
    queryKey: KEYS.PROMPT_VERSIONS(workspace, id),
    queryFn: ({ signal }) =>
      getPromptVersions(workspace, { id, limit, offset }, { signal }),
  });
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteFile, listFiles, readFile, writeFile } from "../crud/fs.tsx";
import { useSDK } from "../index.ts";
import { KEYS } from "./api.ts";

export const useFile = (path: string) => {
  const { workspace } = useSDK();

  return useQuery({
    queryKey: KEYS.FILE(workspace, path),
    queryFn: () => readFile({ workspace, path }),
  });
};

export const useReadFile = () => {
  const queryClient = useQueryClient();
  const { workspace } = useSDK();

  return (path: string, { expiresIn }: { expiresIn?: number } = {}) =>
    queryClient.fetchQuery({
      queryKey: KEYS.FILE(workspace, path),
      queryFn: () => readFile({ workspace, path, expiresIn }),
    });
};

export const useFiles = (
  { root }: { root: string },
) => {
  const { workspace } = useSDK();

  return useQuery({
    queryKey: KEYS.FILE(workspace, root),
    queryFn: () => listFiles({ workspace, root }),
  });
};

export const useWriteFile = () => {
  const queryClient = useQueryClient();
  const { workspace } = useSDK();

  return useMutation({
    mutationFn: ({ path, content, contentType, metadata }: {
      path: string;
      content: Uint8Array;
      contentType: string;
      metadata?: Record<string, string | string[]>;
    }) => writeFile({ path, workspace, content, contentType, metadata }),
    onMutate: async ({ path, content, contentType, metadata }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: KEYS.FILE(workspace, path) });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData(KEYS.FILE(workspace, path));

      // Optimistically update to the new value
      queryClient.setQueryData(KEYS.FILE(workspace, path), () => ({
        path,
        content,
        contentType,
        exists: true,
        metadata,
      }));

      return { previousData };
    },
    onError: (_err, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousData) {
        queryClient.setQueryData(
          KEYS.FILE(workspace, variables.path),
          context.previousData,
        );
      }
    },
    onSettled: (_, __, variables) => {
      // Always refetch after error or success to ensure data is in sync
      queryClient.invalidateQueries({
        queryKey: KEYS.FILE(workspace, variables.path),
      });
    },
  });
};

interface DeleteFileParams {
  path: string;
  /* prefix root to revalited useFiles */
  root?: string;
}

export const useDeleteFile = () => {
  const { workspace } = useSDK();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (
      { path }: DeleteFileParams,
    ) => deleteFile({ workspace, path }),
    onSuccess: (_, { root }) => {
      if (!root) return;

      const rootKey = KEYS.FILE(workspace, root);

      queryClient.invalidateQueries({ queryKey: rootKey });
    },
  });
};

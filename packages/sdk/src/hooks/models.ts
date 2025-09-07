import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  createModel,
  deleteModel,
  getModel,
  listModels,
  updateModel,
} from "../crud/model.ts";
import { InternalServerError } from "../errors.ts";
import type {
  CreateModelInput,
  DeleteModelInput,
  GetModelInput,
  ListModelsInput,
  UpdateModelInput,
} from "../mcp/models/api.ts";
import { KEYS } from "./api.ts";
import { useSDK } from "./store.tsx";

export type {
  CreateModelInput,
  DeleteModelInput,
  GetModelInput,
  ListModelsInput,
  UpdateModelInput,
};

export const useModels = (options: ListModelsInput = {}) => {
  const { workspace } = useSDK();
  return useSuspenseQuery({
    queryKey: KEYS.MODELS(workspace, options),
    queryFn: ({ signal }) => listModels(workspace, options, { signal }),
    retry: (failureCount, error) =>
      error instanceof InternalServerError && failureCount < 2,
  });
};

export const useModel = (id: string) => {
  const { workspace } = useSDK();
  return useSuspenseQuery({
    queryKey: KEYS.MODEL(workspace, id),
    retry: (failureCount, error) =>
      error instanceof InternalServerError && failureCount < 2,
    queryFn: ({ signal }) => getModel(workspace, id, { signal }),
  });
};

export function useCreateModel() {
  const { workspace } = useSDK();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateModelInput) => createModel(workspace, input),
    onSuccess: (result) => {
      client.invalidateQueries({
        queryKey: KEYS.MODELS(workspace).slice(0, 2),
      });
      client.setQueryData(KEYS.MODELS(workspace), result);
      client.setQueryData(KEYS.MODEL(workspace, result.id), result);
    },
  });
}

export function useUpdateModel() {
  const { workspace } = useSDK();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateModelInput) => updateModel(workspace, input),
    onSuccess: (result) => {
      client.invalidateQueries({
        queryKey: KEYS.MODELS(workspace).slice(0, 2),
      });
      client.setQueryData(KEYS.MODEL(workspace, result.id), result);
    },
  });
}

export function useDeleteModel() {
  const { workspace } = useSDK();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteModel(workspace, id),
    onSuccess: () => {
      client.invalidateQueries({
        queryKey: KEYS.MODELS(workspace).slice(0, 2),
      });
    },
  });
}

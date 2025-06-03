import { Model } from "../constants.ts";
import { MCPClient } from "../fetcher.ts";
import { CreateModelInput } from "../mcp/models/api.ts";

export interface ListModelsInput {
  excludeDisabled?: boolean;
  excludeAuto?: boolean;
}

export const listModels = (
  workspace: string,
  options: ListModelsInput = {},
  init?: RequestInit,
) => MCPClient.forWorkspace(workspace).MODELS_LIST(options, init);

export const getModel = (
  workspace: string,
  id: string,
  init?: RequestInit,
) => MCPClient.forWorkspace(workspace).MODELS_GET({ id }, init);

export const createModel = (
  workspace: string,
  input: CreateModelInput,
  init?: RequestInit,
) => MCPClient.forWorkspace(workspace).MODELS_CREATE(input, init);

export interface UpdateModelInput {
  id: string;
  data: Partial<
    Pick<Model, "name" | "model" | "description" | "isEnabled"> & {
      apiKey?: string | null;
    }
  >;
  [key: string]: unknown;
}

export const updateModel = (
  workspace: string,
  input: UpdateModelInput,
  init?: RequestInit,
) => MCPClient.forWorkspace(workspace).MODELS_UPDATE(input, init);

export const deleteModel = (
  workspace: string,
  id: string,
  init?: RequestInit,
): Promise<{ ok: boolean }> =>
  MCPClient.forWorkspace(workspace).MODELS_DELETE({ id }, init) as Promise<
    { ok: boolean }
  >;

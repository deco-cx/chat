import { MCPClient } from "../fetcher.ts";
import type { Prompt, PromptVersion } from "../models/index.ts";
import { ProjectLocator } from "../locator.ts";

export const listPrompts = (
  locator: ProjectLocator,
  input?: {
    ids?: string[];
    resolveMentions?: boolean;
    excludeIds?: string[];
  },
  init?: RequestInit,
  client?: ReturnType<(typeof MCPClient)["forLocator"]>,
): Promise<Prompt[]> =>
  (client ?? MCPClient.forLocator(locator))
    .PROMPTS_LIST(input || {}, init)
    .then((res) => res.items) as Promise<Prompt[]>;

export const getPrompt = (
  locator: ProjectLocator,
  id: string,
  init?: RequestInit,
): Promise<Prompt> =>
  MCPClient.forLocator(locator).PROMPTS_GET({ id }, init) as Promise<Prompt>;

export interface CreatePromptInput {
  name: string;
  description?: string;
  content: string;
  [key: string]: unknown;
}

export const createPrompt = (
  locator: ProjectLocator,
  input: CreatePromptInput,
  init?: RequestInit,
): Promise<Prompt> =>
  MCPClient.forLocator(locator).PROMPTS_CREATE(input, init) as Promise<Prompt>;

export interface UpdatePromptInput {
  id: string;
  data: Partial<Pick<Prompt, "name" | "description" | "content">>;
  versionName?: string;
  [key: string]: unknown;
}

export const updatePrompt = (
  locator: ProjectLocator,
  input: UpdatePromptInput,
  init?: RequestInit,
): Promise<Prompt> =>
  MCPClient.forLocator(locator).PROMPTS_UPDATE(input, init) as Promise<Prompt>;

export const deletePrompt = (
  locator: ProjectLocator,
  id: string,
  init?: RequestInit,
): Promise<{ success: boolean }> =>
  MCPClient.forLocator(locator).PROMPTS_DELETE({ id }, init) as Promise<{
    success: boolean;
  }>;

interface SearchPromptsInput {
  query: string;
  limit?: number;
  offset?: number;
}

export const searchPrompts = (
  locator: ProjectLocator,
  input: SearchPromptsInput,
  init?: RequestInit,
): Promise<Prompt[]> =>
  MCPClient.forLocator(locator).PROMPTS_SEARCH(input, init) as Promise<
    Prompt[]
  >;

interface GetPromptVersionsInput {
  id: string;
  limit?: number;
  offset?: number;
}

export const getPromptVersions = (
  locator: ProjectLocator,
  input: GetPromptVersionsInput,
  init?: RequestInit,
): Promise<PromptVersion[]> =>
  MCPClient.forLocator(locator).PROMPTS_GET_VERSIONS(input, init) as Promise<
    PromptVersion[]
  >;

interface RenamePromptVersionInput {
  id: string;
  versionName: string;
}

export const renamePromptVersion = (
  locator: ProjectLocator,
  input: RenamePromptVersionInput,
  init?: RequestInit,
): Promise<PromptVersion> =>
  MCPClient.forLocator(locator).PROMPTS_RENAME_VERSION(
    input,
    init,
  ) as Promise<PromptVersion>;

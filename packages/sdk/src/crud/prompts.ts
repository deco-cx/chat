import { MCPClient } from "../fetcher.ts";
import type { Prompt } from "../models/index.ts";

export const listPrompts = (
  workspace: string,
  input?: {
    ids?: string[];
    resolveMentions?: boolean;
    excludeIds?: string[];
  },
  init?: RequestInit,
): Promise<Prompt[]> =>
  MCPClient.forWorkspace(workspace).PROMPTS_LIST(input || {}, init) as Promise<
    Prompt[]
  >;

export const getPrompt = (
  workspace: string,
  id: string,
  init?: RequestInit,
): Promise<Prompt> =>
  MCPClient.forWorkspace(workspace).PROMPTS_GET({ id }, init) as Promise<
    Prompt
  >;

export interface CreatePromptInput {
  name: string;
  description?: string;
  content: string;
  [key: string]: unknown;
}

export const createPrompt = (
  workspace: string,
  input: CreatePromptInput,
  init?: RequestInit,
): Promise<Prompt> =>
  MCPClient.forWorkspace(workspace).PROMPTS_CREATE(input, init) as Promise<
    Prompt
  >;

export interface UpdatePromptInput {
  id: string;
  data: Partial<
    Pick<Prompt, "name" | "description" | "content">
  >;
  [key: string]: unknown;
}

export const updatePrompt = (
  workspace: string,
  input: UpdatePromptInput,
  init?: RequestInit,
): Promise<Prompt> =>
  MCPClient.forWorkspace(workspace).PROMPTS_UPDATE(input, init) as Promise<
    Prompt
  >;

export const deletePrompt = (
  workspace: string,
  id: string,
  init?: RequestInit,
): Promise<{ success: boolean }> =>
  MCPClient.forWorkspace(workspace).PROMPTS_DELETE({ id }, init) as Promise<
    { success: boolean }
  >;

interface SearchPromptsInput {
  query: string;
  limit?: number;
  offset?: number;
}

export const searchPrompts = (
  workspace: string,
  input: SearchPromptsInput,
  init?: RequestInit,
): Promise<Prompt[]> =>
  MCPClient.forWorkspace(workspace).PROMPTS_SEARCH(input, init) as Promise<
    Prompt[]
  >;

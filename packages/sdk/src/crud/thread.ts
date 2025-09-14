import type { UIMessage } from "ai";
import { MCPClient } from "../fetcher.ts";
import { ProjectLocator } from "../locator.ts";

export interface ThreadFilterOptions {
  agentId?: string;
  resourceId?: string;
  orderBy?:
    | "createdAt_desc"
    | "createdAt_asc"
    | "updatedAt_desc"
    | "updatedAt_asc";
  cursor?: string;
  limit?: number;
  enabled?: boolean;
}

export interface ThreadList {
  threads: Thread[];
  pagination: Pagination;
}

export interface Pagination {
  hasMore: boolean;
  nextCursor: string;
}

export interface Thread {
  id: string;
  resourceId: string;
  title: string;
  metadata?: Metadata;
  createdAt: string;
  updatedAt: string;
}

export interface Metadata {
  agentId: string;
}

export const listThreads = (
  locator: ProjectLocator,
  options: ThreadFilterOptions,
  init?: RequestInit,
) => MCPClient.forLocator(locator).THREADS_LIST(options, init);

export interface ThreadDetails {
  id: string;
  title: string;
  resourceId: string;
  createdAt: string;
  updatedAt: string;
  metadata?: { agentId?: string; tools_set?: Record<string, string[]> };
}

export const getThread = (
  locator: ProjectLocator,
  threadId: string,
  init: RequestInit = {},
): Promise<ThreadDetails> =>
  MCPClient.forLocator(locator).THREADS_GET({ id: threadId }, init);

export interface ThreadMessage {
  id: string;
  thread_id: string;
  content: string;
  role: "data" | "system" | "user" | "assistant";
  type: string;
  createdAt: Date;
}

export const getThreadMessages = (
  locator: ProjectLocator,
  threadId: string,
  init: RequestInit = {},
): Promise<{ messages: UIMessage[] }> =>
  MCPClient.forLocator(locator).THREADS_GET_MESSAGES({ id: threadId }, init);

export interface ThreadTools {
  tools_set: Record<string, string[]>;
}

export const getThreadTools = (
  locator: ProjectLocator,
  threadId: string,
  init: RequestInit = {},
): Promise<ThreadTools> =>
  MCPClient.forLocator(locator).THREADS_GET_TOOLS({ id: threadId }, init);

export const updateThreadTitle = (
  locator: ProjectLocator,
  threadId: string,
  title: string,
  init: RequestInit = {},
): Promise<ThreadDetails> =>
  MCPClient.forLocator(locator).THREADS_UPDATE_TITLE(
    { threadId, title },
    init,
  ) as Promise<ThreadDetails>;

export const updateThreadMetadata = (
  locator: ProjectLocator,
  threadId: string,
  metadata: Record<string, unknown>,
  init: RequestInit = {},
): Promise<ThreadDetails> =>
  MCPClient.forLocator(locator).THREADS_UPDATE_METADATA(
    { threadId, metadata },
    init,
  ) as Promise<ThreadDetails>;


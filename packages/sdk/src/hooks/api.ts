import type { ListModelsInput } from "../crud/model.ts";
import type { ThreadFilterOptions } from "../crud/thread.ts";
import type { ProjectLocator } from "../index.ts";
import type { Binder } from "../models/mcp.ts";

export const KEYS = {
  FILE: (locator: ProjectLocator, path: string) => ["file", locator, path],
  AGENT: (locator: ProjectLocator, agentId?: string) => [
    "agent",
    locator,
    agentId,
  ],
  INTEGRATION: (locator: ProjectLocator, integrationId?: string) => [
    "integration",
    locator,
    integrationId,
  ],
  INTEGRATION_TOOLS: (
    locator: ProjectLocator,
    integrationId: string,
    binder?: Binder,
  ) => [
    "integration-tools",
    locator,
    integrationId,
    ...(binder ? [binder] : []),
  ],
  CHANNELS: (locator: ProjectLocator, channelId?: string) => [
    "channels",
    locator,
    channelId,
  ],
  BINDINGS: (locator: ProjectLocator, binder: Binder) => [
    "bindings",
    locator,
    binder,
  ],
  THREADS: (locator: ProjectLocator, options?: ThreadFilterOptions) => {
    if (!options) {
      return ["threads", locator];
    }
    return [
      "threads",
      locator,
      options.agentId,
      options.resourceId,
      options.orderBy,
      options.cursor,
      options.limit,
    ];
  },
  TOOLS: (locator: ProjectLocator, agentId: string, threadId: string) => [
    "tools",
    locator,
    agentId,
    threadId,
  ],
  AUDITS: (locator: ProjectLocator, options: ThreadFilterOptions) => [
    "audit",
    locator,
    options.agentId,
    options.orderBy,
    options.cursor,
    options.limit,
    options.resourceId,
  ],
  TEAMS: () => ["teams"],
  PROJECTS: (org: string) => ["projects", org],
  ORGANIZATION: (slug: string) => ["team", slug],
  TEAM_THEME: (slug: string) => ["team-theme", slug],
  TEAM_VIEWS: (locator: ProjectLocator, integrationId: string) => [
    "team-views",
    locator,
    integrationId,
  ],
  WORKSPACE_VIEWS: (locator: ProjectLocator) => ["workspace-views", locator],
  TEAM_MEMBERS: (slugOrId: string | number) => ["taem", slugOrId, "members"],
  TEAM_ROLES: (teamId: number) => ["team", teamId, "roles"],
  MY_INVITES: () => ["my_invites"],
  MODELS: (locator: ProjectLocator, options?: ListModelsInput) => [
    "models",
    locator,
    options?.excludeDisabled || false,
    options?.excludeAuto || false,
  ],
  MODEL: (locator: ProjectLocator, id: string) => ["model", locator, id],
  TRIGGERS: (locator: ProjectLocator, agentId = "") => [
    "triggers",
    locator,
    agentId,
  ],
  TRIGGER: (locator: ProjectLocator, triggerId: string) => [
    "trigger",
    locator,
    triggerId,
  ],
  THREAD: (locator: ProjectLocator, threadId: string) => [
    "thread",
    locator,
    threadId,
  ],
  THREAD_MESSAGES: (locator: ProjectLocator, threadId: string) => [
    "thread-messages",
    locator,
    threadId,
  ],
  THREAD_TOOLS: (locator: ProjectLocator, threadId: string) => [
    "thread-tools",
    locator,
    threadId,
  ],
  PROFILE: () => ["profile"],
  PROMPTS: (
    locator: ProjectLocator,
    ids?: string[],
    resolveMentions?: boolean,
    excludeIds?: string[],
  ) => [
    "prompts",
    locator,
    ...(ids ? ids.sort() : []),
    `${resolveMentions ?? false}`,
    ...(excludeIds ? excludeIds.sort() : []),
  ],
  PROMPT: (locator: ProjectLocator, id: string) => ["prompts", locator, id],
  PROMPTS_SEARCH: (
    locator: ProjectLocator,
    query: string,
    limit: number = 10,
    offset: number = 0,
  ) => ["prompts", locator, query, limit, offset],
  PROMPT_VERSIONS: (locator: ProjectLocator, id: string) => [
    "prompt-versions",
    locator,
    id,
  ],
  WALLET: (locator: ProjectLocator) => ["wallet", locator],
  WALLET_USAGE_AGENTS: (
    locator: ProjectLocator,
    range: "day" | "week" | "month",
  ) => ["wallet-usage-agents", locator, range],
  WALLET_USAGE_THREADS: (
    locator: ProjectLocator,
    range: "day" | "week" | "month",
  ) => ["wallet-usage-threads", locator, range],
  WALLET_BILLING_HISTORY: (
    locator: ProjectLocator,
    range: "day" | "week" | "month" | "year",
  ) => ["wallet-billing-history", locator, range],
  WORKSPACE_PLAN: (locator: ProjectLocator) => ["workspace-plan", locator],
  WORKFLOWS: (locator: ProjectLocator, page?: number, per_page?: number) => [
    "workflows",
    locator,
    page,
    per_page,
  ],
  WORKFLOW: (locator: ProjectLocator, workflowName: string) => [
    "workflow",
    locator,
    workflowName,
  ],
  WORKFLOW_INSTANCES: (
    locator: ProjectLocator,
    workflowName: string,
    page?: number,
    per_page?: number,
  ) => ["workflow-instances", locator, workflowName, page, per_page],
  WORKFLOW_STATUS: (
    locator: ProjectLocator,
    workflowName: string,
    instanceId: string,
  ) => ["workflow-status", locator, workflowName, instanceId],
  KNOWLEDGE_FILES: (locator: ProjectLocator, connectionUrl: string) => [
    "knowledge_files",
    locator,
    connectionUrl,
  ],
};

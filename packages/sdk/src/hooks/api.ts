import type { ListModelsInput } from "../crud/model.ts";
import { ThreadFilterOptions } from "../crud/thread.ts";
import type { Workspace } from "../index.ts";
import type { Binder } from "../models/mcp.ts";

export const KEYS = {
  FILE: (
    workspace: string,
    path: string,
  ) => ["file", workspace, path],
  AGENT: (
    workspace: Workspace,
    agentId?: string,
  ) => ["agent", workspace, agentId],
  INTEGRATION: (
    workspace: Workspace,
    integrationId?: string,
  ) => ["integration", workspace, integrationId],
  INTEGRATION_TOOLS: (
    workspace: Workspace,
    integrationId: string,
    binder?: Binder,
  ) => [
    "integration-tools",
    workspace,
    integrationId,
    ...(binder ? [binder] : []),
  ],
  CHANNELS: (
    workspace: Workspace,
    channelId?: string,
  ) => ["channels", workspace, channelId],
  BINDINGS: (
    workspace: Workspace,
    binder: Binder,
  ) => ["bindings", workspace, binder],
  THREADS: (
    workspace: Workspace,
    options?: ThreadFilterOptions,
  ) => {
    if (!options) {
      return ["threads", workspace];
    }
    return [
      "threads",
      workspace,
      options.agentId,
      options.resourceId,
      options.orderBy,
      options.cursor,
      options.limit,
      options.uniqueByAgentId,
    ];
  },
  TOOLS: (
    workspace: Workspace,
    agentId: string,
    threadId: string,
  ) => ["tools", workspace, agentId, threadId],
  AUDITS: (workspace: Workspace, options: ThreadFilterOptions) => [
    "audit",
    workspace,
    options.agentId,
    options.orderBy,
    options.cursor,
    options.limit,
    options.resourceId,
  ],
  TEAMS: () => ["teams"],
  TEAM: (slug: string) => ["team", slug],
  TEAM_THEME: (slug: string) => ["team-theme", slug],
  TEAM_MEMBERS: (
    slugOrId: string | number,
  ) => ["taem", slugOrId, "members"],
  TEAM_ROLES: (
    teamId: number,
  ) => ["team", teamId, "roles"],
  MY_INVITES: () => ["my_invites"],
  MODELS: (
    workspace: Workspace,
    options?: ListModelsInput,
  ) => [
    "models",
    workspace,
    options?.excludeDisabled || false,
    options?.excludeAuto || false,
  ],
  MODEL: (workspace: Workspace, id: string) => ["model", workspace, id],
  TRIGGERS: (workspace: Workspace, agentId = "") => [
    "triggers",
    workspace,
    agentId,
  ],
  THREAD: (
    workspace: Workspace,
    threadId: string,
  ) => ["thread", workspace, threadId],
  THREAD_MESSAGES: (
    workspace: Workspace,
    threadId: string,
  ) => ["thread-messages", workspace, threadId],
  THREAD_TOOLS: (
    workspace: Workspace,
    threadId: string,
  ) => ["thread-tools", workspace, threadId],
  PROFILE: () => ["profile"],
  PROMPTS: (workspace: Workspace) => ["prompts", workspace],
  PROMPT: (workspace: Workspace, id: string) => ["prompts", workspace, id],
  PROMPTS_SEARCH: (
    workspace: Workspace,
    query: string,
    limit: number = 10,
    offset: number = 0,
  ) => [
    "prompts",
    workspace,
    query,
    limit,
    offset,
  ],
  WHATSAPP_USER: (workspace: Workspace, phone: string) => [
    "whatsapp-user",
    workspace,
    phone,
  ],
  WALLET: (
    workspace: Workspace,
  ) => ["wallet", workspace],
  WALLET_USAGE_AGENTS: (
    workspace: Workspace,
    range: "day" | "week" | "month",
  ) => ["wallet-usage-agents", workspace, range],
  WALLET_USAGE_THREADS: (
    workspace: Workspace,
    range: "day" | "week" | "month",
  ) => ["wallet-usage-threads", workspace, range],
  WORKSPACE_PLAN: (workspace: Workspace) => ["workspace-plan", workspace],
};

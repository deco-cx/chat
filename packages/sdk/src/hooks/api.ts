import { Options } from "../crud/thread.ts";
import type { Workspace } from "../index.ts";

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
  THREADS: (
    workspace: Workspace,
    threadId?: string,
  ) => ["threads", workspace, threadId],
  TOOLS: (
    workspace: Workspace,
    agentId: string,
    threadId: string,
  ) => ["tools", workspace, agentId, threadId],
  AUDITS: (workspace: Workspace, options: Options) => [
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
  TEAM_MEMBERS: (
    slugOrId: string | number,
  ) => ["taem", slugOrId, "members"],
  TEAM_ROLES: (
    teamId: number,
  ) => ["team", teamId, "roles"],
  MY_INVITES: () => ["my_invites"],
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
};

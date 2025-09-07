import { MCPClient } from "../fetcher.ts";
import type { CreateTriggerInput } from "../models/trigger.ts";

export const getTrigger = (workspace: string, id: string) =>
  MCPClient.forWorkspace(workspace).TRIGGERS_GET({ id });

export const listAllTriggers = (workspace: string, agentId?: string) =>
  MCPClient.forWorkspace(workspace).TRIGGERS_LIST({ agentId });

export const createTrigger = (workspace: string, trigger: CreateTriggerInput) =>
  MCPClient.forWorkspace(workspace).TRIGGERS_CREATE({ trigger });

export const deleteTrigger = (workspace: string, triggerId: string) =>
  MCPClient.forWorkspace(workspace).TRIGGERS_DELETE({ id: triggerId });

export const activateTrigger = (workspace: string, triggerId: string) =>
  MCPClient.forWorkspace(workspace).TRIGGERS_ACTIVATE({ id: triggerId });

export const deactivateTrigger = (workspace: string, triggerId: string) =>
  MCPClient.forWorkspace(workspace).TRIGGERS_DEACTIVATE({ id: triggerId });

export const updateTrigger = (
  workspace: string,
  triggerId: string,
  trigger: CreateTriggerInput,
) =>
  MCPClient.forWorkspace(workspace).TRIGGERS_UPDATE({
    id: triggerId,
    data: trigger,
  });

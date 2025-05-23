import { MCPClient } from "../fetcher.ts";
import { CreateTriggerInput } from "../models/trigger.ts";

export const listTriggers = (workspace: string, agentId: string) =>
  MCPClient.forWorkspace(workspace).TRIGGERS_LIST(
    { agentId },
  );

export const listAllTriggers = (workspace: string) =>
  MCPClient.forWorkspace(workspace).TRIGGERS_LIST({});

export const createTrigger = (
  workspace: string,
  agentId: string,
  trigger: CreateTriggerInput,
) =>
  MCPClient.forWorkspace(workspace).TRIGGERS_CREATE(
    { agentId, data: trigger },
  );

export const deleteTrigger = (
  workspace: string,
  agentId: string,
  triggerId: string,
) => MCPClient.forWorkspace(workspace).TRIGGERS_DELETE({ agentId, triggerId });

export const activateTrigger = (
  workspace: string,
  triggerId: string,
) => MCPClient.forWorkspace(workspace).TRIGGERS_ACTIVATE({ triggerId });

export const deactivateTrigger = (
  workspace: string,
  triggerId: string,
) => MCPClient.forWorkspace(workspace).TRIGGERS_DEACTIVATE({ triggerId });

export const updateTrigger = (
  workspace: string,
  agentId: string,
  triggerId: string,
  trigger: CreateTriggerInput,
) =>
  MCPClient.forWorkspace(workspace).TRIGGERS_UPDATE(
    { agentId, triggerId, data: trigger },
  );

import type { Workspace } from "@deco/sdk/path";
import type { Agent, Integration } from "../schemas.ts";
import type { TriggerData, TriggerRun } from "../triggers/services.ts";

export interface WorkspaceScopedAgentStorage {
  list(): Promise<Agent[]>;
  get(id: string): Promise<Agent>;
  create(agent: Agent): Promise<Agent>;
  update(id: string, agent: Agent): Promise<Agent>;
  delete(id: string): Promise<void>;
}

export interface AgentStorage {
  for(workspace: Workspace): WorkspaceScopedAgentStorage;
}

export interface WorkspaceScopedIntegrationsStorage {
  list(): Promise<Integration[]>;
  get(id: string): Promise<Integration>;
  create(integration: Integration): Promise<Integration>;
  update(id: string, integration: Integration): Promise<Integration>;
  delete(id: string): Promise<void>;
}

export interface IntegrationsStorage {
  for(workspace: Workspace): WorkspaceScopedIntegrationsStorage;
}

export interface WorkspaceScopedTriggersStorage {
  list(agentId?: string): Promise<TriggerData[]>;
  get(id: string): Promise<TriggerData>;
  create(
    trigger: TriggerData,
    agentId: string,
    userId?: string,
  ): Promise<TriggerData>;
  delete(id: string): Promise<void>;
  run(run: Omit<TriggerRun, "id" | "timestamp">): Promise<TriggerRun>;
  listRuns(id: string): Promise<TriggerRun[]>;
}

export interface TriggersStorage {
  for(workspace: Workspace): WorkspaceScopedTriggersStorage;
}

export interface DecoChatStorage {
  integrations: IntegrationsStorage;
  agents: AgentStorage;
  triggers?: TriggersStorage;
}

export { AgentNotFoundError, IntegrationNotFoundError } from "./error.ts";

export {
  INNATE_INTEGRATIONS,
  NEW_AGENT_TEMPLATE,
  NEW_INTEGRATION_TEMPLATE,
  WELL_KNOWN_AGENTS,
} from "./constants.ts";

export * from "../schemas.ts";

import { MCPClient } from "../fetcher.ts";
import { type Agent, AgentSchema } from "../models/agent.ts";
import { stub } from "../stub.ts";
import { Workspace, Workspaces } from "../workspace.ts";

/**
 * Update an agent
 * @param workspace - The workspace of the agent
 * @param agent - The agent to update
 * @returns The updated agent
 */
export const updateAgent = async (workspace: Workspace, agent: Agent) => {
  const agentRoot = `/${Workspaces.adaptToShared(workspace)}/Agents/${agent.id}`;

  // deno-lint-ignore no-explicit-any
  const agentStub = stub<any>("AIAgent").new(agentRoot);

  await agentStub.configure(agent);

  return agent;
};

/**
 * Create a new agent
 * @returns The new agent
 */
export const createAgent = (
  workspace: Workspace,
  template: Partial<Agent> = {},
) =>
  MCPClient.forWorkspace(workspace).AGENTS_CREATE({
    id: crypto.randomUUID(),
    ...template,
  });

/**
 * Load an agent from the file system
 * @param agentId - The id of the agent to load
 * @returns The agent
 */
export const loadAgent = (
  workspace: Workspace,
  agentId: string,
  signal?: AbortSignal,
): Promise<Agent> =>
  MCPClient.forWorkspace(workspace).AGENTS_GET({ id: agentId }, { signal });

export const listAgents = (
  workspace: Workspace,
  signal?: AbortSignal,
): Promise<Agent[]> =>
  MCPClient.forWorkspace(workspace)
    .AGENTS_LIST({}, { signal })
    .then((res) => res.items) as Promise<Agent[]>;

/**
 * Delete an agent from the file system
 * @param workspace - The workspace of the agent
 * @param agentId - The id of the agent to delete
 */
export const deleteAgent = (workspace: Workspace, agentId: string) =>
  MCPClient.forWorkspace(workspace).AGENTS_DELETE({ id: agentId });

/**
 * Validate an agent against the Zod schema
 *
 * @param agent - The agent to validate
 * @returns The validated agent or an error
 */
export const validateAgent = (
  agent: unknown,
): [Agent, null] | [null, Error] => {
  try {
    const validatedAgent = AgentSchema.parse(agent);
    return [validatedAgent, null];
  } catch (error) {
    return [null, error instanceof Error ? error : new Error("Invalid agent")];
  }
};

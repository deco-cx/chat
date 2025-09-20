import { MCPClient } from "../fetcher.ts";
import { type Agent, AgentSchema } from "../models/agent.ts";
import { stub } from "../stub.ts";
import { ProjectLocator } from "../locator.ts";

// TODO(camudo): fix this, this will only work on personal migrated
// projects when the user talking to the agent are the owner of the projects.
// few users will land on this edge case but im commenting here to remember it.
export const updateAgent = async (locator: ProjectLocator, agent: Agent) => {
  const agentRoot = `/${locator}/Agents/${agent.id}`;

  // deno-lint-ignore no-explicit-any
  const agentStub = stub<any>("AIAgent").new(agentRoot);

  await agentStub.configure(agent);

  return agent;
};

/**
 * Create a new agent
 * @param locator - Project locator
 * @param template - The template for the agent
 * @returns The new agent
 */
export const createAgent = (
  locator: ProjectLocator,
  template: Partial<Agent> = {},
) =>
  MCPClient.forLocator(locator).AGENTS_CREATE({
    id: crypto.randomUUID(),
    ...template,
  });

/**
 * Load an agent from the file system
 * @param locator - Project locator
 * @param agentId - The id of the agent to load
 * @param signal - The signal to abort the request
 * @returns The agent
 */
export const loadAgent = (
  locator: ProjectLocator,
  agentId: string,
  signal?: AbortSignal,
): Promise<Agent> =>
  MCPClient.forLocator(locator).AGENTS_GET({ id: agentId }, { signal });

export const listAgents = (
  locator: ProjectLocator,
  signal?: AbortSignal,
): Promise<Agent[]> =>
  MCPClient.forLocator(locator)
    .AGENTS_LIST({}, { signal })
    .then((res) => res.items) as Promise<Agent[]>;

export interface AgentWithActivity extends Agent {
  lastAccess?: string | null;
  lastAccessor?: string | null;
}

/**
 * Delete an agent from the file system
 * @param locator - The locator of the agent
 * @param agentId - The id of the agent to delete
 */
export const deleteAgent = (locator: ProjectLocator, agentId: string) =>
  MCPClient.forLocator(locator).AGENTS_DELETE({ id: agentId });

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

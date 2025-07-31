import { MCPClient } from "../fetcher.ts";
import { type Agent, AgentSchema } from "../models/agent.ts";
import { stub } from "../stub.ts";
import type { MCPConnection } from "../models/mcp.ts";
import { WellKnownBindings } from "../mcp/bindings/index.ts";

/**
 * Update an agent
 * @param workspace - The workspace of the agent
 * @param agent - The agent to update
 * @returns The updated agent
 */
export const updateAgent = async (workspace: string, agent: Agent) => {
  const agentRoot = `/${workspace}/Agents/${agent.id}`;

  // deno-lint-ignore no-explicit-any
  const agentStub = stub<any>("AIAgent")
    .new(agentRoot);

  await agentStub.configure(agent);

  return agent;
};

/**
 * Create a new agent
 * @returns The new agent
 */
export const createAgent = (
  workspace: string,
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
  workspace: string,
  agentId: string,
  signal?: AbortSignal,
): Promise<Agent> =>
  MCPClient.forWorkspace(workspace)
    .AGENTS_GET(
      { id: agentId },
      { signal },
    );

export const listAgents = (
  workspace: string,
  signal?: AbortSignal,
): Promise<Agent[]> =>
  MCPClient.forWorkspace(workspace).AGENTS_LIST(
    {},
    { signal },
  );

/**
 * Delete an agent from the file system
 * @param workspace - The workspace of the agent
 * @param agentId - The id of the agent to delete
 */
export const deleteAgent = (workspace: string, agentId: string) =>
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

export const listAvailableAgentsForConnection = async (
  connection: MCPConnection,
) => {
  try {
    const client = MCPClient.forConnection<typeof WellKnownBindings["Agent"]>(
      connection,
    );
    const result = await client.DECO_CHAT_AGENTS_LIST({});
    return result;
  } catch (error) {
    console.error("Error listing available agents for connection:", error);
    return { agents: [] };
  }
};

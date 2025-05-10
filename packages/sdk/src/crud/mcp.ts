import { callToolFor } from "../fetcher.ts";
import { type Integration, IntegrationSchema } from "../models/mcp.ts";

export class IntegrationNotFoundError extends Error {
  integrationId: string;

  constructor(integrationId: string) {
    super(`Integration ${integrationId} not found`);
    this.integrationId = integrationId;
  }
}

/**
 * Save an MCP to the file system
 * @param integration - The MCP to save
 */
export const saveIntegration = async (
  workspace: string,
  integration: Integration,
) => {
  const response = await callToolFor(workspace, "INTEGRATIONS_UPDATE", {
    id: integration.id,
    integration,
  });

  const { error, data } = await response.json();

  if (error) {
    throw new Error(error.message || "Failed to save integration");
  }

  return data;
};

/**
 * Create a new MCP
 * @returns The new MCP
 */
export const createIntegration = async (
  workspace: string,
  template: Partial<Integration> = {},
) => {
  const integration: Integration = {
    id: crypto.randomUUID(),
    name: "New Integration",
    description: "A new multi-channel platform integration",
    icon: "",
    connection: { type: "HTTP", url: "https://example.com/mcp" },
    ...template,
  };

  const response = await callToolFor(
    workspace,
    "INTEGRATIONS_CREATE",
    integration,
  );

  const { error, data } = await response.json();

  if (error) {
    throw new Error(error.message || "Failed to save integration");
  }

  return data;
};

/**
 * Load an MCP from the file system
 * @param mcpId - The id of the MCP to load
 * @returns The MCP
 */
export const loadIntegration = async (
  workspace: string,
  mcpId: string,
  signal?: AbortSignal,
): Promise<Integration> => {
  const response = await callToolFor(workspace, "INTEGRATIONS_GET", {
    id: mcpId,
  }, { signal });

  if (response.status === 404) {
    throw new IntegrationNotFoundError(mcpId);
  }

  const { error, data } = await response.json();

  if (error) {
    throw new Error(error.message || "Failed to load integration");
  }

  return data;
};

export const listIntegrations = async (
  workspace: string,
  signal?: AbortSignal,
): Promise<Integration[]> => {
  const response = await callToolFor(workspace, "INTEGRATIONS_LIST", {}, {
    signal,
  });

  const { error, data } = await response.json();

  if (error) {
    throw new Error(error.message || "Failed to list integrations");
  }

  return data;
};

/**
 * Delete an MCP from the file system
 * @param mcpId - The id of the MCP to delete
 */
export const deleteIntegration = async (workspace: string, mcpId: string) => {
  const response = await callToolFor(workspace, "INTEGRATIONS_DELETE", {
    id: mcpId,
  });

  const { error, data } = await response.json();

  if (error) {
    throw new Error(error.message || "Failed to delete integration");
  }

  return data;
};

/**
 * Validate an MCP against the Zod schema
 *
 * @param mcp - The MCP to validate
 * @returns The validated MCP or an error
 */
export const validateIntegration = (
  mcp: unknown,
): [Integration, null] | [null, Error] => {
  try {
    const validatedMCP = IntegrationSchema.parse(mcp);
    return [validatedMCP, null];
  } catch (error) {
    return [null, error instanceof Error ? error : new Error("Invalid MCP")];
  }
};

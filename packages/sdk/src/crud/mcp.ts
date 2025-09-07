import { MCPClient } from "../fetcher.ts";
import {
  type Binder,
  type Integration,
  IntegrationSchema,
} from "../models/mcp.ts";

/**
 * Save an MCP to the file system
 * @param integration - The MCP to save
 */
export const saveIntegration = (workspace: string, integration: Integration) =>
  MCPClient.forWorkspace(workspace).INTEGRATIONS_UPDATE({
    id: integration.id,
    integration,
  });

export type CreateIntegrationPayload = Partial<Integration> & {
  clientIdFromApp?: string;
};

/**
 * Create a new MCP
 * @returns The new MCP
 */
export const createIntegration = (
  workspace: string,
  template: CreateIntegrationPayload = {},
) =>
  MCPClient.forWorkspace(workspace).INTEGRATIONS_CREATE({
    id: crypto.randomUUID(),
    name: "New Integration",
    description: "A new multi-channel platform integration",
    icon: "",
    connection: { type: "HTTP", url: "https://example.com/mcp" },
    ...template,
  });

/**
 * Load an MCP from the file system
 * @param mcpId - The id of the MCP to load
 * @returns The MCP
 */
export const loadIntegration = (
  workspace: string,
  mcpId: string,
  signal?: AbortSignal,
): Promise<Integration> =>
  MCPClient.forWorkspace(workspace).INTEGRATIONS_GET({ id: mcpId }, { signal });

export interface ListIntegrationsFilter {
  binder?: Binder;
}

export const listIntegrations = (
  workspace: string,
  filter?: ListIntegrationsFilter,
  signal?: AbortSignal,
): Promise<Integration[]> =>
  MCPClient.forWorkspace(workspace)
    .INTEGRATIONS_LIST({ binder: filter?.binder }, { signal })
    .then((res) => res.items);

/**
 * Delete an MCP from the file system
 * @param mcpId - The id of the MCP to delete
 */
export const deleteIntegration = (workspace: string, mcpId: string) =>
  MCPClient.forWorkspace(workspace).INTEGRATIONS_DELETE({
    id: mcpId,
  });

/**
 * Get a registry app
 * @param workspace - The workspace
 * @param params - Registry app parameters
 * @returns The registry app
 */
export const getRegistryApp = (workspace: string, params: { name: string }) =>
  MCPClient.forWorkspace(workspace).REGISTRY_GET_APP(params);

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

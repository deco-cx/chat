import { MCPClient } from "../fetcher.ts";

/**
 * Get a registry app
 * @param workspace - The workspace
 * @param params - Registry app parameters
 * @returns The registry app
 */
export const getRegistryApp = (workspace: string, params: { name: string }) =>
  MCPClient.forWorkspace(workspace).REGISTRY_GET_APP(params);

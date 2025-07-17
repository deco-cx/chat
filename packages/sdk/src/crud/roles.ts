import { MCPClient } from "../fetcher.ts";
import type { RoleFormData, ToolPermission } from "../mcp/members/roles-api.ts";

export interface TeamRole {
  id: number;
  name: string;
  description: string | null;
  team_id: number | null;
  tools: Record<string, ToolPermission[]>;
  agents: string[];
  members: string[];
}

export type { RoleFormData, ToolPermission };

export interface CreateTeamRoleParams {
  teamId: number;
  roleData: RoleFormData;
}

export interface UpdateTeamRoleParams {
  teamId: number;
  roleId: number;
  roleData: RoleFormData;
}

export interface DeleteTeamRoleParams {
  teamId: number;
  roleId: number;
}

export interface GetTeamRoleParams {
  teamId: number;
  roleId: number;
}

/**
 * Create a new team role with associated policies and permissions
 */
export async function createTeamRole(
  params: CreateTeamRoleParams,
): Promise<TeamRole> {
  return await MCPClient.TEAM_ROLE_CREATE(params) as TeamRole;
}

/**
 * Update an existing team role and its associated policies
 */
export async function updateTeamRole(
  params: UpdateTeamRoleParams,
): Promise<TeamRole> {
  return await MCPClient.TEAM_ROLE_UPDATE(params) as TeamRole;
}

/**
 * Delete a team role and its associated policies
 */
export async function deleteTeamRole(
  params: DeleteTeamRoleParams,
): Promise<{ success: boolean; deletedRoleId: number }> {
  return await MCPClient.TEAM_ROLE_DELETE(params);
}

/**
 * Get detailed information about a specific team role
 */
export async function getTeamRole(
  params: GetTeamRoleParams,
): Promise<TeamRole> {
  return await MCPClient.TEAM_ROLE_GET(params) as TeamRole;
}

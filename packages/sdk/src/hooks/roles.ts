import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createTeamRole, updateTeamRole, deleteTeamRole, getTeamRole } from "../crud/roles.ts";
import { getTeamRoles } from "../crud/members.ts";
import type { 
  CreateTeamRoleParams, 
  UpdateTeamRoleParams, 
  DeleteTeamRoleParams, 
  GetTeamRoleParams,
  TeamRole 
} from "../crud/roles.ts";

// Query keys
export const ROLE_KEYS = {
  all: ["roles"] as const,
  team: (teamId: number) => [...ROLE_KEYS.all, "team", teamId] as const,
  role: (teamId: number, roleId: number) => [...ROLE_KEYS.team(teamId), "role", roleId] as const,
} as const;



/**
 * Hook to get a specific team role
 */
export function useTeamRole(params: GetTeamRoleParams | null) {
  return useQuery({
    queryKey: params ? ROLE_KEYS.role(params.teamId, params.roleId) : ["roles", "null"],
    queryFn: () => params ? getTeamRole(params) : Promise.resolve(null),
    enabled: params !== null,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to create a new team role
 */
export function useCreateTeamRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTeamRole,
    onSuccess: (data) => {
      // Invalidate and refetch team roles
      queryClient.invalidateQueries({
        queryKey: ROLE_KEYS.team(data.team_id || 0),
      });
      
      // Set the new role in cache
      queryClient.setQueryData(
        ROLE_KEYS.role(data.team_id || 0, data.id),
        data
      );
    },
  });
}

/**
 * Hook to update a team role
 */
export function useUpdateTeamRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateTeamRole,
    onSuccess: (data, variables) => {
      // Invalidate and refetch team roles
      queryClient.invalidateQueries({
        queryKey: ROLE_KEYS.team(variables.teamId),
      });
      
      // Update the specific role in cache
      queryClient.setQueryData(
        ROLE_KEYS.role(variables.teamId, variables.roleId),
        data
      );
    },
  });
}

/**
 * Hook to delete a team role
 */
export function useDeleteTeamRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteTeamRole,
    onSuccess: (data, variables) => {
      // Invalidate and refetch team roles
      queryClient.invalidateQueries({
        queryKey: ROLE_KEYS.team(variables.teamId),
      });
      
      // Remove the deleted role from cache
      queryClient.removeQueries({
        queryKey: ROLE_KEYS.role(variables.teamId, variables.roleId),
      });
    },
  });
} 
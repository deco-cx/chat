import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import {
  acceptInvite,
  getMyInvites,
  getTeamMembers,
  getTeamRoles,
  type Invite as _Invite,
  inviteTeamMembers,
  type Member,
  registerActivity,
  rejectInvite,
  removeTeamMember,
  type Role as _Role,
} from "../crud/members.ts";
import { KEYS } from "./api.ts";
import { useTeams } from "./teams.ts";
import { useSDK } from "../index.ts";

/**
 * Hook to fetch team members
 * @param teamId - The ID of the team to fetch members for
 */
export const useTeamMembers = (
  teamId: number | null,
  { withActivity }: { withActivity?: boolean } = { withActivity: false },
) => {
  return useSuspenseQuery({
    queryKey: KEYS.TEAM_MEMBERS(teamId ?? -1),
    queryFn: ({ signal }) => {
      if (teamId === null) {
        return { members: [], invites: [] };
      }
      return getTeamMembers({ teamId, withActivity }, signal);
    },
  });
};

/**
 * Hook to fetch team members for the current team
 * @param currentTeamSlug - The slug of the current team
 */
export const useTeamMembersBySlug = (currentTeamSlug: string | null) => {
  const { data: teams } = useTeams();
  const teamId = useMemo(
    () => teams?.find((t) => t.slug === currentTeamSlug)?.id ?? null,
    [teams, currentTeamSlug],
  );
  return useTeamMembers(teamId);
};

/**
 * Hook to fetch team roles
 * @param teamId - The ID of the team to fetch roles for
 */
export const useTeamRoles = (teamId: number | null) => {
  return useSuspenseQuery({
    queryKey: KEYS.TEAM_ROLES(teamId ?? -1),
    queryFn: ({ signal }) =>
      typeof teamId === "number" ? getTeamRoles(teamId, signal) : [],
  });
};

/**
 * Hook to fetch user's invites
 * @returns Query with invites data
 */
export const useInvites = () => {
  return useSuspenseQuery({
    queryKey: KEYS.MY_INVITES(),
    queryFn: ({ signal }) => getMyInvites(signal),
  });
};

/**
 * Hook to accept an invite
 * @returns Mutation function for accepting an invite
 */
export const useAcceptInvite = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (inviteId: string) => acceptInvite(inviteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.MY_INVITES() });
      queryClient.invalidateQueries({ queryKey: KEYS.TEAMS() });
    },
  });
};

/**
 * Hook to reject an invite
 * @returns Mutation function for rejecting an invite
 */
export const useRejectInvite = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (
      { id: id }: { id: string; teamId?: number },
    ) => rejectInvite(id),
    onSuccess: (_, variables) => {
      variables.teamId === undefined &&
        queryClient.invalidateQueries({ queryKey: KEYS.MY_INVITES() });

      variables.teamId !== undefined &&
        queryClient.invalidateQueries({
          queryKey: KEYS.TEAM_MEMBERS(variables.teamId ?? -1),
        });
    },
  });
};

/**
 * Hook to invite team members
 * @returns Mutation function for inviting team members
 */
export const useInviteTeamMember = () => {
  const queryClient = useQueryClient();
  const { workspace } = useSDK();

  return useMutation({
    mutationFn: ({
      teamId,
      invitees,
    }: {
      teamId: number;
      invitees: Array<{
        email: string;
        roles: Array<{ id: number; name: string }>;
      }>;
    }) => inviteTeamMembers(teamId, invitees, workspace),
    onSuccess: (_, { teamId }) => {
      const membersKey = KEYS.TEAM_MEMBERS(teamId);
      queryClient.invalidateQueries({ queryKey: membersKey });
    },
  });
};

/**
 * Hook to remove a team member
 * @returns Mutation function for removing a team member
 */
export const useRemoveTeamMember = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ teamId, memberId }: { teamId: number; memberId: number }) =>
      removeTeamMember(teamId, memberId),
    onSuccess: (_, { teamId, memberId }) => {
      const membersKey = KEYS.TEAM_MEMBERS(teamId);

      queryClient.cancelQueries({ queryKey: membersKey });
      queryClient.setQueryData<Member[]>(
        membersKey,
        (old) => old?.filter((member) => member.id !== memberId) ?? [],
      );
    },
  });
};

export const useRegisterActivity = (teamId?: number) => {
  useEffect(() => {
    if (!teamId) return;

    registerActivity(teamId);
  }, [teamId]);
};

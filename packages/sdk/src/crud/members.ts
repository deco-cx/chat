import { MCPClient } from "../fetcher.ts";
import { User } from "./user.ts";

interface Roles {
  name: string;
  id: number;
}

export interface Member {
  id: number;
  user_id: string;
  created_at: string;
  profiles: User;
  lastActivity?: string;
  roles: Roles[];
}

export interface Role {
  id: number;
  name: string;
  description: string | null;
  team_id: number | null;
}

export interface Invite {
  id: string;
  teamId: number;
  teamName: string;
  email: string;
  roles: Array<{ id: number; name: string }>;
  createdAt: string;
  inviter: {
    name: string | null;
    email: string | null;
  };
}

export interface MemberFormData {
  email: string;
}

/**
 * Fetch invites for the current user
 * @returns List of invites
 */
export const getMyInvites = (
  signal?: AbortSignal,
): Promise<Invite[]> =>
  MCPClient.MY_INVITES_LIST({}, { signal }) as Promise<Invite[]>;

/**
 * Accept an invite
 * @param inviteId - The ID of the invite to accept
 * @returns Success status and team info
 */
export const acceptInvite = (
  inviteId: string,
): Promise<
  { ok: boolean; teamId: number; teamName: string; teamSlug: string }
> => MCPClient.TEAM_INVITE_ACCEPT({ id: inviteId });

/**
 * Reject an invite
 * @param inviteId - The ID of the invite to reject
 * @returns Success status
 */
export const rejectInvite = async (
  inviteId: string,
): Promise<{ ok: boolean }> => {
  const { data, error, ok } = await MCPClient.TEAM_INVITE_DELETE({
    id: inviteId,
  });

  if (!ok || !data) {
    throw new Error(error?.message ?? "Failed to reject invite");
  }

  return data;
};

/**
 * Fetch team members by team ID
 * @param teamId - The ID of the team to fetch members for
 * @returns List of team members
 */
export const getTeamMembers = (
  { teamId, withActivity }: { teamId: number; withActivity?: boolean },
  signal?: AbortSignal,
): Promise<Member[]> =>
  MCPClient.TEAM_MEMBERS_GET({ teamId, withActivity }, { signal }) as Promise<
    Member[]
  >;

/**
 * Fetch team roles by team ID
 * @param teamId - The ID of the team to fetch roles for
 * @returns List of team roles
 */
export const getTeamRoles = (
  teamId: number,
  signal?: AbortSignal,
): Promise<Role[]> => MCPClient.TEAM_ROLES_LIST({ teamId }, { signal });

/**
 * Invite new members to a team
 * @param teamId - The ID of the team to invite members to
 * @param invitees - Array of invitees with email and roles
 * @returns Response message from the API
 */
export const inviteTeamMembers = (
  teamId: number,
  invitees: Array<{
    email: string;
    roles: Array<{ id: number; name: string }>;
  }>,
): Promise<{ message: string }> =>
  MCPClient.TEAM_MEMBERS_INVITE({ teamId: teamId.toString(), invitees });

/**
 * Remove a member from a team
 * @param teamId - The ID of the team
 * @param memberId - The ID of the member to remove
 * @returns Success status
 */
export const removeTeamMember = (
  teamId: number,
  memberId: number,
): Promise<{ success: boolean }> =>
  MCPClient.TEAM_MEMBERS_REMOVE({ teamId, memberId });

export const registerActivity = (teamId: number) => {
  MCPClient.TEAM_MEMBER_ACTIVITY_REGISTER({ teamId });
};

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
  description?: string | null;
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
export const rejectInvite = (
  inviteId: string,
  signal?: AbortSignal,
) =>
  MCPClient.TEAM_INVITE_DELETE({
    id: inviteId,
  }, { signal });

/**
 * Fetch team members by team ID
 * @param teamId - The ID of the team to fetch members for
 * @returns List of team members
 */
export const getTeamMembers = (
  { teamId, withActivity }: { teamId: number; withActivity?: boolean },
  signal?: AbortSignal,
) => MCPClient.TEAM_MEMBERS_GET({ teamId, withActivity }, { signal });

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
  workspace: string,
): Promise<{ message: string }> =>
  MCPClient.forWorkspace(workspace).TEAM_MEMBERS_INVITE({
    teamId: teamId.toString(),
    invitees,
  });

/**
 * Remove a member from a team
 * @param teamId - The ID of the team
 * @param memberId - The ID of the member to remove
 * @returns Success status
 */
export const removeTeamMember = (
  teamId: number,
  memberId: number,
): Promise<{ ok: boolean }> =>
  MCPClient.TEAM_MEMBERS_REMOVE({ teamId, memberId });

export const registerActivity = (teamId: number) => {
  MCPClient.TEAM_MEMBER_ACTIVITY_REGISTER({ teamId });
};

/**
 * Update a member's role in a team
 * @param teamId - The ID of the team
 * @param userId - The user ID of the member
 * @param roleId - The ID of the role to grant or revoke
 * @param action - Whether to grant or revoke the role
 * @returns Success status
 */
export const updateMemberRole = (
  teamId: number,
  userId: string,
  roleId: number,
  action: "grant" | "revoke",
): Promise<{ ok: boolean }> => {
  return MCPClient.TEAM_MEMBERS_UPDATE_ROLE({
    teamId,
    userId,
    roleId,
    action,
  });
};

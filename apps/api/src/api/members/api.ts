import { z } from "zod";
import { assertUserHasAccessToTeamById } from "../../auth/assertions.ts";
import { type AppContext, createApiHandler } from "../../utils/context.ts";
import { userFromDatabase } from "../../utils/user.ts";
import {
  checkAlreadyExistUserIdInTeam,
  getInviteIdByEmailAndTeam,
  getTeamById,
  insertInvites,
  sendInviteEmail,
  updateUserRole,
  userBelongsToTeam,
} from "./invitesUtils.ts";

// Helper function to check if user is admin of a team
async function verifyTeamAdmin(c: AppContext, teamId: number, userId: string) {
  const { data: teamMember, error } = await c
    .get("db")
    .from("members")
    .select("*")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .eq("admin", true)
    .single();

  if (error) throw error;
  if (!teamMember) {
    throw new Error("User does not have admin access to this team");
  }
  return teamMember;
}

// New API handlers
export const getTeamMembers = createApiHandler({
  name: "TEAM_MEMBERS_GET",
  description: "Get all members of a team",
  schema: z.object({ teamId: z.number() }),
  handler: async (props, c) => {
    const { teamId } = props;
    const user = c.get("user");

    // First verify the user has access to the team
    await assertUserHasAccessToTeamById(
      { userId: user.id, teamId: props.teamId },
      c,
    );

    // Get all members of the team
    const { data, error } = await c
      .get("db")
      .from("members")
      .select(`
        id,
        user_id,
        admin,
        created_at,
        profiles!inner (
          id:user_id,
          name,
          email,
          metadata:users_meta_data_view(id, raw_user_meta_data)
        )
      `)
      .eq("team_id", teamId)
      .is("deleted_at", null);

    if (error) throw error;

    return data.map((member) => ({
      ...member,
      // @ts-expect-error - Supabase user metadata is not typed
      profiles: userFromDatabase(member.profiles),
    }));
  },
});

// User's invites list handler
export const getMyInvites = createApiHandler({
  name: "MY_INVITES_LIST",
  description: "List all team invites for the current logged in user",
  schema: z.object({}),
  handler: async (_props, c) => {
    const user = c.get("user");
    const db = c.get("db");

    // Get profile to find user email
    const { data: profile, error: profileError } = await db
      .from("profiles")
      .select("email")
      .eq("user_id", user.id)
      .single();

    if (profileError) throw profileError;
    if (!profile) {
      throw new Error("User profile not found");
    }

    // Find invites for this email
    const { data: invites, error } = await db
      .from("invites")
      .select(`
        id,
        team_id,
        team_name,
        invited_email,
        invited_roles,
        created_at,
        profiles!invites_inviter_id_fkey (
          name,
          email
        )
      `)
      .eq("invited_email", profile.email.toLowerCase());

    if (error) throw error;

    // Transform data to a nicer format for the frontend
    return invites.map((invite) => ({
      id: invite.id,
      teamId: invite.team_id,
      teamName: invite.team_name,
      email: invite.invited_email,
      roles: invite.invited_roles,
      createdAt: invite.created_at,
      inviter: {
        name: invite.profiles?.name || null,
        email: invite.profiles?.email || null,
      },
    }));
  },
});

// New invite team member handler
export const inviteTeamMembers = createApiHandler({
  name: "TEAM_MEMBERS_INVITE",
  description:
    "Invite users to join a team via email. When no specific roles are provided, use default role: { id: 1, name: 'owner' }",
  schema: z.object({
    teamId: z.string(),
    invitees: z.array(z.object({
      email: z.string().email(),
      roles: z.array(z.object({
        id: z.number(),
        name: z.string(),
      })),
    })),
  }),
  handler: async (props, c) => {
    const { teamId, invitees } = props;
    const db = c.get("db");
    const user = c.get("user");
    const teamIdAsNum = Number(teamId);

    // Check for valid inputs
    if (!invitees || !teamId || Number.isNaN(teamIdAsNum)) {
      throw new Error("Missing or invalid information");
    }

    if (invitees.some(({ email }) => !email)) {
      throw new Error("Missing emails");
    }

    // Apply default owner role for invitees without roles
    const processedInvitees = invitees.map((invitee) => {
      if (!invitee.roles || invitee.roles.length === 0) {
        return {
          ...invitee,
          roles: [{ id: 1, name: "owner" }],
        };
      }
      return invitee;
    });

    // TODO: Verify if invites have owner role and verify current user is owner

    // Process each invitee
    const inviteesPromises = processedInvitees.map(async (invitee) => {
      const email = invitee.email.trim();

      // Check if already invited or already a team member
      const [invites, alreadyExistsUserInTeam] = await Promise.all([
        getInviteIdByEmailAndTeam({ email, teamId }, db),
        checkAlreadyExistUserIdInTeam({ email, teamId }, db),
      ]);

      return {
        invitee,
        ignoreInvitee: (invites && invites.length > 0) ||
          alreadyExistsUserInTeam,
      };
    });

    const inviteesResults = await Promise.all(inviteesPromises);

    // Filter out invitees that already have an invite or are already team members
    const inviteesToInvite = inviteesResults
      .filter((inviteeResult) => !inviteeResult.ignoreInvitee)
      .map((inviteeResult) => inviteeResult.invitee);

    if (inviteesToInvite.length === 0) {
      return {
        message: "All users already invited or are members of the team",
      };
    }

    // Get team data
    const { data: teamData, error: teamError } = await getTeamById(teamId, db);

    if (!teamData || teamError) {
      throw new Error("Team not found");
    }

    if (!userBelongsToTeam(teamData, user.id)) {
      throw new Error(`You don't have access to team ${teamId}`);
    }

    // Create invites
    const invites = inviteesToInvite.map((invitee) => ({
      invited_email: invitee.email.toLowerCase(),
      team_id: teamIdAsNum,
      team_name: teamData.name,
      inviter_id: user.id,
      invited_roles: invitee.roles,
    }));

    const inviteResult = await insertInvites(invites, db);

    if (inviteResult.error) {
      throw new Error("Failed to create invites");
    }

    // Send emails
    const requestPromises = inviteResult.data?.map(async (invite: {
      id: string;
      invited_email: string;
      team_name: string;
      invited_roles: Array<{ name: string; id: number }>;
    }) => {
      const rolesNames = invite.invited_roles.map(({ name }) => name);

      await sendInviteEmail({
        ...invite,
        inviter: user.email || "Unknown",
        roles: rolesNames,
      });
    });

    await Promise.all(requestPromises || []);

    return {
      message:
        `Invite sent to their home screen. Ask them to log in at https://deco.chat`,
    };
  },
});

// Accept invite handler
export const acceptInvite = createApiHandler({
  name: "TEAM_INVITE_ACCEPT",
  description: "Accept a team invitation",
  schema: z.object({
    id: z.string(),
  }),
  handler: async (props, c) => {
    const { id } = props;
    const db = c.get("db");
    const user = c.get("user");

    // Get invite details
    const { data: invite, error: inviteError } = await db
      .from("invites")
      .select("team_id, team_name, invited_email, invited_roles")
      .eq("id", id)
      .single();

    if (!invite || inviteError) {
      throw new Error(
        "We couldn't find your invitation. It may be invalid or already accepted.",
      );
    }

    // Fetch team slug
    const { data: team, error: teamError } = await db
      .from("teams")
      .select("slug")
      .eq("id", invite.team_id)
      .single();

    if (teamError) {
      console.error("Error fetching team slug:", teamError);
      // Continue even if we don't get the slug
    }

    // Check if the invite is for the current user
    const { data: profiles, error: profilesError } = await db
      .from("profiles")
      .select("user_id")
      .eq("email", invite.invited_email.toLowerCase());

    if (profilesError) {
      throw profilesError;
    }

    if (!profiles || !profiles[0]) {
      throw new Error("Profile not found");
    }

    if (profiles[0].user_id !== user.id) {
      throw new Error(
        "It looks like this invite isn't for you. Please ensure your email matches the one specified in the invitation.",
      );
    }

    // Check if user is already in the team
    const alreadyExistsUserInTeam = await checkAlreadyExistUserIdInTeam({
      userId: user.id,
      teamId: invite.team_id.toString(),
    }, db);

    // Add user to team if not already a member
    if (!alreadyExistsUserInTeam) {
      const { error } = await db
        .from("members")
        .insert({
          team_id: invite.team_id,
          user_id: user.id,
          deleted_at: null,
        })
        .select();

      if (error) {
        throw error;
      }

      // Apply roles
      if (invite.invited_roles && Array.isArray(invite.invited_roles)) {
        const rolePromises = invite.invited_roles.map(async (roleData) => {
          const role = roleData as { id: number; name: string };
          return await updateUserRole(
            db,
            Number(invite.team_id),
            invite.invited_email,
            {
              roleId: role.id,
              action: "grant",
            },
          );
        });

        try {
          await Promise.all(rolePromises);
        } catch (error) {
          console.error("Error assigning roles:", error);
          // We'll continue even if role assignment fails
        }
      }
    }

    // Delete the invite
    await db.from("invites").delete().eq("id", id);

    return {
      ok: true,
      teamId: invite.team_id,
      teamName: invite.team_name,
      teamSlug: team?.slug ||
        invite.team_name.toLowerCase().replace(/\s+/g, "-"),
    };
  },
});

// Delete invite handler
export const deleteInvite = createApiHandler({
  name: "TEAM_INVITE_DELETE",
  description: "Delete a team invitation",
  schema: z.object({
    id: z.string(),
  }),
  handler: async (props, c) => {
    const { id } = props;
    const db = c.get("db");

    const { data } = await db
      .from("invites")
      .delete()
      .eq("id", id)
      .select();

    if (!data || data.length === 0) {
      throw new Error("Invite not found");
    }

    return { ok: true };
  },
});

export const updateTeamMember = createApiHandler({
  name: "TEAM_MEMBERS_UPDATE",
  description: "Update a team member. Useful for updating admin status.",
  schema: z.object({
    teamId: z.number(),
    memberId: z.number(),
    data: z.object({
      admin: z.boolean().optional(),
      activity: z.array(z.any()).optional(),
    }),
  }),
  handler: async (props, c) => {
    const { teamId, memberId, data } = props;
    const user = c.get("user");

    // Verify the user has admin access to the team
    await verifyTeamAdmin(c, teamId, user.id);

    // Verify the member exists in the team
    const { data: member, error: memberError } = await c
      .get("db")
      .from("members")
      .select("*")
      .eq("id", memberId)
      .eq("team_id", teamId)
      .single();

    if (memberError) throw memberError;
    if (!member) {
      throw new Error("Member not found in this team");
    }

    // Update the member
    const { data: updatedMember, error: updateError } = await c
      .get("db")
      .from("members")
      .update(data)
      .eq("id", memberId)
      .eq("team_id", teamId)
      .select()
      .single();

    if (updateError) throw updateError;
    return updatedMember;
  },
});

export const removeTeamMember = createApiHandler({
  name: "TEAM_MEMBERS_REMOVE",
  description: "Remove a member from a team",
  schema: z.object({
    teamId: z.number(),
    memberId: z.number(),
  }),
  handler: async (props, c) => {
    const { teamId, memberId } = props;
    const user = c.get("user");

    // Verify the user has admin access to the team
    await verifyTeamAdmin(c, teamId, user.id);

    // Verify the member exists in the team
    const { data: member, error: memberError } = await c
      .get("db")
      .from("members")
      .select("*")
      .eq("id", memberId)
      .eq("team_id", teamId)
      .single();

    if (memberError) throw memberError;
    if (!member) {
      throw new Error("Member not found in this team");
    }

    // Don't allow removing the last admin
    if (member.admin) {
      const { data: adminCount, error: countError } = await c
        .get("db")
        .from("members")
        .select("*", { count: "exact" })
        .eq("team_id", teamId)
        .eq("admin", true)
        .is("deleted_at", null);

      if (countError) throw countError;
      if (adminCount.length <= 1) {
        throw new Error("Cannot remove the last admin of the team");
      }
    }

    const { error } = await c
      .get("db")
      .from("members")
      .delete()
      .eq("id", memberId)
      .eq("team_id", teamId);

    if (error) throw error;
    return { success: true };
  },
});

export const registerMemberActivity = createApiHandler({
  name: "TEAM_MEMBER_ACTIVITY_REGISTER",
  description: "Register that the user accessed a team",
  schema: z.object({
    teamId: z.number(),
  }),
  handler: async (props, c) => {
    const { teamId } = props;
    const user = c.get("user");

    // Verify the user has admin access to the team
    await assertUserHasAccessToTeamById({
      teamId,
      userId: user.id,
    }, c);

    await c.get("db").from("user_activity").insert({
      user_id: user.id,
      resource: "team",
      key: "id",
      value: `${teamId}`,
    });

    return { success: true };
  },
});

// Get team roles list
export const teamRolesList = createApiHandler({
  name: "TEAM_ROLES_LIST",
  description: "Get all roles available for a team, including basic deco roles",
  schema: z.object({
    teamId: z.number(),
  }),
  handler: async (props, c) => {
    const { teamId } = props;
    const db = c.get("db");
    const user = c.get("user");

    // Verify the user has access to the team
    await assertUserHasAccessToTeamById(
      { userId: user.id, teamId },
      c,
    );

    // Helper function to create the team or deco basic roles query
    const getTeamOrDecoBasicRolesQuery = (teamId: number) => {
      return `team_id.eq.${teamId},team_id.is.null`;
    };

    // Get all roles for this team and deco basic roles
    const { data, error } = await db.from("roles").select(
      "id, name, description, team_id",
    ).or(getTeamOrDecoBasicRolesQuery(teamId));

    if (error) throw error;

    return data;
  },
});

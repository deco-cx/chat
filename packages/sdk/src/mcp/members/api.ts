import { z } from "zod/v3";
import {
  ForbiddenError,
  InternalServerError,
  NotFoundError,
  UserInputError,
} from "../../errors.ts";
import {
  assertPrincipalIsUser,
  assertTeamResourceAccess,
} from "../assertions.ts";
import { type AppContext, createToolGroup } from "../context.ts";
import { userFromDatabase } from "../user.ts";
import { issues, organizations, projects, members } from "../schema.ts";
import { eq, and, isNull } from "drizzle-orm";
import {
  checkAlreadyExistUserIdInTeam,
  enrichPlanWithTeamMetadata,
  getInviteIdByEmailAndTeam,
  getTeamById,
  insertInvites,
  sendInviteEmail,
  userBelongsToTeam,
} from "./invites-utils.ts";

export const updateActivityLog = async (
  c: AppContext,
  {
    teamId,
    userId,
    action,
  }: {
    teamId: number;
    userId: string;
    action: "add_member" | "remove_member";
  },
) => {
  const currentTimestamp = new Date().toISOString();
  const { data } = await c.db
    .from("members")
    .select("activity")
    .eq("user_id", userId)
    .eq("team_id", teamId)
    .single();

  const activityLog = data?.activity || [];

  return await c.db
    .from("members")
    .update({
      activity: [
        ...activityLog,
        {
          action,
          timestamp: currentTimestamp,
        },
      ],
    })
    .eq("team_id", teamId)
    .eq("user_id", userId);
};

export interface Role {
  id: number;
  name: string;
}

export interface InviteAPIData {
  email: string;
  id: string;
  roles: Role[];
}

const isRole = (
  // deno-lint-ignore no-explicit-any
  r: any,
): r is Role => Boolean(r);

export interface DbMember {
  id: number;
  user_id: string | null;
  created_at: string | null;
  profiles: {
    /** @description is user id */
    id: string;
    name: string | null;
    email: string;
    metadata: {
      id: string | null;
      // deno-lint-ignore no-explicit-any
      raw_user_meta_data: any;
    };
  };
  member_roles: {
    roles: { id: number; name: string };
  }[];
}

const mapMember = ({ member_roles, ...member }: DbMember, c: AppContext) => ({
  ...member,
  user_id: member.user_id ?? "",
  created_at: member.created_at ?? "",
  // @ts-expect-error - Supabase user metadata is not typed
  profiles: userFromDatabase(member.profiles),
  roles: c.policy.filterTeamRoles(
    member_roles.map((memberRole) => memberRole.roles).filter(isRole),
  ),
});

export const createTool = createToolGroup("Team", {
  name: "Team & User Management",
  description: "Manage workspace access and roles.",
  workspace: false,
  icon: "https://assets.decocache.com/mcp/de7e81f6-bf2b-4bf5-a96c-867682f7d2ca/Team--User-Management.png",
});

export const getTeamMembers = createTool({
  name: "TEAM_MEMBERS_GET",
  description: "Get all members of a team",
  inputSchema: z.lazy(() =>
    z.object({
      teamId: z.number(),
      withActivity: z.boolean().optional(),
    }),
  ),
  handler: async (
    props,
    c,
  ): Promise<{
    members: (ReturnType<typeof mapMember> & { lastActivity?: string })[];
    invites: InviteAPIData[];
  }> => {
    const { teamId, withActivity } = props;

    await assertTeamResourceAccess(c.tool.name, teamId, c);

    // Get all members of the team
    const [{ data, error }, { data: invitesData }] = await Promise.all([
      c.db
        .from("members")
        .select(
          `
        id,
        user_id,
        admin,
        created_at,
        profiles!inner (
          id:user_id,
          name,
          email,
          metadata:users_meta_data_view(id, raw_user_meta_data)
        ),
        member_roles(roles(id, name))
      `,
        )
        .eq("team_id", teamId)
        .is("deleted_at", null),
      c.db
        .from("invites")
        .select("id, email:invited_email, roles:invited_roles")
        .eq("team_id", teamId)
        .overrideTypes<{ id: string; email: string; roles: Role[] }[]>(),
    ]);

    if (error) throw error;

    const members = data.map((member) => mapMember(member, c));
    const invites = invitesData ?? [];

    let activityByUserId: Record<string, string> = {};

    if (withActivity) {
      const { data: activityData } = await c.db
        .rpc("get_latest_user_activity", {
          p_resource: "team",
          p_key: "id",
          p_value: `${teamId}`,
        })
        .select("user_id, created_at");

      if (activityData) {
        activityByUserId = activityData.reduce(
          (res, activity) => {
            res[activity.user_id] = activity.created_at;
            return res;
          },
          {} as Record<string, string>,
        );
      }

      return {
        members: members.map((member) => ({
          ...member,
          lastActivity: activityByUserId[member.user_id ?? ""],
        })),
        invites,
      };
    }

    return { members, invites };
  },
});

export const updateTeamMember = createTool({
  name: "TEAM_MEMBERS_UPDATE",
  description: "Update a team member. Usefull for updating admin status.",
  inputSchema: z.lazy(() =>
    z.object({
      teamId: z.number(),
      memberId: z.number(),
      data: z.object({
        admin: z.boolean().optional(),
      }),
    }),
  ),
  handler: async (props, c) => {
    const { teamId, memberId, data } = props;

    await assertTeamResourceAccess(c.tool.name, teamId, c);

    // Verify the member exists in the team
    const { data: member, error: memberError } = await c.db
      .from("members")
      .select("id")
      .eq("id", memberId)
      .eq("team_id", teamId)
      .is("deleted_at", null)
      .single();

    if (memberError) throw memberError;
    if (!member) {
      throw new NotFoundError("Member not found in this team");
    }

    // Update the member
    const { data: updatedMember, error: updateError } = await c.db
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

export const removeTeamMember = createTool({
  name: "TEAM_MEMBERS_REMOVE",
  description: "Remove a member from a team",
  inputSchema: z.lazy(() =>
    z.object({
      teamId: z.number(),
      memberId: z.number(),
    }),
  ),
  handler: async (props, c) => {
    const { teamId, memberId } = props;

    const hasAccess = await assertTeamResourceAccess(c.tool.name, teamId, c)
      .then(() => true)
      .catch(() => false);

    // Verify the member exists in the team
    const { data: member, error: memberError } = await c.db
      .from("members")
      .select("id, admin, user_id")
      .eq("id", memberId)
      .eq("team_id", teamId)
      .is("deleted_at", null)
      .single();

    // Allow users with team access to remove members or allow users to remove themselves from a team
    if (!hasAccess && member?.user_id !== c.user.id) {
      throw new ForbiddenError("You are not allowed to remove this member");
    }

    c.resourceAccess.grant();

    if (memberError) throw memberError;
    if (!member) {
      throw new NotFoundError("Member not found in this team");
    }

    // Don't allow removing the last admin
    if (member.admin) {
      const { data: adminCount, error: countError } = await c.db
        .from("members")
        .select("*", { count: "exact" })
        .eq("team_id", teamId)
        .eq("admin", true)
        .is("deleted_at", null);

      if (countError) throw countError;
      if (adminCount.length <= 1) {
        throw new UserInputError("Cannot remove the last admin of the team");
      }
    }

    try {
      await c.policy.removeAllMemberPoliciesAtTeam({
        teamId,
        memberId: member.id,
      });
    } catch (error) {
      console.log("error", error);
    }

    const currentTimestamp = new Date();
    const { error } = await c.db
      .from("members")
      .update({
        deleted_at: currentTimestamp.toISOString(),
      })
      .eq("team_id", teamId)
      .eq("user_id", member.user_id!);

    await updateActivityLog(c, {
      teamId,
      userId: member.user_id!,
      action: "remove_member",
    });

    if (error) throw error;
    return { success: true };
  },
});

export const registerMemberActivity = createTool({
  name: "TEAM_MEMBER_ACTIVITY_REGISTER",
  description: "Register that the user accessed a team",
  inputSchema: z.lazy(() =>
    z.object({
      teamId: z.number(),
    }),
  ),
  handler: async (props, c) => {
    const { teamId } = props;

    await assertTeamResourceAccess(c.tool.name, teamId, c);

    assertPrincipalIsUser(c);
    const user = c.user;

    await c.db.from("user_activity").insert({
      user_id: user.id,
      resource: "team",
      key: "id",
      value: `${teamId}`,
    });

    return { success: true };
  },
});

export const registerProjectActivity = createTool({
  name: "PROJECT_ACTIVITY_REGISTER",
  description: "Register that the user accessed a project",
  inputSchema: z.lazy(() =>
    z.object({
      org: z.string(),
      project: z.string(),
    }),
  ),
  handler: async (props, c) => {
    assertPrincipalIsUser(c);
    c.resourceAccess.grant();

    const user = c.user;
    const { org, project } = props;

    const { data: proj, error } = await c.db
      .from("deco_chat_projects")
      .select(
        `
        id,
        slug,
        teams!inner (
          id,
          slug,
          members!inner (user_id, deleted_at)
        )
      `,
      )
      .eq("slug", project)
      .eq("teams.slug", org)
      .eq("teams.members.user_id", user.id)
      .is("teams.members.deleted_at", null)
      .single();

    if (error) throw error;
    if (!proj) return { success: false };

    await c.db.from("user_activity").insert({
      user_id: user.id,
      resource: "project",
      key: "id",
      value: String(proj.id),
    });

    return { success: true };
  },
});

// User's invites list handler
export const getMyInvites = createTool({
  name: "MY_INVITES_LIST",
  description: "List all team invites for the current logged in user",
  inputSchema: z.lazy(() => z.object({})),
  outputSchema: z.lazy(() =>
    z.object({
      items: z.array(z.any()),
    }),
  ),
  handler: async (_props, c) => {
    c.resourceAccess.grant();

    assertPrincipalIsUser(c);
    const user = c.user;
    const db = c.db;

    // Get profile to find user email
    const { data: profile, error: profileError } = await db
      .from("profiles")
      .select("email")
      .eq("user_id", user.id)
      .single();

    if (profileError) throw profileError;
    if (!profile) {
      throw new NotFoundError("User profile not found");
    }

    // Find invites for this email
    const { data: invites, error } = await db
      .from("invites")
      .select(
        `
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
      `,
      )
      .eq("invited_email", profile.email.toLowerCase());

    if (error) throw error;

    // Transform data to a nicer format for the frontend
    const transformedInvites = invites.map((invite) => ({
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

    return { items: transformedInvites };
  },
});

// New invite team member handler
export const inviteTeamMembers = createTool({
  name: "TEAM_MEMBERS_INVITE",
  description:
    "Invite users to join a team via email. When no specific roles are provided, use default role: { id: 1, name: 'owner' }",
  inputSchema: z.lazy(() =>
    z.object({
      teamId: z.string(),
      invitees: z.array(
        z.object({
          email: z.string().email(),
          roles: z.array(
            z.object({
              id: z.number(),
              name: z.string(),
            }),
          ),
        }),
      ),
    }),
  ),
  handler: async (props, c) => {
    assertPrincipalIsUser(c);

    const { teamId, invitees } = props;
    const db = c.db;
    const user = c.user;
    const teamIdAsNum = Number(teamId);

    await assertTeamResourceAccess(c.tool.name, teamIdAsNum, c);

    // Check for valid inputs
    if (!invitees || !teamId || Number.isNaN(teamIdAsNum)) {
      throw new UserInputError("Missing or invalid information");
    }

    if (invitees.some(({ email }) => !email)) {
      throw new UserInputError("Missing emails");
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
        ignoreInvitee:
          (invites && invites.length > 0) || alreadyExistsUserInTeam,
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
    const teamData = await getTeamById(teamId, db);
    const plan = enrichPlanWithTeamMetadata({
      team: teamData,
      plan: teamData.plan,
    });

    if (!userBelongsToTeam(teamData, user.id)) {
      throw new ForbiddenError(`You don't have access to team ${teamId}`);
    }

    if (inviteesToInvite.length > plan.remainingSeats) {
      throw new UserInputError(
        `You don't have enough remaining seats to invite ${inviteesToInvite.length} users`,
      );
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

    if (!inviteResult.data || inviteResult.error) {
      throw new InternalServerError("Failed to create invites");
    }

    // Send emails
    const requestPromises = inviteResult.data?.map(async (invite) => {
      const invited_roles = invite.invited_roles as {
        name: string;
      }[];
      const rolesNames = invited_roles.map(({ name }) => name);

      await sendInviteEmail(
        {
          ...invite,
          inviter: user.email || "Unknown",
          roles: rolesNames,
        },
        c,
      );
    });

    await Promise.all(requestPromises || []);

    return {
      message: `Invite sent to their home screen. Ask them to log in at https://admin.decocms.com`,
    };
  },
});

// Accept invite handler
export const acceptInvite = createTool({
  name: "TEAM_INVITE_ACCEPT",
  description: "Accept a team invitation",
  inputSchema: z.lazy(() =>
    z.object({
      id: z.string(),
    }),
  ),
  handler: async (props, c) => {
    c.resourceAccess.grant();

    const { id } = props;
    const db = c.db;
    const user = c.user;

    // Get invite details
    const { data: invite, error: inviteError } = await db
      .from("invites")
      .select("team_id, team_name, invited_email, invited_roles")
      .eq("id", id)
      .single();

    if (!invite || inviteError) {
      throw new NotFoundError(
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
      throw new NotFoundError("Profile not found");
    }

    if (profiles[0].user_id !== user.id) {
      throw new UserInputError(
        "It looks like this invite isn't for you. Please ensure your email matches the one specified in the invitation.",
      );
    }

    // Check if user is already in the team
    const { data: alreadyExistsAsDeletedMember } = await db
      .from("members")
      .select("id")
      .eq("team_id", invite.team_id)
      .eq("user_id", user.id)
      .limit(1);
    const alreadyExistsUserInTeam =
      alreadyExistsAsDeletedMember && alreadyExistsAsDeletedMember.length > 0;

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
    } else {
      const { error } = await db
        .from("members")
        .update({ deleted_at: null })
        .eq("team_id", invite.team_id)
        .eq("user_id", user.id);

      if (error) {
        throw error;
      }
    }

    updateActivityLog(c, {
      action: "add_member",
      userId: user.id,
      teamId: invite.team_id,
    });

    try {
      // Apply roles
      if (invite.invited_roles && Array.isArray(invite.invited_roles)) {
        const rolePromises = invite.invited_roles.map(async (roleData) => {
          const role = roleData as { id: number; name: string };
          await c.policy.updateUserRole(invite.team_id, invite.invited_email, {
            roleId: role.id,
            action: "grant",
          });
        });
        await Promise.all(rolePromises);
      }
    } catch (error) {
      console.error("Error assigning roles:", error);
      // We'll continue even if role assignment fails
    }

    // Delete the invite
    await db.from("invites").delete().eq("id", id);

    return {
      ok: true,
      teamId: invite.team_id,
      teamName: invite.team_name,
      teamSlug:
        team?.slug || invite.team_name.toLowerCase().replace(/\s+/g, "-"),
    };
  },
});

// Delete invite handler
export const deleteInvite = createTool({
  name: "TEAM_INVITE_DELETE",
  description: "Delete a team invitation",
  inputSchema: z.lazy(() =>
    z.object({
      id: z.string(),
    }),
  ),
  handler: async (props, c) => {
    const { id } = props;
    const db = c.db;

    c.resourceAccess.grant();

    assertPrincipalIsUser(c);

    const [{ data: invite, error }, { data: profile }] = await Promise.all([
      c.db
        .from("invites")
        .select("team_id, invited_email")
        .eq("id", props.id)
        .single(),

      c.db.from("profiles").select("email").eq("user_id", c.user.id).single(),
    ]);

    const canAccess =
      error || !invite || !profile
        ? false
        : invite?.invited_email &&
            profile?.email &&
            invite.invited_email === profile.email
          ? true
          : await assertTeamResourceAccess(c.tool.name, invite.team_id, c)
              .then(() => true)
              .catch(() => false);

    if (!canAccess) {
      throw new ForbiddenError("You are not allowed to delete this invite");
    }

    const { data } = await db.from("invites").delete().eq("id", id).select();

    if (!data || data.length === 0) {
      throw new NotFoundError("Invite not found");
    }

    return { ok: true };
  },
});

export const teamRolesList = createTool({
  name: "TEAM_ROLES_LIST",
  description: "Get all roles available for a team, including basic deco roles",
  inputSchema: z.lazy(() =>
    z.object({
      teamId: z.number(),
    }),
  ),
  outputSchema: z.lazy(() =>
    z.object({
      items: z.array(z.any()),
    }),
  ),
  handler: async (props, c) => {
    const { teamId } = props;

    await assertTeamResourceAccess(c.tool.name, teamId, c);

    const roles = await c.policy.getTeamRoles(teamId);
    return { items: roles };
  },
});

export const updateMemberRole = createTool({
  name: "TEAM_MEMBERS_UPDATE_ROLE",
  description: "Update a member's role in a team",
  inputSchema: z.lazy(() =>
    z.object({
      teamId: z.number(),
      userId: z.string(),
      roleId: z.number(),
      action: z.enum(["grant", "revoke"]),
    }),
  ),
  handler: async (props, c) => {
    const { teamId } = props;

    await assertTeamResourceAccess(c.tool.name, teamId, c);

    const { teamId: teamIdFromProps, userId, roleId, action } = props;

    const { data: profile } = await c.db
      .from("profiles")
      .select("email")
      .eq("user_id", userId)
      .single();

    if (!profile) throw new NotFoundError(`User with id ${userId} not found`);

    await c.policy.updateUserRole(teamIdFromProps, profile.email, {
      roleId,
      action,
    });

    return { success: true };
  },
});

export const createIssue = createTool({
  name: "TEAM_REPORT_ISSUE_CREATE",
  description: "Report a bug or idea within a team/project context",
  inputSchema: z.lazy(() =>
    z.object({
      orgSlug: z.string().optional(),
      projectSlug: z.string().optional(),
      type: z.enum(["Bug", "Idea"]),
      content: z.string().min(1),
      url: z.string().optional(),
      path: z.string().optional(),
    }),
  ),
  handler: async (props, c) => {
    c.resourceAccess.grant();
    const { orgSlug, projectSlug, type, content, url, path } = props;

    // 1. Assert user is authenticated
    assertPrincipalIsUser(c);
    const user = c.user;

    // 2. Resolve org_id if orgSlug provided and assert user membership
    let orgId: bigint | null = null;
    if (orgSlug) {
      const [org] = await c.drizzle
        .select({ id: organizations.id })
        .from(organizations)
        .innerJoin(
          members,
          and(
            eq(members.team_id, organizations.id),
            eq(members.user_id, user.id),
            isNull(members.deleted_at),
          ),
        )
        .where(eq(organizations.slug, orgSlug))
        .limit(1);

      if (!org)
        throw new Error("Organization not found or user is not a member");
      orgId = BigInt(org.id);
    }

    // 3. Resolve project_id if projectSlug provided
    let projectId: string | null = null;
    if (projectSlug && orgId) {
      const [project] = await c.drizzle
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.org_id, orgId), eq(projects.slug, projectSlug)))
        .limit(1);
      projectId = project?.id ?? null;
    }

    // 4. Insert issue
    const [issue] = await c.drizzle
      .insert(issues)
      .values({
        org_id: orgId,
        project_id: projectId,
        reporter_user_id: user.id,
        type,
        content,
        url: url ?? null,
        path: path ?? null,
      })
      .returning();

    return {
      id: issue.id,
      org_id: issue.org_id ? Number(issue.org_id) : null,
      project_id: issue.project_id,
      type: issue.type,
      content: issue.content,
      url: issue.url,
      path: issue.path,
      created_at: issue.created_at,
    };
  },
});

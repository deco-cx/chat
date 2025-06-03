import { z } from "zod";
import { NotFoundError, UserInputError } from "../../errors.ts";
import {
  assertPrincipalIsUser,
  bypass,
  canAccessTeamResource,
} from "../assertions.ts";
import { createTool } from "../context.ts";

const OWNER_ROLE_ID = 1;

export const sanitizeTeamName = (name: string): string => {
  if (!name) return "";
  const nameWithoutAccents = removeNameAccents(name);
  return nameWithoutAccents.trim().replace(/\s+/g, " ").replace(
    /[^\w\s\-.+@]/g,
    "",
  );
};

export const removeNameAccents = (name: string): string => {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

export const getTeam = createTool({
  name: "TEAMS_GET",
  description: "Get a team by slug",
  inputSchema: z.object({
    slug: z.string(),
  }),
  async canAccess(name, props, c) {
    return await canAccessTeamResource(name, props.slug, c);
  },
  handler: async (props, c) => {
    const { slug } = props;

    const { data: teamData, error } = await c
      .db
      .from("teams")
      .select("*")
      .eq("slug", slug)
      .single();

    if (error) throw error;
    if (!teamData) {
      throw new NotFoundError("Team not found or user does not have access");
    }

    return teamData;
  },
});

export const createTeam = createTool({
  name: "TEAMS_CREATE",
  description: "Create a new team",
  inputSchema: z.object({
    name: z.string(),
    slug: z.string().optional(),
    stripe_subscription_id: z.string().optional(),
  }),
  canAccess: bypass,
  /**
   * This function handle this steps:
   * 1. check if team slug already exists;
   * 2. If team slug is free ok, procceed, and create team
   * 3. Add user that made the request as team member of team with activity
   * 4. Add member role as onwer (id: 1).
   */
  handler: async (props, c) => {
    assertPrincipalIsUser(c);
    const { name, slug, stripe_subscription_id } = props;
    const user = c.user;

    // Enforce unique slug if provided
    if (slug) {
      const { data: existingTeam, error: slugError } = await c
        .db
        .from("teams")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (slugError) throw slugError;
      if (existingTeam) {
        throw new UserInputError("A team with this slug already exists.");
      }
    }

    // Create the team
    const { data: team, error: createError } = await c
      .db
      .from("teams")
      .insert([{ name: sanitizeTeamName(name), slug, stripe_subscription_id }])
      .select()
      .single();

    if (createError) throw createError;

    // Add the creator as an admin member
    const { data: member, error: memberError } = await c
      .db
      .from("members")
      .insert([
        {
          team_id: team.id,
          user_id: user.id,
          activity: [{
            action: "add_member",
            timestamp: new Date().toISOString(),
          }],
        },
      ])
      .select()
      .single();

    if (memberError) {
      await c.db.from("teams").delete().eq("id", team.id);
      throw memberError;
    }

    // Set the member's role_id to 1 in member_roles
    const { error: roleError } = await c
      .db
      .from("member_roles")
      .insert([
        {
          member_id: member.id,
          role_id: OWNER_ROLE_ID,
        },
      ]);

    if (roleError) throw roleError;

    return team;
  },
});

export const updateTeam = createTool({
  name: "TEAMS_UPDATE",
  description: "Update an existing team",
  inputSchema: z.object({
    id: z.number().describe("The id of the team to update"),
    data: z.object({
      name: z.string().optional(),
      slug: z.string().optional(),
      stripe_subscription_id: z.string().optional(),
    }),
  }),
  async canAccess(name, props, c) {
    return await canAccessTeamResource(name, props.id, c);
  },
  handler: async (props, c) => {
    const { id, data } = props;

    // TODO: check if it's required
    // Enforce unique slug if being updated
    if (data.slug) {
      const { data: existingTeam, error: slugError } = await c
        .db
        .from("teams")
        .select("id")
        .eq("slug", data.slug)
        .neq("id", id)
        .maybeSingle();
      if (slugError) throw slugError;
      if (existingTeam) {
        throw new UserInputError("A team with this slug already exists.");
      }
    }

    // Update the team
    const { data: updatedTeam, error: updateError } = await c
      .db
      .from("teams")
      .update({
        ...data,
        ...(data.name ? { name: sanitizeTeamName(data.name) } : {}),
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) throw updateError;

    return updatedTeam;
  },
});

export const deleteTeam = createTool({
  name: "TEAMS_DELETE",
  description: "Delete a team by id",
  inputSchema: z.object({
    teamId: z.number(),
  }),
  async canAccess(name, props, c) {
    return await canAccessTeamResource(name, props.teamId, c);
  },
  handler: async (props, c) => {
    const { teamId } = props;

    const members = await c.db
      .from("members")
      .select("id")
      .eq("team_id", teamId);

    const memberIds = members.data?.map((member) => Number(member.id));

    if (!memberIds) {
      return { data: null, error: "No members found" };
    }

    // TODO: delete roles, policies and role_policy
    await c.db.from("member_roles").delete().in("member_id", memberIds);
    await c.db.from("members").delete().eq("team_id", teamId);

    const { error } = await c.db.from("teams").delete().eq(
      "id",
      teamId,
    )
      .select("id");

    if (error) throw error;
    return { ok: true };
  },
});

export const listTeams = createTool({
  name: "TEAMS_LIST",
  description: "List teams for the current user",
  inputSchema: z.object({}),
  canAccess: bypass,
  handler: async (_, c) => {
    assertPrincipalIsUser(c);
    const user = c.user;

    const { data, error } = await c
      .db
      .from("teams")
      .select(`
        id,
        name,
        slug,
        created_at,
        members!inner (
          id,
          user_id,
          admin
        )
      `)
      .eq("members.user_id", user.id)
      .is("members.deleted_at", null);

    if (error) {
      console.error(error);
      throw error;
    }

    return data.map(({ members: _members, ...teamData }) => teamData);
  },
});

import { z } from "zod";
import { NotFoundError, UserInputError } from "../../errors.ts";
import {
  assertPrincipalIsUser,
  assertTeamResourceAccess,
} from "../assertions.ts";
import { type AppContext, createTool } from "../context.ts";
import type { Json } from "../../storage/index.ts";
import type { Theme } from "../../theme.ts";
import {
  getPresignedReadUrl_WITHOUT_CHECKING_AUTHORIZATION,
  getWorkspaceBucketName,
} from "../fs/api.ts";
import { mergeThemes } from "./merge-theme.ts";

const OWNER_ROLE_ID = 1;

// Enhanced theme schema with detailed context for AI tools
const themeVariablesSchema = z.object({
  "--background": z.string().optional().describe("Main background color of the application (OKLCH/hex format)"),
  "--foreground": z.string().optional().describe("Main text color on background (OKLCH/hex format)"),
  "--card": z.string().optional().describe("Background color for cards and panels (OKLCH/hex format)"),
  "--card-foreground": z.string().optional().describe("Text color on cards and panels (OKLCH/hex format)"),
  "--popover": z.string().optional().describe("Background color for popovers and dropdowns (OKLCH/hex format)"),
  "--popover-foreground": z.string().optional().describe("Text color in popovers and dropdowns (OKLCH/hex format)"),
  "--primary": z.string().optional().describe("Primary brand color for buttons and highlights (OKLCH/hex format)"),
  "--primary-foreground": z.string().optional().describe("Text color on primary elements (OKLCH/hex format)"),
  "--primary-light": z.string().optional().describe("Lighter variant of primary color (OKLCH/hex format)"),
  "--primary-dark": z.string().optional().describe("Darker variant of primary color (OKLCH/hex format)"),
  "--secondary": z.string().optional().describe("Secondary color for less prominent elements (OKLCH/hex format)"),
  "--secondary-foreground": z.string().optional().describe("Text color on secondary elements (OKLCH/hex format)"),
  "--muted": z.string().optional().describe("Muted background color for subtle elements (OKLCH/hex format)"),
  "--muted-foreground": z.string().optional().describe("Muted text color for secondary text (OKLCH/hex format)"),
  "--accent": z.string().optional().describe("Accent color for interactive elements (OKLCH/hex format)"),
  "--accent-foreground": z.string().optional().describe("Text color on accent elements (OKLCH/hex format)"),
  "--destructive": z.string().optional().describe("Color for destructive actions and errors (OKLCH/hex format)"),
  "--destructive-foreground": z.string().optional().describe("Text color on destructive elements (OKLCH/hex format)"),
  "--border": z.string().optional().describe("Border color for elements (OKLCH/hex format)"),
  "--input": z.string().optional().describe("Border color for input fields (OKLCH/hex format)"),
  "--sidebar": z.string().optional().describe("Background color for sidebar navigation (OKLCH/hex format)"),
  "--splash": z.string().optional().describe("Background color for splash screen animation (OKLCH/hex format)"),
});

const fontSchema = z.union([
  z.object({
    type: z.literal("Google Fonts").describe("Use a Google Fonts font"),
    name: z.string().describe("Name of the Google Font (e.g., 'Inter', 'Roboto', 'Open Sans')"),
  }),
  z.object({
    type: z.literal("Custom").describe("Use a custom uploaded font"),
    name: z.string().describe("Display name for the custom font"),
    url: z.string().describe("URL to the custom font file"),
  }),
]);

const enhancedThemeSchema = z.object({
  variables: themeVariablesSchema.optional().describe("CSS custom properties for theme colors. Use OKLCH format (preferred) or hex colors."),
  picture: z.string().optional().describe("URL to team avatar/logo image"),
  font: fontSchema.optional().describe("Font configuration for the workspace"),
}).describe("Theme configuration for the workspace. Only include the properties you want to change - existing values will be preserved.");

export const sanitizeTeamName = (name: string): string => {
  if (!name) return "";
  const nameWithoutAccents = removeNameAccents(name);
  return nameWithoutAccents.trim().replace(/\s+/g, " ").replace(
    /[^\w\s\-.+@]/g,
    "",
  );
};

export const getAvatarFromTheme = (
  theme: Json,
  createSignedUrl: (path: string) => Promise<string>,
): Promise<string | null> => {
  if (
    theme !== null && typeof theme === "object" && "picture" in theme &&
    typeof theme.picture === "string"
  ) {
    const picture = theme.picture as string;
    return createSignedUrl(picture).catch((error) => {
      console.error("Error getting avatar from theme", error);
      return null;
    });
  }
  return Promise.resolve(null);
};

export const removeNameAccents = (name: string): string => {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

export const buildSignedUrlCreator = ({
  c,
  existingBucketName,
}: {
  c: AppContext;
  existingBucketName: string;
}) => {
  return (path: string) => {
    // Team avatars are ok to be public
    return getPresignedReadUrl_WITHOUT_CHECKING_AUTHORIZATION({
      c,
      path,
      existingBucketName,
      expiresIn: 180,
    });
  };
};

export const getTeam = createTool({
  name: "TEAMS_GET",
  description: "Get a team by slug",
  inputSchema: z.object({
    slug: z.string(),
  }),
  handler: async (props, c) => {
    const { slug } = props;

    await assertTeamResourceAccess(c.tool.name, slug, c);

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

    try {
      const workspace = `/shared/${slug}`;
      const signedUrlCreator = buildSignedUrlCreator({
        c,
        existingBucketName: getWorkspaceBucketName(workspace),
      });
      return {
        ...teamData,
        avatar_url: await getAvatarFromTheme(teamData.theme, signedUrlCreator),
      };
    } catch (error) {
      console.error("Error getting signed url creator", error);
      return {
        ...teamData,
        avatar_url: null,
      };
    }
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

  /**
   * This function handle this steps:
   * 1. check if team slug already exists;
   * 2. If team slug is free ok, procceed, and create team
   * 3. Add user that made the request as team member of team with activity
   * 4. Add member role as onwer (id: 1).
   */
  handler: async (props, c) => {
    c.resourceAccess.grant();

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
  description: "Update an existing team including theme customization",
  inputSchema: z.object({
    id: z.number().describe("The id of the team to update"),
    data: z.object({
      name: z.string().optional().describe("Team name"),
      slug: z.string().optional().describe("Team URL slug"),
      stripe_subscription_id: z.string().optional(),
      theme: enhancedThemeSchema.optional(),
    }),
  }),
  handler: async (props, c) => {
    const { id, data } = props;

    await assertTeamResourceAccess(c.tool.name, id, c);

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

    // Get current team data to merge theme
    const { data: currentTeam, error: getError } = await c
      .db
      .from("teams")
      .select("theme")
      .eq("id", id)
      .single();

    if (getError) throw getError;

    const mergedTheme = mergeThemes(currentTeam.theme, data.theme);

    // Update the team
    const { data: updatedTeam, error: updateError } = await c
      .db
      .from("teams")
      .update({
        ...data,
        ...(data.name ? { name: sanitizeTeamName(data.name) } : {}),
        ...(mergedTheme ? { theme: mergedTheme as Json } : {}),
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) throw updateError;

    const workspace = `/shared/${updatedTeam.slug}`;
    const signedUrlCreator = buildSignedUrlCreator({
      c,
      existingBucketName: getWorkspaceBucketName(workspace),
    });

    return {
      ...updatedTeam,
      avatar_url: await getAvatarFromTheme(updatedTeam.theme, signedUrlCreator),
    };
  },
});

export const setTeamTheme = createTool({
  name: "SET_TEAM_THEME",
  description: "Set or update the theme for a team workspace. This tool provides comprehensive theme customization with detailed schema context for AI operations.",
  inputSchema: z.object({
    teamId: z.number().describe("The ID of the team to update the theme for"),
    theme: enhancedThemeSchema.describe("Theme configuration. Only specify the properties you want to change - existing values will be preserved through theme merging."),
  }),
  handler: async (props, c) => {
    const { teamId, theme } = props;

    await assertTeamResourceAccess(c.tool.name, teamId, c);

    // Get current team data to merge theme
    const { data: currentTeam, error: getError } = await c
      .db
      .from("teams")
      .select("theme, slug")
      .eq("id", teamId)
      .single();

    if (getError) throw getError;

    const mergedTheme = mergeThemes(currentTeam.theme, theme);

    // Update the team theme
    const { data: updatedTeam, error: updateError } = await c
      .db  
      .from("teams")
      .update({ theme: mergedTheme as Json })
      .eq("id", teamId)
      .select()
      .single();

    if (updateError) throw updateError;

    const workspace = `/shared/${updatedTeam.slug}`;
    const signedUrlCreator = buildSignedUrlCreator({
      c,
      existingBucketName: getWorkspaceBucketName(workspace),
    });

    return {
      success: true,
      message: "Theme updated successfully",
      theme: updatedTeam.theme,
      avatar_url: await getAvatarFromTheme(updatedTeam.theme, signedUrlCreator),
    };
  },
});

export const deleteTeam = createTool({
  name: "TEAMS_DELETE",
  description: "Delete a team by id",
  inputSchema: z.object({
    teamId: z.number(),
  }),
  handler: async (props, c) => {
    const { teamId } = props;

    await assertTeamResourceAccess(c.tool.name, teamId, c);

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
    return { success: true };
  },
});

export const listTeams = createTool({
  name: "TEAMS_LIST",
  description: "List teams for the current user",
  inputSchema: z.object({}),
  handler: async (_, c) => {
    c.resourceAccess.grant();

    assertPrincipalIsUser(c);
    const user = c.user;

    const { data, error } = await c
      .db
      .from("teams")
      .select(`
        id,
        name,
        slug,
        theme,
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

    const teamsWithoutAvatar = data.map(({ members: _members, ...teamData }) =>
      teamData
    );

    const teamsWithAvatar = await Promise.all(
      teamsWithoutAvatar.map(async (team) => {
        const signedUrlCreator = buildSignedUrlCreator({
          c,
          existingBucketName: getWorkspaceBucketName(`/shared/${team.slug}`),
        });
        return {
          ...team,
          avatar_url: await getAvatarFromTheme(team.theme, signedUrlCreator),
        };
      }),
    );

    return teamsWithAvatar;
  },
});

export const getWorkspaceTheme = createTool({
  name: "TEAMS_GET_THEME",
  description: "Get the theme for a workspace",
  inputSchema: z.object({
    slug: z.string(),
  }),
  handler: async (props, c) => {
    c.resourceAccess.grant();
    const { slug } = props;

    const { data: team, error } = await c.db.from("teams").select("theme").eq(
      "slug",
      slug,
    ).maybeSingle();

    if (error) throw error;

    const _theme = team?.theme as Theme | null;

    if (!_theme || typeof _theme !== "object") {
      return { theme: {} };
    }

    const signedUrlCreator = buildSignedUrlCreator({
      c,
      existingBucketName: getWorkspaceBucketName(`/shared/${slug}`),
    });

    const theme = {
      ..._theme,
      picture: _theme?.picture
        ? await getAvatarFromTheme(_theme as Json, signedUrlCreator)
        : undefined,
    };
    return { theme };
  },
});

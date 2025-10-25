import { z } from "zod";
import type { Json } from "../../storage/index.ts";
import type { Theme } from "../../theme.ts";
import {
  assertHasLocator,
  assertHasWorkspace,
  assertTeamResourceAccess,
  assertWorkspaceResourceAccess,
} from "../assertions.ts";
import type { AppContext } from "../context.ts";
import { createToolGroup } from "../context.ts";
import { mergeThemes } from "../teams/merge-theme.ts";
import { organizations } from "../schema.ts";
import { eq } from "drizzle-orm";
import { getOrgIdFromContext } from "../projects/util.ts";

// Enhanced theme schema with detailed context for AI tools
const themeVariablesSchema = z.object({
  "--background": z
    .string()
    .optional()
    .describe("Main background color of the application (OKLCH/hex format)"),
  "--foreground": z
    .string()
    .optional()
    .describe("Main text color on background (OKLCH/hex format)"),
  "--card": z
    .string()
    .optional()
    .describe("Background color for cards and panels (OKLCH/hex format)"),
  "--card-foreground": z
    .string()
    .optional()
    .describe("Text color on cards and panels (OKLCH/hex format)"),
  "--popover": z
    .string()
    .optional()
    .describe("Background color for popovers and dropdowns (OKLCH/hex format)"),
  "--popover-foreground": z
    .string()
    .optional()
    .describe("Text color in popovers and dropdowns (OKLCH/hex format)"),
  "--primary": z
    .string()
    .optional()
    .describe(
      "Primary brand color for buttons and highlights (OKLCH/hex format)",
    ),
  "--primary-foreground": z
    .string()
    .optional()
    .describe("Text color on primary elements (OKLCH/hex format)"),
  "--primary-light": z
    .string()
    .optional()
    .describe("Lighter variant of primary color (OKLCH/hex format)"),
  "--primary-dark": z
    .string()
    .optional()
    .describe("Darker variant of primary color (OKLCH/hex format)"),
  "--secondary": z
    .string()
    .optional()
    .describe("Secondary color for less prominent elements (OKLCH/hex format)"),
  "--secondary-foreground": z
    .string()
    .optional()
    .describe("Text color on secondary elements (OKLCH/hex format)"),
  "--muted": z
    .string()
    .optional()
    .describe("Muted background color for subtle elements (OKLCH/hex format)"),
  "--muted-foreground": z
    .string()
    .optional()
    .describe("Muted text color for secondary text (OKLCH/hex format)"),
  "--accent": z
    .string()
    .optional()
    .describe("Accent color for interactive elements (OKLCH/hex format)"),
  "--accent-foreground": z
    .string()
    .optional()
    .describe("Text color on accent elements (OKLCH/hex format)"),
  "--destructive": z
    .string()
    .optional()
    .describe("Color for destructive actions and errors (OKLCH/hex format)"),
  "--destructive-foreground": z
    .string()
    .optional()
    .describe("Text color on destructive elements (OKLCH/hex format)"),
  "--success": z
    .string()
    .optional()
    .describe(
      "Color for success states and positive actions (OKLCH/hex format)",
    ),
  "--success-foreground": z
    .string()
    .optional()
    .describe("Text color on success elements (OKLCH/hex format)"),
  "--warning": z
    .string()
    .optional()
    .describe(
      "Color for warning states and caution indicators (OKLCH/hex format)",
    ),
  "--warning-foreground": z
    .string()
    .optional()
    .describe("Text color on warning elements (OKLCH/hex format)"),
  "--border": z
    .string()
    .optional()
    .describe("Border color for elements (OKLCH/hex format)"),
  "--input": z
    .string()
    .optional()
    .describe("Border color for input fields (OKLCH/hex format)"),
  "--sidebar": z
    .string()
    .optional()
    .describe("Background color for sidebar navigation (OKLCH/hex format)"),
  "--sidebar-foreground": z
    .string()
    .optional()
    .describe("Text color in sidebar navigation (OKLCH/hex format)"),
  "--sidebar-accent": z
    .string()
    .optional()
    .describe(
      "Accent background color for sidebar elements (OKLCH/hex format)",
    ),
  "--sidebar-accent-foreground": z
    .string()
    .optional()
    .describe("Text color on sidebar accent elements (OKLCH/hex format)"),
  "--sidebar-border": z
    .string()
    .optional()
    .describe("Border color for sidebar elements (OKLCH/hex format)"),
  "--sidebar-ring": z
    .string()
    .optional()
    .describe("Focus ring color for sidebar elements (OKLCH/hex format)"),
  "--splash": z
    .string()
    .optional()
    .describe(
      "Background color for splash screen animation (OKLCH/hex format)",
    ),
});

const fontSchema = z.union([
  z.object({
    type: z.literal("Google Fonts").describe("Use a Google Fonts font"),
    name: z
      .string()
      .describe(
        "Name of the Google Font (e.g., 'Inter', 'Roboto', 'Open Sans')",
      ),
  }),
  z.object({
    type: z.literal("Custom").describe("Use a custom uploaded font"),
    name: z.string().describe("Display name for the custom font"),
    url: z.string().describe("URL to the custom font file"),
  }),
]);

const enhancedThemeSchema = z
  .object({
    variables: themeVariablesSchema
      .optional()
      .describe(
        "CSS custom properties for theme colors. Use OKLCH format (preferred) or hex colors.",
      ),
    picture: z.string().optional().describe("URL to team avatar/logo image"),
    font: fontSchema
      .optional()
      .describe("Font configuration for the workspace"),
  })
  .describe(
    "Theme configuration for the workspace. Only include the properties you want to change - existing values will be preserved.",
  );

// Register the Theme tools under a dedicated group id so they surface as integration id `i:theme-management`
export const createTool = createToolGroup("Theme", {
  name: "Theme Management",
  description: "Manage organization-level themes and workspace branding.",
  icon: "https://assets.decocache.com/mcp/42dcf0d2-5a2f-4d50-87a6-0e9ebaeae9b5/Agent-Setup.png",
});

const THEME_FILE_PATH = "/theme.json";

// Project-level theme tools disabled until project themes are fully implemented
/* 
export const getProjectTheme = createTool({
  name: "THEME_GET_PROJECT",
  description:
    "Get the project-level theme from deconfig. Returns null if no project theme is set.",
  inputSchema: z.object({
    projectId: z
      .string()
      .optional()
      .describe("Project ID to get theme from. Defaults to current project."),
  }),
  handler: async (props, c) => {
    assertHasWorkspace(c);
    assertHasLocator(c);
    await assertWorkspaceResourceAccess(c);

    const projectId = props.projectId || c.locator?.value;
    if (!projectId) {
      throw new Error("No project ID available");
    }

    try {
      // Try to read theme from deconfig
      const branchStub = c.branchDO.get(
        c.branchDO.idFromName(`main:${projectId}`),
      );

      const file = await branchStub.getFile(THEME_FILE_PATH);
      if (!file) {
        return null;
      }

      const content = await file.text();
      const theme = JSON.parse(content) as Theme;

      return theme;
    } catch (error) {
      // File doesn't exist or is invalid
      return null;
    }
  },
});

export const updateProjectTheme = createTool({
  name: "THEME_UPDATE_PROJECT",
  description:
    "Update the project-level theme in deconfig. Merges with existing theme.",
  inputSchema: z.object({
    projectId: z
      .string()
      .optional()
      .describe("Project ID to update theme for. Defaults to current project."),
    theme: enhancedThemeSchema.describe("Theme configuration to apply"),
  }),
  handler: async (props, c) => {
    assertHasWorkspace(c);
    assertHasLocator(c);
    await assertWorkspaceResourceAccess(c);

    const projectId = props.projectId || c.locator?.value;
    if (!projectId) {
      throw new Error("No project ID available");
    }

    const branchStub = c.branchDO.get(
      c.branchDO.idFromName(`main:${projectId}`),
    );

    // Get existing theme to merge
    let existingTheme: Theme | null = null;
    try {
      const file = await branchStub.getFile(THEME_FILE_PATH);
      if (file) {
        const content = await file.text();
        existingTheme = JSON.parse(content) as Theme;
      }
    } catch {
      // File doesn't exist, will create new
    }

    // Merge themes
    const mergedTheme = mergeThemes(
      existingTheme as Json,
      props.theme,
    ) as Theme;

    // Write to deconfig
    const themeContent = JSON.stringify(mergedTheme, null, 2);
    await branchStub.writeFile(
      THEME_FILE_PATH,
      new TextEncoder().encode(themeContent),
    );

    return mergedTheme;
  },
});
*/

export const getOrgTheme = createTool({
  name: "THEME_GET_ORG",
  description:
    "Get the organization-level theme from database. Uses current workspace organization if orgId not provided.",
  inputSchema: z.object({
    orgId: z
      .number()
      .optional()
      .describe(
        "Organization ID to get theme from. Defaults to current workspace organization.",
      ),
  }),
  outputSchema: z.object({
    theme: enhancedThemeSchema.nullable(),
  }),
  handler: async (props, c) => {
    // Get orgId from context if not provided
    const orgId = props.orgId ?? (await getOrgIdFromContext(c));

    if (!orgId) {
      throw new Error("No organization context available");
    }

    // Use org slug for permission check (authorization expects slug, not ID)
    const orgSlug = c.locator?.org;
    if (!orgSlug) {
      throw new Error("No organization slug in context");
    }

    // Use TEAMS_GET permission since reading org theme is part of team info
    await assertTeamResourceAccess("TEAMS_GET", orgSlug, c);

    const result = await c.drizzle
      .select({ theme: organizations.theme })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    if (!result || result.length === 0) {
      return { theme: null };
    }

    return { theme: (result[0].theme as Theme) || null };
  },
});

export const updateOrgTheme = createTool({
  name: "THEME_UPDATE_ORG",
  description:
    "Update the organization-level theme in database. Merges with existing theme. Uses current workspace organization if orgId not provided.",
  inputSchema: z.object({
    orgId: z
      .number()
      .optional()
      .describe(
        "Organization ID to update theme for. Defaults to current workspace organization.",
      ),
    theme: enhancedThemeSchema.describe("Theme configuration to apply"),
  }),
  outputSchema: z.object({
    theme: enhancedThemeSchema,
  }),
  handler: async (props, c) => {
    console.log(
      "[THEME_UPDATE_ORG] Context locator:",
      JSON.stringify(c.locator),
    );
    console.log("[THEME_UPDATE_ORG] Props orgId:", props.orgId);

    // Get orgId from context if not provided
    const orgId = props.orgId ?? (await getOrgIdFromContext(c));

    console.log("[THEME_UPDATE_ORG] Resolved orgId:", orgId);

    if (!orgId) {
      throw new Error(
        `No organization context available. Locator: ${JSON.stringify(c.locator)}`,
      );
    }

    // Use org slug for permission check (authorization expects slug, not ID)
    const orgSlug = c.locator?.org;
    if (!orgSlug) {
      throw new Error("No organization slug in context");
    }

    console.log("[THEME_UPDATE_ORG] Using orgSlug for permissions:", orgSlug);

    // Use TEAMS_UPDATE permission since updating org theme is part of team management
    await assertTeamResourceAccess("TEAMS_UPDATE", orgSlug, c);

    console.log("[THEME_UPDATE_ORG] Updating org theme for orgId:", orgId);

    // Get current theme to merge
    const currentResult = await c.drizzle
      .select({ theme: organizations.theme })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    if (!currentResult || currentResult.length === 0) {
      throw new Error("Organization not found");
    }

    const currentTheme = currentResult[0].theme as Json | null;
    console.log(
      "[THEME_UPDATE_ORG] Current theme:",
      JSON.stringify(currentTheme),
    );

    const mergedTheme = mergeThemes(currentTheme, props.theme);
    console.log(
      "[THEME_UPDATE_ORG] Merged theme:",
      JSON.stringify(mergedTheme),
    );

    // Update the organization and return the updated record
    const updatedResult = await c.drizzle
      .update(organizations)
      .set({ theme: mergedTheme as Json })
      .where(eq(organizations.id, orgId))
      .returning({ theme: organizations.theme });

    console.log(
      "[THEME_UPDATE_ORG] Database update result:",
      JSON.stringify(updatedResult),
    );

    if (!updatedResult || updatedResult.length === 0) {
      throw new Error("Failed to update organization theme");
    }

    return { theme: updatedResult[0].theme as Theme };
  },
});

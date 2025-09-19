/**
 * Helper functions for workspace to project/org ID resolution
 * These functions help migrate from workspace strings to foreign key references
 */

import type { QueryResult } from "../storage/supabase/client.ts";
import { InternalServerError, NotFoundError } from "../errors.ts";
import type { ProjectLocator } from "../locator.ts";

export interface ProjectOrgIds {
  projectId: string;
  orgId: number;
}

export interface WorkspaceContext {
  workspace?: {
    value: string;
    root: string;
    slug: string;
  };
  locator?: {
    org: string;
    project: string;
    value: string;
  };
}

/**
 * Resolve project and org IDs from locator information
 * This is the preferred method going forward
 */
export async function resolveProjectOrgIds(
  db: any, // Supabase client type
  locator: { org: string; project: string },
): Promise<ProjectOrgIds> {
  // First get the org ID from the team slug
  const { data: team, error: teamError } = await db
    .from("teams")
    .select("id")
    .eq("slug", locator.org)
    .single();

  if (teamError) {
    throw new InternalServerError(
      `Failed to find organization: ${teamError.message}`,
    );
  }

  if (!team) {
    throw new NotFoundError(`Organization '${locator.org}' not found`);
  }

  // Then get the project ID from the project slug within that org
  const { data: project, error: projectError } = await db
    .from("deco_chat_projects")
    .select("id")
    .eq("slug", locator.project)
    .eq("org_id", team.id)
    .single();

  if (projectError) {
    throw new InternalServerError(
      `Failed to find project: ${projectError.message}`,
    );
  }

  if (!project) {
    throw new NotFoundError(
      `Project '${locator.project}' not found in organization '${locator.org}'`,
    );
  }

  return {
    projectId: project.id,
    orgId: team.id,
  };
}

/**
 * Legacy: Resolve project and org IDs from workspace string
 * This is for backward compatibility during migration
 * @deprecated Use resolveProjectOrgIds with locator instead
 */
export async function resolveProjectOrgIdsFromWorkspace(
  db: any, // Supabase client type
  workspace: string,
): Promise<ProjectOrgIds> {
  const normalized = workspace.startsWith("/") ? workspace.slice(1) : workspace;
  const [root, slug] = normalized.split("/");

  if (root === "users") {
    // Legacy /users/{userId} format - find user's personal project
    const { data: user, error: userError } = await db
      .from("auth.users")
      .select("id")
      .eq("id", slug)
      .single();

    if (userError || !user) {
      throw new NotFoundError(`User '${slug}' not found`);
    }

    // Find the team for this user (assuming personal workspace)
    const { data: teamMember, error: memberError } = await db
      .from("team_members")
      .select("team_id, teams!inner(id, slug)")
      .eq("user_id", user.id)
      .single();

    if (memberError || !teamMember) {
      throw new NotFoundError(`No team found for user '${slug}'`);
    }

    // Find the personal project
    const { data: project, error: projectError } = await db
      .from("deco_chat_projects")
      .select("id")
      .eq("slug", "personal")
      .eq("org_id", teamMember.team_id)
      .single();

    if (projectError || !project) {
      throw new NotFoundError(`Personal project not found for user '${slug}'`);
    }

    return {
      projectId: project.id,
      orgId: teamMember.team_id,
    };
  } else if (root === "shared") {
    // Legacy /shared/{orgSlug} format
    const { data: team, error: teamError } = await db
      .from("teams")
      .select("id")
      .eq("slug", slug)
      .single();

    if (teamError || !team) {
      throw new NotFoundError(`Organization '${slug}' not found`);
    }

    // Find the default/first project for this org
    const { data: project, error: projectError } = await db
      .from("deco_chat_projects")
      .select("id")
      .eq("org_id", team.id)
      .order("created_at", { ascending: true })
      .single();

    if (projectError || !project) {
      throw new NotFoundError(`No project found for organization '${slug}'`);
    }

    return {
      projectId: project.id,
      orgId: team.id,
    };
  } else {
    // New /{org}/{project} format
    return resolveProjectOrgIds(db, { org: root, project: slug });
  }
}

/**
 * Smart resolver that uses locator when available, falls back to workspace
 * This is the transition helper during migration
 */
export async function smartResolveProjectOrgIds(
  db: any,
  context: WorkspaceContext,
): Promise<ProjectOrgIds> {
  if (context.locator) {
    // Use the new locator-based resolution
    return resolveProjectOrgIds(db, context.locator);
  } else if (context.workspace) {
    // Fall back to workspace string parsing
    return resolveProjectOrgIdsFromWorkspace(db, context.workspace.value);
  } else {
    throw new InternalServerError(
      "No workspace or locator information available",
    );
  }
}

/**
 * Create database query filters using project/org IDs instead of workspace
 */
export function createProjectOrgFilter(ids: ProjectOrgIds) {
  return {
    project_id: ids.projectId,
    org_id: ids.orgId,
  };
}

/**
 * Create backward-compatible query that tries foreign keys first, falls back to workspace
 * Use this during transition period
 */
export function createTransitionQuery(
  query: any,
  ids: ProjectOrgIds,
  workspaceValue?: string,
) {
  // During transition, we'll use OR logic to match either the new foreign keys
  // or the old workspace string, ensuring we find records regardless of migration status
  if (workspaceValue) {
    return query.or(
      `and(project_id.eq.${ids.projectId},org_id.eq.${ids.orgId}),workspace.eq.${workspaceValue}`,
    );
  } else {
    // If no workspace fallback, just use foreign keys
    return query.eq("project_id", ids.projectId).eq("org_id", ids.orgId);
  }
}

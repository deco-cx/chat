import { and, eq } from "drizzle-orm";
import { organizations, projects } from "../schema";
import { AppContext } from "../context";
import { assertHasWorkspace } from "../assertions";

export async function getProjectIdFromContext(
  c: AppContext,
): Promise<string | null> {
  if (!c.locator?.project) {
    return null;
  }
  const project = await c.drizzle
    .select({
      id: projects.id,
    })
    .from(projects)
    .leftJoin(organizations, eq(projects.org_id, organizations.id))
    .where(
      and(
        eq(projects.slug, c.locator.project),
        eq(organizations.slug, c.locator.org),
      ),
    )
    .limit(1)
    .then((r) => r[0]);
  return project?.id ?? null;
}

export async function getOrgIdFromContext(
  c: AppContext,
): Promise<number | null> {
  if (!c.locator?.org) {
    return null;
  }
  const org = await c.drizzle
    .select()
    .from(organizations)
    .where(eq(organizations.slug, c.locator?.org))
    .limit(1)
    .then((r) => r[0]);
  return org?.id ?? null;
}

export function buildWorkspaceOrProjectIdConditions(
  workspace: string,
  projectId: string | null,
): string {
  const orConditions = [`workspace.eq.${workspace}`];
  if (projectId !== null) {
    orConditions.push(`project_id.eq.${projectId}`);
  }
  return orConditions.join(",");
}

/**
 * Supabase OR condition that filters by workspace or project id.
 * Used temporarily for the migration to the new schema. Soon will be removed in favor of
 * always using the project locator.
 *
 * Also is kinda bad doing 2 queries
 */
export async function workspaceOrProjectIdConditions(
  c: AppContext,
): Promise<string> {
  assertHasWorkspace(c);
  const projectId = await getProjectIdFromContext(c);
  return buildWorkspaceOrProjectIdConditions(c.workspace.value, projectId);
}

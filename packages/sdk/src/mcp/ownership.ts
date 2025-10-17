import { PgTableWithColumns } from "drizzle-orm/pg-core";
import { AppContext } from "./context.ts";
import { assertHasWorkspace, assertHasLocator } from "./assertions.ts";
import { projects, organizations } from "./schema.ts";
import { eq, or, and } from "drizzle-orm";
import { getProjectIdFromContext } from "./projects/util.ts";

export function filterByWorkspaceOrLocator<TableName extends string>({
  table,
  ctx,
}: {
  table: PgTableWithColumns<{
    name: TableName;
    dialect: "pg";
    schema: undefined;
    // deno-lint-ignore no-explicit-any
    columns: any;
  }>;
  ctx: Pick<AppContext, "workspace" | "locator">;
}) {
  assertHasWorkspace(ctx);
  assertHasLocator(ctx);
  const { workspace, locator } = ctx;

  const locatorCondition = and(
    eq(projects.slug, locator.project),
    eq(organizations.slug, locator.org),
  );

  if (locator.project !== "default" && locator.project !== "personal") {
    return locatorCondition;
  }

  return or(eq(table.workspace, workspace.value), locatorCondition);
}

/**
 * Creates a filter condition for operations that cannot use joins (like delete/update).
 * Internally fetches the project ID (if not provided) and returns a simple OR condition on workspace or project_id.
 * For non-default/personal projects, only returns the project_id condition without workspace.
 * No table joins required.
 */
export async function filterByWorkspaceOrProjectId<TableName extends string>({
  table,
  ctx,
  projectId,
}: {
  table: PgTableWithColumns<{
    name: TableName;
    dialect: "pg";
    schema: undefined;
    // deno-lint-ignore no-explicit-any
    columns: any;
  }>;
  ctx: Pick<AppContext, "workspace" | "locator">;
  projectId?: string | null;
}) {
  assertHasWorkspace(ctx);
  assertHasLocator(ctx);
  const actualProjectId =
    projectId ?? (await getProjectIdFromContext(ctx as AppContext));
  const workspace = ctx.workspace.value;
  const { locator } = ctx;

  // For non-default/personal projects, only filter by project_id
  if (locator.project !== "default" && locator.project !== "personal") {
    return actualProjectId ? eq(table.project_id, actualProjectId) : undefined;
  }

  // For default/personal projects, allow both workspace and project_id
  return or(
    eq(table.workspace, workspace),
    actualProjectId ? eq(table.project_id, actualProjectId) : undefined,
  );
}

import { PgSelect } from "drizzle-orm/pg-core";
import { PgTableWithColumns } from "drizzle-orm/pg-core";
import { AppContext } from "./context.ts";
import { assertHasWorkspace, assertHasLocator } from "./assertions.ts";
import { projects, organizations, agents } from "./schema.ts";
import { eq, or, and } from "drizzle-orm";

/**
 * Adds ownership checking to an agent query.
 * Curently filters by workspace or project locator.
 * also adds a join to projects and organizations.
 * usable for any table that has a workspace and project_id column.
 */
export function withOwnershipChecking<
  T extends PgSelect,
  Name extends string,
  Cols extends {
    workspace: (typeof agents)["workspace"];
    project_id: (typeof agents)["project_id"];
  },
>({
  query,
  table,
  ctx,
}: {
  query: T;
  table: PgTableWithColumns<{
    name: Name;
    dialect: "pg";
    schema: undefined;
    columns: Cols;
  }>;
  ctx: AppContext;
}) {
  assertHasWorkspace(ctx);
  assertHasLocator(ctx);
  const { workspace, locator } = ctx;

  return query
    .innerJoin(projects, eq(table.project_id, projects.id))
    .innerJoin(organizations, eq(projects.org_id, organizations.id))
    .where(
      or(
        eq(table.workspace, workspace.value),
        and(
          eq(projects.slug, locator.project),
          eq(organizations.slug, locator.org),
        ),
      ),
    );
}

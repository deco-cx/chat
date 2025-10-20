import { PgTableWithColumns } from "drizzle-orm/pg-core";
import { AppContext } from "./context.ts";
import { assertHasWorkspace, assertHasLocator } from "./assertions.ts";
import { projects, organizations } from "./schema.ts";
import { eq, or, and } from "drizzle-orm";

export function filterByWorkspaceOrLocator<TableName extends string>({
  table,
  ctx,
}: {
  table: PgTableWithColumns<{
    name: TableName;
    dialect: "pg";
    schema: undefined;
    // oxlint-disable-next-line no-explicit-any
    columns: any;
  }>;
  ctx: AppContext;
}) {
  assertHasWorkspace(ctx);
  assertHasLocator(ctx);
  const { workspace, locator } = ctx;

  return or(
    eq(table.workspace, workspace.value),
    and(
      eq(projects.slug, locator.project),
      eq(organizations.slug, locator.org),
    ),
  );
}

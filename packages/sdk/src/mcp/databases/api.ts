import z from "zod";
import { workspaceDB } from "../context.ts";
import { assertHasWorkspace, assertWorkspaceResourceAccess } from "../index.ts";
import { createDatabaseTool } from "./tool.ts";

export { getWorkspaceD1Database } from "./d1.ts";
export { migrate } from "./migration.ts";

const Timings = z.object({
  sql_duration_ms: z.number().optional(),
});

const Meta = z.object({
  changed_db: z.boolean().optional(),
  changes: z.number().optional(),
  duration: z.number().optional(),
  last_row_id: z.number().optional(),
  rows_read: z.number().optional(),
  rows_written: z.number().optional(),
  served_by_primary: z.boolean().optional(),
  served_by_region: z
    .enum(["WNAM", "ENAM", "WEUR", "EEUR", "APAC", "OC"])
    .optional(),
  size_after: z.number().optional(),
  timings: Timings.optional(),
});

const QueryResult = z.object({
  meta: Meta.optional(),
  results: z.array(z.unknown()).optional(),
  success: z.boolean().optional(),
});
export type QueryResult = z.infer<typeof QueryResult>;
export const DatatabasesRunSqlInputSchema = z.object({
  sql: z.string().describe("The SQL query to run"),
  params: z
    .array(z.any())
    .describe("The parameters to pass to the SQL query")
    .optional(),
});

export type DatatabasesRunSqlInput = z.infer<
  typeof DatatabasesRunSqlInputSchema
>;

export const runSql = createDatabaseTool({
  name: "DATABASES_RUN_SQL",
  description: "Run a SQL query against the workspace database",
  inputSchema: DatatabasesRunSqlInputSchema.extend({
    _legacy: z
      .boolean()
      .optional()
      .describe("If true, the query will be run against the legacy database"),
  }),
  outputSchema: z.object({
    result: z.array(QueryResult),
  }),
  handler: async ({ sql, params, _legacy }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess({ resource: c.tool.name }, c);
    const db = await workspaceDB(c, _legacy);

    using responseDO = await db.exec({
      sql,
      params,
    });
    return { result: responseDO.result };
  },
});

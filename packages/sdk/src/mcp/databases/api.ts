import z from "zod/v3";
import { listViewsSchema } from "../bindings/views.ts";
import { workspaceDB } from "../context.ts";
import { assertHasWorkspace, assertWorkspaceResourceAccess } from "../index.ts";
import { createDatabaseTool } from "./tool.ts";
import { WellKnownMcpGroups } from "../groups.ts";

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

export const getMeta = createDatabaseTool({
  name: "DATABASES_GET_META",
  description: "Run a SQL query against the workspace database",
  inputSchema: z.lazy(() =>
    z.object({
      _legacy: z
        .boolean()
        .optional()
        .describe("If true, the query will be run against the legacy database"),
    }),
  ),
  outputSchema: z.lazy(() =>
    z.object({
      bytes: z.number().optional(),
    }),
  ),
  handler: async ({ _legacy }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c, "DATABASES_RUN_SQL");
    const db = await workspaceDB(c, _legacy);
    const dbMeta = await db.meta?.();
    dbMeta?.[Symbol.dispose]();
    return { bytes: dbMeta?.size };
  },
});

const MASTRA_CREATE_TABLE_SQLs: Record<string, boolean> = {
  "CREATE TABLE IF NOT EXISTS mastra_resources (id TEXT NOT NULL PRIMARY KEY, workingMemory TEXT, metadata TEXT, createdAt TIMESTAMP NOT NULL, updatedAt TIMESTAMP NOT NULL)": true,
  "CREATE TABLE IF NOT EXISTS mastra_scorers (id TEXT NOT NULL PRIMARY KEY, scorerId TEXT, traceId TEXT, runId TEXT, scorer TEXT, extractStepResult TEXT, analyzeStepResult TEXT, score FLOAT, reason TEXT, metadata TEXT, extractPrompt TEXT, analyzePrompt TEXT, reasonPrompt TEXT, input TEXT, output TEXT, additionalContext TEXT, runtimeContext TEXT, entityType TEXT, entity TEXT, entityId TEXT, source TEXT, resourceId TEXT, threadId TEXT, createdAt TIMESTAMP, updatedAt TIMESTAMP)": true,
  "CREATE TABLE IF NOT EXISTS mastra_traces (id TEXT NOT NULL PRIMARY KEY, parentSpanId TEXT, name TEXT NOT NULL, traceId TEXT NOT NULL, scope TEXT NOT NULL, kind INTEGER NOT NULL, attributes TEXT, status TEXT, events TEXT, links TEXT, other TEXT, startTime INTEGER NOT NULL, endTime INTEGER NOT NULL, createdAt TIMESTAMP NOT NULL)": true,
  "CREATE TABLE IF NOT EXISTS mastra_messages (id TEXT NOT NULL PRIMARY KEY, thread_id TEXT NOT NULL, content TEXT NOT NULL, role TEXT NOT NULL, type TEXT NOT NULL, createdAt TIMESTAMP NOT NULL, resourceId TEXT)": true,
  "CREATE TABLE IF NOT EXISTS mastra_threads (id TEXT NOT NULL PRIMARY KEY, resourceId TEXT NOT NULL, title TEXT NOT NULL, metadata TEXT, createdAt TIMESTAMP NOT NULL, updatedAt TIMESTAMP NOT NULL)": true,
  "CREATE TABLE IF NOT EXISTS mastra_evals (input TEXT, output TEXT, result TEXT, agent_name TEXT, metric_name TEXT, instructions TEXT, test_info TEXT, global_run_id TEXT, run_id TEXT, created_at TIMESTAMP, createdAt TIMESTAMP)": true,
  "CREATE TABLE IF NOT EXISTS mastra_workflow_snapshot (workflow_name TEXT, run_id TEXT, resourceId TEXT, snapshot TEXT, createdAt TIMESTAMP, updatedAt TIMESTAMP, UNIQUE (workflow_name, run_id))": true,
};

const CREATED: Map<string, boolean> = new Map();

export const runSql = createDatabaseTool({
  name: "DATABASES_RUN_SQL",
  description: "Run a SQL query against the workspace database",
  inputSchema: DatatabasesRunSqlInputSchema.extend({
    _legacy: z
      .boolean()
      .optional()
      .describe("If true, the query will be run against the legacy database"),
  }),
  outputSchema: z.lazy(() =>
    z.object({
      result: z.array(QueryResult),
    }),
  ),
  handler: async ({ sql, params, _legacy }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);
    const sqlKey = `${sql}:${c.workspace.value}`;
    const isMastraCreateTableSql = MASTRA_CREATE_TABLE_SQLs[sql];
    // optimization: if the sql is a mastra create table sql and the table has already been created, skip the query
    if (isMastraCreateTableSql && CREATED.has(sqlKey)) {
      return { result: [] };
    }
    const db = await workspaceDB(c, _legacy);
    using responseDO = await db.exec({
      sql,
      params,
    });
    isMastraCreateTableSql && CREATED.set(sqlKey, true);
    return { result: responseDO.result };
  },
});

export const recovery = createDatabaseTool({
  name: "DATABASES_RECOVERY",
  description: "Run a SQL query against the workspace database",
  inputSchema: z.lazy(() =>
    z.object({
      date: z.string().describe("The date to recover to"),
      _legacy: z
        .boolean()
        .optional()
        .describe("If true, the query will be run against the legacy database"),
    }),
  ),
  outputSchema: z.lazy(() =>
    z.object({
      success: z.boolean(),
    }),
  ),
  handler: async ({ date, _legacy }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c, "DATABASES_RUN_SQL");
    const db = await workspaceDB(c, _legacy);
    using _ = await db.recovery?.(new Date(date));
    return { success: true };
  },
});

const DEFAULT_INTEGRATION_ID = `i:${WellKnownMcpGroups.Databases}`;
export const viewBinding = createDatabaseTool({
  name: "DECO_CHAT_VIEWS_LIST",
  description: "List views exposed by this MCP",
  inputSchema: z.void(),
  outputSchema: listViewsSchema,
  handler: (_, c) => {
    // It's ok to grant access to this tool.
    // To open the studio the user will be checked for resource access.
    c.resourceAccess.grant();
    assertHasWorkspace(c);
    const integrationId =
      c.user &&
      typeof c.user === "object" &&
      "integrationId" in c.user &&
      typeof c.user.integrationId === "string"
        ? c.user.integrationId
        : DEFAULT_INTEGRATION_ID;

    return {
      views: [
        {
          title:
            integrationId === DEFAULT_INTEGRATION_ID
              ? "Database"
              : `Database (${integrationId})`,
          icon: "database",
          url: `https://api.decocms.com/${c.workspace.root}/${c.workspace.slug}/${integrationId}/studio`,
        },
      ],
    };
  },
});

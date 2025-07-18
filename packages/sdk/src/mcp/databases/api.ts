import z from "zod";
import { WebCache } from "../../cache/index.ts";
import {
  type AppContext,
  assertHasWorkspace,
  assertsNotNull,
  assertWorkspaceResourceAccess,
  createToolGroup,
} from "../index.ts";

const cache = new WebCache<string>(
  "workspace-d1-database",
  WebCache.MAX_SAFE_TTL,
);
const inMemoryCache = new Map<string, string>();

export const getWorkspaceD1Database = async (
  c: AppContext,
): Promise<string> => {
  assertHasWorkspace(c);
  const cacheKey = `${c.workspace.value}-d1-database`;
  const inMemory = inMemoryCache.get(cacheKey);
  if (inMemory) {
    return inMemory;
  }
  const cached = await cache.get(cacheKey);
  if (cached) {
    inMemoryCache.set(cacheKey, cached);
    return cached;
  }
  const db = await assertsWorkspaceD1Database(c);
  assertsNotNull(db.uuid);
  inMemoryCache.set(cacheKey, db.uuid);
  await cache.set(cacheKey, db.uuid);
  return db.uuid;
};
const assertsWorkspaceD1Database = async (c: AppContext) => {
  assertHasWorkspace(c);
  const workspace = c.workspace.value;

  // Slugify workspace name to meet D1 naming requirements (lowercase letters, numbers, underscores, hyphens)
  const dbName = workspace.toLowerCase().replace(/[^a-z0-9_-]/g, "-");

  // List databases to check if it already exists
  const databases = await c.cf.d1.database.list({
    account_id: c.envVars.CF_ACCOUNT_ID,
  });

  const existingDb = databases.result?.find((db) => db.name === dbName);

  if (existingDb) {
    // Database already exists, return
    return existingDb;
  }

  // Database doesn't exist, create it
  return await c.cf.d1.database.create({
    account_id: c.envVars.CF_ACCOUNT_ID,
    name: dbName,
  });
};

const createTool = createToolGroup("Databases", {
  name: "Databases",
  description: "Query workspace database",
  icon: "https://assets.decocache.com/mcp/390f7756-ec01-47e4-bb31-9e7b18f6f56f/database.png",
});

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

export const runSql = createTool({
  name: "DATABASES_RUN_SQL",
  description: "Run a SQL query against the workspace database",
  inputSchema: z.object({
    sql: z.string().describe("The SQL query to run"),
    params: z
      .array(z.any())
      .describe("The parameters to pass to the SQL query"),
  }),
  outputSchema: z.object({
    result: z.array(QueryResult),
  }),
  handler: async ({ sql, params }, c) => {
    await assertWorkspaceResourceAccess(c.tool.name, c);
    const db = await getWorkspaceD1Database(c);

    const response = await c.cf.d1.database.query(db, {
      account_id: c.envVars.CF_ACCOUNT_ID,
      sql,
      params,
    });
    return { result: response.result };
  },
});

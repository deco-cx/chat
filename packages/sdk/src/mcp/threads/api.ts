import {
  type Client,
  createClient,
  type InStatement,
} from "@libsql/client/web";
import { MessageList } from "@mastra/core/agent";
import type { Message as AIMessage } from "ai";
import { z } from "zod";
import { WorkspaceMemory } from "../../memory/memory.ts";
import {
  assertHasWorkspace,
  canAccessWorkspaceResource,
} from "../assertions.ts";
import { type AppContext, createTool } from "../context.ts";
import { InternalServerError, NotFoundError } from "../index.ts";
import { generateUUIDv5, toAlphanumericId } from "../slugify.ts";

async function getWorkspaceMemory(c: AppContext) {
  assertHasWorkspace(c);
  return await WorkspaceMemory.create({
    workspace: c.workspace.value,
    tursoAdminToken: c.envVars.TURSO_ADMIN_TOKEN ?? "",
    tursoOrganization: c.envVars.TURSO_ORGANIZATION,
    tokenStorage: c.envVars.TURSO_GROUP_DATABASE_TOKEN,
  });
}

const safeParse = (str: string) => {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
};

const safeExecute = async (client: Client, stmt: InStatement) => {
  try {
    return { data: await client.execute(stmt), error: null };
  } catch (e) {
    return { data: null, error: e };
  }
};

const ThreadSchema = z.object({
  id: z.string(),
  resourceId: z.string(),
  title: z.string(),
  metadata: z.string().transform(safeParse),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const MessageSchema = z.object({
  id: z.string(),
  thread_id: z.string(),
  content: z.string().transform(safeParse),
  role: z.string(),
  type: z.string(),
  createdAt: z.string(),
});

type Thread = z.infer<typeof ThreadSchema>;
type Message = z.infer<typeof MessageSchema>;

const TURSO_GROUP = "deco-agents-v2";

const createSQLClientFor = async (
  workspace: string,
  organization: string,
  authToken: string,
) => {
  const memoryId = toAlphanumericId(
    `${workspace}/default`,
  );
  const uniqueDbName = await generateUUIDv5(
    `${memoryId}-${TURSO_GROUP}`,
  );

  return createClient({
    url: `libsql://${uniqueDbName}-${organization}.turso.io`,
    authToken: authToken,
  });
};

export const listThreads = createTool({
  name: "THREADS_LIST",
  description:
    "List all threads in a workspace with cursor-based pagination and filtering",
  inputSchema: z.object({
    limit: z.number().min(1).max(20).default(10).optional(),
    agentId: z.string().optional(),
    resourceId: z.string().optional(),
    uniqueByAgentId: z.boolean().default(false).optional(),
    orderBy: z.enum([
      "createdAt_desc",
      "createdAt_asc",
      "updatedAt_desc",
      "updatedAt_asc",
    ]).default("createdAt_desc").optional(),
    cursor: z.string().optional(),
  }),
  canAccess: canAccessWorkspaceResource,
  handler: async (
    { limit, agentId, orderBy, cursor, resourceId, uniqueByAgentId },
    c,
  ) => {
    const { TURSO_GROUP_DATABASE_TOKEN, TURSO_ORGANIZATION } = c.envVars;
    assertHasWorkspace(c);
    const workspace = c.workspace.value;

    const client = await createSQLClientFor(
      workspace,
      TURSO_ORGANIZATION,
      TURSO_GROUP_DATABASE_TOKEN,
    );

    orderBy ??= "createdAt_desc";
    // Parse orderBy parameter
    const [field, direction] = orderBy.split("_");
    const isDesc = direction === "desc";

    // Build the WHERE clause for filtering
    const whereClauses = [];
    const args = [];

    if (agentId) {
      whereClauses.push("json_extract(metadata, '$.agentId') = ?");
      args.push(agentId);
    }

    if (resourceId) {
      whereClauses.push("resourceId = ?");
      args.push(resourceId);
    }

    if (cursor) {
      const operator = isDesc ? "<" : ">";
      whereClauses.push(`${field} ${operator} ?`);
      args.push(cursor);
    }

    // Filter out deleted threads
    whereClauses.push(
      "(json_extract(metadata, '$.deleted') IS NULL OR json_extract(metadata, '$.deleted') = false)",
    );

    const whereClause = whereClauses.length > 0
      ? `WHERE ${whereClauses.join(" AND ")}`
      : "";

    limit ??= 10;
    const { data: result, error } = await safeExecute(client, {
      sql: uniqueByAgentId
        ? `WITH RankedThreads AS (
            SELECT *,
              ROW_NUMBER() OVER (PARTITION BY json_extract(metadata, '$.agentId') ORDER BY ${field} ${direction.toUpperCase()}) as rn
            FROM mastra_threads ${whereClause}
          )
          SELECT * FROM RankedThreads WHERE rn = 1 ORDER BY ${field} ${direction.toUpperCase()} LIMIT ?`
        : `SELECT * FROM mastra_threads ${whereClause} ORDER BY ${field} ${direction.toUpperCase()} LIMIT ?`,
      args: [...args, limit + 1], // Fetch one extra to determine if there are more
    });

    if (!result || error) {
      return { threads: [], pagination: { hasMore: false, nextCursor: null } };
    }

    const threads = result.rows
      .map((row: unknown) => ThreadSchema.safeParse(row)?.data)
      .filter((a): a is Thread => !!a);

    // Check if there are more results
    const hasMore = threads.length > limit;
    if (hasMore) {
      threads.pop(); // Remove the extra item
    }

    // Get the cursor for the next page
    const nextCursor = threads.length > 0
      ? field === "createdAt"
        ? threads[threads.length - 1].createdAt
        : threads[threads.length - 1].updatedAt
      : null;

    return {
      threads,
      pagination: {
        hasMore,
        nextCursor,
      },
    };
  },
});

export const getThreadMessages = createTool({
  name: "THREADS_GET_MESSAGES",
  description: "Get only the messages for a thread by thread id",
  inputSchema: z.object({ id: z.string() }),
  canAccess: canAccessWorkspaceResource,
  handler: async ({ id }, c) => {
    const { TURSO_GROUP_DATABASE_TOKEN, TURSO_ORGANIZATION } = c.envVars;
    assertHasWorkspace(c);
    const workspace = c.workspace.value;

    const client = await createSQLClientFor(
      workspace,
      TURSO_ORGANIZATION,
      TURSO_GROUP_DATABASE_TOKEN,
    );

    const { data: result, error } = await safeExecute(client, {
      sql:
        `SELECT * FROM mastra_messages WHERE thread_id = ? ORDER BY createdAt ASC`,
      args: [id],
    });

    if (!result?.rows.length || error) {
      return [];
    }

    const messages = result.rows
      .map((row: unknown) => MessageSchema.safeParse(row)?.data)
      .filter((a: Message | undefined): a is Message => !!a);

    const list = new MessageList({ threadId: id });
    for (const message of messages) {
      list.add(message as unknown as AIMessage, "memory");
    }

    return list.get.all.ui();
  },
});

export const getThread = createTool({
  name: "THREADS_GET",
  description: "Get a thread by thread id (without messages)",
  inputSchema: z.object({ id: z.string() }),
  canAccess: canAccessWorkspaceResource,
  handler: async ({ id }, c) => {
    const { TURSO_GROUP_DATABASE_TOKEN, TURSO_ORGANIZATION } = c.envVars;
    assertHasWorkspace(c);
    const workspace = c.workspace.value;

    const client = await createSQLClientFor(
      workspace,
      TURSO_ORGANIZATION,
      TURSO_GROUP_DATABASE_TOKEN,
    );

    const { data: result, error } = await safeExecute(client, {
      sql: `SELECT * FROM mastra_threads WHERE id = ? LIMIT 1`,
      args: [id],
    });

    if (!result?.rows.length || error) {
      throw new NotFoundError();
    }

    const thread = ThreadSchema.parse(result.rows[0]);

    return thread;
  },
});

export const getThreadTools = createTool({
  name: "THREADS_GET_TOOLS",
  description: "Get the tools_set for a thread by thread id",
  inputSchema: z.object({ id: z.string() }),
  canAccess: canAccessWorkspaceResource,
  handler: async ({ id }, c) => {
    const { TURSO_GROUP_DATABASE_TOKEN, TURSO_ORGANIZATION } = c.envVars;
    assertHasWorkspace(c);
    const workspace = c.workspace.value;

    const client = await createSQLClientFor(
      workspace,
      TURSO_ORGANIZATION,
      TURSO_GROUP_DATABASE_TOKEN,
    );

    const { data: result } = await safeExecute(client, {
      sql: `SELECT * FROM mastra_threads WHERE id = ? LIMIT 1`,
      args: [id],
    });

    const { data: thread } = ThreadSchema.safeParse(result?.rows[0] ?? {});

    return { tools_set: thread?.metadata.tools_set ?? null };
  },
});

export const updateThreadTitle = createTool({
  name: "THREADS_UPDATE_TITLE",
  description: "Update a thread's title",
  inputSchema: z.object({
    threadId: z.string(),
    title: z.string(),
  }),
  canAccess: canAccessWorkspaceResource,
  handler: async ({ threadId, title }, c) => {
    const memory = await getWorkspaceMemory(c);

    const currentThread = await memory.getThreadById({ threadId });
    if (!currentThread) {
      throw new NotFoundError();
    }

    const result = await memory.updateThread({
      id: threadId,
      title,
      metadata: currentThread.metadata ?? {},
    });
    if (!result) {
      throw new InternalServerError("Failed to update thread title");
    }

    return {
      ...result,
      createdAt: result.createdAt instanceof Date
        ? result.createdAt.toISOString()
        : result.createdAt,
      updatedAt: result.updatedAt instanceof Date
        ? result.updatedAt.toISOString()
        : result.updatedAt,
    };
  },
});

export const updateThreadMetadata = createTool({
  name: "THREADS_UPDATE_METADATA",
  description: "Update a thread's metadata",
  inputSchema: z.object({
    threadId: z.string(),
    metadata: z.record(z.unknown()),
  }),
  canAccess: canAccessWorkspaceResource,
  handler: async ({ threadId, metadata }, c) => {
    const memory = await getWorkspaceMemory(c);

    const currentThread = await memory.getThreadById({ threadId });
    if (!currentThread) {
      throw new NotFoundError();
    }

    const result = await memory.updateThread({
      id: threadId,
      title: currentThread.title ?? "",
      metadata: { ...currentThread.metadata, ...metadata },
    });
    if (!result) {
      throw new InternalServerError("Failed to update thread metadata");
    }

    return {
      ...result,
      createdAt: result.createdAt instanceof Date
        ? result.createdAt.toISOString()
        : result.createdAt,
      updatedAt: result.updatedAt instanceof Date
        ? result.updatedAt.toISOString()
        : result.updatedAt,
    };
  },
});

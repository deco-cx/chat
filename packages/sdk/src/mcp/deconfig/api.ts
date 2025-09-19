/**
 * DECONFIG-related tools for branch and file operations.
 *
 * This file contains all tools related to DECONFIG operations including:
 * - Branch CRUD: create, read, list, delete
 * - File CRUD: put, read, delete, list
 * - Advanced operations: diff, watch, transactional writes
 *
 * Branches are managed via workspace database for better scalability
 * and workspace-level isolation. Each branch can contain files managed
 * by the existing Durable Object infrastructure.
 */
import { z } from "zod";
import { DECO_CHAT_ISSUER } from "../../auth/jwt.ts";
import { WellKnownMcpGroups } from "../../crud/groups.ts";
import { doRetryable } from "../../do-commons.ts";
import type { WithTool } from "../assertions.ts";
import {
  assertHasWorkspace,
  assertWorkspaceResourceAccess,
} from "../assertions.ts";
import {
  type AppContext,
  createTool,
  createToolFactory,
  workspaceDB,
} from "../context.ts";
import { withProject } from "../index.ts";
import type { BranchRpc, ConflictEntry, DiffEntry } from "./branch.ts";
import { type BranchRecord, newBranchesCRUD } from "./branches-db.ts";

interface DeconfigState {
  pathPrefix?: string;
}
type DeconfigContext = WithTool<AppContext> & {
  state: DeconfigState;
};

// Types from branch.ts - simplified for MCP usage
export const BranchId = {
  build(name: string, projectId: string) {
    return `${projectId}-${name}`;
  },
};

export enum MergeStrategy {
  OVERRIDE = "OVERRIDE",
  LAST_WRITE_WINS = "LAST_WRITE_WINS",
}

// Helper function to get workspace from context
const projectFor = (c: AppContext): string => {
  const workspace = c.workspace?.value;
  if (!workspace) {
    throw new Error("No project context available");
  }
  return workspace;
};

// Helper function to get branch RPC (using branchName directly for performance)
export const branchRpcFor = async (
  c: AppContext,
  branchName?: string,
): Promise<Rpc.Stub<BranchRpc>> => {
  assertHasWorkspace(c);
  branchName ??= c.locator?.branch ?? c.workspace?.branch;
  const projectId = projectFor(c);
  const branchStub = c.branchDO.get(
    c.branchDO.idFromName(BranchId.build(branchName, projectId)),
  );

  const rpc = await branchStub.new({
    projectId,
    branchName,
  });

  return rpc;
};

const createDeconfigTool = createToolFactory<DeconfigContext>(
  (c) => {
    let state: DeconfigState = {};
    if ("state" in c && typeof c.state === "object" && c.state) {
      state = c.state as DeconfigState;
    }

    if (
      c.user &&
      "aud" in c.user &&
      typeof c.user.aud === "string" &&
      c.user.iss === DECO_CHAT_ISSUER
    ) {
      c = withProject(c, c.user.aud, c.locator?.branch ?? "main", c.user.sub);
    }
    return {
      ...(c as WithTool<AppContext>),
      state,
    };
  },
  WellKnownMcpGroups["Deconfig"],
  {
    name: "Deconfig",
    description:
      "Git-like versioned configuration management with branches, files, and real-time collaboration.",
    icon: "https://assets.decocache.com/mcp/24cfa17a-a0a8-40dc-9313-b4c3bdb63af6/deconfig_v1.png",
  },
  doRetryable,
);

// =============================================================================
// BRANCH CRUD OPERATIONS
// =============================================================================

export const createBranch = createDeconfigTool({
  name: "CREATE_BRANCH",
  description:
    "Create a DECONFIG branch. If sourceBranch is provided, creates a branch from that branch (O(1) operation). Otherwise creates an empty branch.",
  inputSchema: z.object({
    branchName: z.string().describe("The name of the branch to create"),
    sourceBranch: z
      .string()
      .optional()
      .describe(
        "The source branch to branch from (optional - creates empty branch if not provided)",
      ),
    metadata: z
      .record(z.any())
      .optional()
      .describe("Optional metadata for the branch"),
  }),
  outputSchema: z.object({
    branchName: z.string(),
    sourceBranch: z.string().optional(),
    createdAt: z.number(),
  }),
  handler: async ({ branchName, sourceBranch, metadata }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    const db = await workspaceDB({
      workspaceDO: c.workspaceDO,
      workspace: c.workspace!,
      envVars: c.envVars,
    });

    const crud = newBranchesCRUD(db);

    // Check if branch already exists
    if (await crud.branchExists(branchName)) {
      throw new Error(`Branch '${branchName}' already exists`);
    }

    if (sourceBranch) {
      // Branching from existing branch
      if (!(await crud.branchExists(sourceBranch))) {
        throw new Error(`Source branch '${sourceBranch}' not found`);
      }

      // Branch from existing branch using Durable Object
      using sourceRpc = await branchRpcFor(c, sourceBranch);
      using _ = await sourceRpc.branch(branchName);
    }
    // Create empty branch
    const branch = await crud.createBranch({
      name: branchName,
      metadata,
      origin_branch: sourceBranch,
    });

    return {
      branchName,
      sourceBranch,
      createdAt: branch.created_at,
    };
  },
});

export const listBranches = createDeconfigTool({
  name: "LIST_BRANCHES",
  description: "List all branches in the current workspace",
  inputSchema: z.object({
    prefix: z
      .string()
      .optional()
      .describe("Optional prefix to filter branch names"),
  }),
  outputSchema: z.object({
    branches: z.array(
      z.object({
        name: z.string(),
        createdAt: z.number(),
        metadata: z.record(z.any()),
        originBranch: z.string().nullable(),
      }),
    ),
    count: z.number(),
  }),
  handler: async ({ prefix }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    const db = await workspaceDB({
      workspaceDO: c.workspaceDO,
      workspace: c.workspace!,
      envVars: c.envVars,
    });

    const crud = newBranchesCRUD(db);
    const branches = await crud.listBranches({ prefix });

    const formattedBranches = branches.map((br: BranchRecord) => ({
      name: br.name,
      createdAt: br.created_at,
      metadata: br.metadata,
      originBranch: br.origin_branch,
    }));

    return {
      branches: formattedBranches,
      count: formattedBranches.length,
    };
  },
});

export const deleteBranch = createDeconfigTool({
  name: "DELETE_BRANCH",
  description:
    "Delete a branch and all its files. This operation cannot be undone.",
  inputSchema: z.object({
    branchName: z.string().describe("The name of the branch to delete"),
  }),
  outputSchema: z.object({
    deleted: z.boolean(),
    branchName: z.string(),
    filesDeleted: z.number().optional(),
  }),
  handler: async ({ branchName }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    const db = await workspaceDB({
      workspaceDO: c.workspaceDO,
      workspace: c.workspace!,
      envVars: c.envVars,
    });

    const crud = newBranchesCRUD(db);

    // Check if branch exists
    if (!(await crud.branchExists(branchName))) {
      throw new Error(`Branch '${branchName}' not found`);
    }

    // Get file count before deletion (optional)
    let filesDeleted = 0;
    try {
      using branchRpc = await branchRpcFor(c, branchName);
      filesDeleted = await branchRpc.softDelete();
    } catch {
      // Ignore errors getting file count
    }

    // Delete from database
    const deleted = await crud.deleteBranch(branchName);

    return {
      deleted,
      branchName,
      filesDeleted,
    };
  },
});

export const mergeBranch = createDeconfigTool({
  name: "MERGE_BRANCH",
  description:
    "Merge another branch into the current one with configurable strategy",
  inputSchema: z.object({
    targetBranch: z
      .string()
      .optional()
      .default("main")
      .describe("The branch to merge into (defaults to 'main')"),
    sourceBranch: z.string().describe("The branch to merge from"),
    strategy: z
      .enum(["OVERRIDE", "LAST_WRITE_WINS"])
      .describe("Merge strategy"),
  }),
  outputSchema: z.object({
    filesMerged: z.number(),
    added: z.array(z.string()),
    modified: z.array(z.string()),
    deleted: z.array(z.string()),
    conflicts: z
      .array(
        z.object({
          path: z.string(),
          resolved: z.enum(["local", "remote"]),
          localMtime: z.number(),
          remoteMtime: z.number(),
        }),
      )
      .optional(),
  }),
  handler: async ({ targetBranch, sourceBranch, strategy }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    using targetRpc = await branchRpcFor(c, targetBranch);
    using result = await targetRpc.merge(
      sourceBranch,
      strategy as MergeStrategy,
    );

    if (!result.success) {
      throw new Error("Merge operation failed");
    }

    const conflicts = (result.conflicts ?? []) as unknown as ConflictEntry[];
    return {
      filesMerged: result.filesMerged,
      added: result.added,
      modified: result.modified,
      deleted: result.deleted,
      conflicts: conflicts.map((c) => ({
        path: c.path,
        resolved: c.resolved,
        localMtime: c.localMetadata.mtime,
        remoteMtime: c.remoteMetadata.mtime,
      })),
    };
  },
});

export const diffBranch = createDeconfigTool({
  name: "DIFF_BRANCH",
  description: "Compare two branches and get the differences",
  inputSchema: z.object({
    baseBranch: z
      .string()
      .optional()
      .default("main")
      .describe("The base branch to compare from (defaults to 'main')"),
    compareBranch: z.string().describe("The branch to compare against"),
  }),
  outputSchema: z.object({
    differences: z.array(
      z.object({
        path: z.string(),
        type: z.enum(["added", "modified", "deleted"]),
        baseAddress: z.string().optional(),
        compareAddress: z.string().optional(),
      }),
    ),
  }),
  handler: async ({ baseBranch, compareBranch }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    using baseRpc = await branchRpcFor(c, baseBranch);
    const diffs = (await baseRpc.diff(compareBranch)) as DiffEntry[];

    const differences = diffs.map((diff) => ({
      path: diff.path,
      type: (diff.metadata === null ? "deleted" : "modified") as
        | "added"
        | "modified"
        | "deleted",
      compareAddress: diff.metadata?.address,
    }));

    return { differences };
  },
});

// =============================================================================
// FILE CRUD OPERATIONS (using branchName directly for performance)
// =============================================================================
const normalizePath = (path: string) => {
  path = path.startsWith("/") ? path : `/${path}`; // add leading slash
  return path.endsWith("/") ? path.slice(0, -1) : path; // remove trailing slash
};

const withPathPrefix = (c: DeconfigContext, path: string) => {
  const normalized = normalizePath(path);
  const prefix = c.state.pathPrefix;
  if (prefix) {
    return `${normalizePath(prefix)}${normalized}`;
  }
  return normalized;
};

export const putFile = createDeconfigTool({
  name: "PUT_FILE",
  description:
    "Put a file in a DECONFIG branch (create or update) with optional conflict detection",
  inputSchema: z.object({
    branch: z.string().optional().describe("The branch name"),
    path: z.string().describe("The file path within the branch"),
    content: z
      .union([
        z.string().describe("Plain text string content"),
        z.object({
          base64: z.string().describe("Base64 encoded content"),
        }),
        z.array(z.number()).describe("Array of bytes (0-255)"),
      ])
      .describe(
        "The file content as plain string, base64 object, or array of bytes",
      ),
    metadata: z
      .record(z.any())
      .optional()
      .describe("Additional metadata key-value pairs"),
    expectedCtime: z
      .number()
      .optional()
      .describe("Expected change time for conflict detection"),
  }),
  outputSchema: z.object({
    conflict: z.boolean().optional(),
  }),
  handler: async ({ branch, path, content, metadata, expectedCtime }, c) => {
    path = withPathPrefix(c, path);
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    // Normalize path
    const normalizedPath = normalizePath(path);

    // Convert content to ArrayBuffer
    let data: ArrayBuffer;

    if (Array.isArray(content)) {
      // Handle array of bytes
      data = new Uint8Array(content).buffer;
    } else if (typeof content === "string") {
      // Handle plain string content
      data = new TextEncoder().encode(content).buffer as ArrayBuffer;
    } else if (typeof content === "object" && "base64" in content) {
      // Handle base64 object
      try {
        data = Uint8Array.from(atob(content.base64), (c: string) =>
          c.charCodeAt(0),
        ).buffer;
      } catch (error) {
        throw new Error(
          `Invalid base64 content: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    } else {
      throw new Error("Invalid content type");
    }

    using branchRpc = await branchRpcFor(c, branch);

    // Use transactional write (works for both conditional and unconditional writes)
    using result = await branchRpc.transactionalWrite({
      patches: [
        {
          path: normalizedPath,
          content: data,
          metadata,
          expectedCtime, // undefined if no conflict detection needed
        },
      ],
    });

    const fileResult = result.results[normalizedPath];

    return {
      conflict: fileResult?.success === false,
    };
  },
});

export const readFile = createDeconfigTool({
  name: "READ_FILE",
  description: "Read a file from a DECONFIG branch",
  inputSchema: z.object({
    branch: z.string().optional().describe("The branch name"),
    path: z.string().describe("The file path within the branch"),
    format: z
      .enum(["base64", "byteArray", "plainString", "json"])
      .optional()
      .default("base64")
      .describe(
        "Return format: 'base64' (default), 'byteArray', 'plainString', or 'json'",
      ),
  }),
  outputSchema: z.object({
    content: z.any(),
    address: z.string(),
    metadata: z.record(z.any()),
    mtime: z.number(),
    ctime: z.number(),
  }),
  handler: async ({ branch, path, format }, c) => {
    path = withPathPrefix(c, path);
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    const normalizedPath = normalizePath(path);

    using branchRpc = await branchRpcFor(c, branch);
    using fileData = await branchRpc.getFile(normalizedPath);

    if (!fileData) {
      throw new Error(`File not found: ${normalizedPath}`);
    }

    // Convert ReadableStream to bytes
    const reader = fileData.stream.getReader();
    const chunks: Uint8Array[] = [];
    let done = false;

    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) {
        chunks.push(value);
      }
    }

    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    // Process content based on requested format
    let content: string | number[] | unknown;

    switch (format) {
      case "base64":
        content = btoa(String.fromCharCode(...combined));
        break;
      case "byteArray":
        content = Array.from(combined);
        break;
      case "plainString":
        content = new TextDecoder().decode(combined);
        break;
      case "json":
        try {
          const text = new TextDecoder().decode(combined);
          content = JSON.parse(text);
        } catch (error) {
          throw new Error(
            `Invalid JSON content: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
        break;
      default:
        content = btoa(String.fromCharCode(...combined)); // fallback to base64
    }
    return {
      content,
      address: fileData.metadata.address,
      // @ts-ignore - TODO: fix this
      metadata: fileData.metadata.metadata,
      mtime: fileData.metadata.mtime,
      ctime: fileData.metadata.ctime,
    };
  },
});

export const deleteFile = createDeconfigTool({
  name: "DELETE_FILE",
  description: "Delete a file from a DECONFIG branch",
  inputSchema: z.object({
    branch: z.string().optional().describe("The branch name"),
    path: z.string().describe("The file path within the branch"),
  }),
  outputSchema: z.object({
    deleted: z.boolean(),
  }),
  handler: async ({ branch, path }, c) => {
    path = withPathPrefix(c, path);
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    const normalizedPath = normalizePath(path);

    using branchRpc = await branchRpcFor(c, branch);
    return { deleted: await branchRpc.deleteFile(normalizedPath) };
  },
});

const listFilesOutputSchema = z.object({
  files: z.record(
    z.string(),
    z.object({
      address: z.string(),
      metadata: z.record(z.string(), z.any()),
      sizeInBytes: z.number(),
      mtime: z.number(),
      ctime: z.number(),
      content: z.string().optional(),
    }),
  ),
  count: z.number(),
});

export const listFiles = createDeconfigTool({
  name: "LIST_FILES",
  description:
    "List files in a DECONFIG branch with optional prefix filtering and content inclusion",
  inputSchema: z.object({
    branch: z.string().optional().describe("The branch name"),
    prefix: z
      .string()
      .optional()
      .describe("Optional prefix to filter files (use select instead)"),
    select: z
      .array(z.string())
      .optional()
      .describe("Optional list of files to select"),
    includeContent: z
      .boolean()
      .optional()
      .default(false)
      .describe("Include file content as base64 in the response"),
  }),
  outputSchema: listFilesOutputSchema,
  handler: async ({ branch, prefix, select, includeContent }, c) => {
    if (prefix) {
      select = [prefix];
    }
    if (select) {
      select = select.map((s) => withPathPrefix(c, s));
    }
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    using branchRpc = await branchRpcFor(c, branch);
    using files = await branchRpc.getFiles(select, includeContent);

    return {
      files,
      count: Object.keys(files).length,
    } as unknown as z.infer<typeof listFilesOutputSchema>;
  },
});

export const oauthStart = createTool({
  name: "DECO_CHAT_OAUTH_START",
  description: "Start the OAuth flow for the contract app.",
  inputSchema: z.object({
    returnUrl: z.string(),
  }),
  outputSchema: z.object({
    stateSchema: z.any(),
    scopes: z.array(z.string()).optional(),
  }),
  handler: (_, c) => {
    c.resourceAccess.grant();
    return {
      stateSchema: {
        type: "object",
        properties: {
          pathPrefix: {
            type: "string",
            description: "The path prefix to use for the database",
          },
        },
        required: [],
      },
      scopes: ["DATABASES_RUN_SQL"],
    };
  },
});

// Export all DECONFIG-related tools
export const DECONFIG_TOOLS = [
  // Branch CRUD
  createBranch,
  listBranches,
  deleteBranch,
  mergeBranch,
  diffBranch,

  // File CRUD
  putFile,
  readFile,
  deleteFile,
  listFiles,
] as const;

/**
 * Converts a string into a URL-safe slug.
 * - Lowercases the string
 * - Replaces spaces and underscores with dashes
 * - Removes non-alphanumeric characters (except dashes)
 * - Trims leading/trailing dashes
 *
 * @param input - The string to slugify
 * @returns The slugified string
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[\s_]+/g, "-") // Replace spaces and underscores with dashes
    .replace(/[^a-z0-9-]/g, ""); // Remove all non-alphanumeric except leading/trailing dashes
}

export { Blobs } from "./blobs.ts";
export { Branch } from "./branch.ts";

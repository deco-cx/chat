/**
 * DECONFIG-related tools for branch and file operations.
 *
 * This file contains all tools related to DECONFIG operations including:
 * - Branch CRUD: create, read, list, delete
 * - File CRUD: put, read, delete, list
 * - Advanced operations: diff, watch, transactional writes
 *
 * Branches are now managed via workspace database for better scalability
 * and workspace-level isolation. Each branch can contain files managed
 * by the existing Durable Object infrastructure.
 */
import { createPrivateTool as createTool } from "@deco/workers-runtime/mastra";
import { z } from "zod";
import type { Env } from "../main.ts";
import { BranchId, MergeStrategy } from "../src/branch.ts";
import { newBranchesCRUD } from "../src/branches-db.ts";

// Helper function to get workspace from env
const projectFor = (env: Env): string => {
  const workspace = env.DECO_CHAT_REQUEST_CONTEXT?.workspace;
  if (!workspace) {
    throw new Error("No workspace context available");
  }
  return workspace;
};

// Helper function to get branch RPC (using branchName directly for performance)
export const branchRpcFor = async (env: Env, branchName: string = "main") => {
  const projectId = projectFor(env);

  // Get or create the Durable Object for file operations
  const branchStub = env.BRANCH.get(
    env.BRANCH.idFromName(BranchId.build(branchName, projectId)),
  );

  const rpc = await branchStub.new({
    projectId,
    branchName,
  });

  return rpc;
};

// =============================================================================
// BRANCH CRUD OPERATIONS
// =============================================================================

export const createBranchTool = (env: Env) =>
  createTool({
    id: "CREATE_BRANCH",
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
    execute: async ({ context }) => {
      const crud = newBranchesCRUD(env);

      // Check if branch already exists
      if (await crud.branchExists(context.branchName)) {
        throw new Error(`Branch '${context.branchName}' already exists`);
      }

      if (context.sourceBranch) {
        // Branching from existing branch
        if (!(await crud.branchExists(context.sourceBranch))) {
          throw new Error(`Source branch '${context.sourceBranch}' not found`);
        }

        // Branch from existing branch using Durable Object
        using sourceRpc = await branchRpcFor(env, context.sourceBranch);
        await sourceRpc.branch(context.branchName);
      }
      // Create empty branch
      const branch = await crud.createBranch({
        name: context.branchName,
        metadata: context.metadata,
        origin_branch: context.sourceBranch,
      });

      return {
        branchName: context.branchName,
        sourceBranch: context.sourceBranch,
        createdAt: branch.created_at,
      };
    },
  });

export const createListBranchesTool = (env: Env) =>
  createTool({
    id: "LIST_BRANCHES",
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
    execute: async ({ context }) => {
      const crud = newBranchesCRUD(env);
      const branches = await crud.listBranches({ prefix: context.prefix });

      const formattedBranches = branches.map((br) => ({
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

export const createDeleteBranchTool = (env: Env) =>
  createTool({
    id: "DELETE_BRANCH",
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
    execute: async ({ context }) => {
      const crud = newBranchesCRUD(env);

      // Check if branch exists
      if (!(await crud.branchExists(context.branchName))) {
        throw new Error(`Branch '${context.branchName}' not found`);
      }

      // Get file count before deletion (optional)
      let filesDeleted = 0;
      try {
        using branchRpc = await branchRpcFor(env, context.branchName);
        filesDeleted = await branchRpc.softDelete();
      } catch (error) {
        // Ignore errors getting file count
      }

      // Delete from database
      const deleted = await crud.deleteBranch(context.branchName);

      return {
        deleted,
        branchName: context.branchName,
        filesDeleted,
      };
    },
  });

export const createMergeBranchTool = (env: Env) =>
  createTool({
    id: "MERGE_BRANCH",
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
    execute: async ({ context }) => {
      using targetRpc = await branchRpcFor(env, context.targetBranch);
      const result = await targetRpc.merge(
        context.sourceBranch,
        context.strategy as MergeStrategy,
      );

      if (!result.success) {
        throw new Error("Merge operation failed");
      }

      return {
        filesMerged: result.filesMerged,
        added: result.added,
        modified: result.modified,
        deleted: result.deleted,
        conflicts: result.conflicts?.map((c: any) => ({
          path: c.path,
          resolved: c.resolved,
          localMtime: c.localMetadata.mtime,
          remoteMtime: c.remoteMetadata.mtime,
        })),
      };
    },
  });

export const createDiffBranchTool = (env: Env) =>
  createTool({
    id: "DIFF_BRANCH",
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
    execute: async ({ context }) => {
      using baseRpc = await branchRpcFor(env, context.baseBranch);
      const diffs = await baseRpc.diff(context.compareBranch);

      const differences = diffs.map((diff: any) => ({
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
const BaseFileOperationInputSchema = (env: Env) =>
  z.object({
    branch: z
      .string()
      .optional()
      .default("main")
      .describe("The branch name (defaults to 'main')"),
    path: z
      .string()
      .describe("The file path within the branch")
      .transform((arg) => {
        const pathPrefix = env.DECO_CHAT_REQUEST_CONTEXT?.state?.pathPrefix;
        const argPath = normalizePath(arg);
        if (pathPrefix) {
          return normalizePath(`${pathPrefix}${argPath}`);
        }
        return argPath;
      }),
  });

export const createPutFileTool = (env: Env) =>
  createTool({
    id: "PUT_FILE",
    description:
      "Put a file in a DECONFIG branch (create or update) with optional conflict detection",
    inputSchema: BaseFileOperationInputSchema(env).extend({
      content: z
        .string()
        .describe("The file content (will be base64 decoded if needed)"),
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
    execute: async ({ context }) => {
      // Convert content to ArrayBuffer
      let data: ArrayBuffer;
      try {
        // Try to decode as base64 first
        data = Uint8Array.from(atob(context.content), (c: string) =>
          c.charCodeAt(0),
        ).buffer;
      } catch {
        // If not base64, treat as regular string
        data = new TextEncoder().encode(context.content).buffer;
      }

      using branchRpc = await branchRpcFor(env, context.branch);

      // Use transactional write (works for both conditional and unconditional writes)
      const result = await branchRpc.transactionalWrite({
        patches: [
          {
            path: context.path,
            content: data,
            metadata: context.metadata,
            expectedCtime: context.expectedCtime, // undefined if no conflict detection needed
          },
        ],
      });

      const fileResult = result.results[context.path];

      return {
        conflict: fileResult?.success === false,
      };
    },
  });

export const createReadFileTool = (env: Env) =>
  createTool({
    id: "READ_FILE",
    description: "Read a file from a DECONFIG branch",
    inputSchema: BaseFileOperationInputSchema(env),
    outputSchema: z.object({
      content: z.string().describe("File content (base64 encoded)"),
      address: z.string(),
      metadata: z.record(z.string(), z.any()),
      mtime: z.number(),
      ctime: z.number(),
    }),
    execute: async ({ context }) => {
      using branchRpc = await branchRpcFor(env, context.branch);
      const fileData = await branchRpc.getFile(context.path);

      if (!fileData) {
        throw new Error(`File not found: ${context.path}`);
      }

      // Convert ReadableStream to base64
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

      const content = btoa(String.fromCharCode(...combined));

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

export const createDeleteFileTool = (env: Env) =>
  createTool({
    id: "DELETE_FILE",
    description: "Delete a file from a DECONFIG branch",
    inputSchema: BaseFileOperationInputSchema(env),
    outputSchema: z.object({
      deleted: z.boolean(),
    }),
    execute: async ({ context }) => {
      using branchRpc = await branchRpcFor(env, context.branch);
      return { deleted: await branchRpc.deleteFile(context.path) };
    },
  });

const ListFilesOutputSchema = z.object({
  files: z.record(
    z.string(),
    z.object({
      address: z.string(),
      metadata: z.record(z.string(), z.any()),
      sizeInBytes: z.number(),
      mtime: z.number(),
      ctime: z.number(),
    }),
  ),
  count: z.number(),
});

export const createListFilesTool = (env: Env) =>
  createTool({
    id: "LIST_FILES",
    description:
      "List files in a DECONFIG branch with optional prefix filtering",
    inputSchema: BaseFileOperationInputSchema(env)
      .omit({ path: true })
      .extend({
        prefix: z
          .string()
          .optional()
          .describe("Optional prefix to filter files"),
      }),
    outputSchema: ListFilesOutputSchema,
    execute: async ({ context }) => {
      using branchRpc = await branchRpcFor(env, context.branch);

      const files = await branchRpc.getFiles(context.prefix);

      return {
        files,
        count: Object.keys(files).length,
      } as z.infer<typeof ListFilesOutputSchema>;
    },
  });

// Export all DECONFIG-related tools
export const deconfigTools = [
  // Branch CRUD
  createBranchTool,
  createListBranchesTool,
  createDeleteBranchTool,
  createMergeBranchTool,
  createDiffBranchTool,

  // File CRUD
  createPutFileTool,
  createReadFileTool,
  createDeleteFileTool,
  createListFilesTool,
];

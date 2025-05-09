import { Hosts } from "@deco/sdk/hosts";
import { dirname } from "@std/path/posix";
import { WellKnownXAttrs } from "@webdraw/common";
import { xattr } from "@webdraw/fs";
import { z } from "zod";
import type { AIAgent } from "../agent.ts";
import { createInnateTool } from "../utils/createTool.ts";
import { applyFileEdits } from "./filepatch.ts";

function expand(path: string, agent: AIAgent): string {
  if (path.startsWith("~")) {
    path = path.replace("~", agent.workspace);
  }

  return path;
}

const ReadFileInputSchema = z.object({
  path: z.string(),
});
const ReadFileOutputSchema = z.object({
  content: z.string(),
});

export const DECO_FS_READ_FILE = createInnateTool({
  id: "DECO_FS_READ_FILE",
  description: "Read the complete contents of a file from the file system. " +
    "Handles various text encodings and provides detailed error messages " +
    "if the file cannot be read. Use this tool when you need to examine " +
    "the contents of a single file.",
  inputSchema: ReadFileInputSchema,
  outputSchema: ReadFileOutputSchema,
  execute: (agent) => async ({ context }) => {
    const expandedPath = expand(context.path, agent);
    const content = await agent.principalFs.readFile(
      expandedPath,
      "utf-8",
    );
    return { content };
  },
});

const ReadMultipleFilesInputSchema = z.object({
  paths: z.array(z.string()),
});

const ReadMultipleFilesOutputSchema = z.object({
  contents: z.array(z.object({
    path: z.string(),
    content: z.string(),
    error: z.string().optional(),
  })),
});

export const DECO_FS_READ_MULTIPLE_FILES = createInnateTool({
  id: "DECO_FS_READ_MULTIPLE_FILES",
  description:
    "Read the contents of multiple files simultaneously. This is more " +
    "efficient than reading files one by one when you need to analyze " +
    "or compare multiple files. Each file's content is returned with its " +
    "path as a reference. Failed reads for individual files won't stop " +
    "the entire operation.",
  inputSchema: ReadMultipleFilesInputSchema,
  outputSchema: ReadMultipleFilesOutputSchema,
  execute: (agent) => async ({ context }) => {
    const results = await Promise.all(
      context.paths.map(async (filePath: string) => {
        try {
          const expandedPath = expand(filePath, agent);
          const content = await agent.principalFs.readFile(
            expandedPath,
            "utf-8",
          );
          return { path: filePath, content, error: undefined };
        } catch (error) {
          const errorMessage = error instanceof Error
            ? error.message
            : String(error);
          return { path: filePath, content: "", error: errorMessage };
        }
      }),
    );
    return { contents: results };
  },
});

const WriteFileInputSchema = z.object({
  path: z.string(),
  content: z.string(),
});

const WriteFileOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export const DECO_FS_WRITE_FILE = createInnateTool({
  id: "DECO_FS_WRITE_FILE",
  description:
    "Create a new file or completely overwrite an existing file with new content. " +
    "Use with caution as it will overwrite existing files without warning. " +
    "Handles text content with proper encoding.",
  inputSchema: WriteFileInputSchema,
  outputSchema: WriteFileOutputSchema,
  execute: (agent) => async ({ context }) => {
    try {
      const expandedPath = expand(context.path, agent);
      await agent.metadata?.principalFs?.writeFile(
        expandedPath,
        context.content,
        "utf-8",
      );
      return {
        success: true,
        message: `Successfully wrote to ${context.path}`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      return {
        success: false,
        message: `Failed to write to ${context.path}: ${errorMessage}`,
      };
    }
  },
});

const EditOperationSchema = z.object({
  oldText: z.string().describe("Text to search for - must match exactly"),
  newText: z.string().describe("Text to replace with"),
});

const EditFileInputSchema = z.object({
  path: z.string(),
  edits: z.array(EditOperationSchema),
  dryRun: z.boolean().default(false).describe(
    "Preview changes using git-style diff format",
  ),
});

const EditFileOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  diff: z.string().optional(),
});

export const DECO_FS_EDIT_FILE = createInnateTool({
  id: "DECO_FS_EDIT_FILE",
  description:
    "Make line-based edits to a text file. Each edit replaces exact line sequences " +
    "with new content. Returns a git-style diff showing the changes made.",
  inputSchema: EditFileInputSchema,
  outputSchema: EditFileOutputSchema,
  execute: (agent) => async ({ context }) => {
    try {
      const expandedPath = expand(context.path, agent);
      const diff = await applyFileEdits(
        agent.principalFs,
        expandedPath,
        context.edits,
        context.dryRun,
      );
      return {
        success: true,
        message: context.dryRun
          ? "Preview of changes generated successfully"
          : "Changes applied successfully",
        diff,
      };
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      return {
        success: false,
        message: `Failed to edit file: ${errorMessage}`,
      };
    }
  },
});

const CreateDirectoryInputSchema = z.object({
  path: z.string(),
});

const CreateDirectoryOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  created: z.boolean(),
});

export const DECO_FS_CREATE_DIRECTORY = createInnateTool({
  id: "DECO_FS_CREATE_DIRECTORY",
  description:
    "Create a new directory or ensure a directory exists. Can create multiple " +
    "nested directories in one operation. If the directory already exists, " +
    "this operation will succeed silently. Perfect for setting up directory " +
    "structures for projects or ensuring required paths exist.",
  inputSchema: CreateDirectoryInputSchema,
  outputSchema: CreateDirectoryOutputSchema,
  execute: (agent) => async ({ context }) => {
    try {
      const expandedPath = expand(context.path, agent);
      const exists = await agent.metadata?.principalFs?.exists(expandedPath);
      if (exists) {
        return {
          success: true,
          message: `Directory ${context.path} already exists`,
          created: false,
        };
      }

      await agent.metadata?.principalFs?.mkdir(expandedPath, {
        recursive: true,
      });
      return {
        success: true,
        message: `Successfully created directory ${context.path}`,
        created: true,
      };
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      return {
        success: false,
        message: `Failed to create directory: ${errorMessage}`,
        created: false,
      };
    }
  },
});

const ListDirectoryInputSchema = z.object({
  path: z.string(),
});

const ListDirectoryOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  entries: z.array(z.object({
    name: z.string(),
    type: z.enum(["file", "directory"]),
    size: z.number().optional(),
    modified: z.string().optional(),
  })),
});

export const DECO_FS_LIST_DIRECTORY = createInnateTool({
  id: "DECO_FS_LIST_DIRECTORY",
  description:
    "Get a detailed listing of all files and directories in a specified path. " +
    "Results clearly distinguish between files and directories with type information. " +
    "This tool is essential for understanding directory structure and " +
    "finding specific files within a directory.",
  inputSchema: ListDirectoryInputSchema,
  outputSchema: ListDirectoryOutputSchema,
  execute: (agent) => async ({ context }) => {
    try {
      const expandedPath = expand(context.path, agent);
      const entries = await agent.principalFs.readdir(expandedPath, {
        withFileTypes: true,
      });
      const detailedEntries = await Promise.all(
        entries.map(async (entry) => {
          const entryPath = `${expandedPath}/${entry.name}`;
          const stats = await agent.principalFs.stat(entryPath);
          return {
            name: entry.name,
            type: entry.isDirectory() ? "directory" as const : "file" as const,
            size: stats.size,
            modified: stats.mtime.toISOString(),
          };
        }),
      );

      return {
        success: true,
        message: `Successfully listed contents of ${context.path}`,
        entries: detailedEntries,
      };
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      return {
        success: false,
        message: `Failed to list directory: ${errorMessage}`,
        entries: [],
      };
    }
  },
});

const MoveFileInputSchema = z.object({
  source: z.string(),
  destination: z.string(),
});

const MoveFileOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export const DECO_FS_MOVE_FILE = createInnateTool({
  id: "DECO_FS_MOVE_FILE",
  description:
    "Move or rename files and directories. Can move files between directories " +
    "and rename them in a single operation. If the destination exists, the " +
    "operation will fail. Works across different directories and can be used " +
    "for simple renaming within the same directory.",
  inputSchema: MoveFileInputSchema,
  outputSchema: MoveFileOutputSchema,
  execute: (agent) => async ({ context }) => {
    try {
      // Check if destination already exists
      const destExists = await agent.metadata?.principalFs?.exists(
        context.destination,
      );
      if (destExists) {
        return {
          success: false,
          message: `Destination ${context.destination} already exists`,
        };
      }

      // Check if source exists
      const sourceExists = await agent.metadata?.principalFs?.exists(
        context.source,
      );
      if (!sourceExists) {
        return {
          success: false,
          message: `Source ${context.source} does not exist`,
        };
      }

      // Move the file or directory
      await agent.metadata?.principalFs?.rename(
        context.source,
        context.destination,
      );
      return {
        success: true,
        message:
          `Successfully moved ${context.source} to ${context.destination}`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      return {
        success: false,
        message: `Failed to move file: ${errorMessage}`,
      };
    }
  },
});

const GetFileInfoInputSchema = z.object({
  path: z.string(),
});

const GetFileInfoOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  info: z.object({
    size: z.number(),
    created: z.string(),
    modified: z.string(),
    accessed: z.string(),
    isDirectory: z.boolean(),
    isFile: z.boolean(),
    permissions: z.string(),
  }).optional(),
});

export const DECO_FS_GET_FILE_INFO = createInnateTool({
  id: "DECO_FS_GET_FILE_INFO",
  description:
    "Retrieve detailed metadata about a file or directory. Returns comprehensive " +
    "information including size, creation time, last modified time, permissions, " +
    "and type. This tool is perfect for understanding file characteristics " +
    "without reading the actual content.",
  inputSchema: GetFileInfoInputSchema,
  outputSchema: GetFileInfoOutputSchema,
  execute: (agent) => async ({ context }) => {
    try {
      const expandedPath = expand(context.path, agent);
      const stats = await agent.principalFs.stat(expandedPath);
      return {
        success: true,
        message: `Successfully retrieved info for ${context.path}`,
        info: {
          size: stats.size,
          created: stats.birthtime.toISOString(),
          modified: stats.mtime.toISOString(),
          accessed: stats.atime.toISOString(),
          isDirectory: stats.isDirectory(),
          isFile: stats.isFile(),
          permissions: stats.mode.toString(8).slice(-3),
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      return {
        success: false,
        message: `Failed to get file info: ${errorMessage}`,
      };
    }
  },
});

const SearchFilesInputSchema = z.object({
  path: z.string(),
  pattern: z.string().describe("Search pattern (glob pattern)"),
  recursive: z.boolean().default(true).describe(
    "Whether to search recursively in subdirectories",
  ),
  maxResults: z.number().optional().describe(
    "Maximum number of results to return",
  ),
});

const SearchFilesOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  results: z.array(z.object({
    path: z.string(),
    type: z.enum(["file", "directory"]),
    size: z.number().optional(),
    modified: z.string().optional(),
  })),
});

export const DECO_FS_SEARCH_FILES = createInnateTool({
  id: "DECO_FS_SEARCH_FILES",
  description:
    "Search for files and directories matching a pattern. Supports glob patterns " +
    "and can search recursively through subdirectories. Returns detailed information " +
    "about each match including size and modification time.",
  inputSchema: SearchFilesInputSchema,
  outputSchema: SearchFilesOutputSchema,
  execute: (agent) => async ({ context }) => {
    try {
      const results: Array<
        {
          path: string;
          type: "file" | "directory";
          size?: number;
          modified?: string;
        }
      > = [];

      const searchDirectory = async (dirPath: string) => {
        const entries = await agent.principalFs?.readdir(dirPath, {
          withFileTypes: true,
        });

        for (const entry of entries) {
          const fullPath = `${dirPath}/${entry.name}`;

          // Check if the entry matches the pattern
          if (entry.name.match(context.pattern)) {
            const stats = await agent.principalFs?.stat(fullPath);
            results.push({
              path: fullPath,
              type: entry.isDirectory() ? "directory" : "file",
              size: stats.size,
              modified: stats.mtime.toISOString(),
            });
          }

          // Recursively search subdirectories if enabled
          if (context.recursive && entry.isDirectory()) {
            await searchDirectory(fullPath);
          }

          // Check if we've reached the maximum results
          if (context.maxResults && results.length >= context.maxResults) {
            return;
          }
        }
      };

      await searchDirectory(context.path);

      // Apply maxResults limit if specified
      const finalResults = context.maxResults
        ? results.slice(0, context.maxResults)
        : results;

      return {
        success: true,
        message:
          `Found ${finalResults.length} matches for pattern "${context.pattern}"`,
        results: finalResults,
      };
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      return {
        success: false,
        message: `Failed to search files: ${errorMessage}`,
        results: [],
      };
    }
  },
});

const DeleteFileInputSchema = z.object({
  path: z.string(),
  recursive: z.boolean().default(false).describe(
    "Whether to recursively delete directories and their contents",
  ),
});

const DeleteFileOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  deleted: z.boolean(),
});

export const DECO_FS_DELETE_FILE = createInnateTool({
  id: "DECO_FS_DELETE_FILE",
  description:
    "Delete a file or directory. For directories, can optionally delete recursively " +
    "to remove all contents. Use with caution as deleted files cannot be recovered. " +
    "Returns success status and whether the item was actually deleted.",
  inputSchema: DeleteFileInputSchema,
  outputSchema: DeleteFileOutputSchema,
  execute: (agent) => async ({ context }) => {
    try {
      // Check if path exists
      const expandedPath = expand(context.path, agent);
      const exists = await agent.principalFs.exists(expandedPath);
      if (!exists) {
        return {
          success: true,
          message: `Path ${context.path} does not exist`,
          deleted: false,
        };
      }

      // Get stats to determine if it's a directory
      const stats = await agent.principalFs.stat(expandedPath);

      if (stats.isDirectory()) {
        if (!context.recursive) {
          return {
            success: false,
            message:
              `Cannot delete directory ${context.path} without recursive flag`,
            deleted: false,
          };
        }
        // Recursive directory deletion
        await agent.principalFs.rm(expandedPath, {
          recursive: true,
          force: true,
        });
      } else {
        // File deletion
        await agent.principalFs.unlink(expandedPath);
      }

      return {
        success: true,
        message: `Successfully deleted ${context.path}`,
        deleted: true,
      };
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      return {
        success: false,
        message: `Failed to delete: ${errorMessage}`,
        deleted: false,
      };
    }
  },
});

const CreatePresignedUrlInputSchema = z.object({
  filePath: z.string().describe(
    `The path to the file to generate a presigned URL for. 
    You must choose the directory from Pictures, Documents, or Videos, depending on what will be uploaded.
    Examples: Pictures/image.jpg, Documents/report.pdf, Videos/video.mp4
    Remember to add the file extension to the end of the path.`,
  ),
  expiresIn: z.number().optional().describe(
    "Number of seconds until the URL expires (default: 3600)",
  ),
});

const CreatePresignedUrlOutputSchema = z.object({
  url: z.string().describe("The presigned URL"),
  expiresAt: z.number().describe("Unix timestamp when the URL expires"),
});

export const DECO_FS_CREATE_PRESIGNED_URL = createInnateTool({
  id: "DECO_FS_CREATE_PRESIGNED_URL",
  description:
    "Generate a secure presigned URL for file operations. Must choose from Pictures, Documents, or Videos. Add file extension to the end of the path.",
  inputSchema: CreatePresignedUrlInputSchema,
  outputSchema: CreatePresignedUrlOutputSchema,
  execute: (agent) => async ({ context }) => {
    const { filePath, expiresIn = 3600 } = context;
    const root = agent.workspace;
    const agentConfiguration = await agent.configuration();
    const agentId = agentConfiguration?.id;
    const fullPath = `${root}/Agents/${agentId}/${filePath}`;

    const token = crypto.randomUUID();

    const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;

    const metadata = {
      token,
      expiresAt,
    };

    const dirPath = dirname(filePath);

    await agent.fs.mkdir(dirPath, { recursive: true });

    const emptyFile = new Uint8Array(0);

    await agent.fs.writeFile(filePath, emptyFile);

    await xattr.setxattr(
      fullPath,
      WellKnownXAttrs.presignedUrl.token,
      JSON.stringify(metadata),
    );

    const url = new URL(`https://${Hosts.FS}/_presigned${fullPath}`);
    url.searchParams.set("token", token);

    return {
      url: url.toString(),
      expiresAt,
    };
  },
});

export const tools = {
  DECO_FS_READ_FILE,
  DECO_FS_READ_MULTIPLE_FILES,
  DECO_FS_WRITE_FILE,
  DECO_FS_EDIT_FILE,
  DECO_FS_CREATE_DIRECTORY,
  DECO_FS_LIST_DIRECTORY,
  DECO_FS_MOVE_FILE,
  DECO_FS_GET_FILE_INFO,
  DECO_FS_SEARCH_FILES,
  DECO_FS_DELETE_FILE,
  DECO_FS_CREATE_PRESIGNED_URL,
} as const;

import { DurableObject, RpcTarget } from "cloudflare:workers";
import type { Blobs as BlobsDO } from "./blobs.ts";

// Simple environment interface for DECONFIG DurableObjects
interface DeconfigEnv {
  // References to other DECONFIG DOs
  BRANCH: DurableObjectNamespace<Branch>;
  BLOBS: DurableObjectNamespace<BlobsDO>;
}

const BLOB_DO = "blob-1";
export const BranchId = {
  build(name: string, projectId: string) {
    return `${projectId}-${name}`;
  },
};

const BlobAddress = {
  hash(address: string) {
    const [_, __, hash] = address.split(":");
    return hash;
  },
  address(projectId: string, hash: string) {
    return `blobs:${Blobs.doName(projectId)}:${hash}` as BlobAddress;
  },
};

const Blobs = {
  doName(projectId: string) {
    return `${projectId}-${BLOB_DO}`;
  },
};

/**
 * File path string (e.g., "/path/to/file.txt")
 */
export type FilePath = string;

/**
 * Blob address in format: "$OBJECT:$OBJECT_ID:$HASH"
 * Examples: "blobs:blob-1:abc123...", "r2:bucket-name:def456..."
 */
export type BlobAddress = `${"blobs"}:${string}:${string}`;

/**
 * Metadata for a file in the branch tree.
 */
export interface FileMetadata {
  /** Blob address where the file content is stored */
  address: BlobAddress;
  /** User-defined metadata (arbitrary key-value pairs) */
  // deno-lint-ignore no-explicit-any
  metadata: Record<string, any>;
  /** Size of the file content in bytes */
  sizeInBytes: number;
  /** Modified time - changes when content changes */
  mtime: number;
  /** Change time - changes when content OR metadata changes */
  ctime: number;
}

/**
 * A tree represents a snapshot of the filesystem state.
 * Maps file paths to their metadata.
 */
export type Tree = Record<FilePath, FileMetadata>;

/**
 * A patch represents changes to the filesystem tree.
 * Only stores what changed, not the entire tree state.
 */
export interface TreePatch {
  /** Patch ID for ordering */
  id: number;
  /** Timestamp when patch was created */
  timestamp: number;
  /** Files that were added or modified (path -> metadata) */
  added: Record<FilePath, FileMetadata>;
  /** Files that were deleted (just the paths) */
  deleted: FilePath[];
  /** Optional patch metadata (commit message, author, etc.) */
  metadata?: Record<string, unknown>;
}

/**
 * The complete state of a branch including its current tree and metadata.
 */
export interface BranchState {
  /** Name of the origin branch, or null if no origin */
  origin: string | null;
  /** Current tree state (always up-to-date) */
  tree: Tree;
  /** Current patch ID (for ordering) */
  seq: number;
  /** Project ID that owns this branch */
  projectId: string | null;
  /** Name/ID of this branch */
  name: string | null;
}

/**
 * Combined file content and metadata response.
 */
export interface FileResponse {
  /** ReadableStream of the file content */
  stream: ReadableStream<Uint8Array>;
  /** File metadata including blob address and timestamps */
  metadata: FileMetadata;
}

/**
 * A single file patch operation.
 */
export interface FilePatch {
  /** The file path to write or delete */
  path: FilePath;
  /** File content - null means deletion, otherwise write operation */
  content: ReadableStream<Uint8Array> | ArrayBuffer | null;
  /** Optional user-defined metadata (ignored for deletions) */
  metadata?: Record<string, unknown>;
  /** Expected change time for conditional operations */
  expectedCtime?: number;
}

/**
 * Input for transactional write operations.
 */
export interface TransactionalWriteInput {
  /** Array of file patches - content null means deletion */
  patches: Array<FilePatch>;
}

/**
 * Result of a single file patch operation.
 */
export interface FilePatchResult {
  /** Whether the patch was successfully applied */
  success: boolean;
  /** File metadata after the operation (null for deletions, undefined for failed operations) */
  metadata: FileMetadata | null;
  /** Blob address where content is stored (only for successful writes) */
  address?: BlobAddress;
  /** Reason for failure or conflict resolution */
  reason?: string;
  /** Conflict information if applicable */
  conflict?: {
    expectedCtime: number;
    actualCtime: number;
    resolved: "local" | "remote";
  };
}

/**
 * Result of a transactional write operation.
 */
export interface TransactionalWriteResult {
  /** Results for each file patch, keyed by file path */
  results: Record<FilePath, FilePatchResult>;
}

/**
 * Options for watching file changes.
 */
export interface WatchOptions {
  /** Optional ctime to start watching from. If provided, will return latest change if newer, or nothing if equal/older */
  fromCtime?: number;
  /** Optional path prefix filter - only watch files matching this prefix */
  pathFilter?: string;
}

/** q
 * File change event sent through the watch stream.
 */
export interface FileChangeEvent {
  /** Type of change */
  type: "added" | "modified" | "deleted";
  /** File path that changed */
  path: FilePath;
  /** New metadata (for added/modified) */
  metadata?: FileMetadata;
  /** Timestamp when change occurred */
  timestamp: number;
  /** Patch ID for ordering */
  patchId: number;
}

/**
 * A single diff entry describing how this branch (B) should change
 * to match another branch (A). If metadata is null, B should delete the path.
 */
export interface DiffEntry {
  path: FilePath;
  metadata: FileMetadata | null; // desired state from A, or null to delete
}

/**
 * Merge strategy for combining two branch trees.
 */
export enum MergeStrategy {
  /** Override all conflicts with remote version */
  OVERRIDE = "OVERRIDE",
  /** Use file with latest modification time (mtime) */
  LAST_WRITE_WINS = "LAST_WRITE_WINS",
}

/**
 * A conflict entry when merging branches.
 * Represents a file that was changed locally but also changed remotely
 * with a newer modification time.
 */
export interface ConflictEntry {
  /** File path that has a conflict */
  path: FilePath;
  /** Local file metadata */
  localMetadata: FileMetadata;
  /** Remote file metadata (with newer mtime) */
  remoteMetadata: FileMetadata;
  /** Which version was chosen in resolution */
  resolved: "local" | "remote";
}

/**
 * Result of a merge operation.
 */
export interface MergeResult {
  /** Whether the merge was successful */
  success: boolean;
  /** Number of files merged */
  filesMerged: number;
  /** Conflicts detected (only for LAST_WRITE_WINS strategy) */
  conflicts?: ConflictEntry[];
  /** Files that were added from remote */
  added: FilePath[];
  /** Files that were modified from remote */
  modified: FilePath[];
  /** Files that were deleted (present locally but not remotely) */
  deleted: FilePath[];
}

/**
 * Configuration for creating a new branch.
 */
export interface BranchConfig {
  /** The project ID that owns this branch */
  projectId: string;
  /** Optional branch name (defaults to auto-generated) */
  branchName?: string;
  /** Initial tree state (for efficient branching) */
  tree?: Tree;
  /** Origin branch name (for tracking lineage) */
  origin?: string | null;
}

/**
 * RpcTarget for Branch operations with project context.
 *
 * This pattern allows the branch to access its project ID and blob storage
 * while maintaining clean RPC interfaces.
 */
export class BranchRpc extends RpcTarget {
  constructor(
    private branchDO: Branch,
    private projectId: string,
  ) {
    super();
  }

  /**
   * Write file content from a ReadableStream.
   */
  async writeFile(
    path: FilePath,
    content: ReadableStream<Uint8Array>,
    metadata?: Record<string, unknown>,
  ): Promise<FileMetadata>;

  /**
   * Write file content from an ArrayBuffer.
   */
  async writeFile(
    path: FilePath,
    content: ArrayBuffer,
    metadata?: Record<string, unknown>,
  ): Promise<FileMetadata>;

  /**
   * Write file content and store it in the project's blob storage.
   */
  writeFile(
    path: FilePath,
    content: ReadableStream<Uint8Array> | ArrayBuffer,
    metadata: Record<string, unknown> = {},
  ): Promise<FileMetadata> {
    return this.branchDO.writeFile(path, content, metadata, this.projectId);
  }

  /**
   * Get file metadata by path.
   */
  getFileMetadata(path: FilePath): FileMetadata | null {
    return this.branchDO.getFileMetadata(path);
  }

  /**
   * Get file content as a ReadableStream.
   */
  getFileStream(path: FilePath): Promise<ReadableStream<Uint8Array> | null> {
    return this.branchDO.getFileStream(path);
  }

  /**
   * Get both file content and metadata.
   */
  getFile(path: FilePath): Promise<FileResponse | null> {
    return this.branchDO.getFile(path);
  }

  /**
   * List files in the branch tree.
   */
  listFiles(prefix?: string): FilePath[] {
    const tree = this.getFiles(prefix);
    return Object.keys(tree);
  }

  /**
   * Get files with their metadata from the branch tree.
   * When includeContent is true, files will include content as base64.
   */
  getFiles(
    prefix?: string | string[],
    includeContent?: boolean,
  ): Tree | Promise<Tree> {
    if (includeContent) {
      return this.branchDO.listFilesWithContent(prefix);
    }
    return this.branchDO.listFiles(prefix);
  }

  /**
   * Check if a file exists in the current tree.
   */
  hasFile(path: FilePath): boolean {
    return this.branchDO.hasFile(path);
  }

  /**
   * Delete a file from the current tree.
   */
  deleteFile(path: FilePath): boolean {
    return this.branchDO.deleteFile(path);
  }

  /**
   * Create a new branch from the current branch.
   */
  branch(newBranchId: string): Promise<Rpc.Stub<BranchRpc>> {
    return this.branchDO.branch(newBranchId);
  }

  /**
   * Perform multiple conditional writes atomically with prefix support.
   */
  transactionalWrite(
    input: TransactionalWriteInput,
    force: boolean = false,
  ): Promise<TransactionalWriteResult> {
    return this.branchDO.transactionalWrite(input, force);
  }

  /**
   * Get the origin branch name.
   */
  getOrigin(): string | null {
    return this.branchDO.getOrigin();
  }

  /**
   * Set the origin branch.
   */
  setOrigin(origin: string | null): void {
    return this.branchDO.setOrigin(origin);
  }

  /**
   * Watch for file changes (SSE byte stream).
   */
  watch(options: WatchOptions = {}): ReadableStream<Uint8Array> {
    return this.branchDO.watch(options);
  }

  /**
   * Compute diff of this branch (B) against another (A).
   */
  async diff(otherBranchId: string): Promise<DiffEntry[]> {
    return await this.branchDO.diff(otherBranchId);
  }

  /**
   * Merge another branch into this one using diff + transactionalWrite pattern.
   */
  async merge(
    otherBranchId: string,
    strategy: MergeStrategy,
  ): Promise<MergeResult> {
    return await this.branchDO.merge(otherBranchId, strategy);
  }

  /**
   * Soft delete the branch by clearing all files from the current tree.
   */
  softDelete(): number {
    return this.branchDO.softDelete();
  }
}

/**
 * Branch Durable Object for managing versioned file trees.
 *
 * Each branch maintains:
 * - An origin (parent branch or null)
 * - A history of trees (git-like commits)
 * - Current in-memory state with SQLite persistence
 *
 * Operations are O(1) for branch cloning and efficient for file operations.
 * Must be accessed through BranchRpc with project context.
 */
export class Branch extends DurableObject<DeconfigEnv> {
  private sql: SqlStorage;
  private state: BranchState = {
    origin: null,
    tree: {},
    seq: 0,
    projectId: null,
    name: null,
  };

  // Watch infrastructure
  private watchers = new Set<ReadableStreamDefaultController<Uint8Array>>();

  constructor(state: DurableObjectState, env: DeconfigEnv) {
    super(state, env);
    this.sql = this.ctx.storage.sql;
    this.initializeStorage();
    this.loadState();
  }

  /**
   * Get the current tree (active filesystem state).
   */
  getCurrentTree(): Tree {
    return this.state.tree;
  }

  /**
   * Initialize a new branch with configuration.
   */
  new(config: BranchConfig): BranchRpc {
    this.state.projectId ??= config.projectId;
    this.state.name ??= config.branchName ?? null;

    // If we have an initial tree, create the first patch
    if (config.tree && Object.keys(config.tree).length > 0) {
      this.patch({
        added: config.tree,
        deleted: [],
      });
    } else {
      this.saveState();
    }

    return new BranchRpc(this, config.projectId);
  }

  /**
   * Initialize the SQLite storage schema for branch state.
   * @private
   */
  private initializeStorage() {
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS branch_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        state_json TEXT NOT NULL
      )
    `);

    // Create patches table for efficient patch storage
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS patches (
        id INTEGER PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        added_json TEXT NOT NULL,
        deleted_json TEXT NOT NULL,
        metadata_json TEXT
      )
    `);
  }

  /**
   * Watch for file changes in real-time.
   */
  watch(options: WatchOptions = {}): ReadableStream<Uint8Array> {
    let controller: ReadableStreamDefaultController<Uint8Array>;

    const stream = new ReadableStream<Uint8Array>({
      start: (ctrl) => {
        controller = ctrl;
        this.watchers.add(controller);

        if (options.fromCtime !== undefined) {
          this.sendHistoricalChanges(controller, options);
        }
      },

      cancel: () => {
        if (controller) {
          this.watchers.delete(controller);
        }
      },
    });

    return stream;
  }

  /**
   * Send historical changes since fromCtime.
   * @private
   */
  private sendHistoricalChanges(
    controller: ReadableStreamDefaultController<Uint8Array>,
    options: WatchOptions,
  ) {
    if (typeof options.fromCtime !== "number") return;

    const result = this.sql.exec(
      "SELECT id, timestamp, added_json, deleted_json FROM patches WHERE timestamp > ? ORDER BY id",
      options.fromCtime,
    );

    // Track paths we've already sent events for to ensure one event per path
    const processedPaths = new Set<FilePath>();

    for (const row of result) {
      const added = JSON.parse(row.added_json as string) as Record<
        FilePath,
        FileMetadata
      >;
      const deleted = JSON.parse(row.deleted_json as string) as FilePath[];
      const timestamp = row.timestamp as number;
      const patchId = row.id as number;

      // Process added/modified files
      for (const [path, metadata] of Object.entries(added)) {
        if (options.pathFilter && !path.startsWith(options.pathFilter)) {
          continue;
        }

        // Skip if we've already processed this path
        if (processedPaths.has(path)) {
          continue;
        }

        // Mark as processed and send event immediately
        processedPaths.add(path);

        // Determine if this is an add or modify based on current tree state
        const type = this.state.tree[path] ? "modified" : "added";

        const event: FileChangeEvent = {
          type,
          path,
          metadata,
          timestamp,
          patchId,
        };

        this.sendSSE(controller, {
          type: "change",
          data: JSON.stringify(event),
        });
      }

      // Process deleted files
      for (const path of deleted) {
        if (options.pathFilter && !path.startsWith(options.pathFilter)) {
          continue;
        }

        // Skip if we've already processed this path
        if (processedPaths.has(path)) {
          continue;
        }

        // Mark as processed and send event immediately
        processedPaths.add(path);

        const event: FileChangeEvent = {
          type: "deleted",
          path,
          timestamp,
          patchId,
        };

        this.sendSSE(controller, {
          type: "change",
          data: JSON.stringify(event),
        });
      }
    }
  }

  /**
   * Send SSE-formatted message to a controller.
   * @private
   */
  private sendSSE(
    controller: ReadableStreamDefaultController<Uint8Array>,
    message: { type: string; data: string },
  ) {
    const sseMessage = `event: ${message.type}\ndata: ${message.data}\n\n`;
    const bytes = new TextEncoder().encode(sseMessage);

    try {
      controller.enqueue(bytes);
    } catch {
      this.watchers.delete(controller);
    }
  }

  /**
   * Notify all watchers about changes in a patch.
   * @private
   */
  private notifyWatchers(patch: TreePatch) {
    if (this.watchers.size === 0) return;

    const events: FileChangeEvent[] = [];

    // Create events for added/modified files
    for (const [path, metadata] of Object.entries(patch.added)) {
      events.push({
        type: "added",
        path,
        metadata,
        timestamp: patch.timestamp,
        patchId: patch.id,
      });
    }

    // Create events for deleted files
    for (const path of patch.deleted) {
      events.push({
        type: "deleted",
        path,
        timestamp: patch.timestamp,
        patchId: patch.id,
      });
    }

    // Send events to all watchers
    for (const controller of this.watchers) {
      for (const event of events) {
        this.sendSSE(controller, {
          type: "change",
          data: JSON.stringify(event),
        });
      }
    }
  }

  private applyPatch(patch: TreePatch) {
    const newTree: Tree = { ...this.state.tree };

    // Apply additions/modifications
    for (const [path, metadata] of Object.entries(patch.added)) {
      newTree[path] = metadata;
    }

    // Apply deletions
    for (const path of patch.deleted) {
      delete newTree[path];
    }
    return newTree;
  }

  /**
   * Apply a patch to the current tree and store it in the database.
   */
  patch(patchData: {
    added: Record<FilePath, FileMetadata>;
    deleted: FilePath[];
    metadata?: Record<string, unknown>;
  }): void {
    const now = Date.now();

    // Increment and update the patch ID immediately to avoid conflicts
    this.state.seq += 1;
    const patchId = this.state.seq;

    // Create the patch
    const patch: TreePatch = {
      id: patchId,
      timestamp: now,
      added: patchData.added,
      deleted: patchData.deleted,
      metadata: patchData.metadata,
    };

    // Apply patch to current tree
    const newTree: Tree = this.applyPatch({
      id: patchId,
      timestamp: now,
      added: patchData.added,
      deleted: patchData.deleted,
      metadata: patchData.metadata,
    });

    // Store patch in database
    this.sql.exec(
      "INSERT INTO patches (id, timestamp, added_json, deleted_json, metadata_json) VALUES (?, ?, ?, ?, ?)",
      patch.id,
      patch.timestamp,
      JSON.stringify(patch.added),
      JSON.stringify(patch.deleted),
      JSON.stringify(patch.metadata || {}),
    );

    // Update in-memory state
    this.state.tree = newTree;

    // Save current state
    this.saveState();

    // Notify watchers about the changes
    this.notifyWatchers(patch);
  }

  /**
   * Load the branch state from SQLite into memory.
   * @private
   */
  private loadState() {
    const result = this.sql.exec(
      "SELECT state_json FROM branch_state WHERE id = 1",
    );
    const { value } = result.next();

    if (value) {
      this.state = JSON.parse(value.state_json as string);
    } else {
      // Initialize empty state
      this.state = {
        origin: null,
        tree: {},
        seq: 0,
        projectId: null,
        name: null,
      };
      this.saveState();
    }
  }

  /**
   * Save the current in-memory state to SQLite.
   * @private
   */
  private saveState() {
    const stateJson = JSON.stringify(this.state);
    this.sql.exec(
      "INSERT OR REPLACE INTO branch_state (id, state_json) VALUES (1, ?)",
      stateJson,
    );
  }

  /**
   * Write file content and store it in blob storage.
   */
  async writeFile(
    path: FilePath,
    content: ReadableStream<Uint8Array> | ArrayBuffer,
    metadata: Record<string, unknown>,
    projectId: string,
  ): Promise<FileMetadata> {
    // Store content in blob storage using the overloaded put method
    using blobInfo = await this.blobs.put(content as ArrayBuffer);

    // Create blob address
    const address: BlobAddress = BlobAddress.address(projectId, blobInfo.hash);

    // Create file metadata
    const now = Date.now();
    const fileMetadata: FileMetadata = {
      address,
      metadata,
      sizeInBytes: blobInfo.sizeInBytes,
      mtime: now,
      ctime: now,
    };

    // Apply patch with single file change
    this.patch({
      added: { [path]: fileMetadata },
      deleted: [],
    });

    return fileMetadata;
  }

  /**
   * Get file metadata by path.
   */
  getFileMetadata(path: FilePath): FileMetadata | null {
    return this.state.tree[path] || null;
  }

  /**
   * Get file content as a ReadableStream.
   */
  async getFileStream(
    path: FilePath,
  ): Promise<ReadableStream<Uint8Array> | null> {
    const fileMetadata = this.getFileMetadata(path);
    if (!fileMetadata) {
      return null;
    }

    // Get blob content
    using stream = await this.blobs.getStream(
      BlobAddress.hash(fileMetadata.address),
    );
    return stream;
  }

  /**
   * Get both file content and metadata.
   */
  async getFile(path: FilePath): Promise<FileResponse | null> {
    const metadata = this.getFileMetadata(path);
    if (!metadata) {
      return null;
    }

    const stream = await this.getFileStream(path);
    if (!stream) {
      return null;
    }

    return { stream, metadata };
  }

  /**
   * Delete a file from the current tree.
   */
  deleteFile(path: FilePath): boolean {
    const currentTree = this.state.tree;

    if (!(path in currentTree)) {
      return false;
    }

    // Apply patch with single file deletion
    this.patch({
      added: {},
      deleted: [path],
    });

    return true;
  }

  /**
   * List files that start with the given prefix.
   */
  listFiles(prefix?: string | string[]): Tree {
    const currentTree = this.state.tree;
    const matchingFiles: Tree = {};

    for (const filePath in currentTree) {
      if (
        !prefix ||
        (Array.isArray(prefix)
          ? prefix.some((p) => filePath.startsWith(p))
          : filePath.startsWith(prefix))
      ) {
        matchingFiles[filePath] = currentTree[filePath];
      }
    }
    return matchingFiles;
  }

  /**
   * List files with their content included as base64 in the metadata.
   */
  async listFilesWithContent(prefix?: string | string[]): Promise<Tree> {
    const currentTree = this.state.tree;
    const matchingFiles: Record<FilePath, FileMetadata> = {};

    // First, collect matching files
    for (const filePath in currentTree) {
      if (
        !prefix ||
        (Array.isArray(prefix)
          ? prefix.some((p) => filePath.startsWith(p))
          : filePath.startsWith(prefix))
      ) {
        matchingFiles[filePath] = currentTree[filePath];
      }
    }

    // Extract unique hashes for batch retrieval
    const hashes = Array.from(
      new Set(
        Object.values(matchingFiles).map((metadata) =>
          BlobAddress.hash(metadata.address),
        ),
      ),
    );

    // Batch retrieve all blob contents
    using blobContents = await this.blobs.getBatch(hashes);

    // Build result with content included in metadata
    const result: Tree = {};
    for (const [filePath, metadata] of Object.entries(matchingFiles)) {
      const hash = BlobAddress.hash(metadata.address);
      const content = blobContents.get(hash);

      // Create enriched metadata with base64 content
      const enrichedMetadata: FileMetadata & { content?: string } = {
        ...metadata,
      };

      if (content) {
        const uint8Array = new Uint8Array(content);
        enrichedMetadata.content = btoa(String.fromCharCode(...uint8Array));
      }

      result[filePath] = enrichedMetadata;
    }

    return result;
  }

  /**
   * Check if a file exists in the current tree.
   */
  hasFile(path: FilePath): boolean {
    const currentTree = this.state.tree;
    return path in currentTree;
  }

  /**
   * Get the origin branch name.
   */
  getOrigin(): string | null {
    return this.state.origin;
  }

  /**
   * Set the origin branch.
   */
  setOrigin(origin: string | null): void {
    this.state.origin = origin;
    this.saveState();
  }

  /**
   * Soft delete the branch by clearing all files from the current tree.
   */
  softDelete(): number {
    const currentTree = this.state.tree;
    const fileCount = Object.keys(currentTree).length;

    if (fileCount === 0) {
      return 0;
    }

    // Create a patch that deletes all current files
    const allFilePaths = Object.keys(currentTree);

    this.patch({
      added: {},
      deleted: allFilePaths,
      metadata: {
        type: "softDelete",
        deletedFileCount: fileCount,
        timestamp: Date.now(),
      },
    });

    return fileCount;
  }

  /**
   * Create a new branch by branching from this one.
   */
  async branch(newBranchId: string): Promise<Rpc.Stub<BranchRpc>> {
    if (!this.state.projectId) {
      throw new Error("Cannot branch: branch has no project ID");
    }

    // Get current tree snapshot for the new branch
    const currentTree = { ...this.state.tree };

    // Create new branch stub
    const newBranchStub = this.env.BRANCH!.get(
      this.env.BRANCH!.idFromName(
        BranchId.build(newBranchId, this.state.projectId),
      ),
    );

    // Initialize new branch with current tree and this branch as origin
    using newBranchRpc = await newBranchStub.new({
      projectId: this.state.projectId,
      branchName: newBranchId,
      tree: currentTree,
      origin: this.state.name || newBranchId,
    });

    return newBranchRpc;
  }

  /**
   * Internal method to perform transactional writes.
   */
  private internalTransactionalWrite(
    writes: Record<
      FilePath,
      { metadata: FileMetadata | null; condition?: { expectedCtime: number } }
    >,
    force: boolean = false,
    timestamp?: number,
    preserveTimestamps: boolean = false,
  ): Record<FilePath, FilePatchResult> {
    const results: Record<FilePath, FilePatchResult> = {};
    const toApply: Record<FilePath, FileMetadata | null> = {};
    const now = timestamp ?? Date.now();

    // Process each write operation
    for (const [path, write] of Object.entries(writes)) {
      const currentFile = this.state.tree[path];

      // If no condition, apply directly
      if (!write.condition) {
        const finalMetadata =
          write.metadata === null
            ? null
            : preserveTimestamps
              ? write.metadata
              : {
                  ...write.metadata,
                  ctime: now,
                };
        toApply[path] = finalMetadata;

        results[path] = {
          success: true,
          metadata: finalMetadata,
          address: finalMetadata?.address,
        };
        continue;
      }

      // Check condition
      const actualCtime = currentFile?.ctime || 0;
      const expectedCtime = write.condition.expectedCtime;
      const isConflict = actualCtime !== expectedCtime;

      if (!isConflict) {
        // No conflict - apply the change
        const finalMetadata =
          write.metadata === null
            ? null
            : preserveTimestamps
              ? write.metadata
              : {
                  ...write.metadata,
                  ctime: now,
                };
        toApply[path] = finalMetadata;

        results[path] = {
          success: true,
          metadata: finalMetadata,
          address: finalMetadata?.address,
        };
        continue;
      }

      // Handle conflict
      if (!force) {
        throw new Error(
          `Conflict on ${path}: expected ctime ${expectedCtime}, got ${actualCtime}`,
        );
      }

      // LAST_WRITE_WINS: compare modification times
      const currentMtime = currentFile?.mtime || 0;
      const newMtime = write.metadata?.mtime || 0;

      if (newMtime > currentMtime) {
        // New version is newer - apply it
        const finalMetadata =
          write.metadata === null
            ? null
            : preserveTimestamps
              ? write.metadata
              : {
                  ...write.metadata,
                  ctime: now,
                };
        toApply[path] = finalMetadata;

        results[path] = {
          success: true,
          metadata: finalMetadata,
          address: finalMetadata?.address,
          reason: "Conflict resolved: remote version chosen",
          conflict: {
            expectedCtime,
            actualCtime,
            resolved: "remote",
          },
        };
      } else {
        // Current version is newer or same - keep current
        results[path] = {
          success: false,
          metadata: currentFile || undefined,
          reason: "Conflict resolved: local version kept",
          conflict: {
            expectedCtime,
            actualCtime,
            resolved: "local",
          },
        };
      }
    }

    // Apply all approved changes in a single patch
    if (Object.keys(toApply).length > 0) {
      const addedFiles: Record<FilePath, FileMetadata> = {};
      const deletedFiles: FilePath[] = [];

      for (const [path, metadata] of Object.entries(toApply)) {
        if (metadata === null) {
          deletedFiles.push(path);
        } else {
          addedFiles[path] = metadata;
        }
      }

      this.patch({
        added: addedFiles,
        deleted: deletedFiles,
        metadata: {
          type: force ? "transactionalWrite_force" : "transactionalWrite",
          conflictCount: Object.values(results).filter((r) => r.conflict)
            .length,
        },
      });
    }

    return results;
  }

  private get blobs() {
    const projectId = this.state.projectId;
    if (!projectId) {
      throw new Error(
        "Cannot get blobs: branch has no project ID, you may want to call .new() before using it",
      );
    }
    return this.env.BLOBS!.get(
      this.env.BLOBS!.idFromName(Blobs.doName(this.state.projectId!)),
    );
  }

  /**
   * Write multiple files atomically with optional conditions.
   */
  async transactionalWrite(
    input: TransactionalWriteInput,
    force: boolean = false,
  ): Promise<TransactionalWriteResult> {
    // Step 1: Separate writes and deletions, upload blobs for writes
    const writePatches = input.patches.filter((p) => p.content !== null);
    const deletePatches = input.patches.filter((p) => p.content === null);

    // Upload all blobs in batch (only for write operations)
    const contents = writePatches.map((patch) => patch.content!);
    using blobInfos = await this.blobs.putBatch(contents);

    // Step 2: Prepare writes with blob addresses and conditions
    const writes: Record<
      FilePath,
      { metadata: FileMetadata | null; condition?: { expectedCtime: number } }
    > = {};
    const now = Date.now();

    // Handle write operations
    for (let idx = 0; idx < writePatches.length; idx++) {
      const patch = writePatches[idx];
      const blobInfo = blobInfos[idx];

      writes[patch.path] = {
        metadata: {
          address: BlobAddress.address(this.state.projectId!, blobInfo.hash),
          metadata: patch.metadata || {},
          sizeInBytes: blobInfo.sizeInBytes,
          mtime: now,
          ctime: now,
        },
        condition:
          patch.expectedCtime !== undefined
            ? { expectedCtime: patch.expectedCtime }
            : undefined,
      };
    }

    // Handle deletion operations
    for (const patch of deletePatches) {
      writes[patch.path] = {
        metadata: null,
        condition:
          patch.expectedCtime !== undefined
            ? { expectedCtime: patch.expectedCtime }
            : undefined,
      };
    }

    // Step 3: Apply writes using internal method
    const result = this.internalTransactionalWrite(writes, force, now);

    // Step 4: Transform result to match TransactionalWriteResult interface
    const results: Record<FilePath, FilePatchResult> = {};

    // Handle all applied operations
    for (const [path, metadata] of Object.entries(result)) {
      results[path] = metadata;
    }

    return { results };
  }

  /**
   * Compute diff against another branch's current tree.
   */
  async diff(otherBranchId: string): Promise<DiffEntry[]> {
    const otherStub = this.env.BRANCH!.get(
      this.env.BRANCH!.idFromName(
        BranchId.build(otherBranchId, this.state.projectId!),
      ),
    );
    using otherTree = await otherStub.getCurrentTree();
    const thisTree = this.state.tree;

    const allPaths = new Set<string>([
      ...Object.keys(thisTree),
      ...Object.keys(otherTree),
    ]);
    const diffs: DiffEntry[] = [];

    for (const path of allPaths) {
      // deno-lint-ignore no-explicit-any
      const aMeta = otherTree[path] as any as FileMetadata; // desired
      const bMeta = thisTree[path] as FileMetadata; // current

      if (!aMeta && !bMeta) continue;

      if (aMeta && !bMeta) {
        diffs.push({ path, metadata: aMeta });
        continue;
      }

      if (!aMeta && bMeta) {
        diffs.push({ path, metadata: null } as DiffEntry);
        continue;
      }

      const equalAddress = aMeta!.address === bMeta!.address;
      const equalUserMeta =
        JSON.stringify(aMeta!.metadata) === JSON.stringify(bMeta!.metadata);

      if (!(equalAddress && equalUserMeta)) {
        diffs.push({ path, metadata: aMeta! });
      }
    }

    return diffs;
  }

  /**
   * Merge another branch into this one using diff + transactionalWrite pattern.
   */
  async merge(
    otherBranchId: string,
    strategy: MergeStrategy,
  ): Promise<MergeResult> {
    // Step 1: Get the diff between this branch and the other
    const diffs = await this.diff(otherBranchId);

    if (diffs.length === 0) {
      return {
        success: true,
        filesMerged: 0,
        conflicts: strategy === MergeStrategy.LAST_WRITE_WINS ? [] : undefined,
        added: [],
        modified: [],
        deleted: [],
      };
    }

    // Step 2: Convert diff entries to transactional write input
    const added: FilePath[] = [];
    const modified: FilePath[] = [];
    const deleted: FilePath[] = [];

    // Step 3: Apply changes using transactionalWrite with force flag
    const force = strategy === MergeStrategy.LAST_WRITE_WINS;

    // We need a special version of transactionalWrite that doesn't upload blobs
    const writes: Record<
      FilePath,
      { metadata: FileMetadata | null; condition?: { expectedCtime: number } }
    > = {};

    // Convert diff entries directly to writes
    for (const diff of diffs) {
      const currentFile = this.state.tree[diff.path];
      writes[diff.path] = {
        metadata: diff.metadata,
        condition:
          strategy === MergeStrategy.LAST_WRITE_WINS && currentFile
            ? { expectedCtime: currentFile.ctime }
            : undefined,
      };

      if (diff.metadata === null) {
        deleted.push(diff.path);
      } else {
        const isNewFile = !currentFile;
        if (isNewFile) {
          added.push(diff.path);
        } else {
          modified.push(diff.path);
        }
      }
    }

    // For merge operations, preserve original file timestamps
    const result = this.internalTransactionalWrite(
      writes,
      force,
      undefined,
      true,
    );

    // Step 4: Transform conflicts to merge format
    const conflicts: ConflictEntry[] = [];
    for (const [path, res] of Object.entries(result)) {
      if (res.conflict) {
        const localMeta = this.state.tree[path];
        const diffEntry = diffs.find((d) => d.path === path);
        const remoteMeta = diffEntry?.metadata;

        conflicts.push({
          path,
          localMetadata: localMeta!,
          remoteMetadata: remoteMeta!,
          resolved: res.conflict!.resolved,
        });
      }
    }

    return {
      success: true,
      filesMerged: Object.values(result).filter((r) => r.success).length,
      conflicts:
        strategy === MergeStrategy.LAST_WRITE_WINS ? conflicts : undefined,
      added: added.filter((path) => result[path]?.success),
      modified: modified.filter((path) => result[path]?.success),
      deleted: deleted.filter(
        (path) => result[path]?.success && result[path]?.metadata === null,
      ),
    };
  }
}

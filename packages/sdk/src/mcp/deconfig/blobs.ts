import { DurableObject } from "cloudflare:workers";

/**
 * Information about a stored blob including its content hash and size.
 */
export interface BlobInfo {
  /** SHA-256 hash of the blob content */
  hash: string;
  /** Size of the blob content in bytes */
  sizeInBytes: number;
}

/**
 * Content Addressable Storage (CAS) Durable Object for storing binary blobs.
 *
 * Blobs are stored by their SHA-256 hash, ensuring content integrity and
 * automatic deduplication. The same content will always produce the same hash.
 */
export class Blobs extends DurableObject<unknown> {
  private sql: SqlStorage;

  constructor(state: DurableObjectState, env: unknown) {
    super(state, env);
    this.sql = this.ctx.storage.sql;
    this.initializeStorage();
  }

  /**
   * Initialize the SQLite storage schema for blobs.
   * @private
   */
  private initializeStorage() {
    // Simple CAS table: HASH => Content
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS blobs (
        hash TEXT PRIMARY KEY,
        content BLOB NOT NULL
      )
    `);
  }

  /**
   * Calculate SHA-256 hash of the given buffer.
   * @private
   */
  private async calculateHash(buffer: ArrayBuffer): Promise<string> {
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  /**
   * Store blob content from a ReadableStream and return its info.
   */
  async put(content: ReadableStream<Uint8Array>): Promise<BlobInfo>;

  /**
   * Store blob content from an ArrayBuffer and return its info.
   */
  async put(content: ArrayBuffer): Promise<BlobInfo>;

  /**
   * Store blob content and return its calculated hash and size.
   */
  async put(
    content: ReadableStream<Uint8Array> | ArrayBuffer,
  ): Promise<BlobInfo> {
    let buffer: ArrayBuffer;

    if (content instanceof ArrayBuffer) {
      buffer = content;
    } else {
      // Convert stream to ArrayBuffer
      const reader = content.getReader();
      const chunks: Uint8Array[] = [];
      let totalLength = 0;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          totalLength += value.length;
        }
      } finally {
        reader.releaseLock();
      }

      // Combine chunks into single ArrayBuffer
      const combined = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }
      buffer = combined.buffer;
    }

    // Calculate hash from content
    const hash = await this.calculateHash(buffer);
    const sizeInBytes = buffer.byteLength;

    // Store content by hash (idempotent)
    this.sql.exec(
      "INSERT OR REPLACE INTO blobs (hash, content) VALUES (?, ?)",
      hash,
      buffer,
    );

    return {
      hash,
      sizeInBytes,
    };
  }

  /**
   * Retrieve blob content as a ReadableStream by its hash.
   */
  getStream(hash: string): ReadableStream<Uint8Array> | null {
    const result = this.sql.exec(
      "SELECT content FROM blobs WHERE hash = ?",
      hash,
    );
    const row = result.one();
    if (!row) {
      return null;
    }

    const content = row.content as ArrayBuffer;
    const uint8Array = new Uint8Array(content);

    return new ReadableStream({
      start(controller) {
        controller.enqueue(uint8Array);
        controller.close();
      },
    });
  }

  /**
   * Retrieve blob content as an ArrayBuffer by its hash.
   */
  getBuffer(hash: string): ArrayBuffer | null {
    const result = this.sql.exec(
      "SELECT content FROM blobs WHERE hash = ?",
      hash,
    );
    const row = result.one();
    if (!row) {
      return null;
    }
    return row.content as ArrayBuffer;
  }

  /**
   * Retrieve blob content as a ReadableStream by its hash (default method).
   */
  get(hash: string): ReadableStream<Uint8Array> | null {
    return this.getStream(hash);
  }

  /**
   * Check if a blob exists by its hash.
   */
  has(hash: string): boolean {
    const result = this.sql.exec("SELECT 1 FROM blobs WHERE hash = ?", hash);
    return !!result.one();
  }

  /**
   * Get blob metadata without transferring the content.
   */
  getInfo(hash: string): BlobInfo | null {
    const result = this.sql.exec(
      "SELECT LENGTH(content) as size FROM blobs WHERE hash = ?",
      hash,
    );
    const row = result.one();
    if (!row) {
      return null;
    }
    return {
      hash,
      sizeInBytes: row.size as number,
    };
  }

  /**
   * Store multiple blobs in a single batch operation.
   */
  async putBatch(
    contents: (ReadableStream<Uint8Array> | ArrayBuffer)[],
  ): Promise<BlobInfo[]> {
    // Process all content into buffers in parallel
    const bufferPromises = contents.map(async (content) => {
      if (content instanceof ArrayBuffer) {
        return content;
      } else {
        // Convert stream to ArrayBuffer
        const reader = content.getReader();
        const chunks: Uint8Array[] = [];
        let totalLength = 0;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            totalLength += value.length;
          }
        } finally {
          reader.releaseLock();
        }

        // Combine chunks into single ArrayBuffer
        const combined = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
          combined.set(chunk, offset);
          offset += chunk.length;
        }
        return combined.buffer;
      }
    });

    // Wait for all streams to be processed in parallel
    const buffers = await Promise.all(bufferPromises);

    // Calculate all hashes in parallel
    const hashPromises = buffers.map((buffer) => this.calculateHash(buffer));
    const hashes = await Promise.all(hashPromises);

    // Prepare results and batch data
    const results: BlobInfo[] = [];
    const batchData: Array<{ hash: string; content: ArrayBuffer }> = [];

    for (let i = 0; i < buffers.length; i++) {
      const buffer = buffers[i];
      const hash = hashes[i];
      const sizeInBytes = buffer.byteLength;

      batchData.push({ hash, content: buffer });
      results.push({ hash, sizeInBytes });
    }

    // Batch insert all blobs (using INSERT OR REPLACE for idempotency)
    for (const { hash, content } of batchData) {
      this.sql.exec(
        "INSERT OR REPLACE INTO blobs (hash, content) VALUES (?, ?)",
        hash,
        content,
      );
    }

    return results;
  }

  /**
   * Retrieve multiple blobs by their hashes in a single batch operation.
   * Returns a Map from hash to ArrayBuffer, with null values for missing blobs.
   */
  getBatch(hashes: string[]): Map<string, ArrayBuffer | null> {
    const result = new Map<string, ArrayBuffer | null>();

    // Initialize all hashes with null (not found)
    for (const hash of hashes) {
      result.set(hash, null);
    }

    if (hashes.length === 0) {
      return result;
    }

    // Create parameterized query for batch retrieval
    const placeholders = hashes.map(() => "?").join(",");
    const query = `SELECT hash, content FROM blobs WHERE hash IN (${placeholders})`;

    const sqlResult = this.sql.exec(query, ...hashes);

    // Update result map with found blobs
    for (const row of sqlResult) {
      const hash = row.hash as string;
      const content = row.content as ArrayBuffer;
      result.set(hash, content);
    }

    return result;
  }
}

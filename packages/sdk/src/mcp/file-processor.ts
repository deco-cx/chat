import { extname } from "@std/path/posix";
import {
  type FileExt,
  FileExtSchema,
  getExtensionFromContentType,
  isAllowedFileExt,
} from "../utils/knowledge.ts";
import { z } from "zod";

export { FileExtSchema } from "../utils/knowledge.ts";

export const FileMetadataSchema = z.object({
  fileSize: z.number(),
  chunkCount: z.number(),
  fileType: FileExtSchema,
});

// Document chunk structure
export interface DocumentChunk {
  content: string;
  metadata?: Record<string, unknown>;
}

// File processing types
export interface ProcessedDocument {
  filename: string;
  content: string;
  chunks: DocumentChunk[];
  metadata: z.infer<typeof FileMetadataSchema>;
}

interface FileProcessorConfig {
  chunkSize: number;
  chunkOverlap: number;
}

export class FileProcessor {
  private config: FileProcessorConfig;

  constructor(config: FileProcessorConfig) {
    this.config = config;
  }

  /**
   * Main entry point - processes a file from URL and returns structured data
   */
  async processFile(fileUrl: string): Promise<ProcessedDocument> {
    // Check if file starts with http or https
    if (!fileUrl.startsWith("http://") && !fileUrl.startsWith("https://")) {
      throw new Error("File URL must start with http:// or https://");
    }

    // Fetch the file from URL
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch file: ${response.status} ${response.statusText}`,
      );
    }

    // Get filename from URL or Content-Disposition header
    const filename = this.extractFilenameFromUrl(fileUrl, response);

    // Create File object from response
    const arrayBuffer = await response.arrayBuffer();
    const file = new File([arrayBuffer], filename, {
      type: response.headers.get("content-type") || "application/octet-stream",
    });

    const fileExt = extname(file.name);

    // Only allow specific file extensions
    if (!isAllowedFileExt(fileExt)) {
      throw new Error(`Unsupported file type: ${fileExt}.`);
    }

    let content = "";

    switch (fileExt) {
      case ".pdf":
        content = await this.processPDF(file);
        break;
      case ".txt":
      case ".md":
        content = await this.processText(file);
        break;
      case ".csv":
        content = await this.processCSV(file);
        break;
      case ".json":
        content = await this.processJSON(file);
        break;
    }

    const chunks = await this.chunkText(content, fileExt as FileExt);

    return {
      filename: file.name,
      content,
      chunks,
      metadata: {
        fileType: fileExt,
        fileSize: file.size,
        chunkCount: chunks.length,
      },
    };
  }

  /**
   * Extract filename from URL or Content-Disposition header
   */
  private extractFilenameFromUrl(url: string, response: Response): string {
    // First try to get filename from Content-Disposition header
    const contentDisposition = response.headers.get("content-disposition");
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(
        /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/,
      );
      if (filenameMatch && filenameMatch[1]) {
        return filenameMatch[1].replace(/['"]/g, "");
      }
    }

    // Fallback: extract filename from URL
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const filename = pathname.split("/").pop() || "unknown";

      // If no extension, try to guess from content-type
      if (!filename.includes(".")) {
        const contentType = response.headers.get("content-type");
        const extension = this.getExtensionFromContentType(contentType);
        return `${filename}${extension}`;
      }

      return filename;
    } catch {
      return "unknown.txt";
    }
  }
  /**
   * Get file extension from content-type header
   */
  private getExtensionFromContentType(_contentType: string | null): FileExt {
    return getExtensionFromContentType(_contentType);
  }

  private processPDF(_file: File): Promise<string> {
    throw new Error("PDF processing is disabled");
  }

  /**
   * Plain text processing
   */
  private async processText(file: File): Promise<string> {
    return await file.text();
  }

  /**
   * CSV processing
   */
  private async processCSV(file: File): Promise<string> {
    const text = await file.text();
    const lines = text.split("\n");

    if (lines.length === 0) return "";

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const rows = lines.slice(1).map((line) => {
      const values = line.split(",").map((v) => v.trim());
      return values
        .map((v, i) => (!v ? "" : `${headers[i]}: ${v}`))
        .filter(Boolean)
        .join(". ");
    });

    return rows.join("\n");
  }

  /**
   * JSON processing
   */
  private async processJSON(file: File): Promise<string> {
    const text = await file.text();
    const data = JSON.parse(text);

    // Deep recursion to convert all string properties higher than this.config.chunkSize into array of strings
    const processedData = this.chunkLongStringsInObject(data);

    // Convert JSON to readable text format
    return processedData;
  }

  /**
   * Recursively process an object to chunk long string properties
   */
  // deno-lint-ignore no-explicit-any
  private chunkLongStringsInObject(json: any): string {
    const parts: string[] = [];

    for (const [key, value] of Object.entries(json)) {
      if (value === null || value === undefined) continue;

      if (Array.isArray(value)) {
        if (value.length === 0) continue;

        // Array of primitives
        if (value.every((v) => typeof v !== "object" || v === null)) {
          parts.push(`${this.capitalize(key)}: ${value.join(", ")}`);
        } // Array of objects
        else {
          const objectItems = value
            .map((item) => {
              if (typeof item === "object" && item !== null) {
                const inner = this.chunkLongStringsInObject(item);
                return `(${inner})`;
              }
              return String(item);
            })
            .join(", ");
          parts.push(`${this.capitalize(key)}: ${objectItems}`);
        }
      } else if (typeof value === "object") {
        // Recursively flatten nested objects
        parts.push(
          `${this.capitalize(key)}: ${this.chunkLongStringsInObject(value)}`,
        );
      } else {
        // Primitive values
        parts.push(`${this.capitalize(key)}: ${value}`);
      }
    }

    return parts.join(". ") + ".";
  }

  private capitalize(str: string) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Text chunking with overlap
   */
  private chunkText(text: string, fileExt: FileExt): DocumentChunk[] {
    switch (fileExt) {
      case ".md":
        return this.chunkMarkdown(text);
      case ".csv":
        return this.chunkByLines(text);
      case ".txt":
      case ".json":
      case ".pdf":
      default:
        return this.chunkTextBySize(text);
    }
  }

  /**
   * Chunk markdown text while preserving section headers
   */
  private chunkMarkdown(text: string): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const lines = text.split("\n");
    let currentChunk = "";
    let currentHeaders: Record<string, string> = {};

    for (const line of lines) {
      // Check if line is a header
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headerMatch) {
        const level = headerMatch[1].length;
        const title = headerMatch[2];

        // Update headers tracking
        if (level === 1) {
          currentHeaders = { title };
        } else if (level === 2) {
          currentHeaders.section = title;
        }

        // If current chunk is getting too large, save it
        if (currentChunk.length > this.config.chunkSize) {
          chunks.push({
            content: currentChunk.trim(),
            metadata: { ...currentHeaders },
          });
          // Start new chunk with overlap
          const words = currentChunk.split(/\s+/);
          const overlapWords = words.slice(-this.getOverlapWords());
          currentChunk = overlapWords.join(" ") + "\n\n";
        }
      }

      currentChunk += line + "\n";

      // Check if chunk exceeds max size
      if (currentChunk.length > this.config.chunkSize * 1.5) {
        chunks.push({
          content: currentChunk.trim(),
          metadata: { ...currentHeaders },
        });
        // Start new chunk with overlap
        const words = currentChunk.split(/\s+/);
        const overlapWords = words.slice(-this.getOverlapWords());
        currentChunk = overlapWords.join(" ") + "\n";
      }
    }

    // Add remaining content
    if (currentChunk.trim().length > 0) {
      chunks.push({
        content: currentChunk.trim(),
        metadata: { ...currentHeaders },
      });
    }

    return chunks;
  }

  /**
   * Chunk text by lines (for CSV)
   */
  private chunkByLines(text: string): DocumentChunk[] {
    const lines = text.split("\n").filter((line) => line.trim().length > 0);
    const chunks: DocumentChunk[] = [];
    let currentChunk = "";

    for (const line of lines) {
      if (currentChunk.length + line.length + 1 > this.config.chunkSize) {
        if (currentChunk.length > 0) {
          chunks.push({ content: currentChunk.trim() });
        }
        currentChunk = line + "\n";
      } else {
        currentChunk += line + "\n";
      }
    }

    if (currentChunk.trim().length > 0) {
      chunks.push({ content: currentChunk.trim() });
    }

    return chunks;
  }

  /**
   * Chunk text by size with overlap (for general text, PDF, JSON)
   */
  private chunkTextBySize(text: string): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    // Split by sentences to try to keep semantic units together
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

    let currentChunk = "";

    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();

      // If adding this sentence exceeds chunk size
      if (
        currentChunk.length + trimmedSentence.length >
        this.config.chunkSize
      ) {
        if (currentChunk.length > 0) {
          chunks.push({ content: currentChunk.trim() });

          // Create overlap by taking last N words
          const words = currentChunk.split(/\s+/);
          const overlapWords = words.slice(-this.getOverlapWords());
          currentChunk = overlapWords.join(" ") + " " + trimmedSentence + " ";
        } else {
          // Sentence itself is too long, split it by words
          const words = trimmedSentence.split(/\s+/);
          for (let i = 0; i < words.length; i += this.config.chunkSize / 10) {
            const chunk = words
              .slice(i, i + this.config.chunkSize / 10)
              .join(" ");
            chunks.push({ content: chunk });
          }
          currentChunk = "";
        }
      } else {
        currentChunk += trimmedSentence + " ";
      }
    }

    // Add remaining content
    if (currentChunk.trim().length > 0) {
      chunks.push({ content: currentChunk.trim() });
    }

    return chunks;
  }

  /**
   * Calculate number of words for overlap based on chunk size and overlap setting
   */
  private getOverlapWords(): number {
    // Convert overlap from characters to approximate word count
    // Assuming average word length of 5 characters + 1 space
    return Math.floor(this.config.chunkOverlap / 6);
  }
}

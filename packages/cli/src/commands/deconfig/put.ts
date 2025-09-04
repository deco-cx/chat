import { readFileSync, existsSync } from "fs";
import { putFileContent } from "./base.js";
import { Buffer } from "node:buffer";
import process from "node:process";

interface PutOptions {
  path: string;
  branch: string;
  file?: string;
  content?: string;
  metadata?: string;
}

export async function putCommand(options: PutOptions): Promise<void> {
  const { path: filePath, branch, file, content, metadata } = options;

  console.log(`📤 Putting file "${filePath}" to branch "${branch}"`);

  try {
    let fileContent: Buffer | string;

    if (file) {
      // Read from local file
      if (!existsSync(file)) {
        throw new Error(`Local file not found: ${file}`);
      }
      fileContent = readFileSync(file);
      console.log(`   📁 Reading from: ${file}`);
    } else if (content !== undefined) {
      // Use provided content
      fileContent = content;
    } else {
      // Read from stdin
      console.log("   📝 Reading from stdin...");
      const chunks: Buffer[] = [];

      for await (const chunk of process.stdin) {
        chunks.push(chunk);
      }

      fileContent = Buffer.concat(chunks);
    }

    // Parse metadata if provided
    let parsedMetadata: Record<string, unknown> | undefined;
    if (metadata) {
      try {
        parsedMetadata = JSON.parse(metadata);
      } catch {
        throw new Error(`Invalid metadata JSON: ${metadata}`);
      }
    }

    // Put file content
    await putFileContent(filePath, fileContent, branch, parsedMetadata);

    const size = Buffer.isBuffer(fileContent)
      ? fileContent.length
      : Buffer.from(fileContent).length;
    console.log(`✅ File uploaded successfully (${size} bytes)`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (
      errorMessage.includes("Session not found") ||
      errorMessage.includes("Session expired")
    ) {
      console.error("💥 Put failed: Authentication required");
      console.error(
        "   Please run 'deco login' first to authenticate with deco.chat",
      );
    } else {
      console.error("💥 Put failed:", errorMessage);
    }

    process.exit(1);
  }
}

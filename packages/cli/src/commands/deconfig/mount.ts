import { existsSync, mkdirSync, writeFileSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import process from "node:process";
import { watch, type FileChangeEventWithContent } from "./base.js";

interface MountOptions {
  branchName: string;
  path: string;
  fromCtime?: number;
  pathFilter?: string;
}

// File system syncer implementation
function createFileSystemSyncer(localPath: string) {
  return (event: FileChangeEventWithContent): void => {
    const localFilePath = join(
      localPath,
      event.path.startsWith("/") ? event.path.slice(1) : event.path,
    );

    console.log(`📝 ${event.type.toUpperCase()}: ${event.path}`);

    switch (event.type) {
      case "added":
      case "modified":
        if (event.content) {
          try {
            // Ensure directory exists
            const dir = dirname(localFilePath);
            if (!existsSync(dir)) {
              mkdirSync(dir, { recursive: true });
            }

            // Write to local filesystem
            writeFileSync(localFilePath, event.content);

            console.log(
              `   ✅ Synced to: ${localFilePath} (${event.content.length} bytes)`,
            );
          } catch (error) {
            console.error(
              `   ❌ Failed to sync ${event.path}:`,
              error instanceof Error ? error.message : String(error),
            );
          }
        } else {
          console.warn(`   ⚠️  No content available for ${event.path}`);
        }
        break;

      case "deleted":
        try {
          if (existsSync(localFilePath)) {
            unlinkSync(localFilePath);
            console.log(`   🗑️  Deleted: ${localFilePath}`);
          } else {
            console.log(`   ℹ️  File already deleted: ${localFilePath}`);
          }
        } catch (error) {
          console.error(
            `   ❌ Failed to delete ${event.path}:`,
            error instanceof Error ? error.message : String(error),
          );
        }
        break;

      default:
        console.warn(`   ⚠️  Unknown event type: ${event.type}`);
    }
  };
}

export async function mountCommand(options: MountOptions): Promise<void> {
  const { branchName, path: localPath, fromCtime, pathFilter } = options;

  console.log(`🔗 Mounting branch "${branchName}" to local path: ${localPath}`);

  // Ensure local directory exists
  if (!existsSync(localPath)) {
    mkdirSync(localPath, { recursive: true });
    console.log(`📁 Created local directory: ${localPath}`);
  }

  // Create a file system syncer
  const syncer = createFileSystemSyncer(localPath);

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n🛑 Received SIGINT, shutting down gracefully...");
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    console.log("\n🛑 Received SIGTERM, shutting down gracefully...");
    process.exit(0);
  });

  // Start watching with the syncer
  try {
    await watch(
      {
        branchName,
        fromCtime,
        pathFilter,
      },
      syncer,
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (
      errorMessage.includes("Session not found") ||
      errorMessage.includes("Session expired")
    ) {
      console.error("💥 Mount failed: Authentication required");
      console.error(
        "   Please run 'deco login' first to authenticate with deco.chat",
      );
    } else {
      console.error("💥 Mount failed:", errorMessage);
    }

    process.exit(1);
  }
}

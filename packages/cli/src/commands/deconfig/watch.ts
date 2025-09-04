import process from "node:process";
import { watch as baseWatch, type FileChangeEventWithContent } from "./base.js";

interface WatchCommandOptions {
  path?: string;
  branch: string;
  fromCtime?: number;
}

export async function watchCommand(
  options: WatchCommandOptions,
): Promise<void> {
  const { path: pathFilter, branch, fromCtime } = options;

  console.log(`👀 Watching branch "${branch}" for changes`);
  if (pathFilter) {
    console.log(`   🎯 Filtering path: ${pathFilter}`);
  }

  // Create callback to log changes
  const logChanges = (event: FileChangeEventWithContent) => {
    const timestamp = new Date(event.timestamp).toISOString();
    console.log(`[${timestamp}] 📝 ${event.type.toUpperCase()}: ${event.path}`);

    if (event.content) {
      console.log(`   📊 Size: ${event.content.length} bytes`);
    }

    if (event.metadata) {
      console.log(
        `   ⏰ Modified: ${new Date(event.metadata.mtime).toISOString()}`,
      );
    }

    console.log(`   🔢 Patch ID: ${event.patchId}`);
    console.log(""); // Empty line for readability
  };

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n🛑 Received SIGINT, shutting down gracefully...");
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    console.log("\n🛑 Received SIGTERM, shutting down gracefully...");
    process.exit(0);
  });

  try {
    await baseWatch(
      {
        branchName: branch,
        pathFilter,
        fromCtime,
      },
      logChanges,
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (
      errorMessage.includes("Session not found") ||
      errorMessage.includes("Session expired")
    ) {
      console.error("💥 Watch failed: Authentication required");
      console.error(
        "   Please run 'deco login' first to authenticate with deco.chat",
      );
    } else {
      console.error("💥 Watch failed:", errorMessage);
    }

    process.exit(1);
  }
}

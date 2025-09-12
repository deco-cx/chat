import process from "node:process";

interface DeleteOptions {
  path: string;
  branchName: string;
  workspace?: string;
  local?: boolean;
}

export async function deleteCommand(options: DeleteOptions): Promise<void> {
  const { path: filePath, branchName, workspace, local } = options;

  console.log(`🗑️  Deleting file "${filePath}" from branch "${branchName}"`);

  // Create workspace client for deconfig tools
  const { createWorkspaceClient } = await import("../../lib/mcp.js");
  const client = await createWorkspaceClient({ workspace, local });

  try {
    // Call the DELETE_FILE tool via MCP
    const response = await client.callTool({
      name: "DELETE_FILE",
      arguments: {
        branch: branchName,
        path: filePath,
      },
    });

    if (response.isError) {
      const errorMessage = Array.isArray(response.content)
        ? response.content[0]?.text || "Failed to delete file"
        : "Failed to delete file";
      throw new Error(errorMessage);
    }

    const result = response.structuredContent as { deleted: boolean };

    if (result.deleted) {
      console.log(`✅ File deleted successfully: ${filePath}`);
    } else {
      console.log(`ℹ️  File was not found or already deleted: ${filePath}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (
      errorMessage.includes("Session not found") ||
      errorMessage.includes("Session expired")
    ) {
      console.error("💥 Delete failed: Authentication required");
      console.error(
        "   Please run 'deco login' first to authenticate with deco.chat",
      );
    } else if (errorMessage.includes("File not found")) {
      console.error(`💥 File not found: ${filePath} (branch: ${branchName})`);
    } else {
      console.error("💥 Delete failed:", errorMessage);
    }

    process.exit(1);
  } finally {
    // Always close the client connection
    await client.close();
  }
}

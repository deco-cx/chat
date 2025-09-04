import { writeFileSync } from "fs";
import { dirname } from "path";
import { mkdirSync, existsSync } from "fs";
import { fetchFileContent } from "./base.js";
import process from "node:process";

interface GetOptions {
  path: string;
  branch: string;
  output?: string;
}

export async function getCommand(options: GetOptions): Promise<void> {
  const { path: filePath, branch, output } = options;

  console.log(`📥 Getting file "${filePath}" from branch "${branch}"`);

  try {
    // Fetch file content
    const content = await fetchFileContent(filePath, branch);

    if (output) {
      // Save to specified output file
      const dir = dirname(output);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      writeFileSync(output, content);
      console.log(`✅ File saved to: ${output} (${content.length} bytes)`);
    } else {
      // Output to stdout
      process.stdout.write(content);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (
      errorMessage.includes("Session not found") ||
      errorMessage.includes("Session expired")
    ) {
      console.error("💥 Get failed: Authentication required");
      console.error(
        "   Please run 'deco login' first to authenticate with deco.chat",
      );
    } else if (errorMessage.includes("File not found")) {
      console.error(`💥 File not found: ${filePath} (branch: ${branch})`);
    } else {
      console.error("💥 Get failed:", errorMessage);
    }

    process.exit(1);
  }
}

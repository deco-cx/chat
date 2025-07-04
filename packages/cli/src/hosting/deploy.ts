import { Confirm } from "@cliffy/prompt";
import { walk } from "@std/fs";
import { createWorkspaceClient } from "../mcp.ts";
import { getCurrentEnvVars } from "../wrangler.ts";
import { relative } from "@std/path/relative";

export type FileLike = {
  path: string;
  content: string;
};

interface Options {
  cwd: string;
  workspace: string;
  app: string;
  local: boolean;
  skipConfirmation?: boolean;
}

const WRANGLER_CONFIG_FILES = ["wrangler.toml", "wrangler.json"];

export const deploy = async (
  { cwd, workspace, app: appSlug, local, skipConfirmation }: Options,
) => {
  console.log(`\n🚀 Deploying '${appSlug}' to '${workspace}'...\n`);

  // Ensure the target directory exists
  try {
    await Deno.stat(cwd);
  } catch {
    throw new Error("Target directory not found");
  }

  // 1. Prepare files to upload: all files in dist/ and wrangler.toml (if exists)
  const files: FileLike[] = [];
  let hasTsFile = false;
  let foundWranglerConfigInWalk = false;
  let foundWranglerConfigName = "";

  // Recursively walk cwd/ and add all files
  for await (
    const entry of walk(cwd, {
      includeDirs: false,
      skip: [/node_modules/, /\.git/, /\.DS_Store/],
      exts: [
        ".ts",
        ".mjs",
        ".js",
        ".cjs",
        ".toml",
        ".json",
        ".css",
        ".html",
        ".txt",
        ".wasm",
      ],
    })
  ) {
    const realPath = relative(cwd, entry.path);
    const content = await Deno.readTextFile(entry.path);
    files.push({ path: realPath, content });
    if (realPath.endsWith(".ts")) {
      hasTsFile = true;
    }
    if (WRANGLER_CONFIG_FILES.some((name) => realPath.includes(name))) {
      foundWranglerConfigInWalk = true;
      foundWranglerConfigName = realPath;
    }
  }

  // 2. wrangler.toml/json (optional)
  let wranglerConfigStatus = "";
  if (!foundWranglerConfigInWalk) {
    let found = false;
    for (const configFile of WRANGLER_CONFIG_FILES) {
      const configPath = `${Deno.cwd()}/${configFile}`;
      try {
        const configContent = await Deno.readTextFile(configPath);
        files.push({ path: configFile, content: configContent });
        wranglerConfigStatus = `${configFile} ✅ (found in ${configPath})`;
        found = true;
        break;
      } catch (_) {
        // not found, try next
      }
    }
    if (!found) {
      wranglerConfigStatus = "wrangler.toml/json ❌";
    }
  } else {
    wranglerConfigStatus =
      `${foundWranglerConfigName} ✅ (found in project files)`;
  }

  // 3. Load envVars from .dev.vars
  const envVars = await getCurrentEnvVars(cwd);

  const manifest = { appSlug, files, envVars, bundle: hasTsFile };

  console.log("🚚 Deployment summary:");
  console.log(`  App: ${appSlug}`);
  console.log(`  Files: ${files.length}`);
  console.log(`  ${wranglerConfigStatus}`);

  const confirmed = skipConfirmation ||
    await Confirm.prompt("Proceed with deployment?");
  if (!confirmed) {
    console.log("❌ Deployment cancelled");
    Deno.exit(0);
  }

  const client = await createWorkspaceClient({ workspace, local });
  const response = await client.callTool({
    name: "HOSTING_APP_DEPLOY",
    arguments: manifest,
  });

  if (response.isError && Array.isArray(response.content)) {
    throw new Error(response.content[0]?.text ?? "Unknown error");
  }

  const { entrypoint } = response.structuredContent as { entrypoint: string };
  console.log(`\n🎉 Deployed! Available at: ${entrypoint}\n`);
};

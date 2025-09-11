import inquirer from "inquirer";
import { promises as fs } from "fs";
import { relative, join, posix } from "path";
import { walk } from "../../lib/fs.js";
import { createWorkspaceClient } from "../../lib/mcp.js";
import { getCurrentEnvVars } from "../../lib/wrangler.js";
import { Buffer } from "node:buffer";
import process from "node:process";

function tryParseJson(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normalizePath(path: string): string {
  // Convert Windows backslashes to Unix forward slashes
  return posix.normalize(path.replace(/\\/g, "/"));
}

export type FileLike = {
  path: string;
  content: string;
  asset?: boolean;
};

interface Options {
  cwd: string;
  workspace: string;
  app: string;
  local: boolean;
  skipConfirmation?: boolean;
  unlisted?: boolean;
  assetsDirectory?: string;
  force?: boolean;
  preview?: boolean;
  dryRun?: boolean;
}

const WRANGLER_CONFIG_FILES = ["wrangler.toml", "wrangler.json"];

export const deploy = async ({
  cwd,
  workspace,
  app: appSlug,
  local,
  assetsDirectory,
  skipConfirmation,
  force,
  preview = false,
  unlisted = true,
  dryRun = false,
}: Options) => {
  console.log(
    `\n🚀 ${dryRun ? "Preparing" : "Deploying"} '${appSlug}' to '${workspace}'${dryRun ? " (dry run)" : ""}${preview ? " (preview)" : ""}...\n`,
  );

  // Ensure the target directory exists
  try {
    await fs.stat(cwd);
  } catch {
    throw new Error("Target directory not found");
  }

  // 1. Prepare files to upload: all files in dist/ and wrangler.toml (if exists)
  const files: FileLike[] = [];
  let hasTsFile = false;
  let foundWranglerConfigInWalk = false;
  let foundWranglerConfigName = "";

  // Recursively walk cwd/ and add all files
  for await (const entry of walk(cwd, {
    includeFiles: true,
    includeDirs: false,
    skip: [
      /node_modules/,
      /\.git/,
      /\.DS_Store/,
      /\.env/,
      /\.env\.local/,
      /\.dev\.vars/,
    ],
    exts: [
      "ts",
      "mjs",
      "js",
      "cjs",
      "toml",
      "json",
      "css",
      "html",
      "txt",
      "wasm",
      "sql",
    ],
  })) {
    const realPath = normalizePath(relative(cwd, entry.path));
    const content = await fs.readFile(entry.path, "utf-8");
    files.push({ path: realPath, content });
    if (realPath.endsWith(".ts")) {
      hasTsFile = true;
    }
    if (WRANGLER_CONFIG_FILES.some((name) => realPath.includes(name))) {
      foundWranglerConfigInWalk = true;
      foundWranglerConfigName = realPath;
    }
  }

  if (assetsDirectory) {
    for await (const entry of walk(assetsDirectory, {
      includeFiles: true,
      includeDirs: false,
      skip: [
        /node_modules/,
        /\.git/,
        /\.DS_Store/,
        /\.env/,
        /\.env\.local/,
        /\.dev\.vars/,
      ],
    })) {
      const realPath = normalizePath(relative(assetsDirectory, entry.path));
      const content = await fs.readFile(entry.path);
      const base64Content = Buffer.from(content).toString("base64");
      files.push({ path: realPath, content: base64Content, asset: true });
    }
  }

  // 2. wrangler.toml/json (optional)
  let wranglerConfigStatus = "";
  if (!foundWranglerConfigInWalk) {
    let found = false;
    for (const configFile of WRANGLER_CONFIG_FILES) {
      const configPath = `${process.cwd()}/${configFile}`;
      try {
        const configContent = await fs.readFile(configPath, "utf-8");
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
    wranglerConfigStatus = `${foundWranglerConfigName} ✅ (found in project files)`;
  }

  // 3. Load envVars from .dev.vars
  const { envVars, envFilepath } = await getCurrentEnvVars(process.cwd());
  const envVarsStatus = `Loaded ${
    Object.keys(envVars).length
  } env vars from ${envFilepath}`;

  const manifest = {
    appSlug,
    files,
    envVars,
    envFilepath,
    bundle: hasTsFile,
    unlisted,
    force,
    preview,
  };

  console.log("🚚 Deployment summary:");
  console.log(`  App: ${appSlug}`);
  console.log(`  Files: ${files.length}`);
  console.log(`  ${envVarsStatus}`);
  console.log(`  ${wranglerConfigStatus}`);
  if (preview) {
    console.log(`  Preview mode: true (deployment won't replace production)`);
  }

  if (dryRun) {
    const manifestPath = join(cwd, "deploy-manifest.json");
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`\n📄 Dry run complete! Deploy manifest written to:`);
    console.log(`  ${manifestPath}`);
    console.log();
    return;
  }

  const confirmed =
    skipConfirmation ||
    (
      await inquirer.prompt([
        {
          type: "confirm",
          name: "proceed",
          message: "Proceed with deployment?",
          default: true,
        },
      ])
    ).proceed;

  if (!confirmed) {
    console.log("❌ Deployment cancelled");
    process.exit(0);
  }

  const client = await createWorkspaceClient({ workspace, local });
  const deploy = async (options: typeof manifest) => {
    const response = await client.callTool({
      name: "HOSTING_APP_DEPLOY",
      arguments: manifest,
    });

    if (response.isError && Array.isArray(response.content)) {
      console.error("Error deploying: ", response);

      const errorText = response.content[0]?.text;
      const errorTextJson = tryParseJson(errorText ?? "");
      if (errorTextJson?.name === "MCPBreakingChangeError" && !force) {
        console.log("Looks like you have breaking changes in your app.");
        console.log(errorTextJson.message);
        if (skipConfirmation) {
          console.error("Use --force (-f) to deploy with breaking changes");
          process.exit(1);
        }
        const confirmed = await inquirer.prompt([
          {
            type: "confirm",
            name: "proceed",
            message: "Would you like to retry with the --force flag?",
            default: true,
          },
        ]);
        if (!confirmed) {
          process.exit(1);
        }
        return deploy({ ...options, force: true });
      }
      throw new Error(errorTextJson ?? errorText ?? "Unknown error");
    }
    return response;
  };

  const response = await deploy(manifest);
  const { hosts } = response.structuredContent as { hosts: string[] };
  console.log(`\n🎉 Deployed! Available at:`);
  hosts.forEach((host) => console.log(`  ${host}`));
  console.log();
};

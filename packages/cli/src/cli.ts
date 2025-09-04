#!/usr/bin/env node

// Check Node.js version requirement
import process from "node:process";
const MIN_NODE_VERSION = "18.0.0";
const currentNodeVersion = process.version.slice(1); // Remove 'v' prefix

function compareVersions(version1: string, version2: string): number {
  const v1parts = version1.split(".").map(Number);
  const v2parts = version2.split(".").map(Number);

  for (let i = 0; i < Math.max(v1parts.length, v2parts.length); i++) {
    const v1part = v1parts[i] || 0;
    const v2part = v2parts[i] || 0;

    if (v1part < v2part) return -1;
    if (v1part > v2part) return 1;
  }
  return 0;
}

if (compareVersions(currentNodeVersion, MIN_NODE_VERSION) < 0) {
  console.error(`❌ Error: Node.js ${MIN_NODE_VERSION} or higher is required.`);
  console.error(`   Current version: ${process.version}`);
  console.error(`   Please upgrade Node.js: https://nodejs.org/`);
  process.exit(1);
}

// Suppress punycode deprecation warning from dependencies
process.removeAllListeners("warning");
process.on("warning", (warning) => {
  if (
    warning.name === "DeprecationWarning" &&
    warning.message.includes("punycode")
  ) {
    return; // Ignore punycode deprecation warnings
  }
  console.warn(warning.message);
});

import { Command } from "commander";
import { readFile, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import { deleteSession, readSession, setToken } from "./lib/session.js";
import { DECO_CHAT_API_LOCAL } from "./lib/constants.js";
import {
  getAppDomain,
  getConfig,
  readWranglerConfig,
  getLocal,
  setLocal,
} from "./lib/config.js";
import { loginCommand } from "./commands/auth/login.js";
import { whoamiCommand } from "./commands/auth/whoami.js";
import { configureCommand } from "./commands/config/configure.js";
import { deploy } from "./commands/hosting/deploy.js";
import { listApps } from "./commands/hosting/list.js";
import { promoteApp } from "./commands/hosting/promote.js";
import { createCommand } from "./commands/create/create.js";
import { devCommand } from "./commands/dev/dev.js";
import { link } from "./commands/dev/link.js";
import { genEnv } from "./commands/gen/gen.js";
import { upgradeCommand } from "./commands/update/upgrade.js";
import { updateCommand } from "./commands/update/update.js";
import { addCommand } from "./commands/add/add.js";
import {
  mountCommand,
  getCommand,
  putCommand,
  watchCommand,
} from "./commands/deconfig/index.js";
import { detectRuntime } from "./lib/runtime.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json for version
const packageJsonPath = join(__dirname, "../package.json");
const packageJson = JSON.parse(await readFile(packageJsonPath, "utf-8"));

// Login command implementation
const login = new Command("login")
  .description("Log in to deco.chat and retrieve tokens for CLI usage.")
  .action(async () => {
    try {
      await loginCommand();
      console.log("✅ Successfully logged in to deco.chat");
    } catch (error) {
      console.error(
        "❌ Login failed:",
        error instanceof Error ? error.message : String(error),
      );
      process.exit(1);
    }
  });

// Placeholder for logout command implementation
const logout = new Command("logout")
  .description("Log out of deco.chat and remove local session data.")
  .action(async () => {
    try {
      await deleteSession();
      console.log("Logged out successfully. Session data removed.");
    } catch (e) {
      if (e instanceof Error) {
        console.error("Failed to log out:", e.message);
      } else {
        console.error("Failed to log out:", String(e));
      }
    }
  });

// Whoami command implementation
const whoami = new Command("whoami")
  .description("Print info about the current session.")
  .action(whoamiCommand);

// Configure command implementation
const configure = new Command("configure")
  .alias("config")
  .description("Save configuration options for the current directory.")
  .action(async () => {
    try {
      await configureCommand(getLocal());
    } catch (error) {
      console.error(
        "❌ Configuration failed:",
        error instanceof Error ? error.message : String(error),
      );
      process.exit(1);
    }
  });

const hostingList = new Command("list")
  .description("List all apps in the current workspace.")
  .option("-w, --workspace <workspace>", "Workspace name")
  .action(async (options) => {
    try {
      const session = await readSession();
      const workspace = options.workspace || session?.workspace;

      if (!workspace) {
        console.error(
          "❌ No workspace specified. Use -w flag or run 'deco configure' first.",
        );
        process.exit(1);
      }

      await listApps({ workspace });
    } catch (error) {
      console.error(
        "❌ Failed to list apps:",
        error instanceof Error ? error.message : String(error),
      );
      process.exit(1);
    }
  });

// Hosting deploy command implementation
const hostingDeploy = new Command("deploy")
  .description("Deploy the current directory into the current workspace.")
  .option("-w, --workspace <workspace>", "Workspace name")
  .option("-a, --app <app>", "App name")
  .option("-y, --yes", "Skip confirmation")
  .option("-p, --public", "Make the app public in the registry")
  .option(
    "-f, --force",
    "Force the deployment even if there are breaking changes",
  )
  .option(
    "--dry-run",
    "Write deploy manifest to local filesystem instead of deploying",
  )
  .argument("[cwd]", "Working directory")
  .action(async (cwd, options) => {
    try {
      const config = await getConfig({
        inlineOptions: options,
      });
      const wranglerConfig = await readWranglerConfig();
      const assetsDirectory = wranglerConfig.assets?.directory;
      const app =
        options.app ??
        (typeof wranglerConfig.name === "string"
          ? wranglerConfig.name
          : "my-app");

      await deploy({
        ...config,
        app,
        skipConfirmation: options.yes,
        cwd: cwd ?? process.cwd(),
        unlisted: !options.public,
        assetsDirectory,
        force: options.force,
        dryRun: options.dryRun,
      });
    } catch (error) {
      console.error(
        "❌ Deployment failed:",
        error instanceof Error ? error.message : JSON.stringify(error),
      );
      process.exit(1);
    }
  });

// Hosting promote command implementation
const hostingPromote = new Command("promote")
  .description("Promote a deployment to an existing route pattern.")
  .option("-w, --workspace <workspace>", "Workspace name")
  .option("-a, --app <app>", "App name")
  .option("-d, --deployment <deployment>", "Deployment ID")
  .option(
    "-r, --route <route>",
    "Route pattern (defaults to appName.deco.page)",
  )
  .option("-y, --yes", "Skip confirmation")
  .action(async (options) => {
    try {
      const config = await getConfig({
        inlineOptions: options,
      });

      let app = options.app;
      if (!app) {
        try {
          const wranglerConfig = await readWranglerConfig();
          app =
            typeof wranglerConfig.name === "string"
              ? wranglerConfig.name
              : undefined;
        } catch {
          // No wrangler config found, app will remain undefined
        }
      }

      await promoteApp({
        workspace: config.workspace,
        local: config.local,
        appSlug: app,
        deploymentId: options.deployment,
        routePattern: options.route,
        skipConfirmation: options.yes,
      });
    } catch (error) {
      console.error(
        "❌ Promotion failed:",
        error instanceof Error ? error.message : String(error),
      );
      process.exit(1);
    }
  });

// Link command implementation
const linkCmd = new Command("link")
  .description("Link the project to be accessed through a remote domain.")
  .option("-p, --port <port>", "Port to link", parseInt)
  .allowUnknownOption()
  .action(async (options, cmd) => {
    try {
      const runCommand = cmd.args;

      await link({
        port: options.port,
        onBeforeRegister: () => {
          if (runCommand.length === 0) {
            console.log(
              "⚠️  No command provided. Tunnel will connect to existing service on port.",
            );
            return;
          }

          const [command, ...args] = runCommand;
          console.log(`🔗 Starting command: ${command} ${args.join(" ")}`);

          const childProcess = spawn(command, args, {
            stdio: "inherit",
            shell: true,
          });

          childProcess.on("error", (error: Error) => {
            console.error("❌ Failed to start command:", error.message);
            process.exit(1);
          });

          return childProcess;
        },
      });
    } catch (error) {
      console.error(
        "❌ Link failed:",
        error instanceof Error ? error.message : String(error),
      );
      process.exit(1);
    }
  });

const upgrade = new Command("upgrade")
  .description("Upgrade the deco CLI to the latest version.")
  .action(upgradeCommand);

const update = new Command("update")
  .description("Update Deco dependencies to their latest versions.")
  .option("-y, --yes", "Skip confirmation prompts")
  .action(async (options) => {
    try {
      await updateCommand({ yes: options.yes });
    } catch (error) {
      console.error(
        "❌ Update failed:",
        error instanceof Error ? error.message : String(error),
      );
      process.exit(1);
    }
  });

// Dev command implementation
const dev = new Command("dev")
  .description("Start a development server.")
  .option(
    "--clean-build-dir <directory>",
    "Clean the build directory before starting the development server",
    (directory) => {
      return {
        enabled: true,
        directory,
      };
    },
  )
  .option(
    "--gen-watch [path]",
    "Watch for TypeScript file changes and regenerate deco.gen.ts (defaults to current directory)",
  )
  .action((options) => {
    devCommand({
      cleanBuildDirectory: options.cleanBuildDir,
      genWatch: options.genWatch === true ? "." : options.genWatch,
    });
  });

// Create command implementation
const create = new Command("create")
  .description("Create a new project from a template.")
  .argument("[project-name]", "Name of the project")
  .action(async (projectName) => {
    try {
      const config = await getConfig().catch(() => ({}));
      await createCommand(projectName, config);
    } catch (error) {
      console.error(
        "❌ Project creation failed:",
        error instanceof Error ? error.message : String(error),
      );
      process.exit(1);
    }
  });

// Add command implementation
const add = new Command("add")
  .description("Add integrations to the current project.")
  .option("-w, --workspace <workspace>", "Workspace name")
  .action(async (options) => {
    try {
      await addCommand({
        workspace: options.workspace,
        local: getLocal(),
      });
    } catch (error) {
      console.error(
        "❌ Failed to add integrations:",
        error instanceof Error ? error.message : String(error),
      );
      process.exit(1);
    }
  });

// Hosting parent command
const hosting = new Command("hosting")
  .description("Manage hosting apps in a workspace.")
  .addCommand(hostingList)
  .addCommand(hostingDeploy)
  .addCommand(hostingPromote);

const gen = new Command("gen")
  .description("Generate the environment that will be used to run the app.")
  .option(
    "-s, --self <url>",
    "Useful to generate a SELF binding for own types based on local mcp server.",
  )
  .option(
    "-o, --output <path>",
    "Output path for the generated environment file.",
  )
  .action(async (options) => {
    try {
      const wranglerConfig = await readWranglerConfig();
      const config = await getConfig({});
      const env = await genEnv({
        workspace: config.workspace,
        local: config.local,
        bindings: config.bindings,
        selfUrl:
          options.self ??
          `https://${getAppDomain(
            config.workspace,
            wranglerConfig.name ?? "my-app",
          )}/mcp`,
      });
      if (options.output) {
        await writeFile(options.output, env);
      } else {
        console.log(env);
      }
    } catch (error) {
      console.error(
        "❌ Failed to generate environment:",
        error instanceof Error ? error.message : String(error),
      );
      process.exit(1);
    }
  });

// Get command for deconfig
const deconfigGet = new Command("get")
  .description("Get a file from a deconfig branch.")
  .argument("<path>", "File path to get")
  .requiredOption("-b, --branch <branchName>", "Branch name")
  .option("-o, --output <file>", "Output file (defaults to stdout)")
  .action(async (path, options) => {
    try {
      await getCommand({
        path,
        branch: options.branch,
        output: options.output,
      });
    } catch (error) {
      console.error(
        "❌ Get failed:",
        error instanceof Error ? error.message : String(error),
      );
      process.exit(1);
    }
  });

// Put command for deconfig
const deconfigPut = new Command("put")
  .description("Put a file to a deconfig branch.")
  .argument("<path>", "File path to put")
  .requiredOption("-b, --branch <branchName>", "Branch name")
  .option("-f, --file <file>", "Local file to upload")
  .option("-c, --content <content>", "Content to upload")
  .option("-m, --metadata <metadata>", "Metadata JSON string")
  .action(async (path, options) => {
    try {
      await putCommand({
        path,
        branch: options.branch,
        file: options.file,
        content: options.content,
        metadata: options.metadata,
      });
    } catch (error) {
      console.error(
        "❌ Put failed:",
        error instanceof Error ? error.message : String(error),
      );
      process.exit(1);
    }
  });

// Watch command for deconfig
const deconfigWatch = new Command("watch")
  .description("Watch a deconfig branch for changes.")
  .requiredOption("-b, --branch <branchName>", "Branch name")
  .option("-p, --path <path>", "Path filter for watching specific files")
  .option(
    "--from-ctime <ctime>",
    "Start watching from this ctime",
    (value) => parseInt(value),
    1,
  )
  .action(async (options) => {
    try {
      await watchCommand({
        branch: options.branch,
        path: options.path,
        fromCtime: options.fromCtime,
      });
    } catch (error) {
      console.error(
        "❌ Watch failed:",
        error instanceof Error ? error.message : String(error),
      );
      process.exit(1);
    }
  });

// Mount command for deconfig
const deconfigMount = new Command("mount")
  .description(
    "Mount a deconfig branch to a local directory and watch for changes.",
  )
  .requiredOption("-b, --branch <branchName>", "Branch name to mount")
  .requiredOption("--path <path>", "Local directory path to sync files to")
  .option(
    "--from-ctime <ctime>",
    "Start watching from this ctime",
    (value) => parseInt(value),
    1,
  )
  .option("--path-filter <filter>", "Filter files by path pattern")
  .action(async (options) => {
    try {
      await mountCommand({
        branchName: options.branch,
        path: options.path,
        fromCtime: options.fromCtime,
        pathFilter: options.pathFilter,
      });
    } catch (error) {
      console.error(
        "❌ Mount failed:",
        error instanceof Error ? error.message : String(error),
      );
      process.exit(1);
    }
  });

// Deconfig parent command
const deconfig = new Command("deconfig")
  .description("Manage deconfig filesystem operations.")
  .addCommand(deconfigGet)
  .addCommand(deconfigPut)
  .addCommand(deconfigWatch)
  .addCommand(deconfigMount);

// Main CLI program
const program = new Command()
  .name(packageJson.name)
  .version(packageJson.version)
  .description(packageJson.description)
  .configureOutput({
    writeOut: (str) => {
      // Customize version output to include runtime info
      if (
        str.includes(packageJson.version) &&
        str.trim() === packageJson.version
      ) {
        const runtime = detectRuntime();
        process.stdout.write(`${packageJson.version} (${runtime})\n`);
      } else {
        process.stdout.write(str);
      }
    },
    writeErr: (str) => process.stderr.write(str),
  })
  .option(
    "-t, --token <token>",
    "Authentication token to use for API requests",
    (token) => {
      setToken(token);
    },
  )
  .option(
    "-l, --local",
    `Deploy the app locally (Needs deco.chat running at ${DECO_CHAT_API_LOCAL})`,
    () => {
      setLocal(true);
    },
  )
  .addHelpText("after", () => {
    const runtime = detectRuntime();
    return `\nRuntime: ${runtime}`;
  })
  .addCommand(login)
  .addCommand(logout)
  .addCommand(whoami)
  .addCommand(hosting)
  .addCommand(hostingDeploy)
  .addCommand(hostingPromote)
  .addCommand(dev)
  .addCommand(configure)
  .addCommand(add)
  .addCommand(upgrade)
  .addCommand(update)
  .addCommand(linkCmd)
  .addCommand(gen)
  .addCommand(create)
  .addCommand(deconfig);

program.parse();

#!/usr/bin/env node

// Check Node.js version requirement
const MIN_NODE_VERSION = '18.0.0';
const currentNodeVersion = process.version.slice(1); // Remove 'v' prefix

function compareVersions(version1: string, version2: string): number {
  const v1parts = version1.split('.').map(Number);
  const v2parts = version2.split('.').map(Number);
  
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
process.removeAllListeners('warning');
process.on('warning', (warning) => {
  if (warning.name === 'DeprecationWarning' && warning.message.includes('punycode')) {
    return; // Ignore punycode deprecation warnings
  }
  console.warn(warning.message);
});

import { Command } from "commander";
import { readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import { deleteSession, readSession, setToken } from "./lib/session.js";
import { DECO_CHAT_API_LOCAL } from "./lib/constants.js";
import { loginCommand } from "./commands/auth/login.js";
import { whoamiCommand } from "./commands/auth/whoami.js";
import { configureCommand } from "./commands/config/configure.js";
import { deploy } from "./commands/hosting/deploy.js";
import { createCommand, listTemplates } from "./commands/create/create.js";
import { devCommand } from "./commands/dev/dev.js";
import { link } from "./commands/dev/link.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json for version
const packageJsonPath = join(__dirname, "../package.json");
const packageJson = JSON.parse(await readFile(packageJsonPath, "utf-8"));

// Global state for local flag
let isLocal = false;
export function setLocal(local: boolean): void {
  isLocal = local;
}
export function getLocal(): boolean {
  return isLocal;
}

// Login command implementation
const login = new Command("login")
  .description("Log in to deco.chat and retrieve tokens for CLI usage.")
  .action(async () => {
    try {
      await loginCommand();
      console.log("✅ Successfully logged in to deco.chat");
    } catch (error) {
      console.error("❌ Login failed:", error instanceof Error ? error.message : String(error));
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
      console.error("❌ Configuration failed:", error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Placeholder for hosting list command implementation
const hostingList = new Command("list")
  .description("List all apps in the current workspace.")
  .option("-w, --workspace <workspace>", "Workspace name")
  .action(async (options) => {
    console.log("Hosting list command not yet implemented");
    console.log("Options:", options);
  });

// Hosting deploy command implementation
const hostingDeploy = new Command("deploy")
  .description("Deploy the current directory into the current workspace.")
  .option("-w, --workspace <workspace>", "Workspace name")
  .option("-a, --app <app>", "App name")
  .option("-y, --yes", "Skip confirmation")
  .option("-p, --public", "Make the app public in the registry")
  .argument("[cwd]", "Working directory")
  .action(async (cwd, options) => {
    try {
      const { getConfig, readWranglerConfig } = await import("./lib/config.js");
      
      const config = await getConfig({
        inlineOptions: options,
      });
      const wranglerConfig = await readWranglerConfig();
      const assetsDirectory = wranglerConfig.assets?.directory;
      const app = options.app ??
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
      });
    } catch (error) {
      console.error("❌ Deployment failed:", error instanceof Error ? error.message : String(error));
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
            console.log("⚠️  No command provided. Tunnel will connect to existing service on port.");
            return;
          }

          const [command, ...args] = runCommand;
          console.log(`🔗 Starting command: ${command} ${args.join(' ')}`);
          
          const childProcess = spawn(command, args, {
            stdio: "inherit",
            shell: true,
          });

          childProcess.on('error', (error: Error) => {
            console.error("❌ Failed to start command:", error.message);
            process.exit(1);
          });

          return childProcess;
        },
      });
    } catch (error) {
      console.error("❌ Link failed:", error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Placeholder for update command implementation
const update = new Command("update")
  .description("Update the deco CLI to the latest version.")
  .action(async () => {
    console.log("Update command not yet implemented");
  });

// Dev command implementation
const dev = new Command("dev")
  .description("Start a development server.")
  .action(devCommand);

// Create command implementation
const create = new Command("create")
  .description("Create a new project from a template.")
  .option("-t, --template <template>", "Template to use")
  .argument("[project-name]", "Name of the project")
  .action(async (projectName, options) => {
    try {
      const { getConfig } = await import("./lib/config.js");
      const config = await getConfig().catch(() => ({}));
      await createCommand(projectName, options.template, config);
    } catch (error) {
      console.error("❌ Project creation failed:", error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Templates list command implementation
const listTemplatesCommand = new Command("templates")
  .description("List available templates.")
  .action(() => {
    listTemplates();
  });

// Placeholder for add command implementation
const add = new Command("add")
  .description("Add integrations to the current project.")
  .option("-w, --workspace <workspace>", "Workspace name")
  .action(async (options) => {
    console.log("Add command not yet implemented");
    console.log("Options:", options);
  });

// Hosting parent command
const hosting = new Command("hosting")
  .description("Manage hosting apps in a workspace.")
  .addCommand(hostingList)
  .addCommand(hostingDeploy);

// Placeholder for gen command implementation
const gen = new Command("gen")
  .description("Generate the environment that will be used to run the app.")
  .option(
    "-s, --self <url>",
    "Useful to generate a SELF binding for own types based on local mcp server."
  )
  .action(async (options) => {
    console.log("Gen command not yet implemented");
    console.log("Options:", options);
  });

// Main CLI program
const program = new Command()
  .name(packageJson.name)
  .version(packageJson.version)
  .description(packageJson.description)
  .option(
    "-t, --token <token>",
    "Authentication token to use for API requests",
    (token) => {
      setToken(token);
    }
  )
  .option(
    "-l, --local",
    `Deploy the app locally (Needs deco.chat running at ${DECO_CHAT_API_LOCAL})`,
    () => {
      setLocal(true);
    }
  )
  .addCommand(login)
  .addCommand(logout)
  .addCommand(whoami)
  .addCommand(hosting)
  .addCommand(hostingDeploy)
  .addCommand(dev)
  .addCommand(configure)
  .addCommand(add)
  .addCommand(update)
  .addCommand(linkCmd)
  .addCommand(gen)
  .addCommand(create)
  .addCommand(listTemplatesCommand);

program.parse();
import { Command } from "@cliffy/command";
import denoJson from "./deno.json" with { type: "json" };
import { deploy } from "./src/hosting/deploy.ts";
import { listApps } from "./src/hosting/list.ts";
import { link } from "./src/link.ts";
import { loginCommand } from "./src/login.ts";
import { deleteSession, getSessionToken } from "./src/session.ts";
import { whoamiCommand } from "./src/whoami.ts";
import { readApp } from "./src/hosting/read.ts";

// Placeholder for login command implementation
const login = new Command()
  .description("Log in to deco.chat and retrieve tokens for CLI usage.")
  .action(loginCommand);

// Placeholder for logout command implementation
const logout = new Command()
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

// Placeholder for whoami command implementation
const whoami = new Command()
  .description("Print info about the current session.")
  .action(whoamiCommand);

// Placeholder for hosting list command implementation
const hostingList = new Command()
  .description("List all apps in the current workspace.")
  .option("-w, --workspace <workspace:string>", "Workspace name", {
    required: true,
  })
  .action(async (args) => {
    const authCookie = await getSessionToken();
    await listApps({ ...args, authCookie });
  });

const hostingRead = new Command()
  .description("Read a given app in the current workspace.")
  .option("-w, --workspace <workspace:string>", "Workspace name", {
    required: true,
  })
  .option("-a, --app <app:string>", "App name", { required: true })
  .action(async (args) => {
    const authCookie = await getSessionToken();
    await readApp(args.workspace, authCookie, args.app);
  });

// Placeholder for hosting deploy command implementation
const hostingDeploy = new Command()
  .description("Deploy the current directory into the current workspace.")
  .option("-w, --workspace <workspace:string>", "Workspace name", {
    required: true,
  })
  .option("-a, --app <app:string>", "App name", { required: true })
  .action(async (args) => {
    const authCookie = await getSessionToken();
    await deploy({ ...args, appSlug: args.app, authCookie });
  });

const linkCmd = new Command()
  .description("Link the project to be accessed through a remote domain.")
  .option("-p, --port <port:number>", "Port to link", {
    required: false,
  })
  .arguments("[...build-cmd]")
  .action(async function ({ port }) {
    const runCommand = this.getLiteralArgs();

    await link({
      port,
      onBeforeRegister: () => {
        const [cmd, ...args] = runCommand;

        if (runCommand.length === 0) {
          console.error("No build command provided");
          return;
        }

        new Deno.Command(cmd, {
          args,
          stdout: "inherit",
          stderr: "inherit",
        }).spawn();
      },
    });
  });

// Hosting parent command
const hosting = new Command()
  .description("Manage hosting apps in a workspace.")
  .command("list", hostingList)
  .command("deploy", hostingDeploy)
  .command("read", hostingRead);

// Main CLI
await new Command()
  .name(denoJson.name)
  .version(denoJson.version)
  .description(denoJson.description)
  .command("login", login)
  .command("logout", logout)
  .command("whoami", whoami)
  .command("hosting", hosting)
  .command("link", linkCmd)
  .parse(Deno.args);

import { spawn } from "child_process";
import { getConfig, readWranglerConfig } from "../../lib/config.js";
import { ensureDevEnvironment } from "../../lib/wrangler.js";
import { link } from "./link.js";

export async function devCommand(): Promise<void> {
  try {
    // 1. Ensure development environment is set up
    console.log("🔧 Setting up development environment...");
    await ensureDevEnvironment();

    // 2. Get configuration
    const config = await getConfig().catch(() => ({
      workspace: "default",
      bindings: [],
      local: false,
      enable_workflows: true,
    }));

    const wranglerConfig = await readWranglerConfig();
    const app = typeof wranglerConfig.name === "string"
      ? wranglerConfig.name
      : "my-app";

    console.log(`📦 Starting development server for '${app}'...`);

    // 3. TODO: Check/setup MCP configuration when we port those utilities
    // const latest = await hasMCPPreferences(config.workspace, app);
    // if (!latest) {
    //   const mcpConfig = await promptIDESetup({
    //     workspace: config.workspace,
    //     app,
    //   });
    //   if (mcpConfig) {
    //     await writeIDEConfig(mcpConfig);
    //   }
    // }

    // 4. Start development server with tunnel integration
    console.log("🚀 Starting development server with tunnel...");
    
    // Use link command with wrangler dev as subprocess
    await link({
      port: 8787,
      onBeforeRegister: () => {
        console.log("🔗 Starting Wrangler development server...");
        
        const wranglerProcess = spawn("npx", ["wrangler", "dev"], {
          stdio: "inherit",
          shell: true,
        });

        // Handle process termination
        const cleanup = () => {
          console.log("\n⏹️  Stopping development server...");
          wranglerProcess.kill('SIGINT');
          process.exit(0);
        };

        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);

        wranglerProcess.on('error', (error) => {
          console.error("❌ Failed to start Wrangler:", error.message);
          process.exit(1);
        });

        return wranglerProcess;
      },
    });

  } catch (error) {
    console.error(
      "❌ Development server failed:",
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
}
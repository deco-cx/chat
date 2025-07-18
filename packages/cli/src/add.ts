import { Input } from "@cliffy/prompt";
import {
  type DecoBinding,
  getConfig,
  readWranglerConfig,
  writeConfigFile,
} from "./config.ts";
import { promptIntegrations } from "./utils/prompt-integrations.ts";
import { readSession } from "./session.ts";

interface AddCommandOptions {
  workspace?: string;
  local?: boolean;
}

export async function addCommand({ workspace, local }: AddCommandOptions) {
  try {
    // Check if user has a session
    const session = await readSession();
    if (!session) {
      console.error("❌ No session found. Please run 'deco login' first.");
      return;
    }

    // Get current config
    const config = await getConfig({
      inlineOptions: { workspace, local },
    }).catch(() => ({
      workspace: workspace || session.workspace || "default",
      app: "my-app",
      bindings: [],
      local: local || false,
    }));

    console.log(`📁 Using workspace: ${config.workspace}`);
    console.log("🔍 Fetching available integrations...");

    // Prompt user to select integrations
    const selectedBindings = await promptIntegrations(
      config.local,
      config.workspace,
    );

    if (selectedBindings.length === 0) {
      console.log("ℹ️  No integrations selected. Nothing to add.");
      return;
    }

    console.log(`✅ Selected ${selectedBindings.length} integration(s)`);

    // Prompt for binding names for each integration
    const newBindings: DecoBinding[] = [];
    for (const binding of selectedBindings) {
      // Cast to the proper type since promptIntegrations always returns with integration_id
      const integrationBinding = binding as {
        name: string;
        type: string;
        integration_id: string;
      };

      const bindingName = await Input.prompt({
        message: `Enter binding name for integration "${integrationBinding.integration_id}":`,
        default: integrationBinding.name,
        validate: (value: string) => {
          if (!value.trim()) {
            return "Binding name cannot be empty";
          }
          if (!/^[A-Z_][A-Z0-9_]*$/.test(value)) {
            return "Binding name must be uppercase with underscores (e.g., MY_INTEGRATION)";
          }
          return true;
        },
      });

      newBindings.push({
        name: bindingName,
        type: "mcp",
        integration_id: integrationBinding.integration_id,
      });
    }

    // Read current wrangler config and get existing bindings
    const currentWranglerConfig = await readWranglerConfig();
    const currentBindings = (currentWranglerConfig.deco?.bindings ||
      []) as DecoBinding[];

    // Simply concat arrays (no deduplication)
    const allBindings = [...currentBindings, ...newBindings];

    // Update config with new bindings
    const updatedConfig = {
      ...config,
      bindings: allBindings,
    };

    // Write updated config
    await writeConfigFile(updatedConfig);

    console.log(`✅ Added ${newBindings.length} integration(s) successfully!`);
    newBindings.forEach((binding) => {
      const id =
        "integration_id" in binding
          ? binding.integration_id
          : binding.integration_name;
      console.log(`  - ${binding.name} (${id})`);
    });
    console.log("\n💡 Run 'deco gen' to update your environment types.");
    console.log("🎉 Your integrations are ready to use!");
  } catch (error) {
    console.error(
      "❌ Failed to add integrations:",
      error instanceof Error ? error.message : String(error),
    );
    Deno.exit(1);
  }
}

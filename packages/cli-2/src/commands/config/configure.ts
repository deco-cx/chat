import inquirer from "inquirer";
import { join } from "path";
import { promises as fs } from "fs";
import {
  type Config,
  getConfig,
  readWranglerConfig,
  writeWranglerConfig,
} from "../../lib/config.js";

export async function configureCommand(local?: boolean) {
  const currentConfig = await getConfig({ inlineOptions: { local } })
    .catch((): Partial<Config> => ({}));

  const wranglerConfig = await readWranglerConfig();
  const defaultApp = typeof wranglerConfig.name === "string"
    ? wranglerConfig.name
    : "my-app";

  const { app } = await inquirer.prompt([{
    type: 'input',
    name: 'app',
    message: 'Enter app name:',
    default: defaultApp,
  }]);

  // For now, use a simple workspace prompt - we'll enhance this later
  const workspace = currentConfig.workspace || (await inquirer.prompt([{
    type: 'input', 
    name: 'workspace',
    message: 'Enter workspace name:',
    default: 'default',
  }])).workspace;

  // TODO: Add MCP configuration when we port those utilities
  // const mcpConfig = await promptIDESetup(config);

  // TODO: Add integrations when we port those utilities  
  // const bindings = await promptIntegrations(local, workspace);
  const bindings: any[] = [];

  // TODO: Generate environment variables file when we port typings
  // const envContent = await genEnv({ workspace, local, bindings });

  // TODO: Write IDE config when we port MCP utilities
  // if (mcpConfig) {
  //   await writeIDEConfig(mcpConfig);
  // }

  // Write both app name (top-level) and deco config in one go
  await writeWranglerConfig({
    name: app,
    deco: {
      ...wranglerConfig.deco,
      workspace,
      bindings: [...bindings, ...wranglerConfig.deco?.bindings ?? []],
    },
  });

  // TODO: Write environment types file when we port typings
  // const outputPath = join(process.cwd(), "deco.gen.ts");
  // await fs.writeFile(outputPath, envContent);
  // console.log(`✅ Environment types written to: ${outputPath}`);

  console.log(`✅ Configuration saved:`);
  console.log(`   App: ${app}`);
  console.log(`   Workspace: ${workspace}`);
}
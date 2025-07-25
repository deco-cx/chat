import inquirer from "inquirer";
import { promises as fs } from "fs";
import { spawn } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { ensureDir, copy } from "../../lib/fs.js";
import {
  type Config,
  readWranglerConfig,
  writeWranglerConfig,
} from "../../lib/config.js";
import { slugify } from "../../lib/slugify.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface Template {
  name: string;
  description: string;
  repo: string;
  branch?: string;
  path?: string;
  wranglerRoot?: string;
}

const AVAILABLE_TEMPLATES: Template[] = [
  {
    name: "base",
    description: "Minimal MCP server with Tools and Workflows.",
    repo: "deco-cx/chat",
    branch: "main",
    path: "packages/cli/template/base",
  },
  {
    name: "react-tailwind-views",
    description:
      "MCP Server with Tools, Workflows and React + Tailwind for Views.",
    repo: "deco-cx/react-tailwind-views",
    branch: "main",
    wranglerRoot: "server",
  },
  {
    name: "astro-docs-view",
    description:
      "MCP Server with Tools, Workflows and views Astro for a documentation website.",
    repo: "deco-cx/astro-docs-view",
    branch: "main",
    wranglerRoot: "server",
  },
];

async function runCommand(command: string, args: string[], cwd?: string): Promise<boolean> {
  return new Promise((resolve) => {
    const process = spawn(command, args, {
      cwd,
      stdio: 'pipe',
    });

    process.on('close', (code) => {
      resolve(code === 0);
    });

    process.on('error', () => {
      resolve(false);
    });
  });
}

async function downloadTemplate(
  template: Template,
  targetDir: string,
): Promise<void> {
  // For the base template, use the local copy
  if (template.name === "base") {
    const templatePath = join(__dirname, "../../../template/base");
    await ensureDir(targetDir);
    await copy(templatePath, targetDir, { overwrite: true });
    console.log(`✅ Template '${template.name}' copied successfully!`);
    return;
  }

  // For remote templates, use git clone
  const tempDir = join(process.cwd(), `.temp-${Date.now()}`);

  try {
    const success = await runCommand("git", [
      "clone",
      "--depth",
      "1",
      "--branch",
      template.branch || "main",
      `https://github.com/${template.repo}.git`,
      tempDir,
    ]);

    if (!success) {
      throw new Error(`Failed to clone template repository: ${template.repo}`);
    }

    // Remove the .git folder to avoid creating a local repository
    // pointing to the wrong repo
    const gitDir = join(tempDir, ".git");
    await fs.rm(gitDir, { recursive: true, force: true }).catch(() => {
      console.warn(`Failed to remove .git folder: ${gitDir}`);
    });

    const templatePath = join(tempDir, template.path || "");
    try {
      await fs.access(templatePath);
    } catch {
      throw new Error(`Template '${template.name}' not found in repository`);
    }

    await ensureDir(targetDir);
    await copy(templatePath, targetDir, { overwrite: true });

    console.log(`✅ Template '${template.name}' downloaded successfully!`);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function customizeTemplate({
  targetDir,
  projectName,
  workspace,
  wranglerRoot,
}: {
  targetDir: string;
  projectName: string;
  workspace?: string;
  wranglerRoot?: string;
}): Promise<void> {
  const packageJsonPath = join(targetDir, "package.json");

  try {
    const packageJsonContent = await fs.readFile(packageJsonPath, "utf-8");
    const packageJson = JSON.parse(packageJsonContent);

    packageJson.name = projectName;

    await fs.writeFile(
      packageJsonPath,
      JSON.stringify(packageJson, null, 2),
    );
  } catch (error) {
    console.warn(
      "⚠️  Could not customize package.json:",
      error instanceof Error ? error.message : String(error),
    );
  }

  // Write config file with project name and workspace
  if (workspace) {
    try {
      // Read current config from target directory
      const currentConfig = await readWranglerConfig(wranglerRoot || targetDir);
      
      // For now, use empty bindings - we can enhance this later with prompt integrations
      const bindings: any[] = [];

      // Merge with new project name and workspace
      const newConfig = {
        ...currentConfig,
        deco: {
          ...currentConfig.deco,
          workspace,
          bindings,
        },
        name: projectName,
      };

      // Write the new config file
      await writeWranglerConfig(newConfig, wranglerRoot || targetDir);

      // TODO: Generate environment variables file when we port typings
      // const envContent = await genEnv({
      //   workspace: workspace,
      //   local: false,
      //   bindings: newConfig.deco.bindings || [],
      // });

      // const outputPath = join(wranglerRoot || targetDir, "deco.gen.ts");
      // await fs.writeFile(outputPath, envContent);
      // console.log(`✅ Environment types written to: ${outputPath}`);
    } catch (error) {
      console.warn(
        "⚠️  Could not update config file:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}

export function listTemplates(): void {
  console.log("Available templates:\n");
  AVAILABLE_TEMPLATES.forEach((template, index) => {
    console.log(`${index + 1}. ${template.name} - ${template.description}`);
  });
  console.log(
    "\nUse 'deco create <project-name> --template <template-name>' to create a project with a specific template.",
  );
}

export async function createCommand(
  projectName?: string,
  templateName?: string,
  config: Partial<Config> = {},
): Promise<void> {
  try {
    if (templateName) {
      const validTemplate = AVAILABLE_TEMPLATES.find((t) =>
        t.name === templateName
      );
      if (!validTemplate) {
        console.error(`❌ Template '${templateName}' not found.`);
        console.log("\nAvailable templates:");
        listTemplates();
        process.exit(1);
      }
    }

    const finalProjectName = slugify(
      projectName || (await inquirer.prompt([{
        type: 'input',
        name: 'projectName',
        message: 'Enter project name:',
        validate: (value: string) => {
          if (!value.trim()) {
            return "Project name cannot be empty";
          }
          if (!/^[a-z0-9-]+$/.test(value)) {
            return "Project name can only contain lowercase letters, numbers, and hyphens";
          }
          return true;
        },
      }])).projectName,
    );

    // For now, use the workspace from config - we can enhance this with workspace prompts later
    let workspace: string | undefined = config?.workspace;
    if (workspace) {
      console.log(`📁 Selected workspace: ${workspace}`);
    } else {
      console.warn(
        "⚠️  No workspace configured. Run 'deco configure' to set up workspace for a better experience.",
      );
    }

    const targetDir = join(process.cwd(), finalProjectName);
    try {
      await fs.access(targetDir);
      
      const { overwrite } = await inquirer.prompt([{
        type: 'list',
        name: 'overwrite',
        message: `Directory '${finalProjectName}' already exists. Overwrite?`,
        choices: ['No', 'Yes'],
      }]);

      if (overwrite === "No") {
        console.log("❌ Project creation cancelled.");
        return;
      }

      await fs.rm(targetDir, { recursive: true });
    } catch {
      // Directory doesn't exist, that's fine
    }

    const finalTemplateName = templateName || (await inquirer.prompt([{
      type: 'list',
      name: 'template',
      message: 'Select a template:',
      choices: AVAILABLE_TEMPLATES.map((t) => ({
        name: `${t.name} - ${t.description}`,
        value: t.name,
      })),
    }])).template;

    const selectedTemplate = AVAILABLE_TEMPLATES.find((t) =>
      t.name === finalTemplateName
    );
    if (!selectedTemplate) {
      throw new Error(`Template '${finalTemplateName}' not found`);
    }

    const wranglerRoot = join(targetDir, selectedTemplate.wranglerRoot || "");

    const { initGit } = await inquirer.prompt([{
      type: 'list',
      name: 'initGit',
      message: 'Initialize a git repository?',
      choices: ['No', 'Yes'],
    }]);

    // TODO: Prompt user to install MCP configuration for IDE when we port those utilities
    // const mcpResult = workspace
    //   ? await promptIDESetup(
    //     { workspace, app: finalProjectName },
    //     targetDir,
    //   )
    //   : null;

    console.log(`📦 Downloading template '${selectedTemplate.name}'...`);
    await downloadTemplate(selectedTemplate, targetDir);

    // TODO: Write IDE config when we port MCP utilities
    // if (mcpResult) {
    //   await writeIDEConfig(mcpResult);
    // }

    await customizeTemplate({
      targetDir,
      projectName: finalProjectName,
      workspace,
      wranglerRoot,
    });

    if (initGit === "Yes") {
      try {
        const success = await runCommand("git", ["init"], targetDir);
        if (success) {
          console.log(`✅ Git repository initialized in '${finalProjectName}'`);
        } else {
          console.warn("⚠️  Failed to initialize git repository");
        }
      } catch (error) {
        console.warn(
          "⚠️  Could not initialize git repository:",
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    console.log(`\n🎉 Project '${finalProjectName}' created successfully!`);
    console.log(`\nNext steps:`);
    console.log(`  cd ${finalProjectName}`);
    console.log(`  npm install`);
    console.log(`  npm run dev`);
  } catch (error) {
    console.error(
      "❌ Failed to create project:",
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
}
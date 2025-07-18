import { Input, Select } from "@cliffy/prompt";
import { copy, ensureDir } from "@std/fs";
import { join } from "@std/path";
import {
  type Config,
  readWranglerConfig,
  writeWranglerConfig,
} from "./config.ts";
import { genEnv } from "./typings.ts";
import { promptIDESetup, writeIDEConfig } from "./utils/prompt-ide-setup.ts";
import { promptWorkspace } from "./utils/prompt-workspace.ts";
import { slugify } from "./utils/slugify.ts";
import { promptIntegrations } from "./utils/prompt-integrations.ts";

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
];

async function downloadTemplate(
  template: Template,
  targetDir: string,
): Promise<void> {
  const tempDir = await Deno.makeTempDir();

  try {
    const cloneCmd = new Deno.Command("git", {
      args: [
        "clone",
        "--depth",
        "1",
        "--branch",
        template.branch || "main",
        `https://github.com/${template.repo}.git`,
        tempDir,
      ],
    });

    const cloneResult = await cloneCmd.output();
    if (!cloneResult.success) {
      throw new Error(`Failed to clone template repository: ${template.repo}`);
    }

    // Remove the .git folder to avoid creating a local repository
    // pointing to the wrong repo
    const gitDir = join(tempDir, ".git");
    await Deno.remove(gitDir, { recursive: true }).catch(() => {
      console.warn(`Failed to remove .git folder: ${gitDir}`);
    });

    const templatePath = join(tempDir, template.path || "");
    const templateExists = await Deno.stat(templatePath).catch(() => false);

    if (!templateExists) {
      throw new Error(`Template '${template.name}' not found in repository`);
    }

    await ensureDir(targetDir);
    await copy(templatePath, targetDir, { overwrite: true });

    console.log(`✅ Template '${template.name}' downloaded successfully!`);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
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
    const packageJsonContent = await Deno.readTextFile(packageJsonPath);
    const packageJson = JSON.parse(packageJsonContent);

    packageJson.name = projectName;

    await Deno.writeTextFile(
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
      const bindings = await promptIntegrations(false, workspace);

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

      // Generate environment variables file
      const envContent = await genEnv({
        workspace: workspace,
        local: false,
        bindings: newConfig.deco.bindings || [],
      });

      const outputPath = join(wranglerRoot || targetDir, "deco.gen.ts");
      await Deno.writeTextFile(outputPath, envContent);
      console.log(`✅ Environment types written to: ${outputPath}`);
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
      const validTemplate = AVAILABLE_TEMPLATES.find(
        (t) => t.name === templateName,
      );
      if (!validTemplate) {
        console.error(`❌ Template '${templateName}' not found.`);
        console.log("\nAvailable templates:");
        listTemplates();
        Deno.exit(1);
      }
    }

    const finalProjectName = slugify(
      projectName ||
        (await Input.prompt({
          message: "Enter project name:",
          validate: (value) => {
            if (!value.trim()) {
              return "Project name cannot be empty";
            }
            if (!/^[a-z0-9-]+$/.test(value)) {
              return "Project name can only contain lowercase letters, numbers, and hyphens";
            }
            return true;
          },
        })),
    );

    // Prompt user to select workspace
    let workspace: string | undefined = config?.workspace;
    try {
      workspace = await promptWorkspace(config?.local, workspace);
      console.log(`📁 Selected workspace: ${workspace}`);
    } catch {
      console.warn(
        "⚠️  Could not select workspace. Please run 'deco login' to authenticate for a better experience.",
      );
      // Continue without workspace
    }

    const targetDir = join(Deno.cwd(), finalProjectName);
    const dirExists = await Deno.stat(targetDir).catch(() => false);

    if (dirExists) {
      const overwrite = await Select.prompt({
        message: `Directory '${finalProjectName}' already exists. Overwrite?`,
        options: ["No", "Yes"],
      });

      if (overwrite === "No") {
        console.log("❌ Project creation cancelled.");
        return;
      }

      await Deno.remove(targetDir, { recursive: true });
    }

    const finalTemplateName =
      templateName ||
      (await Select.prompt({
        message: "Select a template:",
        options: AVAILABLE_TEMPLATES.map((t) => ({
          name: `${t.name} - ${t.description}`,
          value: t.name,
        })),
      }));

    const selectedTemplate = AVAILABLE_TEMPLATES.find(
      (t) => t.name === finalTemplateName,
    );
    if (!selectedTemplate) {
      throw new Error(`Template '${finalTemplateName}' not found`);
    }

    const wranglerRoot = join(targetDir, selectedTemplate.wranglerRoot || "");

    const initGit = await Select.prompt({
      message: "Initialize a git repository?",
      options: ["No", "Yes"],
    });

    // Prompt user to install MCP configuration for IDE
    const mcpResult = workspace
      ? await promptIDESetup({ workspace, app: finalProjectName }, targetDir)
      : null;

    console.log(`📦 Downloading template '${selectedTemplate.name}'...`);
    await downloadTemplate(selectedTemplate, targetDir);

    if (mcpResult) {
      await writeIDEConfig(mcpResult);
    }

    await customizeTemplate({
      targetDir,
      projectName: finalProjectName,
      workspace,
      wranglerRoot,
    });

    if (initGit === "Yes") {
      try {
        const gitInitCmd = new Deno.Command("git", {
          args: ["init"],
          cwd: targetDir,
        });

        const gitInitResult = await gitInitCmd.output();
        if (gitInitResult.success) {
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
    Deno.exit(1);
  }
}

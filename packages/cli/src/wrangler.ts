import { join } from "node:path";
import {
  addWorkflowDO,
  getConfig,
  getConfigFilePath,
  readWranglerConfig,
} from "./config.ts";
import { readSession } from "./session.ts";

const envFile = ".dev.vars";

export async function getCurrentEnvVars(projectRoot: string) {
  const devVarsFile = await Deno.readTextFile(join(projectRoot, envFile)).catch(
    () => "",
  );
  return devVarsFile.split("\n").reduce(
    (acc, line) => {
      if (!line) {
        return acc;
      }
      const [key, value] = line.split("=");
      acc[key] = value;
      return acc;
    },
    {} as Record<string, string>,
  );
}

export async function writeEnvVars(
  projectRoot: string,
  envVars: Record<string, string | undefined>,
) {
  await Deno.writeTextFile(
    join(projectRoot, envFile),
    Object.entries(envVars)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n"),
  );
}

const getProjectRoot = () => {
  const configPath = getConfigFilePath(Deno.cwd()) ?? Deno.cwd();
  return configPath.replace("/wrangler.toml", "");
};
export async function getEnvVars(projectRoot?: string) {
  if (!projectRoot) {
    projectRoot = getProjectRoot();
  }
  const [currentEnvVars, session, config, wrangler] = await Promise.all([
    getCurrentEnvVars(projectRoot),
    readSession(),
    getConfig({}),
    readWranglerConfig(projectRoot),
  ]);
  const encodedBindings = btoa(JSON.stringify(config.bindings));

  const workspace = config.workspace ?? session?.workspace;
  const env: Record<string, string> = {
    ...currentEnvVars,
    DECO_CHAT_WORKSPACE: workspace,
    DECO_CHAT_API_TOKEN: session?.access_token ?? "",
    DECO_CHAT_BINDINGS: encodedBindings,
    DECO_CHAT_APP_ENTRYPOINT: "http://localhost:8787",
  };

  const { name, scope } = wrangler;
  if (name) {
    const [_, slug] = workspace.split("/");
    env.DECO_CHAT_APP_NAME = `@${scope ?? slug}/${name}`;
  }

  if (config.local) {
    env.DECO_CHAT_API_URL = "http://localhost:3001";
  } else {
    delete env.DECO_CHAT_API_URL;
  }

  return env;
}

async function ensureEnvVarsGitIgnore(projectRoot: string) {
  const gitignorePath = join(projectRoot, ".gitignore");

  try {
    const gitignoreContent = await Deno.readTextFile(gitignorePath);
    const lines = gitignoreContent.split("\n");

    // Check if entry already exists (exact match or as part of a line)
    const entryExists = lines.some(
      (line) => line.trim() === envFile || line.trim() === `/${envFile}`,
    );

    if (!entryExists) {
      const newContent = gitignoreContent.endsWith("\n")
        ? gitignoreContent + envFile + "\n"
        : gitignoreContent + "\n" + envFile + "\n";
      await Deno.writeTextFile(gitignorePath, newContent);
    }
  } catch {
    // .gitignore doesn't exist, create it
    await Deno.writeTextFile(gitignorePath, envFile + "\n");
  }
}

async function addZodDependency(projectRoot: string) {
  const packageJsonPath = join(projectRoot, "package.json");

  const packageJsonContent = await Deno.readTextFile(packageJsonPath);
  const packageJson = JSON.parse(packageJsonContent);

  // Ensure dependencies object exists
  if (!packageJson.dependencies) {
    packageJson.dependencies = {};
  }

  // Add or update zod dependency
  packageJson.dependencies.zod = "^3.24.3";

  // Write back to file with proper formatting
  await Deno.writeTextFile(
    packageJsonPath,
    JSON.stringify(packageJson, null, 2) + "\n",
  );
}

export async function ensureDevEnvironment() {
  const projectRoot = getProjectRoot();
  await ensureEnvVarsGitIgnore(projectRoot);
  const env = await getEnvVars(projectRoot);
  await writeEnvVars(projectRoot, env);
  await addWorkflowDO();
  await addZodDependency(projectRoot);
}

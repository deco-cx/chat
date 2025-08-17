import { join, dirname } from "path";
import { promises as fs } from "fs";
import {
  addWorkflowDO,
  getConfig,
  getConfigFilePath,
  readWranglerConfig,
} from "./config.js";
import { readSession } from "./session.js";
import process from "node:process";
import { Buffer } from "node:buffer";
import { StartDevServerOptions } from "../commands/dev/dev.js";

const envFile = ".dev.vars";

export async function getCurrentEnvVars(projectRoot: string): Promise<{
  envVars: Record<string, string>;
  envFilepath: string;
}> {
  const envFilepath = join(projectRoot, envFile);
  const devVarsFile = await fs.readFile(envFilepath, "utf-8").catch(() => "");
  const envVars = devVarsFile.split("\n").reduce(
    (acc, line) => {
      if (!line || line.startsWith("#")) {
        return acc;
      }
      const firstEqualIndex = line.indexOf("=");
      if (firstEqualIndex === -1) {
        return acc;
      }
      const key = line.substring(0, firstEqualIndex);
      const value = line.substring(firstEqualIndex + 1);
      acc[key] = value;
      return acc;
    },
    {} as Record<string, string>,
  );

  return {
    envVars,
    envFilepath,
  };
}

export async function writeEnvVars(
  projectRoot: string,
  envVars: Record<string, string | undefined>,
) {
  await fs.writeFile(
    join(projectRoot, envFile),
    Object.entries(envVars)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n"),
  );
}

const getProjectRoot = () => {
  const configPath = getConfigFilePath(process.cwd()) ?? process.cwd();
  return dirname(configPath);
};

export async function getEnvVars(projectRoot?: string) {
  if (!projectRoot) {
    projectRoot = getProjectRoot();
  }
  const [currentEnvVars, session, config, wrangler] = await Promise.all([
    getCurrentEnvVars(projectRoot).then(({ envVars }) => envVars),
    readSession(),
    getConfig({}),
    readWranglerConfig(projectRoot),
  ]);
  const encodedBindings = Buffer.from(JSON.stringify(config.bindings)).toString(
    "base64",
  );

  const workspace = config.workspace ?? session?.workspace;
  const env: Record<string, string> = {
    ...currentEnvVars,
    DECO_CHAT_WORKSPACE: workspace || "",
    DECO_CHAT_API_TOKEN: session?.access_token ?? "",
    DECO_CHAT_BINDINGS: encodedBindings,
    DECO_CHAT_APP_ENTRYPOINT: "http://localhost:8888",
  };

  const { name, scope } = wrangler;
  if (name && workspace) {
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
    const gitignoreContent = await fs.readFile(gitignorePath, "utf-8");
    const lines = gitignoreContent
      .split("\n")
      .reduce<string[]>((acc: string[], line: string) => {
        if (!line.includes(envFile)) {
          acc.push(line);
        }
        return acc;
      }, []);

    // Check if entry already exists (exact match or as part of a line)
    const entryExists = lines.some(
      (line) => line.trim() === envFile || line.trim() === `/${envFile}`,
    );

    if (!entryExists) {
      const newContent = gitignoreContent.endsWith("\n")
        ? gitignoreContent + envFile + "\n"
        : gitignoreContent + "\n" + envFile + "\n";
      await fs.writeFile(gitignorePath, newContent);
    }
  } catch {
    // .gitignore doesn't exist, create it
    await fs.writeFile(gitignorePath, envFile + "\n");
  }
}

async function addZodDependency(projectRoot: string) {
  const packageJsonPath = join(projectRoot, "package.json");

  const packageJsonContent = await fs.readFile(packageJsonPath, "utf-8");
  const packageJson = JSON.parse(packageJsonContent);

  // Ensure dependencies object exists
  if (!packageJson.dependencies) {
    packageJson.dependencies = {};
  }

  // Add or update zod dependency
  packageJson.dependencies.zod = "^3.24.3";

  // Write back to file with proper formatting
  await fs.writeFile(
    packageJsonPath,
    JSON.stringify(packageJson, null, 2) + "\n",
  );
}

async function cleanBuildDirectory(projectRoot: string, directory: string) {
  const buildDir = join(projectRoot, directory);
  await fs.rm(buildDir, { recursive: true, force: true });
  await fs.mkdir(buildDir);
}

export async function ensureDevEnvironment(opts: StartDevServerOptions) {
  const projectRoot = getProjectRoot();
  if (opts.cleanBuildDirectory?.enabled) {
    await cleanBuildDirectory(projectRoot, opts.cleanBuildDirectory.directory);
  }
  await ensureEnvVarsGitIgnore(projectRoot);
  const env = await getEnvVars(projectRoot);
  await writeEnvVars(projectRoot, env);
  await addWorkflowDO();
  await addZodDependency(projectRoot);
}

import type { Plugin } from "vite";
import process from "process";
import path from "path";
import { exec } from "child_process";
import fs from "fs/promises";

interface PluginConfig {
  port?: number;
  experimentalAutoGenerateTypes?: boolean;
}

const cwd = process.cwd();
const DEFAULT_PORT = 8787;
const GEN_PROMISE_KEY = "deco-gen";

const GEN_FILE = "deco.gen.ts";

function performDecoGen() {
  // @ts-ignore: Bun is a global that may not be defined in all environments
  const cmd = typeof Bun === "undefined" ? "npm run gen" : "bun run gen";
  exec(cmd, { cwd }, (error) => {
    if (error) {
      console.error(`Error performing deco gen: ${error}`);
    }
  });
}

function shouldPerformDecoGen({ filePath }: { filePath: string }): boolean {
  return filePath.startsWith("server/") && !filePath.endsWith(GEN_FILE);
}

const FILES_TO_REMOVE = [
  "wrangler.json",
  ".dev.vars",
  // TODO: Support source maps
  "index.js.map",
];

const RENAME_MAP = {
  "index.js": "main.js",
};

const OPERATIONS = [
  ...FILES_TO_REMOVE.map((file) => ({
    type: "remove" as const,
    file,
  })),
  ...Object.entries(RENAME_MAP).map(([oldFile, newFile]) => ({
    type: "rename" as const,
    oldFile,
    newFile,
  })),
];

async function fixCloudflareBuild({
  outputDirectory,
}: {
  outputDirectory: string;
}) {
  // Return early if output directory doesn't exist
  try {
    await fs.access(outputDirectory);
  } catch {
    return;
  }

  const files = await fs.readdir(outputDirectory);

  const isCloudflareViteBuild = files.some((file) => file === "wrangler.json");

  if (!isCloudflareViteBuild) {
    return;
  }

  const results = await Promise.allSettled(
    OPERATIONS.map(async (operation) => {
      if (operation.type === "remove") {
        await fs.rm(path.join(outputDirectory, operation.file));
      } else if (operation.type === "rename") {
        await fs.rename(
          path.join(outputDirectory, operation.oldFile),
          path.join(outputDirectory, operation.newFile),
        );
      }
    }),
  );

  results.forEach((result) => {
    if (result.status === "rejected") {
      console.error(`Error performing operation: ${result.reason}`);
    }
  });
}

export function deco(decoConfig: PluginConfig = {}): Plugin {
  let outputDirectory = "dist";
  const singleFlight = new Map<string, Promise<void>>();

  return {
    name: "vite-plugin-deco",
    enforce: "post",
    configResolved(config) {
      outputDirectory = config.build.outDir || "dist";
    },
    buildStart() {
      if (!decoConfig.experimentalAutoGenerateTypes) {
        return;
      }
      performDecoGen();
    },
    async closeBundle() {
      await fixCloudflareBuild({ outputDirectory });
    },
    handleHotUpdate(ctx) {
      // skip hmr entirely for the deco gen file
      if (ctx.file.endsWith(GEN_FILE)) {
        return [];
      }
      if (!decoConfig.experimentalAutoGenerateTypes) {
        return ctx.modules;
      }
      const relative = path.relative(cwd, ctx.file);
      if (!shouldPerformDecoGen({ filePath: relative })) {
        return ctx.modules;
      }
      const promise = singleFlight.get(GEN_PROMISE_KEY);
      if (promise) {
        return ctx.modules;
      }
      const newPromise = performDecoGen().finally(() => {
        singleFlight.delete(GEN_PROMISE_KEY);
      });
      singleFlight.set(GEN_PROMISE_KEY, newPromise);
      return ctx.modules;
    },
    config: () => ({
      server: {
        port: decoConfig.port || DEFAULT_PORT,
        strictPort: true,
      },
      worker: {
        format: "es",
      },
      optimizeDeps: {
        force: true,
      },
      build: {
        sourcemap: true,
      },
    }),
  };
}

export function importSqlStringPlugin(): Plugin {
  return {
    name: "vite-plugin-import-sql-string",
    transform(content: string, id: string) {
      if (id.endsWith(".sql")) {
        return {
          code: `export default ${JSON.stringify(content)};`,
          map: null,
        };
      }
    },
  };
}

export default function vitePlugins(decoConfig: PluginConfig = {}): Plugin[] {
  return [deco(decoConfig), importSqlStringPlugin()];
}

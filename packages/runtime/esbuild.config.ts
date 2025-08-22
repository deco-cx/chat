import esbuild, { BuildOptions } from "esbuild";
import packageJson from "./package.json" with { type: "json" };

// Generate entry points from exports automatically
const entryPoints: Record<string, string> = {};
Object.keys(packageJson.exports).forEach((exportPath) => {
  // Infer source file path from export path
  let sourceFile: string;

  if (exportPath === ".") {
    sourceFile = "./src/index.ts";
  } else {
    // Convert export path to source file path automatically
    // e.g., "./d1" -> "./src/d1.ts", "./proxy" -> "./src/proxy.ts"
    const moduleName = exportPath.slice(2); // Remove "./" prefix
    sourceFile = `./src/${moduleName}.ts`;
  }

  // Remove "./" prefix for entry point names
  const entryName = exportPath === "." ? "index" : exportPath.slice(2);
  entryPoints[entryName] = sourceFile;
});

const buildConfig: BuildOptions = {
  entryPoints,
  bundle: true,
  format: "esm",
  target: "es2022",
  platform: "neutral",
  outdir: "./dist",
  plugins: [
    {
      name: "external-non-ts",
      setup(build) {
        build.onResolve({ filter: /.*/ }, (args) => {
          // If it's relative or absolute import, check the extension
          if (!args.path.endsWith(".ts") && !args.path.endsWith(".tsx")) {
            return { path: args.path, external: true };
          }
          return null; // let esbuild handle normal .ts resolution
        });
      },
    },
  ],
  define: {
    "process.env.NODE_ENV": '"production"',
  },
  minify: false, // Set to true for production builds
  sourcemap: true,
  metafile: true,
  // Ensure proper module resolution
  mainFields: ["module", "main"],
  conditions: ["import", "module"],
};

// Build function
async function build() {
  try {
    const result = await esbuild.build(buildConfig);
    console.log("Build completed successfully");
    console.log(
      "Output files:",
      result.outputFiles?.map((f) => f.path) || "No output files",
    );
  } catch (error) {
    console.error("Build failed:", error);
    process.exit(1);
  }
}

// Watch mode for development
if (process.argv.includes("--watch")) {
  const context = await esbuild.context(buildConfig);
  await context.watch();
  console.log("Watching for changes...");
} else {
  build();
}

export default buildConfig;

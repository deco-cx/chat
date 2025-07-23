import { D1Store } from "@mastra/cloudflare-d1";
import { parse as parseToml } from "smol-toml";
import { z } from "zod";
import { JwtIssuer } from "../../auth/jwt.ts";
import { NotFoundError, UserInputError } from "../../errors.ts";
import type { Database } from "../../storage/index.ts";
import {
  assertHasWorkspace,
  assertWorkspaceResourceAccess,
  type WithTool,
} from "../assertions.ts";
import { type AppContext, createToolGroup, getEnv } from "../context.ts";
import { getWorkspaceD1Database } from "../databases/api.ts";
import { MCPClient } from "../index.ts";
import { bundler } from "./bundler.ts";
import { assertsDomainUniqueness } from "./custom-domains.ts";
import { type DeployResult, deployToCloudflare } from "./deployment.ts";
import type { WranglerConfig } from "./wrangler.ts";

const SCRIPT_FILE_NAME = "script.mjs";
export const HOSTING_APPS_DOMAIN = ".deco.page";
export const Entrypoint = {
  host: (appSlug: string) => {
    return `${appSlug}${HOSTING_APPS_DOMAIN}`;
  },
  build: (appSlug: string) => {
    return `https://${Entrypoint.host(appSlug)}`;
  },
  script: (domain: string) => {
    if (domain.endsWith(HOSTING_APPS_DOMAIN)) {
      return domain.split(HOSTING_APPS_DOMAIN)[0];
    }
    return null;
  },
};

// Zod schemas for input
const AppSchema = z.object({
  slug: z.string().optional(), // defaults to 'default'
  entrypoint: z.string(),
});

const AppInputSchema = z.object({
  appSlug: z.string(), // defaults to 'default'
});

const DECO_CHAT_HOSTING_APPS_TABLE = "deco_chat_hosting_apps" as const;
const DECO_CHAT_HOSTING_ROUTES_TABLE = "deco_chat_hosting_routes" as const;

type AppRow =
  Database["public"]["Tables"][typeof DECO_CHAT_HOSTING_APPS_TABLE]["Row"];

export type App = z.infer<typeof AppSchema>;

const Mappers = {
  toApp: (
    data: AppRow,
  ): App & {
    id: string;
    workspace: string;
    files: z.infer<typeof FileSchema>[];
  } => {
    const files = Object.entries(
      data.files ?? {} as Record<string, string>,
    ).map((
      [path, content],
    ) => ({
      path,
      content,
    }));
    return {
      id: data.id,
      slug: data.slug,
      entrypoint: Entrypoint.build(data.slug),
      workspace: data.workspace,
      files,
    };
  },
};

const createTool = createToolGroup("Hosting", {
  name: "Hosting & Deployment",
  description: "Deploy serverless apps via Cloudflare Workers.",
  icon:
    "https://assets.decocache.com/mcp/59297cd7-2ecd-452f-8b5d-0ff0d0985232/Hosting--Deployment.png",
});

// 1. List apps for a given workspace
export const listApps = createTool({
  name: "HOSTING_APPS_LIST",
  description: "List all apps for the current tenant",
  inputSchema: z.object({}),
  handler: async (_, c) => {
    await assertWorkspaceResourceAccess(c.tool.name, c);

    assertHasWorkspace(c);
    const workspace = c.workspace.value;

    const { data, error } = await c.db
      .from(DECO_CHAT_HOSTING_APPS_TABLE)
      .select("*")
      .eq("workspace", workspace);

    if (error) throw error;

    return data.map(Mappers.toApp);
  },
});

function routeKey(route: { route_pattern: string; custom_domain?: boolean }) {
  return `${route.route_pattern}|${!!route.custom_domain}`;
}

async function updateDatabase(
  c: AppContext,
  workspace: string,
  scriptSlug: string,
  result: DeployResult,
  wranglerConfig: WranglerConfig,
  files?: Record<string, string>,
) {
  // Try to update first
  let { data: app, error: updateError } = await c.db
    .from(DECO_CHAT_HOSTING_APPS_TABLE)
    .update({
      updated_at: new Date().toISOString(),
      cloudflare_script_hash: result.etag,
      cloudflare_worker_id: result.id,
      files,
    })
    .eq("slug", scriptSlug)
    .eq("workspace", workspace)
    .select("*")
    .single();

  if (updateError && updateError.code !== "PGRST116") { // PGRST116: Results contain 0 rows
    throw updateError;
  }

  if (!app) {
    // If not updated, insert
    const { data: inserted, error: insertError } = await c.db
      .from(DECO_CHAT_HOSTING_APPS_TABLE)
      .upsert({
        workspace,
        slug: scriptSlug,
        updated_at: new Date().toISOString(),
        cloudflare_script_hash: result.etag,
        cloudflare_worker_id: result.id,
        files,
      })
      .select("*")
      .single();

    if (insertError) throw insertError;
    app = inserted;
  }
  if (!app) {
    throw new Error("Failed to create or update app.");
  }
  // calculate route diff
  const routes = wranglerConfig.routes ?? [];
  const mappedRoutes = routes.map((r) => ({
    route_pattern: r.pattern,
    custom_domain: r.custom_domain,
  }));

  // 1. Fetch current routes for this app
  const { data: currentRoutes, error: fetchRoutesError } = await c.db
    .from(DECO_CHAT_HOSTING_ROUTES_TABLE)
    .select("id, route_pattern, custom_domain")
    .eq("hosting_app_id", app.id);
  if (fetchRoutesError) throw fetchRoutesError;

  // 2. Build sets for diffing
  const currentRouteMap = new Map(
    (currentRoutes ?? []).map((r) => [routeKey(r), r]),
  );

  const newRouteMap = new Map(
    mappedRoutes.map((
      r,
    ) => [
      routeKey(r),
      r,
    ]),
  );

  // 3. Find routes to delete (in current, not in new)
  const toDelete = (currentRoutes ?? []).filter(
    (r) => !newRouteMap.has(routeKey(r)),
  );
  // 4. Find routes to insert (in new, not in current)
  const toInsert = mappedRoutes.filter(
    (r) =>
      !currentRouteMap.has(
        routeKey(r),
      ),
  );

  // 5. Perform insertions and deletions in parallel
  await Promise.all([
    toDelete.length > 0
      ? c.db
        .from(DECO_CHAT_HOSTING_ROUTES_TABLE)
        .delete()
        .in(
          "id",
          toDelete.map((r) => r.id),
        )
      : Promise.resolve(),
    toInsert.length > 0
      ? c.db
        .from(DECO_CHAT_HOSTING_ROUTES_TABLE)
        .upsert(
          toInsert.map((route) => ({
            hosting_app_id: app.id,
            route_pattern: route.route_pattern,
            custom_domain: route.custom_domain ?? false,
          })),
          {
            onConflict: "hosting_app_id,route_pattern,custom_domain",
          },
        )
      : Promise.resolve(),
  ]);

  return Mappers.toApp(app);
}

const MIME_TYPES: Record<string, string> = {
  "js": "application/javascript+module",
  "mjs": "application/javascript+module",
  "ts": "application/javascript+module",
  "json": "application/json",
  "wasm": "application/wasm",
  "css": "text/css",
  "html": "text/html",
  "txt": "text/plain",
  "toml": "text/plain",
  "svg": "image/svg+xml",
  "png": "image/png",
  "jpg": "image/jpeg",
  "jpeg": "image/jpeg",
  "gif": "image/gif",
  "ico": "image/x-icon",
  "webp": "image/webp",
  "avif": "image/avif",
  "heic": "image/heic",
  "heif": "image/heif",
  "heif-sequence": "image/heif-sequence",
  "heic-sequence": "image/heic-sequence",
  "avif-sequence": "image/avif-sequence",
  "mp4": "video/mp4",
  "webm": "video/webm",
  "ogg": "video/ogg",
  "mp3": "audio/mpeg",
  "wav": "audio/wav",
  "woff": "font/woff",
  "woff2": "font/woff2",
  "ttf": "font/ttf",
  "eot": "font/eot",
  "otf": "font/otf",
  "woff-sequence": "font/woff-sequence",
  "woff2-sequence": "font/woff2-sequence",
};

export const getMimeType = (path: string): string => {
  const ext = path.split(".").pop()?.toLowerCase() ?? "txt";
  return MIME_TYPES[ext] ?? "text/plain";
};

let created = false;
const createNamespaceOnce = async (c: AppContext) => {
  if (created) return;
  created = true;
  const cf = c.cf;
  const env = getEnv(c);
  await cf.workersForPlatforms.dispatch.namespaces.create({
    name: env.CF_DISPATCH_NAMESPACE,
    account_id: env.CF_ACCOUNT_ID,
  }).catch(() => {});
};

// main.ts or main.mjs or main.js or main.cjs
const ENTRYPOINTS = ["main.ts", "main.mjs", "main.js", "main.cjs"];
const CONFIGS = ["wrangler.toml"];

// First, let's define a new type for the file structure
const FileSchema = z.object({
  path: z.string(),
  content: z.string(),
  asset: z.boolean().optional(),
});

const ensureLeadingSlash = (path: string) => {
  return path.startsWith("/") ? path : `/${path}`;
};

const splitFiles = (
  files: Record<string, { content: string; asset: boolean }>,
) => {
  const code: Record<string, string> = {};
  const assets: Record<string, string> = {};

  for (const [path, { content, asset }] of Object.entries(files)) {
    if (asset) {
      const assetPath = ensureLeadingSlash(path);
      assets[assetPath] = content;
    } else {
      code[path] = content;
    }
  }

  return {
    code,
    assets,
  };
};

const DECO_WORKER_RUNTIME_VERSION = "0.4.0";
// Update the schema in deployFiles
export const deployFiles = createTool({
  name: "HOSTING_APP_DEPLOY",
  description:
    `Deploy multiple TypeScript files that use Wrangler for bundling and deployment to Cloudflare Workers. You must provide a package.json file with the necessary dependencies and a wrangler.toml file matching the Workers for Platforms format. Use 'main_module' instead of 'main', and define bindings using the [[bindings]] array, where each binding is a table specifying its type and properties. To add custom Deco bindings, set type = "MCP" in a binding entry (these will be filtered and handled automatically).

Common patterns:
1. Use a package.json file to manage dependencies:
   // package.json
   {
     "name": "@deco/workers-example",
     "private": true,
     "version": "0.0.0",
     "type": "module",
     "scripts": {
       "dev": "deco dev",
       "gen": "deco gen > env.gen.ts",
       "setup": "deno install -Ar -g -n deco jsr:@deco/cli -f",
       "deploy": "wrangler deploy --dry-run --outdir ./dist && deco deploy ./dist"
     },
     "dependencies": {
       "@cloudflare/workers-types": "^4.20250617.0",
       "@deco/mcp": "npm:@jsr/deco__mcp@^0.5.6",
       "@deco/workers-runtime": "npm:@jsr/deco__workers-runtime@^${DECO_WORKER_RUNTIME_VERSION}",
       "@mastra/core": "^0.11.1",
       "zod": "^3.25.67"
     },
     "devDependencies": {
       "wrangler": "^4.13.2"
     },
     "engines": {
       "node": ">=20.0.0"
     }
   }

2. Import dependencies directly in your files:
   // main.ts
   import { z } from "zod";
   import { withRuntime } from "@deco/workers-runtime";

3. Use wrangler.toml to configure your app:
   // wrangler.toml
   name = "app-slug"
   compatibility_date = "2025-06-17"
   main_module = "main.ts"
   kv_namespaces = [
     { binding = "TODO", id = "06779da6940b431db6e566b4846d64db" }
   ]
   routes = [
     { pattern = "my.example.com", custom_domain = true }
   ]

   browser = { binding = "MYBROWSER" }

   [triggers]
   # Schedule cron triggers:
   crons = [ "*/3 * * * *", "0 15 1 * *", "59 23 LW * *" ]

   # This is required when using the Workflow class
  [[durable_objects.bindings]]
  name = "DECO_CHAT_WORKFLOW_DO"
  class_name = "Workflow"

  [[durable_objects.bindings]]
  name = "MY_DURABLE_OBJECT"
  class_name = "MyDurableObject"

  # This is required when using the Workflow class
  [[migrations]]
  tag = "v1"
  new_classes = ["Workflow", "MyDurableObject"]

  [ai]
  binding = "AI"

  [[queues.consumers]]
  queue = "queues-web-crawler"
  max_batch_timeout = 60

  [[queues.producers]]
  queue = "queues-web-crawler"
  binding = "CRAWLER_QUEUE"

  [[deco.bindings]]
  type = "MCP"
  name = "MY_BINDING"
  value = "INTEGRATION_ID"

   # You can add any supported binding type as per Workers for Platforms documentation.
4. You should always surround the user fetch with the withRuntime function.

import { withRuntime } from "@deco/workers-runtime";

const { Workflow, ...workerAPIs } = withRuntime({
  fetch: async (request: Request, env: any) => {
    return new Response("Hello from Cloudflare Workers!");
  }
})
export { Workflow };
export default workerAPIs;

You must use the Workers for Platforms TOML format for wrangler.toml. The bindings supports all standard binding types (ai, analytics_engine, assets, browser_rendering, d1, durable_object_namespace, hyperdrive, kv_namespace, mtls_certificate, plain_text, queue, r2_bucket, secret_text, service, tail_consumer, vectorize, version_metadata, etc). For Deco-specific bindings, use type = "MCP".
For routes, only custom domains are supported. The user must point their DNS to the script endpoint. $SCRIPT.deco.page using DNS-Only. The user needs to wait for the DNS to propagate before the app will be available.

Example of files deployment:
[
  {
    "path": "package.json",
    "content": \`{
  "name": "@deco/workers-example",
  "version": "0.0.0",
  "type": "module",
  "dependencies": {
    "@cloudflare/workers-types": "^4.20250617.0",
    "@deco/workers-runtime": "npm:@jsr/deco__workers-runtime@^0.2.18",
    "@mastra/core": "^0.11.1",
    "zod": "^3.25.67"
  },
  "devDependencies": {
    "wrangler": "^4.13.2"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}\`
  },
  {
    "path": "main.ts",
    "content": \`
      import { z } from "zod";
      import { withRuntime } from "@deco/workers-runtime";

      const { Workflow, ...workerAPIs } = withRuntime({
        fetch: async (request: Request, env: any) => {
          return new Response("Hello from Cloudflare Workers!");
        }
      })
      export { Workflow };
      export default workerAPIs;
    \`
  },
  {
    "path": "wrangler.toml",
    "content": \`
name = "app-slug"
compatibility_date = "2025-06-17"
main_module = "main.ts"
kv_namespaces = [
  { binding = "TODO", id = "06779da6940b431db6e566b4846d64db" }
]
routes = [
  { pattern = "my.example.com", custom_domain = true }
]

browser = { binding = "MYBROWSER" }

[triggers]
# Schedule cron triggers:
crons = [ "*/3 * * * *", "0 15 1 * *", "59 23 LW * *" ]

# This is required when using the Workflow class
[[durable_objects.bindings]]
name = "DECO_CHAT_WORKFLOW_DO"
class_name = "Workflow"

[[durable_objects.bindings]]
name = "MY_DURABLE_OBJECT"
class_name = "MyDurableObject"

# This is required when using the Workflow class
[[migrations]]
tag = "v1"
new_classes = ["Workflow", "MyDurableObject"]

[ai]
binding = "AI"

[[queues.consumers]]
queue = "queues-web-crawler"
max_batch_timeout = 60

[[queues.producers]]
queue = "queues-web-crawler"
binding = "CRAWLER_QUEUE"

[[deco.bindings]]
type = "MCP"
name = "MY_BINDING"
value = "INTEGRATION_ID"
\`
  }
]

Important Notes:
- You can access the app workspace by accessing env.DECO_CHAT_WORKSPACE
- You can access the app script slug by accessing env.DECO_CHAT_SCRIPT_SLUG
- Token and workspace can be used to make authenticated requests to the Deco API under https://api.deco.chat
- Always use Cloudflare Workers syntax with export default and proper fetch handler signature
- When using template literals inside content strings, escape backticks with a backslash (\\) or use string concatenation (+)
- You must include a package.json file with the @deco/workers-runtime dependency
- Dependencies are managed through npm packages in package.json, not npm: or jsr: specifiers
- Wrangler will handle the bundling process using the dependencies defined in package.json`,
  inputSchema: z.object({
    appSlug: z.string().optional().describe(
      "The slug identifier for the app, if not provided, you should use the wrangler.toml file to determine the slug (using the name field).",
    ),
    files: z.array(FileSchema).describe(
      "An array of files with their paths and contents. Must include main.ts as entrypoint and package.json for dependencies",
    ),
    envVars: z.record(z.string(), z.string()).optional().describe(
      "An optional object of environment variables to be set on the worker",
    ),
    bundle: z.boolean().optional().default(true).describe(
      "If false, skip the bundler step and upload the files as-is. Default: true (bundle files)",
    ),
    unlisted: z.boolean().optional().default(true).describe(
      "Whether the app should be unlisted in the registry. Default: true (unlisted)",
    ),
  }),
  handler: async (
    { appSlug: _appSlug, files, envVars, bundle = true, unlisted = true },
    c,
  ) => {
    await assertWorkspaceResourceAccess(c.tool.name, c);

    // Convert array to record for bundler or direct upload
    const filesRecord = files.reduce((acc, file) => {
      acc[file.path] = { content: file.content, asset: file.asset ?? false };
      return acc;
    }, {} as Record<string, { content: string; asset: boolean }>);

    const wranglerFile = CONFIGS.find((file) => file in filesRecord);
    const wranglerConfig: WranglerConfig = wranglerFile
      // deno-lint-ignore no-explicit-any
      ? parseToml(filesRecord[wranglerFile]?.content) as any as WranglerConfig
      : { name: _appSlug } as WranglerConfig;

    // check if the entrypoint is in the files
    const entrypoints = [
      ...ENTRYPOINTS,
      wranglerConfig.main ?? wranglerConfig.main_module ?? "main.ts",
    ];
    const entrypoint = entrypoints.find((entrypoint) =>
      entrypoint in filesRecord
    );
    if (!entrypoint) {
      throw new UserInputError(
        `Entrypoint not found in files. Entrypoint must be one of: ${
          [...new Set(entrypoints)].join(", ")
        }`,
      );
    }

    if (!wranglerConfig?.name) {
      throw new UserInputError(
        `App slug not found in wrangler.toml`,
      );
    }

    const appSlug = wranglerConfig.name;

    await createNamespaceOnce(c);
    assertHasWorkspace(c);
    const workspace = c.workspace.value;
    const scriptSlug = appSlug;

    const { code: codeFiles, assets: assetFiles } = splitFiles(filesRecord);
    let bundledCode: Record<string, File>;

    if (bundle) {
      // Bundle the files
      const bundledScript = await bundler(
        codeFiles,
        entrypoint,
      );
      bundledCode = {
        [SCRIPT_FILE_NAME]: new File(
          [bundledScript],
          SCRIPT_FILE_NAME,
          { type: "application/javascript+module" },
        ),
      };
    } else {
      bundledCode = Object.fromEntries(
        Object.entries(codeFiles).map(([path, content]) => [
          path,
          new File([content], path, { type: getMimeType(path) }),
        ]),
      );
    }

    const keyPair = c.envVars.DECO_CHAT_API_JWT_PRIVATE_KEY &&
        c.envVars.DECO_CHAT_API_JWT_PUBLIC_KEY
      ? {
        public: c.envVars.DECO_CHAT_API_JWT_PUBLIC_KEY,
        private: c.envVars.DECO_CHAT_API_JWT_PRIVATE_KEY,
      }
      : undefined;

    const issuer = await JwtIssuer.forKeyPair(keyPair);
    const appName = `@${
      wranglerConfig?.scope ?? c.workspace.slug
    }/${scriptSlug}`;

    const token = await issuer.issue({
      sub: `app:${appName}`,
      aud: workspace,
    });

    const appEnvVars = {
      DECO_CHAT_WORKSPACE: workspace,
      DECO_CHAT_SCRIPT_SLUG: scriptSlug,
      DECO_CHAT_API_TOKEN: token,
      DECO_CHAT_API_JWT_PUBLIC_KEY: keyPair?.public,
      DECO_CHAT_APP_NAME: appName,
      DECO_CHAT_APP_ENTRYPOINT: Entrypoint.build(scriptSlug),
    };

    await Promise.all(
      (wranglerConfig.routes ?? []).map((route) =>
        route.custom_domain &&
        assertsDomainUniqueness(c, route.pattern, scriptSlug)
      ),
    );

    const result = await deployToCloudflare({
      c,
      wranglerConfig,
      mainModule: bundle ? SCRIPT_FILE_NAME : entrypoint,
      bundledCode,
      assets: assetFiles,
      _envVars: { ...envVars, ...appEnvVars },
    });
    const data = await updateDatabase(
      c,
      workspace,
      scriptSlug,
      result,
      wranglerConfig,
      codeFiles,
    );

    const client = MCPClient.forContext(c);
    await client.REGISTRY_PUBLISH_APP({
      name: scriptSlug,
      scopeName: wranglerConfig?.scope ?? c.workspace.slug,
      description:
        `App ${scriptSlug} by deco workers for workspace ${workspace}`,
      icon:
        "https://assets.decocache.com/mcp/09e44283-f47d-4046-955f-816d227c626f/app.png",
      ...wranglerConfig.deco?.integration,
      unlisted: unlisted ?? true,
      connection: {
        type: "HTTP",
        url: `${data.entrypoint}/mcp`,
      },
    }).catch((err) => {
      console.error(err);
    });
    return {
      entrypoint: data.entrypoint,
      id: data.id,
      workspace: data.workspace,
    };
  },
});

// Delete app (and worker)
export const deleteApp = createTool({
  name: "HOSTING_APP_DELETE",
  description: "Delete an app and its worker",
  inputSchema: AppInputSchema,
  handler: async ({ appSlug }, c) => {
    await assertWorkspaceResourceAccess(c.tool.name, c);
    assertHasWorkspace(c);
    const workspace = c.workspace.value;
    const scriptSlug = appSlug;

    const cf = c.cf;
    const env = getEnv(c);
    const namespace = env.CF_DISPATCH_NAMESPACE;

    // 1. Delete worker script from Cloudflare
    try {
      await cf.workersForPlatforms.dispatch.namespaces.scripts.delete(
        namespace,
        scriptSlug,
        {
          account_id: env.CF_ACCOUNT_ID,
        },
      );
    } catch {
      // Optionally, log error but don't throw if script doesn't exist
      // (idempotency)
    }

    // 2. Delete from DB
    const { error: dbError } = await c.db
      .from(DECO_CHAT_HOSTING_APPS_TABLE)
      .delete()
      .eq("workspace", workspace)
      .eq("slug", scriptSlug);

    if (dbError) throw dbError;

    return { success: true };
  },
});

// Get app info (metadata, endpoint, etc)
export const getAppInfo = createTool({
  name: "HOSTING_APP_INFO",
  description: "Get info/metadata for an app (including endpoint)",
  inputSchema: AppInputSchema,
  handler: async ({ appSlug }, c) => {
    await assertWorkspaceResourceAccess(c.tool.name, c);
    assertHasWorkspace(c);
    const workspace = c.workspace.value;
    const scriptSlug = appSlug;

    // 1. Fetch from DB
    const { data, error } = await c.db
      .from(DECO_CHAT_HOSTING_APPS_TABLE)
      .select("*")
      .eq("workspace", workspace)
      .eq("slug", scriptSlug)
      .single();

    if (error || !data) {
      throw new NotFoundError("App not found");
    }

    return Mappers.toApp(data);
  },
});

const InputPaginationListSchema = z.object({
  page: z.number().optional(),
  per_page: z.number().optional(),
});

const OutputPaginationListSchema = z.object({
  page: z.number().optional(),
  per_page: z.number().optional(),
});

const getStore = async (c: WithTool<AppContext>) => {
  const dbId = await getWorkspaceD1Database(c);

  return new D1Store({
    accountId: c.envVars.CF_ACCOUNT_ID,
    apiToken: c.envVars.CF_API_TOKEN,
    databaseId: dbId,
  });
};

export const listWorkflows = createTool({
  name: "HOSTING_APP_WORKFLOWS_LIST_RUNS",
  description: "List all workflows on the workspace",
  inputSchema: InputPaginationListSchema.extend({
    workflowName: z.string().optional(),
    fromDate: z.string().optional(),
    toDate: z.string().optional(),
  }),
  outputSchema: z.object({
    workflows: z.array(z.object({
      workflowName: z.string(),
      runId: z.string(),
      createdAt: z.number(),
      updatedAt: z.number(),
      resourceId: z.string().nullable().optional(),
      status: z.string(),
    })).describe("The workflow list names"),
    pagination: OutputPaginationListSchema,
  }),
  handler: async (
    { page = 1, per_page = 10, workflowName, fromDate, toDate },
    c,
  ) => {
    await assertWorkspaceResourceAccess(c.tool.name, c);
    const storageWorkers = await getStore(c);

    const { runs } = await storageWorkers.getWorkflowRuns({
      workflowName,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
      limit: per_page,
      offset: (page - 1) * per_page,
      resourceId: undefined,
    }).catch((err) => {
      console.error(err);
      return { runs: [] };
    });

    const transformed = runs.map(({ snapshot, ...run }) => ({
      ...run,
      createdAt: run.createdAt.getTime(),
      updatedAt: run.updatedAt.getTime(),
      status: typeof snapshot === "string" ? snapshot : snapshot.status,
    }));

    return {
      workflows: transformed,
      pagination: { page, per_page },
    };
  },
});

/**
 * TODO: Currently there is no way to filter by script name,
 * this leads to a security issue where a user can see all instances of a workflow
 * on all workspaces.
 *
 * If the user has the workflow id, it can see the workflow details
 */
export const getWorkflowStatus = createTool({
  name: "HOSTING_APP_WORKFLOWS_STATUS",
  description: "Get the status of a workflow instance",
  inputSchema: z.object({
    instanceId: z.string().describe(
      "The instance ID of the workflow. To get this, use the HOSTING_APP_WORKFLOWS_INSTANCES_LIST or HOSTING_APP_WORKFLOWS_START tool.",
    ),
    workflowName: z.string(),
  }),
  outputSchema: z.object({
    workflowName: z.string(),
    runId: z.string(),
    createdAt: z.date(),
    updatedAt: z.date(),
    resourceId: z.string().nullable().optional(),
    snapshot: z.union([
      z.string(),
      z.object({
        status: z.string(),
        result: z.any(),
        context: z.record(
          z.string(),
          z.object({
            payload: z.any(),
            startedAt: z.number().optional(),
            endedAt: z.number().optional(),
            error: z.union([z.string(), z.instanceof(Error)]).optional(),
            output: z.any().optional(),
          }),
        ),
        serializedStepGraph: z.array(z.any()),
      }),
    ]),
  }),
  handler: async ({ instanceId, workflowName }, c) => {
    await assertWorkspaceResourceAccess(c.tool.name, c);
    const store = await getStore(c);

    const workflow = await store.getWorkflowRunById({
      runId: instanceId,
      workflowName,
    });

    if (!workflow) {
      throw new NotFoundError("Workflow not found");
    }

    return workflow;
  },
});

import { z } from "zod";
import { NotFoundError, UserInputError } from "../../errors.ts";
import { Database } from "../../storage/index.ts";
import {
  assertHasWorkspace,
  assertWorkspaceResourceAccess,
} from "../assertions.ts";
import { AppContext, createTool, getEnv } from "../context.ts";
import { bundler } from "./bundler.ts";

const SCRIPT_FILE_NAME = "script.mjs";
const HOSTING_APPS_DOMAIN = ".deco.page";
const METADATA_FILE_NAME = "metadata.json";
export const Entrypoint = {
  build: (appSlug: string) => {
    return `https://${appSlug}${HOSTING_APPS_DOMAIN}`;
  },
  script: (domain: string) => {
    return domain.split(HOSTING_APPS_DOMAIN)[0];
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

function getWorkspaceParams(c: AppContext, appSlug?: string) {
  assertHasWorkspace(c);
  const slug = appSlug ?? c.workspace.slug;
  return { workspace: c.workspace.value, slug };
}

// 1. List apps for a given workspace
export const listApps = createTool({
  name: "HOSTING_APPS_LIST",
  description: "List all apps for the current tenant",
  inputSchema: z.object({}),
  handler: async (_, c) => {
    const { workspace } = getWorkspaceParams(c);

    await assertWorkspaceResourceAccess(c.tool.name, c);

    const { data, error } = await c.db
      .from(DECO_CHAT_HOSTING_APPS_TABLE)
      .select("*")
      .eq("workspace", workspace);

    if (error) throw error;

    return data.map(Mappers.toApp);
  },
});

// Common types and utilities
type DeployResult = {
  etag?: string;
  id?: string;
};

async function deployToCloudflare(
  c: AppContext,
  scriptSlug: string,
  mainModule: string,
  files: Record<string, File>,
): Promise<DeployResult> {
  const env = getEnv(c);
  const metadata = {
    main_module: mainModule,
    compatibility_flags: ["nodejs_compat"],
    compatibility_date: "2024-11-27",
  };

  const body = {
    metadata: new File([JSON.stringify(metadata)], METADATA_FILE_NAME, {
      type: "application/json",
    }),
    ...files,
  };

  const result = await c.cf.workersForPlatforms.dispatch.namespaces
    .scripts.update(
      env.CF_DISPATCH_NAMESPACE,
      scriptSlug,
      {
        account_id: env.CF_ACCOUNT_ID,
        metadata: {
          main_module: mainModule,
          compatibility_flags: ["nodejs_compat"],
        },
      },
      {
        method: "put",
        body,
      },
    );

  return {
    etag: result.etag,
    id: result.id,
  };
}

async function updateDatabase(
  c: AppContext,
  workspace: string,
  scriptSlug: string,
  result: DeployResult,
  files?: Record<string, string>,
) {
  // Try to update first
  const { data: updated, error: updateError } = await c.db
    .from(DECO_CHAT_HOSTING_APPS_TABLE)
    .update({
      updated_at: new Date().toISOString(),
      cloudflare_script_hash: result.etag,
      cloudflare_worker_id: result.id,
      files,
    })
    .eq("slug", scriptSlug)
    .select("*")
    .single();

  if (updateError && updateError.code !== "PGRST116") { // PGRST116: Results contain 0 rows
    throw updateError;
  }

  if (updated) {
    return Mappers.toApp(updated);
  }

  // If not updated, insert
  const { data: inserted, error: insertError } = await c.db
    .from(DECO_CHAT_HOSTING_APPS_TABLE)
    .insert({
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

  return Mappers.toApp(inserted);
}

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

const ENTRYPOINT = "main.ts";

// First, let's define a new type for the file structure
const FileSchema = z.object({
  path: z.string(),
  content: z.string(),
});

// Update the schema in deployFiles
export const deployFiles = createTool({
  name: "HOSTING_APP_DEPLOY",
  description:
    `Deploy multiple TypeScript files that use Deno as runtime for Cloudflare Workers. The entrypoint should always be ${ENTRYPOINT}.

Common patterns:
1. Use a deps.ts file to centralize dependencies:
   // deps.ts
   export { default as lodash } from "npm:lodash";
   export { z } from "npm:zod";
   export { createClient } from "npm:@supabase/supabase-js";

2. Import from deps.ts in your files:
   // main.ts
   import { lodash, z, createClient } from "./deps.ts";

Example of files deployment:
[
  {
    "path": "main.ts",
    "content": \`
      import { z } from "./deps.ts";

      export default {
        async fetch(request: Request): Promise<Response> {
          return new Response("Hello from Deno on Cloudflare!");
        }
      }
    \`
  },
  {
    "path": "deps.ts",
    "content": \`
      export { z } from "npm:zod";
    \`
  }
]

Important Notes: 
- Always use Cloudflare Workers syntax with export default and proper fetch handler signature
- When using template literals inside content strings, escape backticks with a backslash (\\) or use string concatenation (+)
- Do not use Deno.* namespace functions
- Use npm: or jsr: specifiers for dependencies
- No package.json or deno.json needed
- Dependencies are imported directly using npm: or jsr: specifiers`,
  inputSchema: z.object({
    appSlug: z.string().describe("The slug identifier for the app"),
    files: z.array(FileSchema).describe(
      "An array of files with their paths and contents. Must include main.ts as entrypoint",
    ),
  }),
  handler: async ({ appSlug, files }, c) => {
    await assertWorkspaceResourceAccess(c.tool.name, c);

    // Convert array to record for bundler
    const filesRecord = files.reduce((acc, file) => {
      acc[file.path] = file.content;
      return acc;
    }, {} as Record<string, string>);

    if (!(ENTRYPOINT in filesRecord)) {
      throw new UserInputError(`${ENTRYPOINT} is not in the files`);
    }

    await createNamespaceOnce(c);
    const { workspace, slug: scriptSlug } = getWorkspaceParams(c, appSlug);

    // Bundle the files
    const bundledScript = await bundler(filesRecord, ENTRYPOINT);

    const fileObjects = {
      [SCRIPT_FILE_NAME]: new File(
        [bundledScript],
        SCRIPT_FILE_NAME,
        {
          type: "application/javascript+module",
        },
      ),
    };

    const result = await deployToCloudflare(
      c,
      scriptSlug,
      SCRIPT_FILE_NAME,
      fileObjects,
    );
    return updateDatabase(c, workspace, scriptSlug, result, filesRecord);
  },
});

// Delete app (and worker)
export const deleteApp = createTool({
  name: "HOSTING_APP_DELETE",
  description: "Delete an app and its worker",
  inputSchema: AppInputSchema,
  handler: async ({ appSlug }, c) => {
    await assertWorkspaceResourceAccess(c.tool.name, c);

    const cf = c.cf;
    const { workspace, slug: scriptSlug } = getWorkspaceParams(c, appSlug);
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

    const { workspace, slug } = getWorkspaceParams(c, appSlug);
    // 1. Fetch from DB
    const { data, error } = await c.db
      .from(DECO_CHAT_HOSTING_APPS_TABLE)
      .select("*")
      .eq("workspace", workspace)
      .eq("slug", slug)
      .single();

    if (error || !data) {
      throw new NotFoundError("App not found");
    }

    return Mappers.toApp(data);
  },
});

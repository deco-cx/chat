// deno-lint-ignore-file no-explicit-any
/**
 * To run this migration:
 * deno run --env-file=apps/webdraw/.env -A packages/ai/src/storage/options/migrationScript.ts
 */

import { createServerClient } from "@supabase/ssr";
import { SUPABASE_URL } from "@webdraw/auth";
import { bindContext } from "@webdraw/fs";
import { mountFsOnce } from "@webdraw/fs/mount";
import { WELL_KNOWN_AGENTS } from "../constants.ts";
import { createFsStorage } from "./fsStorage.ts";
import { createSupabaseStorage } from "./supabaseStorage.ts";
import type { Workspace } from "@deco/sdk/path";

await mountFsOnce({
  AWS_ACCESS_KEY_ID: Deno.env.get("AWS_ACCESS_KEY_ID"),
  AWS_SECRET_ACCESS_KEY: Deno.env.get("AWS_SECRET_ACCESS_KEY"),
  AWS_REGION: Deno.env.get("AWS_REGION"),
  disableInMemoryCache: true,
}); // serve files and apps should not cache metadata

const fs = bindContext("/", { uid: 0, gid: 0 }).fs.promises;

const supabase = createServerClient(
  SUPABASE_URL,
  Deno.env.get("SUPABASE_SERVER_TOKEN") as string,
  {
    cookies: {
      getAll: () => {
        return [];
      },
    },
  },
);

const fsStorage = createFsStorage(fs);
const supaStorage = createSupabaseStorage(supabase);

const migrateFor = createWorkspaceMigrator(fsStorage, supaStorage);

const migrateAll = async () => {
  console.log("starting migration");

  const entries = await fs.readdir("/users", { recursive: false });

  await migrateTriggers(entries.map((e) => `/users/${e}`) as Workspace[]);

  await migrateWorkspaces(entries.map((e) => `/users/${e}`));
};

const migrateTriggers = async (workspaces: Workspace[]) => {
  for (const workspace of workspaces) {
    const agents = await fsStorage.agents.for(workspace).list().then((a) =>
      a.map((a) => a.id)
    ).catch(() => []);

    for (const agent of agents) {
      const triggers =
        await fsStorage.triggers?.for(workspace).list(agent).catch(() => []) ??
        [];

      for (const trigger of triggers) {
        try {
          await supaStorage.triggers?.for(workspace).create(trigger, agent);
        } catch (e) {
          console.error("error migrating trigger", trigger, e);
        }
      }
    }
  }
};

const migrateWorkspaces = async (workspaces: string[]) => {
  const toMigrate = [...workspaces];

  for (let it = 0; it < workspaces.length; it++) {
    const workspace = workspaces[it];
    console.log(`migrating ${it + 1} of ${workspaces.length}`, workspace);

    try {
      await migrateFor(workspace);

      toMigrate.splice(it, 1);
    } catch (error) {
      console.error("Not migrated", workspace, "reason:", error);
    } finally {
      await Deno.writeTextFile("to-migrate.json", JSON.stringify(toMigrate));
    }
  }
};

function createWorkspaceMigrator(fromStorage: any, toStorage: any) {
  return async (workspace: string) => {
    const agentsFrom = fromStorage.agents.for(workspace);
    const agentsTo = toStorage.agents.for(workspace);
    const integrationsFrom = fromStorage.integrations.for(workspace);
    const integrationsTo = toStorage.integrations.for(workspace);

    const [agentsPromise, integrationsPromise] = [
      agentsFrom.list(),
      integrationsFrom.list(),
    ];

    for (const item of await agentsPromise) {
      if (item.id in WELL_KNOWN_AGENTS) {
        continue;
      }

      try {
        await agentsTo.create(item);
      } catch {
        await agentsTo.update(item.id, item).catch(console.error);
      }
    }

    for (const item of await integrationsPromise) {
      if (item.connection.type === "INNATE") {
        continue;
      }

      try {
        await integrationsTo.create(item);
      } catch {
        await integrationsTo.update(item.id, item).catch(console.error);
      }
    }
  };
}

await migrateAll();

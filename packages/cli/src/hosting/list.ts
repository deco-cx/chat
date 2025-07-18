import z from "zod";
import { createWorkspaceClient } from "../mcp.ts";
import type { FileLike } from "./deploy.ts";

interface Options {
  workspace: string;
}

interface App {
  id: string;
  slug: string;
  entrypoint: string;
  workspace: string;
  files: FileLike[];
}
export const listApps = async ({ workspace }: Options) => {
  console.log(`🔍 Listing apps in workspace '${workspace}'...`);

  const client = await createWorkspaceClient({ workspace });
  const response = await client.callTool(
    {
      name: "HOSTING_APPS_LIST",
      arguments: {},
    },
    // deno-lint-ignore no-explicit-any
    z.any() as any,
  );

  if (response.isError && Array.isArray(response.content)) {
    throw new Error(response.content[0]?.text ?? "Unknown error");
  }

  const apps = response.structuredContent as App[];

  if (apps.length === 0) {
    console.log("📭 No apps found in this workspace.");
  } else {
    console.log("📱 Apps in workspace:");
    apps.forEach((app: App) => {
      console.log(
        `  • ${app.slug} (${app.entrypoint}, Files: ${app.files.length})`,
      );
    });
  }
};

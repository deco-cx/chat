import { createWorkspaceClient } from "../mcp.ts";
import type { FileLike } from "./deploy.ts";

interface Options {
  workspace: string;
  authCookie: string;
}

interface App {
  id: string;
  slug: string;
  entrypoint: string;
  workspace: string;
  files: FileLike[];
}
export const listApps = async ({ workspace, authCookie }: Options) => {
  console.log(`🔍 Listing apps in workspace '${workspace}'...`);

  const client = await createWorkspaceClient({ workspace, authCookie });

  const { resources } = await client.listResources({});

  const appResources = resources.filter((resource) =>
    resource.description === "Hosting App"
  );

  if (appResources.length === 0) {
    console.log("📭 No apps found in this workspace.");
  } else {
    console.log("📱 Apps in workspace:");
    appResources.forEach((app) => {
      console.log(
        `  • ${app.name} (${app.uri})`,
      );
    });
  }

  await client.close();
};

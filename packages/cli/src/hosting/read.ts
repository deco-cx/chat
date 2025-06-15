import { createWorkspaceClient } from "../mcp.ts";

export const readApp = async (
  workspace: string,
  authCookie: string,
  uri: string,
) => {
  const client = await createWorkspaceClient({
    workspace,
    authCookie,
  });

  const { contents } = await client.readResource({ uri });

  for (const content of contents) {
    console.log(content.uri.slice(uri.length));
    console.log(content.mimeType);
    console.log(content.text);
    console.log("--------------------------------");
  }
  await client.close();
};

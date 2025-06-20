import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { DECO_CHAT_API_LOCAL, DECO_CHAT_API_PROD } from "./constants.ts";
import { getSessionCookies } from "./session.ts";

interface Options {
  workspace?: string;
  local?: boolean;
}

export const createWorkspaceClient = async (
  { workspace, local }: Options,
) => {
  const cookie = await getSessionCookies();

  const client = new Client({ name: "deco-chat-cli", version: "1.0.0" });
  const api = local ? DECO_CHAT_API_LOCAL : DECO_CHAT_API_PROD;

  const url = new URL(
    !workspace || workspace.startsWith("/")
      ? `${workspace ?? ""}/mcp`
      : `/shared/${workspace}/mcp`,
    api,
  );

  await client.connect(
    new StreamableHTTPClientTransport(
      url,
      { requestInit: { headers: { "cookie": cookie } } },
    ),
  );

  return client;
};

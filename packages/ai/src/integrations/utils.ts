import type { AIAgent } from "../agent.ts";
import { createServerClient } from "../mcp.ts";
import type { Integration } from "../storage/index.ts";

const DECO_REGISTRY_SERVER_URL = "https://mcp.deco.site";

export const getDecoRegistryServerClient = () => {
  const url = new URL("/mcp/messages", DECO_REGISTRY_SERVER_URL);

  return createServerClient({
    name: url.hostname,
    connection: { type: "HTTP", url: url.href },
  });
};

export const searchInstalledIntegations = async (
  agent: AIAgent,
  query?: string,
) => {
  const integrations = await agent.storage?.integrations
    .for(agent.workspace)
    .list();

  const lower = query?.toLowerCase() ?? "";

  return (integrations ?? [])
    .filter((id): id is Integration => id !== null)
    .filter((integration) =>
      integration.name.toLowerCase().includes(lower) ||
      integration.description?.toLowerCase().includes(lower)
    );
};

export const searchMarketplaceIntegations = async (query?: string) => {
  const client = await getDecoRegistryServerClient();

  try {
    const result = await client.callTool({
      name: "SEARCH",
      arguments: { query },
    }) as { content: { text: string }[] };

    const list = JSON.parse(result.content[0].text) as {
      id: string;
      name: string;
      description: string;
      icon: string;
      provider: string;
    }[];

    return list;
  } finally {
    client.close();
  }
};

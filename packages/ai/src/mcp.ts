// deno-lint-ignore-file no-explicit-any
import {
  CallToolResultSchema,
  type DecoConnection,
  type HTTPConnection,
  type Integration,
  type MCPConnection,
} from "@deco/sdk";
import { createSessionTokenCookie } from "@deco/sdk/auth";
import { WebCache } from "@deco/sdk/cache";
import { SWRCache } from "@deco/sdk/cache/swr";
import { type AppContext, fromWorkspaceString, MCPClient } from "@deco/sdk/mcp";
import { slugify } from "@deco/sdk/memory";
import type { ToolAction } from "@mastra/core";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  SSEClientTransport,
  type SSEClientTransportOptions,
} from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { WebSocketClientTransport } from "@modelcontextprotocol/sdk/client/websocket.js";
import type { AIAgent, Env } from "./agent.ts";
import { getTools } from "./deco.ts";
import { getToolsForInnateIntegration } from "./storage/tools.ts";
import { createTool } from "./utils/create-tool.ts";
import { jsonSchemaToModel } from "./utils/json-schema-to-model.ts";
import { mapToolEntries } from "./utils/tool-entries.ts";

const ApiDecoChatURLs = [
  "https://api.deco.chat",
  "http://localhost:3001",
  "https://mcp-admin.wppagent.com",
];
export const isApiDecoChatMCPConnection = (
  connection: MCPConnection,
): connection is HTTPConnection =>
  "url" in connection &&
  connection.type === "HTTP" &&
  ApiDecoChatURLs.some((url) => connection.url.startsWith(url));

export const patchApiDecoChatTokenHTTPConnection = (
  connection: HTTPConnection,
  cookie?: string,
) => {
  return {
    ...connection,
    headers: {
      cookie,
    },
  };
};

const swr = new SWRCache<Awaited<ReturnType<Client["listTools"]>>>(
  `list-tools`,
  WebCache.MAX_SAFE_TTL,
);
export const swrListTools = (mcpServer: Integration, signal?: AbortSignal) => {
  return swr.cache(async () => {
    const client = await createServerClient(mcpServer, signal).catch(
      console.error,
    );
    if (!client) {
      return { tools: [] };
    }

    return client.listTools().finally(() => client.close());
  }, "url" in mcpServer.connection ? mcpServer.connection.url : mcpServer.id);
};

const getMCPServerTools = async (
  mcpServer: Integration,
  agent: AIAgent,
  signal?: AbortSignal,
): Promise<Record<string, ToolAction<any, any, any>>> => {
  try {
    const { tools } = await swrListTools(mcpServer, signal);
    const mtools: Record<string, ToolAction<any, any, any>> = Object
      .fromEntries(
        tools.map((tool: typeof tools[number]) => {
          const slug = slugify(tool.name);
          return [
            slug,
            createTool({
              id: slug,
              description: tool.description! ?? "",
              inputSchema: jsonSchemaToModel(tool.inputSchema),
              outputSchema: jsonSchemaToModel(
                tool.outputSchema ?? {
                  type: "object",
                  additionalProperties: true,
                },
              ),
              execute: async ({ context }) => {
                const innerClient = await createServerClient(mcpServer).catch(
                  console.error,
                );
                if (!innerClient) {
                  return { error: "Failed to create inner client" };
                }
                try {
                  const result = await innerClient.callTool({
                    name: tool.name,
                    arguments: context,
                    // @ts-expect-error should be fixed after this is merged: https://github.com/modelcontextprotocol/typescript-sdk/pull/528
                  }, CallToolResultSchema);

                  return result;
                } catch (error) {
                  agent._resetCallableToolSet(mcpServer.id);
                  throw error;
                } finally {
                  await innerClient.close();
                }
              },
            }),
          ];
        }),
      );

    return mtools;
  } catch (err) {
    console.error("[MCP] Error connecting to", mcpServer.name, err);
    return {};
  }
};

export const fetchMeta = async (baseUrl: string) => {
  const response = await fetch(new URL("/live/_meta", baseUrl));
  if (!response.ok) {
    return null;
  }
  const meta: { schema: any } = await response.json();
  return meta;
};

export const getDecoSiteTools = async (
  settings: DecoConnection,
): Promise<Record<string, ToolAction<any, any, any>>> => {
  const baseUrl = `https://${settings.tenant}.deco.site`;
  const meta = await fetchMeta(baseUrl);
  if (!meta) {
    return {};
  }

  const tools = getTools(meta.schema);

  const createdTools: Record<string, ReturnType<typeof createTool>> = {};
  for (const tool of tools) {
    try {
      const createdTool = createTool({
        id: tool.name,
        description: tool.description,
        inputSchema: jsonSchemaToModel(tool.inputSchema),
        outputSchema: jsonSchemaToModel(
          tool.outputSchema ?? {
            type: "object",
            additionalProperties: true,
          },
        ),
        execute: async ({ context }) => {
          const response = await fetch(
            new URL(`/live/invoke/${tool.resolveType}`, baseUrl),
            {
              method: "POST",
              body: typeof context === "string"
                ? context
                : JSON.stringify(context),
              headers: {
                "content-type": "application/json",
                ...(settings.token && {
                  authorization: settings.token,
                }),
              },
            },
          );
          return await response.json();
        },
      });

      createdTools[tool.name] = createdTool;
    } catch (err) {
      console.error(err);
      // ignore
    }
  }
  return createdTools;
};

export const mcpServerTools = async (
  mcpServer: Integration,
  agent: AIAgent,
  signal?: AbortSignal,
  env?: Env,
): Promise<Record<string, ToolAction<any, any, any>>> => {
  if (!mcpServer.connection) {
    return {};
  }

  // Propagate req token to api.deco.chat integration
  if (isApiDecoChatMCPConnection(mcpServer.connection)) {
    mcpServer.connection = patchApiDecoChatTokenHTTPConnection(
      mcpServer.connection,
      agent.metadata?.userCookie ?? createSessionTokenCookie(
        await agent._token(),
        new URL(mcpServer.connection.url).hostname,
      ),
    );
  }

  const response = mcpServer.connection.type === "Deco"
    ? await getDecoSiteTools(mcpServer.connection)
    : mcpServer.connection.type === "INNATE"
    ? getToolsForInnateIntegration(mcpServer, agent, env)
    : await getMCPServerTools(mcpServer, agent, signal);

  return response;
};

export const createServerClient = async (
  mcpServer: Pick<Integration, "connection" | "name">,
  signal?: AbortSignal,
): Promise<Client> => {
  const transport = createTransport(mcpServer.connection, signal);

  if (!transport) {
    throw new Error("Unknown MCP connection type");
  }

  const client = new Client({
    name: mcpServer.name,
    version: "1.0.0",
    timeout: 180000, // 3 minutes
  });

  await client.connect(transport);

  return client;
};

export const createTransport = (
  connection: MCPConnection,
  signal?: AbortSignal,
) => {
  if (connection.type === "Websocket") {
    return new WebSocketClientTransport(new URL(connection.url));
  }

  if (connection.type !== "SSE" && connection.type !== "HTTP") {
    return null;
  }

  const authHeaders: Record<string, string> = connection.token
    ? { authorization: `Bearer ${connection.token}` }
    : {};

  const headers: Record<string, string> = {
    ...authHeaders,
    ..."headers" in connection ? (connection.headers || {}) : {},
  };

  if (connection.type === "SSE") {
    const config: SSEClientTransportOptions = {
      requestInit: { headers, signal },
    };

    if (connection.token) {
      config.eventSourceInit = {
        fetch: (req, init) => {
          return fetch(req, {
            ...init,
            headers: {
              ...headers,
              Accept: "text/event-stream",
            },
            signal,
          });
        },
      };
    }

    return new SSEClientTransport(new URL(connection.url), config);
  }
  return new StreamableHTTPClientTransport(new URL(connection.url), {
    requestInit: { headers, signal },
  });
};

const handleMCPResponse = async (client: Client) => {
  const result = await client.listTools();
  const instructions = client.getInstructions();
  const capabilities = client.getServerCapabilities();
  const version = client.getServerVersion();

  if (result.tools.find((tool) => tool.name === "DECO_LIST_PRICES")) {
    const {content} = await client.callTool({
      name: "DECO_LIST_PRICES",
      arguments: {},
    });
    const pricedTools = JSON.parse(content[0].text);
    console.log({ pricedTools, prices: pricedTools.prices });
    const toolsWithCost = result.tools.map((tool) => ({
      ...tool,
      cost: pricedTools.prices.find((price) => price.name === tool.name)?.cost,
    }));
    return { tools: toolsWithCost, instructions, capabilities, version };
  }

  return { tools: result.tools, instructions, capabilities, version };
};
export const swrMCPMetadata = (
  mcpServer: Pick<Integration, "connection" | "name">,
) => {
  console.log({ mcpServer });
  const fetch = async () => {
    const client = await createServerClient(mcpServer);
    return handleMCPResponse(client).finally(() => client.close());
  };
  if ("url" in mcpServer.connection) {
    return swr.cache(fetch, mcpServer.connection.url);
  }
  return fetch();
};

export async function listToolsByConnectionType(
  connection: MCPConnection,
  ctx: AppContext,
) {
  switch (connection.type) {
    case "INNATE": {
      const mcpClient = MCPClient.forContext({
        ...ctx,
        workspace: ctx.workspace ??
          (connection.workspace
            ? fromWorkspaceString(connection.workspace)
            : undefined),
      });

      const maybeIntegration = await mcpClient.INTEGRATIONS_GET({
        id: connection.name,
      });

      if (!maybeIntegration) {
        return { error: `Integration ${connection.name} not found` };
      }

      const tools = await mcpServerTools({
        ...maybeIntegration,
        id: connection.name,
      }, {} as AIAgent);

      return { tools: mapToolEntries(tools) };
    }
    case "Deco": {
      const decoTools = await getDecoSiteTools(connection);
      return {
        tools: mapToolEntries(decoTools),
      };
    }
    case "Websocket":
    case "SSE":
    case "HTTP": {
      return await swrMCPMetadata({
        name: connection.type,
        connection,
      });
    }
    default: {
      return { error: "Invalid connection type" };
    }
  }
}

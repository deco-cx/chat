import {
  Client,
  ClientOptions,
} from "@modelcontextprotocol/sdk/client/index.js";
import {
  SSEClientTransport,
  SSEClientTransportOptions,
} from "@modelcontextprotocol/sdk/client/sse.js";
import { WebSocketClientTransport } from "@modelcontextprotocol/sdk/client/websocket.js";
import { RequestOptions } from "@modelcontextprotocol/sdk/shared/protocol.js";
import {
  Implementation,
  ListToolsRequest,
  ListToolsResultSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { MCPConnection } from "./connection.ts";
import { HTTPClientTransport } from "./http-client-transport.ts";

/**
 * WARNNING: This is a hack to prevent schema compilation errors.
 * More info at: https://github.com/modelcontextprotocol/typescript-sdk/issues/923
 * 
 * Make sure to keep this updated with the right version of the SDK.
 * https://github.com/modelcontextprotocol/typescript-sdk/blob/bf817939917277a4c59f2e19e7b44b8dd7ff140c/src/client/index.ts#L480
 */
class CustomClient extends Client {
  constructor(_clientInfo: Implementation, options?: ClientOptions) {
    super(_clientInfo, options);
  }

  override async listTools(
    params?: ListToolsRequest["params"],
    options?: RequestOptions,
  ) {
    const result = await this.request(
      { method: "tools/list", params },
      ListToolsResultSchema,
      options,
    );

    return result;
  }
}

export const createServerClient = async (
  mcpServer: { connection: MCPConnection; name?: string },
  signal?: AbortSignal,
  extraHeaders?: Record<string, string>,
): Promise<Client> => {
  const transport = createTransport(mcpServer.connection, signal, extraHeaders);

  if (!transport) {
    throw new Error("Unknown MCP connection type");
  }

  const client = new CustomClient({
    name: mcpServer?.name ?? "MCP Client",
    version: "1.0.0",
    timeout: 180000, // 3 minutes
  });

  await client.connect(transport);

  return client;
};

export const createTransport = (
  connection: MCPConnection,
  signal?: AbortSignal,
  extraHeaders?: Record<string, string>,
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
    ...(extraHeaders ?? {}),
    ...("headers" in connection ? connection.headers || {} : {}),
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
  return new HTTPClientTransport(new URL(connection.url), {
    requestInit: {
      headers,
      signal,
      // @ts-ignore - this is a valid option for fetch
      credentials: "include",
    },
  });
};

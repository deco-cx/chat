// deno-lint-ignore-file no-explicit-any
import type { ToolExecutionContext } from "@mastra/core";
import type { CreateStubAPIOptions } from "./mcp.ts";

const getWorkspace = (workspace?: string) => {
  if (workspace && workspace.length > 0 && !workspace.includes("/")) {
    return `/shared/${workspace}`;
  }
  return workspace ?? "";
};

const serializeData = (data: any) => {
  if (data?.structuredContent) {
    return JSON.stringify(data.structuredContent);
  }
  if (Array.isArray(data?.content)) {
    return data.content[0]?.text;
  }
  return;
};

interface ApiCallConfig {
  toolName: string;
  payload: unknown;
  includeWorkspaceInPath?: boolean;
  mapper?: (data: unknown) => unknown;
  init?: RequestInit;
}

// Aligns well with the timeout of the MCP server
const MAX_TIMEOUT = 300_000;

/**
 * Generic function to make API calls to the deco.chat API
 */
async function makeApiCall(
  config: ApiCallConfig,
  options?: CreateStubAPIOptions,
) {
  const traceDebugId = options?.debugId?.() ?? crypto.randomUUID();
  const workspace = getWorkspace(options?.workspace);

  const urlPath = config.includeWorkspaceInPath
    ? `${workspace}/tools/call/${config.toolName}`
    : `/tools/call/${config.toolName}`;

  const abortController = new AbortController();
  const timeout = setTimeout(
    () =>
      abortController.abort(
        `Max timeout of ${MAX_TIMEOUT}ms reached for ${config.toolName}`,
      ),
    MAX_TIMEOUT,
  );

  const response = await fetch(
    new URL(urlPath, options?.decoChatApiUrl ?? `https://api.deco.chat`),
    {
      signal: abortController.signal,
      body: JSON.stringify(config.payload),
      method: "POST",
      credentials: "include",
      ...config.init,
      headers: {
        ...(options?.token
          ? {
              Authorization: `Bearer ${options.token}`,
            }
          : {}),
        "content-type": "application/json",
        ...config.init?.headers,
        accept: "application/json",
        "x-trace-debug-id": traceDebugId,
      },
    },
  );

  const { data, error } = (await response.json()) as {
    data: Record<string, unknown>;
    error: string | undefined;
  };

  clearTimeout(timeout);

  if (!response.ok || error || data?.isError) {
    if (response.status === 403) {
      console.warn(
        "You don't have access to this tool, you might be missing a scope, you can import from import { Scopes } from 'deco.gen.ts', then you can export default withRuntime({ oauth: { scopes: ...Object.values(Scopes).flatMap((scope) => Object.values(scope)) } });",
      );
    }
    const message = error || serializeData(data) || "Internal Server Error";
    const err =
      options?.getErrorByStatusCode?.(response.status, message, traceDebugId) ??
      new Error(
        `http error ${response.status} ${config.toolName} ${message} ${traceDebugId}`,
      );

    throw err;
  }

  return config?.mapper?.(data) ?? data;
}

/**
 * The base fetcher used to fetch the MCP from API.
 */
export function createMCPClientProxy<T extends Record<string, unknown>>(
  options?: CreateStubAPIOptions,
): T {
  return new Proxy<T>({} as T, {
    get(_, name) {
      if (name === "toJSON") {
        return null;
      }
      if (typeof name !== "string") {
        throw new Error("Name must be a string");
      }
      async function callToolFn(args: unknown, init?: RequestInit) {
        let payload = args;
        let toolName = String(name);
        let mapper = (data: unknown) => data;

        if (options?.connection) {
          payload = {
            connection:
              typeof options.connection === "function"
                ? await options.connection()
                : options.connection,
            params: {
              name: name,
              arguments: args,
            },
          };
          toolName = "INTEGRATIONS_CALL_TOOL";
          mapper = (data) =>
            (
              data as {
                structuredContent: unknown;
              }
            ).structuredContent;
        }

        return makeApiCall(
          {
            toolName,
            payload,
            includeWorkspaceInPath: true,
            mapper,
            init,
          },
          options,
        );
      }

      const listToolsFn = async () => {
        const connection =
          typeof options?.connection === "function"
            ? await options.connection()
            : options?.connection ?? {
                type: "HTTP",
                url: `${options?.decoChatApiUrl ?? `https://api.deco.chat`}${getWorkspace(
                  options?.workspace,
                )}/mcp`,
              };

        const data = await makeApiCall(
          {
            toolName: "INTEGRATIONS_LIST_TOOLS",
            payload: { connection },
            includeWorkspaceInPath: false,
            mapper: (data) => {
              return (
                data as {
                  tools: {
                    name: string;
                    inputSchema: any;
                    outputSchema?: any;
                    description: string;
                  }[];
                }
              ).tools;
            },
          },
          options,
        );

        return data as {
          name: string;
          inputSchema: any;
          outputSchema?: any;
          description: string;
        }[];
      };

      let tools:
        | Promise<
            {
              name: string;
              inputSchema: any;
              outputSchema?: any;
              description: string;
            }[]
          >
        | undefined;
      const listToolsOnce = () => {
        return (tools ??= listToolsFn().catch((error) => {
          console.error("Failed to list tools", error);
          return [];
        }));
      };
      callToolFn.asTool = async () => {
        const tools = await listToolsOnce();
        const tool = tools.find((t) => t.name === name);
        if (!tool) {
          throw new Error(`Tool ${name} not found`);
        }
        return {
          id: tool.name,
          description: tool.description,
          inputSchema:
            options?.jsonSchemaToZod?.(tool.inputSchema) ?? tool.inputSchema,
          outputSchema: tool.outputSchema
            ? (options?.jsonSchemaToZod?.(tool.outputSchema) ??
              tool.outputSchema)
            : undefined,
          execute: ({ context }: ToolExecutionContext<any>) => {
            return callToolFn(context);
          },
        };
      };
      return callToolFn;
    },
  });
}

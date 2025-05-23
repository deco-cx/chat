import { API_SERVER_URL, getTraceDebugId } from "../constants.ts";
import { getErrorByStatusCode } from "../errors.ts";
import type { AppContext } from "./context.ts";
import type { ToolLike } from "./index.ts";

export type MCPClientStub<TDefinition extends readonly ToolLike[]> = {
  [K in TDefinition[number] as K["name"]]: (
    params: Parameters<K["handler"]>[0],
  ) => Promise<Awaited<ReturnType<K["handler"]>>["structuredContent"]>;
};

export type MCPClientFetchStub<TDefinition extends readonly ToolLike[]> = {
  [K in TDefinition[number] as K["name"]]: (
    params: Parameters<K["handler"]>[0],
    init?: RequestInit,
  ) => Promise<Awaited<ReturnType<K["handler"]>>["structuredContent"]>;
};

export interface CreateStubHandlerOptions<
  TDefinition extends readonly ToolLike[],
> {
  tools: TDefinition;
  context?: AppContext;
}

export interface CreateStubAPIOptions {
  workspace?: string;
}

export type CreateStubOptions<TDefinition extends ToolLike[]> =
  | CreateStubHandlerOptions<TDefinition>
  | CreateStubAPIOptions;

export function isStubHandlerOptions<TDefinition extends ToolLike[]>(
  options?: CreateStubOptions<TDefinition>,
): options is CreateStubHandlerOptions<TDefinition> {
  return typeof options === "object" && "tools" in options;
}

export function createMCPFetchStub<TDefinition extends readonly ToolLike[]>(
  options?: CreateStubAPIOptions,
): MCPClientFetchStub<TDefinition> {
  return new Proxy<MCPClientFetchStub<TDefinition>>(
    {} as MCPClientFetchStub<TDefinition>,
    {
      get(_, name) {
        if (typeof name !== "string") {
          throw new Error("Name must be a string");
        }

        return async (args: unknown, init?: RequestInit) => {
          const traceDebugId = getTraceDebugId();
          const workspace = options?.workspace ?? "";
          const response = await fetch(
            new URL(`${workspace}/tools/call/${name}`, API_SERVER_URL),
            {
              body: JSON.stringify(args),
              method: "POST",
              credentials: "include",
              ...init,
              headers: {
                ...init?.headers,
                "content-type": "application/json",
                "accept": "application/json",
                "x-trace-debug-id": traceDebugId,
              },
            },
          );

          const { data, error } = await response.json() as {
            data: Record<string, unknown>;
            error: string | undefined;
          };

          if (!response.ok) {
            throw getErrorByStatusCode(
              response.status,
              error || "Internal Server Error",
              traceDebugId,
            );
          }

          return data;
        };
      },
    },
  );
}

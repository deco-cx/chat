import { API_SERVER_URL, getTraceDebugId } from "../constants.ts";
import { getErrorByStatusCode } from "../errors.ts";
import type { AppContext } from "./context.ts";
import type { ToolBinder } from "./index.ts";

export type MCPClientStub<TDefinition extends readonly ToolBinder[]> = {
  [K in TDefinition[number] as K["name"]]: K extends
    ToolBinder<string, infer TInput, infer TReturn> ? (
      params: TInput,
      init?: RequestInit,
    ) => Promise<TReturn>
    : never;
};

export type MCPClientFetchStub<TDefinition extends readonly ToolBinder[]> = {
  [K in TDefinition[number] as K["name"]]: K extends
    ToolBinder<string, infer TInput, infer TReturn> ? (
      params: TInput,
      init?: RequestInit,
    ) => Promise<TReturn>
    : never;
};

export interface CreateStubHandlerOptions<
  TDefinition extends readonly ToolBinder[],
> {
  tools: TDefinition;
  context?: AppContext;
}

export interface CreateStubAPIOptions {
  workspace?: string;
}

export type CreateStubOptions<TDefinition extends ToolBinder[]> =
  | CreateStubHandlerOptions<TDefinition>
  | CreateStubAPIOptions;

export function isStubHandlerOptions<TDefinition extends ToolBinder[]>(
  options?: CreateStubOptions<TDefinition>,
): options is CreateStubHandlerOptions<TDefinition> {
  return typeof options === "object" && "tools" in options;
}

export function createMCPFetchStub<TDefinition extends readonly ToolBinder[]>(
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

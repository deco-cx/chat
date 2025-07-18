import { createMCPClientProxy } from "@deco/workers-runtime/proxy";
import { DECO_CHAT_API, getTraceDebugId } from "../constants.ts";
import { getErrorByStatusCode } from "../errors.ts";
import type { MCPConnection } from "../models/mcp.ts";
import type { AppContext } from "./context.ts";
import type { ToolBinder } from "./index.ts";

export type MCPClientStub<TDefinition extends readonly ToolBinder[]> = {
  [K in TDefinition[number] as K["name"]]: K extends ToolBinder<
    string,
    infer TInput,
    infer TReturn
  >
    ? (params: TInput, init?: RequestInit) => Promise<TReturn>
    : never;
};

export type MCPClientFetchStub<TDefinition extends readonly ToolBinder[]> = {
  [K in TDefinition[number] as K["name"]]: K extends ToolBinder<
    string,
    infer TInput,
    infer TReturn
  >
    ? (params: TInput, init?: RequestInit) => Promise<TReturn>
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
  connection?: MCPConnection;
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
  return createMCPClientProxy<MCPClientFetchStub<TDefinition>>({
    ...options,
    decoChatApiUrl: DECO_CHAT_API,
    debugId: getTraceDebugId,
    getErrorByStatusCode,
  });
}

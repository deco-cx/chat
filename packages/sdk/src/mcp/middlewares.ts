// deno-lint-ignore-file no-explicit-any
import {
  CallToolRequestSchema,
  CallToolResultSchema,
  ListToolsRequestSchema,
  ListToolsResult,
} from "@modelcontextprotocol/sdk/types.js";
import * as api from "@opentelemetry/api";
import z from "zod/v3";
import { SpanStatusCode, trace } from "../observability/index.ts";
import { assertWorkspaceResourceAccess } from "./assertions.ts";
import { type AppContext, serializeError, State } from "./context.ts";

export interface RequestMiddlewareContext<T = any> {
  next?(): Promise<T>;
}
export type RequestMiddleware<TRequest = any, TResponse = any> = (
  request: TRequest,
  next?: () => Promise<TResponse>,
) => Promise<TResponse>;

export const compose = <TRequest, TResponse>(
  ...middlewares: RequestMiddleware<TRequest, TResponse>[]
): RequestMiddleware<TRequest, TResponse> => {
  const last = middlewares[middlewares.length - 1];
  return function composedResolver(request: TRequest) {
    const dispatch = (i: number): Promise<TResponse> => {
      const middleware = middlewares[i];
      if (!middleware) {
        return last(request);
      }
      const next = () => dispatch(i + 1);
      return middleware(request, next);
    };

    return dispatch(0);
  };
};

export type ListToolsMiddleware = RequestMiddleware<
  z.infer<typeof ListToolsRequestSchema>,
  ListToolsResult
>;
export type CallToolMiddleware = RequestMiddleware<
  z.infer<typeof CallToolRequestSchema>,
  z.infer<typeof CallToolResultSchema>
>;

const safeGetContext = () => {
  try {
    return State.getStore();
  } catch {
    return undefined;
  }
};
export const wrapToolFn = <
  TInput = any,
  TReturn extends object | null | boolean = object,
>(
  f: (props: TInput) => Promise<TReturn>,
  toolName: string,
  workspace?: string,
) => {
  return async (props: TInput) => {
    const tracer = trace.getTracer("tools");
    return await tracer.startActiveSpan(
      "tools.call",
      {
        attributes: {
          "mcp.tool.name": toolName,
          workspace,
        },
      },
      api.context.active(),
      async (span) => {
        let err: unknown = null;
        try {
          return await f(props);
        } catch (error) {
          err = error;
          throw error;
        } finally {
          const ctx = safeGetContext();
          const workspace = ctx?.workspace?.value;
          workspace && span.setAttribute("workspace", workspace);
          err && span.recordException(err as Error);
          span.setStatus({
            code: err ? SpanStatusCode.ERROR : SpanStatusCode.OK,
          });
          span.updateName(`${toolName}`);
          span.end();
        }
      },
    );
  };
};
export const withMCPErrorHandling = <
  TInput = any,
  TReturn extends object | null | boolean = object,
>(
  f: (props: TInput) => Promise<TReturn>,
  toolName: string,
) =>
  wrapToolFn(async (props: TInput) => {
    try {
      const result = await f(props);

      return {
        isError: false,
        structuredContent: result,
      };
    } catch (error) {
      console.error(error);
      return {
        isError: true,
        content: [{ type: "text", text: serializeError(error) }],
      };
    }
  }, toolName);

interface AuthContext {
  integrationId: string;
}

export const withMCPAuthorization =
  (ctx: AppContext, { integrationId }: AuthContext): CallToolMiddleware =>
  async (req, next) => {
    try {
      await assertWorkspaceResourceAccess(
        ctx,
        { integrationId, resource: req.params.name },
        "INTEGRATIONS_GET", // fallback to INTEGRATIONS_GET to keep compatibility with old MCP Integrations
      );
    } catch (error) {
      console.error(
        `withMCPAuthorization error: user id ${ctx.user?.id} failed to access ${integrationId} resource ${req.params.name} at workspace ${ctx.workspace?.value}`,
      );
      return {
        isError: true,
        content: [{ type: "text", text: serializeError(error) }],
      };
    }

    return await next!();
  };

// deno-lint-ignore-file no-explicit-any
import {
  CallToolRequestSchema,
  CallToolResultSchema,
  ListToolsRequestSchema,
  ListToolsResult,
} from "@modelcontextprotocol/sdk/types.js";
import { assertWorkspaceResourceAccess } from "./assertions.ts";
import { type AppContext, serializeError } from "./context.ts";
import z from "zod";

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

export const withMCPErrorHandling =
  <TInput = any, TReturn extends object | null | boolean = object>(
    f: (props: TInput) => Promise<TReturn>,
  ) =>
  async (props: TInput) => {
    try {
      const result = await f(props);

      return {
        isError: false,
        structuredContent: result,
      };
    } catch (error) {
      return {
        isError: true,
        content: [{ type: "text", text: serializeError(error) }],
      };
    }
  };

const DRY_RUN_AUTH = true;

interface AuthContext {
  integrationId: string;
}

export const withMCPAuthorization =
  (ctx: AppContext, { integrationId }: AuthContext): CallToolMiddleware =>
  async (req, next) => {
    ctx.resourceAccess.reset();
    try {
      await assertWorkspaceResourceAccess(
        req.params.name,
        ctx,
        // TODO: add auth context on auth.canAccess
        // { integrationId }
      );
    } catch (error) {
      console.error(
        `withMCPAuthorization error: user id ${ctx.user?.id} failed to access ${integrationId} resource ${req.params.name} at workspace ${ctx.workspace?.value}`,
      );
      if (!DRY_RUN_AUTH) {
        return {
          isError: true,
          content: [{ type: "text", text: serializeError(error) }],
        };
      }
    }

    return await next!();
  };

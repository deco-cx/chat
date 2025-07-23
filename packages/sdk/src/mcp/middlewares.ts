// deno-lint-ignore-file no-explicit-any
import { assertWorkspaceResourceAccess } from "./assertions.ts";
import { type AppContext, serializeError } from "./context.ts";

export const withMCPErrorHandling = <
  TInput = any,
  TReturn extends object | null | boolean = object,
>(f: (props: TInput) => Promise<TReturn>) =>
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

interface MCPAuthorizationContext {
  integrationId: string;
  toolName: string;
}

export const withMCPAuthorization = <
  TInput = any,
  TReturn extends object | null | boolean = object,
>(
  f: (props: TInput) => Promise<TReturn>,
  { toolName }: MCPAuthorizationContext,
  ctx: AppContext,
) =>
async (props: TInput) => {
  ctx.resourceAccess.reset();
  try {
    await assertWorkspaceResourceAccess(
      toolName,
      ctx,
      // TODO: add auth context on auth.canAccess
      // { integrationId }
    );
  } catch (error) {
    return {
      isError: true,
      content: [{ type: "text", text: serializeError(error) }],
    };
  }

  return f(props);
};

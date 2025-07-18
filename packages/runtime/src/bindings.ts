import type { MCPConnection } from "./connection.ts";
import type { DefaultEnv, RequestContext } from "./index.ts";
import { MCPClient } from "./mcp.ts";
import type { MCPBinding } from "./wrangler.ts";

type WorkspaceClientContext = Omit<
  RequestContext,
  "ensureAuthenticated" | "state"
>;
export const workspaceClient = (
  ctx: WorkspaceClientContext,
): ReturnType<(typeof MCPClient)["forWorkspace"]> => {
  return MCPClient.forWorkspace(ctx.workspace, ctx.token);
};

const mcpClientForIntegrationId = (
  integrationId: string,
  ctx: WorkspaceClientContext,
) => {
  const client = workspaceClient(ctx);
  let integration: Promise<{ connection: MCPConnection }> | null = null;
  return MCPClient.forConnection(async () => {
    integration ??= client.INTEGRATIONS_GET({
      id: integrationId,
    }) as Promise<{ connection: MCPConnection }>;
    return (await integration).connection;
  });
};

export const createIntegrationBinding = (
  binding: MCPBinding,
  env: DefaultEnv,
) => {
  const integrationId =
    "integration_id" in binding ? binding.integration_id : undefined;
  if (!integrationId) {
    const ctx = env.DECO_CHAT_REQUEST_CONTEXT;
    const bindingFromState = ctx?.state?.[binding.name];
    const integrationId =
      bindingFromState &&
      typeof bindingFromState === "object" &&
      "value" in bindingFromState
        ? bindingFromState.value
        : undefined;
    if (typeof integrationId !== "string") {
      return null;
    }
    return mcpClientForIntegrationId(integrationId, ctx);
  }
  // bindings pointed to an specific integration id are binded using the app deployment workspace
  return mcpClientForIntegrationId(integrationId, {
    workspace: env.DECO_CHAT_WORKSPACE,
    token: env.DECO_CHAT_API_TOKEN,
  });
};

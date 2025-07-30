import type { MCPConnection } from "./connection.ts";
import { DECO_CHAT_API_URL } from "./constants.ts";
import type { DefaultEnv, RequestContext } from "./index.ts";
import { MCPClient } from "./mcp.ts";
import type { MCPBinding } from "./wrangler.ts";

interface IntegrationContext {
  integrationId: string;
  workspace: string;
}

/**
 * Url: /:workspace.root/:workspace.slug/:integrationId/mcp
 */
const createIntegrationsUrl = (
  { integrationId, workspace }: IntegrationContext,
  { decoChatApiUrl }: { decoChatApiUrl?: string } = {},
) =>
  new URL(
    `${workspace}/${integrationId}/mcp`,
    decoChatApiUrl ?? DECO_CHAT_API_URL,
  ).href;

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
  const mcpConnection: MCPConnection = {
    type: "HTTP",
    url: createIntegrationsUrl({ integrationId, workspace: ctx.workspace }),
  };

  // TODO(@igorbrasileiro): Switch this proxy to be a proxy that call MCP Client.toolCall from @modelcontextprotocol
  return MCPClient.forConnection(mcpConnection);
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

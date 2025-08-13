import type { MCPConnection } from "./connection.ts";
import type { DefaultEnv, RequestContext } from "./index.ts";
import { MCPClient } from "./mcp.ts";
import type { ContractBinding, MCPBinding } from "./wrangler.ts";

interface IntegrationContext {
  integrationId: string;
  workspace: string;
  decoChatApiUrl?: string;
}

const normalizeWorkspace = (workspace: string) => {
  if (workspace.startsWith("/users")) {
    return workspace;
  }
  if (workspace.startsWith("/shared")) {
    return workspace;
  }
  return `/shared/${workspace}`;
};
/**
 * Url: /:workspace.root/:workspace.slug/:integrationId/mcp
 */
const createIntegrationsUrl = ({
  integrationId,
  workspace,
  decoChatApiUrl,
}: IntegrationContext) =>
  new URL(
    `${normalizeWorkspace(workspace)}/${integrationId}/mcp`,
    decoChatApiUrl ?? "https://api.deco.chat",
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
  decoChatApiUrl?: string,
) => {
  const mcpConnection: MCPConnection = {
    type: "HTTP",
    url: createIntegrationsUrl({
      integrationId,
      workspace: ctx.workspace,
      decoChatApiUrl,
    }),
    token: ctx.token,
  };

  // TODO(@igorbrasileiro): Switch this proxy to be a proxy that call MCP Client.toolCall from @modelcontextprotocol
  return MCPClient.forConnection(mcpConnection);
};

export const createContractBinding = (
  binding: ContractBinding,
  env: DefaultEnv,
) => { }

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
    return mcpClientForIntegrationId(integrationId, ctx, env.DECO_CHAT_API_URL);
  }
  // bindings pointed to an specific integration id are binded using the app deployment workspace
  return mcpClientForIntegrationId(
    integrationId,
    {
      workspace: env.DECO_CHAT_WORKSPACE,
      token: env.DECO_CHAT_API_TOKEN,
    },
    env.DECO_CHAT_API_URL,
  );
};

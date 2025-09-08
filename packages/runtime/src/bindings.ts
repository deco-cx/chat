import type { MCPConnection } from "./connection.ts";
import type { DefaultEnv, RequestContext } from "./index.ts";
import { MCPClient } from "./mcp.ts";
import type {
  BindingBase,
  ContractBinding,
  MCPBinding,
  MCPIntegrationNameBinding,
} from "./wrangler.ts";

interface IntegrationContext {
  integrationId: string;
  workspace: string;
  decoCmsApiUrl?: string;
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
 * Url: /apps/mcp?appName=$appName
 */
const createAppsUrl = ({
  appName,
  decoChatApiUrl,
}: {
  appName: string;
  decoChatApiUrl?: string;
}) =>
  new URL(
    `/apps/mcp?appName=${appName}`,
    decoChatApiUrl ?? "https://api.decocms.com",
  ).href;
/**
 * Url: /:workspace.root/:workspace.slug/:integrationId/mcp
 */
const createIntegrationsUrl = ({
  integrationId,
  workspace,
  decoCmsApiUrl,
}: IntegrationContext) =>
  new URL(
    `${normalizeWorkspace(workspace)}/${integrationId}/mcp`,
    decoCmsApiUrl ?? "https://api.decocms.com",
  ).href;

type WorkspaceClientContext = Omit<
  RequestContext,
  "ensureAuthenticated" | "state" | "fetchIntegrationMetadata"
>;
export const workspaceClient = (
  ctx: WorkspaceClientContext,
): ReturnType<(typeof MCPClient)["forWorkspace"]> => {
  return MCPClient.forWorkspace(ctx.workspace, ctx.token);
};

const mcpClientForAppName = (appName: string, decoChatApiUrl?: string) => {
  const mcpConnection: MCPConnection = {
    type: "HTTP",
    url: createAppsUrl({
      appName,
      decoChatApiUrl,
    }),
  };

  return MCPClient.forConnection(mcpConnection);
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
      decoCmsApiUrl: decoChatApiUrl,
    }),
    token: ctx.token,
  };

  // TODO(@igorbrasileiro): Switch this proxy to be a proxy that call MCP Client.toolCall from @modelcontextprotocol
  return MCPClient.forConnection(mcpConnection);
};

function mcpClientFromState(
  binding: BindingBase | MCPIntegrationNameBinding,
  env: DefaultEnv,
) {
  const ctx = env.DECO_REQUEST_CONTEXT;
  const bindingFromState = ctx?.state?.[binding.name];
  const integrationId =
    bindingFromState &&
    typeof bindingFromState === "object" &&
    "value" in bindingFromState
      ? bindingFromState.value
      : undefined;
  if (typeof integrationId !== "string" && "integration_name" in binding) {
    // in case of a binding to an app name, we need to use the new apps/mcp endpoint which will proxy the request to the app but without any token
    return mcpClientForAppName(binding.integration_name, env.DECO_API_URL);
  }
  return mcpClientForIntegrationId(integrationId, ctx, env.DECO_API_URL);
}

export const createContractBinding = (
  binding: ContractBinding,
  env: DefaultEnv,
) => {
  return mcpClientFromState(binding, env);
};

export const createIntegrationBinding = (
  binding: MCPBinding,
  env: DefaultEnv,
) => {
  const integrationId =
    "integration_id" in binding ? binding.integration_id : undefined;
  if (!integrationId) {
    return mcpClientFromState(binding, env);
  }
  // bindings pointed to an specific integration id are binded using the app deployment workspace
  return mcpClientForIntegrationId(
    integrationId,
    {
      workspace: env.DECO_WORKSPACE,
      token: env.DECO_API_TOKEN,
      branch: env.DECO_REQUEST_CONTEXT?.branch,
    },
    env.DECO_API_URL,
  );
};

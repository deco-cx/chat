import { Locator } from "../locator.ts";
import * as agentAPI from "./agent/api.ts";
import * as agentsAPI from "./agents/api.ts";
import * as aiAPI from "./ai/api.ts";
import * as apiKeysAPI from "./api-keys/api.ts";
import * as channelsAPI from "./channels/api.ts";
import { type AppContext, State, type Tool } from "./context.ts";
import {
  contractAuthorize,
  contractGet,
  contractRegister,
  contractSettle,
  oauthStart,
} from "./contracts/api.ts";
import * as databasesAPI from "./databases/api.ts";
import * as deconfigAPI from "./deconfig/api.ts";
import * as fsAPI from "./fs/api.ts";
import * as hostingAPI from "./hosting/api.ts";
import * as integrationsAPI from "./integrations/api.ts";
import * as knowledgeAPI from "./knowledge/api.ts";
import * as membersAPI from "./members/api.ts";
import * as modelsAPI from "./models/api.ts";
import * as oauthAPI from "./oauth/api.ts";
import * as profilesAPI from "./profiles/api.ts";
import * as promptsAPI from "./prompts/api.ts";
import * as registryAPI from "./registry/api.ts";
import type { CreateStubHandlerOptions, MCPClientStub } from "./stub.ts";
import * as teamsAPI from "./teams/api.ts";
import * as themeAPI from "./theme/api.ts";
import * as threadsAPI from "./threads/api.ts";
import { runTool } from "./tools/api.ts";
import * as triggersAPI from "./triggers/api.ts";
import * as utilsAPI from "./utils/api.ts";
import * as walletAPI from "./wallet/api.ts";
export {
  createToolBindingImpl as createToolTools,
  createToolViewsV2,
} from "./tools/api.ts";

export { AuthorizationClient, PolicyClient } from "../auth/policy.ts";
export * from "../errors.ts";
export { FileProcessor } from "../mcp/file-processor.ts";
export * from "./assertions.ts";
export { createResourceAccess } from "./auth/index.ts";
export * from "./bindings/index.ts";
export * from "./context.ts";
export { createTool, createToolGroup } from "./context.ts";
export type { ContractState } from "./contracts/api.ts";
export type { DatatabasesRunSqlInput } from "./databases/api.ts";
export { Blobs, Branch } from "./deconfig/api.ts";
export { watchSSE } from "./deconfig/watch-sse.ts";
export { EMAIL_TOOLS } from "./email/api.ts";
export {
  getPresignedReadUrl_WITHOUT_CHECKING_AUTHORIZATION,
  getWorkspaceBucketName,
} from "./fs/api.ts";
export { HOSTING_APPS_DOMAIN } from "./hosting/api.ts";
export {
  getIntegration,
  type IntegrationWithTools,
} from "./integrations/api.ts";
export * from "./middlewares.ts";
export * from "./models/llm-vault.ts";
export { getRegistryApp } from "./registry/api.ts";
export * from "./wallet/stripe/webhook.ts";

export const DECONFIG_TOOLS = [
  ...deconfigAPI.DECONFIG_TOOLS,
  deconfigAPI.oauthStart,
];
export const CONTRACTS_TOOLS = [
  contractGet,
  contractAuthorize,
  contractSettle,
  oauthStart,
] as const;

// Register tools for each API handler
export const GLOBAL_TOOLS = [
  teamsAPI.getTeam,
  teamsAPI.createTeam,
  teamsAPI.updateTeam,
  teamsAPI.deleteTeam,
  teamsAPI.listTeams,
  teamsAPI.listRecentProjects,
  teamsAPI.createTeamRole,
  teamsAPI.updateTeamRole,
  teamsAPI.deleteTeamRole,
  teamsAPI.getTeamRole,
  teamsAPI.getWorkspaceTheme,
  teamsAPI.listProjects,
  teamsAPI.createProject,
  teamsAPI.updateProject,
  teamsAPI.deleteProject,
  membersAPI.getTeamMembers,
  membersAPI.updateTeamMember,
  membersAPI.removeTeamMember,
  membersAPI.registerMemberActivity,
  membersAPI.registerProjectActivity,
  membersAPI.getMyInvites,
  membersAPI.acceptInvite,
  membersAPI.deleteInvite,
  membersAPI.inviteTeamMembers,
  membersAPI.teamRolesList,
  membersAPI.updateMemberRole,
  membersAPI.createIssue,
  profilesAPI.getProfile,
  profilesAPI.updateProfile,
  integrationsAPI.callTool,
  integrationsAPI.listTools,
  registryAPI.getRegistryApp,
  utilsAPI.httpFetch,
] as const;

// Tools tied to an specific workspace
export const PROJECT_TOOLS = [
  teamsAPI.addView,
  teamsAPI.removeView,
  membersAPI.inviteTeamMembers,
  agentsAPI.getAgent,
  agentsAPI.deleteAgent,
  agentsAPI.createAgent,
  agentsAPI.updateAgent,
  agentsAPI.listAgents,
  integrationsAPI.getIntegration,
  integrationsAPI.createIntegration,
  integrationsAPI.updateIntegration,
  integrationsAPI.deleteIntegration,
  integrationsAPI.listIntegrations,
  integrationsAPI.getIntegrationApiKey,
  integrationsAPI.callTool,
  integrationsAPI.DECO_INTEGRATION_OAUTH_START,
  integrationsAPI.DECO_GET_APP_SCHEMA,
  integrationsAPI.DECO_INTEGRATION_INSTALL,
  integrationsAPI.DECO_INTEGRATIONS_SEARCH,
  threadsAPI.listThreads,
  threadsAPI.getThread,
  threadsAPI.getThreadMessages,
  threadsAPI.updateThreadTitle,
  threadsAPI.updateThreadMetadata,
  hostingAPI.listApps,
  hostingAPI.hostingAppDeploy,
  hostingAPI.deleteApp,
  hostingAPI.getAppInfo,
  hostingAPI.listAppDeployments,
  hostingAPI.promoteApp,
  hostingAPI.listWorkflowNames,
  hostingAPI.listWorkflowRuns,
  hostingAPI.getWorkflowStatus,
  registryAPI.listRegistryApps,
  registryAPI.listPublishedApps,
  registryAPI.listRegistryScopes,
  registryAPI.publishApp,
  triggersAPI.getTrigger,
  triggersAPI.listTriggers,
  triggersAPI.createTrigger,
  triggersAPI.createCronTrigger,
  triggersAPI.createWebhookTrigger,
  triggersAPI.deleteTrigger,
  triggersAPI.getWebhookTriggerUrl,
  walletAPI.getWalletAccount,
  walletAPI.getThreadsUsage,
  walletAPI.getAgentsUsage,
  walletAPI.getBillingHistory,
  walletAPI.createCheckoutSession,
  walletAPI.redeemWalletVoucher,
  walletAPI.createWalletVoucher,
  walletAPI.getWorkspacePlan,
  walletAPI.preAuthorizeAmount,
  walletAPI.commitPreAuthorizedAmount,
  walletAPI.getContractsCommits,
  triggersAPI.activateTrigger,
  triggersAPI.deactivateTrigger,
  triggersAPI.updateTrigger,
  knowledgeAPI.createBase,
  knowledgeAPI.deleteBase,
  knowledgeAPI.listKnowledgeBases,
  knowledgeAPI.forget,
  knowledgeAPI.remember,
  knowledgeAPI.search,
  knowledgeAPI.addFile,
  knowledgeAPI.listFiles,
  knowledgeAPI.deleteFile,
  fsAPI.listFiles,
  fsAPI.readFile,
  fsAPI.readFileMetadata,
  fsAPI.writeFile,
  fsAPI.deleteFile,
  // Theme tools (workspace-level)
  themeAPI.getOrgTheme,
  themeAPI.updateOrgTheme,
  modelsAPI.createModel,
  modelsAPI.deleteModel,
  modelsAPI.listModels,
  modelsAPI.updateModel,
  modelsAPI.getModel,
  channelsAPI.channelJoin,
  channelsAPI.channelLeave,
  channelsAPI.getChannel,
  channelsAPI.deleteChannel,
  channelsAPI.listChannels,
  channelsAPI.createChannel,
  promptsAPI.createPrompt,
  promptsAPI.updatePrompt,
  promptsAPI.deletePrompt,
  promptsAPI.listPrompts,
  promptsAPI.getPrompt,
  promptsAPI.getPromptVersions,
  promptsAPI.renamePromptVersion,
  apiKeysAPI.checkAccess,
  apiKeysAPI.listApiKeys,
  apiKeysAPI.createApiKey,
  apiKeysAPI.getApiKey,
  apiKeysAPI.reissueApiKey,
  apiKeysAPI.updateApiKey,
  apiKeysAPI.deleteApiKey,
  apiKeysAPI.enableApiKey,
  apiKeysAPI.disableApiKey,
  apiKeysAPI.validateApiKey,
  databasesAPI.runSql,
  databasesAPI.getMeta,
  databasesAPI.recovery,
  databasesAPI.viewBinding,
  aiAPI.aiGenerate,
  aiAPI.aiGenerateObject,
  oauthAPI.oauthCodeCreate,
  contractRegister,
  // DECONFIG tools
  ...deconfigAPI.DECONFIG_TOOLS,
  // Tools
  runTool,
] as const;

export const AGENT_TOOLS = [
  agentAPI.agentGenerateText,
  agentAPI.agentGenerateObject,
  agentAPI.agentListen,
] as const;

export const AI_TOOLS = [aiAPI.aiGenerate] as const;

export type GlobalTools = typeof GLOBAL_TOOLS;
export type ProjectTools = typeof PROJECT_TOOLS;
export type ToolLike<
  TName extends string = string,
  // oxlint-disable-next-line no-explicit-any
  TInput = any,
  TReturn extends object | null | boolean = object,
> = Tool<TName, TInput, TReturn>;

export type ToolBinder<
  TName extends string | RegExp = string,
  // oxlint-disable-next-line no-explicit-any
  TInput = any,
  TReturn extends object | null | boolean = object,
> = Pick<ToolLike<string, TInput, TReturn>, "inputSchema" | "outputSchema"> & {
  opt?: true;
  name: TName;
};

const global = createMCPToolsStub({
  tools: GLOBAL_TOOLS,
});

export const createGlobalForContext = (context?: AppContext): typeof global => {
  return createMCPToolsStub({
    tools: GLOBAL_TOOLS,
    context,
  });
};

export const withProject = (
  context: AppContext,
  projectValue: string,
  branch: string,
  userId?: string,
): AppContext => {
  const { org, project } = Locator.parse(
    projectValue.slice(1) as `${string}/${string}`,
  );
  return {
    ...context,
    locator: { org, project, value: Locator.from({ org, project }), branch },
    workspace: fromWorkspaceString(projectValue, branch, userId),
  };
};

export const fromWorkspaceString = (
  _workspace: string,
  branch: string,
  userId?: string,
): AppContext["workspace"] => {
  const normalized = _workspace.startsWith("/") ? _workspace : `/${_workspace}`;

  if (normalized.startsWith("/users") || normalized.startsWith("/shared")) {
    return {
      value: normalized,
      root: normalized.startsWith("/users") ? "users" : "shared",
      slug: normalized.split("/")[2],
      branch,
    };
  }

  const [_, org, project] = normalized.split("/");

  const root = project === "personal" && userId ? "users" : "shared";
  const slug = root === "users" && userId ? userId : org;

  return {
    value: `/${root}/${slug}`,
    root,
    slug,
    branch,
  };
};

export type DeconfigClient = MCPClientStub<typeof DECONFIG_TOOLS>;
export const createDeconfigClientForContext = (context: AppContext) => {
  return createMCPToolsStub({ tools: DECONFIG_TOOLS, context });
};

export const MCPClient = new Proxy(
  {} as typeof global & {
    forContext: (
      ctx: Omit<AppContext, "user"> & { user?: AppContext["user"] },
    ) => MCPClientStub<ProjectTools>;
  },
  {
    get(_, name) {
      if (name === "forContext") {
        return (ctx: AppContext) =>
          createMCPToolsStub({ tools: PROJECT_TOOLS, context: ctx });
      }
      return global[name as keyof typeof global];
    },
  },
);

export { Entrypoint } from "./hosting/api.ts";

export function createMCPToolsStub<TDefinition extends readonly ToolLike[]>({
  tools,
  context,
}: CreateStubHandlerOptions<TDefinition>): MCPClientStub<TDefinition> {
  return new Proxy<MCPClientStub<TDefinition>>(
    {} as MCPClientStub<TDefinition>,
    {
      get(_, name) {
        if (typeof name !== "string") {
          throw new Error("Name must be a string");
        }
        const toolMap = new Map<string, TDefinition[number]>(
          tools.map((h) => [h.name, h]),
        );
        return (props: unknown) => {
          const tool = toolMap.get(name);
          if (!tool) {
            throw new Error(`Tool ${name} not found`);
          }
          return State.run(
            context ?? State.getStore(),
            (args) => tool.handler(args),
            props,
          );
        };
      },
    },
  );
}

export {
  createWorkflowBindingImpl,
  createWorkflowResourceV2Implementation,
  createWorkflowRunsResourceV2Implementation,
  workflowViews,
  createWorkflowViewsV2,
  WorkflowResource,
  WorkflowResourceV2,
  type WorkflowBindingImplOptions,
  type WorkflowDataV2,
} from "./workflows/api.ts";

export {
  createToolBindingImpl,
  createToolResourceV2Implementation,
  runTool,
  ToolResourceV2,
  type ToolBindingImplOptions,
  type ToolDataV2,
} from "./tools/api.ts";

export {
  createDocumentResourceV2Implementation,
  createDocumentViewsV2,
  documentViews,
  DocumentResourceV2,
  type DocumentDataV2,
} from "./documents/api.ts";

export {
  createViewResourceV2Implementation,
  createViewViewsV2,
  viewViews,
  ViewResourceV2,
  type ViewDataV2,
} from "./views/api.ts";

// Export Resources 2.0 bindings function
export { createResourceV2Bindings } from "./resources-v2/bindings.ts";
export type {
  ReadOutput,
  ResourceItem,
  SearchOutput,
} from "./resources-v2/schemas.ts";

export * from "../errors.ts";
export * from "./assertions.ts";
export { createResourceAccess } from "./auth/index.ts";
export * from "./bindings/binder.ts";
export * from "./context.ts";
export {
  getPresignedReadUrl_WITHOUT_CHECKING_AUTHORIZATION,
  getWorkspaceBucketName,
} from "./fs/api.ts";
export { HOSTING_APPS_DOMAIN } from "./hosting/api.ts";
export * from "./models/llm-vault.ts";
export * from "./wallet/stripe/webhook.ts";

export { EMAIL_TOOLS } from "./email/api.ts";
import * as agentsAPI from "./agents/api.ts";
import * as agentAPI from "./agent/api.ts";
import * as aiAPI from "./ai/api.ts";
import * as apiKeysAPI from "./api-keys/api.ts";
import * as channelsAPI from "./channels/api.ts";
import { type AppContext, State, type Tool } from "./context.ts";
import * as fsAPI from "./fs/api.ts";
import * as hostingAPI from "./hosting/api.ts";
import * as integrationsAPI from "./integrations/api.ts";
import * as knowledgeAPI from "./knowledge/api.ts";
import * as membersAPI from "./members/api.ts";
import * as modelsAPI from "./models/api.ts";
import * as profilesAPI from "./profiles/api.ts";
import * as promptsAPI from "./prompts/api.ts";
import type { CreateStubHandlerOptions, MCPClientStub } from "./stub.ts";
import * as teamsAPI from "./teams/api.ts";
import * as threadsAPI from "./threads/api.ts";
import * as triggersAPI from "./triggers/api.ts";
import * as walletAPI from "./wallet/api.ts";
import * as whatsappAPI from "./whatsapp/api.ts";
import * as databasesAPI from "./databases/api.ts";

// Register tools for each API handler
export const GLOBAL_TOOLS = [
  teamsAPI.getTeam,
  teamsAPI.createTeam,
  teamsAPI.updateTeam,
  teamsAPI.deleteTeam,
  teamsAPI.listTeams,
  teamsAPI.getWorkspaceTheme,
  membersAPI.getTeamMembers,
  membersAPI.updateTeamMember,
  membersAPI.removeTeamMember,
  membersAPI.registerMemberActivity,
  membersAPI.getMyInvites,
  membersAPI.acceptInvite,
  membersAPI.deleteInvite,
  membersAPI.inviteTeamMembers,
  membersAPI.teamRolesList,
  membersAPI.updateMemberRole,
  profilesAPI.getProfile,
  profilesAPI.updateProfile,
  integrationsAPI.callTool,
  integrationsAPI.listTools,
] as const;

// Tools tied to an specific workspace
export const WORKSPACE_TOOLS = [
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
  integrationsAPI.callTool,
  integrationsAPI.COMPOSIO_INTEGRATION_OAUTH_START,
  integrationsAPI.DECO_INTEGRATION_OAUTH_START,
  integrationsAPI.DECO_INTEGRATION_INSTALL,
  integrationsAPI.DECO_INTEGRATIONS_SEARCH,
  threadsAPI.listThreads,
  threadsAPI.getThread,
  threadsAPI.getThreadMessages,
  threadsAPI.getThreadTools,
  threadsAPI.updateThreadTitle,
  threadsAPI.updateThreadMetadata,
  hostingAPI.listApps,
  hostingAPI.deployFiles,
  hostingAPI.deleteApp,
  hostingAPI.getAppInfo,
  hostingAPI.listWorkflows,
  hostingAPI.getWorkflowStatus,
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
  walletAPI.createCheckoutSession,
  walletAPI.redeemWalletVoucher,
  walletAPI.createWalletVoucher,
  walletAPI.getWorkspacePlan,
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
  modelsAPI.createModel,
  modelsAPI.deleteModel,
  modelsAPI.listModels,
  modelsAPI.updateModel,
  modelsAPI.getModel,
  whatsappAPI.sendWhatsAppTemplateMessage,
  whatsappAPI.createWhatsAppInvite,
  whatsappAPI.upsertWhatsAppUser,
  whatsappAPI.getWhatsAppUser,
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
  promptsAPI.searchPrompts,
  promptsAPI.getPromptVersions,
  promptsAPI.renamePromptVersion,
  apiKeysAPI.listApiKeys,
  apiKeysAPI.createApiKey,
  apiKeysAPI.getApiKey,
  apiKeysAPI.updateApiKey,
  apiKeysAPI.deleteApiKey,
  apiKeysAPI.enableApiKey,
  apiKeysAPI.disableApiKey,
  apiKeysAPI.validateApiKey,
  databasesAPI.runSql,
  aiAPI.aiGenerate,
] as const;

export const AGENT_TOOLS = [
  agentAPI.agentGenerateText,
  agentAPI.agentGenerateObject,
  agentAPI.agentListen,
] as const;

export const AI_TOOLS = [
  aiAPI.aiGenerate,
] as const;

export type GlobalTools = typeof GLOBAL_TOOLS;
export type WorkspaceTools = typeof WORKSPACE_TOOLS;
export type ToolLike<
  TName extends string = string,
  // deno-lint-ignore no-explicit-any
  TInput = any,
  TReturn extends object | null | boolean = object,
> = Tool<TName, TInput, TReturn>;

export type ToolBinder<
  TName extends string = string,
  // deno-lint-ignore no-explicit-any
  TInput = any,
  TReturn extends object | null | boolean = object,
> =
  & Pick<
    ToolLike<TName, TInput, TReturn>,
    "name" | "inputSchema" | "outputSchema"
  >
  & { opt?: true };

const global = createMCPToolsStub({
  tools: GLOBAL_TOOLS,
});

export const createGlobalForContext = (
  context?: AppContext,
): typeof global => {
  return createMCPToolsStub({
    tools: GLOBAL_TOOLS,
    context,
  });
};
export const fromWorkspaceString = (
  _workspace: string,
): AppContext["workspace"] => {
  const workspace: string = _workspace.startsWith("/")
    ? _workspace
    : `/${_workspace}`;
  const [_, root, slug] = workspace.split("/");
  return {
    value: workspace,
    root,
    slug,
  };
};

export const MCPClient = new Proxy(
  {} as typeof global & {
    forContext: (
      ctx: Omit<AppContext, "user"> & { user?: AppContext["user"] },
    ) => MCPClientStub<WorkspaceTools>;
  },
  {
    get(_, name) {
      if (name === "forContext") {
        return (ctx: AppContext) =>
          createMCPToolsStub({ tools: WORKSPACE_TOOLS, context: ctx });
      }
      return global[name as keyof typeof global];
    },
  },
);

export { Entrypoint } from "./hosting/api.ts";

export function createMCPToolsStub<TDefinition extends readonly ToolLike[]>(
  options: CreateStubHandlerOptions<TDefinition>,
): MCPClientStub<TDefinition> {
  return new Proxy<MCPClientStub<TDefinition>>(
    {} as MCPClientStub<TDefinition>,
    {
      get(_, name) {
        if (typeof name !== "string") {
          throw new Error("Name must be a string");
        }
        const toolMap = new Map<string, TDefinition[number]>(
          options.tools.map((h) => [h.name, h]),
        );
        return (props: unknown) => {
          const tool = toolMap.get(name);
          if (!tool) {
            throw new Error(`Tool ${name} not found`);
          }
          return State.run(
            options?.context ?? State.getStore(),
            async (args) => {
              // deno-lint-ignore no-explicit-any
              const result = await tool.handler(args as any);

              return result;
            },
            props,
          );
        };
      },
    },
  );
}

export { AuthorizationClient, PolicyClient } from "../auth/policy.ts";

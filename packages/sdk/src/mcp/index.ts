export * from "../errors.ts";
export * from "./assertions.ts";
export * from "./context.ts";
export * from "./wallet/stripe/webhook.ts";
import * as agentsAPI from "./agents/api.ts";
import { AppContext, State } from "./context.ts";
import * as fsAPI from "./fs/api.ts";
import * as hostingAPI from "./hosting/api.ts";
import * as integrationsAPI from "./integrations/api.ts";
import * as knowledgeAPI from "./knowledge/api.ts";
import * as membersAPI from "./members/api.ts";
import * as profilesAPI from "./profiles/api.ts";
import { CreateStubHandlerOptions, MCPClientStub } from "./stub.ts";
import * as teamsAPI from "./teams/api.ts";
import * as threadsAPI from "./threads/api.ts";
import * as triggersAPI from "./triggers/api.ts";
import * as walletAPI from "./wallet/api.ts";

// Register tools for each API handler
export const GLOBAL_TOOLS = [
  teamsAPI.getTeam,
  teamsAPI.createTeam,
  teamsAPI.updateTeam,
  teamsAPI.deleteTeam,
  teamsAPI.listTeams,
  membersAPI.getTeamMembers,
  membersAPI.updateTeamMember,
  membersAPI.removeTeamMember,
  membersAPI.registerMemberActivity,
  membersAPI.getMyInvites,
  membersAPI.acceptInvite,
  membersAPI.inviteTeamMembers,
  membersAPI.teamRolesList,
  profilesAPI.getProfile,
  profilesAPI.updateProfile,
  integrationsAPI.callTool,
  integrationsAPI.listTools,
] as const;

// Tools tied to an specific workspace
export const WORKSPACE_TOOLS = [
  agentsAPI.getAgent,
  agentsAPI.deleteAgent,
  agentsAPI.createAgent,
  agentsAPI.createTempAgent,
  agentsAPI.updateAgent,
  agentsAPI.listAgents,
  agentsAPI.getTempAgent,
  integrationsAPI.getIntegration,
  integrationsAPI.createIntegration,
  integrationsAPI.updateIntegration,
  integrationsAPI.deleteIntegration,
  integrationsAPI.listIntegrations,
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
  triggersAPI.activateTrigger,
  triggersAPI.deactivateTrigger,
  knowledgeAPI.createBase,
  knowledgeAPI.deleteBase,
  knowledgeAPI.forget,
  knowledgeAPI.remember,
  knowledgeAPI.search,
  fsAPI.listFiles,
  fsAPI.readFile,
  fsAPI.readFileMetadata,
  fsAPI.writeFile,
  fsAPI.deleteFile,
] as const;

export type GlobalTools = typeof GLOBAL_TOOLS;
export type WorkspaceTools = typeof WORKSPACE_TOOLS;
export type ToolLike = GlobalTools | WorkspaceTools;

const global = createMCPToolsStub({
  tools: GLOBAL_TOOLS,
});

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

export function createMCPToolsStub<TDefinition extends ToolLike>(
  options: CreateStubHandlerOptions<TDefinition>,
): MCPClientStub<TDefinition> {
  return new Proxy<MCPClientStub<TDefinition>>(
    {} as MCPClientStub<TDefinition>,
    {
      get(_, name) {
        if (typeof name !== "string") {
          throw new Error("Name must be a string");
        }
        const toolMap = new Map<string, ToolLike[number]>(
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
              const result = await tool.handler(args);

              if (result.isError) {
                throw result.structuredContent;
              }

              return result.structuredContent;
            },
            props,
          );
        };
      },
    },
  );
}

export { AuthorizationClient, PolicyClient } from "../auth/policy.ts";

export const WellKnownMcpGroups = {
  AI: "ai-generation",
  Agent: "agent-management",
  AgentSetup: "agent-setup",
  APIKeys: "api-keys-management",
  Channel: "channel-management",
  Contracts: "contracts-management",
  Databases: "databases-management",
  Deconfig: "deconfig-management",
  Email: "email-management",
  FS: "file-system",
  Hosting: "hosting",
  Integration: "integration-management",
  KnowledgeBase: "knowledge-base-",
  KnowledgeBaseManagement: "kb-management",
  Model: "model-management",
  OAuth: "oauth-management",
  Prompt: "prompt-management",
  User: "user-management",
  Registry: "registry-management",
  Sandbox: "code-sandbox",
  Team: "team-management",
  Thread: "thread-management",
  Triggers: "triggers-management",
  Wallet: "wallet-management",
  Tools: "tools-management",
  Workflows: "workflows-management",
  Self: "self",
};

export type WellKnownMcpGroup = keyof typeof WellKnownMcpGroups;

export const WellKnownMcpGroupIds = Object.values(WellKnownMcpGroups).map(
  (group) => `i:${group}`,
);

/**
 * Utility function to format well-known group names as integration IDs
 * Adds the 'i:' prefix to group names to create proper integration IDs
 */
export function formatIntegrationId(wellKnownGroup: string): string {
  return `i:${wellKnownGroup}`;
}

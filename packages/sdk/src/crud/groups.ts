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
  Registry: "registry-management",
  Sandbox: "code-sandbox",
  Team: "team-management",
  Thread: "thread-management",
  Triggers: "triggers-management",
  Wallet: "wallet-management",
  Self: "self-management",
};

export type WellKnownMcpGroup = keyof typeof WellKnownMcpGroups;

export const WellKnownMcpGroupIds = Object.values(WellKnownMcpGroups).map(
  (group) => `i:${group}`,
);

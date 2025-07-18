export const WellKnownMcpGroups = {
  FS: "file-system",
  Hosting: "hosting",
  Registry: "registry-management",
  Wallet: "wallet-management",
  Team: "team-management",
  Model: "model-management",
  Prompt: "prompt-management",
  Thread: "thread-management",
  Whatsapp: "whatsapp-management",
  Integration: "integration-management",
  Triggers: "triggers-management",
  Agent: "agent-management",
  AgentSetup: "agent-setup",
  Channel: "channel-management",
  KnowledgeBase: "knowledge-base-",
  Email: "email-management",
  KnowledgeBaseManagement: "kb-management",
  APIKeys: "api-keys-management",
  Databases: "databases-management",
  AI: "ai-generation",
  OAuth: "oauth-management",
};

export type WellKnownMcpGroup = keyof typeof WellKnownMcpGroups;

export const WellKnownMcpGroupIds = Object.values(WellKnownMcpGroups).map(
  (group) => `i:${group}`,
);

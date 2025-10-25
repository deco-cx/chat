export const WellKnownMcpGroups = {
  AI: "ai-generation",
  Agent: "agent-management",
  AgentSetup: "agent-setup",
  APIKeys: "api-keys-management",
  Channel: "channel-management",
  Contracts: "contracts-management",
  Databases: "databases-management",
  Deconfig: "deconfig-management",
  Documents: "documents-management",
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
  Theme: "theme-management",
  Thread: "thread-management",
  Triggers: "triggers-management",
  Views: "views-management",
  Wallet: "wallet-management",
  Tools: "tools-management",
  HTTP: "http",
  Workflows: "workflows-management",
  Self: "self",
} as const;

type Groups = typeof WellKnownMcpGroups;

export type WellKnownMcpGroupRecord = Record<Groups[keyof Groups], string>;

// used to publish on the registry
export const WellKnownAppNames = {
  "ai-generation": "ai-gateway",
  "agent-management": "agents",
  "agent-setup": "agent-crud",
  "api-keys-management": "api-keys",
  "channel-management": "channels",
  "contracts-management": "contracts",
  "databases-management": "database",
  "deconfig-management": "deconfig",
  "documents-management": "documents",
  "email-management": "email-admin",
  "file-system": "file-system",
  hosting: "hosting",
  "integration-management": "integrations",
  "kb-management": "knowledge-base",
  "model-management": "ai-models",
  "oauth-management": "oauth-management",
  "prompt-management": "prompts",
  "user-management": "users",
  "registry-management": "registry",
  "code-sandbox": "code-sandbox",
  "team-management": "teams",
  "theme-management": "themes",
  "thread-management": "threads",
  "triggers-management": "triggers",
  "views-management": "views",
  "wallet-management": "wallet",
  "tools-management": "tools",
  http: "http",
  "workflows-management": "workflows",
} satisfies Partial<WellKnownMcpGroupRecord>;

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

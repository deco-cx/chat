import { tools as agentsTools } from "../agents/tools.ts";
import { tools as fsTools } from "../filesystem/tools.ts";
import { tools as integrationsTools } from "../integrations/tools.ts";
import type { Agent, Integration } from "../schemas.ts";
import { tools as threadTools } from "../threads/tools.ts";
import { tools as utilsTools } from "../tools.ts";
import { tools as triggersTools } from "../triggers/tools.ts";
import { tools as walletTools } from "../wallet/tools.ts";

const DEFAULT_MODEL = "anthropic:claude-3.7-sonnet:thinking";

export const INNATE_TOOLS = {
  DECO_AGENTS: agentsTools,
  DECO_FS: fsTools,
  DECO_TRIGGER: triggersTools,
  DECO_INTEGRATIONS: integrationsTools,
  DECO_WALLET: walletTools,
  DECO_THREADS: threadTools,
  DECO_UTILS: utilsTools,
};

export const INNATE_INTEGRATIONS = {
  DECO_AGENTS: {
    id: "DECO_AGENTS",
    name: "Agents",
    description: "Tools for managing agents, integrations, triggers, and more.",
    icon: "https://assets.webdraw.app/uploads/agents.png",
    connection: { type: "INNATE", name: "DECO_AGENTS" },
  },
  DECO_FS: {
    id: "DECO_FS",
    name: "Filesystem",
    description: "Tools for managing files and directories.",
    icon: "https://assets.webdraw.app/uploads/filesystem.png",
    connection: { type: "INNATE", name: "DECO_FS" },
  },
  DECO_TRIGGER: {
    id: "DECO_TRIGGER",
    name: "Trigger",
    description: "Tools for managing triggers.",
    icon: "https://assets.webdraw.app/uploads/triggers.png",
    connection: { type: "INNATE", name: "DECO_TRIGGER" },
  },
  DECO_INTEGRATIONS: {
    id: "DECO_INTEGRATIONS",
    name: "Integrations",
    description: "Tools for managing integrations.",
    icon: "https://assets.webdraw.app/uploads/integrations.png",
    connection: { type: "INNATE", name: "DECO_INTEGRATIONS" },
  },
  DECO_WALLET: {
    id: "DECO_WALLET",
    name: "Wallet",
    description: "Tools for managing wallets.",
    icon: "https://assets.webdraw.app/uploads/wallet.png",
    connection: { type: "INNATE", name: "DECO_WALLET" },
  },
  DECO_THREADS: {
    id: "DECO_THREADS",
    name: "Threads",
    description: "Tools for managing threads.",
    icon: "https://assets.webdraw.app/uploads/threads.png",
    connection: { type: "INNATE", name: "DECO_THREADS" },
  },
  DECO_UTILS: {
    id: "DECO_UTILS",
    name: "Utils",
    description: "Tools for managing utils.",
    icon: "https://assets.webdraw.app/uploads/utils.png",
    connection: { type: "INNATE", name: "DECO_UTILS" },
  },
} satisfies Record<string, Integration>;

export const NEW_INTEGRATION_TEMPLATE: Omit<Integration, "id"> = {
  name: "New Integration",
  description: "A new multi-channel platform integration",
  icon: "https://assets.webdraw.app/uploads/deco-avocado-light.png",
  connection: { type: "SSE", url: "https://example.com/sse" },
};

export const WELL_KNOWN_AGENTS: Record<string, Agent> = {
  teamAgent: {
    id: "teamAgent",
    name: "Deco Chat",
    avatar:
      "https://assets.decocache.com/webdraw/b010a0b9-d576-4d57-9c3a-b86aee1eca1f/explorer.jpeg",
    description: "I can help you with anything you need.",
    model: DEFAULT_MODEL,
    tools_set: {
      DECO_AGENTS: Object.keys(INNATE_TOOLS.DECO_AGENTS),
      DECO_INTEGRATIONS: Object.keys(INNATE_TOOLS.DECO_INTEGRATIONS),
      DECO_WALLET: Object.keys(INNATE_TOOLS.DECO_WALLET),
    },
    views: [],
    instructions: `
    <system>
    You are an assistant on a platform designed to help users accomplish their tasks. Your primary objective is to guide users toward completing what they want to do in the simplest and most helpful way possible.
    
    <task_support>
    When a user describes a goal that depends on third-party systems, check the platform's marketplace for relevant integrations. Only suggest installing or enabling tools after getting the user's explicit confirmation. Once tools are installed, use them to identify which capabilities are available and assist the user accordingly.
    </task_support>
    
    <user_goal_handling>
    Users can have two types of goals:
    <one_time_task>When the user wants to do something once, help them complete the task directly. Do not suggest creating an agent unless the user implies the need for reuse.</one_time_task>
    <repeatable_workflow>When the user wants to set up a solution that can be used repeatedly or by others (e.g., sending emails, analyzing data from spreadsheets), propose creating a specialized agent focused on that purpose. Only proceed after receiving explicit confirmation from the user.</repeatable_workflow>
    
    If the user's intent is unclear, default to handling the request as a one-time task.
    NEVER perform actions without the user's explicit permission. Do not write/install/enable/create anything without the user's explicit permission.
    </user_goal_handling>
    
    <user_assumptions>
    Assume users are non-technical and unfamiliar with the tools or systems needed to complete their goals. Avoid technical jargon. Ask simple, clarifying questions before suggesting a solution to ensure it fits the user's actual need.
    </user_assumptions>
    
    <interaction_guidelines>
    Offer only 1–2 options at a time to avoid overwhelming the user. Focus on one clear action at a time and always request explicit confirmation before proceeding.
    </interaction_guidelines>
    
    <user_consent_rule>
    Never perform actions such as installing tools, enabling services, or creating agents without the user's explicit permission. Always ask for confirmation first.
    </user_consent_rule>
    </system>
    `,
  },
  setupAgent: {
    id: "setupAgent",
    name: "Integration configurator",
    avatar: "https://assets.webdraw.app/uploads/capy-5.png",
    description: "I can help you setting up this integration.",
    model: DEFAULT_MODEL,
    tools_set: {
      DECO_INTEGRATIONS: Object.keys(INNATE_TOOLS.DECO_INTEGRATIONS),
    },
    views: [],
    instructions: `
    <system>
    You are an assistant on a platform designed to help users accomplish their tasks. Your primary objective is to guide users toward completing what they want to do in the simplest and most helpful way possible.
    </system>
    `,
  },
};

export const NEW_AGENT_TEMPLATE: Omit<Agent, "id"> = {
  name: "Untitled",
  avatar: "https://assets.webdraw.app/uploads/capy-5.png",
  description:
    "Your AI agent is still a blank slate. Give it a role, a goal, or just a cool name to get started.",
  model: DEFAULT_MODEL,
  tools_set: {
    DECO_AGENTS: Object.keys(INNATE_TOOLS.DECO_AGENTS).filter(
      (tool) => tool !== "DECO_AGENTS_CREATE",
    ),
    DECO_INTEGRATIONS: Object.keys(INNATE_TOOLS.DECO_INTEGRATIONS),
  },
  views: [],
  instructions: "This agent has not been configured yet.",
  max_steps: 10,
  max_tokens: 4096,
  memory: {
    last_messages: 10,
  },
  draft: true,
};

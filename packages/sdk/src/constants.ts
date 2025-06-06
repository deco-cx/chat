/**
 * Determines if the application should use local backend services.
 *
 * By default, LOCAL_DEBUGGER will be false.
 * If the environment variable VITE_USE_LOCAL_BACKEND is set to 'true',
 * it will use the localhost version.
 */

import { Agent } from "./models/agent.ts";
import { Integration } from "./models/mcp.ts";

// @ts-ignore - Vite injects env variables at build time
const LOCAL_DEBUGGER = import.meta.env?.VITE_USE_LOCAL_BACKEND === "true";
const isLocalhost = globalThis.location?.hostname === "localhost";

// Log a warning if the environment variable is not set
// @ts-ignore - Vite injects env variables at build time
if (isLocalhost && import.meta.env?.VITE_USE_LOCAL_BACKEND === undefined) {
  console.warn(
    "VITE_USE_LOCAL_BACKEND environment variable is not set. " +
      "To use local backend services, create a .env file in apps/web/ " +
      "and add VITE_USE_LOCAL_BACKEND=true",
  );
}

export const LEGACY_API_SERVER_URL = LOCAL_DEBUGGER
  ? "http://localhost:8000"
  : "https://fs.deco.chat";

export const API_SERVER_URL = LOCAL_DEBUGGER
  ? "http://localhost:3001"
  : "https://api.deco.chat";

export const AUTH_URL = LOCAL_DEBUGGER
  ? "http://localhost:3001"
  : "https://api.deco.chat";

export const API_HEADERS = {
  "content-type": "application/json",
  "use-api-host": "true",
} as const;

export const WELL_KNOWN_AGENT_IDS = {
  teamAgent: "teamAgent",
  setupAgent: "setupAgent",
} as const;

export interface Model {
  id: string;
  model: string;
  name: string;
  logo: string;
  capabilities: Capability[];
  legacyId?: string;
  description?: string;
  byDeco: boolean;
  isEnabled: boolean;
  hasCustomKey: boolean;
  apiKeyEncrypted?: string;
}

const LOGOS = {
  openai:
    "https://assets.decocache.com/webdraw/15dc381c-23b4-4f6b-9ceb-9690f77a7cf5/openai.svg",
  anthropic:
    "https://assets.decocache.com/webdraw/6ae2b0e1-7b81-48f7-9707-998751698b6f/anthropic.svg",
  google:
    "https://assets.decocache.com/webdraw/17df85af-1578-42ef-ae07-4300de0d1723/gemini.svg",
  xai:
    "https://assets.decocache.com/webdraw/7a8003ff-8f2d-4988-8693-3feb20e87eca/xai.svg",
};

// TODO(@camudo): Make native web search work
type Capability =
  | "reasoning"
  | "image-upload"
  | "file-upload"
  | "web-search";

// First one is the default model for agents, so choose wisely.
export const WELL_KNOWN_MODELS: Model[] = [
  {
    id: "openai:gpt-4.1-mini",
    model: "openai:gpt-4.1-mini",
    name: "OpenAI GPT-4.1 mini",
    logo: LOGOS.openai,
    capabilities: ["reasoning", "image-upload", "file-upload"],
    byDeco: true,
    isEnabled: true,
    hasCustomKey: false,
  },
  {
    id: "anthropic:claude-sonnet-4",
    model: "anthropic:claude-sonnet-4",
    name: "Claude Sonnet 4",
    logo: LOGOS.anthropic,
    capabilities: ["reasoning", "image-upload", "file-upload"],
    // TODO: remove duplicated ids, bydeco, enabled, etc. from here.
    byDeco: true,
    isEnabled: true,
    hasCustomKey: false,
  },
  {
    id: "anthropic:claude-3.7-sonnet:thinking",
    model: "anthropic:claude-3.7-sonnet:thinking",
    name: "Claude Sonnet 3.7",
    logo: LOGOS.anthropic,
    capabilities: ["reasoning", "image-upload", "file-upload"],
    legacyId: "anthropic:claude-3-7-sonnet-20250219",
    byDeco: true,
    isEnabled: true,
    hasCustomKey: false,
  },
  {
    id: "google:gemini-2.5-pro-preview",
    model: "google:gemini-2.5-pro-preview",
    name: "Google Gemini Pro 2.5",
    logo: LOGOS.google,
    capabilities: ["reasoning", "image-upload", "file-upload"],
    legacyId: "google:gemini-2.5-pro-preview-03-25",
    byDeco: true,
    isEnabled: true,
    hasCustomKey: false,
  },
  {
    id: "openai:gpt-4.1",
    model: "openai:gpt-4.1",
    name: "OpenAI GPT-4.1",
    logo: LOGOS.openai,
    capabilities: ["reasoning", "image-upload", "file-upload"],
    byDeco: true,
    isEnabled: true,
    hasCustomKey: false,
  },
  {
    id: "openai:gpt-4.1-nano",
    model: "openai:gpt-4.1-nano",
    name: "OpenAI GPT-4.1 nano",
    logo: LOGOS.openai,
    capabilities: ["reasoning", "image-upload"],
    byDeco: true,
    isEnabled: true,
    hasCustomKey: false,
  },
  {
    id: "openai:o3-mini-high",
    model: "openai:o3-mini-high",
    name: "OpenAI o3-mini",
    logo: LOGOS.openai,
    capabilities: ["reasoning"],
    byDeco: true,
    isEnabled: true,
    hasCustomKey: false,
  },
  {
    id: "x-ai:grok-3-beta",
    model: "x-ai:grok-3-beta",
    name: "Grok 3 Beta",
    logo: LOGOS.xai,
    capabilities: ["reasoning", "image-upload", "file-upload"],
    byDeco: true,
    isEnabled: true,
    hasCustomKey: false,
  },
];

export const DEFAULT_MODEL = WELL_KNOWN_MODELS[0];

export function isWellKnownModel(modelId: string): boolean {
  return WELL_KNOWN_MODELS.some((m) => m.id === modelId);
}

/**
 * Gets the trace debug ID from the URL or generates a new one
 * @returns The trace debug ID
 */
export function getTraceDebugId(): string {
  const href = globalThis?.location?.href;
  if (!href) {
    return crypto.randomUUID();
  }
  return new URL(globalThis.location.href).searchParams.get("__d") ||
    crypto.randomUUID();
}

export const NEW_INTEGRATION_TEMPLATE: Omit<Integration, "id"> = {
  name: "New Integration",
  description: "A new multi-channel platform integration",
  icon: "https://assets.webdraw.app/uploads/deco-avocado-light.png",
  connection: { type: "SSE", url: "https://example.com/sse" },
};

export const INNATE_INTEGRATIONS = {
  DECO_INTEGRATIONS: {
    id: "DECO_INTEGRATIONS",
    name: "Integrations",
    description: "Tools for managing integrations.",
    icon: "https://assets.webdraw.app/uploads/integrations.png",
    connection: { type: "INNATE", name: "DECO_INTEGRATIONS" },
  },
  DECO_UTILS: {
    id: "DECO_UTILS",
    name: "Utils",
    description: "Tools for managing utils.",
    icon: "https://assets.webdraw.app/uploads/utils.png",
    connection: { type: "INNATE", name: "DECO_UTILS" },
  },
} satisfies Record<string, Integration>;

export const NEW_AGENT_TEMPLATE: Omit<Agent, "id"> = {
  name: "Untitled",
  avatar: "https://assets.webdraw.app/uploads/capy-5.png",
  description: "",
  model: DEFAULT_MODEL.id,
  visibility: "WORKSPACE",
  tools_set: {},
  views: [],
  instructions: "",
  max_steps: 10,
  max_tokens: 4096,
  memory: {
    last_messages: 10,
  },
};

/**
 * TODO: something is weird with the tools set here.
 * There's something off with the innate agents having to have
 * these tools hardcoded in here. Maybe a setup is missing?
 */
export const WELL_KNOWN_AGENTS = {
  teamAgent: {
    id: "teamAgent",
    ...NEW_AGENT_TEMPLATE,
    tools_set: {
      DECO_INTEGRATIONS: [
        "DECO_INTEGRATIONS_SEARCH",
        "DECO_INTEGRATION_INSTALL",
        "DECO_INTEGRATION_ENABLE",
        "DECO_INTEGRATION_DISABLE",
        "DECO_INTEGRATION_LIST_TOOLS",
      ],
    },
  },
  setupAgent: {
    id: "setupAgent",
    name: "Setup agent",
    avatar: "https://assets.webdraw.app/uploads/capy-5.png",
    description: "I can help you with this setup.",
    model: DEFAULT_MODEL.id,
    visibility: "PUBLIC",
    tools_set: {
      DECO_INTEGRATIONS: [
        "DECO_INTEGRATIONS_SEARCH",
        "DECO_INTEGRATION_INSTALL",
        "DECO_INTEGRATION_ENABLE",
        "DECO_INTEGRATION_DISABLE",
        "DECO_INTEGRATION_LIST_TOOLS",
      ],
    },
    views: [],
    instructions: `
You are an assistant that helps users set up integrations and agents. 

When setting up an integration, you should start by running tools that setup the integration. For instance, you should
check if connection is active and configure the integration.
If the configuration needs some extra data from the user, ask the user for the data.
Also, try running a tool for testing if the integration is working.

For setting up an agent, you should start by running tools that setup the agent. For instance, you should
check if the agent is active and configure the agent.
`,
  },
} satisfies Record<string, Agent>;

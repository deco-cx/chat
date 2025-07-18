import type { Integration } from "@deco/sdk";
import { INNATE_INTEGRATIONS } from "@deco/sdk";
import type { AIAgent, Env } from "../agent.ts";
import { createHandoffToolsFor } from "../agents/handoff.ts";
import { createTool } from "../utils/create-tool.ts";
import { INNATE_TOOLS } from "./constants.ts";
export { INNATE_TOOLS } from "./constants.ts";

export const getToolsForInnateIntegration = (
  integration: Integration,
  agent: AIAgent,
  env?: Env,
) => {
  const tools =
    integration.id in INNATE_INTEGRATIONS
      ? INNATE_TOOLS[integration.id as keyof typeof INNATE_INTEGRATIONS]
      : createHandoffToolsFor(integration);

  return Object.fromEntries(
    Object.entries(tools).map(([key, tool]) => {
      if (typeof tool.execute !== "function") {
        console.log({ tool });
      }

      return [key, createTool({ ...tool, execute: tool.execute(agent, env) })];
    }),
  );
};

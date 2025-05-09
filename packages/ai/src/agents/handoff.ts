import { Path } from "@deco/sdk/path";
import z from "zod";
import { AIAgent } from "../agent.ts";
import type { Integration } from "../storage/index.ts";
import { INNATE_TOOLS } from "../storage/tools.ts";
import { createInnateTool } from "../utils/createTool.ts";

const descriptionFrom = (integration: Integration) => `
Asks agent ${integration.name} for help with the current task. This agent ${integration.description}.
`;

export const createHandoffToolsFor = (integration: Integration) => ({
  HANDOFF_AGENT: createInnateTool({
    id: "HANDOFF_AGENT",
    description: descriptionFrom(integration),
    inputSchema: z.object({
      message: z.string().describe("The message to send to the agent"),
    }),
    outputSchema: z.object({
      text: z.string().describe("The response from the agent"),
      threadId: z.string().describe("The ID of the new thread"),
      agentId: z.string().describe("The ID of the new agent"),
    }),
    execute:
      (agent) => async ({ context, threadId: _threadId, resourceId }) => {
        const segments = integration.id.split(":");
        const agentId = segments[1] || segments[0];
        const threadId = `${_threadId}-${agentId}`;
        const targetAgent = agent.state.stub(AIAgent).new(
          Path.resolveHome(
            Path.folders.Agent.root(agentId),
            agent.workspace,
          ).path,
        ).withMetadata({ threadId, resourceId });

        const userMessage = {
          id: crypto.randomUUID(),
          role: "user" as const,
          content: context.message,
        };

        const response = await targetAgent.generate([userMessage], {
          tools: {
            DECO_AGENTS: Object.keys(INNATE_TOOLS.DECO_AGENTS),
            DECO_INTEGRATIONS: Object.keys(INNATE_TOOLS.DECO_INTEGRATIONS),
            DECO_THREADS: Object.keys(INNATE_TOOLS.DECO_THREADS),
          },
        });

        return {
          text: response.text,
          threadId,
          agentId,
        };
      },
  }),
});

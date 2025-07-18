import type { Integration } from "@deco/sdk";
import { Path } from "@deco/sdk/path";
import z from "zod";
import { AIAgent } from "../agent.ts";
import { createInnateTool } from "../utils/create-tool.ts";

const descriptionFrom = (
  integration: Pick<Integration, "name" | "description">,
) => `
Asks agent ${integration.name} for help with the current task. This agent ${integration.description}.
`;

export const createHandoffToolsFor = (
  integration: Pick<Integration, "id" | "name" | "description">,
) => ({
  HANDOFF_AGENT: createInnateTool({
    id: "HANDOFF_AGENT",
    description: descriptionFrom(integration),
    inputSchema: z.object({
      message: z.string().describe("The message to send to the agent"),
      schema: z
        .any()
        .optional()
        .describe(
          "The JSON schema to use for a structured response. If provided, the response will be an object.",
        ),
    }),
    outputSchema: z.object({
      text: z.string().optional().describe("The response from the agent"),
      object: z.any().optional().describe("The object response from the agent"),
      threadId: z.string().describe("The ID of the new thread"),
      agentId: z.string().describe("The ID of the new agent"),
    }),
    execute:
      (agent) =>
      async ({ context, threadId: _threadId, resourceId }) => {
        const segments = integration.id.split(":");
        const agentId = segments[1] || segments[0];
        const threadId = `${_threadId}-${agentId}`;
        const targetAgent = agent.state
          .stub(AIAgent)
          .new(
            Path.resolveHome(Path.folders.Agent.root(agentId), agent.workspace)
              .path,
          )
          .withMetadata({ threadId, resourceId });

        const userMessage = {
          id: crypto.randomUUID(),
          role: "user" as const,
          content: context.message,
        };

        if (context.schema) {
          const response = await targetAgent.generateObject(
            [userMessage],
            context.schema,
          );
          return {
            object: response.object,
            threadId,
            agentId,
          };
        }

        const response = await targetAgent.generate([userMessage]);

        return {
          text: response.text,
          threadId,
          agentId,
        };
      },
  }),
});

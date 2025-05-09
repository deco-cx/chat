import z from "zod";
import { pickCapybaraAvatar } from "../capybaras.ts";
import { AgentSchema } from "../storage/index.ts";
import { createInnateTool } from "../utils/createTool.ts";

export const DECO_AGENTS_CREATE = createInnateTool({
  id: "DECO_AGENTS_CREATE",
  description: "Create a new agent",
  inputSchema: AgentSchema.omit({ id: true }),
  outputSchema: AgentSchema,
  execute: (agent) => async ({ context }) => {
    const id = crypto.randomUUID();
    const manifest = {
      ...context,
      avatar: pickCapybaraAvatar(),
      id,
    };

    await agent.storage?.agents.for(agent.workspace).create(manifest);

    return manifest;
  },
});

export const DECO_AGENTS_CONFIGURE = createInnateTool({
  id: "DECO_AGENTS_CONFIGURE",
  description:
    "Configure the agent. Prefer to leave the avatar as a blank string.",
  inputSchema: AgentSchema,
  outputSchema: AgentSchema,
  execute: (agent) => async ({ context }) => {
    return await agent.configure(context);
  },
});

export const DECO_AGENTS_CONFIGURATION = createInnateTool({
  id: "DECO_AGENTS_CONFIGURATION",
  description: "Read the agent configuration",
  outputSchema: AgentSchema,
  execute: (agent) => async () => {
    return await agent.configuration();
  },
});

export const DECO_AGENTS_WHO_AM_I = createInnateTool({
  id: "DECO_AGENTS_WHO_AM_I",
  description: "Get the current thread, resource, and agent identifiers",
  outputSchema: z.object({
    threadId: z.string().describe("The ID of the current thread"),
    resourceId: z.string().describe("The ID of the current resource"),
    agentId: z.string().describe("The ID of the current agent"),
    toolsSets: z.record(z.string(), z.array(z.string())).describe(
      "Tools available to the agent",
    ),
  }),
  execute: (agent) => async () => {
    const toolsets = await agent.getTools();

    return {
      ...agent.thread,
      toolsSets: toolsets,
      agentId: agent.state.id,
    };
  },
});

export const tools = {
  DECO_AGENTS_CREATE,
  DECO_AGENTS_CONFIGURATION,
  DECO_AGENTS_CONFIGURE,
  DECO_AGENTS_WHO_AM_I,
} as const;

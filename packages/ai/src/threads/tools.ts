import { z } from "zod";
import { createInnateTool } from "../utils/createTool.ts";

const ThreadSchema = z.object({
  id: z.string(),
  resourceId: z.string().describe("The resource ID of the thread"),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
  title: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

const CreateThreadSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});
/**
 * Output schema for thread listing results
 */
const ListThreadsOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  threads: z.array(ThreadSchema),
});

/**
 * Creates a tool for listing all threads
 */
export const DECO_THREAD_LIST = createInnateTool({
  id: "DECO_THREAD_LIST",
  description: "List all threads for the current resource",
  outputSchema: ListThreadsOutputSchema,
  execute: (agent) => async () => {
    try {
      const threads = await agent.listThreads();

      return {
        success: true,
        message: `Found ${threads.length} threads`,
        threads,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to list threads: ${error}`,
        threads: [],
      };
    }
  },
});

/**
 * Input schema for creating a new thread
 */
const CreateThreadInputSchema = CreateThreadSchema;

/**
 * Output schema for thread creation results
 */
const CreateThreadOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  thread: ThreadSchema,
  threadLink: z.string().optional().describe(
    "Link to the thread you should format as a link",
  ),
});

/**
 * Creates a tool for creating new threads
 */
export const DECO_THREAD_CREATE = createInnateTool({
  id: "DECO_THREAD_CREATE",
  description: "Create a new thread with an optional custom resource ID",
  inputSchema: CreateThreadInputSchema,
  outputSchema: CreateThreadOutputSchema,
  execute: (agent) => async ({ context }) => {
    try {
      // Generate a new thread ID using the agent's current thread context
      // but with the optional custom resourceId if provided

      const thread = await agent.createThread({
        ...context,
        resourceId: agent.thread.resourceId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return {
        success: true,
        message:
          `Thread created successfully, render the link as a link in markdown [${thread.title}](${agent.workspace}/agents?threadId=${thread.id}&agentId=${
            agent._configuration!.id
          }`,
        thread,
        threadLink:
          `[${thread.title}](${agent.workspace}/agent?threadId=${thread.id}&agentId=${
            agent._configuration!.id
          }`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create thread: ${error}`,
        // deno-lint-ignore no-explicit-any
        thread: null as any,
      };
    }
  },
});

export const tools = {
  DECO_THREAD_LIST,
  DECO_THREAD_CREATE,
} as const;

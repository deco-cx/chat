import { ActorProxy } from "@deco/actors";
import { MCPClientStub, WorkspaceTools } from "@deco/sdk/mcp";
import type { Workspace } from "@deco/sdk/path";
import { ToolAction } from "@mastra/core";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { AIAgent } from "../agent.ts";
import { mcpServerTools } from "../mcp.ts";
import type { Message, StreamOptions } from "../types.ts";
import type { Trigger } from "./trigger.ts";
import { slugify } from "@deco/sdk/memory";

export interface RunOutputToolArgs {
  agent: ActorProxy<AIAgent>;
  outputTool: string;
  mcpClient: MCPClientStub<WorkspaceTools>;
  workspace: Workspace;
}

interface RunOutputToolError {
  error: string;
  status: number;
  details?: unknown;
}

interface RunOutputToolSuccess {
  tool: ToolAction;
  schema: ReturnType<typeof zodToJsonSchema>;
}

export type RunOutputToolResult = RunOutputToolError | RunOutputToolSuccess;

export async function getOutputTool(
  { agent, outputTool, mcpClient }: RunOutputToolArgs,
): Promise<RunOutputToolResult> {
  const [integrationId, toolId] = outputTool.split("/");
  if (!integrationId || !toolId) {
    return {
      error: "Invalid outputTool format",
      status: 400,
      details: { outputTool },
    };
  }

  const integration = await mcpClient.INTEGRATIONS_GET({
    id: integrationId,
  });

  if (!integration) {
    return {
      error: "Integration not found",
      status: 404,
      details: { integrationId },
    };
  }

  const tools = await mcpServerTools(
    { ...integration, id: integrationId },
    agent as unknown as AIAgent,
  );
  const maybeTool = tools[slugify(toolId)];
  if (!maybeTool || !maybeTool.execute) {
    return {
      error: "Tool not found",
      status: 404,
      details: { toolId },
    };
  }

  const schema = zodToJsonSchema(maybeTool.inputSchema);
  return { tool: maybeTool, schema };
}

export const handleOutputTool = async ({
  outputTool,
  agent,
  messages,
  trigger,
  workspace,
  options,
}: {
  outputTool: string;
  agent: ActorProxy<AIAgent>;
  messages: Message[];
  trigger: Trigger;
  workspace: Workspace;
  options?: StreamOptions;
}) => {
  try {
    const getToolResult = await getOutputTool({
      agent,
      outputTool,
      mcpClient: trigger.mcpClient,
      workspace,
    });

    if ("error" in getToolResult) {
      return Response.json({
        error: getToolResult.error,
        ...(getToolResult.details && typeof getToolResult.details === "object"
          ? getToolResult.details
          : {}),
      }, { status: getToolResult.status });
    }

    const { tool, schema } = getToolResult;
    const toolArgs =
      // deno-lint-ignore no-explicit-any
      (await agent.generateObject(messages, schema as any, options)).object;

    // deno-lint-ignore no-explicit-any
    const result = await tool.execute!({ context: toolArgs } as any);

    return {
      args: toolArgs,
      result,
    };
  } catch (err) {
    console.error("Error calling output tool", err);
    return Response.json({
      message: "Error calling webhook with output tool",
      error: err instanceof Error ? err.message : err,
    }, { status: 500 });
  }
};

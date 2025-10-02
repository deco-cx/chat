import { callFunction, inspect } from "@deco/cf-sandbox";
import z from "zod";
import { formatIntegrationId, WellKnownMcpGroups } from "../../crud/groups.ts";
import { DeconfigResourceV2 } from "../deconfig-v2/index.ts";
import {
  AppContext,
  assertWorkspaceResourceAccess,
  createTool,
  createToolGroup,
  DeconfigClient,
  MCPClient,
  WithTool,
} from "../index.ts";
import {
  createDetailViewUrl,
  createViewImplementation,
  createViewRenderer,
} from "../views-v2/index.ts";
import { DetailViewRenderInputSchema } from "../views-v2/schemas.ts";
import {
  TOOL_CREATE_PROMPT,
  TOOL_DELETE_PROMPT,
  TOOL_READ_PROMPT,
  TOOL_SEARCH_PROMPT,
  TOOL_UPDATE_PROMPT,
} from "./prompts.ts";
import { ToolDefinitionSchema } from "./schemas.ts";
import { asEnv, evalCodeAndReturnDefaultHandle, validate } from "./utils.ts";

export interface ToolBindingImplOptions {
  resourceToolRead: (
    uri: string,
  ) => Promise<{ data: z.infer<typeof ToolDefinitionSchema> }>;
}

/**
 * Common tool execution logic shared between different tool implementations
 */
async function executeToolWithValidation(
  tool: z.infer<typeof ToolDefinitionSchema>,
  input: Record<string, unknown>,
  context: WithTool<AppContext>,
) {
  await assertWorkspaceResourceAccess(context);

  const runtimeId = context.locator?.value ?? "default";
  const client = MCPClient.forContext(context);
  const envPromise = asEnv(client);

  // Validate input against the tool's input schema
  const inputValidation = validate(input, tool.inputSchema);
  if (!inputValidation.valid) {
    return {
      error: `Input validation failed: ${inspect(inputValidation)}`,
    };
  }

  // Use the inlined function code
  using evaluation = await evalCodeAndReturnDefaultHandle(
    tool.execute,
    runtimeId,
  );
  const { ctx, defaultHandle, guestConsole } = evaluation;

  try {
    // Call the function using the callFunction utility
    const callHandle = await callFunction(
      ctx,
      defaultHandle,
      undefined,
      input,
      { env: await envPromise },
    );

    const callResult = ctx.dump(ctx.unwrapResult(callHandle));

    // Validate output against the tool's output schema
    const outputValidation = validate(callResult, tool.outputSchema);

    if (!outputValidation.valid) {
      return {
        error: `Output validation failed: ${inspect(outputValidation)}`,
        logs: guestConsole.logs,
      };
    }

    return { result: callResult, logs: guestConsole.logs };
  } catch (error) {
    return { error: inspect(error), logs: guestConsole.logs };
  }
}

/**
 * Creates tool binding implementation that accepts a resource reader
 * Returns only the core tool execution functionality
 */
export function createToolBindingImpl({
  resourceToolRead,
}: ToolBindingImplOptions) {
  const runTool = createTool({
    name: "DECO_TOOL_CALL_TOOL",
    description: "Invoke a tool created with DECO_RESOURCE_TOOL_CREATE",
    inputSchema: z.object({
      uri: z.string().describe("The URI of the tool to run"),
      input: z.object({}).passthrough().describe("The input of the code"),
    }),
    outputSchema: z.object({
      result: z.any().optional().describe("The result of the tool execution"),
      error: z.any().optional().describe("Error if any"),
      logs: z
        .array(
          z.object({
            type: z.enum(["log", "warn", "error"]),
            content: z.string(),
          }),
        )
        .optional()
        .describe("Console logs from the execution"),
    }),
    handler: async ({ uri, input }, c) => {
      try {
        const { data: tool } = await resourceToolRead(uri);

        if (!tool) {
          return { error: "Tool not found" };
        }

        return await executeToolWithValidation(tool, input, c);
      } catch (error) {
        return { error: inspect(error) };
      }
    },
  });

  return [runTool];
}

const createToolManagementTool = createToolGroup("Tools", {
  name: "Tools Management",
  description: "Manage your tools",
  icon: "https://assets.decocache.com/mcp/81d602bb-45e2-4361-b52a-23379520a34d/sandbox.png",
});

/**
 * Creates tool binding implementation that accepts a resource reader
 * Returns only the core tool execution functionality
 */
export const runTool = createToolManagementTool({
  name: "DECO_TOOL_RUN_TOOL",
  description: "Invoke the tool passed as input",
  inputSchema: z.object({
    tool: ToolDefinitionSchema,
    input: z.object({}).passthrough().describe("The input of the code"),
  }),
  outputSchema: z.object({
    result: z.any().optional().describe("The result of the tool execution"),
    error: z.any().optional().describe("Error if any"),
    logs: z
      .array(
        z.object({
          type: z.enum(["log", "warn", "error"]),
          content: z.string(),
        }),
      )
      .optional()
      .describe("Console logs from the execution"),
  }),
  handler: async ({ tool, input }, c) => {
    try {
      return await executeToolWithValidation(tool, input, c);
    } catch (error) {
      return { error: inspect(error) };
    }
  },
});

// const { items } = await resourceToolSearch({ page: 1, pageSize: Infinity });
// const tools = items.map(async ({ uri }: any) => {
//   const {
//     data: { name, description, inputSchema, outputSchema, execute },
//   } = await resourceToolRead(uri);
//   return createTool({
//     name,
//     group: WellKnownMcpGroups.Tools,
//     description: description,
//     inputSchema: jsonSchemaToModel(inputSchema),
//     outputSchema: jsonSchemaToModel(outputSchema),
//     handler: async (input, c) => {
//       const runtimeId = c.locator?.value ?? "default";
//       const client = MCPClient.forContext(c);
//       const envPromise = asEnv(client);
//       // Use the inlined function code
//       using evaluation = await evalCodeAndReturnDefaultHandle(
//         execute,
//         runtimeId,
//       );
//       const { ctx, defaultHandle, guestConsole: _guestConsole } = evaluation;
//       // Call the function using the callFunction utility
//       const callHandle = await callFunction(
//         ctx,
//         defaultHandle,
//         undefined,
//         input,
//         { env: await envPromise },
//       );
//       const callResult = ctx.dump(ctx.unwrapResult(callHandle));
//       return callResult;
//     },
//   });
// });
// return Promise.all(tools);

/**
 * Tool Resource V2
 *
 * This module provides a Resources 2.0 implementation for tool management
 * using the DeconfigResources 2.0 system with file-based storage.
 *
 * Key Features:
 * - File-based tool storage in DECONFIG directories
 * - Resources 2.0 standardized schemas and URI format
 * - Type-safe tool definitions with Zod validation
 * - Full CRUD operations for tool management
 * - Integration with existing execution environment
 *
 * Usage:
 * - Tools are stored as JSON files in /src/tools directory
 * - Each tool has a unique ID and follows Resources 2.0 URI format
 * - Full validation of tool definitions against existing schemas
 * - Support for inline code only
 */

// Create the ToolResourceV2 using DeconfigResources 2.0
export const ToolResourceV2 = DeconfigResourceV2.define({
  directory: "/src/tools",
  resourceName: "tool",
  dataSchema: ToolDefinitionSchema,
  enhancements: {
    DECO_RESOURCE_TOOL_SEARCH: {
      description: TOOL_SEARCH_PROMPT,
    },
    DECO_RESOURCE_TOOL_READ: {
      description: TOOL_READ_PROMPT,
    },
    DECO_RESOURCE_TOOL_CREATE: {
      description: TOOL_CREATE_PROMPT,
    },
    DECO_RESOURCE_TOOL_UPDATE: {
      description: TOOL_UPDATE_PROMPT,
    },
    DECO_RESOURCE_TOOL_DELETE: {
      description: TOOL_DELETE_PROMPT,
    },
  },
});

// Export types for TypeScript usage
export type ToolDataV2 = z.infer<typeof ToolDefinitionSchema>;

// Helper function to create a tool resource implementation
export function createToolResourceV2Implementation(
  deconfig: DeconfigClient,
  integrationId: string,
) {
  return ToolResourceV2.create(deconfig, integrationId);
}

/**
 * Creates Views 2.0 implementation for tool views
 *
 * This function creates a complete Views 2.0 implementation that includes:
 * - Resources 2.0 CRUD operations for views
 * - View render operations for tool-specific views
 * - Resource-centric URL patterns for better organization
 *
 * @returns Views 2.0 implementation for tool views
 */
export function createToolViewsV2() {
  const integrationId = formatIntegrationId(WellKnownMcpGroups.Tools);

  const toolDetailRenderer = createViewRenderer({
    name: "tool_detail",
    title: "Tool Detail",
    description: "View and manage individual tool details",
    icon: "https://example.com/icons/tool-detail.svg",
    inputSchema: DetailViewRenderInputSchema,
    tools: [
      "DECO_RESOURCE_TOOL_READ",
      "DECO_RESOURCE_TOOL_UPDATE",
      "DECO_RESOURCE_TOOL_DELETE",
      "DECO_TOOL_CALL_TOOL",
    ],
    prompt:
      "You are helping the user manage a tool. You can read the tool definition, update its properties, test its execution, and view its usage. Always confirm actions before executing them.",
    handler: (input, _c) => {
      const url = createDetailViewUrl("tool", integrationId, input.resource);
      return Promise.resolve({ url });
    },
  });

  // Create Views 2.0 implementation
  const viewsV2Implementation = createViewImplementation({
    renderers: [toolDetailRenderer],
  });

  return viewsV2Implementation;
}

import { callFunction, inspect } from "@deco/cf-sandbox";
import z from "zod";
import { DeconfigResourceV2 } from "../deconfig-v2/index.ts";
import {
  assertWorkspaceResourceAccess,
  createTool,
  DeconfigClient,
  MCPClient,
} from "../index.ts";
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

// Function to create tools based on toolResourceV2
export function createToolBindingImpl({
  resourceToolRead,
}: ToolBindingImplOptions) {
  const runTool = createTool({
    name: "DECO_TOOL_CALL_TOOL",
    description: "Tool for running JavaScript code in a sandbox",
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
      await assertWorkspaceResourceAccess(c);

      const runtimeId = c.locator?.value ?? "default";
      const client = MCPClient.forContext(c);

      const envPromise = asEnv(client);

      try {
        const { data: tool } = await resourceToolRead(uri);

        if (!tool) {
          return { error: "Tool not found" };
        }

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
      } catch (error) {
        return { error: inspect(error) };
      }
    },
  });

  return [runTool];
}

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

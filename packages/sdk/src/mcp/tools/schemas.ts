import { z } from "zod/v3";

/**
 * Tool Definition Schema
 *
 * This schema defines the structure for tools using Resources 2.0
 * with standardized JSON Schema validation and inline code execution.
 */
export const ToolDefinitionSchema = z.object({
  name: z.string().describe("The name of the tool"),
  description: z.string().describe("The description of the tool"),
  inputSchema: z
    .object({})
    .passthrough()
    .describe("The JSON schema of the input of the tool"),
  outputSchema: z
    .object({})
    .passthrough()
    .describe("The JSON schema of the output of the tool"),
  execute: z
    .string()
    .describe(
      "Inline ES module code with default export function. The code will be saved to /src/functions/{name}.ts",
    ),
});

export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;

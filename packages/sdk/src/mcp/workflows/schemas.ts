import z from "zod";

// JSON Schema type
export type JSONSchema = Record<string, unknown>;

// Workflow step definition - each step can reference previous steps using @ references
export const WorkflowStepDefinitionSchema = z.object({
  name: z
    .string()
    .min(1)
    .describe("The unique name of the step within the workflow"),
  description: z
    .string()
    .min(1)
    .describe("A clear description of what this step does"),
  inputSchema: z
    .object({})
    .passthrough()
    .describe(
      "JSON Schema defining the input structure for this step",
    ),
  outputSchema: z
    .object({})
    .passthrough()
    .describe(
      "JSON Schema defining the output structure for this step",
    ),
  input: z
    .record(z.unknown())
    .describe(
      "Input object that complies with inputSchema. Values can reference previous steps using @<step_name>.output.property or workflow input using @input.property",
    ),
  execute: z
    .string()
    .min(1)
    .describe(
      "ES module code that exports a default async function: (input: typeof inputSchema, ctx: { env: Record<string, any> }) => Promise<typeof outputSchema>. The input parameter contains the resolved input with all @ references replaced with actual values.",
    ),
  dependencies: z
    .array(
      z.object({
        integrationId: z
          .string()
          .min(1)
          .describe(
            "The integration ID (format: i:<uuid> or a:<uuid>) that this step depends on",
          ),
      }),
    )
    .optional()
    .describe(
      "List of integrations this step calls via ctx.env['{INTEGRATION_ID}'].{TOOL_NAME}(). These integrations must be installed and available for the step to execute successfully.",
    ),
  options: z
    .object({
      retries: z.object({
        limit: z
          .number()
          .int()
          .min(0)
          .default(0)
          .describe("Number of retry attempts for this step (default: 0)"),
        delay: z
          .number()
          .int()
          .min(0)
          .default(0)
          .describe("Delay in milliseconds between retry attempts (default: 0)"),
        backoff: z
          .enum(["constant", "linear", "exponential"])
          .optional()
          .describe("Backoff strategy for retry attempts (default: constant)"),
      }).optional(),
      timeout: z
        .number()
        .positive()
        .default(Infinity)
        .optional()
        .describe("Maximum execution time in milliseconds (default: Infinity)"),
    })
    .optional()
    .describe(
      "Step configuration options including retry and timeout settings",
    ),
});

export const WorkflowDefinitionSchema = z.object({
  name: z.string().min(1).describe("The unique name of the workflow"),
  description: z
    .string()
    .describe("A comprehensive description of what this workflow accomplishes"),
  inputSchema: z
    .object({})
    .passthrough()
    .describe(
      "JSON Schema defining the workflow's input parameters and data structure",
    ),
  outputSchema: z
    .object({})
    .passthrough()
    .describe(
      "JSON Schema defining the workflow's final output after all steps complete",
    ),
  steps: z
    .array(WorkflowStepDefinitionSchema)
    .min(1)
    .describe(
      "Array of workflow steps that execute sequentially. Each step can reference previous step outputs using @<step_name>.output.property syntax.",
    ),
});

export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>;
export type WorkflowStepDefinition = z.infer<typeof WorkflowStepDefinitionSchema>;

// Additional types for compatibility with hooks
export type Workflow = WorkflowDefinition;
export type WorkflowStep = WorkflowStepDefinition;

// Step execution result
export interface StepExecutionResult {
  executedAt: string; // ISO date
  value: unknown; // Result data
  error?: string; // Error message if failed
  duration?: number; // Execution time in ms
}

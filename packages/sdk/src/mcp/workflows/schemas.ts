import z from "zod";

// Code step definition - includes both definition and execution state
export const CodeStepDefinitionSchema = z.object({
  name: z
    .string()
    .min(1)
    .describe("The unique name of the step within the workflow"),
  title: z.string().optional().describe("The title of the step"),
  description: z
    .string()
    .min(1)
    .describe("A clear description of what this step does"),
  inputSchema: z
    .object({})
    .passthrough()
    .optional()
    .describe("JSON Schema defining the input structure for this step"),
  outputSchema: z
    .object({})
    .passthrough()
    .optional()
    .describe("JSON Schema defining the output structure for this step"),
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
            "<IMPORTANT>The integration ID (format: i:<uuid> or a:<uuid>) that this step depends on.</IMPORTANT>",
          ),
        toolNames: z
          .array(z.string().min(1))
          .min(1)
          .optional()
          .describe(
            "<IMPORTANT>List of tool names from this integration that will be used by this code step. This is mandatory if the step uses tools.</IMPORTANT>",
          ),
      }),
    )
    .optional()
    .describe(
      "List of integration dependencies with specific tools. These integrations and their tools must be installed and available for the step to execute successfully. Tools are accessible via ctx.env['{INTEGRATION_ID}']['{TOOL_NAME}'](). Use INTEGRATIONS_LIST to find available integration IDs and their tools.",
    ),
});

// Workflow step definition - combines definition with execution state
export const WorkflowStepDefinitionSchema = z.object({
  def: CodeStepDefinitionSchema,
  input: z
    .record(z.unknown())
    .optional()
    .describe(
      "Input object that complies with inputSchema. Values can reference previous steps using @<step_name>.output.property or workflow input using @input.property",
    ),
  output: z
    .record(z.unknown())
    .optional()
    .describe("Execution output of the step (if it has been run)"),
});

export const WorkflowDefinitionSchema = z.object({
  name: z.string().min(1).describe("The unique name of the workflow"),
  description: z
    .string()
    .describe("A comprehensive description of what this workflow accomplishes"),
  steps: z
    .array(WorkflowStepDefinitionSchema)
    .min(1)
    .describe(
      "Array of workflow steps that execute sequentially. Each step can reference previous step outputs using @<step_name>.output.property syntax.",
    ),
});

export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>;

// Additional types for compatibility with hooks
export type Workflow = WorkflowDefinition;
export type WorkflowStep = z.infer<typeof WorkflowStepDefinitionSchema>;

// Tool reference type for workflow steps
export interface ToolReference {
  integrationId: string; // Clean ID without prefix
  toolName: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  description?: string;
}

// Step execution result
export interface StepExecutionResult {
  executedAt: string; // ISO date
  value: unknown; // Result data
  error?: string; // Error message if failed
  duration?: number; // Execution time in ms
}

// JSON Schema type
export type JSONSchema = Record<string, unknown>;

// Workflow run data schema for Resources 2.0
export const WorkflowRunDataSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  icon: z.string().optional(),
  status: z.string(),
  runId: z.string(),
  workflowURI: z.string().optional(),
  // Processed status fields (computed from workflowStatus)
  currentStep: z
    .string()
    .optional()
    .describe("The name of the step currently being executed (if running)"),
  stepResults: z
    .record(z.any())
    .optional()
    .describe("Results from completed steps"),
  finalResult: z
    .any()
    .optional()
    .describe("The final workflow result (if completed)"),
  partialResult: z
    .any()
    .optional()
    .describe("Partial results from completed steps (if pending/running)"),
  error: z.string().optional().describe("Error message if the workflow failed"),
  logs: z
    .array(
      z.object({
        type: z.enum(["log", "warn", "error"]),
        content: z.string(),
      }),
    )
    .optional()
    .describe("Console logs from the execution"),
  startTime: z
    .number()
    .optional()
    .describe("When the workflow started (timestamp)"),
  endTime: z
    .number()
    .optional()
    .describe("When the workflow ended (timestamp, if completed/failed)"),
  // Raw workflow status from Cloudflare - frontend handles all transformations
  workflowStatus: z
    .object({
      params: z
        .object({
          input: z.any().optional(),
          steps: z.array(z.any()).optional(),
          name: z.string().optional(),
          context: z
            .object({
              workspace: z.any().optional(),
              locator: z.any().optional(),
              workflowURI: z.string().optional(),
              startedBy: z
                .object({
                  id: z.string(),
                  email: z.string().optional(),
                  name: z.string().optional(),
                })
                .optional(),
              startedAt: z.string().optional(),
            })
            .passthrough()
            .optional(),
        })
        .passthrough()
        .nullable()
        .optional(),
      trigger: z.object({ source: z.string() }).passthrough().optional(),
      versionId: z.string().optional(),
      queued: z.string().optional(),
      start: z.string().nullable().optional(),
      end: z.string().nullable().optional(),
      success: z.boolean().nullable().optional(),
      steps: z
        .array(
          z
            .object({
              name: z.string().optional(),
              type: z.string().optional(),
              start: z.string().nullable().optional(),
              end: z.string().nullable().optional(),
              success: z.boolean().nullable().optional(),
              output: z.any().optional(),
              error: z
                .object({
                  name: z.string().optional(),
                  message: z.string().optional(),
                })
                .nullable()
                .optional(),
              attempts: z
                .array(
                  z.object({
                    start: z.string().nullable().optional(),
                    end: z.string().nullable().optional(),
                    success: z.boolean().nullable().optional(),
                    error: z
                      .object({
                        name: z.string().optional(),
                        message: z.string().optional(),
                      })
                      .nullable()
                      .optional(),
                  }),
                )
                .optional(),
              config: z.any().optional(),
            })
            .passthrough(),
        )
        .optional(),
      error: z
        .object({
          name: z.string().optional(),
          message: z.string().optional(),
        })
        .nullable()
        .optional(),
      output: z.any().optional(),
      status: z.string().optional(),
    })
    .passthrough()
    .optional(),
});

export type WorkflowRunData = z.infer<typeof WorkflowRunDataSchema>;

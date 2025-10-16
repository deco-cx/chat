import z from "zod";

// JSON Schema type
export type JSONSchema = Record<string, unknown>;

// Workflow step definition - each step can reference previous steps using @ references
export const CodeStepDefinitionSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .optional()
      .describe("The unique ID of the step within the workflow"),
    name: z
      .string()
      .min(1)
      .optional()
      .describe("The unique name of the step within the workflow"),
    description: z
      .string()
      .min(1)
      .optional()
      .describe("A clear description of what this step does"),
    prompt: z
      .string()
      .optional()
      .describe("The prompt used to generate the step"),
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
    input: z
      .record(z.unknown())
      .optional()
      .describe(
        "Input object that complies with inputSchema. Values can reference previous steps using @<step_name>.output.property or workflow input using @input.property",
      ),
    output: z
      .record(z.unknown())
      .optional()
      .describe("Current output of the step if it was executed"),
    status: z
      .enum(["pending", "active", "completed", "error"])
      .default("pending")
      .describe("Status of the step execution"),
    execute: z
      .string()
      .min(1)
      .optional()
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
        retries: z
          .object({
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
              .describe(
                "Delay in milliseconds between retry attempts (default: 0)",
              ),
            backoff: z
              .enum(["constant", "linear", "exponential"])
              .optional()
              .describe(
                "Backoff strategy for retry attempts (default: constant)",
              ),
          })
          .optional(),
        timeout: z
          .number()
          .positive()
          .default(Infinity)
          .optional()
          .describe(
            "Maximum execution time in milliseconds (default: Infinity)",
          ),
      })
      .optional()
      .describe(
        "Step configuration options including retry and timeout settings",
      ),
  })
  .passthrough();

export const RetriesSchema = z.object({
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
});

export const ToolCallStepDefinitionSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .optional()
      .describe("The unique name of the tool call step within the workflow"),
    description: z
      .string()
      .min(1)
      .optional()
      .describe("A clear description of what this tool call step does"),
    options: z
      .object({
        retries: RetriesSchema.optional(),
        timeout: z
          .number()
          .positive()
          .default(Infinity)
          .optional()
          .describe(
            "Maximum execution time in milliseconds (default: Infinity)",
          ),
      })
      .nullish()
      .describe(
        "Step configuration options. Extend this object with custom properties for business user configuration",
      ),
    tool_name: z
      .string()
      .min(1)
      .optional()
      .describe("The name of the tool to call"),
    integration: z
      .string()
      .min(1)
      .optional()
      .describe("The name of the integration that provides this tool"),
  })
  .passthrough();

export const WorkflowStepDefinitionSchema = z
  .object({
    type: z.enum(["code", "tool_call"]).optional().describe("The type of step"),
    def: z
      .union([CodeStepDefinitionSchema, ToolCallStepDefinitionSchema])
      .optional()
      .describe("The step definition based on the type"),
    output: z
      .record(z.unknown())
      .optional()
      .describe("Execution output of the step (if it has been run)"),
    customOutputView: z
      .string()
      .optional()
      .describe(
        "Custom HTML/JavaScript code for rendering the step output in a custom view",
      ),
  })
  .passthrough();

export const WorkflowDefinitionSchema = z
  .object({
    name: z.string().min(1).describe("The unique name of the workflow"),
    description: z
      .string()
      .describe(
        "A comprehensive description of what this workflow accomplishes",
      ),
    inputSchema: z
      .object({})
      .passthrough()
      .optional()
      .describe(
        "JSON Schema defining the workflow's input parameters and data structure",
      ),
    outputSchema: z
      .object({})
      .passthrough()
      .optional()
      .describe(
        "JSON Schema defining the workflow's final output after all steps complete",
      ),
    steps: z
      .array(WorkflowStepDefinitionSchema)
      .describe(
        "Array of workflow steps that execute sequentially. Each step can reference previous step outputs using @<step_name>.output.property syntax.",
      ),
    authorization: z
      .object({
        token: z
          .string()
          .min(1)
          .describe("The authorization token for the workflow"),
      })
      .optional(),
  })
  .passthrough();

export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>;
export type WorkflowStepDefinition = z.infer<
  typeof WorkflowStepDefinitionSchema
>;

// Additional types for compatibility with hooks
export type Workflow = WorkflowDefinition;
export type WorkflowStep = WorkflowStepDefinition;

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

export interface ToolReference {
  integrationId: string; // Clean ID without prefix
  toolName: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  description?: string;
}

/**
 * Workflow-related tools
 * Based on plans/01-tool-calls.md
 */

import { createPrivateTool } from "@deco/workers-runtime/mastra";
import { z } from "zod";
import type { Env } from "../main.ts";
import type { WorkflowStep } from "../../shared/types/workflows.ts";
import { resolveAtRefsInInput } from "../utils/resolve-refs.ts";
import {
  buildGenerateStepPrompt,
  buildToolsContext,
} from "../prompts/workflow-generation.ts";
import {
  extractToolsFromCode,
  validateUsedTools,
} from "../utils/extract-tools-from-code.ts";
import {
  WorkflowDefinitionSchema,
  WorkflowStepDefinitionSchema,
} from "../../../../packages/sdk/src/mcp/workflows/schemas.ts";

/**
 * Execute a single workflow step
 * Resolves @refs and runs code via DECO_TOOL_RUN_TOOL
 */
export const createRunWorkflowStepTool = (env: Env) =>
  createPrivateTool({
    id: "RUN_WORKFLOW_STEP",
    description:
      "Execute a workflow step with @ref resolution and optional authorization",
    inputSchema: z.object({
      step: z.object({
        id: z.string(),
        name: z.string(),
        execute: z.string(),
        inputSchema: z.record(z.unknown()),
        outputSchema: z.record(z.unknown()),
        input: z.record(z.unknown()),
      }),
      // Previous step results for @ref resolution
      previousStepResults: z.record(z.unknown()).optional(),
      // Global workflow input for @input refs
      globalInput: z.record(z.unknown()).optional(),
      // Workflow steps for name-to-id resolution
      workflowSteps: z
        .array(
          z.object({
            id: z.string(),
            name: z.string(),
          }),
        )
        .optional(),
      // 🔐 Authorization token from workflow (NEW)
      authToken: z.string().optional(),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      output: z.unknown().optional(),
      error: z.unknown().optional(),
      logs: z
        .array(
          z.object({
            type: z.string(),
            content: z.string(),
          }),
        )
        .optional(),
      resolvedInput: z.record(z.unknown()).optional(),
      resolutionErrors: z
        .array(
          z.object({
            ref: z.string(),
            error: z.string(),
          }),
        )
        .optional(),
      duration: z.number().optional(),
    }),
    execute: async ({ context }) => {
      const startTime = Date.now();
      const { step, previousStepResults, globalInput, workflowSteps } = context;

      try {
        // 1. Resolve @refs in input and coerce types based on schema
        // Build workflow steps array for name-to-id resolution
        const steps = workflowSteps || [];

        // CRITICAL FIX: Convert previousStepResults from name-keyed to id-keyed
        // The previousStepResults object uses step names as keys, but references use step IDs
        const stepResultsMap = new Map<string, unknown>();

        // Build a name-to-id mapping
        const nameToIdMap = new Map<string, string>();
        for (const workflowStep of steps) {
          nameToIdMap.set(workflowStep.name, workflowStep.id);
        }

        // Rebuild the results map with ID keys instead of name keys
        for (const [stepName, result] of Object.entries(
          previousStepResults || {},
        )) {
          const stepId = nameToIdMap.get(stepName);
          if (stepId) {
            stepResultsMap.set(stepId, result);
          }
          // Also keep the name-keyed entry for backward compatibility
          stepResultsMap.set(stepName, result);
        }

        const resolutionResult = resolveAtRefsInInput(
          step.input,
          {
            workflow: {
              id: "",
              name: "",
              steps: steps,
              createdAt: "",
              updatedAt: "",
            },
            stepResults: stepResultsMap,
            globalInput: globalInput || {},
          },
          step.inputSchema,
        );

        // If there are resolution errors, return them
        if (resolutionResult.errors && resolutionResult.errors.length > 0) {
          return {
            success: false,
            error: `Failed to resolve @refs: ${resolutionResult.errors
              .map((e) => e.error)
              .join(", ")}`,
            resolutionErrors: resolutionResult.errors,
            duration: Date.now() - startTime,
          };
        }

        // 2. Execute code by wrapping workflow step to match tool signature
        // Detect whether the code uses workflow signature or tool signature
        // - Workflow signature: export default async function(ctx) { ... }
        // - Tool signature: export default async function(input, ctx) { ... }

        // Check if the function has two parameters (tool signature) or one (workflow signature)
        const functionMatch = step.execute.match(
          /async\s+function\s*\(([^)]*)\)/,
        );
        const params = functionMatch
          ? functionMatch[1]
              .split(",")
              .map((p) => p.trim())
              .filter(Boolean)
          : [];
        const isToolSignature = params.length >= 2;

        const wrappedCode = `
// Embedded workflow data (injected at runtime)
const __WORKFLOW_INPUT__ = ${JSON.stringify(globalInput || {})};
const __PREVIOUS_STEP_RESULTS__ = ${JSON.stringify(previousStepResults || {})};

// Original code
const originalFn = ${step.execute.replace(/^export default /, "")};

// Wrapper to match tool signature and handle both workflow and tool signatures
export default async function(input, ctx) {
  ${
    isToolSignature
      ? `
  // Original code uses tool signature (input, ctx)
  // Just call it directly with the resolved input
  return await originalFn(input, ctx);
  `
      : `
  // Original code uses workflow signature (ctx)
  // Create workflow context with workflow-specific methods
  const workflowCtx = {
    readWorkflowInput() {
      return __WORKFLOW_INPUT__;
    },
    readStepResult(stepName) {
      if (!__PREVIOUS_STEP_RESULTS__[stepName]) {
        throw new Error(\`Step '\${stepName}' has not been executed yet\`);
      }
      return __PREVIOUS_STEP_RESULTS__[stepName];
    },
  };
  
  // Call with workflow context
  return await originalFn(workflowCtx);
  `
  }
}`;

        // Prepare the tool execution parameters
        const toolRunParams = {
          tool: {
            name: step.name,
            description: `Workflow step: ${step.name}`,
            inputSchema: step.inputSchema,
            outputSchema: step.outputSchema,
            execute: wrappedCode,
          },
          input: resolutionResult.resolved,
          // 🔐 Authorization token should be a string (JWT token)
          authorization: context.authToken,
        };

        // Execute via DECO_TOOL_RUN_TOOL
        const result = await env.TOOLS.DECO_TOOL_RUN_TOOL(toolRunParams);

        const duration = Date.now() - startTime;

        // 3. Return result
        if (result.error) {
          return {
            success: false,
            error: result.error,
            logs: result.logs,
            resolvedInput: resolutionResult.resolved,
            duration,
          };
        }

        return {
          success: true,
          output: result.result,
          logs: result.logs,
          resolvedInput: resolutionResult.resolved,
          duration,
        };
      } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`Error executing workflow step '${step.name}':`, error);
        return {
          success: false,
          error: String(error),
          duration,
        };
      }
    },
  });

/**
 * Generate a workflow step using AI
 * Gets available integrations and generates code
 */
export const createGenerateStepTool = (env: Env) =>
  createPrivateTool({
    id: "GENERATE_STEP",
    description: "Generate a workflow step using AI based on objective",
    inputSchema: z.object({
      objective: z.string().describe("What this step should accomplish"),
      previousSteps: z
        .array(
          z.object({
            id: z.string().optional(),
            name: z.string(),
            outputSchema: z.record(z.unknown()),
          }),
        )
        .optional()
        .describe("Previous steps for context and @ref resolution"),
      availableIntegrations: z
        .array(
          z.object({
            id: z.string(),
            name: z.string(),
            tools: z.array(
              z.object({
                name: z.string(),
                description: z.string(),
              }),
            ),
          }),
        )
        .optional()
        .describe(
          "Available integrations (if not provided, uses static catalog)",
        ),
      selectedTools: z
        .array(
          z.object({
            name: z.string(),
            integrationId: z.string(),
            integrationName: z.string(),
            description: z.string().optional(),
            inputSchema: z.record(z.unknown()).optional(),
            outputSchema: z.record(z.unknown()).optional(),
          }),
        )
        .optional()
        .describe(
          "Tools explicitly mentioned in prompt with @tool-name syntax",
        ),
    }),
    outputSchema: z.object({
      step: z.object({
        id: z.string(),
        name: z.string(),
        description: z.string(),
        execute: z.string(),
        inputSchema: z.record(z.unknown()),
        outputSchema: z.record(z.unknown()),
        input: z.record(z.unknown()),
        inputDescription: z.record(z.string()).optional(), // NEW!
        primaryIntegration: z.string().optional(),
        primaryTool: z.string().optional(),
        inputView: z.record(z.unknown()).optional(),
        outputView: z.record(z.unknown()).optional(),
      }),
      reasoning: z.string().optional(),
    }),
    execute: async ({
      context,
    }): Promise<{
      step: {
        id: string;
        name: string;
        description: string;
        execute: string;
        inputSchema: Record<string, unknown>;
        outputSchema: Record<string, unknown>;
        input: Record<string, unknown>;
        inputDescription?: Record<string, string>; // NEW!
        primaryIntegration?: string;
        primaryTool?: string;
        inputView?: Record<string, unknown>;
        outputView?: Record<string, unknown>;
      };
      reasoning?: string;
    }> => {
      const { objective, previousSteps, selectedTools } = context;

      // Build previous steps context with EXACT IDs
      const previousStepsContext = previousSteps?.length
        ? `\n\nPrevious steps available (use @refs with EXACT IDs below):\n${previousSteps
            .filter((s) => s.id) // Only include steps with IDs
            .map(
              (s) =>
                `- ID: ${s.id}\n  Name: ${s.name}\n  Reference as: @${s.id}.output\n  Output schema: ${JSON.stringify(s.outputSchema)}`,
            )
            .join("\n\n")}`
        : "";

      // Build tools context if tools are selected (NEW!)
      const toolsContextText = selectedTools?.length
        ? buildToolsContext(selectedTools)
        : "";

      // Build full prompt with tools context
      const basePrompt = buildGenerateStepPrompt(
        objective,
        previousStepsContext,
      );
      const prompt = toolsContextText
        ? `${basePrompt}\n\n${toolsContextText}\n\nREMEMBER: User mentioned specific tools with @. You MUST use them!`
        : basePrompt;
      try {
        const schema = {
          type: "object",
          properties: {
            step: {
              type: "object",
              properties: {
                id: {
                  type: "string",
                  description: "Unique step ID like step-1, step-2",
                },
                name: {
                  type: "string",
                  description: "Human-readable step name",
                },
                description: {
                  type: "string",
                  description: "What this step does",
                },
                execute: {
                  type: "string",
                  description:
                    'ES module code. Format: export default async function (input, ctx) { ... }. Use BRACKET NOTATION ONLY: ctx.env["i:workspace-management"].TOOL_NAME(). For AI: ctx.env["i:workspace-management"].AI_GENERATE_OBJECT({ model: "anthropic:claude-sonnet-4-5", messages: [{role:"user",content:"..."}], schema: {...}, temperature: 0.7 }). For DB: ctx.env["i:workspace-management"].DATABASES_RUN_SQL({ sql: "..." }). ALWAYS wrap in try/catch. Return object matching outputSchema exactly.',
                },
                inputSchema: {
                  type: "object",
                  description:
                    "Complete JSON Schema with type, properties (each with type and description), and required array",
                },
                outputSchema: {
                  type: "object",
                  description:
                    'Complete JSON Schema for return value. CRITICAL: When calling MCP tools, wrap their output in { success: boolean, result: <tool output schema>, error?: string }. DO NOT invent custom properties - use the tool\'s actual output schema inside "result".',
                },
                input: {
                  type: "object",
                  description:
                    "Input object with DEFAULT VALUES for ALL inputSchema.properties. Can use @refs with EXACT step IDs like @step_1759490947550_abc.output.field",
                },
                inputDescription: {
                  type: "object",
                  description:
                    'Optional: Descriptions for where input values come from (e.g., { city: "From Step 1 output" })',
                },
                primaryIntegration: {
                  type: "string",
                  description:
                    'Main integration ID used (e.g., "i:workspace-management")',
                },
                primaryTool: {
                  type: "string",
                  description: 'Main tool called (e.g., "AI_GENERATE_OBJECT")',
                },
                inputView: {
                  type: "object",
                  description: "Optional custom view for input (tree of nodes)",
                },
                outputView: {
                  type: "object",
                  description:
                    "Optional custom view for output (tree of nodes)",
                },
                // 🔐 Authorization: Extract ALL tools used in code
                usedTools: {
                  type: "array",
                  description:
                    'CRITICAL: Extract ALL tools called in your code. For EVERY ctx.env["integration-id"].TOOL_NAME() call, add {toolName, integrationId, integrationName}',
                  items: {
                    type: "object",
                    properties: {
                      toolName: {
                        type: "string",
                        description:
                          'Exact tool name (e.g., "AI_GENERATE_OBJECT")',
                      },
                      integrationId: {
                        type: "string",
                        description:
                          'Integration ID from ctx.env["..."] (e.g., "i:workspace-management")',
                      },
                      integrationName: {
                        type: "string",
                        description:
                          'Human-readable integration name (e.g., "Workspace Management")',
                      },
                    },
                    required: ["toolName", "integrationId", "integrationName"],
                  },
                },
              },
              required: [
                "id",
                "name",
                "description",
                "code",
                "inputSchema",
                "outputSchema",
                "input",
                "usedTools",
              ],
            },
          },
          required: ["step"],
        };

        const result = await env.AI_GATEWAY.AI_GENERATE_OBJECT({
          messages: [
            {
              role: "system",
              content:
                "You are a workflow step generator. Generate clean, working code.",
            },
            { role: "user", content: prompt },
          ],
          schema,
          model: "anthropic:claude-sonnet-4-5",
          temperature: 0.3,
          maxTokens: 16000, // High limit for complex step generation
        });

        const stepResult = result.object as
          | {
              step?: WorkflowStep;
              reasoning?: string;
            }
          | undefined;

        if (!stepResult || !stepResult.step) {
          console.error("❌ [GENERATE_STEP] No step in result:", result);

          return {
            step: {
              id: "step-error",
              name: "Error",
              description: "Failed to generate step",
              execute:
                'export default async function (input, ctx) { return { error: "Generation failed" }; }',
              inputSchema: {},
              outputSchema: {},
              input: {},
            },
            reasoning: "AI generation failed - no valid object returned",
          };
        }

        // 🔐 Validate and auto-fix usedTools using code parser
        const generatedStep = stepResult.step;
        const codeAnalysis = extractToolsFromCode(generatedStep.execute);

        if (generatedStep.usedTools && generatedStep.usedTools.length > 0) {
          interface UsedTool {
            toolName: string;
            integrationId: string;
            integrationName: string;
          }
          const validation = validateUsedTools(
            generatedStep.execute,
            (generatedStep.usedTools as UsedTool[]).map((t) => ({
              toolName: t.toolName,
              integrationId: t.integrationId,
            })),
          );

          if (!validation.valid) {
            console.warn("⚠️ AI missed some tools! Auto-fixing...");
            console.warn("Missing:", validation.missing);
            console.warn("Extra:", validation.extra);

            // Auto-fix: merge AI declared tools with code analysis
            interface UsedToolEntry {
              toolName: string;
              integrationId: string;
              integrationName: string;
            }
            const allToolsMap = new Map<string, UsedToolEntry>();

            // Add tools from AI
            interface UsedTool {
              toolName: string;
              integrationId: string;
              integrationName: string;
            }
            (generatedStep.usedTools as UsedTool[]).forEach(
              (tool: UsedTool) => {
                const key = `${tool.integrationId}:${tool.toolName}`;
                allToolsMap.set(key, {
                  toolName: tool.toolName,
                  integrationId: tool.integrationId,
                  integrationName: tool.integrationName,
                });
              },
            );

            // Add missing tools from code analysis
            validation.missing.forEach((tool) => {
              const key = `${tool.integrationId}:${tool.toolName}`;
              if (!allToolsMap.has(key)) {
                allToolsMap.set(key, {
                  toolName: tool.toolName,
                  integrationId: tool.integrationId,
                  integrationName: "Unknown", // Will be filled by frontend if needed
                });
              }
            });

            generatedStep.usedTools = Array.from(allToolsMap.values());
          }
        } else {
          interface UsedToolEntry {
            toolName: string;
            integrationId: string;
            integrationName: string;
          }
          const uniqueTools = new Map<string, UsedToolEntry>();

          codeAnalysis.forEach((tool) => {
            const key = `${tool.integrationId}:${tool.toolName}`;
            uniqueTools.set(key, {
              toolName: tool.toolName,
              integrationId: tool.integrationId,
              integrationName: "Unknown",
            });
          });

          generatedStep.usedTools = Array.from(uniqueTools.values());
        }

        // Ensure we always return the correct type with required fields
        return {
          step: {
            ...generatedStep,
            description: generatedStep.description || "No description",
          },
          reasoning: stepResult.reasoning,
        };
      } catch (_error) {
        return {
          step: {
            id: "step-error",
            name: "Error",
            description: String(_error),
            execute:
              'export default async function (input, ctx) { return { error: "' +
              String(_error) +
              '" }; }',
            inputSchema: {},
            outputSchema: {},
            input: {},
          },
          reasoning: "Exception during generation: " + String(_error),
        };
      }
    },
  });

/**
 * Import a tool as a step (no AI generation)
 * Generates code that directly calls the specified tool
 */
export const createImportToolAsStepTool = (_env: Env) =>
  createPrivateTool({
    id: "IMPORT_TOOL_AS_STEP",
    description:
      "Generate a workflow step that directly calls a specific tool (without AI)",
    inputSchema: z.object({
      toolName: z.string(),
      integrationId: z.string(),
      integrationName: z.string(),
      toolDescription: z.string().optional(),
      inputSchema: z.record(z.unknown()).optional(),
      outputSchema: z.record(z.unknown()).optional(),
    }),
    outputSchema: z.object({
      step: WorkflowStepDefinitionSchema,
    }),
    execute: async ({ context }) => {
      const {
        toolName,
        integrationId,
        integrationName,
        toolDescription,
        inputSchema,
        outputSchema,
      } = context;

      // Generate step ID
      const stepId = `step_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

      // Extract input fields from inputSchema
      const inputProperties = (
        inputSchema &&
        typeof inputSchema === "object" &&
        "properties" in inputSchema
          ? inputSchema.properties
          : {}
      ) as Record<string, unknown>;
      const requiredFields =
        (inputSchema &&
        typeof inputSchema === "object" &&
        "required" in inputSchema
          ? (inputSchema.required as string[])
          : []) || [];

      // Generate default input values
      const defaultInput: Record<string, unknown> = {};
      const inputDescriptions: Record<string, string> = {};

      for (const [fieldName, fieldSchema] of Object.entries(inputProperties)) {
        const schema = fieldSchema as Record<string, unknown>;
        const fieldType = (schema.type as string) || "string";
        const description = (schema.description as string) || fieldName;

        // Set default value based on type
        if (fieldType === "string") {
          defaultInput[fieldName] = "";
        } else if (fieldType === "number" || fieldType === "integer") {
          defaultInput[fieldName] = 0;
        } else if (fieldType === "boolean") {
          defaultInput[fieldName] = false;
        } else if (fieldType === "array") {
          defaultInput[fieldName] = [];
        } else if (fieldType === "object") {
          defaultInput[fieldName] = {};
        } else {
          defaultInput[fieldName] = null;
        }

        inputDescriptions[fieldName] = description;
      }

      // Generate code that calls the tool
      const inputFieldsList = Object.keys(inputProperties);
      const inputAssignments = inputFieldsList
        .map((field) => `      ${field}: input.${field},`)
        .join("\n");

      const code = `export default async function(input, ctx) {
  try {
    // Validate required fields
    const requiredFields = ${JSON.stringify(requiredFields)};
    for (const field of requiredFields) {
      if (input[field] === undefined || input[field] === null || input[field] === '') {
        throw new Error(\`Missing required field: \${field}\`);
      }
    }

    // Call ${integrationName} tool: ${toolName}
    const result = await ctx.env['${integrationId}'].${toolName}({
${inputAssignments}
    });

    // Return the result
    return {
      success: true,
      result: result,
      error: null,
    };
  } catch (error) {
    console.error('Error calling ${toolName}:', error);
    return {
      success: false,
      error: String(error),
      result: null,
    };
  }
}`;

      // Generate output schema
      const generatedOutputSchema: Record<string, unknown> = {
        type: "object",
        properties: {
          success: {
            type: "boolean",
            description: "Whether the tool call succeeded",
          },
          result: {
            type: [
              (outputSchema &&
              typeof outputSchema === "object" &&
              "type" in outputSchema
                ? outputSchema.type
                : "object") as string,
              "null",
            ],
            description: "Result from the tool (null if error occurred)",
            ...(outputSchema &&
            typeof outputSchema === "object" &&
            "properties" in outputSchema
              ? { properties: outputSchema.properties }
              : {}),
          },
          error: {
            type: ["string", "null"],
            description: "Error message if call failed (null if successful)",
          },
        },
        required: ["success"],
      };

      // Generate input schema (ensure it has proper structure)
      const generatedInputSchema: Record<string, unknown> = {
        type: "object",
        properties: inputProperties,
        required: requiredFields,
      };

      return {
        step: {
          type: "code" as const,
          def: {
            name: stepId,
            description:
              toolDescription ||
              `Direct call to ${toolName} from ${integrationName}`,
            execute: code,
            inputSchema: generatedInputSchema,
            outputSchema: generatedOutputSchema,
            input: defaultInput,
            output: {},
            status: "pending" as const,
            dependencies: [{ integrationId }],
            options: {
              retries: {
                limit: 0,
                delay: 0,
              },
            },
          },
        },
      };
    },
  });

export const createReadWorkflowTool = (env: Env) =>
  createPrivateTool({
    id: "READ_WORKFLOW",
    description: "Read a workflow",
    inputSchema: z.object({ uri: z.string() }),
    outputSchema: z.object({ workflow: WorkflowDefinitionSchema }),
    execute: async ({ context }) => {
      const { uri } = context;
      const result = await env.WORKFLOWS_MANAGEMENT.DECO_RESOURCE_WORKFLOW_READ(
        { uri },
      );

      // Validate but don't transform - this preserves all fields
      const parsed = WorkflowDefinitionSchema.safeParse(result.data);

      if (!parsed.success) {
        console.error("Workflow validation failed:", parsed.error);
        console.error("Workflow data:", JSON.stringify(result.data, null, 2));

        throw new Error(
          `Workflow validation failed for URI ${uri}. ` +
            `The workflow data structure is invalid or incomplete. ` +
            `Details: ${JSON.stringify(parsed.error.issues, null, 2)}`,
        );
      }

      // Return original data to preserve all fields (including optional ones)
      return {
        workflow: result.data as unknown as z.infer<
          typeof WorkflowDefinitionSchema
        >,
      };
    },
  });

export const createUpdateWorkflowTool = (env: Env) =>
  createPrivateTool({
    id: "UPDATE_WORKFLOW",
    description: "Update a workflow",
    inputSchema: z.object({
      uri: z.string(),
      workflow: WorkflowDefinitionSchema, // Accept any workflow structure to preserve all fields
    }),
    outputSchema: z.object({ workflow: WorkflowDefinitionSchema }),
    execute: async ({ context }) => {
      const { uri, workflow } = context;

      // Validate input workflow structure (but don't transform it)
      const validation = WorkflowDefinitionSchema.safeParse(workflow);
      if (!validation.success) {
        console.warn(
          "⚠️ Workflow structure validation warning:",
          validation.error,
        );
        console.warn("Proceeding with update anyway to preserve all fields...");
      }

      // Send to backend resource management
      await env.WORKFLOWS_MANAGEMENT.DECO_RESOURCE_WORKFLOW_UPDATE({
        uri,
        data: workflow as any, // lmao
      });

      // CRITICAL FIX: Return the INPUT workflow to preserve all fields
      // The backend might strip fields, so we return what we know is correct
      return { workflow };
    },
  });

export const workflowTools = [
  createRunWorkflowStepTool,
  createGenerateStepTool,
  createImportToolAsStepTool,
  createReadWorkflowTool,
  createUpdateWorkflowTool,
];

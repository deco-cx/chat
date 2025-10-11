/**
 * Workflow-related tools
 * Based on plans/01-tool-calls.md
 */

import { createTool } from "@deco/workers-runtime/mastra";
import { z } from "zod";
import type { Env } from "../main.ts";
import type { WorkflowStep } from "../../shared/types/workflows.ts";
import { resolveAtRefsInInput } from "../utils/resolve-refs.ts";
import { buildGenerateStepPrompt } from "../prompts/workflow-generation.ts";

/**
 * Execute a single workflow step
 * Resolves @refs and runs code via DECO_TOOL_RUN_TOOL
 */
export const createRunWorkflowStepTool = (env: Env) =>
  createTool({
    id: "RUN_WORKFLOW_STEP",
    description: "Execute a workflow step with @ref resolution",
    inputSchema: z.object({
      step: z.object({
        id: z.string(),
        name: z.string(),
        code: z.string(),
        inputSchema: z.record(z.unknown()),
        outputSchema: z.record(z.unknown()),
        input: z.record(z.unknown()),
      }),
      // Previous step results for @ref resolution
      previousStepResults: z.record(z.unknown()).optional(),
      // Global workflow input for @input refs
      globalInput: z.record(z.unknown()).optional(),
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
      resolvedInput: z.record(z.any()).optional(),
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
      const { step, previousStepResults, globalInput } = context;

      try {
        // 1. Resolve @refs in input
        const stepResultsMap = new Map(
          Object.entries(previousStepResults || {}),
        );
        const resolutionResult = resolveAtRefsInInput(step.input, {
          workflow: {
            id: "",
            name: "",
            steps: [],
            createdAt: "",
            updatedAt: "",
          },
          stepResults: stepResultsMap,
          globalInput: globalInput || {},
        });

        // If there are resolution errors, return them
        if (resolutionResult.errors && resolutionResult.errors.length > 0) {
          return {
            success: false,
            error: `Failed to resolve @refs: ${resolutionResult.errors.map((e) => e.error).join(", ")}`,
            resolutionErrors: resolutionResult.errors,
            duration: Date.now() - startTime,
          };
        }

        // 2. Execute code via DECO_TOOL_RUN_TOOL
        const result = await env.TOOLS.DECO_TOOL_RUN_TOOL({
          tool: {
            name: step.name,
            description: `Workflow step: ${step.name}`,
            inputSchema: step.inputSchema,
            outputSchema: step.outputSchema,
            execute: step.code,
          },
          input: resolutionResult.resolved,
        });

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
        return {
          success: false,
          error: String(error),
          duration: Date.now() - startTime,
        };
      }
    },
  });

/**
 * Generate a workflow step using AI
 * Gets available integrations and generates code
 */
export const createGenerateStepTool = (env: Env) =>
  createTool({
    id: "GENERATE_STEP",
    description: "Generate a workflow step using AI based on objective",
    inputSchema: z.object({
      objective: z.string().describe("What this step should accomplish"),
      previousSteps: z
        .array(
          z.object({
            id: z.string(),
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
    }),
    outputSchema: z.object({
      step: z.object({
        id: z.string(),
        name: z.string(),
        description: z.string(),
        icon: z.string().optional(),
        code: z.string(),
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
        icon?: string;
        code: string;
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
      const { objective, previousSteps } = context;

      // Build previous steps context with EXACT IDs
      const previousStepsContext = previousSteps?.length
        ? `\n\nPrevious steps available (use @refs with EXACT IDs below):\n${previousSteps
            .map(
              (s) =>
                `- ID: ${s.id}\n  Name: ${s.name}\n  Reference as: @${s.id}.output\n  Output schema: ${JSON.stringify(s.outputSchema)}`,
            )
            .join("\n\n")}`
        : "";

      const prompt = buildGenerateStepPrompt(objective, previousStepsContext);

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
                icon: {
                  type: "string",
                  description:
                    "Material Symbols icon name that represents this step visually (e.g., description for PDF, payments for payment, mail for email, smart_toy for AI, bar_chart for data, search for search, check_circle for validation, database for database, api for API calls, code for code generation)",
                },
                code: {
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
                    "Complete JSON Schema for return value with type, properties, and required array",
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
              },
              required: [
                "id",
                "name",
                "description",
                "code",
                "inputSchema",
                "outputSchema",
                "input",
              ],
            },
            reasoning: {
              type: "string",
              description: "Brief explanation of the approach",
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
        });

        const stepResult = result.object as
          | { step?: WorkflowStep; reasoning?: string }
          | undefined;

        if (!stepResult || !stepResult.step) {
          return {
            step: {
              id: "step-error",
              name: "Error",
              description: "Failed to generate step",
              code: 'export default async function (input, ctx) { return { error: "Generation failed" }; }',
              inputSchema: {},
              outputSchema: {},
              input: {},
            },
            reasoning: "AI generation failed",
          };
        }

        // Ensure we always return the correct type with required fields
        return {
          step: {
            ...stepResult.step,
            description: stepResult.step.description || "No description",
          },
          reasoning: stepResult.reasoning,
        };
      } catch (error) {
        return {
          step: {
            id: "step-error",
            name: "Error",
            description: String(error),
            code:
              'export default async function (input, ctx) { return { error: "' +
              String(error) +
              '" }; }',
            inputSchema: {},
            outputSchema: {},
            input: {},
          },
          reasoning: "Exception during generation: " + String(error),
        };
      }
    },
  });

export const workflowTools = [
  createRunWorkflowStepTool,
  createGenerateStepTool,
];

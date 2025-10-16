/**
 * Custom Views Tools
 *
 * Tools for generating and testing custom views (input and output)
 */

import { createPrivateTool } from "@deco/workers-runtime/mastra";
import { z } from "zod";
// @ts-ignore - Generated file
import type { Env } from "../shared/deco.gen.ts";

/**
 * Generate custom OUTPUT view for a specific step
 * Uses actual output data to create contextual view
 */
export const createGenerateStepOutputViewTool = (env: Env) =>
  createPrivateTool({
    id: "GENERATE_STEP_OUTPUT_VIEW",
    description:
      "Generate a custom output view for a specific workflow step using AI",
    inputSchema: z.object({
      stepId: z.string().describe("Step ID"),
      stepName: z.string().describe("Step name for context"),
      outputSchema: z.record(z.unknown()).describe("Output JSON Schema"),
      outputSample: z
        .string()
        .describe("First 100 chars of actual output data"),
      viewName: z.string().describe("View name (view1, view2, etc)"),
      purpose: z
        .string()
        .describe(
          "What this view should emphasize or how it should display data",
        ),
    }),
    outputSchema: z.object({
      viewCode: z.string().describe("Complete HTML with inline CSS and JS"),
      reasoning: z.string().describe("Explanation of design choices"),
    }),
    execute: async ({ context }) => {
      // Import schema and template
      const { OUTPUT_VIEW_GENERATION_SCHEMA, OUTPUT_VIEW_PROMPT_TEMPLATE } =
        await import("../schemas/output-view-generation.ts");

      const prompt = OUTPUT_VIEW_PROMPT_TEMPLATE(
        context.stepName,
        context.outputSchema,
        context.outputSample,
        context.purpose,
      );

      const result = await env.AI_GATEWAY.AI_GENERATE_OBJECT({
        model: "anthropic:claude-sonnet-4-5",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        schema: OUTPUT_VIEW_GENERATION_SCHEMA,
        temperature: 0.4,
      });

      if (!result.object) {
        console.error("❌ [GENERATE_STEP_OUTPUT_VIEW] No object in result");
        throw new Error("Failed to generate output view");
      }

      const viewCode = result.object.viewCode as string;
      const reasoning = result.object.reasoning as string;

      return { viewCode, reasoning };
    },
  });

/**
 * Generate custom INPUT view for a specific step field
 * Uses previous step data to populate options dynamically
 */
export const createGenerateStepInputViewTool = (env: Env) =>
  createPrivateTool({
    id: "GENERATE_STEP_INPUT_VIEW",
    description:
      "Generate a custom input view for a specific workflow step field using AI",
    inputSchema: z.object({
      stepId: z.string().describe("Step ID"),
      fieldName: z.string().describe("Field name from input schema"),
      fieldSchema: z.record(z.unknown()).describe("Field JSON Schema"),
      previousStepId: z
        .string()
        .optional()
        .describe("Optional previous step ID to use its output data"),
      previousStepOutput: z
        .string()
        .optional()
        .describe("First 200 chars of previous step output (for context)"),
      viewName: z.string().describe("View name (view1, view2, etc)"),
      purpose: z
        .string()
        .describe(
          "What this input view should do (e.g., 'dropdown with search', 'multi-select')",
        ),
    }),
    outputSchema: z.object({
      viewCode: z.string().describe("Complete HTML with inline CSS and JS"),
      reasoning: z.string().describe("Explanation of design choices"),
    }),
    execute: async ({ context }) => {
      // Import schema and template
      const { INPUT_VIEW_GENERATION_SCHEMA, INPUT_VIEW_PROMPT_TEMPLATE } =
        await import("../schemas/input-view-generation.ts");

      const prompt = INPUT_VIEW_PROMPT_TEMPLATE(
        context.fieldName,
        context.fieldSchema,
        context.previousStepOutput,
        context.purpose,
      );

      const result = await env.AI_GATEWAY.AI_GENERATE_OBJECT({
        model: "anthropic:claude-sonnet-4-5",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        schema: INPUT_VIEW_GENERATION_SCHEMA,
        temperature: 0.4,
      });

      if (!result.object) {
        console.error("❌ [GENERATE_STEP_INPUT_VIEW] No object in result");
        throw new Error("Failed to generate input view");
      }

      const viewCode = result.object.viewCode as string;
      const reasoning = result.object.reasoning as string;

      return { viewCode, reasoning };
    },
  });

// Export all view tools
export const viewTools = [
  createGenerateStepOutputViewTool,
  createGenerateStepInputViewTool,
];

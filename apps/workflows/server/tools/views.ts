/**
 * Custom Views Tools
 *
 * Tools for generating and testing custom views (input and output)
 */

import { createTool } from "@deco/workers-runtime/mastra";
import { z } from "zod";
// @ts-ignore - Generated file
import type { Env } from "../deco.gen.ts";
import {
  ViewDefinitionSchema,
  type ViewDefinition,
} from "../../shared/types/views.ts";

/**
 * Generate a custom view definition using AI
 */
export const createGenerateViewTool = (env: Env) =>
  createTool({
    id: "GENERATE_VIEW",
    description:
      "Generate a custom input or output view definition using AI. Returns a JSON structure that can be rendered as UI components.",
    inputSchema: z.object({
      purpose: z
        .string()
        .describe(
          "What is this view for? (e.g., 'Display payment information', 'Input form for user data')",
        ),
      viewType: z
        .enum(["input", "output"])
        .describe("Type of view to generate"),
      dataSchema: z
        .record(z.unknown())
        .describe("JSON Schema of the data this view will handle"),
      designPreference: z
        .string()
        .optional()
        .describe("Any specific design preferences or requirements"),
    }),
    outputSchema: z.object({
      view: ViewDefinitionSchema,
      reasoning: z.string(),
      exampleData: z.record(z.unknown()).optional(),
    }),
    execute: async ({ context }) => {
      console.log("[GENERATE_VIEW] Generating view:", {
        purpose: context.purpose,
        viewType: context.viewType,
      });

      const VIEW_GENERATION_SCHEMA = {
        type: "object",
        properties: {
          view: {
            type: "object",
            description: "ViewDefinition object following the schema",
          },
          reasoning: {
            type: "string",
            description: "Brief explanation of the view design choices",
          },
          exampleData: {
            type: "object",
            description:
              "Example data object that matches the dataSchema (optional)",
          },
        },
        required: ["view", "reasoning"],
      };

      const prompt = `Generate a ${context.viewType} view definition using the ViewDefinition schema.

PURPOSE: ${context.purpose}

DATA SCHEMA:
${JSON.stringify(context.dataSchema, null, 2)}

${context.designPreference ? `DESIGN PREFERENCE: ${context.designPreference}` : ""}

ViewDefinition Schema:
- Available types: container, text, heading, card, table, list, badge, button, input, select, file-upload, code, divider
- Use "data" field to reference data paths (e.g., "result.title", "items", "status")
- Use "style" for variants and layout options
- Nest components using "children"

Design System Colors (via style.variant):
- primary: Main UI elements (#242424 bg, #3a3a3a border)
- secondary: Secondary elements (#2a2a2a bg)
- success: Successful states (#2d5f4f / green)
- warning: Warning states (#d4af37 / gold)
- error: Error states (#6b1b29 / red)
- info: Informational (#ff6b4a / orange)

${
  context.viewType === "input"
    ? `
For INPUT views:
- Use input, select, file-upload, button components
- Set "name" prop to match schema field names
- Add labels and placeholders for user guidance
- Include a submit button at the end with action: "submit"
- Use layout: "vertical" for forms
- Example:
{
  "type": "container",
  "style": { "layout": "vertical", "gap": 4 },
  "children": [
    {
      "type": "heading",
      "props": { "level": 3 },
      "children": ["Form Title"]
    },
    {
      "type": "input",
      "props": {
        "name": "fieldName",
        "label": "Field Label",
        "placeholder": "Enter value",
        "type": "text"
      }
    },
    {
      "type": "button",
      "props": {
        "label": "Submit",
        "action": "submit"
      },
      "style": { "variant": "primary" }
    }
  ]
}
`
    : `
For OUTPUT views:
- Use card, table, list, badge for data display
- Use "data" field to reference output data paths
- Create visually organized layouts with cards
- Highlight important information with badges
- Use tables for structured data arrays
- Example:
{
  "type": "container",
  "style": { "layout": "vertical", "gap": 4 },
  "children": [
    {
      "type": "heading",
      "props": { "level": 2 },
      "data": "title"
    },
    {
      "type": "card",
      "style": { "variant": "primary" },
      "children": [
        {
          "type": "text",
          "data": "description"
        },
        {
          "type": "badge",
          "style": { "variant": "success" },
          "data": "status"
        }
      ]
    },
    {
      "type": "table",
      "props": {
        "columns": [
          { "key": "name", "label": "Name" },
          { "key": "value", "label": "Value", "render": "badge" }
        ],
        "data": "items"
      }
    }
  ]
}
`
}

Generate a complete, well-structured view that makes the data easy to ${context.viewType === "input" ? "input" : "understand"}.

Also generate exampleData that matches the dataSchema to demonstrate the view.`;

      try {
        const result = await env.AI_GATEWAY.AI_GENERATE_OBJECT({
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          schema: VIEW_GENERATION_SCHEMA,
          model: "gpt-4o-mini",
          temperature: 0.3,
        });

        if (!result.object) {
          throw new Error("Failed to generate view definition");
        }

        console.log("[GENERATE_VIEW] View generated successfully");

        return {
          view: result.object.view as ViewDefinition,
          reasoning: result.object.reasoning as string,
          exampleData: result.object.exampleData as
            | Record<string, unknown>
            | undefined,
        };
      } catch (error) {
        console.error("[GENERATE_VIEW] Error:", error);
        throw new Error(`Failed to generate view: ${String(error)}`);
      }
    },
  });

/**
 * Validate a view definition
 */
export const createValidateViewTool = (_env: Env) =>
  createTool({
    id: "VALIDATE_VIEW",
    description: "Validate a view definition structure and provide feedback",
    inputSchema: z.object({
      view: z.record(z.unknown()).describe("View definition to validate"),
    }),
    outputSchema: z.object({
      valid: z.boolean(),
      errors: z.array(z.string()).optional(),
      warnings: z.array(z.string()).optional(),
    }),
    execute: async ({ context }) => {
      console.log("[VALIDATE_VIEW] Validating view definition");

      try {
        // Validate with Zod schema
        ViewDefinitionSchema.parse(context.view);

        console.log("[VALIDATE_VIEW] View is valid");
        return {
          valid: true,
          errors: undefined,
          warnings: undefined,
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          const errors = error.errors.map(
            (e) => `${e.path.join(".")}: ${e.message}`,
          );
          console.log("[VALIDATE_VIEW] Validation failed:", errors);
          return {
            valid: false,
            errors,
            warnings: undefined,
          };
        }

        return {
          valid: false,
          errors: [String(error)],
          warnings: undefined,
        };
      }
    },
  });

/**
 * Get example view definitions
 */
export const createGetViewExamplesTool = (_env: Env) =>
  createTool({
    id: "GET_VIEW_EXAMPLES",
    description: "Get example view definitions for different use cases",
    inputSchema: z.object({
      viewType: z.enum(["input", "output", "both"]).optional().default("both"),
    }),
    outputSchema: z.object({
      examples: z.array(
        z.object({
          name: z.string(),
          description: z.string(),
          viewType: z.enum(["input", "output"]),
          view: ViewDefinitionSchema,
          exampleData: z.record(z.unknown()).optional(),
        }),
      ),
    }),
    execute: async ({
      context,
    }): Promise<{
      examples: Array<{
        name: string;
        description: string;
        viewType: "input" | "output";
        view: ViewDefinition;
        exampleData?: Record<string, unknown>;
      }>;
    }> => {
      console.log("[GET_VIEW_EXAMPLES] Fetching examples");

      const examples: Array<{
        name: string;
        description: string;
        viewType: "input" | "output";
        view: ViewDefinition;
        exampleData?: Record<string, unknown>;
      }> = [];

      if (context.viewType === "output" || context.viewType === "both") {
        examples.push(
          {
            name: "Simple Data Display",
            description: "Display title, description and status badge",
            viewType: "output",
            view: {
              type: "container",
              style: { layout: "vertical", gap: 4 },
              children: [
                {
                  type: "heading",
                  props: { level: 2 },
                  data: "title",
                },
                {
                  type: "card",
                  style: { variant: "primary" },
                  children: [
                    {
                      type: "text",
                      data: "description",
                    },
                    {
                      type: "badge",
                      style: { variant: "success" },
                      data: "status",
                    },
                  ],
                },
              ],
            } as ViewDefinition,
            exampleData: {
              title: "Example Title",
              description: "This is a description",
              status: "completed",
            },
          },
          {
            name: "Data Table",
            description: "Display array of data in a table",
            viewType: "output",
            view: {
              type: "container",
              style: { layout: "vertical", gap: 4 },
              children: [
                {
                  type: "heading",
                  props: { level: 3 },
                  children: ["Results"],
                },
                {
                  type: "table",
                  props: {
                    columns: [
                      { key: "name", label: "Name" },
                      { key: "value", label: "Value" },
                      { key: "status", label: "Status", render: "badge" },
                    ],
                    data: "items",
                  },
                },
              ],
            } as ViewDefinition,
            exampleData: {
              items: [
                { name: "Item 1", value: "100", status: "active" },
                { name: "Item 2", value: "200", status: "inactive" },
              ],
            },
          },
          {
            name: "Multi-Card Layout",
            description: "Multiple cards with different variants",
            viewType: "output",
            view: {
              type: "container",
              style: { layout: "vertical", gap: 4 },
              children: [
                {
                  type: "card",
                  style: { variant: "success" },
                  children: [
                    {
                      type: "heading",
                      props: { level: 4 },
                      children: ["Success"],
                    },
                    {
                      type: "text",
                      data: "successMessage",
                    },
                  ],
                },
                {
                  type: "card",
                  style: { variant: "warning" },
                  children: [
                    {
                      type: "heading",
                      props: { level: 4 },
                      children: ["Warning"],
                    },
                    {
                      type: "text",
                      data: "warningMessage",
                    },
                  ],
                },
              ],
            } as ViewDefinition,
            exampleData: {
              successMessage: "Operation completed successfully",
              warningMessage: "Some issues were found",
            },
          },
        );
      }

      if (context.viewType === "input" || context.viewType === "both") {
        examples.push(
          {
            name: "Simple Form",
            description: "Basic input form with text and select",
            viewType: "input",
            view: {
              type: "container",
              style: { layout: "vertical", gap: 4 },
              children: [
                {
                  type: "heading",
                  props: { level: 3 },
                  children: ["User Information"],
                },
                {
                  type: "input",
                  props: {
                    name: "name",
                    label: "Name",
                    placeholder: "Enter your name",
                    type: "text",
                  },
                },
                {
                  type: "input",
                  props: {
                    name: "email",
                    label: "Email",
                    placeholder: "you@example.com",
                    type: "email",
                  },
                },
                {
                  type: "select",
                  props: {
                    name: "role",
                    label: "Role",
                    options: [
                      { value: "admin", label: "Administrator" },
                      { value: "user", label: "User" },
                    ],
                  },
                },
                {
                  type: "button",
                  props: {
                    label: "Submit",
                    action: "submit",
                  },
                  style: { variant: "primary" },
                },
              ],
            } as ViewDefinition,
          },
          {
            name: "File Upload Form",
            description: "Form with file upload",
            viewType: "input",
            view: {
              type: "container",
              style: { layout: "vertical", gap: 4 },
              children: [
                {
                  type: "heading",
                  props: { level: 3 },
                  children: ["Upload Document"],
                },
                {
                  type: "file-upload",
                  props: {
                    name: "file",
                    label: "Select file",
                    accept: "application/pdf,image/*",
                  },
                },
                {
                  type: "input",
                  props: {
                    name: "description",
                    label: "Description",
                    placeholder: "Describe the document",
                    type: "text",
                  },
                },
                {
                  type: "button",
                  props: {
                    label: "Upload",
                    action: "submit",
                  },
                  style: { variant: "primary" },
                },
              ],
            } as ViewDefinition,
          },
        );
      }

      console.log(`[GET_VIEW_EXAMPLES] Returning ${examples.length} examples`);
      return { examples };
    },
  });

/**
 * Generate custom OUTPUT view for a specific step
 * Uses actual output data to create contextual view
 */
export const createGenerateStepOutputViewTool = (env: Env) =>
  createTool({
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
      console.log("🎨 [GENERATE_STEP_OUTPUT_VIEW] Generating view...");
      console.log("🎨 [GENERATE_STEP_OUTPUT_VIEW] Step:", context.stepName);
      console.log("🎨 [GENERATE_STEP_OUTPUT_VIEW] Purpose:", context.purpose);
      console.log(
        "🎨 [GENERATE_STEP_OUTPUT_VIEW] Output sample:",
        context.outputSample,
      );

      // Import schema and template
      const { OUTPUT_VIEW_GENERATION_SCHEMA, OUTPUT_VIEW_PROMPT_TEMPLATE } =
        await import("../schemas/output-view-generation.ts");

      const prompt = OUTPUT_VIEW_PROMPT_TEMPLATE(
        context.stepName,
        context.outputSchema,
        context.outputSample,
        context.purpose,
      );

      console.log(
        "🎨 [GENERATE_STEP_OUTPUT_VIEW] Prompt length:",
        prompt.length,
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

      console.log("🎨 [GENERATE_STEP_OUTPUT_VIEW] AI response received");

      if (!result.object) {
        console.error("❌ [GENERATE_STEP_OUTPUT_VIEW] No object in result");
        throw new Error("Failed to generate output view");
      }

      const viewCode = result.object.viewCode as string;
      const reasoning = result.object.reasoning as string;

      console.log(
        "✅ [GENERATE_STEP_OUTPUT_VIEW] View generated, length:",
        viewCode.length,
      );
      console.log("✅ [GENERATE_STEP_OUTPUT_VIEW] Reasoning:", reasoning);

      return { viewCode, reasoning };
    },
  });

/**
 * Generate custom INPUT view for a specific step field
 * Uses previous step data to populate options dynamically
 */
export const createGenerateStepInputViewTool = (env: Env) =>
  createTool({
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
      console.log("📝 [GENERATE_STEP_INPUT_VIEW] Generating input view...");
      console.log("📝 [GENERATE_STEP_INPUT_VIEW] Field:", context.fieldName);
      console.log("📝 [GENERATE_STEP_INPUT_VIEW] Purpose:", context.purpose);
      console.log(
        "📝 [GENERATE_STEP_INPUT_VIEW] Previous step:",
        context.previousStepId || "None",
      );

      // Import schema and template
      const { INPUT_VIEW_GENERATION_SCHEMA, INPUT_VIEW_PROMPT_TEMPLATE } =
        await import("../schemas/input-view-generation.ts");

      const prompt = INPUT_VIEW_PROMPT_TEMPLATE(
        context.fieldName,
        context.fieldSchema,
        context.previousStepOutput,
        context.purpose,
      );

      console.log(
        "📝 [GENERATE_STEP_INPUT_VIEW] Prompt length:",
        prompt.length,
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

      console.log("📝 [GENERATE_STEP_INPUT_VIEW] AI response received");

      if (!result.object) {
        console.error("❌ [GENERATE_STEP_INPUT_VIEW] No object in result");
        throw new Error("Failed to generate input view");
      }

      const viewCode = result.object.viewCode as string;
      const reasoning = result.object.reasoning as string;

      console.log(
        "✅ [GENERATE_STEP_INPUT_VIEW] View generated, length:",
        viewCode.length,
      );
      console.log("✅ [GENERATE_STEP_INPUT_VIEW] Reasoning:", reasoning);

      return { viewCode, reasoning };
    },
  });

// Export all view tools
export const viewTools = [
  createGenerateViewTool,
  createValidateViewTool,
  createGetViewExamplesTool,
  createGenerateStepOutputViewTool,
  createGenerateStepInputViewTool,
];

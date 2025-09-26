import { useMutation } from "@tanstack/react-query";
import { useSDK } from "./store.tsx";
import { upsertWorkflow } from "./resources-workflow.ts";
import type {
  JSONSchema,
  Workflow,
  WorkflowStep,
} from "../mcp/workflows/schemas.ts";

/**
 * Hook to create a new workflow with initial state
 */
export function useCreateWorkflow() {
  const { locator } = useSDK();

  return useMutation({
    mutationFn: async (name: string): Promise<Workflow> => {
      const now = new Date().toISOString();

      // Create initial workflow structure with schemas
      const inputSchema: JSONSchema = {
        type: "object",
        properties: {},
        required: [],
      };

      const outputSchema: JSONSchema = {
        type: "object",
        properties: {},
        required: [],
      };

      // Create an initial "welcome" step to satisfy the minimum requirement
      const initialStep: WorkflowStep = {
        id: "step-welcome",
        title: "Welcome Step",
        description:
          "This is your first workflow step. Edit it to define what this step should do.",
        prompt:
          "Click 'Edit Step' to describe what this step should accomplish",
        code: `export default async function(ctx) {
  // This is a placeholder step
  // Edit this step to define your workflow logic
  
  // You can access workflow input:
  // const input = await ctx.readWorkflowInput();
  
  // You can access previous step results:
  // const previousResult = await ctx.getStepResult("step-name");

  // You can sleep for a duration:
  // await ctx.sleep("step-name", 1000);

  // You can sleep until a specific date:
  // await ctx.sleepUntil("step-name", new Date("2025-01-01"));
  
  // Return the result for the next step
  return {
    message: "Welcome to your new workflow!",
    timestamp: new Date().toISOString()
  };
}`,
        inputSchema: inputSchema,
        outputSchema: outputSchema,
        usedTools: [],
      };

      // Convert to backend format (old schema)
      const backendStep = {
        type: "code" as const,
        def: {
          name: initialStep.title,
          description: initialStep.description,
          execute: initialStep.code,
        },
      };

      const initialWorkflow = {
        name,
        description: `Workflow created on ${new Date().toLocaleDateString()}`,
        inputSchema: inputSchema as Record<string, unknown>,
        outputSchema: outputSchema as Record<string, unknown>,
        steps: [backendStep], // Include the initial step
      };

      // Save to backend (Resources v2)
      await upsertWorkflow(locator, initialWorkflow);

      // Return the new workflow in the new format
      return {
        id: `workflow-${name}`,
        name,
        description: initialWorkflow.description,
        inputSchema,
        outputSchema,
        steps: [initialStep], // Include the initial step in the new format
        executionState: {},
        createdAt: now,
        updatedAt: now,
      };
    },
  });
}

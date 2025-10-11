/**
 * Runtime API - Execute workflows, steps, and discover tools
 * Wrapper around RPC client for cleaner imports
 */

import { client } from "./rpc";
import type { WorkflowStep } from "../types/workflow";

/**
 * Discover all available tools and integrations
 */
export async function discoverTools() {
  try {
    const result = await client.DISCOVER_WORKSPACE_TOOLS({
      includeSchemas: true,
    });
    return result;
  } catch (error) {
    console.error("Failed to discover tools:", error);
    throw error;
  }
}

/**
 * Generate a new workflow step using AI
 */
export async function generateStep(params: {
  objective: string;
  previousSteps?: Array<{
    id: string;
    title: string;
    outputSchema?: Record<string, unknown>;
  }>;
}) {
  try {
    // Map title to name for the API
    const mappedSteps = params.previousSteps?.map((step) => ({
      id: step.id,
      name: step.title,
      outputSchema: step.outputSchema || {},
    }));

    const result = await client.GENERATE_STEP({
      objective: params.objective,
      previousSteps: mappedSteps,
    });
    return result;
  } catch (error) {
    console.error("Failed to generate step:", error);
    throw error;
  }
}

/**
 * Execute a single workflow step
 */
export async function executeStep(params: {
  step: WorkflowStep;
  previousStepResults?: Record<string, unknown>;
  globalInput?: Record<string, unknown>;
}) {
  try {
    const result = await client.RUN_WORKFLOW_STEP({
      step: {
        id: params.step.id,
        name: params.step.title, // Map title to name
        code: params.step.code || "",
        inputSchema: params.step.inputSchema || {},
        outputSchema: params.step.outputSchema || {},
        input: params.step.input || {},
      },
      previousStepResults: params.previousStepResults,
      globalInput: params.globalInput,
    });
    return result;
  } catch (error) {
    console.error("Failed to execute step:", error);
    throw error;
  }
}

/**
 * Execute an entire workflow
 */
export async function executeWorkflow(params: {
  workflow: {
    id: string;
    name: string;
    steps: WorkflowStep[];
  };
  input?: Record<string, unknown>;
  onStepUpdate?: (stepId: string, result: unknown) => void;
}) {
  const { workflow, input = {}, onStepUpdate } = params;
  const stepResults: Record<string, unknown> = {};

  for (const step of workflow.steps) {
    try {
      const result = await executeStep({
        step,
        previousStepResults: stepResults,
        globalInput: input,
      });

      stepResults[step.id] = result.output;

      if (onStepUpdate) {
        onStepUpdate(step.id, result);
      }

      if (!result.success) {
        throw new Error(`Step ${step.id} failed: ${result.error}`);
      }
    } catch (error) {
      console.error(`Workflow failed at step ${step.id}:`, error);
      throw error;
    }
  }

  return stepResults;
}

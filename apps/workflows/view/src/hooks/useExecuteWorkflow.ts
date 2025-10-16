/**
 * useExecuteWorkflow - Execute full workflow sequentially
 * Uses runtime.ts for execution
 */

import { useMutation } from "@tanstack/react-query";
import { executeWorkflow } from "../lib/runtime";
import type { WorkflowStep } from "../types/workflow";

interface ExecuteWorkflowInput {
  workflowId: string;
  steps: WorkflowStep[];
}

interface ExecuteWorkflowOutput {
  success: boolean;
  completedSteps: number;
  results: Array<{
    stepId: string;
    success: boolean;
    output?: unknown;
    error?: string;
    duration: number;
  }>;
  totalDuration: number;
}

export function useExecuteWorkflow(
  onStepUpdate?: (
    stepId: string,
    status: "active" | "completed" | "error",
    output?: unknown,
  ) => void,
) {
  return useMutation({
    mutationFn: async (
      input: ExecuteWorkflowInput,
    ): Promise<ExecuteWorkflowOutput> => {
      return await executeWorkflow({
        steps: input.steps,
        onStepUpdate,
      });
    },
  });
}

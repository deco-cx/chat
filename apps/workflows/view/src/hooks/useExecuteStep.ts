/**
 * useExecuteStep - Execute a single workflow step
 * Uses runtime.ts for execution
 */

import { useMutation } from "@tanstack/react-query";
import { executeStep } from "../lib/runtime";
import type { ExecuteStepParams, ExecuteStepResult } from "../types/workflow";

export function useExecuteStep() {
  return useMutation({
    mutationFn: async (
      input: ExecuteStepParams,
    ): Promise<ExecuteStepResult> => {
      return await executeStep(input);
    },
  });
}

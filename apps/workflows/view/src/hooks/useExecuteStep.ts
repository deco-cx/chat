/**
 * useExecuteStep - Execute a single workflow step
 * Uses runtime.ts for execution
 */

import { useMutation } from "@tanstack/react-query";
import { client } from "@/lib/rpc";

type ExecuteStepParams = Parameters<typeof client.RUN_WORKFLOW_STEP>[0];
type ExecuteStepResult = ReturnType<typeof client.RUN_WORKFLOW_STEP>;

export function useExecuteStep() {
  return useMutation({
    mutationFn: async (
      input: ExecuteStepParams,
    ): Promise<ExecuteStepResult> => {
      return await client.RUN_WORKFLOW_STEP(input);
    },
  });
}

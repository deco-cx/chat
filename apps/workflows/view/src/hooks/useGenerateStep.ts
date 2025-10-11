/**
 * useGenerateStep - Generate workflow step using AI
 * Uses runtime.ts for execution
 */

import { useMutation } from "@tanstack/react-query";
import { generateStep } from "../lib/runtime";
import type { GenerateStepInput, GenerateStepOutput } from "../types/workflow";

export function useGenerateStep() {
  return useMutation({
    mutationFn: async (
      input: GenerateStepInput,
    ): Promise<GenerateStepOutput> => {
      return await generateStep(input);
    },
  });
}

/**
 * Hook for GENERATE_STEP_INPUT_VIEW
 *
 * Generates custom input views for workflow step fields
 */

import { useMutation } from "@tanstack/react-query";

interface GenerateInputViewInput {
  stepId: string;
  fieldName: string;
  fieldSchema: Record<string, unknown>;
  previousStepId?: string;
  previousStepOutput?: string;
  viewName: string;
  purpose: string;
}

export function useGenerateInputView() {
  return useMutation({
    mutationFn: async (input: GenerateInputViewInput) => {
      console.log(
        "📝 [Hook] Generating input view for field:",
        input.fieldName,
      );

      // Direct fetch call (works without generated types)
      const response = await fetch("/mcp/call-tool/GENERATE_STEP_INPUT_VIEW", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to generate input view: ${response.statusText}`,
        );
      }

      const result = await response.json();

      console.log("✅ [Hook] Input view generated");

      return result as { viewCode: string; reasoning: string };
    },
  });
}

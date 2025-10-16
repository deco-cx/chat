/**
 * Hook for GENERATE_STEP_OUTPUT_VIEW
 *
 * Note: Uses fetch directly since types not generated yet
 * Run: DECO_SELF_URL=<dev-url> npm run gen:self to get typed client
 */

import { useMutation } from "@tanstack/react-query";

interface GenerateOutputViewInput {
  stepId: string;
  stepName: string;
  outputSchema: Record<string, unknown>;
  outputSample: string;
  viewName: string;
  purpose: string;
}

export function useGenerateOutputView() {
  return useMutation({
    mutationFn: async (input: GenerateOutputViewInput) => {
      // Direct fetch call (works without generated types)
      const response = await fetch("/mcp/call-tool/GENERATE_STEP_OUTPUT_VIEW", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        throw new Error(`Failed to generate view: ${response.statusText}`);
      }

      const result = await response.json();
      return result as { viewCode: string; reasoning: string };
    },
  });
}

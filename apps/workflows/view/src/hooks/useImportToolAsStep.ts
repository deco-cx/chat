/**
 * Hook to import a tool as a workflow step (without AI generation)
 *
 * Generates code that directly calls the specified tool
 */

import { useMutation } from "@tanstack/react-query";
import { client } from "../lib/rpc";

export interface ImportToolParams {
  toolName: string;
  integrationId: string;
  integrationName: string;
  toolDescription?: string;
  inputSchema?: any;
  outputSchema?: any;
}

export const useImportToolAsStep = () => {
  return useMutation({
    mutationFn: async (params: ImportToolParams) => {
      // @ts-ignore - IMPORT_TOOL_AS_STEP will be available after npm run gen:self
      const result = await client.IMPORT_TOOL_AS_STEP({
        toolName: params.toolName,
        integrationId: params.integrationId,
        integrationName: params.integrationName,
        toolDescription: params.toolDescription,
        inputSchema: params.inputSchema,
        outputSchema: params.outputSchema,
      });

      return result.step as any;
    },
  });
};

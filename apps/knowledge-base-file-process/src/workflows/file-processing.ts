import { createWorkflow } from "@deco/workers-runtime/mastra";
import { WorkflowInputSchema, WorkflowOutputSchema } from "../types/schemas.ts";
import { combinedFileProcessingStep } from "../steps/combined-file-processing.ts";

export const createFileProcessingWorkflow = () =>
  createWorkflow({
    id: "FILE_PROCESSING",
    description:
      "Process files for knowledge base with combined processing step to avoid large data transfers",
    inputSchema: WorkflowInputSchema,
    outputSchema: WorkflowOutputSchema,
  })
    // Combined step: Process file, generate embeddings, and store vectors
    .dowhile(combinedFileProcessingStep, ({ inputData }) => {
      return Promise.resolve(inputData.hasMore);
    })
    .commit();

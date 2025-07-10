import { createStep } from "@deco/workers-runtime/mastra";
import { z } from "zod";
import { FileProcessor } from "@deco/sdk/mcp";
import { WorkflowInputSchema } from "../types/schemas.ts";
import { bailWorkflowAndUpdateFileStatus } from "../utils/workflow-error-handler.ts";

export const ProcessFileOutputSchema = z.object({
  chunks: z.array(z.object({
    text: z.string(),
    metadata: z.record(z.string(), z.string()),
  })),
  fileMetadata: z.record(z.string(), z.any()),
});

export const processFileStep = createStep({
  id: "PROCESS_FILE",
  inputSchema: WorkflowInputSchema,
  outputSchema: ProcessFileOutputSchema,
  async execute(context) {
    const { fileUrl, path, filename, metadata } = context.inputData;

    try {
      console.log("File processor created");

      // Create file processor instance
      const fileProcessor = new FileProcessor({
        chunkSize: 500,
        chunkOverlap: 50,
      });

      // Process the file directly from URL using FileProcessor
      console.log("Processing file", fileUrl);
      const processedFile = await fileProcessor.processFile(fileUrl);

      // Create file metadata combining all sources
      const fileMetadata = {
        ...metadata,
        ...processedFile.metadata,
        ...(path ? { path } : { fileUrl }),
      };

      // Convert chunks to the expected format with enriched metadata
      const enrichedChunks = processedFile.chunks.map((chunk, index) => ({
        text: chunk.text,
        metadata: {
          ...fileMetadata,
          ...chunk.metadata,
          chunkIndex: index,
        },
      }));

      return {
        chunks: enrichedChunks,
        fileMetadata,
      };
    } catch (error) {
      console.error(`Failed to process file ${path || filename || fileUrl}:`, error);
      await bailWorkflowAndUpdateFileStatus(context, {
        message: `File processing failed: ${error instanceof Error ? error.message : String(error)}`,
      });

      // This will never be reached due to context.bail(), but TypeScript needs it
      throw error;
    }
  },
});
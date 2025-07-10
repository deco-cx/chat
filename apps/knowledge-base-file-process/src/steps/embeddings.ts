import { createStep } from "@deco/workers-runtime/mastra";
import { z } from "zod";
import { embedMany } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { bailWorkflowAndUpdateFileStatus } from "../utils/workflow-error-handler.ts";
import { ProcessFileOutputSchema } from "./file-processing.ts";

export const BatchEmbeddingsOutputSchema = z.object({
  embeddings: z.array(z.number()).array(),
  docIds: z.array(z.string()),
  chunks: ProcessFileOutputSchema.shape.chunks,
  itemsProcessed: z.number(),
});

// Step to generate embeddings using embedMany (which handles batching internally)
export const batchEmbeddingsStep = createStep({
  id: "BATCH_EMBEDDINGS", 
  inputSchema: ProcessFileOutputSchema,
  outputSchema: BatchEmbeddingsOutputSchema,
  async execute(context) {
    const { chunks } = context.inputData;
    const env = context.runtimeContext.get("env") as any;

    try {
      console.log("Embedding chunks", context.getInitData<typeof WorkflowInputSchema>().fileUrl);
      // Create OpenAI client and embedder
      const openai = createOpenAI({
        apiKey: env.OPENAI_API_KEY,
      });
      const embedder = openai.embedding("text-embedding-3-small");

      // Generate docIds for items that don't have one
      const itemsWithIds = chunks.map((chunk) => ({
        content: chunk.text,
        metadata: chunk.metadata,
        docId: crypto.randomUUID(),
      }));

      // Create embeddings for all items using embedMany (handles batching internally)
      const { embeddings } = await embedMany({
        model: embedder,
        values: itemsWithIds.map((item) => item.content),
      });

      const docIds = itemsWithIds.map((item) => item.docId);

      return {
        embeddings,
        docIds,
        chunks, // Pass through original chunks
        itemsProcessed: embeddings.length,
      };
    } catch (error) {
      console.error('Embedding generation failed:', error);
      await bailWorkflowAndUpdateFileStatus(context, {
        message: `Embedding generation failed: ${error instanceof Error ? error.message : String(error)}`,
      });
      
      // This will never be reached due to context.bail(), but TypeScript needs it
      throw error;
    }
  },
});
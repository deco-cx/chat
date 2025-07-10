import { createStep } from "@deco/workers-runtime/mastra";
import { z } from "zod";
import { WorkflowInputSchema } from "../types/schemas.ts";
import { bailWorkflowAndUpdateFileStatus } from "../utils/workflow-error-handler.ts";
import { KNOWLEDGE_BASE_GROUP } from "@deco/sdk/constants";
import { WorkspaceMemory } from "@deco/sdk/memory";
import { BatchEmbeddingsOutputSchema } from "./embeddings.ts";

/**
 * Get vector client for the workspace
 */
async function getVectorClient(env: any, workspace: string) {
  const mem = await WorkspaceMemory.create({
    workspace: workspace as any, // Cast to avoid type issues in workflow context
    tursoAdminToken: env.TURSO_ADMIN_TOKEN,
    tursoOrganization: env.TURSO_ORGANIZATION,
    tokenStorage: env.TURSO_GROUP_DATABASE_TOKEN,
    openAPIKey: env.OPENAI_API_KEY,
    discriminator: KNOWLEDGE_BASE_GROUP,
    options: { semanticRecall: true },
  });

  const vector = mem.vector;
  if (!vector) {
    throw new Error("Missing vector client");
  }
  return vector;
}

const DEFAULT_VECTOR_BATCH_SIZE = 25;

/**
 * Get vector batch size from environment variable or use default
 */
const getVectorBatchSize = (env: any): number => {
  const envBatchSize = env.VECTOR_BATCH_SIZE;
  if (envBatchSize) {
    const parsed = parseInt(envBatchSize, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return DEFAULT_VECTOR_BATCH_SIZE;
};

export const BatchStoreVectorOutputSchema = z.object({
  docIds: z.array(z.string()),
});

// Step to batch store vectors (for large datasets)
export const batchStoreVectorStep = createStep({
  id: "BATCH_STORE_VECTORS",
  inputSchema: BatchEmbeddingsOutputSchema,
  outputSchema: BatchStoreVectorOutputSchema,
  async execute(context) {
    const { embeddings, chunks } = context.inputData;
    const input = context.getInitData<typeof WorkflowInputSchema>();
    const knowledgeBaseName = input.knowledgeBaseName;
    const env = context.runtimeContext.get("env") as any;
    const batchSize = getVectorBatchSize(env);

    const allStoredIds: string[] = [];
    const vector = await getVectorClient(env, input.workspace);

    try {

      console.log("Upserting in vector chunks", context.getInitData<typeof WorkflowInputSchema>().fileUrl);
      // Get vector client using the same approach as knowledge/api.ts

      // Ensure the vector index exists

      // Process vectors in batches
      for (let i = 0; i < embeddings.length; i += batchSize) {
        const batchEmbeddings = embeddings.slice(i, i + batchSize);
        const batchChunks = chunks.slice(i, i + batchSize);

        // Store this batch using the vector client
        const batchResult = await vector.upsert({
          indexName: knowledgeBaseName,
          vectors: batchEmbeddings,
          metadata: batchChunks.map((chunk, index) => ({
            metadata: {
              ...chunk.metadata,
              content: chunk.text,
            },
          })),
        });

        allStoredIds.push(...batchResult);

        // Small delay between batches to avoid overwhelming the database
        if (i + batchSize < embeddings.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      return {
        docIds: allStoredIds,
      };
    } catch (error) {
      // reverting the upsert
      await Promise.all(allStoredIds.map(
        (docId) => vector.deleteVector({ indexName: knowledgeBaseName, id: docId }),
      ));

      await bailWorkflowAndUpdateFileStatus(context, {
        message: `Batch vector storage failed: ${error instanceof Error ? error.message : String(error)}`,
      });

      // This will never be reached due to context.bail(), but TypeScript needs it
      throw error;
    }
  },
});
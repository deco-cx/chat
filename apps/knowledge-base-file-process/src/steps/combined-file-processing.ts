import { createStep } from "@deco/workers-runtime/mastra";
import { z } from "zod";
import { FileProcessor } from "@deco/sdk/mcp";
import { embedMany } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { KNOWLEDGE_BASE_GROUP } from "@deco/sdk/constants";
import { WorkspaceMemory } from "@deco/sdk/memory";
import { WorkflowInputSchema, WorkflowOutputSchema } from "../types/schemas.ts";
import { bailWorkflowAndUpdateFileStatus } from "../utils/workflow-error-handler.ts";
import { createKnowledgeBaseSupabaseClient } from "../utils/supabase-client.ts";
import { basename } from "@std/path/posix";
import type { Workspace } from "@deco/sdk/path";

/**
 * Get vector client for the workspace
 */
// deno-lint-ignore no-explicit-any
async function getVectorClient(env: any, workspace: string) {
  const mem = await WorkspaceMemory.create({
    workspace: workspace as Workspace, // Cast to avoid type issues in workflow context
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

const DEFAULT_VECTOR_BATCH_SIZE = 50;

/**
 * Get vector batch size from environment variable or use default
 */
// deno-lint-ignore no-explicit-any
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

export const combinedFileProcessingStep = createStep({
  id: "COMBINED_FILE_PROCESSING",
  inputSchema: WorkflowInputSchema.extend({
    totalPages: z.number().optional(),
    batchPage: z.number().optional(),
  }),
  outputSchema: WorkflowOutputSchema,
  /**
   * @author: igorbrasileiro
   * This should be one step, because the output is stored in database, since chunks/embeddings
   * are stored in vector db are huge, that's the workaround at moment.
   */
  async execute(context) {
    const {
      fileUrl,
      path,
      filename,
      metadata,
      workspace,
      knowledgeBaseName,
      batchPage = 0,
      totalPages,
    } = context.inputData;
    // deno-lint-ignore no-explicit-any
    const env = context.runtimeContext.get("env") as any;
    const batchSize = getVectorBatchSize(env);

    let allStoredIds: string[] = [];
    const vector = await getVectorClient(env, workspace);

    try {
      console.log("Starting combined file processing for", fileUrl);

      // Step 1: Process file and generate chunks
      console.log("Processing file...");
      const fileProcessor = new FileProcessor({
        chunkSize: 500,
        chunkOverlap: 50,
      });

      const processedFile = await fileProcessor.processFile(fileUrl);

      // Create file metadata combining all sources
      const fileMetadata = {
        ...metadata,
        ...processedFile.metadata,
        ...(path ? { path } : { fileUrl }),
      };

      const start = batchPage * batchSize;
      // Convert chunks to the expected format with enriched metadata
      const enrichedChunks = processedFile.chunks.slice(
        start,
        start + batchSize,
      ).map((chunk, index) => ({
        text: chunk.text,
        metadata: {
          ...fileMetadata,
          ...chunk.metadata,
          chunkIndex: start + index,
        },
      }));

      console.log(`File processed. Generated ${enrichedChunks.length} chunks.`);

      // Step 2: Generate embeddings
      console.log("Generating embeddings...");
      const openai = createOpenAI({
        apiKey: env.OPENAI_API_KEY,
      });
      const embedder = openai.embedding("text-embedding-3-small");

      // Create embeddings for all items using embedMany (handles batching internally)
      const { embeddings } = await embedMany({
        model: embedder,
        values: enrichedChunks.map((item) => item.text),
      });

      console.log(`Generated ${embeddings.length} embeddings.`);

      // Step 3: Store vectors in database
      console.log("Storing vectors in database...");

      const batchResult = await vector.upsert({
        indexName: knowledgeBaseName,
        vectors: embeddings,
        metadata: enrichedChunks.map((item) => ({
          metadata: {
            ...item.metadata,
            content: item.text,
          },
        })),
      });

      allStoredIds = batchResult;

      console.log(`Successfully stored batch ${batchPage} of ${totalPages}`);

      const supabase = createKnowledgeBaseSupabaseClient(env);

      // Add fallback logic for filename - matching original handler logic
      const finalFilename = filename ||
        (path ? basename(path) : undefined) ||
        fileUrl;

      // Upsert the asset record using typed Supabase client
      const { data: previousAsset } = await supabase
        .from("deco_chat_assets")
        .select("doc_ids")
        .eq("workspace", workspace)
        .eq("file_url", fileUrl)
        .single();

      const docIds = previousAsset?.doc_ids ?? [];

      allStoredIds = [...docIds, ...batchResult];
      const { error } = await supabase
        .from("deco_chat_assets")
        .update({
          doc_ids: allStoredIds,
          filename: finalFilename,
          metadata: fileMetadata,
        })
        .eq("workspace", workspace)
        .eq("file_url", fileUrl)
        .single();

      if (error) {
        throw error;
      }

      const _totalPages = totalPages ??
        Math.ceil(processedFile.metadata.chunkCount / batchSize);
      return {
        ...context.inputData,
        hasMore: batchPage + 1 < _totalPages,
        batchPage: batchPage + 1,
        totalPages: _totalPages,
      };
    } catch (error) {
      await Promise.all(
        allStoredIds.map((docId) =>
          vector.deleteVector({ indexName: knowledgeBaseName, id: docId })
        ),
      );

      console.error(
        `Combined file processing failed for ${path || filename || fileUrl}:`,
        error,
      );
      await bailWorkflowAndUpdateFileStatus(context, {
        message: `Combined file processing failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });

      // This will never be reached due to context.bail(), but TypeScript needs it
      throw error;
    }
  },
});

import { z } from "zod";
import { FileProcessor } from "@deco/sdk/mcp";
import { embedMany } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { KNOWLEDGE_BASE_GROUP } from "@deco/sdk/constants";
import { WorkspaceMemory } from "@deco/sdk/memory";
import { basename } from "@std/path/posix";
import { getServerClient } from "@deco/sdk/storage";

export type SupabaseClient = ReturnType<typeof getServerClient>;

/**
 * Creates an optimized Supabase client with proper database types.
 * Uses the singleton pattern from the SDK for performance optimization.
 */
export function createKnowledgeBaseSupabaseClient(env: any): SupabaseClient {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVER_TOKEN) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVER_TOKEN environment variables are required");
  }
  
  return getServerClient(env.SUPABASE_URL, env.SUPABASE_SERVER_TOKEN);
}

// Extended schema for batch processing
export const QueueMessageSchema = z.object({
  fileUrl: z.string(),
  path: z.string().describe(
    "File path from file added using workspace fs_write tool",
  ).optional(),
  filename: z.string().describe("The name of the file").optional(),
  metadata: z.record(z.string(), z.union([z.string(), z.boolean()]))
    .optional(),
  workspace: z.string(),
  knowledgeBaseName: z.string(),
  totalPages: z.number().optional(),
  batchPage: z.number().optional(),
});

export type QueueMessage = z.infer<typeof QueueMessageSchema>;

const DEFAULT_BATCH_SIZE = 50;

/**
 * Get batch size from environment variable or use default
 */
const getBatchSize = (env: any): number => {
  const envBatchSize = env.VECTOR_BATCH_SIZE;
  if (envBatchSize) {
    const parsed = parseInt(envBatchSize, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return DEFAULT_BATCH_SIZE;
};

/**
 * Get vector client for the workspace
 */
async function getVectorClient(env: any, workspace: string) {
  const mem = await WorkspaceMemory.create({
    workspace: workspace as any,
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

async function updateAssetStatusToFailed(env: any, message: QueueMessage) {
  const supabase = createKnowledgeBaseSupabaseClient(env);
  // await supabase.from("deco_chat_assets").update({ status: 'failed' }).eq("workspace", message.workspace).eq("file_url", message.fileUrl);
}

/**
 * Process a single batch of file chunks
 */
async function processBatch(message: QueueMessage, env: any): Promise<{
  hasMore: boolean;
  batchPage: number;
  totalPages: number;
}> {
  const { fileUrl, path, filename, metadata, workspace, knowledgeBaseName, batchPage = 0, totalPages } = message;
  const batchSize = getBatchSize(env);

  let allStoredIds: string[] = [];
  const vector = await getVectorClient(env, workspace);

  try {
    console.log(`Processing batch ${batchPage} for file:`, fileUrl);

    // Process file and generate chunks
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
    const enrichedChunks = processedFile.chunks.slice(start, start + batchSize).map((chunk, index) => ({
      text: chunk.text,
      metadata: {
        ...fileMetadata,
        ...chunk.metadata,
        chunkIndex: start + index,
      },
    }));

    console.log(`Generated ${enrichedChunks.length} chunks for batch ${batchPage}.`);

    // Generate embeddings
    const openai = createOpenAI({
      apiKey: env.OPENAI_API_KEY,
    });
    const embedder = openai.embedding("text-embedding-3-small");

    const { embeddings } = await embedMany({
      model: embedder,
      values: enrichedChunks.map((item) => item.text),
    });

    console.log(`Generated ${embeddings.length} embeddings for batch ${batchPage}.`);

    // Store vectors in database
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

    const supabase = createKnowledgeBaseSupabaseClient(env);

    // Add fallback logic for filename
    const finalFilename =
      filename ||
      (path ? basename(path) : undefined) ||
      fileUrl;

    // Update the asset record
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
        // TODO: add status to the asset table
        // ...(processedFile.metadata.chunkCount === allStoredIds.length ? { status: 'processed' } : {}),
      })
      .eq("workspace", workspace)
      .eq("file_url", fileUrl);

    if (error) {
      throw error;
    }

    const _totalPages = totalPages ?? Math.ceil(processedFile.metadata.chunkCount / batchSize);
    const hasMore = batchPage + 1 < _totalPages;

    console.log(`Successfully processed batch ${batchPage} of ${_totalPages}. HasMore: ${hasMore}`);

    return {
      hasMore,
      batchPage: batchPage + 1,
      totalPages: _totalPages,
    };
  } catch (error) {
    // Cleanup stored vectors on error
    if (allStoredIds.length > 0) {
      await Promise.all(
        allStoredIds.map(docId => 
          vector.deleteVector({ indexName: knowledgeBaseName, id: docId })
        )
      );
    }

    console.error(`Batch processing failed for ${path || filename || fileUrl}:`, error);
    throw error;
  }
}

/**
 * Send a message to the kb-file-processor queue
 */
export async function sendToKbFileProcessorQueue(
  env: any,
  message: QueueMessage
): Promise<void> {
  if (!env.KB_FILE_PROCESSOR) {
    throw new Error("KB_FILE_PROCESSOR queue binding not found");
  }

  await env.KB_FILE_PROCESSOR.send(message);
  console.log("Message sent to kb-file-processor queue:", { 
    fileUrl: message.fileUrl, 
    batchPage: message.batchPage 
  });
}

/**
 * Main queue handler for Cloudflare Workers
 */
export async function queueHandler(
  batch: MessageBatch<z.infer<typeof QueueMessageSchema>>,
  env: any,
  ctx: ExecutionContext
): Promise<void> {
  for (const message of batch.messages) {
    try {
      // Parse and validate the message
      const queueMessage = QueueMessageSchema.parse(message.body);
      
      console.log(`Processing queue message for file: ${queueMessage.fileUrl}, batch: ${queueMessage.batchPage || 0}`);

      // Process the batch
      const result = await processBatch(queueMessage, env);

      // If there are more batches to process, send next message to queue
      if (result.hasMore) {
        const nextMessage: QueueMessage = {
          ...queueMessage,
          batchPage: result.batchPage,
          totalPages: result.totalPages,
        };

        await sendToKbFileProcessorQueue(env, nextMessage);
        console.log(`Queued next batch: ${result.batchPage} of ${result.totalPages}`);
      } else {
        console.log(`File processing completed for: ${queueMessage.fileUrl}`);
      }

      // Acknowledge the message
      message.ack();
    } catch (error) {
      console.error("Queue message processing failed:", error);
      
      // Retry the message (optional - based on your retry policy)
      if (message.attempts < 2) {
        message.retry();
      } else {
        await updateAssetStatusToFailed(env, message.body);
        message.ack();
      }
    }
  }
} 
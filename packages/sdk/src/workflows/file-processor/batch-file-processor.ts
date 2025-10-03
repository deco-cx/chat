import { createOpenAI } from "@ai-sdk/openai";
import type { MastraVector } from "@mastra/core";
import { basename } from "@std/path";
import { embedMany } from "ai";
import { z } from "zod/v3";
import { KNOWLEDGE_BASE_GROUP } from "../../constants.ts";
import { InternalServerError } from "../../errors.ts";
import { type AppContext } from "../../mcp/context.ts";
import {
  FileProcessor,
  type ProcessedDocument,
} from "../../mcp/file-processor.ts";
import { WorkspaceMemory } from "../../memory/memory.ts";
import type { Workspace } from "../../path.ts";
import { getServerClient } from "../../storage/supabase/client.ts";

// Workflow message schema for knowledge base file processing
export const KbFileProcessorMessageSchema = z.object({
  fileUrl: z.string().url("Invalid file URL"),
  path: z
    .string()
    .describe("File path from file added using workspace fs_write tool")
    .optional(),
  filename: z.string().describe("The name of the file").optional(),
  metadata: z
    .record(z.string(), z.union([z.string(), z.boolean()]))
    .describe("Additional metadata for the file")
    .optional(),
  workspace: z.string().min(1, "Workspace is required"),
  knowledgeBaseName: z.string().min(1, "Knowledge base name is required"),
});

export type KbFileProcessorMessage = z.infer<
  typeof KbFileProcessorMessageSchema
>;

// Processing result schema
export const ProcessingResultSchema = z.object({
  hasMore: z.boolean(),
  totalChunks: z.number().int().min(0),
  totalPages: z.number().int().min(0),
});

export type ProcessingResult = z.infer<typeof ProcessingResultSchema>;

// Workflow binding interface
export interface KbFileProcessorWorkflow {
  create: (options: {
    params: KbFileProcessorMessage;
  }) => Promise<{ id: string }>;
}

// Environment variables schema for Workflow processing
export const WorkflowEnvSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, "OpenAI API key is required"),
  SUPABASE_URL: z.string().url("Invalid Supabase URL"),
  SUPABASE_SERVER_TOKEN: z.string().min(1, "Supabase server token is required"),
  TURSO_ADMIN_TOKEN: z.string().min(1, "Turso admin token is required"),
  TURSO_ORGANIZATION: z.string().min(1, "Turso organization is required"),
  TURSO_GROUP_DATABASE_TOKEN: z
    .string()
    .min(1, "Turso group database token is required"),
  VECTOR_BATCH_SIZE: z.string().optional(),
  WORKSPACE_DB: z.any().optional(),
});
type WorkflowEnvs = z.infer<typeof WorkflowEnvSchema>;

const DEFAULT_BATCH_SIZE = 50;

/**
 * Get batch size from environment variable or use default
 */
export function getBatchSize(env: WorkflowEnvs): number {
  const envBatchSize = env.VECTOR_BATCH_SIZE;
  if (typeof envBatchSize === "string") {
    const parsed = parseInt(envBatchSize, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return DEFAULT_BATCH_SIZE;
}

/**
 * Get vector client for the workspace
 */
async function getVectorClient(workspace: string, env: WorkflowEnvs) {
  const mem = await WorkspaceMemory.create({
    workspace: workspace as Workspace, // Cast to avoid type issues in workflow context
    tursoAdminToken: env.TURSO_ADMIN_TOKEN,
    tursoOrganization: env.TURSO_ORGANIZATION,
    tokenStorage: env.TURSO_GROUP_DATABASE_TOKEN,
    workspaceDO: env.WORKSPACE_DB,
    openAPIKey: env.OPENAI_API_KEY,
    discriminator: KNOWLEDGE_BASE_GROUP,
    options: { semanticRecall: true },
  });

  const vector = mem.vector;
  if (!vector) {
    throw new InternalServerError("Missing vector client");
  }
  return vector;
}

/**
 * Create Supabase client for knowledge base operations
 */
function createKnowledgeBaseSupabaseClient(env: WorkflowEnvs) {
  return getServerClient(env.SUPABASE_URL, env.SUPABASE_SERVER_TOKEN);
}

/**
 * Process file and generate chunks for a specific batch
 */
async function generateFileChunks(
  fileUrl: string,
  path: string | undefined,
  metadata: Record<string, string | boolean> | undefined,
): Promise<{
  enrichedChunks: Array<{
    text: string;
    metadata: Record<string, unknown>;
  }>;
  totalChunkCount: number;
  fileMetadata: ProcessedDocument["metadata"] & { path?: string };
}> {
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

  const enrichedChunks = processedFile.chunks.map((chunk, index) => ({
    text: chunk.text,
    metadata: {
      ...fileMetadata,
      ...chunk.metadata,
      chunkIndex: index,
    },
  }));

  return {
    enrichedChunks,
    totalChunkCount: processedFile.metadata.chunkCount,
    fileMetadata,
  };
}

/**
 * Generate embeddings for text chunks using OpenAI
 */
async function generateEmbeddings(
  chunks: Array<{ text: string; metadata: Record<string, unknown> }>,
  apiKey: string,
): Promise<number[][]> {
  const openai = createOpenAI({
    apiKey,
  });
  const embedder = openai.embedding("text-embedding-3-small");

  const { embeddings } = await embedMany({
    model: embedder,
    values: chunks.map((item) => item.text),
  });

  return embeddings;
}

/**
 * Store vectors in the vector database
 */
async function storeVectorsInDatabase(
  vector: MastraVector,
  knowledgeBaseName: string,
  embeddings: number[][],
  // deno-lint-ignore no-explicit-any
  chunks: Array<{ text: string; metadata: Record<string, any> }>,
): Promise<string[]> {
  // Store vectors in database
  const batchResult = await vector.upsert({
    indexName: knowledgeBaseName,
    vectors: embeddings,
    metadata: chunks.map((item) => ({
      metadata: {
        ...item.metadata,
        content: item.text,
      },
    })),
  });

  return batchResult;
}

/**
 * Update asset record in Supabase with new document IDs and metadata
 */
async function updateAssetRecord(
  params: {
    workspace: string;
    fileUrl: string;
    newDocIds: string[];
    filename: string | undefined;
    path: string | undefined;
    // deno-lint-ignore no-explicit-any
    fileMetadata: Record<string, any>;
    totalChunkCount: number;
  },
  env: WorkflowEnvs,
): Promise<string[]> {
  const {
    workspace,
    fileUrl,
    newDocIds,
    filename,
    path,
    fileMetadata,
    totalChunkCount,
  } = params;
  const supabase = createKnowledgeBaseSupabaseClient(env);

  // Add fallback logic for filename
  const finalFilename =
    filename || (path ? basename(path) : undefined) || fileUrl;

  // Update the asset record
  const { data: previousAsset } = await supabase
    .from("deco_chat_assets")
    .select("doc_ids")
    .eq("workspace", workspace)
    .eq("file_url", fileUrl)
    .single();

  const docIds = previousAsset?.doc_ids ?? [];
  const allStoredIds = [...docIds, ...newDocIds];

  const finished = allStoredIds.length === totalChunkCount;

  const { error } = await supabase
    .from("deco_chat_assets")
    .update({
      doc_ids: allStoredIds,
      filename: finalFilename,
      metadata: fileMetadata,
      ...(finished ? { status: "completed" } : {}),
    })
    .eq("workspace", workspace)
    .eq("file_url", fileUrl);

  if (error) {
    throw new InternalServerError(`Failed to update asset: ${error.message}`);
  }

  return allStoredIds;
}

/**
 * Process a single batch of file chunks
 */
export async function processBatch(
  message: KbFileProcessorMessage,
  env: z.infer<typeof WorkflowEnvSchema>,
): Promise<ProcessingResult> {
  const { fileUrl, path, filename, metadata, workspace, knowledgeBaseName } =
    message;
  const batchSize = getBatchSize(env);

  let allStoredIds: string[] = [];
  const vector = await getVectorClient(workspace, env);

  try {
    const { enrichedChunks, totalChunkCount, fileMetadata } =
      await generateFileChunks(fileUrl, path, metadata);

    if (enrichedChunks.length === 0) {
      // No more chunks to process
      return {
        hasMore: false,
        totalChunks: totalChunkCount,
        totalPages: Math.ceil(totalChunkCount / batchSize),
      };
    }

    for (let i = 0; i < enrichedChunks.length; i += batchSize) {
      const batch = enrichedChunks.slice(i, i + batchSize);
      const embeddings = await generateEmbeddings(batch, env.OPENAI_API_KEY);
      allStoredIds.push(
        ...(await storeVectorsInDatabase(
          vector,
          knowledgeBaseName,
          embeddings,
          batch,
        )),
      );
    }

    allStoredIds = await updateAssetRecord(
      {
        workspace,
        fileUrl,
        newDocIds: allStoredIds,
        filename,
        path,
        fileMetadata,
        totalChunkCount,
      },
      env,
    );

    return {
      hasMore: false,
      totalChunks: totalChunkCount,
      totalPages: Math.ceil(totalChunkCount / batchSize),
    };
  } catch (error) {
    // Cleanup stored vectors on error
    if (allStoredIds.length > 0) {
      await Promise.all(
        allStoredIds.map((docId) =>
          vector.deleteVector({ indexName: knowledgeBaseName, id: docId }),
        ),
      );
    }

    console.error(
      `Batch processing failed for ${path || filename || fileUrl}:`,
      error,
    );

    // Update asset status to failed
    await updateAssetStatusToFailed(
      {
        workspace,
        fileUrl,
        error: error instanceof Error ? error.message : String(error),
      },
      env,
    );

    throw error;
  }
}

/**
 * Send a message to the kb-file-processor workflow
 */
export async function sendToKbFileProcessorWorkflow(
  workflow: KbFileProcessorWorkflow,
  message: KbFileProcessorMessage,
): Promise<void> {
  const validatedMessage = KbFileProcessorMessageSchema.parse(message);

  await workflow.create({ params: validatedMessage });
}

/**
 * Update asset status to failed in the database
 */
export async function updateAssetStatusToFailed(
  params: {
    workspace: string;
    fileUrl: string;
    error: string;
  },
  env: WorkflowEnvs,
): Promise<void> {
  try {
    const supabase = createKnowledgeBaseSupabaseClient(env);

    await supabase
      .from("deco_chat_assets")
      .update({
        status: "failed",
        metadata: {
          error: params.error,
          failed_at: new Date().toISOString(),
        },
      })
      .eq("workspace", params.workspace)
      .eq("file_url", params.fileUrl);
  } catch {
    /** ignore */
  }
}

/**
 * Send message using AppContext (for use in MCP tools)
 */
export async function startKbFileProcessorWorkflow(
  context: AppContext,
  message: KbFileProcessorMessage,
): Promise<void> {
  if (!context.kbFileProcessor) {
    throw new InternalServerError(
      "KB file processor workflow is not available",
    );
  }

  await sendToKbFileProcessorWorkflow(context.kbFileProcessor, message);
}

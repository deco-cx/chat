import { z } from "zod";
import { createOpenAI } from "@ai-sdk/openai";
import { embedMany } from "ai";
import { basename } from "@std/path";
import { FileProcessor } from "../../mcp/file-processor.ts";
import { KNOWLEDGE_BASE_GROUP } from "../../constants.ts";
import { WorkspaceMemory } from "../../memory/memory.ts";
import { InternalServerError } from "../../errors.ts";
import type { AppContext } from "../../mcp/context.ts";
import { getServerClient } from "../../storage/supabase/client.ts";

// Queue message schema for knowledge base file processing
export const KbFileProcessorMessageSchema = z.object({
    fileUrl: z.string().url("Invalid file URL"),
    path: z.string().describe(
        "File path from file added using workspace fs_write tool",
    ).optional(),
    filename: z.string().describe("The name of the file").optional(),
    metadata: z.record(z.string(), z.union([z.string(), z.boolean()]))
        .describe("Additional metadata for the file")
        .optional(),
    workspace: z.string().min(1, "Workspace is required"),
    knowledgeBaseName: z.string().min(1, "Knowledge base name is required"),
    totalPages: z.number().int().min(0).optional(),
    batchPage: z.number().int().min(0).optional(),
});

export type KbFileProcessorMessage = z.infer<typeof KbFileProcessorMessageSchema>;

// Extended message for batch processing
export const BatchProcessorMessageSchema = KbFileProcessorMessageSchema.extend({
    totalPages: z.number().int().min(0),
    batchPage: z.number().int().min(0),
});

export type BatchProcessorMessage = z.infer<typeof BatchProcessorMessageSchema>;

// Processing result schema
export const ProcessingResultSchema = z.object({
    hasMore: z.boolean(),
    batchPage: z.number().int().min(0),
    totalPages: z.number().int().min(0),
});

export type ProcessingResult = z.infer<typeof ProcessingResultSchema>;

// Queue binding interface
export interface KbFileProcessorQueue {
    send: (message: KbFileProcessorMessage) => Promise<void>;
}

// Environment variables schema for queue processing
export const QueueEnvSchema = z.object({
    OPENAI_API_KEY: z.string().min(1, "OpenAI API key is required"),
    SUPABASE_URL: z.string().url("Invalid Supabase URL"),
    SUPABASE_SERVER_TOKEN: z.string().min(1, "Supabase server token is required"),
    TURSO_ADMIN_TOKEN: z.string().min(1, "Turso admin token is required"),
    TURSO_ORGANIZATION: z.string().min(1, "Turso organization is required"),
    TURSO_GROUP_DATABASE_TOKEN: z.string().min(1, "Turso group database token is required"),
    VECTOR_BATCH_SIZE: z.string().optional(),
});

const DEFAULT_BATCH_SIZE = 50;

/**
 * Get batch size from environment variable or use default
 */
export function getBatchSize(envVars: Record<string, unknown>): number {
    const envBatchSize = envVars.VECTOR_BATCH_SIZE;
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
async function getVectorClient(envVars: Record<string, unknown>, workspace: string) {
    const env = QueueEnvSchema.parse(envVars);

    const mem = await WorkspaceMemory.create({
        workspace: workspace as any, // Cast to avoid type issues in queue context
        tursoAdminToken: env.TURSO_ADMIN_TOKEN,
        tursoOrganization: env.TURSO_ORGANIZATION,
        tokenStorage: env.TURSO_GROUP_DATABASE_TOKEN,
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
function createKnowledgeBaseSupabaseClient(envVars: Record<string, unknown>) {
    const env = QueueEnvSchema.parse(envVars);
    return getServerClient(env.SUPABASE_URL, env.SUPABASE_SERVER_TOKEN);
}

/**
 * Process a single batch of file chunks
 */
export async function processBatch(
    message: KbFileProcessorMessage,
    envVars: Record<string, unknown>
): Promise<ProcessingResult> {
    const validatedMessage = KbFileProcessorMessageSchema.parse(message);
    const env = QueueEnvSchema.parse(envVars);
    const { fileUrl, path, filename, metadata, workspace, knowledgeBaseName, batchPage = 0, totalPages } = validatedMessage;
    const batchSize = getBatchSize(envVars);

    let allStoredIds: string[] = [];
    const vector = await getVectorClient(envVars, workspace);

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

        if (enrichedChunks.length === 0) {
            // No more chunks to process
            const _totalPages = totalPages ?? Math.ceil(processedFile.metadata.chunkCount / batchSize);
            return {
                hasMore: false,
                batchPage,
                totalPages: _totalPages,
            };
        }

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

        const supabase = createKnowledgeBaseSupabaseClient(envVars);

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
            })
            .eq("workspace", workspace)
            .eq("file_url", fileUrl);

        if (error) {
            throw new InternalServerError(`Failed to update asset: ${error.message}`);
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

        // Update asset status to failed
        await updateAssetStatusToFailed(envVars, {
            workspace,
            fileUrl,
            error: error instanceof Error ? error.message : String(error),
        });

        throw error;
    }
}

/**
 * Send a message to the kb-file-processor queue
 */
export async function sendToKbFileProcessorQueue(
    queue: KbFileProcessorQueue,
    message: KbFileProcessorMessage
): Promise<void> {
    const validatedMessage = KbFileProcessorMessageSchema.parse(message);

    await queue.send(validatedMessage);
    console.log("Message sent to kb-file-processor queue:", {
        fileUrl: validatedMessage.fileUrl,
        batchPage: validatedMessage.batchPage
    });
}

/**
 * Update asset status to failed in the database
 */
export async function updateAssetStatusToFailed(
    envVars: Record<string, unknown>,
    params: {
        workspace: string;
        fileUrl: string;
        error: string;
    }
): Promise<void> {
    try {
        const supabase = createKnowledgeBaseSupabaseClient(envVars);

        const { error } = await supabase
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

        if (error) {
            console.error("Failed to update asset status:", error);
        }
    } catch (error) {
        console.error("Error updating asset status to failed:", error);
    }
}

/**
 * Send message using AppContext (for use in MCP tools)
 */
export async function sendKbFileProcessorMessage(
    context: AppContext,
    message: KbFileProcessorMessage
): Promise<void> {
    if (!context.kbFileProcessor) {
        throw new InternalServerError("KB file processor queue is not available");
    }

    await sendToKbFileProcessorQueue(context.kbFileProcessor, message);
} 
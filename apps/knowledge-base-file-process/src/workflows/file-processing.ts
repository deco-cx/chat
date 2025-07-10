import { createWorkflow } from "@deco/workers-runtime/mastra";
import { WorkflowInputSchema, WorkflowOutputSchema } from "../types/schemas.ts";
import { processFileStep } from "../steps/file-processing.ts";
import { batchEmbeddingsStep } from "../steps/embeddings.ts";
import { batchStoreVectorStep } from "../steps/vector-storage.ts";
import { upsertAssetStep } from "../steps/asset-update.ts";

export const createFileProcessingWorkflow = () =>
    createWorkflow({
        id: "FILE_PROCESSING",
        description: "Process files for knowledge base with batch processing and error handling",
        inputSchema: WorkflowInputSchema,
        outputSchema: WorkflowOutputSchema,
    })
        // Step 1: Process file and generate chunks
        .then(processFileStep)        
        // Step 2: Generate embeddings in batches
        .then(batchEmbeddingsStep)
        // Step 3: Store vectors in database in batches (includes vector index creation)
        .then(batchStoreVectorStep)        
        // Step 4: Update asset record
        .then(upsertAssetStep)
        .map(async (context) => {
            const input = context.getInitData<typeof WorkflowInputSchema>();
            const stored = context.getStepResult(batchStoreVectorStep);
            return {
                workspace: input.workspace,
                path: input.path,
                filename: input.filename,
                fileUrl: input.fileUrl,
                docIds: stored.docIds,
                metadata: input.metadata,
                knowledgeBaseName: input.knowledgeBaseName,
            };
        })
        
        .commit();

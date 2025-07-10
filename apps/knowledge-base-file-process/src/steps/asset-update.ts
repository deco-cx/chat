import { createStep } from "@deco/workers-runtime/mastra";
import { z } from "zod";
import { bailWorkflowAndUpdateFileStatus } from "../utils/workflow-error-handler.ts";
import { createKnowledgeBaseSupabaseClient } from "../utils/supabase-client.ts";
import { BatchStoreVectorOutputSchema } from "./vector-storage.ts";
import { WorkflowInputSchema } from "../types/schemas.ts";
import { processFileStep } from "./file-processing.ts";
import { basename } from "@std/path/posix";

const UpsertAssetOutputSchema = z.object({
  upserted: z.boolean(),
  action: z.enum(["created", "updated"]),
  assetId: z.string().optional(),
  fileData: z.object({
    fileUrl: z.string(),
    metadata: z.any(),
    path: z.string().optional(),
    docIds: z.array(z.string()),
    filename: z.string(),
  }),
});

export const upsertAssetStep = createStep({
  id: "UPSERT_ASSET",
  inputSchema: BatchStoreVectorOutputSchema,
  outputSchema: UpsertAssetOutputSchema,
  async execute(context) {
    const { docIds } = context.inputData;
    const input = context.getInitData<typeof WorkflowInputSchema>();
    const { workspace, path, filename, fileUrl } = input;
    const { fileMetadata } = context.getStepResult(processFileStep);
    const env = context.runtimeContext.get("env");

    try {
      console.log("Upserting asset", context.getInitData<typeof WorkflowInputSchema>().fileUrl);
      const supabase = createKnowledgeBaseSupabaseClient(env);

      // Add fallback logic for filename - matching original handler logic
      const finalFilename =
        filename ||
        (path ? basename(path) : undefined) ||
        fileUrl;

      // Upsert the asset record using typed Supabase client
      const { data: newFile, error } = await supabase
        .from("deco_chat_assets")
        .update({
          doc_ids: docIds,
          filename: finalFilename,
          metadata: fileMetadata,
        })
        .eq("workspace", workspace)
        .eq("file_url", fileUrl)
        .select("file_url, metadata, path, doc_ids, filename")
        .single();

      console.log("Upserted asset", newFile);


      if (error) {
        throw new Error(`Failed to upsert asset: ${error.message}`);
      }

      if (!newFile) {
        throw new Error("Failed to update file metadata - no data returned");
      }

      // Return data in the format expected by the original handler
      return {
        upserted: true,
        action: "updated" as const,
        assetId: undefined, // deco_chat_assets table doesn't have an id column
        fileData: {
          fileUrl: newFile.file_url,
          metadata: newFile.metadata,
          path: newFile.path ?? path,
          filename: newFile.filename ?? finalFilename,
          docIds: newFile.doc_ids ?? docIds,
        },
      };
    } catch (error) {
      await bailWorkflowAndUpdateFileStatus(context, {
        message: `Asset upsert failed: ${error instanceof Error ? error.message : String(error)}`,
      });

      // This will never be reached due to context.bail(), but TypeScript needs it
      throw error;
    }
  },
});
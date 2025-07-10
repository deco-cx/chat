import { WorkflowInputSchema } from "../types/schemas.ts";
import { createKnowledgeBaseSupabaseClient, type AssetUpdate } from "./supabase-client.ts";

/**
 * Handles workflow failures by updating file status and bailing the workflow
 * @param context - The workflow step context
 * @param options - Object containing the error message
 */
export async function bailWorkflowAndUpdateFileStatus(
  context: any,
  { message }: { message: string }
) {
  let input: any = null;
  
  try {
    input = context.getInitData();
    const env = context.runtimeContext.get("env") as any;
    const supabase = createKnowledgeBaseSupabaseClient(env);

    // Prepare the update data with proper typing
    const updateData: AssetUpdate = {
      metadata: {
        status: "failed",
        error: message,
        failedAt: new Date().toISOString(),
      },
    };

    // Update file status to failed in Supabase assets table
    await supabase
      .from("deco_chat_assets")
      .update(updateData)
      .eq("workspace", input.workspace)
      .eq("file_url", input.fileUrl);

  } catch (updateError) {
    // Continue with bail even if status update fails
    console.error("Failed to update asset status during error handling:", updateError);
  }

  // Bail the workflow with the error message
  context.bail({
    error: message,
  });
} 
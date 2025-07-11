import type { createStep } from "@deco/workers-runtime/mastra";
import type { WorkflowInput } from "../types/schemas.ts";
import {
  type AssetUpdate,
  createKnowledgeBaseSupabaseClient,
} from "./supabase-client.ts";

/**
 * Handles workflow failures by updating file status and bailing the workflow
 * @param context - The workflow step context
 * @param options - Object containing the error message
 */
export async function bailWorkflowAndUpdateFileStatus(
  context: Parameters<Parameters<typeof createStep>[0]["execute"]>[0],
  { message }: { message: string },
) {
  try {
    const input = context.getInitData() as WorkflowInput;
    // deno-lint-ignore no-explicit-any
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
    console.error(
      "Failed to update asset status during error handling:",
      updateError,
    );
  }

  // Bail the workflow with the error message
  context.bail({
    error: message,
  });
}

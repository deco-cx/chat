import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";
import type { Workflow } from "@cloudflare/workers-types";
import { type KbFileProcessorMessage, processBatch } from "@deco/sdk/workflows";

// Environment interface for workflow
interface Env extends Record<string, unknown> {
  OPENAI_API_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_SERVER_TOKEN: string;
  TURSO_ADMIN_TOKEN: string;
  TURSO_ORGANIZATION: string;
  TURSO_GROUP_DATABASE_TOKEN: string;
  VECTOR_BATCH_SIZE?: string;
  // Add other workflow bindings here if needed
  KB_FILE_PROCESSOR: Workflow;
}

/**
 * Cloudflare Workflow for processing knowledge base files
 */
export class KbFileProcessorWorkflow extends WorkflowEntrypoint<
  Env,
  KbFileProcessorMessage
> {
  override async run(
    event: WorkflowEvent<KbFileProcessorMessage>,
    step: WorkflowStep,
  ) {
    const message = event.payload;

    // Process the current batch
    const result = await step.do("process-batch", async () => {
      return await processBatch(message, this.env);
    });

    return {
      completed: !result.hasMore,
      totalChunks: result.totalChunks,
      totalPages: result.totalPages,
      hasMore: result.hasMore,
    };
  }
}

export type { KbFileProcessorMessage };

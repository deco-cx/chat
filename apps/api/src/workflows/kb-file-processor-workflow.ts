import type { Workflow } from "@cloudflare/workers-types";
import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";
import {
  type KbFileProcessorMessage,
  KbFileProcessorMessageSchema,
  processBatch,
  WorkflowEnvSchema,
} from "@deco/sdk/workflows";
import { NonRetryableError } from "cloudflare:workflows";

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

    try {
      try {
        KbFileProcessorMessageSchema.parse(message);
        WorkflowEnvSchema.parse(this.env);
      } catch {
        throw new NonRetryableError("Invalid message or environment variables");
      }

      // Process the current batch
      const result = await step.do(
        "process-batch",
        {
          retries: {
            limit: 1,
            delay: 5_000,
          },
        },
        async () => {
          return await processBatch(message, this.env);
        },
      );

      return {
        completed: !result.hasMore,
        totalChunks: result.totalChunks,
        totalPages: result.totalPages,
        hasMore: result.hasMore,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // no need to retry if the error is because of a rollback, it will be repeating the same error
      if (message.toLowerCase().includes("sqlite error: cannot rollback")) {
        throw new NonRetryableError(message);
      }

      throw error;
    }
  }
}

export type { KbFileProcessorMessage };

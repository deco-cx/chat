import type { MessageBatch } from "@cloudflare/workers-types";
import { 
  KbFileProcessorMessageSchema,
  processBatch,
  sendToKbFileProcessorQueue,
  type KbFileProcessorMessage,
  type KbFileProcessorQueue
} from "@deco/sdk/queues";

/**
 * Main queue handler for Cloudflare Workers
 */
export async function queueHandler(
  batch: MessageBatch,
  env: Record<string, unknown>,
  ctx: ExecutionContext
): Promise<void> {
  for (const message of batch.messages) {
    try {
      // Parse and validate the message
      const queueMessage = KbFileProcessorMessageSchema.parse(message.body);
      
      console.log(`Processing queue message for file: ${queueMessage.fileUrl}, batch: ${queueMessage.batchPage || 0}`);

      // Process the batch using SDK function
      const result = await processBatch(queueMessage, env);

      // If there are more batches to process, send next message to queue
      if (result.hasMore) {
        const nextMessage: KbFileProcessorMessage = {
          ...queueMessage,
          batchPage: result.batchPage,
          totalPages: result.totalPages,
        };

        await sendToKbFileProcessorQueue(env.KB_FILE_PROCESSOR as KbFileProcessorQueue, nextMessage);
        console.log(`Queued next batch: ${result.batchPage} of ${result.totalPages}`);
      } else {
        console.log(`File processing completed for: ${queueMessage.fileUrl}`);
      }

      // Acknowledge the message
      message.ack();
    } catch (error) {
      console.error("Queue message processing failed:", error);
      
      // Retry the message (optional - based on your retry policy)
      message.retry();
    }
  }
}

export type { KbFileProcessorMessage };

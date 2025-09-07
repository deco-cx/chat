import type { MCPClientStub, WorkspaceTools } from "@deco/sdk/mcp";
import type { Message as AIMessage } from "ai";
import { extractText } from "unpdf";

const MIN_PDF_SUMMARIZATION_SIZE_BYTES = 100_000; // 100KB

async function extractPDFText(pdfUrl: string): Promise<string> {
  try {
    const response = await fetch(pdfUrl);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch PDF: ${response.status} ${response.statusText}`,
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const text = await extractText(new Uint8Array(arrayBuffer));
    const extractedText = text.text.join(" ");

    return extractedText;
  } catch (error) {
    console.error("[PDF Summarizer] Error extracting PDF text:", error);
    throw new Error(`Failed to extract text from PDF: ${error}`);
  }
}

function chunkText(text: string, maxChunkSize: number): string[] {
  const chunks: string[] = [];
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);

  let currentChunk = "";

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (currentChunk.length + trimmedSentence.length + 1 <= maxChunkSize) {
      currentChunk += (currentChunk ? " " : "") + trimmedSentence;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      currentChunk = trimmedSentence;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

async function summarizeChunk(
  chunk: string,
  previousSummaries: string[],
  mcpClient: MCPClientStub<WorkspaceTools>,
  model: string,
  maxTokens: number,
): Promise<string> {
  try {
    const context =
      previousSummaries.length > 0
        ? `\n\nPrevious summary context:\n${previousSummaries.join("\n\n")}\n\n`
        : "";

    const result = await mcpClient.AI_GENERATE({
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that summarizes text content. Provide concise, accurate summaries that capture the key points and main ideas. Focus on the most important information and maintain the original meaning. When building on previous summaries, ensure continuity and avoid repetition while maintaining a cohesive narrative.",
        },
        {
          role: "user",
          content: `${context}Please summarize the following text in a concise way, building on the previous context if provided:\n\n${chunk}`,
        },
      ],
      model,
      maxTokens,
      temperature: 0.3,
    });

    if (result && typeof result === "object" && "text" in result) {
      const summary = result.text as string;
      return summary;
    }

    throw new Error("Invalid response from AI_GENERATE");
  } catch (error) {
    console.error("[PDF Summarizer] Error summarizing chunk:", error);
    // Fallback to original chunk if summarization fails
    return chunk;
  }
}

/**
 * Checks if the messages have PDF attachments and if the total size of the PDF attachments is greater than the minimum size for summarization
 * @param messages - The messages to check
 * @returns An object with the following properties:
 * - hasPdf: boolean - Whether the messages have PDF attachments
 * - totalPdfAttachmentsBytes: number - The total size of the PDF attachments in bytes
 * - hasMinimumSizeForSummarization: boolean - Whether the total size of the PDF attachments is greater than the minimum size for summarization
 */
export function shouldSummarizePDFs(messages: AIMessage[]): {
  hasPdf: boolean;
  totalPdfAttachmentsBytes: number;
  hasMinimumSizeForSummarization: boolean;
} {
  const pdfMessages = messages.filter((message) =>
    message.experimental_attachments?.some(
      (attachment) => attachment.contentType === "application/pdf",
    ),
  );

  const hasPdf = pdfMessages.length > 0;
  const totalPdfAttachmentsBytes = pdfMessages.reduce((acc, message) => {
    return (
      acc +
      (message.experimental_attachments ?? []).reduce((acc, attachment) => {
        if ("size" in attachment && typeof attachment.size === "number") {
          return acc + attachment.size;
        }
        return acc;
      }, 0)
    );
  }, 0);

  const hasMinimumSizeForSummarization =
    totalPdfAttachmentsBytes > MIN_PDF_SUMMARIZATION_SIZE_BYTES;

  return {
    hasPdf,
    totalPdfAttachmentsBytes,
    hasMinimumSizeForSummarization,
  };
}

/**
 * Summarizes PDF messages to reduce token usage
 * Uses AI_GENERATE with a lightweight model and chunked PDF content
 * @param messages - The messages to summarize
 * @param mcpClient - The MCP client to use
 * @param options - The options for the summarization
 * @returns The same messages array, but substitutes the PDF attachments with the summarized text
 */
export async function summarizePDFMessages(
  messages: AIMessage[],
  mcpClient: MCPClientStub<WorkspaceTools>,
  options: {
    model: string;
    maxChunkSize: number;
    maxSummaryTokens: number;
    maxTotalTokens: number;
  },
): Promise<AIMessage[]> {
  const { model, maxChunkSize, maxSummaryTokens, maxTotalTokens } = options;

  const processedMessages: AIMessage[] = [];

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];

    const pdfAttachments = message.experimental_attachments?.filter(
      (attachment) => attachment.contentType === "application/pdf",
    );

    if (!pdfAttachments || pdfAttachments.length === 0) {
      processedMessages.push(message);
      continue;
    }

    try {
      let totalTokens = 0;

      for (let j = 0; j < pdfAttachments.length; j++) {
        const pdfAttachment = pdfAttachments[j];

        const pdfText = await extractPDFText(pdfAttachment.url);
        const chunks = chunkText(pdfText, maxChunkSize);

        const summarizedChunks: string[] = [];
        for (let k = 0; k < chunks.length; k++) {
          const chunk = chunks[k];
          if (totalTokens >= maxTotalTokens) {
            break;
          }

          const summary = await summarizeChunk(
            chunk,
            summarizedChunks,
            mcpClient,
            model,
            maxSummaryTokens,
          );
          summarizedChunks.push(summary);

          const estimatedTokens = Math.ceil(summary.length / 4);
          totalTokens += estimatedTokens;
        }

        const combinedSummary = summarizedChunks.join("\n\n");

        const pdfSummaryAnnotation = {
          type: "file" as const,
          url: pdfAttachment.url,
          name: pdfAttachment.name || "document",
          contentType: "application/pdf",
          content: `<pdf_summary original="${pdfAttachment.name || "document"}">\n${combinedSummary}\n</pdf_summary>`,
        };

        if (!message.annotations) {
          message.annotations = [];
        }
        message.annotations.push(pdfSummaryAnnotation);
      }

      const summarizedMessage: AIMessage = {
        ...message,
        experimental_attachments: message.experimental_attachments?.filter(
          (attachment) => attachment.contentType !== "application/pdf",
        ),
      };

      processedMessages.push(summarizedMessage);
    } catch (error) {
      console.error(
        `[PDF Summarizer] Error processing PDF message ${i + 1}:`,
        error,
      );
      processedMessages.push(message);
    }
  }

  return processedMessages;
}

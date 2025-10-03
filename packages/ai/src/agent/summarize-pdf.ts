import type { MCPClientStub, ProjectTools } from "@deco/sdk/mcp";
import type { UIMessage } from "ai";

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

    // Lazy import unpdf only when needed
    const { extractText } = await import("unpdf");
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
  mcpClient: MCPClientStub<ProjectTools>,
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
 * Checks if the message has PDF attachments and if the total size of the PDF attachments is greater than the minimum size for summarization
 * @param message - The message to check
 * @returns An object with the following properties:
 * - hasPdf: boolean - Whether the message has PDF attachments
 * - totalPdfAttachmentsBytes: number - The total size of the PDF attachments in bytes
 * - hasMinimumSizeForSummarization: boolean - Whether the total size of the PDF attachments is greater than the minimum size for summarization
 */
export function shouldSummarizePDFs(message: UIMessage): {
  hasPdf: boolean;
  totalPdfAttachmentsBytes: number;
  hasMinimumSizeForSummarization: boolean;
} {
  const pdfParts =
    message.parts?.filter(
      (part) => part.type === "file" && part.mediaType === "application/pdf",
    ) ?? [];

  const hasPdf = pdfParts.length > 0;
  const totalPdfAttachmentsBytes = pdfParts.reduce((acc, part) => {
    if ("size" in part && typeof part.size === "number") {
      return acc + part.size;
    }
    return acc;
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
 * Summarizes PDF message to reduce token usage
 * Uses AI_GENERATE with a lightweight model and chunked PDF content
 * @param message - The message to summarize
 * @param mcpClient - The MCP client to use
 * @param options - The options for the summarization
 * @returns The same message, but substitutes the PDF attachments with the summarized text
 */
export async function summarizePDFMessages(
  message: UIMessage,
  mcpClient: MCPClientStub<ProjectTools>,
  options: {
    model: string;
    maxChunkSize: number;
    maxSummaryTokens: number;
    maxTotalTokens: number;
  },
): Promise<UIMessage> {
  const { model, maxChunkSize, maxSummaryTokens, maxTotalTokens } = options;

  const pdfAttachments = message.parts?.filter(
    (part) =>
      part.type === "file" &&
      "mediaType" in part &&
      part.mediaType === "application/pdf",
  );

  if (!pdfAttachments || pdfAttachments.length === 0) {
    return message;
  }

  try {
    let totalTokens = 0;
    const newParts = [...(message.parts ?? [])];

    for (let j = 0; j < pdfAttachments.length; j++) {
      const pdfAttachment = pdfAttachments[j];

      // Type guard to ensure it's a file part
      if (pdfAttachment.type !== "file" || !("url" in pdfAttachment)) {
        continue;
      }

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

      // Add PDF summary as a text part instead of annotation
      const pdfSummaryPart = {
        type: "text" as const,
        text: `<pdf_summary original="${
          ("filename" in pdfAttachment ? pdfAttachment.filename : undefined) ||
          "document"
        }">\n${combinedSummary}\n</pdf_summary>`,
      };

      newParts.push(pdfSummaryPart);
    }

    // Return message with PDF files removed and summaries added
    return {
      ...message,
      parts: newParts.filter(
        (part) =>
          !(part.type === "file" && part.mediaType === "application/pdf"),
      ),
    };
  } catch (error) {
    console.error("[PDF Summarizer] Error processing PDF message:", error);
    return message;
  }
}

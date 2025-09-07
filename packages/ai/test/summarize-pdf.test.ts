// deno-lint-ignore-file
import { expect, test, describe, vi, beforeEach } from "vitest";
import type { MCPClientStub, WorkspaceTools } from "@deco/sdk/mcp";
import type { Message as AIMessageOriginal } from "ai";
import {
  summarizePDFMessages,
  shouldSummarizePDFs,
} from "../src/agent/summarize-pdf.ts";

type AIMessage = AIMessageOriginal & {
  experimental_attachments?: AIMessageOriginal["experimental_attachments"] &
    {
      size?: number;
    }[];
};

// Mock unpdf
vi.mock("unpdf", () => ({
  extractText: vi.fn(),
}));

// Mock fetch
global.fetch = vi.fn();

describe("shouldSummarizePDFs", () => {
  test("should return false when no PDF attachments", () => {
    const messages: AIMessage[] = [
      {
        id: "1",
        role: "user",
        content: "Hello",
        experimental_attachments: [],
      },
    ];

    const result = shouldSummarizePDFs(messages);
    expect(result.hasPdf).toBe(false);
    expect(result.totalPdfAttachmentsBytes).toBe(0);
    expect(result.hasMinimumSizeForSummarization).toBe(false);
  });

  test("should return true when PDF attachments exist", () => {
    const messages: AIMessage[] = [
      {
        id: "1",
        role: "user",
        content: "Hello",
        experimental_attachments: [
          {
            name: "test.pdf",
            contentType: "application/pdf",
            url: "https://example.com/test.pdf",
            size: 50000,
          },
        ],
      },
    ];

    const result = shouldSummarizePDFs(messages);
    expect(result.hasPdf).toBe(true);
    expect(result.totalPdfAttachmentsBytes).toBe(50000);
    expect(result.hasMinimumSizeForSummarization).toBe(false);
  });

  test("should return true for minimum size when PDF is large enough", () => {
    const messages: AIMessage[] = [
      {
        id: "1",
        role: "user",
        content: "Hello",
        experimental_attachments: [
          {
            name: "large.pdf",
            contentType: "application/pdf",
            url: "https://example.com/large.pdf",
            size: 150000,
          },
        ],
      },
    ];

    const result = shouldSummarizePDFs(messages);
    expect(result.hasPdf).toBe(true);
    expect(result.totalPdfAttachmentsBytes).toBe(150000);
    expect(result.hasMinimumSizeForSummarization).toBe(true);
  });

  test("should sum multiple PDF attachments", () => {
    const messages: AIMessage[] = [
      {
        id: "1",
        role: "user",
        content: "Hello",
        experimental_attachments: [
          {
            name: "small.pdf",
            contentType: "application/pdf",
            url: "https://example.com/small.pdf",
            size: 50000,
          },
          {
            name: "medium.pdf",
            contentType: "application/pdf",
            url: "https://example.com/medium.pdf",
            size: 60000,
          },
        ],
      },
    ];

    const result = shouldSummarizePDFs(messages);
    expect(result.hasPdf).toBe(true);
    expect(result.totalPdfAttachmentsBytes).toBe(110000);
    expect(result.hasMinimumSizeForSummarization).toBe(true);
  });

  test("should ignore non-PDF attachments", () => {
    const messages: AIMessage[] = [
      {
        id: "1",
        role: "user",
        content: "Hello",
        experimental_attachments: [
          {
            name: "image.jpg",
            contentType: "image/jpeg",
            url: "https://example.com/image.jpg",
            size: 100000,
          },
        ],
      },
    ];

    const result = shouldSummarizePDFs(messages);
    expect(result.hasPdf).toBe(false);
    expect(result.totalPdfAttachmentsBytes).toBe(0);
    expect(result.hasMinimumSizeForSummarization).toBe(false);
  });

  test("should handle attachments without size property", () => {
    const messages: AIMessage[] = [
      {
        id: "1",
        role: "user",
        content: "Hello",
        experimental_attachments: [
          {
            name: "test.pdf",
            contentType: "application/pdf",
            url: "https://example.com/test.pdf",
          },
        ],
      },
    ];

    const result = shouldSummarizePDFs(messages);
    expect(result.hasPdf).toBe(true);
    expect(result.totalPdfAttachmentsBytes).toBe(0);
    expect(result.hasMinimumSizeForSummarization).toBe(false);
  });
});

describe("summarizePDFMessages", () => {
  let mockMCPClient: MCPClientStub<WorkspaceTools>;

  beforeEach(() => {
    mockMCPClient = {
      AI_GENERATE: vi.fn(),
    } as any;

    // Mock fetch to return a successful response with mock PDF data
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    } as any);
  });

  test("should return original messages when no PDF attachments", async () => {
    const messages: AIMessage[] = [
      {
        id: "1",
        role: "user",
        content: "Hello",
        experimental_attachments: [],
      },
    ];

    const result = await summarizePDFMessages(messages, mockMCPClient, {
      model: "gpt-3.5-turbo",
      maxChunkSize: 4000,
      maxSummaryTokens: 1000,
      maxTotalTokens: 8000,
    });

    expect(result).toEqual(messages);
    expect(mockMCPClient.AI_GENERATE).not.toHaveBeenCalled();
  });

  test("should process PDF attachments and add annotations", async () => {
    const messages: AIMessage[] = [
      {
        id: "1",
        role: "user",
        content: "Hello",
        experimental_attachments: [
          {
            name: "test.pdf",
            contentType: "application/pdf",
            url: "https://example.com/test.pdf",
          },
        ],
      },
    ];

    // Mock extractText to return some text
    const { extractText } = await import("unpdf");
    vi.mocked(extractText).mockResolvedValue({
      text: ["This is a test PDF content with some text to summarize."],
    } as any);

    // Mock AI_GENERATE to return a summary
    vi.mocked(mockMCPClient.AI_GENERATE).mockResolvedValue({
      text: "This is a summarized version of the PDF content.",
      usage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        transactionId: "test-transaction",
      },
      finishReason: "stop",
    });

    const result = await summarizePDFMessages(messages, mockMCPClient, {
      model: "gpt-3.5-turbo",
      maxChunkSize: 4000,
      maxSummaryTokens: 1000,
      maxTotalTokens: 8000,
    });

    expect(result).toHaveLength(1);
    expect(result[0].experimental_attachments).toHaveLength(0);
    expect(result[0].annotations).toHaveLength(1);
    expect(result[0].annotations?.[0]).toMatchObject({
      type: "file",
      url: "https://example.com/test.pdf",
      name: "test.pdf",
      contentType: "application/pdf",
    });
    expect((result[0].annotations?.[0] as any)?.content).toContain(
      "<pdf_summary",
    );
    expect((result[0].annotations?.[0] as any)?.content).toContain(
      "This is a summarized version",
    );
  });

  test("should handle multiple PDF attachments", async () => {
    const messages: AIMessage[] = [
      {
        id: "1",
        role: "user",
        content: "Hello",
        experimental_attachments: [
          {
            name: "test1.pdf",
            contentType: "application/pdf",
            url: "https://example.com/test1.pdf",
          },
          {
            name: "test2.pdf",
            contentType: "application/pdf",
            url: "https://example.com/test2.pdf",
          },
        ],
      },
    ];

    const { extractText } = await import("unpdf");
    vi.mocked(extractText).mockResolvedValue({
      text: ["This is test PDF content."],
    } as any);

    vi.mocked(mockMCPClient.AI_GENERATE).mockResolvedValue({
      text: "Summarized content.",
      usage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        transactionId: "test-transaction",
      },
      finishReason: "stop",
    });

    const result = await summarizePDFMessages(messages, mockMCPClient, {
      model: "gpt-3.5-turbo",
      maxChunkSize: 4000,
      maxSummaryTokens: 1000,
      maxTotalTokens: 8000,
    });

    expect(result).toHaveLength(1);
    expect(result[0].experimental_attachments).toHaveLength(0);
    expect(result[0].annotations).toHaveLength(2);
    expect((result[0].annotations?.[0] as any)?.name).toBe("test1.pdf");
    expect((result[0].annotations?.[1] as any)?.name).toBe("test2.pdf");
  });

  test("should handle AI_GENERATE errors gracefully", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const messages: AIMessage[] = [
      {
        id: "1",
        role: "user",
        content: "Hello",
        experimental_attachments: [
          {
            name: "test.pdf",
            contentType: "application/pdf",
            url: "https://example.com/test.pdf",
          },
        ],
      },
    ];

    const { extractText } = await import("unpdf");
    vi.mocked(extractText).mockResolvedValue({
      text: ["This is test PDF content."],
    } as any);

    vi.mocked(mockMCPClient.AI_GENERATE).mockRejectedValue(
      new Error("AI service error"),
    );

    const result = await summarizePDFMessages(messages, mockMCPClient, {
      model: "gpt-3.5-turbo",
      maxChunkSize: 4000,
      maxSummaryTokens: 1000,
      maxTotalTokens: 8000,
    });

    expect(result).toHaveLength(1);
    expect(result[0].experimental_attachments).toHaveLength(0);
    expect(result[0].annotations).toHaveLength(1);
    // Should fallback to original content
    expect((result[0].annotations?.[0] as any)?.content).toContain(
      "This is test PDF content",
    );
    consoleSpy.mockRestore();
  });

  test("should respect token limits", async () => {
    const messages: AIMessage[] = [
      {
        id: "1",
        role: "user",
        content: "Hello",
        experimental_attachments: [
          {
            name: "large.pdf",
            contentType: "application/pdf",
            url: "https://example.com/large.pdf",
          },
        ],
      },
    ];

    const { extractText } = await import("unpdf");
    vi.mocked(extractText).mockResolvedValue({
      text: ["This is a very long PDF content. ".repeat(1000)],
    } as any);

    vi.mocked(mockMCPClient.AI_GENERATE).mockResolvedValue({
      text: "Summarized content.",
      usage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        transactionId: "test-transaction",
      },
      finishReason: "stop",
    });

    const result = await summarizePDFMessages(messages, mockMCPClient, {
      model: "gpt-3.5-turbo",
      maxChunkSize: 4000,
      maxSummaryTokens: 1000,
      maxTotalTokens: 1000, // Low limit to test token limiting
    });

    expect(result).toHaveLength(1);
    expect(mockMCPClient.AI_GENERATE).toHaveBeenCalled();
  });
});

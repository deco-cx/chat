import { z } from "zod/v3";
import { createInnateTool } from "./utils/create-tool.ts";
import type { Agent } from "@deco/sdk";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Buffer } from "node:buffer";

export type Tool = ReturnType<typeof createInnateTool>;

const FetchInputSchema = z.object({
  url: z.string().describe("The URL to fetch content from"),
  method: z
    .enum(["GET", "PUT", "POST", "DELETE", "PATCH", "HEAD"] as const)
    .default("GET")
    .describe("The HTTP method to use for the request"),
  headers: z
    .record(z.string(), z.string())
    .optional()
    .describe("Optional headers to include with the request"),
  body: z.any().optional().describe("Optional body to send with the request"),
  maxRetries: z
    .number()
    .int()
    .min(0)
    .max(5)
    .default(3)
    .describe("Maximum number of retry attempts (0-5)"),
  timeout: z
    .number()
    .int()
    .min(1000)
    .max(30000)
    .default(10000)
    .describe("Request timeout in milliseconds (1000-30000)"),
});

const FetchOutputSchema = z.object({
  content: z.string().describe("The content of the URL"),
  status: z.number().describe("The HTTP status code of the response"),
  headers: z.record(z.string(), z.string()).describe("The response headers"),
  ok: z
    .boolean()
    .describe("Whether the request was successful (status in 200-299 range)"),
});

export type Configuration = Agent;

const RenderInputSchema = z.object({
  title: z.string().describe("A Title for the preview"),
  type: z.enum(["url", "html"]).describe("The type of content to render"),
  content: z
    .string()
    .describe("The URL or HTML content to display in the preview"),
  mediaType: z
    .enum(["image", "video", "audio"])
    .optional()
    .describe(
      "The media type of the content. This is only required if type is 'url' and the content is the URL of a file.",
    ),
});

const RETRY_CONFIG = {
  maxAttempts: 20,
  maxDelay: 10000, // 10 seconds
} as const;

const PollForContentInputSchema = z.object({
  url: z.string().describe("The URL to check for content"),
  maxAttempts: z
    .number()
    .optional()
    .describe(
      "Maximum number of retry attempts (default: 20). Recommended to be 20 or more.",
    ),
  maxDelay: z
    .number()
    .optional()
    .describe("Maximum delay between retries in milliseconds (default: 5000)."),
});

const PollForContentOutputSchema = z.object({
  hasContent: z.boolean().describe("Whether the URL has content available"),
  message: z.string().describe("Status message about the URL check"),
});

export const RENDER = createInnateTool({
  id: "RENDER",
  description:
    "Display content in a preview iframe. Accepts either a URL or HTML content.",
  inputSchema: RenderInputSchema,
  outputSchema: RenderInputSchema,
  execute:
    () =>
    async ({ context }) => {
      return await Promise.resolve(context);
    },
});

export const FETCH = createInnateTool({
  id: "FETCH",
  description:
    "Fetch to a URL. Use only when you don't have a specific integration, so make sure to try to use the other tools first. Supports multiple HTTP methods, custom headers, request body, and optional proxy usage. With this you can get the content of a URL or make requests to APIs.",
  inputSchema: FetchInputSchema,
  outputSchema: FetchOutputSchema,
  execute:
    () =>
    async ({ context }) => {
      const { url: targetUrl, method, headers = {}, body, timeout } = context;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const requestHeaders = new Headers(headers);
        if (body && typeof body === "object") {
          requestHeaders.set("Content-Type", "application/json");
        }

        const requestInit: RequestInit = {
          method,
          headers: requestHeaders,
          signal: controller.signal,
          body: body && typeof body === "object" ? JSON.stringify(body) : body,
        };

        const response = await fetch(targetUrl, requestInit);
        const content = await response.text();
        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });

        return {
          content,
          status: response.status,
          headers: responseHeaders,
          ok: response.ok,
        };
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          throw new Error(`Request timed out after ${timeout}ms`);
        }
        throw error;
      } finally {
        clearTimeout(timeoutId);
      }
    },
});

export const POLL_FOR_CONTENT = createInnateTool({
  id: "POLL_FOR_CONTENT",
  description:
    "Check if a URL has content available with better detection methods, timeouts, and resource management. Uses HEAD requests for efficiency and proper retry logic.",
  inputSchema: PollForContentInputSchema,
  outputSchema: PollForContentOutputSchema,
  execute:
    () =>
    async ({ context }) => {
      const {
        url,
        maxAttempts = RETRY_CONFIG.maxAttempts,
        maxDelay = RETRY_CONFIG.maxDelay,
      } = context;

      try {
        new URL(url);
      } catch {
        return {
          hasContent: false,
          message: "Invalid URL format",
        };
      }

      let attempt = 1;

      while (attempt <= maxAttempts) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        try {
          let hasContent = false;
          let contentInfo = "";

          try {
            const headRes = await fetch(url, {
              method: "HEAD",
              signal: controller.signal,
            });

            if (headRes.ok) {
              const contentLength = headRes.headers.get("Content-Length");
              const contentType = headRes.headers.get("Content-Type");

              // Simple logic: if HEAD returns OK (200-299), content is likely available
              // Additional checks for content length can help confirm
              const hasValidLength = contentLength
                ? parseInt(contentLength, 10) > 0
                : true; // Default to true if no length header

              if (hasValidLength) {
                hasContent = true;
                contentInfo = `URL has content available (HEAD: ${headRes.status}, Content-Length: ${
                  contentLength || "unknown"
                }, Content-Type: ${contentType || "unknown"})`;
              }
            }
          } catch (headError) {
            console.debug(
              "HEAD request failed, will try GET fallback:",
              headError,
            );
          }

          // If HEAD didn't confirm content, try GET as fallback
          if (!hasContent) {
            try {
              const getRes = await fetch(url, {
                method: "GET",
                signal: controller.signal,
                headers: {
                  Range: "bytes=0-1023", // Only fetch first 1KB to minimize data transfer
                },
              });

              if (getRes.ok) {
                const contentLength = getRes.headers.get("Content-Length");
                const contentType = getRes.headers.get("Content-Type");

                // Cancel the response body to avoid downloading the full content
                if (getRes.body) {
                  await getRes.body.cancel();
                }

                hasContent = true;
                contentInfo = `URL has content available (GET: ${getRes.status}, Content-Length: ${
                  contentLength || "unknown"
                }, Content-Type: ${contentType || "unknown"})`;
              }
            } catch (getError) {
              // Both HEAD and GET failed, continue to retry logic
              console.debug("GET request also failed:", getError);
            }
          }

          clearTimeout(timeoutId);

          if (hasContent) {
            return {
              hasContent: true,
              message: contentInfo,
            };
          }

          // If we reach here, no content was detected
          if (attempt < maxAttempts) {
            // Exponential backoff with jitter
            const baseDelay = Math.min(
              500 * Math.pow(2, attempt - 1),
              maxDelay,
            );
            const jitter = Math.random() * 0.1 * baseDelay; // Add 10% jitter
            const delay = baseDelay + jitter;

            await new Promise((resolve) => setTimeout(resolve, delay));
            attempt++;
            continue;
          }

          return {
            hasContent: false,
            message: `URL has no content after ${maxAttempts} attempts`,
          };
        } catch (error) {
          clearTimeout(timeoutId);

          // Check if it's a timeout error
          if (error instanceof Error && error.name === "AbortError") {
            if (attempt < maxAttempts) {
              const baseDelay = Math.min(
                1000 * Math.pow(2, attempt - 1),
                maxDelay,
              );
              const jitter = Math.random() * 0.1 * baseDelay;
              const delay = baseDelay + jitter;

              await new Promise((resolve) => setTimeout(resolve, delay));
              attempt++;
              continue;
            }

            return {
              hasContent: false,
              message: "Request timed out after multiple attempts",
            };
          }

          // For other errors, determine if they're retryable
          const isRetryable =
            error instanceof TypeError || // Network errors
            (error instanceof Error && error.message.includes("fetch"));

          if (isRetryable && attempt < maxAttempts) {
            const baseDelay = Math.min(
              1000 * Math.pow(2, attempt - 1),
              maxDelay,
            );
            const jitter = Math.random() * 0.1 * baseDelay;
            const delay = baseDelay + jitter;

            await new Promise((resolve) => setTimeout(resolve, delay));
            attempt++;
            continue;
          }

          return {
            hasContent: false,
            message: `Error checking URL: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          };
        }
      }

      return {
        hasContent: false,
        message: "Maximum retry attempts reached",
      };
    },
});

const ShowPickerInputSchema = z.object({
  options: z.array(
    z.object({
      label: z.string().describe("The display text for the option"),
      value: z.string().describe("The value of the option"),
      description: z
        .string()
        .optional()
        .describe("Optional description of the option"),
    }),
  ),
  question: z.string().describe("The question to ask the user"),
});

export const SHOW_PICKER = createInnateTool({
  id: "SHOW_PICKER",
  description:
    "When you need to ask the user to pick one option from a list, use this tool to ask the user for their choice. " +
    "The user will be presented with a message and a list of options, they can pick one of the options. " +
    "Don't repeat the question in text before calling the tool, just call the tool with the question and options.",
  inputSchema: ShowPickerInputSchema,
  outputSchema: ShowPickerInputSchema,
  execute:
    () =>
    async ({ context }) => {
      return await Promise.resolve(context);
    },
});

const ConfirmInputSchema = z.object({
  message: z.string().describe("The message to confirm"),
});

export const CONFIRM = createInnateTool({
  id: "CONFIRM",
  description:
    "When you need to confirm an action, use this tool to ask the user for confirmation. " +
    "The user will be presented with a message and two options, 'Confirm' and 'Cancel'. " +
    "Don't repeat the message in text before calling the tool, just call the tool with the message." +
    "Only use this tool when you believe the action has important consequences and you need to be sure the user wants to proceed, " +
    "for example when confirming a payment, deleting a file, etc.",
  inputSchema: ConfirmInputSchema,
  outputSchema: ShowPickerInputSchema,
  execute:
    () =>
    async ({ context }) => {
      return await Promise.resolve({
        question: context.message,
        options: [
          {
            label: "Confirm",
            value: "confirm",
          },
          {
            label: "Cancel",
            value: "cancel",
          },
        ],
      });
    },
});

const CreatePresignedUrlInputSchema = z.object({
  expiresIn: z
    .number()
    .optional()
    .describe("Number of seconds until the URL expires (default: 3600)"),
  fileExtension: z.string().describe("The file extension to use for the file"),
});

const CreatePresignedUrlOutputSchema = z.object({
  putUrl: z.string().describe("The presigned URL for uploading a file"),
  getUrl: z.string().describe("The presigned URL for downloading a file"),
  expiresAt: z.number().describe("Unix timestamp when the URL expires"),
});

export const CREATE_PRESIGNED_URL = createInnateTool({
  id: "CREATE_PRESIGNED_URL",
  description: "Create a presigned URL for a file in the Deco Chat file system",
  inputSchema: CreatePresignedUrlInputSchema,
  outputSchema: CreatePresignedUrlOutputSchema,
  execute:
    (agent, env) =>
    async ({ context }) => {
      const { expiresIn = 3600, fileExtension } = context;
      if (!env) {
        throw new Error("Env is required");
      }

      const { workspace } = agent;
      const bucketName = env.DECO_CHAT_DATA_BUCKET_NAME ?? "deco-chat-fs";
      const region = env.AWS_REGION ?? "us-east-2";

      const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;

      const s3Client = new S3Client({
        region,
        credentials: {
          accessKeyId: env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: env.AWS_SECRET_ACCESS_KEY!,
        },
      });

      const s3Key = `${workspace}/${crypto.randomUUID()}.${fileExtension}`;

      const contentType = getContentType(fileExtension);

      const putCommand = new PutObjectCommand({
        Bucket: bucketName,
        Key: s3Key,
        ContentType: contentType,
      });

      const putUrl = await getSignedUrl(s3Client, putCommand, {
        expiresIn,
        signableHeaders: new Set(["content-type"]),
      });

      const getCommand = new GetObjectCommand({
        Bucket: bucketName,
        Key: s3Key,
        ResponseContentType: contentType,
      });

      const getUrl = await getSignedUrl(s3Client, getCommand, {
        expiresIn,
      });

      return {
        putUrl,
        getUrl,
        expiresAt,
      };
    },
});

function getContentType(extension: string): string {
  const contentTypes: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    txt: "text/plain",
    csv: "text/csv",
    html: "text/html",
    htm: "text/html",
    json: "application/json",
    mp4: "video/mp4",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    zip: "application/zip",
    rar: "application/x-rar-compressed",
    tar: "application/x-tar",
    gz: "application/gzip",
  };

  return contentTypes[extension] || "application/octet-stream";
}

const WhoAmIOutputSchema = z.object({
  agentId: z.string().describe("The ID of the current agent"),
  agentName: z.string().describe("The name of the current agent"),
  workspace: z
    .string()
    .describe("The workspace path where the agent is running"),
  model: z.string().optional().describe("The model used by the agent"),
  instructions: z.string().optional().describe("The agent's instructions"),
  visibility: z.string().optional().describe("The agent's visibility setting"),
});

export const WHO_AM_I = createInnateTool({
  id: "WHO_AM_I",
  description:
    "Get information about the current agent, including agent ID, name, workspace, model, and configuration details.",
  inputSchema: z.object({}),
  outputSchema: WhoAmIOutputSchema,
  execute: (agent) => async () => {
    const config = await agent.configuration();

    return {
      agentId: config.id,
      agentName: agent.getAgentName(),
      workspace: agent.workspace,
      model: config.model,
      instructions: config.instructions,
      visibility: config.visibility,
    };
  },
});

const SpeakInputSchema = z.object({
  text: z.string().describe("The text to speak using the agent's voice"),
  emotion: z
    .enum(["neutral", "excited", "calm", "serious", "friendly"])
    .optional()
    .catch("neutral")
    .describe("The emotional tone to use when speaking (optional)"),
  speed: z
    .enum(["slow", "normal", "fast"])
    .optional()
    .catch("normal")
    .describe("The speed at which to speak (optional)"),
  voice: z
    .enum([
      "alloy",
      "echo",
      "fable",
      "onyx",
      "nova",
      "shimmer",
      "ash",
      "sage",
      "coral",
    ])
    .optional()
    .catch("echo")
    .describe(
      "The voice to use for speech synthesis (optional, defaults to agent's configured voice)",
    ),
});

const SpeakOutputSchema = z.object({
  success: z
    .boolean()
    .describe("Whether the speech was successfully generated"),
  message: z.string().describe("Status message about the speech generation"),
  audioUrl: z.string().optional().describe("URL to the generated audio file"),
});

export const SPEAK = createInnateTool({
  id: "SPEAK",
  description:
    "Use the agent's voice to speak text aloud. This tool converts text to speech using the agent's configured voice model. " +
    "Use this when you want to provide audio responses, when the user specifically requests voice output, " +
    "or when you want to create more engaging interactions. You can optionally generate an audio file that can be shared or played later. " +
    "This is perfect for creating voice-enabled conversations, reading content aloud, or providing audio feedback. " +
    "Use the audioUrl in markdown to display the audio file in the chat. " +
    "For example: ![audio]({audioUrl})",
  inputSchema: SpeakInputSchema,
  outputSchema: SpeakOutputSchema,
  execute:
    (agent, env) =>
    async ({ context }) => {
      let s3Client: S3Client | null = null;
      // deno-lint-ignore no-explicit-any
      let readableStream: any = null;

      try {
        const { text, emotion, speed, voice } = context;

        // Add emotional context to the text if specified
        let enhancedText = text;
        if (emotion && emotion !== "neutral") {
          enhancedText = `[Speaking in a ${emotion} tone] ${text}`;
        }

        // Use the agent's speak method with voice and speed options
        const speedMap = { slow: 0.75, normal: 1.0, fast: 1.25 };
        const speakOptions = {
          voice,
          speed: speed ? speedMap[speed] : undefined,
        };

        readableStream = await agent.speak(enhancedText, speakOptions);

        // Check if we got a valid ReadableStream
        if (!readableStream) {
          return {
            success: false,
            message: "Voice synthesis is not available for this agent",
          };
        }

        const {
          DECO_CHAT_DATA_BUCKET_NAME,
          AWS_REGION,
          AWS_ACCESS_KEY_ID,
          AWS_SECRET_ACCESS_KEY,
        } = env ?? {};

        let audioUrl: string | undefined;

        if (
          DECO_CHAT_DATA_BUCKET_NAME &&
          AWS_REGION &&
          AWS_ACCESS_KEY_ID &&
          AWS_SECRET_ACCESS_KEY
        ) {
          try {
            s3Client = new S3Client({
              region: AWS_REGION,
              credentials: {
                accessKeyId: AWS_ACCESS_KEY_ID,
                secretAccessKey: AWS_SECRET_ACCESS_KEY,
              },
            });

            const timestamp = Date.now();
            const audioFileName = `audio/speech-${timestamp}.mp3`;
            const { workspace } = agent;
            const s3Key = `${workspace}/${audioFileName}`;

            audioUrl = await processAudioStream(
              readableStream,
              s3Client,
              DECO_CHAT_DATA_BUCKET_NAME,
              s3Key,
            );
          } catch (uploadError) {
            console.error("💥 Error uploading audio:", uploadError);
          }
        }

        return {
          success: true,
          message: `Successfully generated speech for: "${text.substring(0, 50)}${
            text.length > 50 ? "..." : ""
          }"`,
          audioUrl,
        };
      } catch (error) {
        console.error("💥 Error in SPEAK tool:", error);
        return {
          success: false,
          message: `Failed to generate speech: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        };
      } finally {
        // Cleanup resources
        await cleanupResources(readableStream, s3Client);
      }
    },
});

// Helper function to process audio stream with memory efficiency
async function processAudioStream(
  // deno-lint-ignore no-explicit-any
  readableStream: any,
  s3Client: S3Client,
  bucketName: string,
  s3Key: string,
): Promise<string> {
  const MAX_MEMORY_BUFFER = 50 * 1024 * 1024; // 50MB limit
  let totalSize = 0;
  const chunks: Buffer[] = [];

  try {
    // Handle different stream types with better error recovery
    if (readableStream && typeof readableStream === "object") {
      // Check if it's a Node.js readable stream
      if ("read" in readableStream || "on" in readableStream) {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Stream processing timeout after 30 seconds"));
          }, 30000);

          const cleanup = () => {
            clearTimeout(timeout);
          };

          if (readableStream._readableState?.length > 0) {
            let chunk;
            while ((chunk = readableStream.read()) !== null) {
              if (chunk instanceof Buffer) {
                totalSize += chunk.length;
                if (totalSize > MAX_MEMORY_BUFFER) {
                  cleanup();
                  reject(
                    new Error(
                      `Audio file too large (>${
                        MAX_MEMORY_BUFFER / 1024 / 1024
                      }MB)`,
                    ),
                  );
                  return;
                }
                chunks.push(chunk);
              }
            }
          }

          readableStream.on("data", (chunk: Buffer) => {
            totalSize += chunk.length;
            if (totalSize > MAX_MEMORY_BUFFER) {
              cleanup();
              reject(
                new Error(
                  `Audio file too large (>${
                    MAX_MEMORY_BUFFER / 1024 / 1024
                  }MB)`,
                ),
              );
              return;
            }
            chunks.push(chunk);
          });

          readableStream.on("end", () => {
            cleanup();
            resolve();
          });

          readableStream.on("error", (error: Error) => {
            cleanup();
            reject(new Error(`Stream error: ${error.message}`));
          });

          if (readableStream.readableEnded || readableStream.destroyed) {
            cleanup();
            resolve();
          }
        });
      } else if (readableStream instanceof ArrayBuffer) {
        const buffer = Buffer.from(readableStream);
        if (buffer.length > MAX_MEMORY_BUFFER) {
          throw new Error(
            `Audio file too large (>${MAX_MEMORY_BUFFER / 1024 / 1024}MB)`,
          );
        }
        chunks.push(buffer);
      } else if (typeof readableStream === "string") {
        const buffer = Buffer.from(readableStream, "base64");
        if (buffer.length > MAX_MEMORY_BUFFER) {
          throw new Error(
            `Audio file too large (>${MAX_MEMORY_BUFFER / 1024 / 1024}MB)`,
          );
        }
        chunks.push(buffer);
      } else {
        throw new Error("Unsupported stream type");
      }
    } else {
      throw new Error("Invalid stream object");
    }

    if (chunks.length === 0) {
      throw new Error("No audio data received from voice synthesis");
    }

    const audioBuffer = Buffer.concat(chunks);

    await uploadWithRetry(s3Client, bucketName, s3Key, audioBuffer);

    const getCommand = new GetObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      ResponseContentType: "audio/mpeg",
    });

    return await getSignedUrl(s3Client, getCommand, {
      expiresIn: 3600 * 24, // 24 hours
    });
  } finally {
    chunks.length = 0;
  }
}

// Helper function to upload with retry logic
async function uploadWithRetry(
  s3Client: S3Client,
  bucketName: string,
  s3Key: string,
  audioBuffer: Buffer,
  maxRetries: number = 3,
): Promise<void> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const putCommand = new PutObjectCommand({
        Bucket: bucketName,
        Key: s3Key,
        Body: audioBuffer,
        ContentType: "audio/mpeg",
        ContentLength: audioBuffer.length,
      });

      await s3Client.send(putCommand);
      return; // Success
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error("Unknown upload error");

      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt - 1) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(
    `Failed to upload after ${maxRetries} attempts: ${lastError?.message}`,
  );
}

// Helper function to cleanup resources
function cleanupResources(
  // deno-lint-ignore no-explicit-any
  readableStream: any,
  s3Client: S3Client | null,
): void {
  try {
    if (readableStream && typeof readableStream === "object") {
      if (
        "destroy" in readableStream &&
        typeof readableStream.destroy === "function"
      ) {
        readableStream.destroy();
      } else if (
        "close" in readableStream &&
        typeof readableStream.close === "function"
      ) {
        readableStream.close();
      }
    }
  } catch (error) {
    console.warn("Warning: Failed to cleanup stream resources:", error);
  }

  try {
    if (
      s3Client &&
      "destroy" in s3Client &&
      typeof s3Client.destroy === "function"
    ) {
      s3Client.destroy();
    }
  } catch (error) {
    console.warn("Warning: Failed to cleanup S3 client resources:", error);
  }
}

export const tools = {
  FETCH,
  POLL_FOR_CONTENT,
  RENDER,
  SHOW_PICKER,
  CONFIRM,
  CREATE_PRESIGNED_URL,
  WHO_AM_I,
  SPEAK,
};

import { z } from "zod";
import { createInnateTool } from "./utils/createTool.ts";
import type { Agent } from "./storage/index.ts";

export type Tool = ReturnType<typeof createInnateTool>;

const GenerateInputSchema = z.object({
  prompt: z.string().describe("The prompt to generate content for"),
});

const GenerateOutputSchema = z.object({
  text: z.string().describe(
    "The generated content as a string",
  ),
});

const FetchInputSchema = z.object({
  url: z.string().describe("The URL to fetch content from"),
  method: z.enum(["GET", "PUT", "POST", "DELETE", "PATCH", "HEAD"] as const)
    .default("GET")
    .describe("The HTTP method to use for the request"),
  useProxy: z.boolean()
    .default(true)
    .describe("Whether to use the proxy endpoint for the request"),
  headers: z.record(z.string(), z.string())
    .optional()
    .describe("Optional headers to include with the request"),
  body: z.any()
    .optional()
    .describe("Optional body to send with the request"),
  maxRetries: z.number()
    .int()
    .min(0)
    .max(5)
    .default(3)
    .describe("Maximum number of retry attempts (0-5)"),
  timeout: z.number()
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
  ok: z.boolean().describe(
    "Whether the request was successful (status in 200-299 range)",
  ),
});

export type Configuration = Agent;

const RenderInputSchema = z.object({
  title: z.string().describe("A Title for the preview"),
  type: z.enum(["url", "html"]).describe("The type of content to render"),
  content: z.string().describe(
    "The URL or HTML content to display in the preview",
  ),
});

const RETRY_CONFIG = {
  maxAttempts: 20,
  maxDelay: 10000, // 10 seconds
} as const;

const PollForContentInputSchema = z.object({
  url: z.string().describe("The URL to check for content"),
  maxAttempts: z.number().optional().describe(
    "Maximum number of retry attempts (default: 20). Recommended to be 20 or more.",
  ),
  maxDelay: z.number().optional().describe(
    "Maximum delay between retries in milliseconds (default: 10000).",
  ),
});

const PollForContentOutputSchema = z.object({
  hasContent: z.boolean().describe("Whether the URL has content available"),
  message: z.string().describe("Status message about the URL check"),
});

export const GENERATE = createInnateTool({
  id: "GENERATE",
  description:
    "ONLY USED ON WORKFLOWS YOU MUST NOT USE THIS TOOL DIRECTLY. This tool generates content using the agent.",
  inputSchema: GenerateInputSchema,
  outputSchema: GenerateOutputSchema,
  execute: (agent) => async ({ context }) => {
    return {
      text: await agent.generate(
        [{ id: crypto.randomUUID(), role: "user", content: context.prompt }],
      )
        .then((result) => result.text),
    };
  },
});

export const RENDER = createInnateTool({
  id: "RENDER",
  description:
    "Display content in a preview iframe. Accepts either a URL or HTML content.",
  inputSchema: RenderInputSchema,
  outputSchema: RenderInputSchema,
  execute: () => async ({ context }) => {
    return await Promise.resolve(context);
  },
});

export const FETCH = createInnateTool({
  id: "FETCH",
  description:
    "Fetch to a URL. Use only when you don't have a specific integration, so make sure to try to use the other tools first. Supports multiple HTTP methods, custom headers, request body, and optional proxy usage. With this you can get the content of a URL or make requests to APIs.",
  inputSchema: FetchInputSchema,
  outputSchema: FetchOutputSchema,
  execute: () => async ({ context }) => {
    const {
      url,
      method,
      useProxy,
      headers = {},
      body,
      timeout,
    } = context;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const targetUrl = useProxy
        ? `https://webdraw.com/proxy?url=${encodeURIComponent(url)}`
        : url;

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
    "Check if a URL has content available by verifying the Content-Length header, with retry logic. Will keep polling until content is found or max attempts are reached.",
  inputSchema: PollForContentInputSchema,
  outputSchema: PollForContentOutputSchema,
  execute: () => async ({ context }) => {
    const {
      url,
      maxAttempts = RETRY_CONFIG.maxAttempts,
      maxDelay = RETRY_CONFIG.maxDelay,
    } = context;
    let attempt = 1;

    while (attempt <= maxAttempts) {
      try {
        const res = await fetch(url);

        if (res.ok) {
          const contentLength = res.headers.get("Content-Length");
          const hasContent = contentLength
            ? parseInt(contentLength, 10) > 0
            : false;

          if (hasContent) {
            return {
              hasContent: true,
              message: "URL has content available",
            };
          }
        }

        if (attempt < maxAttempts) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), maxDelay);
          await new Promise((resolve) => setTimeout(resolve, delay));
          attempt++;
          continue;
        }

        return {
          hasContent: false,
          message: "URL has no content after maximum attempts",
        };
      } catch (error) {
        if (attempt < maxAttempts) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), maxDelay);
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

const RefreshToolsOutputSchema = z.object({
  success: z.boolean().describe("Whether the update was successful"),
  message: z.string().describe(
    "A message describing the result of the update attempt",
  ),
});

export const REFRESH_TOOLS = createInnateTool({
  id: "REFRESH_TOOLS",
  description:
    "Refresh the tools available to the agent, sometimes an MCP server is installed or uninstalled but the internal tools are not updated, use this tool to update the tools. This operation is slow, so use only when necessary. This tool do not update MCP server list. Also updates its instructions if necessary.",
  outputSchema: RefreshToolsOutputSchema,
  execute: (agent) => async () => {
    await agent.init();
    return Promise.resolve({
      success: true,
      message: "Tools updated successfully",
    });
  },
});

const ShowPickerInputSchema = z.object({
  options: z.array(z.object({
    label: z.string().describe("The display text for the option"),
    value: z.string().describe("The value of the option"),
    description: z.string().optional().describe(
      "Optional description of the option",
    ),
  })),
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
  execute: () => async ({ context }) => {
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
  execute: () => async ({ context }) => {
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

export const tools = {
  FETCH,
  GENERATE,
  POLL_FOR_CONTENT,
  REFRESH_TOOLS,
  RENDER,
  SHOW_PICKER,
  CONFIRM,
};

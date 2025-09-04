import { readSession } from "../../lib/session.js";
import { Buffer } from "node:buffer";

export interface FileChangeEvent {
  type: "added" | "modified" | "deleted";
  path: string;
  metadata?: {
    address: string;
    metadata: Record<string, unknown>;
    sizeInBytes: number;
    mtime: number;
    ctime: number;
  };
  timestamp: number;
  patchId: number;
}

export interface FileChangeEventWithContent extends FileChangeEvent {
  content?: Buffer; // File content for added/modified files
}

export interface WatchOptions {
  branchName: string;
  pathFilter?: string;
  fromCtime?: number;
  url?: string;
}

/**
 * Fetch file content using the READ_FILE MCP tool
 */
export async function fetchFileContent(
  filePath: string,
  branchName: string,
  baseUrl: string = "https://deconfig.deco.page",
): Promise<Buffer> {
  try {
    // Get authentication headers
    const session = await readSession();

    console.log(`${baseUrl}/mcp/call-tool/READ_FILE`, session?.access_token);
    // Call the READ_FILE tool via MCP
    const response = await fetch(`${baseUrl}/mcp/call-tool/READ_FILE`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({
        branch: branchName,
        path: filePath,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result: {
      error?: { message: string };
      result?: { content: string };
    } = await response.json();
    if (result.error || !result.result) {
      throw new Error(result.error?.message || "Failed to read file");
    }

    // Decode base64 content to Buffer
    return Buffer.from(result.result.content, "base64");
  } catch (error) {
    console.error(
      `❌ Failed to fetch content for ${filePath}:`,
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  }
}

/**
 * Put file content using the PUT_FILE MCP tool
 */
export async function putFileContent(
  filePath: string,
  content: Buffer | string,
  branchName: string,
  metadata?: Record<string, unknown>,
  baseUrl: string = "https://deconfig.deco.page",
): Promise<void> {
  try {
    // Get authentication headers
    const session = await readSession();

    // Convert content to base64
    const base64Content = Buffer.isBuffer(content)
      ? content.toString("base64")
      : Buffer.from(content).toString("base64");

    // Call the PUT_FILE tool via MCP
    const response = await fetch(`${baseUrl}/mcp/call-tool/PUT_FILE`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({
        branch: branchName,
        path: filePath,
        content: base64Content,
        metadata,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result: {
      error?: { message: string };
      result?: { success: boolean };
    } = await response.json();

    if (result.error || !result?.result) {
      throw new Error(result.error?.message || "Failed to put file");
    }
  } catch (error) {
    console.error(
      `❌ Failed to put file ${filePath}:`,
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  }
}

/**
 * Watch a deconfig branch for changes and call the callback with events including file content
 */
export async function watch(
  options: WatchOptions,
  callback: (event: FileChangeEventWithContent) => Promise<void> | void,
): Promise<void> {
  const {
    branchName,
    fromCtime = 1,
    pathFilter,
    url = "https://deconfig.deco.page",
  } = options;

  console.log(`📡 Watching branch "${branchName}" for changes...`);
  if (pathFilter) {
    console.log(`   🔍 Path filter: ${pathFilter}`);
  }

  // Build SSE URL
  const searchParams = new URLSearchParams();
  searchParams.set("branchName", branchName);
  searchParams.set("fromCtime", fromCtime.toString());

  if (pathFilter) {
    searchParams.set("pathFilter", pathFilter);
  }

  const sseUrl = `${url}/watch?${searchParams.toString()}`;

  // Set up SSE connection with retry logic
  let retryCount = 0;
  const maxRetries = 5;
  const retryDelay = 2000; // 2 seconds

  const connect = async (): Promise<void> => {
    console.log(`🔄 Connecting to SSE stream... (attempt ${retryCount + 1})`);

    try {
      // Get authentication headers
      const authHeaders = await readSession();

      // Use fetch with ReadableStream for Node.js compatibility
      const response = await fetch(sseUrl, {
        headers: {
          Accept: "text/event-stream",
          "Cache-Control": "no-cache",
          Authorization: `Bearer ${authHeaders?.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      console.log("✅ Connected to SSE stream");
      retryCount = 0; // Reset retry count on successful connection

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            console.log("📡 SSE stream ended");
            break;
          }

          // Decode and process SSE data
          const chunk = decoder.decode(value, { stream: true });
          console.log(`📦 Received chunk: ${JSON.stringify(chunk)}`);

          buffer += chunk;
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.trim()) {
              console.log(`📝 Processing line: ${JSON.stringify(line)}`);
            }
            await processSSELine(line, branchName, url, callback);
          }
        }
      } catch (error) {
        console.error("❌ Error reading SSE stream:", error);
        throw error;
      }
    } catch (error) {
      console.error(
        "❌ SSE connection failed:",
        error instanceof Error ? error.message : String(error),
      );

      if (retryCount < maxRetries) {
        retryCount++;
        console.log(`⏳ Retrying in ${retryDelay / 1000} seconds...`);
        setTimeout(() => {
          connect().catch((retryError) => {
            console.error(
              "❌ Retry failed:",
              retryError instanceof Error
                ? retryError.message
                : String(retryError),
            );
          });
        }, retryDelay);
      } else {
        throw new Error(`Failed to connect after ${maxRetries} attempts`);
      }
    }
  };

  // Start the connection
  await connect();
}

async function processSSELine(
  line: string,
  branchName: string,
  baseUrl: string,
  callback: (event: FileChangeEventWithContent) => Promise<void> | void,
): Promise<void> {
  if (!line.trim()) return;

  // Parse SSE format: "event: change" and "data: {...}"
  if (line.startsWith("event:")) {
    // Just log the event type for now
    const eventType = line.substring(6).trim();
    if (eventType === "change") {
      // We expect the data line next
    }
    return;
  }

  if (line.startsWith("data:")) {
    const jsonData = line.substring(5).trim();
    console.log(`🔍 Parsing JSON data: ${jsonData}`);

    try {
      const event: FileChangeEvent = JSON.parse(jsonData);
      console.log(`✅ Parsed event:`, event);

      // Fetch content for added/modified files
      const eventWithContent: FileChangeEventWithContent = { ...event };

      if (event.type === "added" || event.type === "modified") {
        console.log(`📥 Fetching content for ${event.path}...`);
        try {
          eventWithContent.content = await fetchFileContent(
            event.path,
            branchName,
            baseUrl,
          );
          console.log(
            `✅ Fetched content: ${eventWithContent.content?.length} bytes`,
          );
        } catch (error) {
          console.error(
            `❌ Failed to fetch content for ${event.path}:`,
            error instanceof Error ? error.message : String(error),
          );
          // Continue without content - let the callback decide how to handle
        }
      }

      // Call the user's callback
      console.log(`🔄 Calling callback for event: ${event.type} ${event.path}`);
      await callback(eventWithContent);
    } catch (error) {
      console.error("❌ Failed to parse SSE data:", jsonData, error);
    }
  }
}

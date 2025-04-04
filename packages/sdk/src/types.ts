import type { AddPanelOptions } from "dockview-react";
import type { MCPConnection } from "./models/mcp.ts";

// Sidebar item link.
export interface SidebarItemLink {
  // Label of the item
  label: string;
  // Icon of the item
  icon: string;
  // Link to the item
  href: string;
}

// Sidebar item.
export type NavItem = SidebarItemLink;

// Storage for the sidebar.
export interface SidebarStorage {
  // For each context, a list of items
  [context: string]: NavItem[];
}

export interface ShowLogin {
  title?: string;
  description?: string;
  returnUrl?: string;
}

type Context = TeamContext | UserContext;

type TeamContext = {
  type: "team";
  slug: string;
  root: string;
};

type UserContext = {
  type: "user";
  root: string;
};

export interface UIState {
  /** Boolean to hide/show sidebar */
  showSidebar?: boolean;
  /** Boolean to hide/show search */
  showSearch: boolean | Record<string, string>;
  /** Boolean to hide/show fileTree */
  showFileTree: boolean;
  /** Boolean to hide/show Feedback Form dialog*/
  showFeedbackDialog: boolean;
  /** Boolean to hide/show Feedback Form dialog*/
  showReactions: boolean;
  /** Displays upgrade plan modal */
  showUpgradePlan: boolean;
  /** Displays Add funds modal */
  showAddFundsToWallet: boolean;
  /** if request is done by mobile */
  isSSRMobile?: boolean;
  /** Publish App Modal */
  publishModalPathname?: string;
  /** Displays Login modal */
  showLogin: ShowLogin | null;
  /** Sidebar State */
  sidebarState: SidebarStorage | null;
  /** The context, like if we are in a team or a user context */
  context: Context;
  /** Domain of the current page */
  ssrDomain: string;
}

export interface GenerationOutput {
  filepath: string | string[];
}

export interface TextPart {
  /** The type of the message part */
  type: "text";
  /** The text content */
  text: string;
}

export interface ImagePart {
  /** The type of the message part */
  type: "image";
  /** The image content of the message part. String are either base64 encoded content, base64 data URLs, or http(s) URLs */
  image: string | Uint8Array | ArrayBuffer | URL;
  /** The mime type of the image. Optional */
  mimeType?: string;
}

export interface FilePart {
  /** The type of the message part */
  type: "file";
  /** The file content of the message part. String are either base64 encoded content, base64 data URLs, or http(s) URLs */
  data: string | Uint8Array | ArrayBuffer | URL;
  /** The mime type of the file */
  mimeType: string;
}

export interface ReasoningPart {
  /** The type of the message part */
  type: "reasoning";
  /** The reasoning text */
  text: string;
  /** Optional signature for the reasoning */
  signature?: string;
}

export interface RedactedReasoningPart {
  /** The type of the message part */
  type: "redacted-reasoning";
  /** The redacted data content */
  data: string;
}

export interface ToolCallPart {
  /** The type of the message part */
  type: "tool-call";
  /** The id of the tool call */
  toolCallId: string;
  /** The name of the tool */
  toolName: string;
  /** Parameters for the tool based on its schema */
  args: Record<string, unknown>;
}

export interface ToolResultPart {
  /** The type of the message part */
  type: "tool-result";
  /** The id of the tool call this result corresponds to */
  toolCallId: string;
  /** The name of the tool this result corresponds to */
  toolName: string;
  /** The result returned by the tool */
  result: unknown;
  /** Whether the result is an error */
  isError?: boolean;
}

type AssistantMessagePart =
  | TextPart
  | ReasoningPart
  | RedactedReasoningPart
  | ToolCallPart;

type ToolMessagePart = ToolResultPart[];

type UserMessagePart =
  | TextPart
  | ImagePart
  | FilePart;

export interface CoreSystemMessage {
  /** The role of the message sender */
  role: "system";
  /** The message content */
  content: string;
}

export interface CoreUserMessage {
  /** The role of the message sender */
  role: "user";
  /** The message content - can be string or array of text, image, or file parts */
  content: string | UserMessagePart[];
  /** Optional name of the user */
  name?: string;
}

export interface CoreAssistantMessage {
  /** The role of the message sender */
  role: "assistant";
  /** The message content - can be string or array of specific assistant message parts */
  content: string | AssistantMessagePart[];
  /** Optional name of the assistant */
  name?: string;
  /** Optional function call details */
  function_call?: {
    /** Name of the function to call */
    name: string;
    /** Arguments for the function in JSON string format */
    arguments: string;
  };
}

export interface CoreToolMessage {
  /** The role of the message sender */
  role: "tool";
  /** The response content from the tool/function as an array of tool results */
  content: ToolMessagePart;
  /** Name of the tool/function that was called */
  name: string;
  /** ID of the tool call this message is responding to */
  tool_call_id: string;
}

export type Message =
  | CoreSystemMessage
  | CoreUserMessage
  | CoreAssistantMessage
  | CoreToolMessage;

/** All available language models that can be used for text generation */
export type TextModel =
  // OpenAI Models
  | "openai:gpt-4-turbo"
  | "openai:gpt-4"
  | "openai:gpt-4o"
  | "openai:gpt-4o-mini"
  | "openai:o1-preview"
  | "openai:o1-mini"
  | "openai:o1"
  | "openai:o3-mini"
  | "openai:gpt-4o-audio-preview"
  | "openai:gpt-4.5-preview"
  // Anthropic Models
  | "anthropic:claude-3-5-sonnet-latest"
  | "anthropic:claude-3-7-sonnet-latest"
  | "anthropic:claude-3-5-haiku-20241022"
  // Google Models
  | "google:gemini-2.0-flash"
  | "google:gemini-2.0-flash-lite-preview-02-05"
  | "google:gemini-1.5-pro-latest"
  | "google:gemini-1.5-flash"
  // Mistral Models
  | "mistral:pixtral-large-latest"
  | "mistral:mistral-large-latest"
  | "mistral:mistral-small-latest"
  | "mistral:pixtral-12b-2409"
  // Deepseek Models
  | "deepseek:deepseek-chat"
  | "deepseek:deepseek-reasoner"
  // Perplexity Models
  | "perplexity:sonar-pro"
  | "perplexity:sonar"
  | "perplexity:llama-3.1-sonar-small-128k-online"
  | "perplexity:llama-3.1-sonar-large-128k-online"
  | "perplexity:llama-3.1-sonar-huge-128k-online"
  // XAI Models
  | "xai:grok-2-latest"
  | "xai:grok-2-vision-latest"
  // Pinecone Models
  | "pinecone:*";

export interface GenerateTextOptions<T extends TextModel> {
  /** The input prompt to generate the text from */
  prompt?: string;
  /** The system prompt that specifies the behavior of the model */
  system?: string;
  /** A list of messages that represent a conversation. Automatically converts UI messages */
  messages?: Message[];
  /** The language model to use for text generation */
  model?: T;
  /** Additional provider-specific options passed directly to the model */
  providerOptions?: GenericProviderOptions;
}

export type AudioModel =
  | "elevenlabs:tts"
  | "elevenlabs:tts-timestamps"
  | "elevenlabs:voice-changer"
  | "elevenlabs:sound-effects"
  | "elevenlabs:audio-isolation"
  | "elevenlabs:text-to-voice"
  | "replicate:meta/musicgen";

export type ElevenLabsProviderOptions = {
  /** ElevenLabs specific options */
  elevenLabs?: {
    /** ID of the voice to use */
    voiceId: string;
    /** Streaming latency optimization level (0-4) */
    optimize_streaming_latency: number;
    /** Voice configuration settings */
    voice_settings: {
      /** Speed of speech (default: 1) */
      speed: number;
      /** Voice similarity boost factor (0-1) */
      similarity_boost: number;
      /** Voice stability factor (0-1) */
      stability: number;
      /** Style factor (default: 0) */
      style: number;
    };
  };
};

export type GenericProviderOptions = Record<string, unknown>;

export interface GenerateAudioOptions<T extends AudioModel> {
  /** The input prompt to generate audio from */
  prompt?: string;
  /** The system prompt that specifies the behavior of the model */
  /** A list of messages that represent a conversation. Automatically converts UI messages */
  messages?: Message[];
  /** The audio model to use for generation */
  model?: T;
  /** Provider-specific options for audio generation */
  providerOptions?: T extends "elevenlabs:tts" ? ElevenLabsProviderOptions
    : GenericProviderOptions;
}

// File system module interfaces
export interface FileSystemOptions {
  /** Encoding to use for file operations */
  encoding?: string;
  /** File mode (permissions) */
  mode?: number;
  /** File flags */
  flag?: string;
}

export interface FileSystemDirent {
  name: string;
  isFile: () => boolean;
  isDirectory: () => boolean;
}

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

export interface MCPToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface MCPToolCallResult {
  content: unknown;
  error?: string;
}

export type ISDK = {
  ai: {
    /**
     * Generates text and calls tools for a given prompt using a language model.
     * Ideal for non-interactive use cases such as automation tasks where you need to write text
     * (e.g. drafting email or summarizing web pages) and for agents that use tools.
     *
     * @see {@link https://sdk.vercel.ai/docs/reference/ai-sdk-core/generate-text} for detailed documentation
     *
     * @example
     * ```typescript
     * const { filepath } = await SDK.ai.generateText({
     *   model: 'gpt-4-turbo',
     *   prompt: 'Invent a new holiday and describe its traditions.'
     * });
     * ```
     *
     * @param options - Configuration options for text generation
     * @returns Promise resolving to the generation output containing filepath(s)
     */
    generateText: <T extends TextModel>(
      options: GenerateTextOptions<T>,
      requestInit?: RequestInit,
    ) => Promise<GenerationOutput>;
    generateImage: <T extends TextModel>(
      options: GenerateTextOptions<T>,
      requestInit?: RequestInit,
    ) => Promise<GenerationOutput>;
    generateVideo: <T extends TextModel>(
      options: GenerateTextOptions<T>,
      requestInit?: RequestInit,
    ) => Promise<GenerationOutput>;
    generateAudio: <T extends AudioModel>(
      options: GenerateAudioOptions<T>,
      requestInit?: RequestInit,
    ) => Promise<GenerationOutput>;
  };
  fs: {
    /**
     * Reads a file from the filesystem.
     *
     * @example
     * ```typescript
     * // Read a file as text
     * const content = await SDK.fs.readFile('/path/to/file.txt', { encoding: 'utf8' });
     *
     * // Read a file as binary data
     * const data = await SDK.fs.readFile('/path/to/image.png');
     * ```
     *
     * @param path - Path to the file to read
     * @param options - Options for reading the file
     * @returns Promise resolving to the file contents
     */
    read: (
      path: string,
      options?: FileSystemOptions,
    ) => Promise<string>;

    /**
     * Writes data to a file, replacing the file if it already exists.
     *
     * @example
     * ```typescript
     * // Write text to a file
     * await SDK.fs.writeFile('/path/to/file.txt', 'Hello, world!', { encoding: 'utf8' });
     *
     * // Write binary data to a file
     * await SDK.fs.writeFile('/path/to/image.png', imageBuffer);
     * ```
     *
     * @param path - Path to the file to write
     * @param data - Data to write to the file
     * @param options - Options for writing the file
     * @returns Promise that resolves when the file has been written
     */
    write: (
      path: string,
      data: string | Uint8Array,
      options?: FileSystemOptions,
    ) => Promise<void>;

    /**
     * Listens for changes to a file.
     *
     * @example
     * ```typescript
     * const unsubscribe = SDK.fs.onChange((event) => {
     *   console.log(event.path);
     * });
     * ```
     *
     * @param callback - Callback function to be called when a file changes
     * @returns Unsubscribe function to stop listening for changes
     */
    onChange: (
      callback: (event: { filename: string; path: string }) => void,
    ) => void | (() => void);

    /**
     * Lists files and directories in a directory.
     *
     * @example
     * ```typescript
     * const files = await SDK.fs.list('/path/to/directory');
     * ```
     *
     * @param filter - Starting path to list
     * @returns Promise resolving to an array of file paths
     */
    list: (
      filter: string,
      options?: { recursive?: boolean },
    ) => Promise<string[]>;

    /**
     * Resolves a path to a full path.
     * ~/ is transformed to the context's home directory.
     * ./ or path/to/file is transformed to the current working directory.
     * /path/to/file is transformed to the root directory.
     *
     * @param path - The path to resolve
     * @returns The resolved path
     */
    resolvePath: (path: string) => Promise<string>;

    /**
     * Checks if a file exists.
     *
     * @example
     * ```typescript
     * const exists = await SDK.fs.exists('/path/to/file.txt');
     * ```
     *
     * @param path - The path to check
     * @returns Promise resolving to true if the file exists, false otherwise
     */
    exists: (path: string) => Promise<boolean>;

    /**
     * Deletes a file.
     *
     * @example
     * ```typescript
     * await SDK.fs.unlink('/path/to/file.txt');
     * ```
     *
     * @param path - The path to the file to delete
     * @returns Promise resolving to void
     */
    unlink: (path: string) => Promise<void>;
  };
  os: {
    /**
     * Returns the current UI state.
     *
     * @returns The current UI state
     */
    state: () => UIState;
    /**
     * Dispatches an event to the UI.
     *
     * @param event - The event to dispatch
     */
    dispatch: (event: { type: string; payload: unknown }) => void;
    /**
     * Navigates to a new path on the parent window.
     *
     * @param path - The path to navigate to
     */
    navigate: (path: string) => void;
    /**
     * Listens for UI updates.
     *
     * @param callback - The callback to call when the UI state changes
     */
    onUIUpdate: (callback: (state: UIState) => void) => void;
  };

  mcps: {
    /**
     * Installs a new MCP server from registry.
     *
     * @param appId - The URL of the MCP server to install
     * @returns Promise resolving to the installation URL
     */
    install: (appId: string) => Promise<{ installation: string }>;

    /**
     * Lists all available tools from an MCP server.
     *
     * @param connection - The URL of the MCP server
     * @returns Promise resolving to an array of tools
     */
    listTools: (connection: MCPConnection) => Promise<{
      tools: MCPTool[];
      instructions: string;
      capabilities: Record<string, unknown>;
      version: { name: string; version: string };
    }>;

    /**
     * Calls a tool on an MCP server.
     *
     * @param connection - The URL of the MCP server
     * @param toolCall - The tool call details
     * @returns Promise resolving to the tool call result
     */
    toolCall: (
      connection: MCPConnection,
      toolCall: MCPToolCall,
    ) => Promise<MCPToolCallResult>;
  };

  /**
   * CORS enabled fetch by using a server side proxy.
   *
   * @example
   * ```typescript
   * const response = await SDK.fetch('https://webdraw.com/proxy', {
   *   method: 'GET',
   * });
   * ```
   */
  fetch: typeof fetch;
  layout: {
    addPanel: (payload: AddPanelOptions) => void;
    removePanel: (payload: { id: string }) => void;
  };
};

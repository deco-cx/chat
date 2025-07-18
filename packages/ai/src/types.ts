// deno-lint-ignore-file no-explicit-any
import type { JSONSchema7 } from "@ai-sdk/provider";
import type { Actor } from "@deco/actors";
import type { GenerateOptions, StreamOptions, Toolset } from "@deco/sdk/models";
import type { StorageThreadType } from "@mastra/core";
import type {
  GenerateObjectResult,
  GenerateTextResult,
  Message as AIMessage,
} from "ai";
import type { AgentMetadata } from "./agent.ts";
export type { TriggerData } from "./triggers/trigger.ts";
export type { GenerateOptions, StreamOptions, Toolset };

/**
 * Represents a tool that can be used by an AI agent
 */
export interface Tool {
  /** Name of the tool */
  name: string;
  /** Description of what the tool does */
  description: string;
  /** Optional JSON schema defining the expected input format */
  inputSchema?: any;
  /** Optional JSON schema defining the expected output format */
  ouputSchema?: any;
}

/**
 * Represents possible message formats that can be sent in a thread
 * Can be a single string, array of strings, or array of CoreMessages
 */
export type Message = AIMessage | AudioMessage;

export interface AudioMessage extends Omit<AIMessage, "content"> {
  audioBase64: string;
}

export interface ThreadQueryOptions {
  /**
   * Whether to include the agent's metadata in the query
   */
  threadId?: string;
}

/**
 * Represents a thread in the memory
 */
export type Thread = StorageThreadType;

/**
 * Interface for an AI agent that can generate responses and use tools
 * Extends the base Actor interface
 */
export interface AIAgent extends Actor {
  metadata?: AgentMetadata;

  /**
   * Generates a response based on the provided input
   * @param payload - Input content as string, string array, or CoreMessage array
   * @returns Promise containing the generated text result
   */
  generate(
    payload: Message[],
    options?: GenerateOptions,
  ): Promise<GenerateTextResult<any, any>>;

  /**
   * Generates an object based on the provided input
   * @param payload - Input content as string, string array, or CoreMessage array
   * @param jsonSchema - JSON schema defining the expected output format
   * @returns Promise containing the generated object result
   */
  generateObject<TObject = any>(
    payload: Message[],
    jsonSchema: JSONSchema7,
  ): Promise<GenerateObjectResult<TObject>>;

  /**
   * Creates a new thread
   * @param thread - Thread to create
   * @returns Promise containing the created thread
   */
  createThread(thread: Thread): Promise<Thread>;

  /**
   * Queries messages in the thread
   * @returns Promise containing messages and their UI-formatted versions
   */
  query(options?: ThreadQueryOptions): Promise<AIMessage[]>;

  /**
   * Streams a response based on the provided input
   * @param payload - Input content as string, string array, or CoreMessage array
   * @returns AsyncIterator that yields text stream parts and final result
   */
  stream(payload: Message[], options?: StreamOptions): Promise<Response>;

  /**
   * Calls a specific tool with the given input
   * @param tool - Name of the tool to call
   * @param input - Input data for the tool
   * @returns Promise containing the tool's execution result
   */
  callTool(tool: string, input: any): Promise<any>;

  /**
   * Optional method to retrieve the set of available tools
   * @returns Promise or direct object containing categorized tool definitions
   */
  toolset?():
    | Promise<Record<string, Record<string, Tool>>>
    | Record<string, Record<string, Tool>>;

  /**
   * Retrieves the name of the agent
   * @returns string containing the agent name
   */
  getAgentName(): string;

  /**
   * Transcribes audio to text
   * @param audioBase64 - Base64 encoded audio data
   * @returns Promise containing the transcription result
   */
  listen(buffer: Uint8Array): Promise<string | void | NodeJS.ReadableStream>;
}

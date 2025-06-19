import type { Workspace } from "@deco/sdk/path";
import type { Client as LibSQLClient } from "@libsql/client";
import type { StorageThreadType } from "@mastra/core";
import type { SharedMemoryConfig } from "@mastra/core/memory";
import { Memory as MastraMemory } from "@mastra/memory";
import { slugify, slugifyForDNS, toAlphanumericId } from "../mcp/slugify.ts";
import { LibSQLFactory, type LibSQLFactoryOpts } from "./libsql.ts";
import { createOpenAI } from "@ai-sdk/openai";
import { MemoryProcessor } from "@mastra/core/memory";
import type { CoreMessage } from "@mastra/core";
import type { TextPart, ToolCallPart } from "ai";

export { slugify, slugifyForDNS, toAlphanumericId };
type CreateThreadOpts = Parameters<MastraMemory["createThread"]>[0];

interface WorkspaceMemoryConfig extends SharedMemoryConfig {
  libsqlClient: LibSQLClient;
}

interface CreateWorkspaceMemoryOpts
  extends LibSQLFactoryOpts, Omit<SharedMemoryConfig, "storage" | "vector"> {
  workspace: Workspace;
  discriminator?: string;
  openAPIKey?: string;
}

const openAIEmbedder = (apiKey: string) =>
  createOpenAI({ apiKey }).embedding("text-embedding-3-small");

export class WorkspaceMemory extends MastraMemory {
  constructor(protected config: WorkspaceMemoryConfig) {
    // @ts-ignore: "ignore this for now"
    super(config);
  }

  static async buildWorkspaceMemoryOpts({
    workspace,
    tursoAdminToken,
    tursoOrganization,
    tokenStorage,
    discriminator,
    ...opts
  }: CreateWorkspaceMemoryOpts) {
    const memoryId = buildMemoryId(workspace, discriminator);

    const libsqlFactory = new LibSQLFactory({
      tursoAdminToken,
      tursoOrganization,
      tokenStorage,
    });

    const libsqlClient = await libsqlFactory.createRawClient(memoryId);

    const embedder = opts.openAPIKey
      ? openAIEmbedder(opts.openAPIKey)
      : undefined;

    return {
      libsqlClient,
      ...(await libsqlFactory.create({ memoryId })),
      ...opts,
      embedder,
    };
  }

  static async create(opts: CreateWorkspaceMemoryOpts) {
    const config = await WorkspaceMemory.buildWorkspaceMemoryOpts(opts);
    return new WorkspaceMemory(config);
  }

  async listThreads(agentId?: string) {
    try {
      const sql = agentId
        ? `SELECT * FROM mastra_threads WHERE metadata->>'agentId' = ?`
        : `SELECT * FROM mastra_threads`;
      const args = agentId ? [agentId] : [];

      const result = await this.config.libsqlClient.execute({
        sql,
        args,
      });

      if (!result.rows) {
        return [];
      }

      return result.rows.map((thread) => ({
        id: thread.id,
        resourceId: thread.resourceId,
        title: thread.title,
        createdAt: thread.createdAt,
        updatedAt: thread.updatedAt,
        metadata: typeof thread.metadata === "string"
          ? JSON.parse(thread.metadata)
          : thread.metadata,
        // deno-lint-ignore no-explicit-any
      })) as any as StorageThreadType[];
    } catch (error) {
      console.error("Error listing threads", error);
      return [];
    }
  }
}

export interface AgentMemoryConfig extends WorkspaceMemoryConfig {
  agentId: string;
}

type CreateAgentMemoryOpts = CreateWorkspaceMemoryOpts & {
  agentId: string;
};

export class AgentMemory extends WorkspaceMemory {
  constructor(protected override config: AgentMemoryConfig) {
    super(config);
  }

  override createThread(opts: CreateThreadOpts) {
    return super.createThread({
      ...opts,
      metadata: {
        ...opts.metadata,
        agentId: this.config.agentId,
      },
    });
  }

  async listAgentThreads() {
    return await this.listThreads(this.config.agentId);
  }

  static async buildAgentMemoryConfig(config: CreateAgentMemoryOpts) {
    const workspaceMemoryConfig = await WorkspaceMemory
      .buildWorkspaceMemoryOpts(config);
    return {
      ...workspaceMemoryConfig,
      agentId: config.agentId,
    };
  }

  static override async create(config: CreateAgentMemoryOpts) {
    const agentMemoryConfig = await AgentMemory.buildAgentMemoryConfig(config);
    return new AgentMemory(agentMemoryConfig);
  }
}

export function buildMemoryId(workspace: Workspace, discriminator?: string) {
  return toAlphanumericId(
    `${workspace}/${discriminator ?? "default"}`,
  );
}

export class PatchToolCallProcessor extends MemoryProcessor {
  constructor() {
    super({ name: "PatchToolCallProcessor" });
  }

  override process(
    messages: CoreMessage[],
  ): CoreMessage[] {
    return patchToolCallProcessor(messages);
  }
}

const isToolCallMessage = (message: CoreMessage): boolean => {
  if (
    typeof message !== "object" || !("role" in message) ||
    message.role !== "assistant"
  ) {
    return false;
  }

  if (!Array.isArray(message.content)) {
    return false;
  }

  return message.content.some((part) =>
    typeof part === "object" && part.type === "tool-call"
  );
};

const isToolResultMessage = (message: CoreMessage): boolean => {
  return typeof message === "object" && "role" in message &&
    message.role === "tool";
};

const patchToolCallProcessor = (
  processedMessages: CoreMessage[],
): CoreMessage[] => {
  const condensedMessages: CoreMessage[] = [];
  let i = 0;

  while (i < processedMessages.length) {
    // Check if current message is a tool-call message and next is a tool-result message
    if (
      i < processedMessages.length - 1 &&
      isToolCallMessage(processedMessages[i]) &&
      isToolResultMessage(processedMessages[i + 1])
    ) {
      const toolCallMessage = processedMessages[i];

      // Find the tool call part in the content
      const toolCallPart =
        (toolCallMessage.content as (TextPart | ToolCallPart)[]).find((
          part,
        ): part is ToolCallPart =>
          typeof part === "object" && part.type === "tool-call"
        );

      if (!toolCallPart) {
        // If no tool call part found, keep message as is
        condensedMessages.push(processedMessages[i]);
        i += 1;
        continue;
      }

      const toolCallContent: (TextPart | ToolCallPart)[] = [];

      // Add any text parts first
      for (const part of toolCallMessage.content) {
        if (typeof part === "string") {
          toolCallContent.push({
            type: "text",
            text: part,
          });
        } else if (typeof part === "object" && part.type === "text") {
          toolCallContent.push(part as TextPart);
        }
      }

      // Add the summarized tool call as text
      toolCallContent.push({
        type: "text",
        text: JSON.stringify({
          type: "tool-call",
          toolName: toolCallPart.toolName,
          args: toolCallPart.args,
        }),
      });

      const relevantToolCallMessage: CoreMessage = {
        role: "assistant",
        content: toolCallContent,
      };
      const toolResultMessage = processedMessages[i + 1];

      // Create a condensed message with both messages as JSON content
      const condensedMessage: CoreMessage = {
        role: "assistant",
        content: JSON.stringify({
          toolCall: relevantToolCallMessage,
          toolResult: toolResultMessage,
        }),
      };

      condensedMessages.push(condensedMessage);

      // Skip the next message since we processed both
      i += 2;
    } else {
      // Keep the message as is
      condensedMessages.push(processedMessages[i]);
      i += 1;
    }
  }

  return condensedMessages;
};

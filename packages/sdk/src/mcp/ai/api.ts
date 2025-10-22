import { createLLMInstance, getLLMConfig } from "@deco/ai/agent/llm";
import {
  generateObject,
  generateText,
  jsonSchema,
  ModelMessage,
  type LanguageModelUsage,
} from "ai";
import { z } from "zod";
import { DEFAULT_MODEL, WELL_KNOWN_MODELS } from "../../constants.ts";
import type { PlanWithTeamMetadata } from "../../plan.ts";
import {
  assertHasWorkspace,
  assertHasLocator,
  assertWorkspaceResourceAccess,
} from "../assertions.ts";
import { type AppContext, createToolGroup } from "../context.ts";
import { InternalServerError, SupabaseLLMVault } from "../index.ts";
import type { LLMUsageEvent, Transaction } from "../wallet/client.ts";
import {
  createWalletClient,
  MicroDollar,
  WellKnownWallets,
} from "../wallet/index.ts";
import { getPlan } from "../wallet/plans.ts";
import { MessageList } from "@mastra/core/agent";

const createLLMUsageTransaction = (opts: {
  usage: LanguageModelUsage;
  model: string;
  modelId: string;
  plan: PlanWithTeamMetadata;
  hasCustomKey: boolean;
  userId: string;
  workspace: string;
}): Transaction => {
  const usage = {
    workspace: opts.workspace,
    model: opts.model,
    usage: {
      ...opts.usage,
      promptTokens: opts.usage.inputTokens ?? 0,
      completionTokens: opts.usage.outputTokens ?? 0,
      totalTokens: opts.usage.totalTokens ?? 0,
    },
  } satisfies LLMUsageEvent;

  return {
    type: "LLMGeneration" as const,
    generatedBy: {
      type: "user",
      id: opts.userId,
    },
    vendor: {
      type: "vendor",
      id: opts.modelId,
    },
    payer: opts.hasCustomKey
      ? {
          type: "wallet",
          id: WellKnownWallets.build(
            ...WellKnownWallets.llmVaultCredits(opts.workspace, opts.modelId),
          ),
        }
      : undefined,
    usage,
    metadata: opts,
    timestamp: new Date(),
  };
};

const getWalletClient = (c: AppContext) => {
  if (!c.envVars.WALLET_API_KEY) {
    throw new InternalServerError("WALLET_API_KEY is not set");
  }
  return createWalletClient(c.envVars.WALLET_API_KEY, c.walletBinding);
};

// Common helper functions
const validateWalletBalance = async (c: AppContext) => {
  assertHasWorkspace(c);
  const wallet = getWalletClient(c);
  const workspaceWalletId = WellKnownWallets.build(
    ...WellKnownWallets.workspace.genCredits(c.workspace.value),
  );

  const balanceResponse = await wallet["GET /accounts/:id"]({
    id: encodeURIComponent(workspaceWalletId),
  });

  if (balanceResponse.status === 404) {
    throw new InternalServerError("Insufficient funds");
  }

  if (!balanceResponse.ok) {
    throw new InternalServerError("Failed to check wallet balance");
  }

  const balanceData = await balanceResponse.json();
  const balance = MicroDollar.fromMicrodollarString(balanceData.balance);

  if (balance.isNegative() || balance.isZero()) {
    throw new InternalServerError("Insufficient funds");
  }

  return { wallet };
};

const setupLLMInstance = async (modelId: string, c: AppContext) => {
  assertHasWorkspace(c);
  assertHasLocator(c);
  const wellKnownModel = WELL_KNOWN_MODELS.find(
    (model) => model.id === modelId,
  );
  const llmVault =
    wellKnownModel || !c.envVars.LLMS_ENCRYPTION_KEY
      ? undefined
      : new SupabaseLLMVault(c);
  const llmConfig = await getLLMConfig({
    modelId,
    llmVault,
  });

  const { llm } = createLLMInstance({
    ...llmConfig,
    envs: c.envVars as Record<string, string>,
    metadata: {
      workspace: c.workspace.value,
    },
  });

  return { llm, llmConfig, usedVault: !!llmVault };
};

const processTransaction = async (
  wallet: ReturnType<typeof getWalletClient>,
  usage: LanguageModelUsage,
  modelId: string,
  hasCustomKey: boolean,
  c: AppContext,
) => {
  assertHasWorkspace(c);
  const plan = await getPlan(c);
  const transaction = createLLMUsageTransaction({
    usage,
    model: modelId,
    modelId,
    plan,
    hasCustomKey,
    userId:
      typeof c.user?.id === "string"
        ? c.user?.id
        : `apikey-${c.workspace.value}`,
    workspace: c.workspace.value,
  });

  const response = await wallet["POST /transactions"](
    {},
    {
      body: transaction,
    },
  );

  if (!response.ok) {
    console.error(
      "Failed to create transaction",
      response,
      await response.text(),
    );
    throw new InternalServerError("Failed to create transaction");
  }

  const transactionData = await response.json();
  return transactionData.id;
};

const createTool = createToolGroup("AI", {
  name: "AI Gateway",
  description:
    "Unified LLM API, keeping the centralized observability and billing.",
  icon: "https://assets.decocache.com/mcp/6e1418f7-c962-406b-aceb-137197902709/ai-gateway.png",
});

// Common input schema for messages
export const baseMessageSchema = z
  .array(
    z.object({
      id: z.string().optional(),
      role: z.enum(["user", "assistant", "system"]),
      content: z.string(),
      createdAt: z.date().optional(),
      experimental_attachments: z
        .array(
          z.object({
            name: z
              .string()
              .optional()
              .describe("The name of the attachment, usually the file name"),
            contentType: z
              .string()
              .optional()
              .describe("Media type of the attachment"),
            url: z
              .string()
              .describe("URL of the attachment (hosted file or Data URL)"),
          }),
        )
        .optional()
        .describe("Additional attachments to be sent along with the message"),
    }),
  )
  .describe("Array of messages for the conversation");

const baseGenerationOptionsSchema = z.object({
  model: z
    .string()
    .optional()
    .describe("Model ID to use for generation (defaults to workspace default)"),
  maxTokens: z
    .number()
    .default(8192)
    .optional()
    .describe("Maximum number of tokens to generate"),
  temperature: z
    .number()
    .default(0.7)
    .optional()
    .describe("Temperature for the generation"),
  tools: z
    .record(z.string(), z.array(z.string()))
    .optional()
    .describe("Tools available for the generation"),
});

// Common usage schema
const usageSchema = z
  .object({
    promptTokens: z.number().describe("Number of tokens in the prompt"),
    completionTokens: z.number().describe("Number of tokens in the completion"),
    totalTokens: z.number().describe("Total number of tokens used"),
    transactionId: z.string().optional().describe("Transaction ID"),
  })
  .describe("Token usage information");

const AIGenerateInputSchema = z
  .object({
    messages: baseMessageSchema,
    skipTransaction: z
      .boolean()
      .optional()
      .describe("Skip transaction creation"),
  })
  .merge(baseGenerationOptionsSchema);

const AIGenerateOutputSchema = z.object({
  text: z.string().describe("The generated text response"),
  usage: usageSchema,
  finishReason: z
    .string()
    .optional()
    .describe("Reason why generation finished"),
});

const AIGenerateObjectInputSchema = z
  .object({
    messages: baseMessageSchema,
    schema: z
      .record(z.any())
      .describe(
        "JSON Schema that defines the structure of the object to generate",
      ),
    skipTransaction: z
      .boolean()
      .optional()
      .describe("Skip transaction creation"),
  })
  .merge(baseGenerationOptionsSchema);

const AIGenerateObjectOutputSchema = z.object({
  object: z
    .any()
    .describe("The generated object according to the provided schema"),
  usage: usageSchema,
  finishReason: z
    .string()
    .optional()
    .describe("Reason why generation finished"),
});

export const aiGenerate = createTool({
  name: "AI_GENERATE",
  description:
    "Generate text using AI models directly without agent context (stateless)",
  inputSchema: AIGenerateInputSchema,
  outputSchema: AIGenerateOutputSchema,
  handler: async (input, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    const { wallet } = await validateWalletBalance(c);
    const modelId = input.model ?? DEFAULT_MODEL.id;
    const { llm, llmConfig, usedVault } = await setupLLMInstance(modelId, c);

    const result = await generateText({
      model: llm,
      messages: convertMessages(input.messages),
      maxOutputTokens: input.maxTokens,
      temperature: input.temperature,
    });

    const hasCustomKey =
      !!c.envVars.LLMS_ENCRYPTION_KEY &&
      !WELL_KNOWN_MODELS.find((model) => model.id === modelId);

    const shouldSkip = (input.skipTransaction && usedVault) ?? false;

    const transactionId = shouldSkip
      ? undefined
      : await processTransaction(
          wallet,
          result.usage,
          hasCustomKey ? llmConfig.model : modelId,
          hasCustomKey,
          c,
        );

    return {
      text: result.text,
      usage: {
        promptTokens: result.usage.inputTokens ?? 0,
        completionTokens: result.usage.outputTokens ?? 0,
        totalTokens: result.usage.totalTokens ?? 0,
        transactionId: transactionId ?? undefined,
      },
      finishReason: result.finishReason,
    };
  },
});

const convertMessages = (
  messages: z.infer<typeof baseMessageSchema>,
): ModelMessage[] => {
  // Convert experimental_attachments to proper content structure
  const converted = messages.map((msg) => {
    // If there are no attachments, just return the message as-is
    if (
      !msg.experimental_attachments ||
      msg.experimental_attachments.length === 0
    ) {
      return {
        role: msg.role,
        content: msg.content,
      } as ModelMessage;
    }

    // Convert to structured content with text and image/file parts
    const contentParts = [];

    // Add text part if content is not empty
    if (msg.content) {
      contentParts.push({
        type: "text",
        text: msg.content,
      });
    }

    // Convert attachments to image or file parts
    for (const attachment of msg.experimental_attachments) {
      const contentType = attachment.contentType?.toLowerCase();

      // Check if it's an image
      if (contentType?.startsWith("image/")) {
        contentParts.push({
          type: "image",
          image: attachment.url,
          mimeType: attachment.contentType,
        });
      } else {
        // Treat as file
        contentParts.push({
          type: "file",
          data: attachment.url,
          mimeType: attachment.contentType || "application/octet-stream",
          ...(attachment.name && { filename: attachment.name }),
        });
      }
    }

    return {
      role: msg.role,
      content: contentParts,
    } as ModelMessage;
  });

  const messageList = new MessageList({
    generateMessageId: () => Math.random().toString(36).substring(2, 15),
  });

  // Preserve chronological order by iterating messages sequentially
  for (const message of converted) {
    switch (message.role) {
      case "user":
        messageList.add(message, "user");
        break;
      case "assistant":
        messageList.add(message, "response");
        break;
      case "system":
        messageList.addSystem(message);
        break;
    }
  }

  return messageList.get.all.aiV5.prompt();
};

export const aiGenerateObject = createTool({
  name: "AI_GENERATE_OBJECT",
  description:
    "Generate structured objects using AI models with JSON schema validation",
  inputSchema: AIGenerateObjectInputSchema,
  outputSchema: AIGenerateObjectOutputSchema,
  handler: async (input, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    const { wallet } = await validateWalletBalance(c);
    const modelId = input.model ?? DEFAULT_MODEL.id;
    const { llm, llmConfig, usedVault } = await setupLLMInstance(modelId, c);

    const hasCustomKey =
      !!c.envVars.LLMS_ENCRYPTION_KEY &&
      !WELL_KNOWN_MODELS.find((model) => model.id === modelId);

    const result = await generateObject({
      system:
        "You are a helpful assistant that generates JSON objects based on the user's messages and the schema provided.",
      model: llm,
      mode: "json",
      maxRetries: 1,
      messages: convertMessages(input.messages),
      schema: jsonSchema(input.schema),
      maxOutputTokens: input.maxTokens,
      temperature: input.temperature,
    });

    const shouldSkip = (input.skipTransaction && usedVault) ?? false;

    const transactionId = shouldSkip
      ? undefined
      : await processTransaction(
          wallet,
          result.usage,
          hasCustomKey ? llmConfig.model : modelId,
          hasCustomKey,
          c,
        );

    return {
      object: result.object,
      usage: {
        promptTokens: result.usage.inputTokens ?? 0,
        completionTokens: result.usage.outputTokens ?? 0,
        totalTokens: result.usage.totalTokens ?? 0,
        transactionId: transactionId ?? undefined,
      },
      finishReason: result.finishReason,
    };
  },
});

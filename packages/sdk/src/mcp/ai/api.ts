import { convertToAIMessage } from "@deco/ai/agent/ai-message";
import { createLLMInstance, getLLMConfig } from "@deco/ai/agent/llm";
import { generateText, type LanguageModelUsage } from "ai";
import { z } from "zod";
import { DEFAULT_MODEL } from "../../constants.ts";
import type { PlanWithTeamMetadata } from "../../plan.ts";
import {
  assertHasWorkspace,
  assertWorkspaceResourceAccess,
} from "../assertions.ts";
import { type AppContext, createToolGroup } from "../context.ts";
import { InternalServerError, SupabaseLLMVault } from "../index.ts";
import type { Transaction } from "../wallet/client.ts";
import {
  createWalletClient,
  MicroDollar,
  WellKnownWallets,
} from "../wallet/index.ts";
import { getPlan } from "../wallet/plans.ts";

const createLLMUsageTransaction = (opts: {
  usage: LanguageModelUsage;
  model: string;
  modelId: string;
  plan: PlanWithTeamMetadata;
  userId: string;
  workspace: string;
}): Transaction => {
  const usage = {
    workspace: opts.workspace,
    model: opts.model,
    usage: opts.usage,
  };
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

const createTool = createToolGroup("AI", {
  name: "AI Gateway",
  description:
    "Unified LLM API, keeping the centralized observability and billing.",
  icon: "https://assets.decocache.com/mcp/6e1418f7-c962-406b-aceb-137197902709/ai-gateway.png",
});

const AIGenerateInputSchema = z.object({
  messages: z
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
    .describe("Array of messages for the conversation"),

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

const AIGenerateOutputSchema = z.object({
  text: z.string().describe("The generated text response"),
  usage: z
    .object({
      promptTokens: z.number().describe("Number of tokens in the prompt"),
      completionTokens: z
        .number()
        .describe("Number of tokens in the completion"),
      totalTokens: z.number().describe("Total number of tokens used"),
      transactionId: z.string().describe("Transaction ID"),
    })
    .describe("Token usage information"),
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
    await assertWorkspaceResourceAccess(c.tool.name, c);

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

    const modelId = input.model ?? DEFAULT_MODEL.id;

    const llmVault = new SupabaseLLMVault(
      c.db,
      c.envVars.LLMS_ENCRYPTION_KEY,
      c.workspace.value,
    );
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

    const aiMessages = await Promise.all(
      input.messages.map((msg) =>
        convertToAIMessage({
          message: {
            ...msg,
            id: msg.id || crypto.randomUUID(),
          },
        }),
      ),
    );

    const result = await generateText({
      model: llm,
      messages: aiMessages,
      maxTokens: input.maxTokens,
      temperature: input.temperature,
    });

    const plan = await getPlan(c);
    const transaction = createLLMUsageTransaction({
      usage: result.usage,
      model: modelId,
      modelId,
      plan,
      userId:
        typeof c.user.id === "string"
          ? c.user.id
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
    const transactionId = transactionData.id;

    return {
      text: result.text,
      usage: {
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens,
        transactionId,
      },
      finishReason: result.finishReason,
    };
  },
});

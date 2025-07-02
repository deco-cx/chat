import { Agent } from "@mastra/core/agent";
import { createLLMInstance, getLLMConfig } from "@deco/ai/agent/llm";
import { z } from "zod";
import { DEFAULT_MODEL } from "../../constants.ts";
import {
  assertHasWorkspace,
  // assertWorkspaceResourceAccess,
} from "../assertions.ts";
import { type AppContext, createToolGroup } from "../context.ts";
import {
  createWalletClient,
  MicroDollar,
  WellKnownWallets,
} from "../wallet/index.ts";
import { InternalServerError, SupabaseLLMVault } from "../index.ts";
import { convertToAIMessage } from "../../../../ai/src/agent/ai-message.ts";
import { getPlan } from "../wallet/api.ts";
import type { Transaction } from "../wallet/client.ts";
import type { LanguageModelUsage } from "ai";
import type { Plan } from "../../plan.ts";

const createLLMUsageTransaction = (opts: {
  usage: LanguageModelUsage;
  model: string;
  modelId: string;
  plan: Plan;
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
    payer: opts.plan === "trial" ? {
      type: "wallet",
      id: WellKnownWallets.build(
        ...WellKnownWallets.workspace.trialCredits(opts.workspace),
      ),
    } : undefined,
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
  icon:
    "https://assets.decocache.com/mcp/6e1418f7-c962-406b-aceb-137197902709/ai-gateway.png",
});

// Input Schema (simplified for standalone usage)
const AIGenerateInputSchema = z.object({
  // Core generation parameters
  messages: z.array(z.object({
    id: z.string().optional(),
    role: z.enum(["user", "assistant", "system"]),
    content: z.string(),
    createdAt: z.date().optional(),
    experimental_attachments: z.array(z.object({
      name: z.string().optional().describe(
        "The name of the attachment, usually the file name",
      ),
      contentType: z.string().optional().describe(
        "Media type of the attachment",
      ),
      url: z.string().describe(
        "URL of the attachment (hosted file or Data URL)",
      ),
    })).optional().describe(
      "Additional attachments to be sent along with the message",
    ),
  })).describe("Array of messages for the conversation"),

  // Model and configuration
  model: z.string().optional().describe(
    "Model ID to use for generation (defaults to workspace default)",
  ),
  instructions: z.string().optional().describe("System instructions/prompt"),

  // Generation limits
  maxTokens: z.number().default(8192).optional().describe(
    "Maximum number of tokens to generate",
  ),

  // Tool integration (optional)
  tools: z.record(z.string(), z.array(z.string())).optional().describe(
    "Tools available for the generation",
  ),
});

// Output Schema (based on GenerateTextResult from @ai/sdk)
const AIGenerateOutputSchema = z.object({
  text: z.string().describe("The generated text response"),
  usage: z.object({
    promptTokens: z.number().describe("Number of tokens in the prompt"),
    completionTokens: z.number().describe("Number of tokens in the completion"),
    totalTokens: z.number().describe("Total number of tokens used"),
    transactionId: z.string().describe("Transaction ID"),
  }).describe("Token usage information"),
  finishReason: z.enum(["stop", "length", "content-filter", "tool-calls"])
    .optional().describe("Reason why generation finished"),
});

export const aiGenerate = createTool({
  name: "GENERATE",
  description:
    "Generate text using AI models directly without agent context (stateless)",
  inputSchema: AIGenerateInputSchema,
  outputSchema: AIGenerateOutputSchema,
  handler: async (input, c) => {
    assertHasWorkspace(c);
    // await assertWorkspaceResourceAccess(c.tool.name, c);
    c.resourceAccess.grant();

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
    });

    const tempAgent = new Agent({
      name: "AI Direct Generator",
      instructions: input.instructions || "You are a helpful AI assistant.",
      model: llm,
    });

    const aiMessages = await Promise.all(
      input.messages.map((msg) =>
        convertToAIMessage({
          message: {
            ...msg,
            id: msg.id || crypto.randomUUID(),
          },
          agent: tempAgent,
        })
      ),
    );

    const result = await tempAgent.generate(aiMessages, {
      maxTokens: input.maxTokens,
    });

    const plan = await getPlan(c);
    const transaction = createLLMUsageTransaction({
      usage: result.usage,
      model: modelId,
      modelId,
      plan: plan.id,
      userId: String(c.user.id) || `workspace::${c.workspace.value}`,
      workspace: c.workspace.value,
    });

    const response = await wallet["POST /transactions"]({}, {
      body: transaction,
    });

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
      finishReason: mapFinishReason(result.finishReason),
    };
  },
});

// Helper function to map finish reason to expected enum
function mapFinishReason(
  reason: string,
): "stop" | "length" | "content-filter" | "tool-calls" | undefined {
  switch (reason) {
    case "stop":
      return "stop";
    case "length":
      return "length";
    case "content-filter":
      return "content-filter";
    case "tool-calls":
      return "tool-calls";
    default:
      return undefined;
  }
}

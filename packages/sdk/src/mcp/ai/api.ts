import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModelUsage } from "ai";
import { generateObject, generateText } from "ai";
import type { JSONSchema7 } from "@ai-sdk/provider";
import { z } from "zod";
import {
  DEFAULT_MAX_STEPS,
  DEFAULT_MAX_TOKENS,
  DEFAULT_MODEL,
  MAX_MAX_STEPS,
  MAX_MAX_TOKENS,
  MIN_MAX_TOKENS,
} from "../../constants.ts";
import { MicroDollar, type Transaction, WellKnownWallets } from "../wallet/index.ts";
import {
  assertHasWorkspace,
  assertWorkspaceResourceAccess,
} from "../assertions.ts";
import { createTool } from "../context.ts";
import { createWalletClient } from "../wallet/client.ts";
import { getPlan } from "../wallet/api.ts";
import { InternalServerError } from "../index.ts";

export const AI_INTEGRATION_GROUP = "AI_INTEGRATION";

const DEFAULT_AI_MODEL = "claude-3-5-sonnet-latest"; // Default model for AI integration

interface AIUsageTransaction {
  usage: LanguageModelUsage;
  model: string;
  workspace: string;
  threadId?: string;
  userId?: string;
}

async function createAIUsageTransaction({
  usage,
  model,
  workspace,
  threadId,
  userId,
  plan,
}: AIUsageTransaction & { plan: string }): Promise<Transaction> {
  const vendor = {
    type: "vendor" as const,
    id: workspace,
  };
  const generatedBy = {
    type: "user" as const,
    id: userId || "unknown",
  };

  return {
    type: "AgentGeneration" as const,
    usage: {
      usage,
      model,
      agentId: "ai-integration",
      threadId: threadId || crypto.randomUUID(),
      workspace,
      agentPath: `${workspace}/ai-integration`,
    },
    generatedBy,
    vendor,
    payer: plan === "trial"
      ? {
        type: "wallet" as const,
        id: WellKnownWallets.build(
          ...WellKnownWallets.workspace.trialCredits(workspace),
        ),
      }
      : undefined,
    metadata: {
      model,
      workspace,
      threadId: threadId || crypto.randomUUID(),
      ...usage,
    },
    timestamp: new Date(),
  };
}

async function checkAndDebitWallet(c: any, usage: LanguageModelUsage, model: string) {
  const wallet = createWalletClient(c.envVars.WALLET_API_KEY, c.walletBinding);
  const workspace = c.workspace.value;
  const userId = c.user?.id;
  
  // Check wallet balance
  const walletId = WellKnownWallets.build(
    ...WellKnownWallets.workspace.genCredits(workspace),
  );
  
  const response = await wallet["GET /accounts/:id"]({
    id: encodeURIComponent(walletId),
  });

  if (response.status === 404) {
    throw new Error("Insufficient funds");
  }

  if (!response.ok) {
    console.error("Failed to check balance", response);
    throw new Error("Failed to check wallet balance");
  }

  const data = await response.json();
  const balance = MicroDollar.fromMicrodollarString(data.balance);

  if (balance.isNegative() || balance.isZero()) {
    throw new Error("Insufficient funds");
  }

  // Get plan and create transaction
  const plan = await getPlan(c);
  const transaction = await createAIUsageTransaction({
    usage,
    model,
    workspace,
    threadId: c.metadata?.threadId,
    userId,
    plan: plan.id,
  });

  // Debit the wallet
  const transactionResponse = await wallet["POST /transactions"]({}, {
    body: transaction,
  });

  if (!transactionResponse.ok) {
    console.error("Failed to debit wallet", transactionResponse);
  }
}

export const generateAIText = createTool({
  name: "AI_GENERATE_TEXT",
  description: "Generate text using AI models. The response will be a JSON object with the generated text.",
  group: AI_INTEGRATION_GROUP,
  inputSchema: z.object({
    messages: z.array(z.object({
      role: z.enum(["user", "assistant", "system"]),
      content: z.string(),
    })).describe("The conversation messages"),
    model: z.string().optional().default(DEFAULT_AI_MODEL).describe("The model to use for generation"),
    maxTokens: z.number().optional().default(DEFAULT_MAX_TOKENS).describe("Maximum tokens to generate"),
    temperature: z.number().optional().default(0.7).describe("Temperature for generation"),
    maxSteps: z.number().optional().default(DEFAULT_MAX_STEPS).describe("Maximum steps for tool use"),
  }),
  handler: async ({ messages, model, maxTokens, temperature, maxSteps }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c.tool.name, c);

    const openai = createOpenAI({
      apiKey: c.envVars.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
    });

    const llm = openai(model || DEFAULT_AI_MODEL);

    try {
      // Adjust token limits
      const adjustedMaxTokens = Math.min(
        Math.max(MIN_MAX_TOKENS, maxTokens || DEFAULT_MAX_TOKENS),
        MAX_MAX_TOKENS
      );
      const adjustedMaxSteps = Math.min(
        Math.max(1, maxSteps || DEFAULT_MAX_STEPS),
        MAX_MAX_STEPS
      );

      const result = await generateText({
        model: llm,
        messages,
        maxTokens: adjustedMaxTokens,
        temperature,
        maxSteps: adjustedMaxSteps,
      });

      // Debit wallet after successful generation
      await checkAndDebitWallet(c, result.usage, model || DEFAULT_AI_MODEL);

      return {
        text: result.text,
        usage: result.usage,
        finishReason: result.finishReason,
      };
    } catch (error) {
      throw new InternalServerError(
        error instanceof Error ? error.message : "Failed to generate text"
      );
    }
  },
});

export const generateAIObject = createTool({
  name: "AI_GENERATE_OBJECT",
  description: "Generate structured JSON objects using AI models",
  group: AI_INTEGRATION_GROUP,
  inputSchema: z.object({
    messages: z.array(z.object({
      role: z.enum(["user", "assistant", "system"]),
      content: z.string(),
    })).describe("The conversation messages"),
    schema: z.any().describe("JSON Schema for the expected output"),
    model: z.string().optional().default(DEFAULT_AI_MODEL).describe("The model to use for generation"),
    maxTokens: z.number().optional().default(DEFAULT_MAX_TOKENS).describe("Maximum tokens to generate"),
    temperature: z.number().optional().default(0.7).describe("Temperature for generation"),
  }),
  handler: async ({ messages, schema, model, maxTokens, temperature }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c.tool.name, c);

    const openai = createOpenAI({
      apiKey: c.envVars.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
    });

    const llm = openai(model || DEFAULT_AI_MODEL);

    try {
      // Adjust token limits
      const adjustedMaxTokens = Math.min(
        Math.max(MIN_MAX_TOKENS, maxTokens || DEFAULT_MAX_TOKENS),
        MAX_MAX_TOKENS
      );

      const result = await generateObject({
        model: llm,
        messages,
        schema: schema as JSONSchema7,
        maxTokens: adjustedMaxTokens,
        temperature,
      });

      // Debit wallet after successful generation
      await checkAndDebitWallet(c, result.usage, model || DEFAULT_AI_MODEL);

      return {
        object: result.object,
        usage: result.usage,
        finishReason: result.finishReason,
      };
    } catch (error) {
      throw new InternalServerError(
        error instanceof Error ? error.message : "Failed to generate object"
      );
    }
  },
});
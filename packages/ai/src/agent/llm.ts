import { isWellKnownModel, WELL_KNOWN_MODELS } from "@deco/sdk";
import type { LLMVault } from "@deco/sdk/mcp";
import type { LanguageModelV1 } from "ai";
import { createLLMProvider } from "./llm-provider.ts";

export const DEFAULT_ACCOUNT_ID = "c95fc4cec7fc52453228d9db170c372c";
export const DEFAULT_GATEWAY_ID = "deco-ai";

export interface LLMConfig {
  model: string;
  bypassGateway?: boolean;
  bypassOpenRouter?: boolean;
  apiKey?: string;
}

export interface LLMConfigWithModelId extends LLMConfig {
  modelId: string;
}

const isUUID = (modelId: string): boolean => {
  return (
    modelId.match(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    ) !== null
  );
};

/**
 * Gets the LLM config for a given model id.
 * If not a managed model, will read the api key from the current workspace's llm vault.
 */
export async function getLLMConfig({
  modelId,
  llmVault,
}: {
  modelId: string;
  llmVault?: LLMVault;
}): Promise<LLMConfigWithModelId> {
  if (isUUID(modelId)) {
    if (!llmVault) {
      throw new Error("LLM vault not found");
    }

    // TODO(@camudo): cache for custom models, so we don't read the api key every time.
    const { model, apiKey } = await llmVault.readApiKey(modelId);

    return {
      model,
      apiKey: apiKey,
      bypassOpenRouter: true,
      modelId,
    };
  }

  const id = isWellKnownModel(modelId) ? modelId : WELL_KNOWN_MODELS[0].id;

  return { model: id, modelId: id };
}

export function createLLMInstance({
  model,
  bypassGateway,
  bypassOpenRouter,
  apiKey,
  envs,
  metadata,
}: LLMConfig & {
  envs: Record<string, string>;
  metadata?: Record<string, string>;
}): {
  llm: LanguageModelV1;
  tokenLimit: number;
} {
  const [provider, ...rest] = model.split(":");
  const providerModel = rest.join(":");
  const accountId = envs?.ACCOUNT_ID ?? DEFAULT_ACCOUNT_ID;
  const gatewayId = envs?.GATEWAY_ID ?? DEFAULT_GATEWAY_ID;

  const providerClient = createLLMProvider({
    bypassOpenRouter,
    envs,
    accountId,
    gatewayId,
    provider,
    bypassGateway,
    apiKey,
    metadata,
  });

  return providerClient(providerModel);
}

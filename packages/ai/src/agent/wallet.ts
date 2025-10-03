import type { ClientOf } from "@deco/sdk/http";
import type { Workspace } from "@deco/sdk/path";
import {
  MicroDollar,
  type Transaction,
  type WalletAPI,
  WellKnownTransactions,
  WellKnownWallets,
} from "@deco/sdk/mcp/wallet";
import type { LanguageModelUsage } from "ai";
import { WebCache } from "@deco/sdk/cache";

export interface AgentWalletConfig {
  wallet: ClientOf<WalletAPI>;
  agentId: string;
  agentPath: string;
}

export interface ComputeAgentUsageOpts {
  userId?: string;
  usage: LanguageModelUsage;
  threadId: string;
  model: string;
  modelId: string;
  workspace: Workspace;
}

interface CreateUsageTransactionOpts extends ComputeAgentUsageOpts {
  agentId: string;
  agentPath: string;
}

function createAgentUsageTransaction({
  usage,
  threadId,
  model,
  modelId,
  userId,
  agentId,
  agentPath,
  workspace,
}: CreateUsageTransactionOpts): Transaction {
  const usageData = {
    model,
    modelId,
    agentId,
    threadId,
    workspace,
    agentPath,
  };
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
      usage: {
        ...usage,
        promptTokens: usage.inputTokens ?? 0,
        completionTokens: usage.outputTokens ?? 0,
        totalTokens: usage.totalTokens ?? 0,
      },
      ...usageData,
    },
    generatedBy,
    vendor,
    metadata: {
      ...usageData,
      ...usage,
    },
    timestamp: new Date(),
  };
}

export class AgentWallet {
  private checkedUserCreditReward = false;
  private hasBalanceCache: WebCache<boolean> = new WebCache<boolean>(
    "agent_wallet_funds",
    WebCache.MAX_SAFE_TTL,
  );
  private userCreditsRewardsCache: WebCache<boolean> = new WebCache<boolean>(
    "agent_wallet_user_credits_rewards",
    WebCache.MAX_SAFE_TTL,
  );
  private rewardPromise: Map<string, Promise<void>> = new Map();
  constructor(private config: AgentWalletConfig) {}

  async updateBalanceCache(workspace: Workspace) {
    const hasBalance = await this.hasBalance(workspace);
    this.hasBalanceCache.set(workspace, hasBalance);
    return hasBalance;
  }

  async canProceed(workspace: Workspace) {
    const hasBalance = await this.hasBalanceCache.get(workspace);
    if (typeof hasBalance === "boolean") {
      if (!hasBalance) {
        return this.updateBalanceCache(workspace); // lazy update
      }
      return hasBalance;
    }

    // TODO (@mcandeia) this can cause users using their wallet without credit for few times.
    this.updateBalanceCache(workspace); // update in background
    return true;
  }

  get client() {
    return this.config.wallet;
  }

  async hasBalance(workspace: Workspace) {
    await this.rewardFreeCreditsIfNeeded(workspace);

    const walletId = WellKnownWallets.build(
      ...WellKnownWallets.workspace.genCredits(workspace),
    );
    const response = await this.client["GET /accounts/:id"]({
      id: encodeURIComponent(walletId),
    });

    if (response.status === 404) {
      return false;
    }

    if (!response.ok) {
      console.error("Failed to check balance", response);
      return true;
    }

    const data = await response.json();

    const balance = MicroDollar.fromMicrodollarString(data.balance);

    return !balance.isNegative() && !balance.isZero();
  }

  async computeLLMUsage({
    usage,
    threadId,
    model,
    modelId,
    userId,
    workspace,
  }: ComputeAgentUsageOpts) {
    const agentId = this.config.agentId;

    const operation = createAgentUsageTransaction({
      usage,
      threadId,
      model,
      modelId,
      userId,
      agentId,
      agentPath: this.config.agentPath,
      workspace,
    });

    const response = await this.client["POST /transactions"](
      {},
      {
        body: operation,
      },
    );

    if (!response.ok) {
      // TODO(@mcandeia): add error tracking with posthog
    }

    this.updateBalanceCache(workspace);
  }

  ensureCreditRewards(workspace: Workspace): Promise<void> {
    if (this.checkedUserCreditReward) {
      return Promise.resolve();
    }

    if (this.rewardPromise.has(workspace)) {
      return this.rewardPromise.get(workspace) ?? Promise.resolve();
    }

    const promise = (async () => {
      const rewards = [
        {
          type: "WorkspaceGenCreditReward" as const,
          amount: "2_000000",
          workspace,
          transactionId: WellKnownTransactions.freeTwoDollars(
            encodeURIComponent(workspace),
          ),
        },
      ];

      await Promise.all(
        rewards.map(async (operation) => {
          let retries = 3;
          while (retries > 0) {
            const response = await this.client["PUT /transactions/:id"](
              { id: operation.transactionId },
              { body: operation },
            );

            if (response.ok || response.status === 304) {
              break;
            }

            // retry on conflict
            if (response.status === 409) {
              retries--;
              if (retries > 0) {
                await new Promise((resolve) => setTimeout(resolve, 5000));
                continue;
              }
            }

            throw new Error(
              `Failed to ensure pending operations are done: ${JSON.stringify(
                operation,
              )}`,
            );
          }
        }),
      );

      this.checkedUserCreditReward = true;
      this.rewardPromise.delete(workspace);
    })();

    this.rewardPromise.set(workspace, promise);
    return promise;
  }

  async rewardFreeCreditsIfNeeded(workspace: Workspace) {
    const wasRewarded = await this.userCreditsRewardsCache.get(workspace);

    if (wasRewarded) {
      // User was already rewarded, skip
      return;
    }

    try {
      await this.ensureCreditRewards(workspace);
      // Mark as rewarded
      await this.userCreditsRewardsCache.set(workspace, true);
    } catch (error) {
      console.error("Failed to ensure credit rewards", error);
    }
  }
}

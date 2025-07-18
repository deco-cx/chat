import { WebCache } from "@deco/sdk/cache";
import type { ClientOf } from "@deco/sdk/http";
import {
  MicroDollar,
  type Transaction,
  type WalletAPI,
  WellKnownTransactions,
  WellKnownWallets,
} from "@deco/sdk/mcp/wallet";
import type { Workspace } from "@deco/sdk/path";
import type { LanguageModelUsage } from "ai";

export interface AgentWalletConfig {
  wallet: ClientOf<WalletAPI>;
  workspace: Workspace;
  agentId: string;
  agentPath: string;
}

export interface ComputeAgentUsageOpts {
  userId?: string;
  usage: LanguageModelUsage;
  threadId: string;
  model: string;
  modelId: string;
}

interface CreateUsageTransactionOpts extends ComputeAgentUsageOpts {
  agentId: string;
  agentPath: string;
  workspace: string;
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
      usage,
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

  async updateBalanceCache() {
    const hasBalance = await this.hasBalance();
    this.hasBalanceCache.set(this.config.workspace, hasBalance);
    return hasBalance;
  }

  async canProceed() {
    const hasBalance = await this.hasBalanceCache.get(this.config.workspace);
    if (typeof hasBalance === "boolean") {
      if (!hasBalance) {
        return this.updateBalanceCache(); // lazy update
      }
      return hasBalance;
    }

    // TODO (@mcandeia) this can cause users using their wallet without credit for few times.
    this.updateBalanceCache(); // update in background
    return true;
  }

  get client() {
    return this.config.wallet;
  }

  async hasBalance() {
    await this.rewardFreeCreditsIfNeeded();

    const walletId = WellKnownWallets.build(
      ...WellKnownWallets.workspace.genCredits(this.config.workspace),
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
      workspace: this.config.workspace,
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

    this.updateBalanceCache();
  }

  ensureCreditRewards(): Promise<void> {
    if (this.checkedUserCreditReward) {
      return Promise.resolve();
    }

    if (this.rewardPromise.has(this.config.workspace)) {
      return this.rewardPromise.get(this.config.workspace) ?? Promise.resolve();
    }

    const promise = (async () => {
      const rewards = [
        {
          type: "WorkspaceGenCreditReward" as const,
          amount: "2_000000",
          workspace: this.config.workspace,
          transactionId: WellKnownTransactions.freeTwoDollars(
            encodeURIComponent(this.config.workspace),
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
      this.rewardPromise.delete(this.config.workspace);
    })();

    this.rewardPromise.set(this.config.workspace, promise);
    return promise;
  }

  async rewardFreeCreditsIfNeeded() {
    const wasRewarded = await this.userCreditsRewardsCache.get(
      this.config.workspace,
    );

    if (wasRewarded) {
      // User was already rewarded, skip
      return;
    }

    try {
      await this.ensureCreditRewards();
      // Mark as rewarded
      await this.userCreditsRewardsCache.set(this.config.workspace, true);
    } catch (error) {
      console.error("Failed to ensure credit rewards", error);
    }
  }
}

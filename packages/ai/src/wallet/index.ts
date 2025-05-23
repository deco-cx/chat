import type { ClientOf } from "@deco/sdk/http";
import type { Workspace } from "@deco/sdk/path";
import {
  MicroDollar,
  type WalletAPI,
  WellKnownTransactions,
  WellKnownWallets,
} from "@deco/sdk/mcp/wallet";
import type { LanguageModelUsage } from "ai";
import { WebCache } from "@deco/sdk/cache";

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
  agentName: string;
}

export class AgentWallet {
  private checkedUserCreditReward = false;
  private hasBalanceCache: WebCache<boolean> = new WebCache<boolean>(
    "agent_wallet_funds",
    WebCache.MAX_SAFE_TTL,
  );
  private userCreditsRegardsCache: WebCache<boolean> = new WebCache<boolean>(
    "agent_wallet_user_credits_regards",
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
    agentName,
    userId,
  }: ComputeAgentUsageOpts) {
    const agentId = this.config.agentId;

    const usageData = {
      model,
      agentId,
      threadId,
      workspace: this.config.workspace,
      agentPath: this.config.agentPath,
    };
    const vendor = {
      type: "vendor",
      id: this.config.workspace,
    };
    const generatedBy = {
      type: "user",
      id: userId || "unknown",
    };

    const operation = {
      type: "AgentGeneration" as const,
      description: `Generation on agent ${agentName}`,
      usage: {
        usage,
        ...usageData,
      },
      generatedBy,
      vendor,
      metadata: {
        agentName,
        ...usageData,
        ...usage,
      },
    };

    const response = await this.client["POST /transactions"]({}, {
      body: operation,
    });

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
          const response = await this.client["PUT /transactions/:id"](
            { id: operation.transactionId },
            { body: operation },
          );

          if (!response.ok && response.status !== 304) {
            console.error("Failed to ensure pending operations are done", {
              operation,
              response,
            });
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
    const wasRewarded = await this.userCreditsRegardsCache.get(
      this.config.workspace,
    );

    if (wasRewarded) {
      // User was already rewarded, skip
      return;
    }

    await this.ensureCreditRewards();

    // Mark as rewarded
    await this.userCreditsRegardsCache.set(this.config.workspace, true);
  }
}

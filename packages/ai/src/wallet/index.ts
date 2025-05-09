import type { ClientOf } from "@webdraw/common";
import type { Workspace } from "@deco/sdk/path";
import { trackServerEvent } from "@webdraw/common/posthog/server";
import {
  MicroDollar,
  type WalletAPI,
  WellKnownTransactions,
  WellKnownWallets,
} from "@webdraw/common/wallet";
import type { LanguageModelUsage } from "ai";
import { WebCache } from "@deco/sdk/cache";

export interface AgentWalletConfig {
  wallet: ClientOf<WalletAPI>;
  workspace: Workspace;
  agentId: string;
  agentPath: string;
}

export interface ComputeAgentUsageOpts {
  userId: string;
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
  constructor(private config: AgentWalletConfig) { }

  async updateBalanceCache(userId: string) {
    const hasBalance = await this.hasBalance(userId);
    this.hasBalanceCache.set(userId, hasBalance);
    return hasBalance;
  }

  async canProceed(userId: string) {
    const hasBalance = await this.hasBalanceCache.get(userId);
    if (typeof hasBalance === "boolean") {
      if (!hasBalance) {
        return this.updateBalanceCache(userId); // lazy update
      }
      return hasBalance;
    }

    // TODO (@mcandeia) this can cause users using their wallet without credit for few times.
    this.updateBalanceCache(userId); // update in background
    return true;
  }

  get client() {
    return this.config.wallet;
  }

  async hasBalance(userId: string) {
    await this.rewardUserIfNeeded(userId);

    const walletId = WellKnownWallets.build(
      ...WellKnownWallets.user.genCredits(userId),
    );
    const response = await this.config.wallet["GET /accounts/:id"]({
      id: walletId,
    });

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
      id: userId, // TODO: this should be the agent's vendor id, once we have a way to sell agents
    };
    const generatedBy = {
      type: "user",
      id: userId,
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

    const response = await this.config.wallet["POST /transactions"]({}, {
      body: operation,
    });

    if (!response.ok) {
      const textResponse = await response.text();

      if (textResponse.includes("InsufficientFundsError")) {
        trackServerEvent({
          event: "ai_agent_insufficient_balance",
          distinctId: userId,
          properties: {
            agent_name: agentName,
            user_id: generatedBy.id,
            agent_id: usageData.agentId,
            agent_path: usageData.agentPath,
          },
        });
      } else {
        trackServerEvent({
          event: "ai_agent_wallet_error",
          distinctId: userId,
          properties: {
            agent_name: agentName,
            usage,
            vendor_id: vendor.id,
            payer_id: userId,
            user_id: generatedBy.id,
            model,
            agent_id: usageData.agentId,
            thread_id: usageData.threadId,
            workspace: usageData.workspace,
            agent_path: usageData.agentPath,
            response: textResponse,
            is_free_generation: false,
          },
        });
      }
    }

    this.updateBalanceCache(userId);
  }

  ensureCreditRewards(userId: string): Promise<void> {
    if (this.checkedUserCreditReward) {
      return Promise.resolve();
    }

    if (this.rewardPromise.has(userId)) {
      return this.rewardPromise.get(userId) ?? Promise.resolve();
    }

    const promise = (async () => {
      const rewards = [
        {
          type: "GenCreditsReward" as const,
          amount: "2_000000",
          userId,
          transactionId: WellKnownTransactions.freeTwoDollars(userId),
        },
      ];

      await Promise.all(
        rewards.map(async (operation) => {
          const response = await this.config.wallet["PUT /transactions/:id"](
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
      this.rewardPromise.delete(userId);
    })();

    this.rewardPromise.set(userId, promise);
    return promise;
  }

  async rewardUserIfNeeded(userId: string) {
    const wasRewarded = await this.userCreditsRegardsCache.get(userId);

    if (wasRewarded) {
      // User was already rewarded, skip
      return;
    }

    await this.ensureCreditRewards(userId);

    // Mark as rewarded
    await this.userCreditsRegardsCache.set(userId, true);
  }
}

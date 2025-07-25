import type { ClientOf } from "@deco/sdk/http";
import { z } from "zod";
import { InternalServerError, UserInputError } from "../../errors.ts";
import {
  assertHasWorkspace,
  assertWorkspaceResourceAccess,
} from "../assertions.ts";
import { type AppContext, createToolGroup } from "../context.ts";
import {
  createWalletClient,
  MicroDollar,
  type WalletAPI,
  WellKnownWallets,
} from "./index.ts";
import { createCheckoutSession as createStripeCheckoutSession } from "./stripe/checkout.ts";
import { getPlan } from "./plans.ts";
import { Markup } from "../../plan.ts";

export const getWalletClient = (c: AppContext) => {
  if (!c.envVars.WALLET_API_KEY) {
    throw new InternalServerError("WALLET_API_KEY is not set");
  }
  return createWalletClient(c.envVars.WALLET_API_KEY, c.walletBinding);
};

const Account = {
  fetch: async (wallet: ClientOf<WalletAPI>, id: string) => {
    const accountResponse = await wallet["GET /accounts/:id"]({
      id: encodeURIComponent(id),
    });

    if (accountResponse.status === 404) {
      return null;
    }

    if (!accountResponse.ok) {
      throw new Error("Failed to fetch account");
    }

    return accountResponse.json();
  },
  format: (account: WalletAPI["GET /accounts/:id"]["response"]) => {
    return {
      balance: MicroDollar.fromMicrodollarString(account.balance).display(),
      balanceExact: MicroDollar.fromMicrodollarString(account.balance).display({
        showAllDecimals: true,
      }),
    };
  },
};

const isNotNull = <T>(value: T | null): value is T => Boolean(value);

const ThreadsUsage = {
  fetch: async (
    wallet: ClientOf<WalletAPI>,
    workspace: string,
    range: "day" | "week" | "month",
  ) => {
    const usageResponse = await wallet["GET /usage/threads"]({
      workspace: encodeURIComponent(workspace),
      range,
    });

    if (!usageResponse.ok) {
      throw new Error("Failed to fetch usage");
    }

    return usageResponse.json();
  },
  format: (
    usage: WalletAPI["GET /usage/threads"]["response"],
  ) => {
    return {
      items: usage.items.map((thread) => ({
        ...thread,
        total: MicroDollar.fromMicrodollarString(thread.total).display({
          showAllDecimals: true,
        }),
        transactions: thread.transactions.map((transaction) => ({
          id: transaction.id,
          timestamp: transaction.timestamp,
          amount: MicroDollar.fromMicrodollarString(transaction.amount)
            .toDollars(),
          agentId: transaction.agentId,
          generatedBy: transaction.generatedBy,
        })),
      })).filter(isNotNull),
    };
  },
};

const AgentsUsage = {
  fetch: async (
    wallet: ClientOf<WalletAPI>,
    workspace: string,
    range: "day" | "week" | "month",
  ) => {
    const usageResponse = await wallet["GET /usage/agents"]({
      workspace,
      range,
    });

    if (!usageResponse.ok) {
      throw new Error("Failed to fetch usage");
    }

    return usageResponse.json();
  },
  format: (usage: WalletAPI["GET /usage/agents"]["response"]) => {
    return {
      total: MicroDollar.fromMicrodollarString(usage.total).display(),
      items: usage.items.map((item) => ({
        id: item.id,
        label: item.label,
        total: MicroDollar.fromMicrodollarString(item.total).toDollars(),
        transactions: item.transactions.map((transaction) => ({
          id: transaction.id,
          timestamp: transaction.timestamp,
          amount: MicroDollar.fromMicrodollarString(transaction.amount)
            .toDollars(),
          agentId: transaction.agentId,
          generatedBy: transaction.generatedBy,
        })),
      })),
    };
  },
};

const BillingHistory = {
  fetch: async (
    wallet: ClientOf<WalletAPI>,
    workspace: string,
    range: "day" | "week" | "month" | "year",
  ) => {
    const historyResponse = await wallet["GET /billing/history"]({
      workspace: encodeURIComponent(workspace),
      range,
    });

    if (!historyResponse.ok) {
      throw new Error("Failed to fetch billing history");
    }

    return historyResponse.json();
  },
  format: (history: WalletAPI["GET /billing/history"]["response"]) => {
    return {
      items: history.items.map((item) => ({
        ...item,
        amount: MicroDollar.fromMicrodollarString(item.amount).display(),
      })),
    };
  },
};

const createTool = createToolGroup("Wallet", {
  name: "Wallet & Billing",
  description: "Handle payments and subscriptions.",
  icon:
    "https://assets.decocache.com/mcp/c179a1cd-4933-40ac-a9c1-18f24e19e592/Wallet--Billing.png",
});

export const getWalletAccount = createTool({
  name: "GET_WALLET_ACCOUNT",
  description: "Get the wallet account for the current tenant",
  inputSchema: z.object({}),
  outputSchema: z.object({
    balance: z.string(),
    balanceExact: z.string(),
  }),
  handler: async (_, c) => {
    assertHasWorkspace(c);

    await assertWorkspaceResourceAccess(c.tool.name, c);

    const wallet = getWalletClient(c);

    const workspaceWalletId = WellKnownWallets.build(
      ...WellKnownWallets.workspace.genCredits(c.workspace.value),
    );
    const data = await Account.fetch(wallet, workspaceWalletId);

    if (!data) {
      return {
        balance: MicroDollar.ZERO.display(),
        balanceExact: MicroDollar.ZERO.display({
          showAllDecimals: true,
        }),
      };
    }

    return Account.format(data);
  },
});

export const getThreadsUsage = createTool({
  name: "GET_THREADS_USAGE",
  description: "Get the threads usage for the current tenant's wallet",
  inputSchema: z.object({
    range: z.enum(["day", "week", "month"]),
  }),
  handler: async ({ range }, c) => {
    assertHasWorkspace(c);

    await assertWorkspaceResourceAccess(c.tool.name, c);

    const wallet = getWalletClient(c);

    const usage = await ThreadsUsage.fetch(
      wallet,
      c.workspace.value,
      range,
    );
    return ThreadsUsage.format(usage);
  },
});

export const getAgentsUsage = createTool({
  name: "GET_AGENTS_USAGE",
  description: "Get the agents usage for the current tenant's wallet",
  inputSchema: z.object({
    range: z.enum(["day", "week", "month"]),
  }),
  outputSchema: z.object({
    total: z.string(),
    items: z.array(z.object({
      id: z.string(),
      label: z.string(),
      total: z.number(),
      transactions: z.array(z.object({
        id: z.string(),
        timestamp: z.string(),
        amount: z.number(),
        agentId: z.string(),
        generatedBy: z.string(),
      })),
    })),
  }),
  handler: async ({ range }, c) => {
    assertHasWorkspace(c);

    await assertWorkspaceResourceAccess(c.tool.name, c);

    const wallet = getWalletClient(c);

    const usage = await AgentsUsage.fetch(
      wallet,
      c.workspace.value,
      range,
    );
    return AgentsUsage.format(usage);
  },
});

export const getBillingHistory = createTool({
  name: "GET_BILLING_HISTORY",
  description: "Get the billing history for the current tenant's wallet",
  inputSchema: z.object({
    range: z.enum(["day", "week", "month", "year"]),
  }),
  outputSchema: z.object({
    items: z.array(z.object({
      id: z.string(),
      amount: z.string(),
      timestamp: z.string(),
      type: z.string(),
    })),
  }),
  handler: async ({ range }, c) => {
    c.resourceAccess.grant();
    assertHasWorkspace(c);

    await assertWorkspaceResourceAccess(c.tool.name, c);

    const wallet = getWalletClient(c);

    const history = await BillingHistory.fetch(
      wallet,
      c.workspace.value,
      range,
    );
    return BillingHistory.format(history);
  },
});

export const createCheckoutSession = createTool({
  name: "CREATE_CHECKOUT_SESSION",
  description: "Create a checkout session for the current tenant's wallet",
  inputSchema: z.object({
    amountUSDCents: z.number(),
    successUrl: z.string(),
    cancelUrl: z.string(),
  }),
  outputSchema: z.object({
    url: z.string(),
  }),
  handler: async ({ amountUSDCents, successUrl, cancelUrl }, ctx) => {
    assertHasWorkspace(ctx);

    await assertWorkspaceResourceAccess(ctx.tool.name, ctx);
    const plan = await getPlan(ctx);
    const amount = Markup.add({
      usdCents: amountUSDCents,
      markupPercentage: plan.markup,
    });

    const session = await createStripeCheckoutSession({
      successUrl,
      cancelUrl,
      product: {
        id: "WorkspaceWalletDeposit",
        amountUSD: amount,
      },
      ctx,
      metadata: {
        created_by_user_id: ctx.user.id as string,
        created_by_user_email: (ctx.user.email || "") as string,
      },
    });

    return {
      url: session.url,
    };
  },
});

export const createWalletVoucher = createTool({
  name: "CREATE_VOUCHER",
  description: "Create a voucher with money from the current tenant's wallet",
  inputSchema: z.object({
    amount: z.number().describe(
      "The amount of money to add to the voucher. Specified in USD dollars.",
    ),
  }),
  outputSchema: z.object({
    id: z.string(),
  }),
  handler: async ({ amount }, c) => {
    assertHasWorkspace(c);

    await assertWorkspaceResourceAccess(c.tool.name, c);

    const wallet = getWalletClient(c);
    const id = crypto.randomUUID();
    const amountMicroDollars = MicroDollar.fromDollars(amount);
    const claimableId = `${id}-${amountMicroDollars.toMicrodollarString()}`;

    if (amountMicroDollars.isZero() || amountMicroDollars.isNegative()) {
      throw new UserInputError("Amount must be positive");
    }

    const operation = {
      type: "WorkspaceCreateVoucher" as const,
      amount: amountMicroDollars.toMicrodollarString(),
      voucherId: id,
      workspace: c.workspace.value,
    } as const;

    const response = await wallet["POST /transactions"]({}, {
      body: operation,
    });

    if (!response.ok) {
      throw new Error("Failed to create voucher");
    }

    return {
      id: claimableId,
    };
  },
});

export const redeemWalletVoucher = createTool({
  name: "REDEEM_VOUCHER",
  description: "Redeem a voucher for the current tenant's wallet",
  inputSchema: z.object({
    voucher: z.string(),
  }),
  outputSchema: z.object({
    voucherId: z.string(),
  }),
  handler: async ({ voucher }, c) => {
    assertHasWorkspace(c);

    await assertWorkspaceResourceAccess(c.tool.name, c);

    const wallet = getWalletClient(c);

    const parts = voucher.split("-");
    const voucherId = parts.slice(0, -1).join("-");
    const amountHintMicroDollars = parts.at(-1);

    if (!amountHintMicroDollars) {
      throw new UserInputError("Invalid voucher ID");
    }

    const amountMicroDollars = MicroDollar.fromMicrodollarString(
      amountHintMicroDollars,
    );

    if (amountMicroDollars.isZero() || amountMicroDollars.isNegative()) {
      throw new UserInputError("Invalid voucher ID");
    }

    const operation = {
      type: "WorkspaceRedeemVoucher" as const,
      amount: amountMicroDollars.toMicrodollarString(),
      voucherId,
      workspace: c.workspace.value,
    } as const;

    const response = await wallet["POST /transactions"]({}, {
      body: operation,
    });

    if (!response.ok) {
      throw new Error("Failed to redeem voucher");
    }

    return {
      voucherId,
    };
  },
});

export const getWorkspacePlan = createTool({
  name: "GET_WORKSPACE_PLAN",
  description: "Get the plan for the current tenant's workspace",
  inputSchema: z.object({}),
  handler: async (_, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c.tool.name, c);

    return await getPlan(c);
  },
});
